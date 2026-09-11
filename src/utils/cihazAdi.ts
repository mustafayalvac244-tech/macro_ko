/**
 * CİHAZ ADI ÜRETİMİ (saf).
 *
 * Cihaz listesinde kullanıcı "bu benim telefonum mu?" sorusunu ancak okunur
 * bir adla cevaplayabilir. expo-device'ın verdiği alanlar platforma göre
 * eksik gelebiliyor (web'de marka/model yok, Android'de bazen modelName boş),
 * bu yüzden birleştirme kuralları burada ve test edilebilir.
 *
 * GİZLİLİK: buraya seri numarası, reklam kimliği, IMEI gibi kalıcı donanım
 * kimlikleri GİRMEZ. Amaç kullanıcının kendi cihazını tanıması; parmak izi
 * çıkarmak değil.
 */

export interface CihazBilgisi {
  /** expo-device brand (ör. "Apple", "samsung") */
  marka?: string | null;
  /** expo-device modelName (ör. "iPhone 15 Pro") */
  model?: string | null;
  /** Platform.OS */
  platform?: string | null;
  /** Tarayıcı adı (yalnız web) */
  tarayici?: string | null;
  /** İşletim sistemi adı (ör. "iOS", "Android", "Windows") */
  isletim?: string | null;
}

const PLATFORM_ADI: Record<string, string> = {
  ios: 'iPhone/iPad',
  android: 'Android',
  web: 'Tarayıcı',
};

/**
 * Tekrarı ayıklayıp birleştirir ("samsung" + "samsung SM-A515F" → tek parça).
 *
 * İKİ YÖNLÜ KONTROL ŞART. Önce yalnız "yeni parça eskilerden birinin içinde
 * mi" diye bakıyordum; marka ÖNCE eklendiği için "samsung SM-A515F" bu
 * kontrolden geçiyor ve "samsung samsung SM-A515F" çıkıyordu (test yakaladı).
 * Doğrusu: bir parça, BAŞKA bir parçanın içinde geçiyorsa atılır — hangisinin
 * önce geldiğinden bağımsız olarak uzun olan kalır.
 */
function birlestir(parcalar: (string | null | undefined)[]): string {
  const temiz: string[] = [];
  for (const p of parcalar) {
    const s = (p ?? '').trim();
    if (s) temiz.push(s);
  }
  const out = temiz.filter((s, i) =>
    !temiz.some((o, j) => j !== i && o.toLowerCase().includes(s.toLowerCase()) && (o.length > s.length || j < i))
  );
  return out.join(' ');
}

/**
 * Okunur cihaz adı. Hiçbir bilgi yoksa platform adına, o da yoksa
 * "Bilinmeyen cihaz"a düşer — liste asla boş satır göstermez.
 */
export function cihazAdiUret(b: CihazBilgisi): string {
  const platform = (b.platform ?? '').toLowerCase();

  if (platform === 'web') {
    // Web'de marka/model yok; anlamlı olan tarayıcı + işletim sistemi.
    const ad = birlestir([b.tarayici, b.isletim]);
    return ad || PLATFORM_ADI.web || 'Tarayıcı';
  }

  const ad = birlestir([b.marka, b.model]);
  if (ad) return ad;
  return PLATFORM_ADI[platform] ?? 'Bilinmeyen cihaz';
}

/**
 * Tarayıcı adını user agent'tan çıkarır (yalnız web'de kullanılır).
 * SIRA ÖNEMLİ: Edge ve Opera kendilerini "Chrome" olarak da tanıtır, Chrome
 * da "Safari" olarak; en spesifikten genele doğru bakılır, aksi hâlde herkes
 * "Chrome" görünürdü.
 */
export function tarayiciAdi(ua: string | null | undefined): string {
  const s = (ua ?? '').toLowerCase();
  if (!s) return '';
  if (s.includes('edg/')) return 'Edge';
  if (s.includes('opr/') || s.includes('opera')) return 'Opera';
  if (s.includes('samsungbrowser')) return 'Samsung Internet';
  if (s.includes('firefox')) return 'Firefox';
  if (s.includes('chrome') || s.includes('crios')) return 'Chrome';
  if (s.includes('safari')) return 'Safari';
  return '';
}

/** İşletim sistemi adını user agent'tan çıkarır (yalnız web). */
export function isletimAdi(ua: string | null | undefined): string {
  const s = (ua ?? '').toLowerCase();
  if (!s) return '';
  if (s.includes('windows')) return 'Windows';
  if (s.includes('android')) return 'Android';
  if (s.includes('iphone') || s.includes('ipad') || s.includes('ipod')) return 'iOS';
  // "mac os x" iOS'ta da geçiyor; iOS kontrolünden SONRA bakılmalı.
  if (s.includes('mac os')) return 'macOS';
  if (s.includes('linux')) return 'Linux';
  return '';
}
