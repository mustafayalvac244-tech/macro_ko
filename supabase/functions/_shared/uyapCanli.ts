// CANLI İÇTİHAT — yapay zekâ beslemesi için, SIKI bütçeyle.
//
// NEDEN VAR (ölçülen boşluk). İki yerde iki farklı davranış vardı:
//   · İçtihat arama ekranı (functions/ictihat) canlı UYAP'a gidiyor ve
//     çektiğini arşivliyor.
//   · Yapay zekâ beslemesi (ai-chat/buildGrounding) YALNIZ kendi havuzumuza
//     bakıyor: match_ictihat_semantic + search_ictihat_fts.
//
// Havuzda 16.809 karar var; kaynakta 10.391.770. Yani dilekçe yazan model
// korpusun %0,16'sını görüyor. Uydurma atıfın en doğal kaynağı budur: modele
// dayanacak gerçek karar verilmezse uydurur.
//
// NEDEN SADECE "CANLI ÇEK" DEMİYORUZ. Bugün canlı ölçümde kaynak bir denemede
// TLS el sıkışmasında düştü; ikinci denemede dört tekrarla 34,86 saniyede
// geldi (sağlıklıyken 1,08 sn). Arka planda bu zararsızdı. Kullanıcının yapay
// zekâ isteğine bağlarsak avukatın cevabı takılır — eksik içtihattan kötüdür.
//
// BU YÜZDEN ÜÇ KURAL:
//   1. YALNIZ HAVUZ YETERSİZKEN denenir. Havuz zaten cevap veriyorsa kamu
//      hizmetine hiç dokunmayız. Bu hem nezaket hem hız.
//   2. SIKI ZAMAN AŞIMI, TEKRAR YOK. Yavaş yanıt = yanıt yok.
//   3. DEVRE KESİCİ. Kaynak ölüyse her istek zaman aşımı beklemez; bir süre
//      hiç denenmez (_shared/dayaniklilik.ts).
//
// Hata ATMAZ. En kötü hâlde boş liste döner ve cevap havuzla üretilir.
import { DevreKesici, korumaliGetir } from './dayaniklilik.ts';

const BEDESTEN = 'https://bedesten.adalet.gov.tr';
const BASLIK = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0',
  AdaletApplicationName: 'UyapMevzuat',
};

/**
 * BÜTÇELER — ölçüme göre seçildi, tahminle değil.
 * Sağlıklı arama 1,08 sn; 3 belge eşzamanlı ~1,3 sn. Bütçeler bunun iki katı:
 * normal dalgalanma geçsin, arıza geçmesin.
 */
const ARAMA_MS = 2_000;
const BELGE_MS = 2_500;
/** Aynı anda kaç belge. Ölçülen güvenli hız 4,24 belge/sn (eşzamanlılık 4). */
const ES_ZAMAN = 3;

/**
 * Devre modül seviyesinde: aynı edge örneğine düşen sonraki istekler ölü
 * kaynağı yeniden yoklamasın. Örnek yeniden başlarsa sıfırlanır — kabul
 * edilebilir, çünkü koruma en çok ARDIŞIK isteklerde gerekiyor.
 */
const devre = new DevreKesici({ esik: 3, acikKalmaMs: 120_000 });

export interface CanliKarar {
  id: string;
  daire: string;
  esasNo: string;
  kararNo: string;
  kararTarihi: string;
  metin: string;
}

/** Kesme işareti UYAP aramasını öldürüyor (ölçüldü: 0 vs 86.985 kayıt). */
function terimTemizle(t: string): string {
  return t.replace(/['’ʼ]/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

function htmlToText(html = ''): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Deno'da Buffer yok; base64 → UTF-8 elle (Türkçe harfler bozulmasın). */
function b64ToUtf8(b64: string): string {
  try {
    const bin = atob(b64);
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch {
    return b64;
  }
}

async function ara(terim: string, adet: number, sinyal: AbortSignal) {
  const res = await fetch(`${BEDESTEN}/emsal-karar/searchDocuments`, {
    method: 'POST',
    headers: BASLIK,
    signal: sinyal,
    body: JSON.stringify({
      data: {
        pageSize: Math.min(20, Math.max(1, adet)),
        pageNumber: 1,
        itemTypeList: ['YARGITAYKARARI'],
        phrase: terimTemizle(terim),
      },
    }),
  });
  if (!res.ok) throw new Error(`bedesten ${res.status}`);
  const j = await res.json();
  // Bedesten HTTP 200 dönüp arka planda çökebiliyor; "sonuç yok" sanma.
  const meta = j?.metadata ?? {};
  if (meta.FMTY === 'ERROR' || String(meta.FMC ?? '').includes('EXCEPTION')) {
    throw new Error(`bedesten ${meta.FMC ?? 'hata'}`);
  }
  // deno-lint-ignore no-explicit-any
  const list = (j?.data?.emsalKararList ?? []) as any[];
  return list
    .map((r) => {
      const onek = r?.itemType?.name === 'DANISTAYKARAR' ? 'Danıştay' : 'Yargıtay';
      let birim = String(r.birimAdi ?? '').trim();
      if (birim.startsWith(onek)) birim = birim.slice(onek.length).trim();
      return {
        id: String(r.documentId ?? ''),
        daire: birim ? `${onek} ${birim}` : onek,
        esasNo: r.esasNoYil != null ? `${r.esasNoYil}/${r.esasNoSira}` : '',
        kararNo: r.kararNoYil != null ? `${r.kararNoYil}/${r.kararNoSira}` : '',
        kararTarihi: r.kararTarihiStr ? String(r.kararTarihiStr) : '',
      };
    })
    .filter((x) => x.id);
}

async function belge(id: string, sinyal: AbortSignal): Promise<string> {
  const res = await fetch(`${BEDESTEN}/emsal-karar/getDocumentContent`, {
    method: 'POST',
    headers: BASLIK,
    signal: sinyal,
    body: JSON.stringify({ data: { documentId: id } }),
  });
  if (!res.ok) throw new Error(`bedesten belge ${res.status}`);
  const j = await res.json();
  return htmlToText(b64ToUtf8(String(j?.data?.content ?? '')));
}

/**
 * Soruyla ilgili kararları CANLI getirir. Hata atmaz, boş liste dönebilir.
 *
 * @param terim  Kullanıcının sorusu ya da ondan çıkarılmış anahtar ifade.
 * @param adet   En fazla kaç kararın METNİ çekilsin (künye daha fazlası için
 *               gelir ama metin pahalıdır: karar başına 1 HTTP isteği).
 */
export async function canliIctihat(terim: string, adet = 3): Promise<CanliKarar[]> {
  const temiz = terimTemizle(terim);
  // Bedesten boş/çok kısa aramayı reddediyor ("Sadece harf ve rakam içeren
  // aramalar yapılabilir"); tek harf ve durak kelimeler de 0 döndürüyor.
  if (temiz.length < 4) return [];

  const kunyeler = await korumaliGetir(
    devre,
    (s) => ara(temiz, Math.max(adet * 2, 6), s),
    { ms: ARAMA_MS, ad: 'canlı içtihat araması' },
    [] as Awaited<ReturnType<typeof ara>>
  );
  if (kunyeler.length === 0) return [];

  const secilen = kunyeler.slice(0, Math.max(1, adet));
  const metinler = await korumaliGetir(
    devre,
    async (s) => {
      const sonuc: (string | undefined)[] = new Array(secilen.length);
      let sonraki = 0;
      const isci = async () => {
        for (;;) {
          const i = sonraki++;
          if (i >= secilen.length) return;
          try {
            sonuc[i] = await belge(secilen[i].id, s);
          } catch {
            sonuc[i] = undefined;
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(ES_ZAMAN, secilen.length) }, isci));
      return sonuc;
    },
    { ms: BELGE_MS, ad: 'canlı içtihat belgeleri' },
    [] as (string | undefined)[]
  );

  const cikan: CanliKarar[] = [];
  for (let i = 0; i < secilen.length; i++) {
    const m = metinler[i];
    // 200 karakterin altı gerçek karar metni değil (boş kabuk / hata sayfası).
    if (typeof m === 'string' && m.length >= 200) cikan.push({ ...secilen[i], metin: m });
  }
  return cikan;
}

/** Teşhis için: devre şu an hangi durumda. */
export function canliDurum(): { devre: string; hata: number } {
  return { devre: devre.durum(), hata: devre.hataSayisi() };
}
