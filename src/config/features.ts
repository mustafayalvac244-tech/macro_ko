// Özellik bayrakları.
//
// NEDEN ARTIK TEK BAYRAK DEĞİL. Eskiden tek bir AI_ENABLED vardı ve sekiz
// ekranı birlikte açıp kapatıyordu. Bu, "aç" ile "kapat" arasında üçüncü bir
// seçenek bırakmıyordu; oysa özelliklerin hazırlık düzeyi AYNI DEĞİL:
//
//   • DİLEKÇE ve BELGE İNCELEME ölçüldü ve çalışıyor. Dilekçede on senaryonun
//     onu da geçti (tek koşuda hepsi birden değil — ücretsiz modellerin koşudan
//     koşuya değişkenliği yüzünden tek koşunun oranı güvenilir değil), belge
//     incelemesinde üç senaryonun üçü geçti.
//   • MÜTALAA kapalı: ücretsiz modeller mütalaada kanun uyduruyordu ve özellik
//     uçta da Claude'a kilitli (ANTHROPIC_API_KEY gelene kadar 503 döner).
//     Açmak, kullanıcıya bozuk bir ekran göstermek olurdu.
//   • SOHBET, İÇTİHAT ANALİZİ, DOSYA AKTARMA ve SAVAŞ PLANI hiç ölçülmedi.
//     Ölçülmemiş özelliği açmak, kalitesini kullanıcıyla sınamaktır.
//
// Bayrakları ayırmak, ölçülmüş olanı ölçülmemişi beklemeden yayınlamayı
// mümkün kılıyor.
//
// ÜCRETSİZ KOTA ORTAKTIR: sağlayıcının günlük tavanı TÜM kullanıcılar için
// tek havuz (bkz. _shared/kullanim.ts). Günlük adil kullanım sınırı uçta
// uygulanıyor; havuz bittiğinde kullanıcı "kota doldu, şu kadar sonra tekrar
// deneyin" mesajı görür — sessiz bir arıza değil.

/** Dilekçe üretimi — ölçüldü, açık. */
export const AI_DILEKCE_ENABLED = true;

/** Belge inceleme — ölçüldü, açık. */
export const AI_BELGE_ENABLED = true;

/** Hukuki mütalaa — Claude anahtarı gelene kadar kapalı (uçta da kilitli). */
export const AI_MUTALAA_ENABLED = false;

/**
 * UYAP belgesinden dosya aktarma — ÖLÇÜLDÜ ama henüz açılmadı.
 *
 * Yedi senaryoluk ölçüm kuruldu (scripts/kunye-senaryolari.json): 7/7 temiz,
 * 20 alanın 20'si doğru, SIFIR uydurma, sıfır tuzak. İstem sunucuya taşındı ve
 * belgede karşılığı olmayan alan artık atılıyor.
 *
 * Açma kararı ürün kararıdır ve size ait: özellik gerçek kullanıcıya hiç
 * gitmedi (sıfır kayıt) ve ölçüm seti yedi senaryo — ince. true yapıp OTA
 * göndermek yeterli.
 */
export const AI_AKTARMA_ENABLED = false;

/**
 * Ölçülmemiş AI özellikleri: sohbet, içtihat analizi, savaş planı. Eski
 * AI_ENABLED bayrağının yerini tutar; adı KORUNDU çünkü birçok ekranda
 * kullanılıyor ve hepsini birden değiştirmek, açılmaması gereken ekranları
 * sessizce açma riski taşırdı.
 */
export const AI_ENABLED = false;
