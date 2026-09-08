-- 399 ₺'LİK PLANA GERÇEK KARŞILIK: SUNUCUDA UYGULANAN PLAN LİMİTLERİ.
--
-- BULUNAN DURUM (ölçüldü). is_premium uygulamada HİÇBİR ŞEYİ açmıyordu:
-- arandığında yalnız avatara rozet koyduğu ve admin panelinde göründüğü çıktı.
-- Deneme bitince de uygulama kilitlenmiyor, panoda bir hatırlatma çıkıyordu.
-- Yani abonelik satılıyor ama karşılığında hiçbir şey verilmiyordu. Bu hem
-- App Store Review 3.1.2 açısından ret sebebi hem de basitçe doğru değil.
--
-- ÜRÜN KARARI (kullanıcının): içtihat ÜCRETSİZ kalır, yapay zekâ ücretlidir,
-- 399 ₺'lik Pro planının da gerçek bir karşılığı olur.
--
-- NEDEN SUNUCUDA. Bu oturumda iki kez kanıtlandı ki istemcideki kilit sahtedir:
-- premium durumu AsyncStorage'dan da okunuyordu (kaldırıldı) ve kolon düzeyi
-- REVOKE, tablo düzeyi GRANT'i geçersiz kılmıyordu. Limit istemcide sayılırsa
-- doğrudan REST'e istek atan biri sınırsız kayıt açar. Bu yüzden sayım ve red
-- veritabanında, BEFORE INSERT tetikleyicisinde.
--
-- MEVCUT VERİYE DOKUNULMAZ. Tetikleyici yalnız YENİ kayıt eklemeyi engeller;
-- hiçbir satır silinmez, gizlenmez, salt-okunur olmaz. Bugün 30 davası olan
-- bir kullanıcı 30 davasını da görmeye ve düzenlemeye devam eder, yalnız 31.
-- davayı Pro'ya geçmeden açamaz. (Ölçüm: en çok dava 30, en çok müvekkil 39,
-- en çok belge 2 — dört hesapta ve bunların çoğu test hesabı.)
--
-- İÇTİHAT, MEVZUAT, HESAPLAYICI, AJANDA, DURUŞMA VE GÖREV BİLİNÇLİ OLARAK
-- SINIRSIZ. İçtihat kullanıcının açık talebiyle ücretsiz; ajanda/duruşma ise
-- uygulamanın çekirdek faydası — bir avukatın duruşma takvimini kilitlemek,
-- ürünü kullanılamaz hâle getirir ve ücretsiz katmanı bir tuzağa çevirir.

-- Ücretsiz katman sınırları. Tek yerde durur ki ürün kararı değişince
-- tek satır güncellensin (istemcideki karşılığı: src/config/planlar.ts).
create or replace function public.ucretsiz_limit(p_tur text)
returns integer
language sql
immutable
as $$
  select case p_tur
    when 'dava'     then 5
    when 'muvekkil' then 10
    when 'belge'    then 5
    when 'finans'   then 0   -- 0 = özellik ücretsiz katmanda tamamen kapalı
    else null                -- null = sınırsız
  end
$$;

/**
 * Bir kaydın plan limitini aşıp aşmadığını denetler.
 *
 * Premium ya da AI aboneleri sınırsızdır. Ücretsiz kullanıcıda, EKLEMEDEN
 * ÖNCEKİ satır sayısı limite eşit ya da büyükse istek reddedilir.
 *
 * Hata mesajı 'plan_limiti:<tür>:<limit>' biçiminde: istemci bunu ayrıştırıp
 * kullanıcıya "5 dava hakkınız doldu, Pro'ya geçin" diyebilsin diye. Serbest
 * metin bir hata, ekranda ham İngilizce Postgres çıktısı gösterirdi.
 */
create or replace function public.plan_limiti_kontrol()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_tur text := tg_argv[0];
  v_limit integer := public.ucretsiz_limit(v_tur);
  v_premium boolean;
  v_ai text;
  v_adet bigint;
begin
  if v_limit is null then
    return new;  -- sınırsız
  end if;

  select coalesce(p.is_premium, false), p.ai_tier
    into v_premium, v_ai
  from public.profiles p
  where p.id = new.owner_id;

  -- Pro ya da AI abonesi: sınır yok.
  if coalesce(v_premium, false) or coalesce(v_ai, 'free') not in ('free', 'baslangic') then
    return new;
  end if;

  -- Özellik ücretsiz katmanda tamamen kapalıysa saymaya gerek yok.
  if v_limit = 0 then
    raise exception 'plan_limiti:%:0', v_tur using errcode = 'check_violation';
  end if;

  execute format('select count(*) from public.%I where owner_id = $1', tg_table_name)
    into v_adet
    using new.owner_id;

  if v_adet >= v_limit then
    raise exception 'plan_limiti:%:%', v_tur, v_limit using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function public.plan_limiti_kontrol() from public, anon, authenticated;
revoke all on function public.ucretsiz_limit(text) from public, anon, authenticated;
grant execute on function public.ucretsiz_limit(text) to authenticated, service_role;

drop trigger if exists trg_plan_limiti on public.cases;
create trigger trg_plan_limiti before insert on public.cases
  for each row execute function public.plan_limiti_kontrol('dava');

drop trigger if exists trg_plan_limiti on public.clients;
create trigger trg_plan_limiti before insert on public.clients
  for each row execute function public.plan_limiti_kontrol('muvekkil');

drop trigger if exists trg_plan_limiti on public.documents;
create trigger trg_plan_limiti before insert on public.documents
  for each row execute function public.plan_limiti_kontrol('belge');

drop trigger if exists trg_plan_limiti on public.finance_entries;
create trigger trg_plan_limiti before insert on public.finance_entries
  for each row execute function public.plan_limiti_kontrol('finans');
