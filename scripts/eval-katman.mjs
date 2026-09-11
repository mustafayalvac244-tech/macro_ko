// ÖLÇÜM KULLANICISININ KATMANINI AYARLAR — ortak, çünkü ayrışınca sustu.
// ---------------------------------------------------------------------------
// BULUNAN KUSUR (ölçüldü, 2026-09-11). Sekiz ölçüm betiğinin AI kullananları
// geçici bir kullanıcı açıp onunla istek atıyor. Ama:
//
//   • eval-mutalaa katmanı `ai_tier: 'pro'` diye ayarlıyordu. Katman tablosunda
//     (_shared/katman.ts) 'pro' diye bir katman YOK — 'free', 'baslangic' ve
//     'ai' var. Tanınmayan ad `table[t] ?? table.baslangic` ile sessizce
//     DENEME katmanına düşüyordu. Sonuç: mütalaa isteği
//         {"error":"tier_required","tier":"pro","required":"ai"}
//     ile reddediliyordu. Yani mütalaa HİÇ ÖLÇÜLEMİYORDU.
//
//   • Diğer beş betik (dilekce, belge, sohbet, kunye, cevap) katmanı HİÇ
//     ayarlamıyordu. Hepsi 'baslangic' olarak koşuyor ve YAŞAM BOYU 3 deneme
//     hakkıyla sınırlı kalıyordu. Üçten fazla senaryosu olan her ölçümde
//     dördüncüden sonrası
//         {"error":"deneme_hakki_bitti","tier":"baslangic","hak":3}
//     dönüyordu. Bugünkü koşuda sohbet ölçümünde tam olarak bu görüldü.
//
// YANİ: bu betiklerin ürettiği "N/M senaryo geçti" cümleleri, senaryo sayısı
// üçten büyük olduğunda EN FAZLA ÜÇ gerçek koşu üzerinden hesaplanmıştı.
// Kota hatası "kusurlu" sayıldığı için sonuç olduğundan KÖTÜ de görünüyordu;
// iki yönde birden yanıltıcıydı.
//
// Ayarlama kodunu buraya aldım çünkü kusurun sebebi tam olarak AYRIŞMAYDI:
// tek bir betikte doğru yazılmış (ama eskimiş) bir mantık, diğerlerine hiç
// taşınmamıştı.
//
// KONTÖR GEREKMİYOR: 'ai' katmanının modLimits'i var ve ai-chat kontör
// kapısını `cfg.billable && !cfg.modLimits && !cfg.denemeLimit` koşuluyla
// atlıyor (ai-chat/index.ts:1712). Yani yalnız ai_tier yetiyor.

/**
 * Geçici ölçüm kullanıcısını ücretli katmana alır.
 *
 * Profil satırı `handle_new_user` tetikleyicisiyle zaten açılmış olmalı; yine
 * de yoksa upsert ile kurulur (tetikleyici bir gün değişirse ölçüm sessizce
 * yanlış katmanda koşmasın).
 *
 * @param {string} url  Supabase proje adresi
 * @param {string} svc  service_role anahtarı
 * @param {string} uid  kullanıcı kimliği
 * @param {string} [katman='ai']  hedef katman (_shared/katman.ts'teki adlar)
 */
export async function katmanAyarla(url, svc, uid, katman = 'ai') {
  const baslik = { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json' };

  const yama = await fetch(`${url}/rest/v1/profiles?id=eq.${uid}&select=id,ai_tier`, {
    method: 'PATCH',
    headers: { ...baslik, Prefer: 'return=representation' },
    body: JSON.stringify({ ai_tier: katman }),
  });
  if (yama.ok) {
    const satir = await yama.json();
    if (Array.isArray(satir) && satir.length > 0) return satir[0].ai_tier;
  }

  const ekle = await fetch(`${url}/rest/v1/profiles?select=id,ai_tier`, {
    method: 'POST',
    headers: { ...baslik, Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ id: uid, ai_tier: katman }),
  });
  if (!ekle.ok) {
    // SESSİZ GEÇME: katman ayarlanamazsa ölçüm deneme katmanında koşar ve
    // sonuç "kalite" değil "kota" ölçer. Bu, tam olarak düzeltilen kusurdur.
    throw new Error(`katman ayarlanamadı (${ekle.status}): ${(await ekle.text()).slice(0, 200)}`);
  }
  const satir = await ekle.json();
  return Array.isArray(satir) && satir.length > 0 ? satir[0].ai_tier : katman;
}
