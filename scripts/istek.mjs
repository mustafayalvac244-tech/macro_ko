// ZAMAN AŞIMLI İSTEK + BÜTÇELİ GERİ ÇEKİLME
// ---------------------------------------------------------------------------
// ÖLÇÜLEN ARIZA (2026-09-11, canlı koşu 34635964721). "tam ölçüm" koşusu
// 51 dakika boyunca "in_progress" göründü ve veritabanına TEK BİR AI isteği
// bile düşmedi. Bunu ai_harcama_ozeti(3) ile 70 saniye arayla iki kez ölçtüm:
// her ikisinde de son istek 17:49:48 — yani koşu 18:55'te başlamadan ÖNCEKİ
// istek. Koşu bir saat boyunca hiçbir şey üretmedi.
//
// Sebebi kesin olarak ayıramadım (GitHub, koşan bir işin kaydını 404 ile
// gizliyor; bitmeden okunamıyor). İki aday var ve İKİSİ DE gerçek kusur:
//
//   1) HİÇBİR ÖLÇÜM BETİĞİNDE İSTEK ZAMAN AŞIMI YOKTU. Dokuz betikte de
//      AbortController/AbortSignal geçmiyordu. Node'un fetch'i kendiliğinden
//      zaman aşımına uğramaz: ai-chat tek bir istekte takılırsa betik SONSUZA
//      kadar orada bekler.
//
//   2) TEK BİR 429, SESSİZCE 30 DAKİKA UYUTABİLİYORDU. bekleme.mjs sağlayıcının
//      "şu kadar sonra dene" ipucunu okuyor ve üst sınır 30 dakika; üstelik
//      6 denemeye kadar tekrarlıyor. Yani tek bir soru 3 saat sürebilir —
//      işin 120 dakikalık tavanından uzun.
//
// HER İKİ DURUMDA DA SONUÇ AYNI VE ASIL KÖTÜSÜ BU: betikler sonucu yalnız
// SONDA yazdığı için, iş tavana çarpıp öldürüldüğünde ortaya HİÇBİR ÖLÇÜM
// çıkmıyor. Bir saat geçiyor, elde veri yok, neyin olduğu da bilinmiyor.
//
// Bu dosya üç şey getiriyor:
//   • istek()      — zaman aşımlı fetch. Süre dolarsa ZAMAN_ASIMI hatası atar.
//   • Butce        — betik başına duvar saati bütçesi. Geri çekilme süresi
//                    bütçeden uzunsa beklenmez; ölçüm orada kesilir ve o ana
//                    kadarki sonuç RAPORLANIR.
//   • sonucYaz()   — sonucu her senaryodan sonra diske yazar, sonda değil.
//
// Bu dosya tek başına yetmez: iş akışında her betik `timeout` ile sarılıdır,
// böylece burada öngörülmeyen bir takılma da döngüyü durduramaz.

import { writeFileSync } from 'node:fs';

/** Varsayılan istek zaman aşımı (ms). Mütalaa çok adımlı olduğu için geniş. */
export const ZAMAN_ASIMI_MS = Number(process.env.EVAL_ISTEK_ZAMAN_ASIMI ?? 240000);

/**
 * Zaman aşımlı fetch.
 *
 * Çağıran taraf AbortSignal geçirdiyse ona DOKUNULMAZ (iki sinyali birleştirmek
 * gereksiz karmaşıklık; hiçbir ölçüm betiği kendi sinyalini geçirmiyor).
 *
 * @param {string} adres
 * @param {RequestInit} [secenekler]
 * @param {number} [ms] zaman aşımı; varsayılan ZAMAN_ASIMI_MS
 * @returns {Promise<Response>}
 * @throws {Error} süre dolarsa mesajı 'ZAMAN_ASIMI (<sn>sn)' olan hata
 */
export async function istek(adres, secenekler = {}, ms = ZAMAN_ASIMI_MS) {
  try {
    return await fetch(adres, { ...secenekler, signal: AbortSignal.timeout(ms) });
  } catch (e) {
    // TimeoutError'u ayrı bir mesajla yükseltiyoruz: betikler bunu "senaryo
    // başarısız" diye kaydedip SIRADAKİNE GEÇEBİLSİN. Eskiden böyle bir yol
    // yoktu çünkü istek hiç bitmiyordu.
    if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
      throw new Error(`ZAMAN_ASIMI (${Math.round(ms / 1000)}sn)`);
    }
    throw e;
  }
}

/**
 * Betik başına duvar saati bütçesi.
 *
 * NEDEN DENEME SAYISI DEĞİL SÜRE. Eski geri çekilme "en fazla 6 deneme" diyordu;
 * ama her deneme 30 dakikaya kadar uyuyabildiği için üst sınır süre cinsinden
 * 3 saatti. Ölçümü sınırlayan şey deneme sayısı değil, işin süresi — o yüzden
 * bütçe de süre cinsinden tutuluyor.
 */
export class Butce {
  /** @param {number} ms toplam bütçe */
  constructor(ms = Number(process.env.EVAL_BETIK_BUTCESI ?? 20 * 60 * 1000)) {
    this.toplam = ms;
    this.basladi = Date.now();
  }

  /** Kalan süre (ms); bittiyse 0. */
  kalan() {
    return Math.max(0, this.toplam - (Date.now() - this.basladi));
  }

  /** Bütçe doldu mu? */
  doldu() {
    return this.kalan() === 0;
  }

  /**
   * Verilen süre bütçeye SIĞIYORSA bekler ve true döner; sığmıyorsa
   * BEKLEMEZ ve false döner. Çağıran taraf false görünce ölçümü keser ve
   * o ana kadarki sonucu raporlar — bu, "bir saat bekleyip hiçbir şey
   * üretmeme" davranışının tam karşıtıdır.
   *
   * @param {number} ms beklenmek istenen süre
   */
  async bekle(ms) {
    if (ms >= this.kalan()) return false;
    await new Promise((r) => setTimeout(r, ms));
    return true;
  }

  /** Rapor satırı. */
  satir() {
    const gecen = Math.round((Date.now() - this.basladi) / 1000);
    return `süre ${Math.floor(gecen / 60)}dk ${gecen % 60}sn / bütçe ${Math.round(this.toplam / 60000)}dk`;
  }
}

/**
 * Sonucu HEMEN diske yazar.
 *
 * NEDEN HER SENARYODAN SONRA. Betikler sonucu yalnız sonda yazıyordu; koşu
 * tavana çarpıp öldürülünce elde hiçbir ölçüm kalmıyordu. Yazma maliyeti
 * birkaç kilobayt; kaybedilen ise bir saatlik koşu.
 *
 * @param {string} dosya
 * @param {unknown} veri
 */
export function sonucYaz(dosya, veri) {
  try {
    writeFileSync(dosya, JSON.stringify(veri, null, 2));
  } catch {
    // Yazılamadıysa ölçüm yine sürsün; sonuç stdout'ta zaten var.
  }
}
