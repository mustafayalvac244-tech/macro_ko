// SERBEST MESLEK MAKBUZU DÖKÜMÜ.
// ---------------------------------------------------------------------------
// NEDEN VAR. `serbestMeslekMakbuzu.ts` KDV/stopaj/net hesabını zaten yapıyordu
// ama sonucu yalnız finans formunun içinde, ekranda gösteriyordu. Avukat o
// rakamları müvekkile verecek belgeye ELLE geçiriyordu — ve elle geçirilen
// her rakam, geçirilmeyen bir rakam kadar risklidir.
//
// ⚠️ BU BELGE RESMÎ MAKBUZ DEĞİLDİR — VE BUNU BELGENİN ÜSTÜNE DE YAZIYORUZ.
// Türkiye'de serbest meslek makbuzu, Gelir İdaresi Başkanlığı'nın e-Serbest
// Meslek Makbuzu (e-SMM) düzeni üzerinden ya da notere tasdikli basılı
// koçandan kesilir. Ürettiğimiz şey bir DÖKÜMDÜR: rakamları doğru ve tek
// yerden gelen, müvekkile/muhasebeciye verilebilecek bir özet.
//
// Bunu belgenin içine basmak keyfî bir ihtiyat değil: avukat bu çıktıyı resmî
// makbuz sanıp koçandan kesmezse vergisel bir eksiklik doğar ve bunu FARK
// ETMESİ aylar sürer. Sessiz yanlışın en pahalı türü budur.
//
// ⚠️ ÖLÇÜLMEDİ: e-SMM zorunluluğunun bugünkü kapsamını (hangi mükellef,
// hangi ciro eşiği) doğrulamadım. Bu yüzden metin "zorunluluk şu" demiyor,
// "bu belge onun yerine geçmez" diyor — bilmediğimi iddiaya çevirmiyorum.

import { hesaplaSmm, type SmmHesap } from '@/utils/serbestMeslekMakbuzu';

export interface MakbuzGirdi {
  /** Makbuz seri/sıra no — finance_entries.receipt_no. */
  makbuzNo: string | null;
  /** Düzenleme tarihi (ISO). */
  tarih: string;
  /** Hizmet açıklaması — finans kaydının başlığı. */
  aciklama: string;
  /** KDV hariç hizmet bedeli. */
  matrah: number;
  kdvOrani: number | null;
  stopajOrani: number | null;
  /** Düzenleyen avukat. */
  avukatAd: string;
  buro?: string | null;
  baroSicil?: string | null;
  /** Müvekkil — finans kaydında müvekkil bağı yoksa boş kalır. */
  muvekkilAd?: string | null;
}

/* ---------------- Tutarı yazıyla yazma ---------------- */
// Türkiye'de parasal belgelerde tutar rakamla VE yazıyla yazılır; sebebi
// rakamın sonradan değiştirilmesini zorlaştırmaktır. Elle yazılan "yazıyla"
// satırı en sık hata yapılan yerdir, o yüzden üretiliyor.

const BIRLER = ['', 'BİR', 'İKİ', 'ÜÇ', 'DÖRT', 'BEŞ', 'ALTI', 'YEDİ', 'SEKİZ', 'DOKUZ'];
const ONLAR = ['', 'ON', 'YİRMİ', 'OTUZ', 'KIRK', 'ELLİ', 'ALTMIŞ', 'YETMİŞ', 'SEKSEN', 'DOKSAN'];
const BASAMAK = ['', 'BİN', 'MİLYON', 'MİLYAR'];

/** 0-999 arasını yazıya çevirir. */
function ucBasamak(n: number): string {
  const yuz = Math.floor(n / 100);
  const on = Math.floor((n % 100) / 10);
  const bir = n % 10;
  const parca: string[] = [];
  // "BİRYÜZ" denmez, "YÜZ" denir.
  if (yuz > 0) parca.push(yuz === 1 ? 'YÜZ' : `${BIRLER[yuz]}YÜZ`);
  if (on > 0) parca.push(ONLAR[on]);
  if (bir > 0) parca.push(BIRLER[bir]);
  return parca.join('');
}

/**
 * Tam sayıyı Türkçe yazıya çevirir. 1000 → "BİN" (BİRBİN değil).
 *
 * Üst sınır milyar basamağıdır; daha büyüğü için boş döner ve çağıran
 * "yazıyla" satırını hiç basmaz — yanlış yazıyla tutar, hiç yazmamaktan
 * kötüdür.
 */
export function sayiyiYaziyaCevir(sayi: number): string {
  const n = Math.floor(Math.abs(sayi));
  if (n === 0) return 'SIFIR';
  if (n >= 1_000_000_000_000) return '';

  const gruplar: number[] = [];
  let kalan = n;
  while (kalan > 0) {
    gruplar.push(kalan % 1000);
    kalan = Math.floor(kalan / 1000);
  }

  let sonuc = '';
  for (let i = gruplar.length - 1; i >= 0; i -= 1) {
    const g = gruplar[i];
    if (g === 0) continue;
    // Tam olarak "BİN" — "BİRBİN" diye bir sayı okunuşu yok.
    sonuc += g === 1 && i === 1 ? 'BİN' : `${ucBasamak(g)}${BASAMAK[i]}`;
  }
  return sonuc;
}

/** "1.234,50" → "BİNİKİYÜZOTUZDÖRT TL ELLİ KR" */
export function tutariYaziyaCevir(tutar: number): string {
  const lira = Math.floor(Math.abs(tutar));
  const kurus = Math.round((Math.abs(tutar) - lira) * 100);
  const liraYazi = sayiyiYaziyaCevir(lira);
  if (!liraYazi) return '';
  const kurusYazi = kurus > 0 ? ` ${sayiyiYaziyaCevir(kurus)} KR` : '';
  return `${liraYazi} TL${kurusYazi}`;
}

/* ---------------- Belge ---------------- */

function para(n: number): string {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function tarihYaz(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Etiket/değer satırı — boş değerler hiç basılmaz, "—" de basılmaz. */
function satir(etiket: string, deger: string | null | undefined): string | null {
  const d = (deger ?? '').trim();
  return d ? `${etiket}: ${d}` : null;
}

export interface MakbuzCikti {
  metin: string;
  hesap: SmmHesap;
}

export function makbuzMetni(g: MakbuzGirdi): MakbuzCikti {
  const hesap = hesaplaSmm(g.matrah, g.kdvOrani, g.stopajOrani);
  const yaziyla = tutariYaziyaCevir(hesap.tahsilEdilecek);

  const bloklar: string[] = [];

  bloklar.push(
    [
      'SERBEST MESLEK MAKBUZU DÖKÜMÜ',
      '='.repeat(40),
      satir('Makbuz No', g.makbuzNo),
      satir('Düzenleme Tarihi', tarihYaz(g.tarih)),
    ]
      .filter(Boolean)
      .join('\n'),
  );

  bloklar.push(
    ['DÜZENLEYEN', '-'.repeat(40), satir('Avukat', g.avukatAd), satir('Büro', g.buro), satir('Baro Sicil No', g.baroSicil)]
      .filter(Boolean)
      .join('\n'),
  );

  if (g.muvekkilAd?.trim()) {
    bloklar.push(['MÜŞTERİ', '-'.repeat(40), satir('Ad / Unvan', g.muvekkilAd)].filter(Boolean).join('\n'));
  }

  // Kalemler önce (etiket, değer) çifti olarak toplanıp SONRA hizalanıyor.
  // Genişliği elle sabitlemek, oran iki haneden üç haneye çıktığında ya da
  // stopaj satırı eklendiğinde sütunu kaydırıyordu — para tablosunda kayan
  // sütun okunurluğu bozar ve rakam yanlış satıra ait sanılabilir.
  const cift: Array<[string, string]> = [['Brüt ücret (KDV hariç)', `${para(hesap.matrah)} TL`]];
  if (hesap.kdvOrani != null) {
    cift.push([`KDV (%${hesap.kdvOrani})`, `${para(hesap.kdvTutari)} TL`]);
  }
  cift.push(['Belge toplamı', `${para(hesap.belgeToplami)} TL`]);
  if (hesap.stopajOrani != null) {
    // Stopaj AVUKATIN ELİNE GEÇMEZ; müvekkil doğrudan vergi dairesine yatırır.
    // Eksi işaretiyle yazılması, "belge toplamı" ile "tahsil edilecek"
    // arasındaki farkın nereden geldiğini belgede görünür kılıyor.
    cift.push([`Gelir vergisi stopajı (%${hesap.stopajOrani})`, `−${para(hesap.stopajTutari)} TL`]);
  }
  cift.push(['TAHSİL EDİLECEK', `${para(hesap.tahsilEdilecek)} TL`]);
  if (yaziyla) cift.push(['Yazıyla', yaziyla]);

  const en = Math.max(...cift.map(([e]) => e.length));
  const hizali = cift.map(([e, d]) => `${e.padEnd(en)} : ${d}`);
  // "TAHSİL EDİLECEK" satırından önce boş satır: belgenin sonucu, kalemlerden
  // ayrılsın.
  const sonucIndeks = hizali.findIndex((s) => s.startsWith('TAHSİL EDİLECEK'));
  hizali.splice(sonucIndeks, 0, '');

  bloklar.push(['HİZMET VE TUTAR', '-'.repeat(40), g.aciklama.trim(), '', ...hizali].join('\n'));

  if (hesap.stopajOrani != null) {
    bloklar.push(
      'NOT: Gelir vergisi stopajı müşteri tarafından vergi dairesine yatırılır;\n' +
        'avukatın eline geçen tutar yukarıdaki "tahsil edilecek" satırıdır.',
    );
  }

  bloklar.push(
    'UYARI: Bu belge bir DÖKÜMDÜR, resmî serbest meslek makbuzu değildir ve\n' +
      'onun yerine geçmez. Resmî makbuz, e-Serbest Meslek Makbuzu (e-SMM)\n' +
      'düzeni üzerinden ya da tasdikli koçandan düzenlenir.',
  );

  return { metin: bloklar.join('\n\n'), hesap };
}
