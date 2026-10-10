// İÇTİHAT ARAMA UCU — 08.10.2026 denetiminde doğrulanan kusurlar (09.10.2026).
//
// Uç işlevi (supabase/functions/ictihat/index.ts) Deno'ya özgü içe aktarmalar
// taşıdığı için burada yüklenemiyor. Saf mantık _shared/ictihatArama.ts'e
// alındı ve davranışıyla sınanıyor; uçtaki bağlantılar (o saf mantığın
// GERÇEKTEN kullanıldığı) kaynak metninden denetleniyor — depodaki
// atifCanliTeyit.test.ts ile aynı kalıp.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  akilliIlkSayfa,
  arsivSatiri,
  bedestenTarihi,
  kesmeTemizle,
  kunyeYokDenemez,
  kurulOf,
  ucHataYaniti,
} from '../supabase/functions/_shared/ictihatArama';

const kok = join(__dirname, '..');
const uc = readFileSync(join(kok, 'supabase/functions/ictihat/index.ts'), 'utf8');

/** `if (action === '<ad>') {` ile başlayan bloğun metni (bir sonraki eyleme kadar). */
function eylemBlogu(ad: string): string {
  const bas = uc.indexOf(`if (action === '${ad}')`);
  expect(bas, `${ad} bloğu bulunamadı`).toBeGreaterThan(0);
  const son = uc.indexOf("if (action === '", bas + 10);
  return uc.slice(bas, son > bas ? son : undefined);
}

// ── 1) KAPALI HAVUZ KULLANICI İSTEMCİSİYLE OKUNUYORDU ──────────────────────
// Canlıda ölçüldü (09.10.2026, salt okunur): ictihat_kararlar'da RLS açık,
// "ictihat read" politikası var AMA authenticated rolünün tabloda SELECT
// YETKİSİ YOK (has_table_privilege = false; 0104 revoke etti). Politika
// yetkinin yerine geçmez: kullanıcı JWT'li istemciyle her okuma 42501 ile
// düşüyor, `data` null geliyor ve kod bunu "arşivde yok" sanıyordu.
describe('arşiv okuması servis istemcisiyle', () => {
  it('ictihat_kararlar kullanıcı JWT istemcisiyle (supabase.from) okunmaz', () => {
    expect(uc).not.toMatch(/\bsupabase\s*\.from\(\s*['"]ictihat_kararlar['"]/);
  });

  it('belge yolu arşivi hâlâ okuyor (okuma kaldırılarak "düzeltilmedi")', () => {
    expect(eylemBlogu('document')).toMatch(/\.from\('ictihat_kararlar'\)\s*\.select\('full_text'\)/);
  });
});

// ── 2) BELGE YOLU DOLU KÜNYEYİ BOŞLA EZİYORDU ──────────────────────────────
// archiveDecision boş künyeyi `null` olarak upsert ediyordu; PostgREST
// birleştirmede yükteki HER sütunu günceller. Belge yolu künyesiz çağırdığı
// için arşivdeki dolu satırın daire/esas/karar/tarih alanları null'a,
// kurulu 'Yerel'e dönüyordu.
describe('arsivSatiri — boş künye alanı yüke girmez', () => {
  const metin = 'x'.repeat(300);

  it('künyesiz çağrı yalnız id ve metni yazar (var olan künye ezilmez)', () => {
    const s = arsivSatiri({ id: '42', daire: '', esasNo: '', kararNo: '', kararTarihi: '', durum: '' }, metin, '');
    expect(Object.keys(s).sort()).toEqual(['full_text', 'id']);
  });

  it('dolu künye eksiksiz yazılır, kurul daireden türetilir', () => {
    const s = arsivSatiri(
      { id: '7', daire: 'Yargıtay 9. Hukuk Dairesi', esasNo: '2023/15402', kararNo: '2024/3311', kararTarihi: '14.03.2024', durum: 'KESİNLEŞTİ' },
      metin,
      'kıdem tazminatı',
    );
    expect(s).toEqual({
      id: '7',
      kurul: 'Yargıtay',
      daire: 'Yargıtay 9. Hukuk Dairesi',
      esas_no: '2023/15402',
      karar_no: '2024/3311',
      karar_tarihi: '14.03.2024',
      durum: 'KESİNLEŞTİ',
      arama_terimi: 'kıdem tazminatı',
      full_text: metin,
    });
  });

  it('kısmen boş künyede yalnız boş alan düşer (Bedesten durum göndermiyor)', () => {
    const s = arsivSatiri(
      { id: '8', daire: 'Danıştay 5. Daire', esasNo: '2020/1', kararNo: '2021/2', kararTarihi: '01.02.2021', durum: '' },
      metin,
      'memur',
    );
    expect(s).not.toHaveProperty('durum');
    expect(s.kurul).toBe('Danıştay');
  });

  it('daire boşken kurul yazılmaz ("Yerel" diye uydurulmaz)', () => {
    expect(arsivSatiri({ id: '9', daire: '', esasNo: '2020/1', kararNo: '', kararTarihi: '', durum: '' }, metin, '')).not.toHaveProperty('kurul');
    // kurulOf'un kendisi değişmedi: daireye bakar.
    expect(kurulOf('İstanbul Bölge Adliye Mahkemesi 5. Hukuk Dairesi')).toBe('BAM');
    expect(kurulOf('Yargıtay 1. Ceza Dairesi')).toBe('Yargıtay');
  });

  it('uçtaki arşiv yazımı bu yükü kullanıyor', () => {
    expect(uc).toMatch(/\.upsert\(\s*arsivSatiri\(/);
  });
});

// ── 3) RIZASIZ VE İŞE YARAMAYAN GEMINI VEKTÖR ÇAĞRISI ──────────────────────
// Arama sorgusu KVKK kapısından geçmeden Gemini text-embedding-004'e
// gidiyordu. Üstelik o model 768 boyutlu (depo: 0033 göçü) ve havuzdaki
// sütun vector(384) (canlıda ölçüldü): match_ictihat_semantic `<=>` ile
// karşılaştırıyor, boyut uyuşmazlığında hata atar; hata yutuluyordu.
describe('arama yolunda yurt dışına vektör çağrısı yok', () => {
  it('embedContent çağrısı ve anlamsal havuz RPC çağrısı kaldırıldı', () => {
    expect(uc).not.toMatch(/embedContent/);
    expect(uc).not.toMatch(/rpc\(\s*'match_ictihat_semantic'/);
  });
});

// ── 4) KESME İŞARETİ ───────────────────────────────────────────────────────
// _shared/uyapCanli.ts: "Kesme işareti UYAP aramasını öldürüyor (ölçüldü:
// 0 vs 86.985 kayıt)". Arama ucu sorguyu olduğu gibi gönderiyordu.
describe('kesmeTemizle', () => {
  it('kesme ve ardındaki eki atar', () => {
    expect(kesmeTemizle("Yargıtay'ın")).toBe('Yargıtay');
    expect(kesmeTemizle('Yargıtay’ın kararı')).toBe('Yargıtay kararı');
    expect(kesmeTemizle("TBK'nın 344'üncü maddesi")).toBe('TBK 344 maddesi');
  });

  it('sözcüğe bağlı olmayan kesmeyi boşluğa çevirir', () => {
    expect(kesmeTemizle("'kira tespit'")).toBe('kira tespit');
    expect(kesmeTemizle("'")).toBe('');
  });

  it('kesme yoksa sorguya dokunmaz (künye ve tırnak korunur)', () => {
    expect(kesmeTemizle('kira tespit davası')).toBe('kira tespit davası');
    expect(kesmeTemizle('2019/3641')).toBe('2019/3641');
    expect(kesmeTemizle('"şerit değiştirme"')).toBe('"şerit değiştirme"');
  });

  it('arama ve olay analizi sorguyu temizleyerek kullanıyor', () => {
    expect(eylemBlogu('search')).toMatch(/kesmeTemizle\(\s*body\.query/);
    expect(eylemBlogu('analyze')).toMatch(/kesmeTemizle\(/);
  });
});

// ── 5) KARAR TARİHİ BİR GÜN GERİ ───────────────────────────────────────────
// _shared/katalog-tick: Bedesten kararTarihi "2024-03-04T21:00:00.000+00:00"
// gelebiliyor (Türkiye gece yarısının UTC karşılığı); kararTarihiStr
// "05.03.2024" doğru günü veriyor. Arama ucu ISO'yu kesip 04.03.2024
// gösteriyordu.
describe('bedestenTarihi', () => {
  it('gösterim alanı varsa ona güvenir', () => {
    expect(bedestenTarihi('05.03.2024', '2024-03-04T21:00:00.000+00:00')).toBe('05.03.2024');
  });

  it('yalnız ISO varsa Türkiye saatine çevirir, UTC gününü yazmaz', () => {
    expect(bedestenTarihi(undefined, '2024-03-04T21:00:00.000+00:00')).toBe('05.03.2024');
    // 2016 öncesi kış saati (UTC+2): 22:00Z ertesi gündür.
    expect(bedestenTarihi('', '2010-01-14T22:00:00.000+00:00')).toBe('15.01.2010');
  });

  it('saatsiz ISO ve boş değer', () => {
    expect(bedestenTarihi(null, '2024-03-05')).toBe('05.03.2024');
    expect(bedestenTarihi(null, null)).toBe('');
  });

  it('uç Bedesten satırında bu dönüşümü kullanıyor', () => {
    expect(uc).toMatch(/bedestenTarihi\(\s*r\.kararTarihiStr,\s*r\.kararTarihi\s*\)/);
    expect(uc).not.toMatch(/String\(r\.kararTarihi\)\.slice\(0,\s*10\)/);
  });
});

// ── 6) AI YOLU: BOŞ SONUÇTA HAK İADESİ + DOĞRU HATA KODU ──────────────────
describe('olay analizi hak iadesi', () => {
  it('rezervasyondan sonraki her 2xx-dışı dönüş hakkı geri verir (ortak sarmalayıcı)', () => {
    // Eski kod "boş sonuç"ta catch'e düşmeden `return` ediyordu: rezerve
    // edilen soru hakkı geri verilmiyordu (yorumu tersini söylüyordu).
    expect(eylemBlogu('analyze')).toMatch(/basarisizsaIadeEt\(/);
  });
});

describe('ucHataYaniti — hata kodu kaynağı doğru söyler', () => {
  it('yapay zekâ arızası UYAP arızası diye bildirilmez', () => {
    expect(ucHataYaniti('upstream', 'claude: 401')).toEqual({ status: 502, govde: { error: 'upstream', detail: 'claude: 401' } });
    expect(ucHataYaniti('refusal').govde.error).toBe('upstream');
    expect(ucHataYaniti('empty')).toEqual({ status: 502, govde: { error: 'empty' } });
  });

  it('eski kodlar aynen kalır (yayındaki istemci kırılmaz)', () => {
    expect(ucHataYaniti('rate_limit')).toEqual({ status: 429, govde: { error: 'rate_limit' } });
    expect(ucHataYaniti('not_configured')).toEqual({ status: 503, govde: { error: 'not_configured' } });
    expect(ucHataYaniti('emsal_search_503')).toEqual({ status: 502, govde: { error: 'source_unreachable', detail: 'emsal_search_503' } });
  });

  it('uç dış catch bloğunda bu eşlemeyi kullanıyor', () => {
    expect(uc).toMatch(/ucHataYaniti\(/);
  });
});

// ── 7) KÜNYE "BULUNAMADI" YALANI, AKILLI SAYFALAMA, ZAMAN AŞIMI ───────────
describe('kunyeYokDenemez', () => {
  it('kaynaklardan biri düştüyse ve tam eşleşme yoksa "bulunamadı" denmez', () => {
    expect(kunyeYokDenemez(0, false, true)).toBe(true); // Bedesten düştü
    expect(kunyeYokDenemez(0, true, false)).toBe(true); // Emsal düştü
  });

  it('tam eşleşme varsa ya da iki kaynak da cevap verdiyse sonuç gösterilir', () => {
    expect(kunyeYokDenemez(1, true, true)).toBe(false);
    expect(kunyeYokDenemez(0, false, false)).toBe(false);
  });

  it('uç Bedesten hatasını sessizce boş listeye çevirmiyor', () => {
    const blok = eylemBlogu('kunye');
    expect(blok).toMatch(/kunyeYokDenemez\(/);
    expect(blok).not.toMatch(/\.catch\(\(\) => \[\]\)/);
  });
});

describe('akilliIlkSayfa — 1. sayfadan satır düşmez', () => {
  const k = (id: string) => ({ id });

  it('tam ifade sonuçları üstte, kelime aramasının 1. sayfası EKSİKSİZ', () => {
    // Eski kod birleşik listeyi pageSize'a kesiyordu; 2. sayfa kelime
    // aramasının 2. sayfası olduğu için kesilen kelime sonuçları hiç
    // gösterilmiyordu.
    const ifade = [k('a'), k('b'), k('c')];
    const kelime = [k('x'), k('a'), k('y'), k('z')];
    expect(akilliIlkSayfa(ifade, kelime).map((h) => h.id)).toEqual(['a', 'b', 'c', 'x', 'y', 'z']);
  });

  it('boş ifade listesinde kelime sırası aynen kalır', () => {
    expect(akilliIlkSayfa([], [k('1'), k('2')]).map((h) => h.id)).toEqual(['1', '2']);
  });

  it('uç akıllı kipte bunu kullanıyor ve önizleme isteğini sayfa boyuyla sınırlıyor', () => {
    expect(eylemBlogu('search')).toMatch(/akilliIlkSayfa\(/);
    expect(eylemBlogu('search')).toMatch(/attachSnippets\(hits, query, pageSize\)/);
  });
});

describe('dış kaynak çağrılarında zaman aşımı', () => {
  it('UYAP Emsal arama ve belge isteklerinin süresi sınırlı', () => {
    // Bedesten'de 10 sn sınır vardı, Emsal'de hiç yoktu: takılan bir UYAP
    // isteği işlevi platform sınırına kadar bekletiyordu.
    for (const ad of ['emsalSearch', 'emsalDocument']) {
      const bas = uc.indexOf(`async function ${ad}(`);
      expect(bas, ad).toBeGreaterThan(0);
      const govde = uc.slice(bas, uc.indexOf('\n}\n', bas));
      expect(govde, ad).toMatch(/signal:\s*AbortSignal\.timeout\(/);
    }
  });

  it('Yargıtay/Danıştay araması düşünce arşive her hata türünde başvurulur', () => {
    // Eskiden yalnız 'source_unreachable' (HTTP 200 + hata üstverisi) arşive
    // düşüyordu; zaman aşımı ve 5xx doğrudan hata ekranına gidiyordu.
    expect(eylemBlogu('search')).not.toMatch(/msg === 'source_unreachable' && page === 1/);
  });
});
