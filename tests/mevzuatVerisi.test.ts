import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * MEVZUAT VERİSİ BEKÇİSİ (23. denetim ajanı, 10.10.2026).
 *
 * 50 denetçinin bulgularından ikisi doğrulandı ve kanun JSON'larında düzeltildi:
 *  1. Maddeler kayıptı ya da bir öncekine yapışıktı: HMK m.102 (adli tatil) m.101'in
 *     gövdesindeydi; TCK m.217/A (dezenformasyon), 123/A (ısrarlı takip) yoktu;
 *     TMK 8, TTK 13, TBK 1, İşK 13 madde eksikti (çoğu mülga ya da Geçici madde).
 *  2. Anayasa'da dipnot numaraları 22 başlığa yapışmış, dipnot METİNLERİ gövdelere
 *     karışmıştı; m.136 ve m.137'nin başlığı gövde parçasıydı.
 *
 * Düzeltilen metinler elle yazılmadı: resmî kaynaktan (mevzuat.gov.tr PDF) scripts/
 * parse-law-pdf.py ile üretildi. Bu testler veri yeniden üretilirken aynı kusurun
 * geri gelmesini önler.
 */
interface Madde {
  no: string;
  text: string;
  title?: string;
  section?: string;
}
interface Kanun {
  short: string;
  articles: Madde[];
}

const VERI = fileURLToPath(new URL('../src/data/', import.meta.url));
function oku<T>(yol: string): T {
  return JSON.parse(readFileSync(VERI + yol, 'utf-8')) as T;
}
const kanun = (slug: string) => oku<Kanun>(`laws/${slug}.json`);
const bul = (k: Kanun, no: string) => k.articles.find((a) => a.no === no);

describe('HMK m.101 / m.102 — adli tatil ayrı maddedir', () => {
  const hmk = kanun('hmk');

  it('m.102 vardır, kendi başlığı ve metni ile', () => {
    const m = bul(hmk, '102');
    expect(m).toBeDefined();
    expect(m?.title).toBe('Adli tatil süresi');
    expect(m?.text).toContain('Adli tatil, her yıl yirmi temmuzda başlar');
  });

  it('m.101 yalnız giderleri düzenler; m.102 ve dipnot artığı yapışık değil', () => {
    const m = bul(hmk, '101');
    expect(m?.text).toContain('giderler');
    expect(m?.text).not.toContain('Adli tatil');
    expect(m?.text).not.toMatch(/md\.;|Kararı ile\.;|Yeniden düzenleme/);
  });

  it('m.101 → m.102 → m.103 sırası bozulmamıştır', () => {
    const nolar = hmk.articles.map((a) => a.no);
    const i = nolar.indexOf('101');
    expect(nolar.slice(i, i + 3)).toEqual(['101', '102', '103']);
  });
});

describe('kaynakta olup havuzda eksik kalan maddeler eklendi', () => {
  const BEKLENEN: Array<[string, string[]]> = [
    ['turk-ceza', ['123/A', '217/A', '245/A']],
    ['hmk', ['183/A', '305/A']],
    ['ttk', ['5/A', '771', 'Geçici 2']],
    ['turk-borclar', ['451']],
    ['turk-medeni', ['61', '659', '663', '668', 'Geçici 1']],
    ['is-kanunu', ['82', '88', 'Geçici 1', 'Geçici 6', 'Geçici 11']],
  ];
  for (const [slug, nolar] of BEKLENEN) {
    it(`${slug}: ${nolar.join(', ')}`, () => {
      const k = kanun(slug);
      for (const no of nolar) {
        const m = bul(k, no);
        expect(m, `${slug} m.${no} yok`).toBeDefined();
        expect((m?.text ?? '').length, `${slug} m.${no} metni boş`).toBeGreaterThan(10);
      }
    });
  }

  it('TCK m.217/A dezenformasyon suçudur', () => {
    const m = bul(kanun('turk-ceza'), '217/A');
    expect(m?.title).toBe('Halkı yanıltıcı bilgiyi alenen yayma');
    expect(m?.text).toContain('gerçeğe aykırı bir bilgiyi');
  });

  it('TTK m.5/A (dava şartı arabuluculuk) sonraki maddenin başlığını gövdede taşımaz', () => {
    const m = bul(kanun('ttk'), '5/A');
    expect(m?.title).toBe('Dava şartı olarak arabuluculuk');
    expect(m?.text).not.toContain('Çeşitli hükümler');
    expect(m?.text).not.toContain('Zamanaşımı');
  });
});

describe('madde numaralarında BOŞLUK yok', () => {
  // Resmî kaynakta da olmayan numaralar; yeni bir boşluk bu listeye eklenmeden geçmez.
  const BILINEN: Record<string, number[]> = {
    avukatlik: [33],
    'is-mahkemeleri': Array.from({ length: 26 }, (_, i) => i + 11),
  };
  const SLUGS = [
    'turk-ceza', 'turk-medeni', 'turk-borclar', 'hmk', 'cmk', 'ttk', 'is-kanunu', 'iik',
    'iyuk', 'tuketici', 'is-mahkemeleri', 'avukatlik', 'sgk', 'kamulastirma', 'amme', 'aym',
  ];
  for (const slug of SLUGS) {
    it(slug, () => {
      const sayilar = new Set<number>();
      for (const a of kanun(slug).articles) {
        const m = /^(\d+)/.exec(a.no);
        if (m) sayilar.add(Number(m[1]));
      }
      const enBuyuk = Math.max(...sayilar);
      const eksik: number[] = [];
      for (let n = 1; n <= enBuyuk; n++) if (!sayilar.has(n)) eksik.push(n);
      expect(eksik).toEqual(BILINEN[slug] ?? []);
    });
  }
});

describe('havuz tutarlılığı', () => {
  const dizin = oku<Array<{ slug: string; count: number }>>('laws/index.json');
  for (const e of dizin) {
    it(`${e.slug}: index.json sayısı dosyayla aynı, madde numaraları tekil`, () => {
      const k = kanun(e.slug);
      expect(k.articles.length).toBe(e.count);
      const nolar = k.articles.map((a) => a.no);
      expect(new Set(nolar).size).toBe(nolar.length);
    });
  }
});

describe('Anayasa — dipnot artığı yok', () => {
  const anayasa = oku<{ articles: Madde[] }>('anayasa.json').articles;

  it('199 madde (Başlangıç + 177 + 21 geçici) korunmuştur', () => {
    expect(anayasa.length).toBe(199);
  });

  it('hiçbir başlığın sonunda dipnot numarası yok', () => {
    const kotu = anayasa.filter((a) => /[^\d\s]\d{1,2}$/.test(a.title ?? '')).map((a) => a.no);
    expect(kotu).toEqual([]);
  });

  it('gövdelerde dipnot metni yok', () => {
    const kalip =
      /\d{1,2}\s+Bu (?:maddenin|fıkranın|bendin|bentte)\b|metne işlenmiştir\.|metinden çıkarılmıştır\.|\(R\.G\.: 1\/8\/2010|\(R\.G\.: 22\/10\/2008/;
    const kotu = anayasa.filter((a) => kalip.test(a.text)).map((a) => a.no);
    expect(kotu).toEqual([]);
  });

  it('gövdelerin sonuna sonraki bölümün başlığı yapışmamıştır', () => {
    const kuyruk = /[.;:)]\s+(?:[IVXLC]+|[A-ZÇĞİÖŞÜ]|\d{1,2})\.\s+[A-ZÇĞİÖŞÜ][^.;:()]{2,110}$/;
    const kotu = anayasa.filter((a) => kuyruk.test(a.text)).map((a) => a.no);
    expect(kotu).toEqual([]);
  });

  it('m.135 / m.136 / m.137: başlıklar kendi maddelerinindir', () => {
    const m = (no: string) => anayasa.find((a) => a.no === no);
    expect(m('135')?.text.endsWith('yürürlükten kalkar.')).toBe(true);
    expect(m('136')?.title).toBe('Diyanet İşleri Başkanlığı');
    expect(m('136')?.text.startsWith('Genel idare içinde yer alan Diyanet İşleri Başkanlığı')).toBe(true);
    expect(m('137')?.title).toBe('Kanunsuz emir');
  });

  it('hiçbir başlık küçük harfle başlamaz ya da cümle gibi uzun değildir', () => {
    // 136/137 başlıkları gövde parçasıydı ("kararı, yirmidört saat …").
    const kotu = anayasa
      .filter((a) => /^[a-zçğıöşü]/.test(a.title ?? '') || (a.title ?? '').length > 130)
      .map((a) => a.no);
    expect(kotu).toEqual([]);
  });
});
