-- 25.09.2026 — yayın öncesi güvenlik taraması (Supabase advisor + canlı ölçüm).
--
-- ÜÇ DÜZELTME, hepsi ölçülerek bulundu:
--
-- 1) Bize ait beş SECURITY DEFINER fonksiyon `anon` (oturumsuz) rolüyle
--    çağrılabiliyordu: admin_ai_ozeti, is_office_member, kvkk_onay_kaydet,
--    kvkk_riza_var_mi, time_entries_dosya_sahibi. Gövdeleri okundu: hepsi
--    auth.uid() ile korunuyor, yani bugün veri sızdırmıyorlar. Yine de
--    oturumsuz çağrının hiçbir gerekçesi yok; kapatılıyor. `authenticated`
--    korunuyor — is_office_member RLS politikalarında, kvkk_riza_var_mi
--    uygulamada çağrılıyor.
--    Aynı listedeki aile_* ve ilac_sayac_* fonksiyonları BAŞKA ürünün
--    (eczane); AGENTS.md kuralı gereği dokunulmuyor, ürün sahibine raporlandı.
--
-- 2) Altı fonksiyonda search_path sabitlenmemişti (advisor: function_search_path
--    mutable). İmza tahmin edilmiyor; pg_proc'tan oid ile bulunuyor.
--
-- 3) profiles.hourly_rate (0131) eklendi ama 0024'ün sütun düzeyi yetki
--    modeline UPDATE eklenmedi. Canlıda ölçüldü: authenticated için
--    hourly_rate üzerinde yalnız INSERT var. Yani useUpdateHourlyRate'in
--    `update profiles set hourly_rate` çağrısı "permission denied" alıyor —
--    saat ücreti kaydedilemiyor. SELECT bilerek verilmiyor: profil my_profile()
--    ile okunuyor ve geniş "readable by authenticated" politikası yüzünden
--    SELECT yetkisi herkesin ücretini herkese açardı.
--
-- CI boş veritabanında yalnız değişen göçü oynattığı için her adım varlık
-- kontrolüyle sarılı.

do $$
declare
  f record;
begin
  -- (1) anon'dan geri al
  for f in
    select p.oid::regprocedure as imza
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('admin_ai_ozeti', 'is_office_member', 'kvkk_onay_kaydet',
                        'kvkk_riza_var_mi', 'time_entries_dosya_sahibi')
  loop
    execute format('revoke execute on function %s from anon, public', f.imza);
  end loop;

  -- (2) search_path sabitle
  for f in
    select p.oid::regprocedure as imza
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('set_updated_at', 'gen_friend_code', 'servis_yetki_kontrol',
                        'ucretsiz_limit', 'tr_kucult', 'karar_atfi_sade')
  loop
    execute format('alter function %s set search_path = public', f.imza);
  end loop;

  -- (3) saat ücreti güncellenebilsin
  if to_regclass('public.profiles') is not null
     and exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'profiles' and column_name = 'hourly_rate') then
    grant update (hourly_rate) on public.profiles to authenticated;
  end if;
end $$;
