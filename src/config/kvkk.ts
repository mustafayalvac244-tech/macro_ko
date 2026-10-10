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

/**
 * Aydınlatma/rıza metinlerinin sürümü. Metin değişirse ARTIR.
 *
 * 2026-09-3 (14.09.2026): Metne "7. Meslektaş Panosu — diğer avukatlara ne
 * görünür" başlığı eklendi ve sonraki başlıklar 8-14'e kaydı. Bu ÖZDE bir
 * değişiklik: yeni bir alıcı grubu (diğer kullanıcılar) açıklanıyor. Sürümü
 * artırmasaydık, eski metne verilmiş rıza yeni metne verilmiş gibi görünürdü
 * — yani kullanıcı hiç okumadığı bir açıklamaya rıza vermiş sayılırdı.
 *
 * 2026-10-1 (10.10.2026 denetimi): 14.09'dan beri metin özde değişmişti ama
 * sürüm artırılmamıştı (18.09 veri kategorileri, 25.09 Tevkil bölümünün
 * kalkması ve T.C. alanının isteğe bağlı olması). Bu sürümde ayrıca: kayıt
 * kaynağı ve bildirim adresi kategorileri, alıcı olarak Expo / Resend /
 * Bedesten ve Duruşma Brifi istisnası eklendi, "şifreli alanda oturum" iddiası
 * düzeltildi. tests/kvkkMetinKapsami.test.ts alıcı listesi değişince sürümün
 * de değişmesini zorlar.
 */
export const KVKK_SURUM = '2026-10-1';

/**
 * ⚠️ ÇÖZÜLMESİ GEREKEN ÇELİŞKİ — kayıt, rıza olmadan tamamlanabilsin mi?
 *
 * `true`  → kayıt ekranı rıza olmadan hesap açtırmaz (bugünkü davranış; ürün
 *           sahibinin açık tercihi).
 * `false` → hesap açılır, YALNIZ yapay zekâ özellikleri kapalı kalır.
 *
 * DÜRÜST TESPİT: `true` iken açık rıza fiilen HİZMETİN ŞARTI hâline gelir.
 * Kanun'un 5/1 anlamında rızanın "özgür iradeyle" verilmiş sayılabilmesi için
 * vermemenin hizmete erişimi engellememesi beklenir; Kurul kararlarında
 * tekrarlanan ölçüt budur. Bu yüzden aydınlatma metni, bayrak `true` olduğu
 * sürece durumu OLDUĞU GİBİ yazar — "şartı değildir" diye yanlış beyanda
 * bulunmaz (bkz. src/components/KvkkMetin.tsx, 5. ve 13. başlıklar).
 *
 * 12.09.2026'da `false` YAPILDI. Gerekçe: bayrağı `true` tutan tek teknik
 * sebep, yapay zekâ uçlarının rıza denetlememesiydi — rızasız kaydolan biri
 * yine de metnini yurt dışına gönderebilirdi. O boşluk kapandı: uçlar artık
 * rıza soruyor (supabase/functions/_shared/kvkkRiza.ts, canlıda dağıtıldı).
 *
 * Böylece üç şey birden düzeldi:
 *   • Rıza, hizmete erişimin şartı olmaktan çıktı — Kanun'un aradığı ölçüt.
 *   • Aydınlatma metni kendi uygulamamızı eleştiren paragrafı taşımıyor;
 *     "şartı değildir" cümlesi artık DOĞRU olduğu için yazılabiliyor.
 *   • Ana sayfadaki "KVKK uyumlu" ifadesiyle metin çelişmiyor.
 *
 * Rıza vermeyen avukat hesabını açar; yalnız yapay zekâ özellikleri kapalı
 * kalır ve nedenini ekranda, gidilecek yerle birlikte görür.
 */
export const RIZA_ZORUNLU = false;

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
  // 10.10.2026 denetimiyle eklenen üç alıcı — koddan ve ölçümden:
  {
    ad: 'Expo (bildirim servisi)',
    ulke: 'Amerika Birleşik Devletleri',
    amac: 'Bildirim izni verirseniz cihazınızın bildirim adresi (push token) ve yöneticinin yazdığı duyuru metni, bildirimin telefonunuza ulaşması için bu servisten geçer',
  },
  {
    ad: 'Resend (e-posta gönderimi)',
    ulke: 'Amerika Birleşik Devletleri',
    amac: 'Hesap doğrulama ve şifre sıfırlama e-postalarının gönderilmesi: e-posta adresiniz ve e-postanın içeriği',
  },
  {
    ad: 'Adalet Bakanlığı Bedesten (içtihat arama)',
    ulke: 'Türkiye',
    amac: 'İçtihat ekranında ve yapay zekâ sorularında emsal karar bulmak için yazdığınız arama ifadesi ya da soru (noktalama işaretleri ayıklanmış olarak) bu kamu servisine arama terimi olarak gönderilir',
  },
  // CLOUDFLARE TURNSTILE bilerek YOK: 04.10.2026'da site anahtarı derlemede
  // yoktu (KARAR-DEFTERI), Captcha bileşeni çizilmiyor, Cloudflare'a istek
  // gitmiyor. Anahtar derlemeye girerse buraya EKLE — tests/kvkkMetinKapsami
  // eas.json ve iş akışlarında TURNSTILE_SITE_KEY görünce bunu zorlar.
];

/**
 * Yapay zekâya GİTMEYEN veriler — kullanıcının bilmesi gereken ayrım.
 * Yalnız kullanıcının o istekte yazdığı/ilettiği metin gönderilir; veritabanı
 * kendiliğinden taranıp gönderilmez.
 */
export const AI_KAPSAM_DISI = [
  'Parolanız (hiçbir zaman düz metin olarak saklanmaz ya da iletilmez)',
  'Finans kayıtlarınız ve ödeme bilgileriniz',
  'Yapay zekâ isteğine kendiniz eklemediğiniz dava, müvekkil ve belge kayıtları (tek istisna: Duruşma Brifi düğmesi — aşağıdaki nota bakınız)',
];

export const AI_KAPSAM_DISI_EN = [
  'Your password (never stored or transmitted as plain text)',
  'Your finance records and payment details',
  'Case, client and document records you did not yourself attach to an AI request (single exception: the hearing-brief button — see the note below)',
];

/**
 * DURUŞMA BRİFİ İSTİSNASI — src/utils/briefEngine.ts > generateAiBrief okunarak
 * yazıldı. Brif düğmesine basıldığında yapay zekâ isteği kullanıcı tarafından
 * yazılmaz: uygulama, dava kaydından mahkeme adı, dava türü, konu/açıklama
 * (yoksa dava başlığı) ve taraf adlarını isteğe KENDİSİ ekler.
 * (Müvekkil adının maskelenmesi ayrı bir düzeltmede; metin "taraf adları"
 * diyerek her iki durumda da doğru kalır.)
 */
export const BRIF_ISTISNASI_TR =
  'İSTİSNA — DURUŞMA BRİFİ: dava ekranında Duruşma Brifi üret düğmesine bastığınızda, yazmadığınız hâlde o dava kaydından mahkeme adı, dava türü, konu/açıklama (yoksa dava başlığı) ve taraf adları isteğe uygulama tarafından eklenir ve yapay zekâ sağlayıcısına gönderilir.';
export const BRIF_ISTISNASI_EN =
  'EXCEPTION — HEARING BRIEF: when you tap the hearing-brief button on a case, the app itself adds fields from that case record (court name, case type, subject/description or case title, and party names) to the AI request, even though you did not type them, and sends them to the AI provider.';
