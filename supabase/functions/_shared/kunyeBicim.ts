// Künye biçimi — saf, içe aktarma YOK (vitest de test edebilsin diye).
//
// Bedesten "2019/1234" döner, metinde "2019/01234" ya da "2019 / 1234" yazılmış
// olabilir; iki taraf aynı biçime getirilmeden eşleşme olmaz ve gerçek bir karar
// "canlıda yok" diye kırmızıya düşer — en pahalı yanlış pozitif.
// (kunye.ts başka bir iş yapıyor: belgeden künye çıkarma. Karıştırma.)

/** "2019/01234" → "2019/1234"; boşlukları atar. */
export function kunyeNormalize(s: string): string {
  return String(s ?? '').replace(/\s+/g, '').replace(/^(\d{4})\/0*(\d+)$/, '$1/$2');
}
