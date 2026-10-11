/**
 * WCAG 2.x KONTRAST — saf mantık, tema/yerel modül bağımsız.
 *
 * NEDEN VAR (10.10.2026, denetim bulgusu): pano süre rozeti açık temalarda
 * sabit altın (#D4AF37) kullanıyordu: beyaz kart üstünde 2,10:1, rozetin kendi
 * %12'lik altın zemini üstünde 1,93:1 (hesaplandı). Durum rozetleri de
 * (uyarı/başarı/öncelik) açık temalarda 2,5–4,4:1 arasındaydı.
 * Renkler token'dan geliyor ve her tema farklı; sabit bir "koyu ton" seçmek
 * 7 temada birden tutmaz. Bu yardımcı yazıyı, gereken kontrasta ulaşana dek
 * temanın ana yazı rengine doğru kaydırır: zaten yeterli olan renge DOKUNMAZ.
 */

type RGBA = [number, number, number, number];

/** #RGB, #RRGGBB, #RRGGBBAA ve rgb()/rgba() okur; tanımadığı biçimde null döner. */
export function renkOku(renk: string): RGBA | null {
  const s = renk.trim();
  if (s.startsWith('#')) {
    let h = s.slice(1);
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    if (!/^[0-9a-fA-F]+$/.test(h) || (h.length !== 6 && h.length !== 8)) return null;
    const n = parseInt(h.slice(0, 6), 16);
    const a = h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
  }
  const m = s.match(/^rgba?\(([^)]+)\)$/i);
  if (!m) return null;
  const p = m[1]!.split(',').map((x) => parseFloat(x));
  if (p.length < 3 || p.slice(0, 3).some((x) => Number.isNaN(x))) return null;
  return [p[0]!, p[1]!, p[2]!, p[3] ?? 1];
}

function hexYaz([r, g, b]: RGBA): string {
  const h = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

const dogrusal = (v: number) => {
  const x = v / 255;
  return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
};
const parlaklik = ([r, g, b]: RGBA) => 0.2126 * dogrusal(r) + 0.7152 * dogrusal(g) + 0.0722 * dogrusal(b);

/** Yarı saydam rengi opak bir zeminin üstüne koyar. */
function katman(on: RGBA, zemin: RGBA): RGBA {
  const a = on[3];
  return [on[0] * a + zemin[0] * (1 - a), on[1] * a + zemin[1] * (1 - a), on[2] * a + zemin[2] * (1 - a), 1];
}

/** Yazı rengi `on`, OPAK zemin `zemin` üstünde kaç:1. Okunamayan renkte null. */
export function kontrastOrani(on: string, zemin: string): number | null {
  const f = renkOku(on);
  const z = renkOku(zemin);
  if (!f || !z) return null;
  const ff = f[3] < 1 ? katman(f, z) : f;
  const a = parlaklik(ff);
  const b = parlaklik(z);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Yarı saydam bir zemin rengini (ör. successSoft) opak bir yüzeyin üstünde opak renge çevirir. */
export function zeminUstune(zemin: string, yuzey: string): string {
  const z = renkOku(zemin);
  const y = renkOku(yuzey);
  if (!z || !y) return yuzey;
  return hexYaz(katman(z, y));
}

/**
 * `renk` verilen zeminlerin HEPSİNDE `min`:1'i sağlamıyorsa, rengi `hedef`e
 * (temanın ana yazı rengi) doğru %2'şer adımla kaydırır; ilk sağlayan ton
 * döner. Zaten sağlıyorsa ya da bir renk okunamıyorsa girdiyi AYNEN döner.
 * Zeminler opak olmalı (yarı saydamlar için önce `zeminUstune`).
 */
export function okunurRenk(renk: string, zeminler: string[], hedef: string, min = 4.5): string {
  const f = renkOku(renk);
  const h = renkOku(hedef);
  if (!f || !h || f[3] < 1) return renk;
  const yeterli = (c: string) => zeminler.every((z) => (kontrastOrani(c, z) ?? min) >= min);
  if (yeterli(renk)) return renk;
  for (let adim = 1; adim <= 50; adim++) {
    const t = adim / 50;
    const aday = hexYaz([
      f[0] * (1 - t) + h[0] * t,
      f[1] * (1 - t) + h[1] * t,
      f[2] * (1 - t) + h[2] * t,
      1,
    ]);
    if (yeterli(aday)) return aday;
  }
  return hedef;
}
