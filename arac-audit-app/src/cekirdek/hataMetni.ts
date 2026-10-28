// HATA METNİ (28.10.2026) — ekranda gösterilen hata cümlesi tek yerden.
//
// Neden: değerlendirmede (erişilebilirlik ajanı) teknik iletilerin ekrana
// olduğu gibi düştüğü bulundu — bozuk bir Excel seçilince "Dosya
// doldurulamadı: DEFLATE: geçersiz Huffman kodu" yazıyordu; İngilizce
// arayüzde de aynı Türkçe ileti çıkıyordu. Denetçi bundan ne yapacağını
// çıkaramaz.
//
// İki tür hata var:
// - KullaniciHatasi: kullanıcıya söylenmek için yazılmış, iki dilli
//   (ör. "Bu dosyada X sayfası yok"). Olduğu gibi, arayüzün dilinde gösterilir.
// - Teknik hata (inflate.ts, zip.ts, xlsxOku.ts, JSON): iletisi geliştirici
//   için. Ekranda ne yapılacağını söyleyen cümleye çevrilir; ayrıntısı
//   gösterilmez. Bu dosyanın tanımadığı hata eskisi gibi iletisiyle çıkar
//   (yerel modüllerin iletileri — yutmak, sebebi tamamen gizlemek olurdu).

import { Dil } from './tipler';

export class KullaniciHatasi extends Error {
  constructor(readonly tr: string, readonly en: string) {
    // message Türkçe kalır: günlükte ve testlerde eskisiyle aynı metin.
    super(tr);
    this.name = 'KullaniciHatasi';
  }
}

interface Kural { desen: RegExp; tr: string; en: string }

// Sıra önemli: ilk eşleşen kazanır (şifreli/ZIP64 genel "ZIP bozuk"tan önce).
const KURALLAR: readonly Kural[] = [
  {
    desen: /şifreli/,
    tr: 'Dosya parolalı, açılamıyor. Excel\'de parolasız kaydedip yeniden seçin.',
    en: 'The file is password-protected and cannot be opened. Save it without a password in Excel and pick it again.',
  },
  {
    desen: /ZIP64/,
    tr: 'Dosya bu uygulamanın açabileceğinden büyük. Excel\'de gereksiz sayfaları silip yeniden kaydedin.',
    en: 'The file is larger than this app can open. Remove unneeded sheets in Excel, save it and try again.',
  },
  {
    desen: /desteklenmeyen yöntemle/,
    tr: 'Dosya alışılmadık bir biçimde sıkıştırılmış. Excel\'de açıp yeniden kaydedin, sonra tekrar seçin.',
    en: 'The file is compressed in an unusual way. Open it in Excel, save it again, then pick it again.',
  },
  {
    desen: /^DEFLATE:|^ZIP bozuk|CRC uymuyor|^Sayfa okunamadı/,
    tr: 'Dosya bozuk ya da yarım inmiş. Excel\'de açılıyorsa yeniden kaydedip tekrar seçin; açılmıyorsa dosyanın sağlam bir kopyasını isteyin.',
    en: 'The file is damaged or only partly downloaded. If it opens in Excel, save it again and retry; otherwise ask for an intact copy.',
  },
  {
    desen: /^ZIP değil/,
    tr: 'Seçilen dosya Excel ya da yedek dosyası değil.',
    en: 'The selected file is not an Excel or backup file.',
  },
];

/** Ekranda gösterilecek hata cümlesi, arayüzün dilinde. */
export function hataMetni(h: unknown, dil: Dil): string {
  if (h instanceof KullaniciHatasi) return dil === 'en' ? h.en : h.tr;
  if (h instanceof SyntaxError) {
    return dil === 'en'
      ? 'The file content could not be read (damaged or incomplete).'
      : 'Dosyanın içeriği okunamadı (bozuk ya da yarım).';
  }
  const ileti = h instanceof Error ? h.message : String(h);
  const k = KURALLAR.find((x) => x.desen.test(ileti));
  if (k) return dil === 'en' ? k.en : k.tr;
  return ileti;
}
