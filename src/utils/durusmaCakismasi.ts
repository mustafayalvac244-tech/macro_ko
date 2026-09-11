/**
 * DURUŞMA ÇAKIŞMASI.
 *
 * BULUNAN EKSİK. Uygulama aynı güne, aynı saate iki duruşma kaydetmeye izin
 * veriyordu ve tek kelime uyarmıyordu. Avukat için bunun bedeli ağırdır:
 * iki duruşma fiziksel olarak aynı anda yapılamaz; gidilmeyen celsede
 * yokluğunda karar verilebilir, dosya işlemden kaldırılabilir, HMK m.150
 * uyarınca üç ay içinde yenilenmezse dava açılmamış sayılır. Yani bu bir
 * "konfor" özelliği değil, hak kaybı önleyicidir.
 *
 * MENFAAT ÇATIŞMASINDAN FARKI: orada kimlik eşleştiriliyor, burada ZAMAN.
 * İkisi ayrı modüller; bu dosya saf, ağ ve platform bağımlılığı yok.
 *
 * EŞİKLER ÖLÇÜM DEĞİL, SEÇİMDİR. Aşağıdaki dakikalar gerçek duruşma
 * sürelerinden ÖLÇÜLMEDİ; makul varsayılanlardır ve öyle etiketlenmiştir.
 * Bir duruşmanın ne kadar süreceği mahkemeye, dosyaya ve o günün listesine
 * göre değişir; uygulamanın bunu bilmesi mümkün değil. Bu yüzden uyarı
 * "kesin çakışma" değil, "bak" demektir ve metinleri de böyle yazılmıştır.
 */

/** Bir duruşmanın kapladığı varsayılan süre (dakika). Ölçüm değil, varsayılan. */
export const DURUSMA_SURESI_DK = 45;

/** Farklı adliye/konum arasında en az gerekli sayılan süre (dakika). Varsayılan. */
export const YOL_PAYI_DK = 90;

export type CakismaTuru =
  /** Zaman aralıkları örtüşüyor — ikisine birden yetişmek mümkün değil. */
  | 'ortusuyor'
  /** Aralık var ama farklı konum için yol payı yetmiyor. */
  | 'yol_yetmez'
  /** Aynı konum, arka arkaya — gerçekçi ama sıkışık. */
  | 'sikisik';

export interface CakismaKaydi {
  id: string;
  /** ISO tarih-saat. */
  scheduled_at: string;
  title: string;
  location: string | null;
  is_completed: boolean;
}

export interface Cakisma {
  /** Çakıştığı diğer kayıt. */
  digeri: CakismaKaydi;
  tur: CakismaTuru;
  /** İki duruşma arasındaki fark (dakika, mutlak değer). */
  farkDk: number;
  /** Konumlar farklı mı? (ikisi de doluysa karşılaştırılır) */
  konumFarkli: boolean;
}

const HARF: Record<string, string> = {
  ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', İ: 'i', ö: 'o', Ö: 'o',
  ş: 's', Ş: 's', ü: 'u', Ü: 'u', â: 'a', Â: 'a', î: 'i', Î: 'i', û: 'u', Û: 'u',
};

/**
 * Konum karşılaştırma anahtarı.
 *
 * toLowerCase KULLANILMAZ: JS'te 'İ'.toLowerCase() iki kod birimine açılır ve
 * "İSTANBUL ADLİYESİ" ile "İstanbul Adliyesi" farklı görünürdü. Noktalama ve
 * fazla boşluk atılır ki "Çağlayan Adliyesi," ile "Çağlayan  Adliyesi" eşleşsin.
 */
export function konumAnahtari(s: string | null | undefined): string {
  if (!s) return '';
  let out = '';
  for (const ch of s) out += HARF[ch] ?? ch;
  return out
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** İki konum aynı yer mi? İkisinden biri boşsa KARAR VERİLEMEZ (false döner). */
export function ayniKonum(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = konumAnahtari(a);
  const y = konumAnahtari(b);
  if (!x || !y) return false;
  return x === y;
}

function dakika(iso: string): number | null {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : Math.floor(d.getTime() / 60000);
}

/**
 * Bir duruşmanın diğerleriyle çakışmalarını bulur.
 *
 * @param aday      kaydedilmek istenen duruşma (id varsa kendisi elenir)
 * @param mevcutlar avukatın diğer duruşmaları
 *
 * Tamamlanmış (is_completed) kayıtlar sayılmaz: geçmiş bir celse yeni bir
 * randevuyu engellemez.
 *
 * Sonuç en yakın çakışmadan uzağa doğru sıralıdır — avukat önce en tehlikeli
 * olanı görsün.
 */
export function cakismaBul(
  aday: { id?: string; scheduled_at: string; location?: string | null },
  mevcutlar: CakismaKaydi[],
): Cakisma[] {
  const t0 = dakika(aday.scheduled_at);
  if (t0 === null) return [];

  const out: Cakisma[] = [];
  for (const m of mevcutlar) {
    if (m.is_completed) continue;
    if (aday.id && m.id === aday.id) continue;
    const t1 = dakika(m.scheduled_at);
    if (t1 === null) continue;

    const fark = Math.abs(t1 - t0);
    // Aynı gün değilse (24 saatten uzak) hiç bakma.
    if (fark >= 24 * 60) continue;

    const ayni = ayniKonum(aday.location, m.location);
    const konumFarkli = !ayni && !!konumAnahtari(aday.location) && !!konumAnahtari(m.location);

    let tur: CakismaTuru | null = null;
    if (fark < DURUSMA_SURESI_DK) {
      tur = 'ortusuyor';
    } else if (konumFarkli && fark < YOL_PAYI_DK) {
      tur = 'yol_yetmez';
    } else if (ayni && fark < YOL_PAYI_DK) {
      tur = 'sikisik';
    }

    if (tur) out.push({ digeri: m, tur, farkDk: fark, konumFarkli });
  }

  return out.sort((a, b) => a.farkDk - b.farkDk);
}

/** Listedeki en ağır çakışma türü (yoksa null). Rozet rengi için. */
export function enAgirTur(liste: Cakisma[]): CakismaTuru | null {
  if (liste.some((c) => c.tur === 'ortusuyor')) return 'ortusuyor';
  if (liste.some((c) => c.tur === 'yol_yetmez')) return 'yol_yetmez';
  if (liste.some((c) => c.tur === 'sikisik')) return 'sikisik';
  return null;
}

/**
 * Tüm ajandadaki çakışan duruşma kimliklerini döndürür (takvim/pano rozetleri).
 * Çift yönlü: çakışan iki kaydın İKİSİ de işaretlenir.
 */
export function cakisanKimlikler(hepsi: CakismaKaydi[]): Set<string> {
  const isaretli = new Set<string>();
  for (const h of hepsi) {
    if (h.is_completed) continue;
    const c = cakismaBul({ id: h.id, scheduled_at: h.scheduled_at, location: h.location }, hepsi);
    if (c.length > 0) {
      isaretli.add(h.id);
      for (const x of c) isaretli.add(x.digeri.id);
    }
  }
  return isaretli;
}
