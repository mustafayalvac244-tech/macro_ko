/**
 * KULLANIM SAYACI — saf kısım (react-native içe aktarmaz, testte koşar).
 * Bkz. src/lib/kullanim.ts ve 0165_kullanim_sayac.
 */

/**
 * Sunucudaki kullanim_kaydet() ile AYNI biçim (0165). Biçime uymayan olay
 * sunucuda sessizce atlanır; testte ikisinin aynı kaldığı denetlenir.
 */
export const OLAY_BICIMI = '^[a-z_]{2,20}:[a-z0-9_:/.-]{0,80}$';

/** Yoldaki kimlik parçalarını (uuid, sayı) ':id' yapar — kişiye bağlanmasın. */
export function yolSade(yol: string): string {
  return (yol || '/')
    .toLowerCase()
    .split('?')[0]
    .split('/')
    .map((p) => (/^[0-9a-f-]{8,}$/.test(p) || /^\d+$/.test(p) ? ':id' : p))
    .join('/')
    .replace(/[^a-z0-9_:/.-]/g, '')
    .slice(0, 80);
}
