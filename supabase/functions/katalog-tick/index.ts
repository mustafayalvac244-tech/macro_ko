// Vekil :: içtihat KATALOĞU — tek turluk sayım (tick)
// ---------------------------------------------------------------------------
// NE YAPAR. Korpusu gün gün sayar ve her kararın ÜSTVERİSİNİ yazar. Tam metin
// indirmez — asıl fikir bu.
//
// NEDEN AYRI BİR İŞLEV (ölçümler bugün, gerçek isteklerle alındı):
//   · Bedesten'de toplu belge indirme YOK (documentIdList/documentIds/idList →
//     ADALET_RUNTIME_EXCEPTION), aramaya metin iliştirme de yok. Yani tam metin
//     için karar başına 1 HTTP isteği kırılmaz bir tabandır ve 10,4 milyon
//     karar ≈ 340 GB eder. Bu yol ürünün ömrü boyunca bitmez.
//   · Ama arama yanıtı üstveriyi BEDAVA veriyor: istek başına 100 kayıt,
//     1,08 saniye. Ölçülen katalog hızı 271 satır/sn (eşzamanlılık 4, 0 hata)
//     → 10,4 milyonun tamamı ~11 saat, ~2,6 GB.
//
// Yani metin hasadı "ne bulursak" iken, katalog "hepsi"dir. İkisi ayrı işler
// ve ayrı hızlarda çalışmalı; tek işlevde birleştirmek, ucuz olanı pahalı
// olanın hızına mahkûm ederdi.
//
// Kullanım: POST { "tur": "YARGITAYKARARI" | "DANISTAYKARAR", "istek": 20 }
import { createClient } from 'npm:@supabase/supabase-js@2';
import { servisYetkisiVarMi } from '../_shared/yetki.ts';
import { havuzda } from '../_shared/havuz.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BEDESTEN = 'https://bedesten.adalet.gov.tr';
const BEDESTEN_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0',
  AdaletApplicationName: 'UyapMevzuat',
};

/** Ölçüldü: 100 çalışıyor, 200 ADALET_EMPTY_EXCEPTION veriyor. */
const SAYFA_BOYU = 100;

/**
 * Boş `phrase` reddediliyor. "mahkeme" o penceredeki HER kararla eşleşiyor —
 * aynı gün için "karar" ve "dava" da birebir aynı toplamı veriyor (1.632),
 * "kamulastirma" 0 veriyor. Yani süzgeç gerçek, kelime evrensel.
 */
const EVRENSEL = 'mahkeme';

/** Gerekçe _shared/havuz.ts başlığında: 4 ölçüldü ve hatasız; 8 ölçülmedi. */
const ES_ZAMAN = 4;

type Satir = {
  id: string;
  tur: string;
  daire: string | null;
  esas_yil: number | null;
  esas_sira: number | null;
  karar_yil: number | null;
  karar_sira: number | null;
  karar_tarihi: string | null;
};

async function sayfaCek(tur: string, gun: string, sayfa: number): Promise<Satir[]> {
  const res = await fetch(`${BEDESTEN}/emsal-karar/searchDocuments`, {
    method: 'POST',
    headers: BEDESTEN_HEADERS,
    body: JSON.stringify({
      data: {
        pageSize: SAYFA_BOYU,
        pageNumber: sayfa,
        itemTypeList: [tur],
        phrase: EVRENSEL,
        kararTarihiStart: `${gun}T00:00:00.000Z`,
        kararTarihiEnd: `${gun}T23:59:59.999Z`,
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
        tur,
        daire: birim ? `${onek} ${birim}` : onek,
        esas_yil: r.esasNoYil != null ? Number(r.esasNoYil) : null,
        esas_sira: r.esasNoSira != null ? Number(r.esasNoSira) : null,
        karar_yil: r.kararNoYil != null ? Number(r.kararNoYil) : null,
        karar_sira: r.kararNoSira != null ? Number(r.kararNoSira) : null,
        // "2024-03-04T21:00:00.000+00:00" gelebiliyor (saat dilimi kaymasıyla
        // bir önceki gün). Gösterim alanı kararTarihiStr "05.03.2024" doğru
        // günü veriyor; ikisi çelişince GÖSTERİM alanına güveniyoruz.
        karar_tarihi: r.kararTarihiStr
          ? String(r.kararTarihiStr).split('.').reverse().join('-')
          : r.kararTarihi
            ? String(r.kararTarihi).slice(0, 10)
            : null,
      };
    })
    .filter((x) => x.id);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  // Bakım ucu: yalnız servis anahtarı (bkz. _shared/yetki.ts).
  if (!(await servisYetkisiVarMi(req))) {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: CORS });
  }

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !key) {
    return new Response(JSON.stringify({ error: 'not_configured' }), { status: 503, headers: CORS });
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  let tur = 'YARGITAYKARARI';
  let istek = 20;
  try {
    const body = await req.json();
    if (body?.tur === 'DANISTAYKARAR') tur = 'DANISTAYKARAR';
    /**
     * TUR BAŞINA KAÇ ARAMA İSTEĞİ — İLK SÜRÜMDEKİ HATAM BURADAYDI.
     *
     * İlk yazdığım sürüm turda TEK pencere (tek gün) işliyordu. Canlıda
     * ölçüldü: 7 dakikada yalnız 4 pencere kapandı. 15.850 pencere için bu
     * dokuz aydan uzun sürerdi — yani "11 saatte tüm korpus" hesabım doğru
     * ama TASARIM onu kullanamıyordu.
     *
     * Sebebi şu: çoğu gün 100'den az karar içeriyor, yani tek sayfada bitiyor.
     * Tek pencerelik tur, o günü kapatıp DURUYORDU; oysa asıl maliyet turun
     * kendisi (soğuk başlangıç + yetki kontrolü), arama isteği değil. Ölçülen
     * arama hızı 271 satır/sn.
     *
     * Şimdi tur, birden çok pencereyi AYNI ANDA işliyor: 20 istek ≈ 5-6 saniye,
     * ≈ 2.000 üstveri satırı.
     */
    istek = Math.min(40, Math.max(1, Number(body?.istek ?? body?.sayfa ?? 20)));
  } catch {
    // gövdesiz çağrı: varsayılan
  }

  const bas = { ...CORS, 'Content-Type': 'application/json' };
  const cevap = (o: Record<string, unknown>, durum = 200) =>
    new Response(JSON.stringify({ tur, ...o }), { status: durum, headers: bas });

  // EN YENİ GÜN ÖNCE, ama önce hiç işlenmemişler. Avukat için 2024 kararı
  // 2006 kararından daha değerli.
  const { data, error } = await supabase
    .from('ictihat_katalog_pencere')
    .select('gun, sonraki_sayfa')
    .eq('tur', tur)
    .eq('bitti', false)
    .order('son_calisma', { ascending: true, nullsFirst: true })
    .order('gun', { ascending: false })
    .limit(istek);

  if (error) return cevap({ error: 'pencere_state_failed', detail: String(error.message).slice(0, 120) }, 500);
  const pencereler = (data ?? []) as Array<{ gun: string; sonraki_sayfa: number }>;
  if (pencereler.length === 0) return cevap({ error: 'pencere_yok' }, 404);

  const simdi = new Date().toISOString();

  // Ne olursa olsun "dokunuldu" işaretle: bozuk bir pencere sonsuza kadar
  // kuyruğun başında durmasın. Tek gidiş-dönüşte, hepsi birden.
  await supabase
    .from('ictihat_katalog_pencere')
    .upsert(
      pencereler.map((p) => ({ tur, gun: p.gun, son_calisma: simdi })),
      { onConflict: 'tur,gun' }
    );

  const sonuclar = await havuzda(pencereler, ES_ZAMAN, (p) =>
    sayfaCek(tur, String(p.gun).slice(0, 10), p.sonraki_sayfa ?? 1)
  );

  const satirlar: Satir[] = [];
  const guncel: Array<Record<string, unknown>> = [];
  let basarili = 0;
  let biten = 0;
  for (let i = 0; i < pencereler.length; i++) {
    const p = pencereler[i];
    const r = sonuclar[i];
    // Bu pencere düştü: sayfası İLERLETİLMEZ, sonraki tur aynı yerden dener.
    // Karar kaybı olmaz; yalnız bir tur gecikir.
    if (r === undefined) continue;
    basarili++;
    satirlar.push(...r);
    const sayfa = p.sonraki_sayfa ?? 1;
    // Eksik sayfa = pencerenin sonu. Ölçüldü: 1.632 kayıtlı bir günde sayfa 17
    // → 32 kayıt, sayfa 18 → 0.
    const bittiMi = r.length < SAYFA_BOYU;
    if (bittiMi) biten++;
    guncel.push({
      tur,
      gun: p.gun,
      son_calisma: simdi,
      sonraki_sayfa: bittiMi ? sayfa : sayfa + 1,
      bitti: bittiMi,
      toplam: (sayfa - 1) * SAYFA_BOYU + r.length,
    });
  }

  let yazilan = 0;
  let not: string | undefined;
  if (satirlar.length) {
    // ignoreDuplicates: katalogda olan satır GÜNCELLENMEZ. Önemli, çünkü
    // metin_var ve son_deneme sütunlarını metin hasadı yazıyor; buradan
    // tekrar yazmak onları sıfırlayıp aynı metni bir daha indirtirdi.
    //
    // Aynı tur içinde aynı id iki kez gelebilir (iki pencere aynı kararı
    // döndürürse); upsert'e yinelenen anahtar göndermek tüm yazmayı düşürür,
    // o yüzden önce tekilleştiriliyor.
    const tekil = [...new Map(satirlar.map((x) => [x.id, x])).values()];
    const { error: yzErr, count } = await supabase
      .from('ictihat_katalog')
      .upsert(tekil, { onConflict: 'id', ignoreDuplicates: true, count: 'exact' });
    if (yzErr) not = `upsert: ${String(yzErr.message).slice(0, 90)}`;
    else yazilan = count ?? tekil.length;
  }

  if (guncel.length) {
    await supabase.from('ictihat_katalog_pencere').upsert(guncel, { onConflict: 'tur,gun' });
  }

  return cevap({
    pencere: pencereler.length,
    basarili,
    gun_bitti: biten,
    taranan: satirlar.length,
    eklenen: yazilan,
    ...(not ? { not } : {}),
  });
});
