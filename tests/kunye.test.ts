import { describe, expect, it } from 'vitest';
import { esasCekirdegi, kunyeDogrula, sadelestir, tarihBicimleri } from '../supabase/functions/_shared/kunye';

/**
 * Dosya aktarma, UYAP belgesinden okunan künyeyi DOĞRUDAN dosya kaydına
 * yazıyordu ve hiçbir denetim yoktu. Uydurulmuş bir esas numarası, boş
 * bırakılmış bir alandan çok daha tehlikelidir: dolu görünür, kimse bir daha
 * bakmaz.
 */
const BELGE = `
T.C.
ANKARA 5. ASLİYE HUKUK MAHKEMESİ
ESAS NO : 2026/1487
DAVACI  : Ayşe Yıldırım
DAVALI  : Mehmet Kaya
KONU    : Kira alacağı ve tahliye istemi
Duruşma 15/09/2026 günü saat 09:30'a bırakılmıştır.
`;

describe('kunyeDogrula', () => {
  it('belgede geçen alanları korur', () => {
    const { kunye, atilan } = kunyeDogrula(
      {
        title: 'Ayşe Yıldırım — kira alacağı',
        court_name: 'Ankara 5. Asliye Hukuk Mahkemesi',
        case_number: '2026/1487',
        opposing_party: 'Mehmet Kaya',
        hearing_date: '2026-09-15',
      },
      BELGE
    );
    expect(atilan).toEqual([]);
    expect(kunye.court_name).toBe('Ankara 5. Asliye Hukuk Mahkemesi');
    expect(kunye.case_number).toBe('2026/1487');
    expect(kunye.hearing_date).toBe('2026-09-15');
  });

  it('belgede geçmeyen mahkemeyi atar', () => {
    // Uydurma mahkeme adı, dosyanın yanlış mahkemeye kaydedilmesi demektir.
    const { kunye, atilan } = kunyeDogrula({ court_name: 'İstanbul 3. Aile Mahkemesi' }, BELGE);
    expect(kunye.court_name).toBeUndefined();
    expect(atilan).toContain('mahkeme');
  });

  it('belgede geçmeyen esas numarasını atar', () => {
    const { kunye, atilan } = kunyeDogrula({ case_number: '2025/9999' }, BELGE);
    expect(kunye.case_number).toBeUndefined();
    expect(atilan).toContain('esas no');
  });

  it('esas numarasındaki biçim farkını tolere eder', () => {
    // Model "E. 2026/1487" ya da "2026/1487 Esas" döndürebiliyor; belgede
    // "2026/1487" yazıyor. Aranan şey sayı çiftidir.
    expect(kunyeDogrula({ case_number: 'E. 2026/1487' }, BELGE).kunye.case_number).toBe('E. 2026/1487');
    expect(kunyeDogrula({ case_number: '2026/1487 Esas' }, BELGE).atilan).toEqual([]);
  });

  it('büyük harf ve noktalama farkı eşleşmeyi bozmaz', () => {
    // Belge "ANKARA 5. ASLİYE HUKUK MAHKEMESİ" yazıyor; JS'in /i bayrağı
    // 'İ' harfini 'i'ye katlamadığı için Türkçe küçültme şart.
    expect(kunyeDogrula({ court_name: 'ankara 5.asliye hukuk mahkemesi' }, BELGE).atilan).toEqual([]);
  });

  it('belgede geçmeyen duruşma tarihini atar', () => {
    const { kunye, atilan } = kunyeDogrula({ hearing_date: '2026-10-01' }, BELGE);
    expect(kunye.hearing_date).toBeUndefined();
    expect(atilan).toContain('duruşma tarihi');
  });

  it('tarihin belgedeki yazılışını bulur', () => {
    // Model YYYY-AA-GG döndürür, UYAP GG/AA/YYYY yazar. Tek biçim aramak
    // doğru tarihi "yok" saymak olurdu.
    expect(kunyeDogrula({ hearing_date: '2026-09-15' }, 'Duruşma 15.09.2026').kunye.hearing_date).toBe('2026-09-15');
    expect(kunyeDogrula({ hearing_date: '2026-09-15' }, 'Duruşma 15/9/2026').kunye.hearing_date).toBe('2026-09-15');
  });

  it('dava türü atılmaz — alıntı değil, çıkarımdır', () => {
    // "Kira alacağı ve tahliye" belgede bu sözcüklerle geçmeyebilir ama
    // belgeden anlaşılır. Uydurma riski düşük, avukat listede görüyor.
    const { kunye, atilan } = kunyeDogrula({ case_type: 'Alacak ve tahliye davası' }, BELGE);
    expect(kunye.case_type).toBe('Alacak ve tahliye davası');
    expect(atilan).toEqual([]);
  });

  it('boş künye uyarı üretmez', () => {
    expect(kunyeDogrula({}, BELGE)).toEqual({ kunye: { title: undefined }, atilan: [] });
  });
});

describe('yardımcılar', () => {
  it('sadelestir Türkçe küçültür ve noktalamayı atar', () => {
    expect(sadelestir('ANKARA 5. ASLİYE  HUKUK')).toBe('ankara 5 asliye hukuk');
  });

  it('esasCekirdegi sayı çiftini çıkarır', () => {
    expect(esasCekirdegi('E. 2026 / 1487')).toBe('2026/1487');
    expect(esasCekirdegi('esas yok')).toBeNull();
  });

  it('tarihBicimleri Türkçe yazılışları üretir', () => {
    const b = tarihBicimleri('2026-09-05');
    expect(b).toContain('05.09.2026');
    expect(b).toContain('5/9/2026');
    expect(tarihBicimleri('bozuk')).toEqual([]);
  });
});
