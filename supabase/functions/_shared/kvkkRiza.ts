// KVKK AÇIK RIZA KAPISI — yurt dışına aktarımdan ÖNCE sorulur.
// ---------------------------------------------------------------------------
// NEDEN VAR. Yapay zekâ uçları, kullanıcının yazdığı metni ABD merkezli
// sağlayıcılara gönderiyor. Bu bir yurt dışına aktarımdır (6698 s.K. m.9) ve
// üç ayrı metnimiz kullanıcıya "bu aktarım AÇIK RIZANIZA bağlıdır" diyor:
// aydınlatma metni, gizlilik sayfası ve kullanım koşulları.
//
// 12.09.2026'da ÖLÇÜLDÜ (scripts/kvkk-durum.sql): 21 hesabın 21'inde rıza
// kaydı YOKTU ve 6'sı son 30 günde yapay zekâ kullanmıştı. Yani o güne kadar
// yapılan aktarımların TAMAMI kayıtlı rıza olmadan yapılmıştı ve üç metin de
// bu noktada gerçeği anlatmıyordu. Bu dosya o boşluğu kapatıyor.
//
// FAIL-CLOSED — VE NEDEN. Kayıt okunamazsa (veritabanı hatası) kapı KAPALI
// kabul ediliyor. İki yanlış seçenekten daha az kötü olanı bu:
//   • Açık bırakmak → rızası olup olmadığını bilmediğimiz birinin dava metnini
//     yurt dışına göndeririz. Geri alınamaz.
//   • Kapalı tutmak → kullanıcı bir süre yapay zekâyı kullanamaz.
// Üstelik bu sorgu, isteğin geri kalanının zaten muhtaç olduğu veritabanına
// gidiyor: o veritabanı çalışmıyorsa istek nasılsa tamamlanamaz. Yani pratikte
// "erişilebilirlik" diye kaybedilen bir şey yok.
//
// KAPSAM DIŞI olması gerekenler (bilerek çağrılmıyor):
//   • ai-saglik  → sabit yoklama metni gönderir, kullanıcı verisi taşımaz;
//                  ayrıca arıza teşhisi için her hâlükârda çalışmalı.
//   • ictihat/search, /document, /kunye → sorgu Türkiye'deki kaynaklara ve
//                  kendi veritabanımıza gider, yurt dışına aktarım yoktur.
//   • ai-chat 'iade' modu → yalnız veritabanı yazar. Rızasını GERİ ALMIŞ biri
//                  de hakkını iade edebilmeli; iadeyi rızaya bağlamak, rızayı
//                  geri almayı cezalandırmak olurdu.

/** Rıza verilmemiş — kural gereği kapalı. Kullanıcı imzalayınca açılır. */
export const RIZA_YOK_KODU = 'kvkk_riza_yok';

/**
 * Rıza SORGULANAMADI — kapı yine kapalı ama sebep bambaşka.
 *
 * NEDEN AYRI KOD. İkisini tek koda bağlamak, bozuk bir ölçüm aletini geçerli
 * bir ölçüm gibi göstermek olurdu: kullanıcıya "rıza vermemişsiniz" der,
 * kullanıcı gider imzalar, yine açılmaz ve kimse nedenini anlamaz. Bu projede
 * tam olarak bu sınıftan bir hata (süzgeçsiz rapor sorgusu) üç tur boyunca var
 * olmayan bir sorunun peşinde koşturmuştu. Bozukluk, bozukluk olarak görünsün.
 */
export const RIZA_KONTROL_HATASI = 'kvkk_kontrol_hatasi';

interface RpcIstemci {
  rpc(fn: string, args?: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
}

/**
 * Kullanıcının yurt dışı aktarım rızası var mı?
 *
 * Karar SQL tarafında: `kvkk_riza_var_mi()` en son satıra bakar (günlük
 * eklemeli olduğu için "şu anki durum" budur) ve `security definer` olduğu
 * için çağıranın kimliğini `auth.uid()` üzerinden kendisi bulur. Mantığı
 * TypeScript'e kopyalasaydık iki yerde iki farklı "en son satır" tanımı
 * oluşurdu; bir kez değişip diğeri kalsaydı kimse fark etmezdi.
 */
export async function rizaVarMi(db: RpcIstemci, tur = 'yurtdisi_ai'): Promise<'var' | 'yok' | 'okunamadi'> {
  const { data, error } = await db.rpc('kvkk_riza_var_mi', { p_tur: tur });
  if (error) return 'okunamadi'; // kapı yine kapalı; ama sebebi saklanmıyor
  return data === true ? 'var' : 'yok';
}

/**
 * Kapı. Rıza varsa `null` döner ve çağıran devam eder; yoksa hazır 403 yanıtı
 * döner.
 *
 * Yanıt İSTEMCİYE NE YAPACAĞINI SÖYLER (`nereye` alanı): "yetkiniz yok" deyip
 * kullanıcıyı ekranda bırakmak, bu projede daha önce "basıyorum bir şey
 * olmuyor" şikâyetine yol açan sessiz kilidin aynısı olurdu.
 */
export async function rizaKapisi(
  db: RpcIstemci,
  cors: Record<string, string>,
  tur = 'yurtdisi_ai',
): Promise<Response | null> {
  const durum = await rizaVarMi(db, tur);
  if (durum === 'var') return null;

  // Sorgu hiç koşamadıysa bu bizim arızamızdır, kullanıcının eksiği değil:
  // 503 ("bizde sorun var") döner, 403 ("izniniz yok") değil. Kullanıcıyı
  // boşuna imza ekranına yollamayız.
  if (durum === 'okunamadi') {
    return new Response(
      JSON.stringify({ error: RIZA_KONTROL_HATASI }),
      { status: 503, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }

  return new Response(
    JSON.stringify({
      error: RIZA_YOK_KODU,
      // İstemci bu yolu doğrudan açabiliyor; metin istemci tarafında
      // yerelleştiriliyor (src/lib/aiHata.ts).
      nereye: '/kvkk',
    }),
    { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } },
  );
}
