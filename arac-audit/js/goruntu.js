// Görüntü yardımcıları: boyut okuma (Excel'e gömerken en/boy oranı için şart)
// ve tarayıcı tarafında küçültme (30 fotoğraflı bir denetim 150 MB olmasın diye).

/**
 * PNG / JPEG baytlarından piksel ölçüsünü okur. Tarayıcı API'sine ihtiyaç
 * duymaz, bu yüzden testte de çalışır.
 * @returns {{en:number, boy:number, tur:'png'|'jpeg'}|null}
 */
export function goruntuBoyutu(bayt) {
  if (!bayt || bayt.length < 24) return null;

  // PNG: 8 baytlık imza + IHDR (en/boy 16. bayttan itibaren, big-endian)
  if (bayt[0] === 0x89 && bayt[1] === 0x50 && bayt[2] === 0x4E && bayt[3] === 0x47) {
    const g = (i) => (bayt[i] << 24 | bayt[i + 1] << 16 | bayt[i + 2] << 8 | bayt[i + 3]) >>> 0;
    return { en: g(16), boy: g(20), tur: 'png' };
  }

  // JPEG: SOI'den sonra bölümleri atlayarak SOFn işaretini bul
  if (bayt[0] === 0xFF && bayt[1] === 0xD8) {
    let i = 2;
    while (i + 9 < bayt.length) {
      if (bayt[i] !== 0xFF) { i++; continue; }
      const im = bayt[i + 1];
      if (im === 0xD8 || im === 0x01 || (im >= 0xD0 && im <= 0xD7)) { i += 2; continue; }
      const uzunluk = (bayt[i + 2] << 8) | bayt[i + 3];
      // SOF0..SOF15 (DHT=C4, JPG=C8, DAC=CC hariç) çerçeve boyutunu taşır
      const sof = im >= 0xC0 && im <= 0xCF && im !== 0xC4 && im !== 0xC8 && im !== 0xCC;
      if (sof) {
        return { boy: (bayt[i + 5] << 8) | bayt[i + 6], en: (bayt[i + 7] << 8) | bayt[i + 8], tur: 'jpeg' };
      }
      if (uzunluk < 2) return null;
      i += 2 + uzunluk;
    }
  }
  return null;
}

/** MIME türünü baytlardan çıkarır (Excel ilişkisinde uzantı doğru olmalı). */
export function goruntuTuru(bayt) {
  const b = goruntuBoyutu(bayt);
  return b ? (b.tur === 'png' ? 'image/png' : 'image/jpeg') : 'application/octet-stream';
}

/**
 * Tarayıcıda fotoğrafı küçültür ve JPEG'e çevirir.
 * Telefon kamerası 4000x3000 üretir; 30 hatalı bir denetimde bu 150 MB'lık
 * bir Excel demektir. 1600 px uzun kenar, denetim fotoğrafı için fazlasıyla
 * yeterli ve dosyayı ~40 kat küçültür.
 * @param {Blob} blob
 * @param {number} [enFazla] uzun kenar (piksel)
 * @param {number} [kalite] 0-1
 * @returns {Promise<{blob:Blob, en:number, boy:number}>}
 */
export async function fotografKucult(blob, enFazla = 1600, kalite = 0.82) {
  const bitmap = await createImageBitmap(blob);
  const oran = Math.min(1, enFazla / Math.max(bitmap.width, bitmap.height));
  const en = Math.max(1, Math.round(bitmap.width * oran));
  const boy = Math.max(1, Math.round(bitmap.height * oran));

  const tuval = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(en, boy)
    : Object.assign(document.createElement('canvas'), { width: en, height: boy });
  const ctx = tuval.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, en, boy);
  bitmap.close?.();

  const kucuk = tuval.convertToBlob
    ? await tuval.convertToBlob({ type: 'image/jpeg', quality: kalite })
    : await new Promise((c) => tuval.toBlob(c, 'image/jpeg', kalite));
  return { blob: kucuk, en, boy };
}
