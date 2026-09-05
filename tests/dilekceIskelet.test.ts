import { describe, expect, it } from 'vitest';
import {
  bloklariAyristir,
  dilekceyiDiz,
  hesaplananTarihler,
  iskeletSec,
  uydurmaTarihleriAyikla,
} from '../supabase/functions/_shared/dilekce';

/**
 * BU KOD DİLEKÇENİN YAPISINI GARANTİ EDİYOR ve bugüne kadar hiç sınanmamıştı.
 * Sınanmayan yer sessizce bozulan yerdir: on dilekçe türünün beşi (replik,
 * düplik, temyiz, bilirkişiye itiraz, ıslah) iskeletsiz olduğu için DAVA
 * iskeletiyle diziliyordu — temyiz dilekçesinin başında "HARCA ESAS DAVA
 * DEĞERİ" satırı çıkıyordu ve bunu ancak çıktıyı elle okuyunca fark ettik.
 */
const TAM_BLOK = [
  '###MAHKEME###',
  'ANKARA 5. SULH HUKUK MAHKEMESİ',
  '###TARAF###',
  'DAVACI: Ali Vural',
  'DAVALI: Berk Yıldız',
  '###KONU###',
  'Tahliye ve kira alacağı',
  '###DEGER###',
  '24.000 TL',
  '###ACIKLAMALAR###',
  'Kiracı iki aydır ödeme yapmamıştır.',
  '###SEBEPLER###',
  'TBK m.315',
  '###DELILLER###',
  'Kira sözleşmesi, ihtarname',
  '###TALEP###',
  'Tahliye ve alacağın tahsili',
  '###KONTROL###',
  'Tebligat adresini teyit edin.',
].join('\n');

describe('iskeletSec', () => {
  it('on türün her biri kendi iskeletini alır', () => {
    for (const tip of ['dava', 'cevap', 'replik', 'duplik', 'istinaf', 'temyiz', 'itiraz', 'ihtarname', 'bilirkisi', 'islah']) {
      expect(iskeletSec(tip), tip).toBeDefined();
    }
  });

  it('temyizde "harca esas dava değeri" bölümü YOKTUR', () => {
    // Dava dilekçesine özgü zorunlu unsur (HMK m.119/1-d); temyiz dilekçesine
    // konması, iskeletsiz türlerin dava iskeletine düşmesinin belirtisiydi.
    const anahtarlar = iskeletSec('temyiz').bolumler.map((b) => b.anahtar);
    expect(anahtarlar).not.toContain('DEGER');
  });

  it('temyizde "DELİLLER" bölümü yoktur (hukukilik denetimidir)', () => {
    expect(iskeletSec('temyiz').bolumler.map((b) => b.anahtar)).not.toContain('DELILLER');
  });

  it('ara dilekçelerde ESAS NO künyede vardır', () => {
    for (const tip of ['cevap', 'replik', 'duplik', 'bilirkisi', 'islah']) {
      const etiketler = iskeletSec(tip).taraflar.map(([e]) => e);
      expect(etiketler, tip).toContain('ESAS NO');
    }
  });

  it('tanınmayan tür dava iskeletine düşer', () => {
    expect(iskeletSec('bilinmeyen')).toBe(iskeletSec('dava'));
  });
});

describe('bloklariAyristir + dilekceyiDiz', () => {
  it('zorunlu bölümlerin hepsi dizilir', () => {
    const { metin, eksik } = dilekceyiDiz('dava', bloklariAyristir(TAM_BLOK));
    expect(eksik).toEqual([]);
    expect(metin).toContain('HARCA ESAS DAVA DEĞERİ');
    expect(metin).toContain('NETİCE-İ TALEP');
    expect(metin.startsWith('ANKARA 5. SULH HUKUK MAHKEMESİ')).toBe(true);
  });

  it('düşen zorunlu bölüm sessizce kaybolmaz, boşlukla işaretlenir', () => {
    const eksikBlok = TAM_BLOK.replace('###TALEP###\nTahliye ve alacağın tahsili\n', '');
    const { metin, eksik } = dilekceyiDiz('dava', bloklariAyristir(eksikBlok));
    expect(eksik).toContain('NETİCE-İ TALEP');
    expect(metin).toContain('[Netice-i talep — doldurun]');
  });

  it('dosya bilgisi modelin yazdığından ÖNCE gelir', () => {
    // Müvekkilin adını en iyi model değil, avukatın kendi kaydı bilir.
    const { metin } = dilekceyiDiz('dava', bloklariAyristir(TAM_BLOK), {
      DAVACI: 'Ali Vural — Çankaya/Ankara',
      VEKILI: 'Av. Zeynep Aksoy — Ankara Barosu',
      IMZASIFAT: 'Davacı',
    });
    expect(metin).toContain('Ali Vural — Çankaya/Ankara');
    expect(metin).toContain('Av. Zeynep Aksoy');
    expect(metin).toContain('Davacı Vekili');
    expect(metin).not.toContain('[Vekil ad-soyad]');
  });

  it('istinaf ve temyizde dosyadaki mahkeme MERCİ olarak yazılmaz', () => {
    // Orada merci BAM ya da Yargıtay'dır; kayıttaki mahkeme kararı VEREN ilk
    // derece mahkemesidir. Doğrudan yazmak dilekçeyi yanlış yere gönderirdi.
    const bloklar = bloklariAyristir(
      '###MAHKEME###\nANKARA BÖLGE ADLİYE MAHKEMESİ İLGİLİ HUKUK DAİRESİNE\n###ACIKLAMALAR###\nSebepler\n###TALEP###\nKaldırılması'
    );
    const { metin } = dilekceyiDiz('istinaf', bloklar, { MAHKEME: 'ANKARA 5. SULH HUKUK MAHKEMESİ' });
    expect(metin.split('\n')[0]).toContain('BÖLGE ADLİYE');
  });

  it('mercinin iki satırlı hâli korunur', () => {
    const bloklar = bloklariAyristir(
      '###MAHKEME###\nANKARA BÖLGE ADLİYE MAHKEMESİNE\nSunulmak üzere ANKARA 5. ASLİYE HUKUK MAHKEMESİNE\n###ACIKLAMALAR###\nx\n###TALEP###\ny'
    );
    const { metin } = dilekceyiDiz('istinaf', bloklar);
    expect(metin.split('\n')[1]).toContain('Sunulmak üzere');
  });

  it('modelin "bilinmiyor" demesi künyeye yazılmaz', () => {
    const bloklar = bloklariAyristir('###TARAF###\nDAVACI: bilinmiyor\n###ACIKLAMALAR###\nx\n###TALEP###\ny');
    const { metin } = dilekceyiDiz('dava', bloklar);
    expect(metin).toContain('[Davacı ad-soyad]');
    expect(metin).not.toContain('DAVACI    : bilinmiyor');
  });
});

describe('uydurmaTarihleriAyikla', () => {
  it('olayda geçmeyen tarihi boşlukla değiştirir', () => {
    const { metin, ayiklanan } = uydurmaTarihleriAyikla(
      'Sözleşme 01.02.2026 tarihlidir; ihtar 30.09.2026 tarihinde çekilmiştir.',
      'Sözleşme 01.02.2026 tarihinde imzalandı.'
    );
    expect(ayiklanan).toBe(1);
    expect(metin).toContain('01.02.2026');
    expect(metin).toContain('[tarih — doldurun]');
  });

  it('olayda geçen tarihe dokunmaz', () => {
    expect(uydurmaTarihleriAyikla('03.03.2026 tebliğ', '03.03.2026 tarihinde tebliğ edildi').ayiklanan).toBe(0);
  });
});

describe('hesaplananTarihler', () => {
  it('mütalaada tarihler silinmez, listelenir', () => {
    // "bir aylık süre 14.05.2026'da doluyor" cümlesi mütalaanın ta kendisidir;
    // silmek özelliğin değerini silmek olurdu.
    expect(hesaplananTarihler('Fesih 14.04.2026, süre 14.05.2026 dolar.', 'Fesih 14.04.2026 tarihinde yapıldı.'))
      .toEqual(['14.05.2026']);
  });

  it('olaydaki tarihi hesaplanmış saymaz', () => {
    expect(hesaplananTarihler('14.04.2026', '14.04.2026 tarihinde')).toEqual([]);
  });
});
