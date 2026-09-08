-- KAYIT BİLGİLERİ ARTIK TETİKLEYİCİDEN YAZILIYOR (e-posta doğrulamasının önkoşulu).
--
-- SORUN. handle_new_user yalnız full_name'i kopyalıyordu. Avukatın TC, baro,
-- sicil ve büro bilgisi, kayıttan SONRA istemciden ayrı bir UPDATE ile
-- yazılıyordu (authStore.signUp). Bu, oturum açık olmasına bağlıydı ve bugün
-- yalnızca e-posta doğrulaması KAPALI olduğu için çalışıyordu: autoconfirm
-- sayesinde signUp anında bir oturum dönüyor.
--
-- E-posta doğrulaması açıldığı an signUp oturum DÖNDÜRMEZ. O UPDATE kimliksiz
-- gider, RLS onu sessizce süzer ve avukatın TC/baro/sicil bilgisi HİÇBİR UYARI
-- OLMADAN kaybolur — kayıt yine "başarılı" görünür. Yani doğrulamayı açmak,
-- düzeltilmeden önce veri kaybı üretirdi.
--
-- ÇÖZÜM. Alanlar signUp'ın options.data'sıyla kullanıcı üstverisine konur ve
-- bu tetikleyici profili oluştururken onları da yazar. Böylece oturum olsun ya
-- da olmasın veri yerine ulaşır; istemcideki ikinci istek tamamen kalkar.
--
-- GÜVENLİK. raw_user_meta_data kullanıcının kontrolündedir, bu yüzden buradan
-- YALNIZ bu beş alan okunur. is_premium, ai_tier ve is_admin bilinçli olarak
-- DIŞARIDA bırakıldı — aksi hâlde kayıt ekranından kendine premium yazan biri
-- 0076'daki korumayı baştan atlatırdı. Alanlar ayrıca uzunlukla sınırlanır ve
-- TC yalnız 11 hane rakamsa kabul edilir; şişirilmiş bir üstveriyle profil
-- tablosunu büyütmek de bir saldırı yüzeyidir.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_tc text := nullif(trim(coalesce(m ->> 'tc_no', '')), '');
begin
  -- TC yalnız tam 11 hanelik rakam dizisiyse saklanır; değilse hiç yazılmaz.
  if v_tc is not null and v_tc !~ '^[0-9]{11}$' then
    v_tc := null;
  end if;

  insert into public.profiles (id, email, full_name, firm_name, tc_no, baro, bar_number)
  values (
    new.id,
    coalesce(new.email, ''),
    left(coalesce(m ->> 'full_name', ''), 120),
    nullif(left(trim(coalesce(m ->> 'firm_name', '')), 160), ''),
    v_tc,
    nullif(left(trim(coalesce(m ->> 'baro', '')), 60), ''),
    nullif(left(trim(coalesce(m ->> 'bar_number', '')), 30), '')
  );
  return new;
end;
$$;
