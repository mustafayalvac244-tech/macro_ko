import { describe, expect, it } from 'vitest';
// @ts-expect-error — eklenti saf JS, tip tanımı yok
import { doluSayisi, kucult, kunyeCikarYerel, mahkeme } from '../extension/lib/cikar.js';

/**
 * EKLENTİNİN YEREL ÇIKARICISI.
 *
 * Kullanıcı haklı olarak sordu: "AI ile ne alaka, web sayfası uygulaması
 * yapıyoruz." İlk sürüm her sayfayı sunucudaki AI ucuna yolluyordu; oysa
 * "Esas No: 2023/145" ve "ANKARA 3. ASLİYE HUKUK MAHKEMESİ" sayfada düz yazıyla
 * duruyor. Yerel çıkarma anında, bedava, kotasız ve DETERMİNİSTİK — yani
 * testlenebilir. AI artık yalnız hiçbir kalıp tutmazsa deneniyor.
 */

const UYAP = `T.C.
ANKARA 3. ASLİYE HUKUK MAHKEMESİ
Esas No : 2023/145
Karar No: 2024/88
Dava Türü : Alacak
DAVACI : Ahmet Yılmaz  T.C. 12345678901
DAVALI : Yılmaz İnşaat Ltd. Şti.
Duruşma Tarihi: 14.03.2026`;

describe('kucult — Türkçe İ tuzağı', () => {
  it("JavaScript'in /i/i deseninin kaçırdığı İ harfini indirger", () => {
    // Bu olmadan /mahkemesi/i deseni "MAHKEMESİ" ile eşleşmiyordu.
    expect(kucult('MAHKEMESİ')).toBe('mahkemesi');
    expect(kucult('IŞIK')).toBe('ışık');
  });

  it('UZUNLUĞU KORUR — dizinler orijinal metinde geçerli kalmalı', () => {
    // toLocaleLowerCase('tr-TR') İ'yi iki karaktere çevirip dizin kaydırırdı.
    for (const s of ['MAHKEMESİ', 'İZMİR 5. İCRA MÜDÜRLÜĞÜ', 'ŞÜKRÜ GÜNEŞ']) {
      expect(kucult(s).length).toBe(s.length);
    }
  });
});

describe('mahkeme', () => {
  it('BÜYÜK HARFLE yazılmış mahkeme adını bulur (UYAP biçimi)', () => {
    expect(mahkeme(UYAP)).toBe('ANKARA 3. ASLİYE HUKUK MAHKEMESİ');
  });

  it('daire ve müdürlük biçimlerini de bulur', () => {
    expect(mahkeme('İstanbul Bölge Adliye Mahkemesi 12. Hukuk Dairesi')).toContain('Mahkemesi');
    expect(mahkeme('İZMİR 5. İCRA MÜDÜRLÜĞÜ')).toBe('İZMİR 5. İCRA MÜDÜRLÜĞÜ');
  });

  it('"T.C." başlığını ada karıştırmaz', () => {
    expect(mahkeme(UYAP)).not.toContain('T.C.');
  });

  it('mahkeme geçmeyen metinde null döner', () => {
    expect(mahkeme('Bugün hava çok güzel.')).toBeNull();
  });
});

describe('kunyeCikarYerel', () => {
  it('UYAP dosya detayından sekiz alanı çıkarır', () => {
    const k = kunyeCikarYerel(UYAP);
    expect(k.case_number).toBe('2023/145');
    expect(k.decision_number).toBe('2024/88');
    expect(k.court_name).toBe('ANKARA 3. ASLİYE HUKUK MAHKEMESİ');
    expect(k.case_type).toBe('Alacak');
    expect(k.davaci).toBe('Ahmet Yılmaz');
    expect(k.davali).toBe('Yılmaz İnşaat Ltd. Şti.');
    expect(k.hearing_date).toBe('2026-03-14');
  });

  it('taraf adından T.C. numarasını ve ikinci sütunu ayıklar', () => {
    expect(kunyeCikarYerel(UYAP).davaci).not.toMatch(/\d{11}/);
  });

  it('"2024/512 E." biçimini (numara önce) de okur', () => {
    const k = kunyeCikarYerel('İstanbul 2. Asliye Hukuk Mahkemesi\n2024/512 E. , 2025/77 K.');
    expect(k.case_number).toBe('2024/512');
    expect(k.decision_number).toBe('2025/77');
  });

  it('icra dosyasında "Dosya No" ve alacaklı/borçlu etiketlerini tanır', () => {
    const k = kunyeCikarYerel('İZMİR 5. İCRA MÜDÜRLÜĞÜ\nDosya No: 2025/9012\nALACAKLI : Kaya Tekstil A.Ş.\nBORÇLU : Ali Veli');
    expect(k.case_number).toBe('2025/9012');
    expect(k.davaci).toBe('Kaya Tekstil A.Ş.');
    expect(k.davali).toBe('Ali Veli');
  });

  it('ilgisiz sayfada HİÇBİR alan uydurmaz', () => {
    const k = kunyeCikarYerel('Bugün hava çok güzel. Bir haber sitesindesiniz.');
    expect(doluSayisi(k)).toBe(0);
    expect(k.title).toBeNull();
  });

  it('boş/bozuk girdide çökmez', () => {
    expect(doluSayisi(kunyeCikarYerel(''))).toBe(0);
    expect(doluSayisi(kunyeCikarYerel(null))).toBe(0);
  });

  it('tarihi YYYY-AA-GG biçimine çevirir ve tek haneyi doldurur', () => {
    expect(kunyeCikarYerel('Duruşma Tarihi: 5.3.2026').hearing_date).toBe('2026-03-05');
  });

  it('başlığı mahkeme+esastan kurar, ikisi de yoksa taraflardan', () => {
    expect(kunyeCikarYerel(UYAP).title).toContain('2023/145');
    expect(kunyeCikarYerel('DAVACI: Ahmet Yılmaz\nDAVALI: Ali Veli').title).toBe('Ahmet Yılmaz - Ali Veli');
  });
});
