-- Migration'lardan SONRA tutması gereken yetki değişmezleri.
-- Beklenen değer parantez içinde; sapma varsa bir güvenlik gerilemesidir.
select 'profiles.son_gorulme UPDATE (false)', has_column_privilege('authenticated','public.profiles','son_gorulme','UPDATE')::text;
select 'profiles.is_premium  UPDATE (false)', has_column_privilege('authenticated','public.profiles','is_premium','UPDATE')::text;
select 'profiles.is_admin    UPDATE (false)', has_column_privilege('authenticated','public.profiles','is_admin','UPDATE')::text;
select 'profiles.full_name   UPDATE (true)',  has_column_privilege('authenticated','public.profiles','full_name','UPDATE')::text;
select 'profiles.avatar_url  UPDATE (true)',  has_column_privilege('authenticated','public.profiles','avatar_url','UPDATE')::text;
select 'oturum_cihazlari SELECT (true)',      has_table_privilege('authenticated','public.oturum_cihazlari','SELECT')::text;
select 'oturum_cihazlari DELETE (false)',     has_table_privilege('authenticated','public.oturum_cihazlari','DELETE')::text;
select 'oturum_cihazlari anon SELECT (false)',has_table_privilege('anon','public.oturum_cihazlari','SELECT')::text;
select 'admin_islem_log SELECT (false)',      has_table_privilege('authenticated','public.admin_islem_log','SELECT')::text;
select 'admin_recent_users PUBLIC (false)',   has_function_privilege('public','public.admin_recent_users(integer)','EXECUTE')::text;
select 'admin_recent_users authenticated (true)', has_function_privilege('authenticated','public.admin_recent_users(integer)','EXECUTE')::text;
select 'admin_log_yaz authenticated (false)',  has_function_privilege('authenticated','public.admin_log_yaz(text,uuid,jsonb)','EXECUTE')::text;
select 'cihaz_bildir anon (false)',            has_function_privilege('anon','public.cihaz_bildir(text,text,text,text)','EXECUTE')::text;
