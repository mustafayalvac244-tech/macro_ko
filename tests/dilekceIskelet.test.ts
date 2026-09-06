import { describe, expect, it } from 'vitest';
import {
  bloklariAyristir,
  dilekceyiDiz,
  hesaplananTarihler,
  iskeletSec,
  talepUyarilari,
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

  it('dava dilekçesinde davalıya TCKN boşluğu konmaz, cevapta konur', () => {
    // HMK m.119/1-b taraflar için yalnız ad-soyad ve adres arar; kimlik
    // numarasını (c bendi) SADECE DAVACI için ister. Cevap dilekçesinde ise
    // m.129/1-c DAVALININ kimlik numarasını ister — orada yerinde.
    const davaDavali = iskeletSec('dava').taraflar.find(([e]) => e === 'DAVALI')?.[1] ?? '';
    expect(davaDavali).not.toContain('TCKN');
    const cevapDavali = iskeletSec('cevap').taraflar.find(([e]) => e === 'DAVALI')?.[1] ?? '';
    expect(cevapDavali).toContain('TCKN');
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

describe('talepUyarilari', () => {
  it('istinafta "kaldırılması" yoksa uyarır', () => {
    // Ölçümde üç koşunun birinde istinaf talebi düştü. Hâkim taleple bağlıdır
    // (HMK m.26): netice-i talepte olmayan şeye hükmedilmez.
    expect(talepUyarilari('istinaf', 'Davanın kabulüne karar verilmesini talep ederiz.')).toHaveLength(1);
    expect(talepUyarilari('istinaf', 'Kararın KALDIRILMASINA karar verilmesini talep ederiz.')).toEqual([]);
  });

  it('temyizde "bozulması" yoksa uyarır; kaldırılma temyize ait değildir', () => {
    // "Kaldırılmasını talep ederiz" hem doğru terimi EKSİK bırakıyor hem
    // YANLIŞ terimi kullanıyor: iki ayrı uyarı, iki ayrı hata.
    expect(talepUyarilari('temyiz', 'Kararın kaldırılmasını talep ederiz.')).toHaveLength(2);
    expect(talepUyarilari('temyiz', 'Kararın BOZULMASINA karar verilmesini talep ederiz.')).toEqual([]);
  });

  it('temyizde YANLIŞ terimin varlığı da uyarı üretir', () => {
    // Ölçümde görüldü: temyiz dilekçesi "kararın kaldırılması" istedi.
    // Eksikliği aramak yetmiyor — model iki terimi birlikte de yazabiliyor ve
    // yanlış olanı bırakmak, hangi kanun yolunda olduğumuzu bilmediğimizi
    // gösterir. Yargıtay BOZAR, BAM KALDIRIR.
    const u = talepUyarilari('temyiz', 'Kararın bozulmasını ve kaldırılmasını talep ederiz.');
    expect(u).toHaveLength(1);
    expect(u[0]).toContain('İSTİNAFA aittir');
  });

  it('istinafta "bozulması" istenmesi uyarı üretir', () => {
    const u = talepUyarilari('istinaf', 'Kararın kaldırılmasına ve bozulmasına karar verilmesini talep ederiz.');
    expect(u).toHaveLength(1);
    expect(u[0]).toContain('TEMYİZE aittir');
  });

  it('itirazda açık itiraz beyanı aranır', () => {
    // İcra dairesi itirazı SEBEBİNE göre kaydeder; "borcum yoktur" demek
    // itirazın kendisi değildir.
    expect(talepUyarilari('itiraz', 'Müvekkilin borcu bulunmamaktadır.')).toHaveLength(1);
    expect(talepUyarilari('itiraz', 'Borca ve imzaya İTİRAZ EDİYORUZ.')).toEqual([]);
  });

  it('ilgisiz türde uyarı üretmez', () => {
    expect(talepUyarilari('dava', 'Davanın kabulünü talep ederiz.')).toEqual([]);
  });
});
