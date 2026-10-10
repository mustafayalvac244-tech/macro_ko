// RESMÎ GAZETE GÜNLÜK FİHRİSTİ — 05.10.2026.
// ---------------------------------------------------------------------------
// Ürün sahibi: "Resmî Gazete özetini ekle." Rakip (Apilex) ana ekranında
// günlük Resmî Gazete özeti gösteriyor ve 5★ yorumlarda övülüyor.
//
// NE YAPIYOR: resmigazete.gov.tr'nin günlük fihrist sayfasını
// (eskiler/YYYY/AA/YYYYAAGG.htm) okur, maddeleri bölüm ve başlık grubuyla
// (CUMHURBAŞKANI KARARLARI, YÖNETMELİKLER, ANAYASA MAHKEMESİ KARARI…) çıkarır.
// Başlıklar Gazete'nin kendi fihristinden AYNEN alınır.
//
// NEDEN YAPAY ZEKÂ ÖZETİ DEĞİL: başlık zaten resmî ve kesin bir özettir;
// yapay zekâ ile yeniden yazmak hem para (her gün) hem uydurma riski demekti
// — bu projede "kullanıcıya doğrulanamayan şey yazılmaz". Madde içeriğinin
// özeti istenirse ayrı karar.
//
// YAPI (ölçüldü, 05.09–05.10.2026 arası 22 fihrist + 1 mükerrer):
//   • Kodlama windows-1254.
//   • Bölüm ve grup başlıkları <b><u>…</u></b> içinde, BÜYÜK HARFLE.
//   • Her madde bir <a href="…pdf">––  Başlık</a>; 22 günün tamamında
//     tire işaretli her madde bağlantılıydı.
//   • Mükerrer sayı fihristte "…/YYYYAAGGM1.htm" bağlantısıyla gelir ve
//     aynı yapıda ayrı bir sayfadır (06.09.2026: Orta Vadeli Program).
//   • İlan bölümü maddeleri yargı/ihale ilanlarıdır; avukatın günlük
//     mevzuat takibi için gürültü — alınmaz.
//
// Saf modül: Deno'ya özgü hiçbir şey yok (tests/resmiGazete.test.ts).

export interface GazeteMaddesi {
  /** YÜRÜTME VE İDARE BÖLÜMÜ / YARGI BÖLÜMÜ */
  bolum: string;
  /** CUMHURBAŞKANI KARARLARI, YÖNETMELİKLER, TEBLİĞ… */
  grup: string;
  baslik: string;
  /** Mutlak https bağlantısı (çoğunlukla PDF). */
  url: string;
  /** Mükerrer sayıdan mı geldi. */
  mukerrer?: boolean;
}

export interface Fihrist {
  sayi: number | null;
  maddeler: GazeteMaddesi[];
  /** Fihristte bağlantısı olan mükerrer sayfalar (mutlak https). */
  mukerrerler: string[];
}

const KOK = 'https://www.resmigazete.gov.tr';

/** Günün fihrist adresi. Tarih Türkiye takvim günüdür (YYYY-AA-GG). */
export function fihristUrl(tarih: string): string {
  const [y, a, g] = tarih.split('-');
  return `${KOK}/eskiler/${y}/${a}/${y}${a}${g}.htm`;
}

/** Türkiye'nin (UTC+3, yaz saati yok) bugünkü takvim günü. */
export function turkiyeBugun(simdi: Date = new Date()): string {
  return new Date(simdi.getTime() + 3 * 3600_000).toISOString().slice(0, 10);
}

function metin(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&#8200;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&#8217;/g, '’')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

function mutlak(href: string, sayfaUrl: string): string {
  const u = new URL(href, sayfaUrl);
  u.protocol = 'https:';
  return u.toString();
}

const BOLUM = /BÖLÜMÜ$/;
const ILAN = /İL[AÂ]N BÖLÜMÜ/;

/**
 * Fihrist HTML'ini (zaten çözülmüş metin) ayrıştırır.
 *
 * Belge sırasıyla iki tür parça okunur: başlık (<b><u>…</u></b>) ve
 * bağlantı (<a href>…</a>). Başlık "…BÖLÜMÜ" ile bitiyorsa bölümdür, değilse
 * grup. Tire ile başlamayan bağlantılar (PDF simgesi, mükerrer sayfa
 * bağlantısı) madde sayılmaz.
 */
export function fihristCoz(html: string, sayfaUrl: string, mukerrer = false): Fihrist {
  const duz = html.replace(/\s+/g, ' ');
  const sayiEsl = /(\d{5})\s*Sayılı/.exec(metin(duz));
  const sayi = sayiEsl ? Number(sayiEsl[1]) : null;

  const maddeler: GazeteMaddesi[] = [];
  const mukerrerler: string[] = [];
  let bolum = '';
  let grup = '';
  const parca = /<b>\s*<u>(.*?)<\/u>\s*<\/b>|<a\s[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi;
  for (const m of duz.matchAll(parca)) {
    if (m[1] !== undefined) {
      const b = metin(m[1]).toLocaleUpperCase('tr');
      if (!b) continue;
      if (BOLUM.test(b)) {
        bolum = b;
        grup = '';
      } else {
        grup = b;
      }
      continue;
    }
    const href = m[2];
    const yazi = metin(m[3] ?? '');
    if (/M\d+\.htm$/i.test(href)) {
      const u = mutlak(href, sayfaUrl);
      if (!mukerrerler.includes(u)) mukerrerler.push(u);
      continue;
    }
    if (!/^[–—-]/.test(yazi)) continue;
    if (!bolum || ILAN.test(bolum)) continue;
    const baslik = yazi.replace(/^[–—\-\s]+/, '').trim();
    if (!baslik) continue;
    maddeler.push({ bolum, grup, baslik, url: mutlak(href, sayfaUrl), ...(mukerrer ? { mukerrer: true } : {}) });
  }
  return { sayi, maddeler, mukerrerler };
}

// ---------------------------------------------------------------------------
// YAZMA KARARI (10.10.2026 denetimi). Eskiden uç işlev ayrıştırma sonucunu
// hiç sorgulamadan upsert ediyordu: kaynak 200 ile bakım/hata sayfası dönerse
// ya da sayfa yapısı bozulup madde bulunamazsa, DOLU bir günün satırı boş
// veriyle ezilirdi; mükerrer sayfası düşerse de (3 deneme) ana sayı hiç
// yazılmazdı. Karar saf bir fonksiyonda, böylece tests/resmiGazete.test.ts
// uç işlev çalıştırmadan sınar.

/** Tabloya yazılacak (ya da tablodan okunan) günün içeriği. */
export interface GazeteSatiri {
  sayi: number | null;
  maddeler: GazeteMaddesi[];
  /** Ana fihristte bağlantısı bulunan mükerrer sayfa adedi. */
  mukerrer: number;
}

export type YazimKarari =
  | { yaz: true; satir: GazeteSatiri }
  | { yaz: false; neden: 'gecersiz_fihrist' | 'bos_ezme' };

/**
 * @param yeni          Bu turda okunan gün (ana sayfa + gelebilen mükerrerler).
 * @param eski          Tabloda kayıtlı gün, yoksa null.
 * @param mukerrerEksik Bir mükerrer sayfası bu turda okunamadı.
 *
 * Kurallar:
 *  1. Ne sayı ("NNNNN Sayılı") ne madde bulunduysa sayfa fihrist değildir
 *     (bakım/hata sayfası) → yazılmaz. Yalnız ilan içeren gerçek bir günde sayı
 *     bulunur, o yazılır (ekranda "yalnız ilan" notu çıkar).
 *  2. Kayıtlı gün ana sayıdan madde içeriyorsa ve bu okumada ana sayıdan hiç
 *     madde yoksa ayrıştırma bozulmuş sayılır → eski satır korunur.
 *  3. Mükerrer okunamadıysa ana sayı yine yazılır; önceki turdan kalan
 *     mükerrer maddeleri (varsa) korunur, böylece geçici bir düşüş onları silmez.
 */
export function yazimKarari(yeni: GazeteSatiri, eski: GazeteSatiri | null, mukerrerEksik: boolean): YazimKarari {
  if (yeni.sayi === null && yeni.maddeler.length === 0) return { yaz: false, neden: 'gecersiz_fihrist' };

  const anaSayisi = (s: GazeteSatiri) => s.maddeler.filter((m) => !m.mukerrer).length;
  if (eski && anaSayisi(eski) > 0 && anaSayisi(yeni) === 0) return { yaz: false, neden: 'bos_ezme' };

  let maddeler = yeni.maddeler;
  if (mukerrerEksik && eski) {
    const mevcutUrl = new Set(maddeler.map((m) => m.url));
    const korunan = eski.maddeler.filter((m) => m.mukerrer && !mevcutUrl.has(m.url));
    maddeler = [...maddeler, ...korunan];
  }
  return { yaz: true, satir: { sayi: yeni.sayi, maddeler, mukerrer: yeni.mukerrer } };
}

/**
 * Tabloda satırı olmayan günler: `bugun`den (dahil değil) geriye `geriGun`
 * gün, yeniden eskiye. Bugünü ana akış çeker. Yalnız bugünü çeken eski tasarımda
 * bir gün kaçarsa (kaynak o gün ayakta değil, uç işlev yok, vb.) o güne bir daha
 * hiç bakılmıyordu.
 */
export function eksikGunler(bugun: string, mevcut: Iterable<string>, geriGun: number): string[] {
  const kayitli = new Set(mevcut);
  const sonuc: string[] = [];
  const t0 = Date.parse(`${bugun}T12:00:00Z`);
  for (let i = 1; i <= geriGun; i++) {
    const g = new Date(t0 - i * 86_400_000).toISOString().slice(0, 10);
    if (!kayitli.has(g)) sonuc.push(g);
  }
  return sonuc;
}
