// AVUKATIN EKLEDİĞİ BELGELER — dilekçe ve belge incelemede (04.10.2026).
// ---------------------------------------------------------------------------
// İKİ İSTEK BİRDEN:
//   • Avukat: "Dilekçe Üret'e dosya ekleme koyulması gerekiyor." Cevap
//     dilekçesi karşı tarafın dava dilekçesi OKUNMADAN yazılamaz; avukat onu
//     olay kutusuna elle özetliyordu.
//   • Ürün sahibi: "PDF yükleme sadece yazıları çıkarıyor." Doğru: PDF'in
//     metni sunucuda çıkarılıp modele DÜZ METİN olarak gidiyordu. Taranmış
//     sayfa, tablo düzeni, mühür, el yazısı şerh modele hiç ulaşmıyordu;
//     tamamen taranmış bir PDF "metin yok" diye reddediliyordu.
//
// ÇÖZÜM: PDF, Claude'a "document" bloğu olarak gider. Anthropic belgesine
// göre (platform.claude.com/docs/en/build-with-claude/pdf-support, 04.10.2026
// okundu) her sayfa hem metin hem GÖRÜNTÜ olarak işlenir; istek başına en çok
// 100 sayfa, istek en çok 32 MB. PDF dışı belgeler (UDF, Word, TXT) metin
// olarak gider — onlar zaten metin biçimidir.
//
// METİN YİNE GEREKİR, AMA MODELE DEĞİL. Uydurma tarih/tutar denetimi çıktıyı
// KAYNAK METİNLE karşılaştırır. PDF görüntüsüyle gidince sunucunun elinde
// metin kalmazdı ve belgeden doğru okunan her tarih "uydurma" sayılırdı.
// İstemci, doc-extract'in çıkardığı metni de yollar; o metin YALNIZ denetimde
// kullanılır, modele ikinci kez gönderilmez (aynı belgeyi iki kez faturalamak
// olurdu).
//
// MALİYET — ÖLÇÜLMEDİ, TAHMİN. Anthropic belgesindeki örnek: görsel PDF
// işleme 3 sayfada ~7.000 token (sayfa başı ~2.300). 20 sayfa ≈ 46.000 token:
// Opus 5 ($5/M) ile ~$0,23, Sonnet 5 ($2/M) ile ~$0,09. Gerçek değer ilk
// kullanımlarda ai_istek.tokens_in'den okunacak. Sayfa tavanı bu yüzden
// Anthropic'in 100'ü değil, PDF_SAYFA_TAVANI.
//
// Saf modül: Deno'ya özgü hiçbir şey yok (tests/belgeEki.test.ts).

/** Bir istekte en çok kaç ek. */
export const EK_EN_COK = 3;
/** Metin olarak giden eklerin toplam karakter tavanı. ÜRÜN KARARI, ölçüm değil. */
export const EK_METIN_TAVANI = 40_000;
/**
 * Görüntüsüyle (PDF olarak) okunan toplam sayfa tavanı. ÜRÜN KARARI —
 * maliyet sınırı; yukarıdaki tahmine göre seçildi. Aşan PDF metin olarak gider.
 */
export const PDF_SAYFA_TAVANI = 20;
/** PDF'lerin toplam ham boyut tavanı (doc-extract'in kabul ettiği ~8 MB ile aynı). */
export const EK_PDF_TAVANI_BAYT = 8 * 1024 * 1024;

export interface Ek {
  ad: string;
  /** Çıkarılmış metin. PDF'te yalnız denetim içindir; taranmış PDF'te boş olabilir. */
  metin: string;
  /** Ham base64 PDF — varsa belge görüntüsüyle okunur. */
  pdf?: string;
  /** PDF sayfa sayısı (istemcinin doc-extract'ten aldığı). */
  sayfa?: number;
  /** Metni çıkmayan (taranmış) sayfa sayısı. */
  taranmis?: number;
}

/** base64'ün temsil ettiği yaklaşık bayt sayısı. */
function base64Bayt(b64: string): number {
  const dolgu = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - dolgu;
}

function sayi(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;
}

/**
 * İstemciden gelen eki doğrular ve tavanları uygular.
 *
 * Kurallar bilerek SESSİZ DEĞİL: tavanı aşan PDF reddedilmez, METNE düşürülür
 * ve `pdfdenMetne` listesine yazılır — ekran avukata "bu belge yalnız metniyle
 * okundu" diyebilsin. Boyut tavanı aşılırsa ise istek reddedilir (`hata`):
 * 8 MB'ı aşan bir yükü sessizce kırpmak, avukatın neyin okunduğunu
 * bilmemesi demektir.
 */
export function ekleriAyikla(gelen: unknown): {
  ekler: Ek[];
  /** Görüntüsüyle değil, yalnız çıkarılmış METNİYLE okunan PDF'ler. */
  pdfdenMetne: string[];
  /** Hiç okunamayan ekler: metni yok ve görüntüsüyle de gönderilemedi. */
  okunamayan: string[];
  hata?: 'ek_buyuk';
} {
  if (!Array.isArray(gelen)) return { ekler: [], pdfdenMetne: [], okunamayan: [] };
  const ekler: Ek[] = [];
  const pdfdenMetne: string[] = [];
  const okunamayan: string[] = [];
  let metinToplam = 0;
  let sayfaToplam = 0;
  let pdfBayt = 0;
  for (const g of gelen.slice(0, EK_EN_COK)) {
    if (!g || typeof g !== 'object') continue;
    const o = g as Record<string, unknown>;
    const ad = String(o.ad ?? '').replace(/[\r\n\t]/g, ' ').trim().slice(0, 120) || 'belge';
    let metin = typeof o.metin === 'string' ? o.metin : '';
    const kalan = Math.max(0, EK_METIN_TAVANI - metinToplam);
    if (metin.length > kalan) metin = metin.slice(0, kalan);
    metinToplam += metin.length;

    // PDF imzası: "%PDF" base64'te "JVBER" ile başlar. Başka bir şey PDF diye
    // gönderilirse model belge bloğunu reddeder ve istek boşa gider.
    const pdfHam = typeof o.pdf === 'string' ? o.pdf.replace(/^data:[^,]*,/, '').trim() : '';
    const pdfGecerli = pdfHam.startsWith('JVBER');
    const sayfa = sayi(o.sayfa);
    const taranmis = sayi(o.taranmis);

    let pdf: string | undefined;
    if (pdfGecerli) {
      pdfBayt += base64Bayt(pdfHam);
      if (pdfBayt > EK_PDF_TAVANI_BAYT) return { ekler: [], pdfdenMetne: [], okunamayan: [], hata: 'ek_buyuk' };
      // Sayfa sayısı bilinmiyorsa tavan dolmuş sayılmaz ama görüntüsüyle de
      // gönderilmez: maliyeti sınırsız bir yük kabul etmektense metinle okumak.
      if (sayfa !== undefined && sayfa > 0 && sayfaToplam + sayfa <= PDF_SAYFA_TAVANI) {
        pdf = pdfHam;
        sayfaToplam += sayfa;
      }
    }
    // Ne metni ne görüntüsü olan ek işe yaramaz (ör. taranmış ama tavanı
    // aşan PDF): listeye girmez, ama avukata söylenir.
    if (!pdf && !metin.trim()) {
      okunamayan.push(ad);
      continue;
    }
    if (pdfGecerli && !pdf) pdfdenMetne.push(ad);
    ekler.push({ ad, metin, pdf, sayfa, taranmis });
  }
  return { ekler, pdfdenMetne, okunamayan };
}

/**
 * Modele giden ek açıklaması.
 *
 * `pdfGorselMi` true ise PDF eklerin metni YAZILMAZ — belge bloğu olarak
 * mesajın başında duruyorlar. false ise (Claude dışı yedek hat) her ekin
 * metni yazılır: o hatlar belge bloğunu okuyamaz.
 */
export function ekAciklamasi(ekler: Ek[], pdfGorselMi: boolean): string {
  if (!ekler.length) return '';
  let pdfSira = 0;
  const parcalar = ekler.map((e, i) => {
    if (pdfGorselMi && e.pdf) {
      pdfSira += 1;
      return `EK ${i + 1} — ${e.ad}: mesajın başındaki ${pdfSira}. PDF belgesi (sayfa görüntüleriyle).`;
    }
    const metin = e.metin.trim();
    return `EK ${i + 1} — ${e.ad}:\n${metin || '(metni okunamadı)'}`;
  });
  return `AVUKATIN EKLEDİĞİ BELGELER:\n${parcalar.join('\n\n')}\n\n`;
}

/** Claude'a gidecek PDF belge blokları — ekteki sırayla. */
export function pdfBloklari(ekler: Ek[]): Array<Record<string, unknown>> {
  return ekler
    .filter((e) => e.pdf)
    .map((e) => ({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: e.pdf } }));
}

/**
 * Uydurma tarih/tutar denetiminin KAYNAK metni: avukatın anlatımı + eklerin
 * okunabilen metni. Taranmış sayfanın metni burada yoktur; oradan okunan bir
 * tarih denetimde "kaynakta yok" sayılır ve çıkarılır — dilekçe mahkemeye
 * gider, doğrulanamayan tarihin kalmasındansa boşluk kalması tercih edildi.
 */
export function denetimKaynagi(anlatim: string, ekler: Ek[]): string {
  return [anlatim, ...ekler.map((e) => e.metin)].filter((s) => s.trim()).join('\n\n');
}

/** Taranmış (metni çıkmayan) sayfası olan ek var mı — ekranda uyarı için. */
export function taranmisSayfaVar(ekler: Ek[]): boolean {
  return ekler.some((e) => !!e.pdf && (e.taranmis ?? 0) > 0);
}
