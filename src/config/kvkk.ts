// KVKK — TEK KAYNAK.
// ---------------------------------------------------------------------------
// NEDEN BU DOSYA VAR. Aydınlatma metni, açık rıza metni, gizlilik sayfası ve
// kullanım koşulları aynı olguları anlatıyor: veriyi kim işliyor, kime
// aktarılıyor, hangi ülkeye. Bunlar dört ayrı yerde elle yazılırsa er ya da
// geç ayrışır — nitekim AYRIŞTI: kullanım koşulları "verileriniz İrlanda/AB
// sunucularında" derken gizlilik metni "hiçbir veri kimseyle paylaşılmaz"
// diyordu, oysa yapay zekâ özellikleri kullanıcının yazdığı dava metnini
// ABD merkezli sağlayıcılara gönderiyordu. Artık tek yerden okunuyor.
//
// ⚠️ DOLDURULMASI GEREKEN ALANLAR AŞAĞIDA `null`. Bunlar uydurulamaz:
// KVKK m.10 veri sorumlusunun KİMLİĞİNİ zorunlu kılar ve yanlış kimlik
// bildirmek, hiç bildirmemekten daha kötüdür. Alan `null` kaldığı sürece
// aydınlatma metni o satırı YAZMAZ, yerine eksik olduğunu söyler.

/** Aydınlatma/rıza metinlerinin sürümü. Metin değişirse ARTIR. */
export const KVKK_SURUM = '2026-09-1';

export interface VeriSorumlusu {
  /** Ticari unvan ya da avukatın/büronun adı. */
  unvan: string | null;
  /** Açık adres (KVKK başvurusu yazılı da yapılabilmeli). */
  adres: string | null;
  /** Başvuru e-postası. Bu kutunun GERÇEKTEN çalışıyor olması şart. */
  eposta: string | null;
  /** Kayıtlı elektronik posta (varsa). */
  kep: string | null;
  /** MERSİS numarası (tüzel kişilik varsa). */
  mersis: string | null;
  /** VERBİS kayıt numarası (kayıt yükümlülüğü doğduysa). */
  verbis: string | null;
}

/**
 * ⚠️ EKSİK. Bu alanları uygulamayı işleten kişi/şirket doldurmalı.
 *
 * `eposta` için önerilen: kvkk@vekilpro.app — ama bu kutu alan adında
 * GERÇEKTEN açılmalı. Ulaşılamayan bir başvuru adresi bildirmek, KVKK m.13
 * başvuru hakkını fiilen engellemek demektir.
 */
export const VERI_SORUMLUSU: VeriSorumlusu = {
  unvan: null,
  adres: null,
  eposta: null,
  kep: null,
  mersis: null,
  verbis: null,
};

/** Kimlik bilgisi tamam mı? Metin buna göre dürüst davranıyor. */
export function kimlikTamMi(v: VeriSorumlusu = VERI_SORUMLUSU): boolean {
  return Boolean(v.unvan && v.adres && v.eposta);
}

export interface Alici {
  ad: string;
  ulke: string;
  amac: string;
}

/**
 * VERİNİN GİTTİĞİ YERLER — koddan okunarak yazıldı, tahminle değil.
 *
 * Kaynaklar:
 *   supabase/functions/ai-chat/index.ts  → GROQ_API_KEY, GEMINI_API_KEY,
 *     OPENAI_API_KEY, ANTHROPIC_API_KEY yollarının dördü de mevcut.
 *   supabase/functions/ai-saglik/index.ts → api.anthropic.com
 *   supabase/functions/ictihat/index.ts   → aynı sağlayıcı katmanı
 *
 * DÜRÜST NOT: hangi sağlayıcının canlıda anahtarı tanımlı olduğunu koddan
 * göremiyorum (secret'lar sunucuda). Bu yüzden metin, kodun ulaşabildiği
 * TÜM sağlayıcıları sayıyor. Aydınlatmada fazlasını saymak eksik saymaktan
 * güvenlidir: kullanıcı olabilecek en geniş aktarımı bilerek onay verir.
 */
export const ALICILAR: Alici[] = [
  {
    ad: 'Supabase (veritabanı ve dosya saklama)',
    ulke: 'Avrupa Birliği — İrlanda (ÖLÇÜLDÜ: Supabase proje bölgesi eu-west-1)',
    amac: 'Hesap, dava, müvekkil, belge ve finans kayıtlarının saklanması',
  },
  {
    ad: 'Anthropic',
    ulke: 'Amerika Birleşik Devletleri',
    amac: 'Yapay zekâ ile dilekçe, mütalaa, belge incelemesi ve soru yanıtı üretimi',
  },
  {
    ad: 'Google (Gemini)',
    ulke: 'Amerika Birleşik Devletleri',
    amac: 'Aynı yapay zekâ işlevleri için yedek/alternatif model',
  },
  {
    ad: 'Groq',
    ulke: 'Amerika Birleşik Devletleri',
    amac: 'Aynı yapay zekâ işlevleri için hızlı model katmanı',
  },
  {
    ad: 'OpenAI',
    ulke: 'Amerika Birleşik Devletleri',
    amac: 'Aynı yapay zekâ işlevleri için yedek model katmanı',
  },
  {
    ad: 'Apple App Store / Google Play / RevenueCat',
    ulke: 'Amerika Birleşik Devletleri',
    amac: 'Abonelik satın alma ve doğrulama',
  },
];

/**
 * Yapay zekâya GİTMEYEN veriler — kullanıcının bilmesi gereken ayrım.
 * Yalnız kullanıcının o istekte yazdığı/ilettiği metin gönderilir; veritabanı
 * kendiliğinden taranıp gönderilmez.
 */
export const AI_KAPSAM_DISI = [
  'Parolanız (hiçbir zaman düz metin olarak saklanmaz ya da iletilmez)',
  'Finans kayıtlarınız ve ödeme bilgileriniz',
  'Yapay zekâ isteğine kendiniz eklemediğiniz dava, müvekkil ve belge kayıtları',
];
