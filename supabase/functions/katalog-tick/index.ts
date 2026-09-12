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
// Kullanım: POST { "tur": "YARGITAYKARARI" | "DANISTAYKARAR", "sayfa": 8 }
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
  let sayfaSayisi = 8;
  try {
    const body = await req.json();
    if (body?.tur === 'DANISTAYKARAR') tur = 'DANISTAYKARAR';
    // Tur başına kaç SAYFA çekilsin. 8 sayfa = 800 üstveri satırı ≈ 3 saniye.
    // Belge indirmenin aksine bu istekler ucuz: yanıt üstveri, metin değil.
    sayfaSayisi = Math.min(20, Math.max(1, Number(body?.sayfa ?? 8)));
  } catch {
    // gövdesiz çağrı: varsayılan
  }

  const bas = { ...CORS, 'Content-Type': 'application/json' };
  const cevap = (o: Record<string, unknown>, durum = 200) =>
    new Response(JSON.stringify({ tur, ...o }), { status: durum, headers: bas });

  // EN YENİ GÜN ÖNCE — ama önce hiç işlenmemişler. Avukat için 2024 kararı
  // 2006 kararından daha değerli.
  const { data, error } = await supabase
    .from('ictihat_katalog_pencere')
    .select('gun, sonraki_sayfa')
    .eq('tur', tur)
    .eq('bitti', false)
    .order('son_calisma', { ascending: true, nullsFirst: true })
    .order('gun', { ascending: false })
    .limit(1);

  if (error) return cevap({ error: 'pencere_state_failed', detail: String(error.message).slice(0, 120) }, 500);
  const kayit = (data ?? [])[0] as { gun: string; sonraki_sayfa: number } | undefined;
  if (!kayit) return cevap({ error: 'pencere_yok' }, 404);

  const gun = String(kayit.gun).slice(0, 10);
  const bas_sayfa = kayit.sonraki_sayfa ?? 1;

  // Ne olursa olsun "işlendi" işaretle: bozuk bir pencere sonsuza kadar aynı
  // günü seçtirmesin.
  await supabase
    .from('ictihat_katalog_pencere')
    .update({ son_calisma: new Date().toISOString() })
    .eq('tur', tur)
    .eq('gun', kayit.gun);

  const sayfalar = Array.from({ length: sayfaSayisi }, (_, i) => bas_sayfa + i);
  const sonuclar = await havuzda(sayfalar, ES_ZAMAN, (s) => sayfaCek(tur, gun, s));

  // İLK BOŞ SAYFAYA KADAR GÜVENİLİR. Eşzamanlı çektiğimiz için 3. sayfa
  // patlarken 5. sayfa dönmüş olabilir; o durumda 4-5'i saymak, 3'ü sessizce
  // atlamak olurdu. Bu yüzden yalnız KESİNTİSİZ başarılı ön ek kabul edilir.
  let saglamSayfa = 0;
  let bitti = false;
  const satirlar: Satir[] = [];
  for (let i = 0; i < sonuclar.length; i++) {
    const r = sonuclar[i];
    if (r === undefined) break; // hata: buradan sonrası belirsiz
    saglamSayfa++;
    satirlar.push(...r);
    if (r.length < SAYFA_BOYU) {
      // Ölçüldü: 1.632 kayıtlı günde sayfa 17 → 32 kayıt, sayfa 18 → 0.
      // Yani eksik sayfa, pencerenin sonudur.
      bitti = true;
      break;
    }
  }

  if (saglamSayfa === 0) {
    // Hepsi düştü: sayfa ilerletme, sonraki tur aynı yerden dener.
    return cevap({ gun, sayfa: bas_sayfa, eklenen: 0, not: 'sayfa çekilemedi' });
  }

  let yazilan = 0;
  let not: string | undefined;
  if (satirlar.length) {
    // ignoreDuplicates: katalogda olan satır GÜNCELLENMEZ. Önemli, çünkü
    // metin_var sütununu metin hasadı yazıyor; buradan tekrar yazmak onu
    // false'a döndürüp aynı metni bir daha indirtirdi.
    const { error: yzErr, count } = await supabase
      .from('ictihat_katalog')
      .upsert(satirlar, { onConflict: 'id', ignoreDuplicates: true, count: 'exact' });
    if (yzErr) not = `upsert: ${String(yzErr.message).slice(0, 90)}`;
    else yazilan = count ?? satirlar.length;
  }

  await supabase
    .from('ictihat_katalog_pencere')
    .update({
      sonraki_sayfa: bitti ? bas_sayfa : bas_sayfa + saglamSayfa,
      bitti,
      toplam: satirlar.length + (bas_sayfa - 1) * SAYFA_BOYU,
    })
    .eq('tur', tur)
    .eq('gun', kayit.gun);

  return cevap({
    gun,
    sayfa: bas_sayfa,
    cekilen_sayfa: saglamSayfa,
    taranan: satirlar.length,
    eklenen: yazilan,
    ...(bitti ? { gun_bitti: true } : {}),
    ...(not ? { not } : {}),
  });
});
