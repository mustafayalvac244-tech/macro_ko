-- HESAP SİLİNİYOR AMA YEDEKTEKİ KOPYA 12 AY KALIYORDU.
-- ---------------------------------------------------------------------------
-- BULDUĞUM HATA — VE ÖNCE BUNU SÖYLEMELİYİM: bu kusuru ben yazdım. Koşullar
-- 13. maddeye "Hesabı silme işlemi geri alınamaz ve YEDEKLENMİŞ BİR KOPYA
-- TUTULMAZ" cümlesini ben ekledim. Cümle yazıldığı anda DOĞRU DEĞİLDİ; Pro
-- planına geçilince yanlış olmadı, zaten yanlıştı. Gizlilik metnindeki
-- "Silme ... sunucudaki TÜM kayıtlarınızı kapsar" cümlesi de aynı durumda.
--
-- ÖLÇÜLEBİLİR GERÇEK (migration'lardan okundu, tahmin değil):
--   • backup.take_snapshot()  — her gece 03:15, 21 tabloyu jsonb kopyalar,
--     21 GÜN saklar.                                  (migration 0029)
--   • backup.take_monthly()   — her ayın 1'i, o günkü kopyayı alır,
--     12 AY saklar.                                   (migration 0031)
--   • backup.take_file_inventory() — belge envanteri, 21 gün. (migration 0082)
--   • public.delete_account() — yalnız `delete from auth.users` yapar.
--     Cascade public şemasını temizler; backup ŞEMASINA HİÇ DOKUNMAZ.
--                                                     (migration 0092)
--
-- Sonuç: "hesabımı sil" diyen bir avukatın müvekkil adları, dava başlıkları ve
-- finans kayıtları backup.monthly'de BİR YILA KADAR duruyordu. Kullanıcı
-- bunu bilmiyordu, çünkü metinlerimiz tersini söylüyordu.
--
-- KVKK m.7 açısından: yedekte tutma kendi başına yasak değil — ama süresi
-- sınırlı olmalı, bir amaca bağlı olmalı ve AÇIKÇA BİLDİRİLMELİ. Bizde üçü de
-- yoktu; üstüne aksi yazılıydı. Yanlış beyan, sessizliğin üstüne bir katman
-- daha ekler.
--
-- BU DOSYANIN YAPTIĞI: silme işlemi artık yedekteki kopyayı da götürür.
-- Böylece metni gerçeğe uydurmuyoruz — GERÇEĞİ metne uyduruyoruz; doğru sıra
-- budur. (Metinler de ayrıca düzeltiliyor: Supabase'in KENDİ platform yedeği
-- Pro planda 7 gün saklanıyor ve ondan tek bir kullanıcıyı ayıklayamayız; bu
-- kalan pencere artık koşullarda ve gizlilikte açıkça yazıyor.)

-- ── Kullanıcının izini yedeklerden siler ────────────────────────────────────
/**
 * NEDEN UUID METİN TARAMASI, NEDEN SÜTUN LİSTESİ DEĞİL.
 *
 * Yedek satırları `row_data jsonb` olarak duruyor; tablo başına sahiplik
 * sütunu farklı: çoğu tabloda `owner_id`, purchases/question_answers/
 * office_members'ta `user_id`, profiles'ta `id`. Elle bir eşleme yazsaydım
 * ileride eklenen bir tablo sessizce kapsam dışı kalırdı — yani bu düzeltme
 * kendi kusurunu üretirdi.
 *
 * Bunun yerine satırın METNİNDE kullanıcının UUID'si geçiyor mu diye bakıyoruz.
 * UUID 128 bitlik; başka bir anlamda tesadüfen geçmesi pratikte imkânsız.
 * Geçiyorsa satır ya kullanıcıya aittir ya da ona işaret ediyordur — iki
 * durumda da gitmesi gerekir.
 *
 * MALİYETİ ÖLÇMEDİM: bu bir sıralı tarama (jsonb → text). Bugünkü veri
 * boyutunda hızlı olması beklenir ama SÜREYİ ÖLÇMEDİM. Hesap silme nadir bir
 * işlem olduğu için bu maliyeti kabul ediyorum; yedek tablosu büyüyüp silme
 * yavaşlarsa sütun bazlı hızlı yol eklenmeli.
 */
create or replace function backup.kullaniciyi_yedeklerden_sil(p_uid uuid)
returns table(kaynak text, silinen bigint)
language plpgsql
security definer
set search_path to 'backup', 'public'
as $$
declare
  iz text;
  n bigint;
begin
  if p_uid is null then
    raise exception 'kullanıcı kimliği boş — yedek silme yapılmadı';
  end if;
  iz := '%' || p_uid::text || '%';

  delete from backup.snapshots s where s.row_data::text like iz;
  get diagnostics n = row_count;
  kaynak := 'backup.snapshots'; silinen := n; return next;

  delete from backup.monthly m where m.row_data::text like iz;
  get diagnostics n = row_count;
  kaynak := 'backup.monthly'; silinen := n; return next;

  -- Envanterde sahip ayrı bir sütun; metin taramasına gerek yok.
  delete from backup.dosya_envanteri d where d.sahip = p_uid;
  get diagnostics n = row_count;
  kaynak := 'backup.dosya_envanteri'; silinen := n; return next;
end;
$$;

comment on function backup.kullaniciyi_yedeklerden_sil(uuid) is
  'Bir kullanıcının satırlarını veritabanı içi yedeklerden (snapshots, monthly, dosya envanteri) siler. delete_account() çağırır.';

revoke all on function backup.kullaniciyi_yedeklerden_sil(uuid) from public, anon, authenticated;

-- ── delete_account: artık yedeği de temizliyor ──────────────────────────────
/**
 * SIRA ÖNEMLİ: önce yedek, sonra auth.users.
 *
 * Tersi olsaydı ve yedek silme hata verseydi, işlem geri alınırdı (ikisi aynı
 * işlem içinde) — ama hata mesajı "kullanıcı silinemedi" yerine anlamsız bir
 * yedek hatası olurdu. Önce yedeği temizleyip sonra asıl silmeyi yapmak hem
 * atomik hem de okunabilir.
 *
 * auth.uid() BİR KEZ okunup değişkene alınıyor: auth.users silindikten sonra
 * aynı çağrının tekrar aynı değeri döndüreceğine güvenmek gereksiz bir varsayım.
 */
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path to 'public', 'backup'
as $$
declare
  kim uuid := auth.uid();
begin
  if kim is null then
    raise exception 'oturum yok — silme yapılmadı';
  end if;

  -- storage.objects SİLİNMEZ: Supabase doğrudan SQL silmeyi engelliyor ve bu
  -- ifade fonksiyonun tamamını iptal ediyordu (bkz. migration 0092). Dosyalar
  -- istemcide Storage API ile, bu çağrıdan ÖNCE siliniyor.
  perform backup.kullaniciyi_yedeklerden_sil(kim);

  delete from auth.users where id = kim;
end;
$$;

revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;

-- ── Doğrulama yardımcısı ────────────────────────────────────────────────────
/**
 * Silmeden SONRA "gerçekten gitti mi?" sorusunu cevaplar. Sıfırdan farklı bir
 * sayı, silmenin eksik kaldığı anlamına gelir.
 *
 * Bu fonksiyon olmasaydı temizliğin çalıştığını ancak VARSAYABİLİRDİK; burada
 * varsaymak yeterli değil, çünkü iddia hukuki bir metinde yazılı.
 */
create or replace function backup.yedekte_iz_var_mi(p_uid uuid)
returns table(kaynak text, kalan bigint)
language sql
stable
security definer
set search_path to 'backup', 'public'
as $$
  select 'backup.snapshots', count(*) from backup.snapshots where row_data::text like '%' || p_uid::text || '%'
  union all
  select 'backup.monthly', count(*) from backup.monthly where row_data::text like '%' || p_uid::text || '%'
  union all
  select 'backup.dosya_envanteri', count(*) from backup.dosya_envanteri where sahip = p_uid;
$$;

revoke all on function backup.yedekte_iz_var_mi(uuid) from public, anon, authenticated;
