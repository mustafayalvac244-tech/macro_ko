import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  aramaKarsilar,
  davaAramaMetni,
  dizinBosDurumu,
  dizinKarsilastir,
  icraAramaMetni,
  type DavaAramaAlanlari,
  type DizinSirasi,
} from '../src/utils/davaDizini';

/**
 * DOSYA DİZİNİ (app/(app)/cases/index.tsx) — 09.10.2026 denetimi.
 *
 * Arama sunucuda `ilike('title', '%' + arama + '%')` ile yapılıyordu: yalnız
 * başlık, boşluk kırpılmıyor, Türkçe katlama yok ve her tuşta yeni sorgu.
 * Esas numarası, mahkeme ya da müvekkil adıyla dosya bulunamıyordu.
 * Sıralama karşılaştırıcısı eşit tarihte 0 döndürmüyordu; aynı gün açılan
 * dosyaların sırası ters dönüyordu. Sorgu hatası "Henüz dava yok" diyordu.
 *
 * Test verisindeki adlar uydurmadır.
 */

const dava = (p: Partial<DavaAramaAlanlari> = {}): DavaAramaAlanlari => ({
  title: 'Alacak Davası',
  case_number: '2024/157 E.',
  court_name: 'İstanbul 5. Asliye Hukuk Mahkemesi',
  case_type: 'Alacak',
  opposing_party: 'Demir İnşaat A.Ş.',
  opposing_counsel: 'Av. Deniz Kaya',
  client: { full_name: 'Ayşe Şahin', company: null },
  ...p,
});

const bulur = (d: DavaAramaAlanlari, sorgu: string) => aramaKarsilar(davaAramaMetni(d), sorgu);

describe('dosya dizini araması — dava', () => {
  it('esas numarasıyla bulunur', () => {
    expect(bulur(dava(), '2024/157')).toBe(true);
  });

  it('mahkeme adıyla bulunur', () => {
    expect(bulur(dava(), 'asliye hukuk')).toBe(true);
  });

  it('müvekkil adıyla, Türkçe karakter yazmadan bulunur', () => {
    expect(bulur(dava(), 'ayse sahin')).toBe(true);
  });

  it('karşı tarafla bulunur', () => {
    expect(bulur(dava(), 'demir insaat')).toBe(true);
  });

  it('baştaki/sondaki boşluk aramayı bozmaz', () => {
    expect(bulur(dava(), '  alacak  ')).toBe(true);
  });

  it('büyük harf ve İ/ı farkı aramayı bozmaz', () => {
    expect(bulur(dava(), 'İSTANBUL')).toBe(true);
    expect(bulur(dava({ title: 'Itiraz Davası' }), 'ıtiraz')).toBe(true);
  });

  it('farklı alanlardan iki kelime birlikte aranabilir', () => {
    expect(bulur(dava(), 'sahin 2024/157')).toBe(true);
  });

  it('iki alan birleşip sahte eşleşme üretmez', () => {
    expect(bulur(dava({ title: 'Kira', case_type: 'Tespit' }), 'kiratespit')).toBe(false);
  });

  it('alakasız sorgu eşleşmez; boş sorgu her şeyi geçirir', () => {
    expect(bulur(dava(), 'boşanma')).toBe(false);
    expect(bulur(dava(), '')).toBe(true);
    expect(bulur(dava(), '   ')).toBe(true);
  });

  it('müvekkili ya da alanları boş dava çökmez', () => {
    expect(bulur({ title: 'Tespit', client: null }, 'tespit')).toBe(true);
  });
});

describe('dosya dizini araması — icra dosyası', () => {
  const icra = {
    debtor_name: 'Yıldız Gıda Ltd. Şti.',
    file_number: '2024/9981',
    office_name: 'İstanbul 12. İcra Dairesi',
    client: { full_name: 'Can Öztürk', company: 'Öztürk Yapı' },
  };
  const bul = (sorgu: string) => aramaKarsilar(icraAramaMetni(icra), sorgu);

  it('borçlu, dosya no, daire ve müvekkille bulunur', () => {
    expect(bul('yildiz gida')).toBe(true);
    expect(bul('2024/9981')).toBe(true);
    expect(bul('12. icra')).toBe(true);
    expect(bul('ozturk')).toBe(true);
  });
});

describe('dosya dizini sıralaması', () => {
  const satir = (id: string, date: string, created_at: string): DizinSirasi => ({ date, item: { id, created_at } });

  it('aynı gün açılan dosyalarda son eklenen üstte kalır (sunucu sırası ters dönmez)', () => {
    const satirlar = [
      satir('yeni', '2026-10-08', '2026-10-08T15:00:00+00:00'),
      satir('orta', '2026-10-08', '2026-10-08T12:00:00+00:00'),
      satir('eski', '2026-10-08', '2026-10-08T09:00:00+00:00'),
      satir('gecen-hafta', '2026-10-01', '2026-10-01T09:00:00+00:00'),
    ];
    expect([...satirlar].sort(dizinKarsilastir).map((s) => s.item.id)).toEqual(['yeni', 'orta', 'eski', 'gecen-hafta']);
    expect([...satirlar].reverse().sort(dizinKarsilastir).map((s) => s.item.id)).toEqual(['yeni', 'orta', 'eski', 'gecen-hafta']);
  });

  it('karşılaştırıcı tutarlıdır: eşitte 0, ters çağrıda ters işaret', () => {
    const a = satir('a', '2026-10-08', '2026-10-08T09:00:00+00:00');
    const b = satir('b', '2026-10-08', '2026-10-08T09:00:00+00:00');
    expect(dizinKarsilastir(a, a)).toBe(0);
    expect(Math.sign(dizinKarsilastir(a, b))).toBe(-Math.sign(dizinKarsilastir(b, a)));
  });

  it('tarihi yalnız gün olan ile zaman damgalı olan aynı günde gün olarak kıyaslanır', () => {
    const gunluk = satir('dava', '2026-10-08', '2026-10-08T08:00:00+00:00');
    const damgali = satir('icra', '2026-10-08T05:00:00+00:00', '2026-10-08T05:00:00+00:00');
    // Aynı gün → son eklenen (dava, 08:00) önce.
    expect([damgali, gunluk].sort(dizinKarsilastir).map((s) => s.item.id)).toEqual(['dava', 'icra']);
  });
});

describe('dosya dizini boş durumu', () => {
  const durum = (p: Partial<Parameters<typeof dizinBosDurumu>[0]>) =>
    dizinBosDurumu({ yukleniyor: false, hata: false, aramaVar: false, suzgecVar: false, ...p });

  it('sorgu hatası "Henüz dava yok" diye gösterilmez', () => {
    expect(durum({ hata: true })).toBe('hata');
  });

  it('arama ya da süzgeç sonucu boşsa "eşleşen yok" denir, "henüz dava yok" değil', () => {
    expect(durum({ aramaVar: true })).toBe('eslesmeYok');
    expect(durum({ suzgecVar: true })).toBe('eslesmeYok');
  });

  it('ilk yüklemede boş durum gösterilmez; gerçekten boşsa "henüz dava yok"', () => {
    expect(durum({ yukleniyor: true })).toBe('yukleniyor');
    expect(durum({})).toBe('bos');
  });
});

describe('dosya dizini — her tuşta sunucu sorgusu yok (bekçi)', () => {
  const KOK = join(__dirname, '..');
  it('ekran arama metnini sorgu kancalarına geçirmez, kanca başlıkta ilike yapmaz', () => {
    const ekran = readFileSync(join(KOK, 'app/(app)/cases/index.tsx'), 'utf8');
    const kanca = readFileSync(join(KOK, 'src/hooks/useCases.ts'), 'utf8');
    expect(ekran).not.toMatch(/useCases\(\{[^}]*search/);
    expect(ekran).not.toMatch(/useEnforcements\(\s*search/);
    expect(kanca).not.toMatch(/\.ilike\('title'/);
  });
});
