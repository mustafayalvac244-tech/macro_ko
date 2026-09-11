// ZAMAN AŞIMLI İSTEK + BÜTÇELİ GERİ ÇEKİLME
// ---------------------------------------------------------------------------
// ÖNCE BİR DÜZELTME — bu dosyanın ilk hâlinde yazdığım teşhis YANLIŞTI.
//
// 2026-09-11'de koşu 34635964721'in 51 dakika boyunca "asılı" olduğunu
// yazmıştım. Dayanağım şuydu: yeni ai_harcama_ozeti(3) fonksiyonunu 70 saniye
// arayla iki kez çağırdım, ikisinde de "3 saatte 1 istek" çıktı. Buradan
// "hiçbir AI isteği tamamlanmıyor" sonucunu çıkardım ve koşuyu İPTAL ETTİM.
//
// Koşu iptal edilince kaydı okunabilir oldu ve teşhis çürüdü. Koşu SAĞLIKLIYDI:
//     18:55-19:01  sohbet   8/10
//     19:01-19:02  künye    7/7
//     19:02-19:08  cevap   11/13
//     19:08-19:37  dilekçe 11/11   (senaryo başına 1,5-7 dakika)
//     19:37:35     mütalaa başladı
//     19:51:39     ← ben iptal ettim
// Yani mütalaa ve belge ölçümleri benim hatam yüzünden kayboldu.
//
// ÖLÇÜM ARACIM KÖRDÜ VE BUNU BİLMİYORDUM. ai_istek.user_id şöyle tanımlı:
//     references auth.users(id) on delete cascade            (0056)
// Ölçüm betikleri geçici kullanıcıyı SONDA siliyor; silinince o betiğin tüm
// ai_istek satırları da cascade ile gidiyor. Yani biten betiklerin harcaması
// geriye dönük OKUNAMIYOR. Baktığım iki anda (19:43, 19:45) koşan betik
// mütalaaydı; kullanıcısı 19:37'de açılmıştı ve ilk mütalaa henüz bitmemişti —
// sıfır satır, ama "takıldığı" için değil, YAVAŞ olduğu için.
//
// DERS: bir aracın sıfır göstermesi, ölçtüğü şeyin sıfır olduğu anlamına
// gelmez. Aracın o anda ne görebildiğini önce doğrulamak gerekir.
//
// ── PEKİ BU DOSYA NEDEN DURUYOR ────────────────────────────────────────────
// Çünkü ARAMADIĞIM ama BULDUĞUM üç kusur gerçekti ve hâlâ gerçek. Bunlar o gün
// tetiklenmedi; "tetiklenmedi" ile "yok" aynı şey değil:
//
//   1) DOKUZ ÖLÇÜM BETİĞİNİN HİÇBİRİNDE İSTEK ZAMAN AŞIMI YOKTU. Node'un
//      fetch'i kendiliğinden zaman aşımına uğramaz; ai-chat tek bir istekte
//      takılırsa betik sonsuza kadar bekler. Dilekçede tek senaryo 7 dakika
//      sürdü — asılı bir istekle sağlıklı bir istek arasında ölçümün
//      ayrım yapacak hiçbir aracı yoktu.
//
//   2) TEK BİR 429, SESSİZCE 30 DAKİKA UYUTABİLİYORDU (bekleme.mjs üst sınırı)
//      ve bu 6 denemeye kadar tekrarlanabiliyordu: tek soru 3 saat, işin
//      tavanı ise 120 dakika.
//
//   3) SONUÇ YALNIZ SONDA YAZILIYOR. İş tavana çarparsa o betiğin ölçümü
//      tamamen kaybolur. Bu, 11 Eylül'de gerçekten oldu — mütalaa 14 dakika
//      koşmuştu ve elde hiçbir şey kalmadı.
//
// Bu dosya üç şey getiriyor:
//   • istek()      — zaman aşımlı fetch. Süre dolarsa ZAMAN_ASIMI hatası atar.
//   • Butce        — betik başına duvar saati bütçesi. Geri çekilme süresi
//                    bütçeden uzunsa beklenmez; ölçüm orada kesilir ve o ana
//                    kadarki sonuç RAPORLANIR.
//   • sonucYaz()   — sonucu her senaryodan sonra diske yazar, sonda değil.
//
// Bu dosya tek başına yetmez: iş akışında her betik `timeout` ile sarılıdır.

import { writeFileSync } from 'node:fs';

/**
 * Varsayılan istek zaman aşımı (ms).
 *
 * NEDEN 450 SANİYE. Supabase Edge Function'ın duvar saati tavanı 400 sn;
 * ai-chat bundan uzun süremez, sunucu keser. Buradaki süre o tavandan
 * KISA olursa ölçüm, sunucunun bitirebileceği bir isteği kendisi keser ve
 * "model yavaş" yerine "ölçüm sabırsız" ölçülmüş olur. 2026-09-11 kaydında
 * mütalaa 14 dakikada tek senaryo bitiremedi; bunun sebebi henüz
 * ölçülmedi (tavana çarpıp yeniden mi deniyor, yoksa yavaş mı) — sebebi
 * anlamak için ölçümün ilk kesen taraf OLMAMASI gerekiyor.
 */
export const ZAMAN_ASIMI_MS = Number(process.env.EVAL_ISTEK_ZAMAN_ASIMI ?? 450000);

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
