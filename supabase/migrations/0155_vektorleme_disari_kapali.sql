-- Vekil Pro :: vektörleme işlevleri dışarıya KAPATILDI
-- ===========================================================================
-- 23.09.2026 — Supabase güvenlik denetimi (get_advisors) ile bulundu, işlev
-- gövdeleri okunarak DOĞRULANDI.
--
-- AÇIK: public.vektorle_toplu ve public.vektorle_tetikle, SECURITY DEFINER
-- olarak tanımlı ve EXECUTE yetkisi `anon` (giriş yapmamış herkes) ile
-- `authenticated` rollerinde açıktı. İkisi de:
--   • çağıranın kim olduğuna BAKMIYOR,
--   • Vault'tan SERVİS ANAHTARINI alıp pg_net ile uç işlevine istek atıyor,
--   • vektorle_toplu'da `for i in 0..(isci - 1)` — işçi sayısına ÜST SINIR YOK.
--
-- Sonuç: anahtar dışarı sızmıyor, ama genel (publishable) anahtarı bilen
-- herhangi biri tek bir istekle
--     POST /rest/v1/rpc/vektorle_toplu  {"kaynak":"ictihat","isci":5000,"yigin":3}
-- gönderip binlerce paralel uç işlevi çağrısı başlatabilirdi. 18-23.09
-- arasında veritabanını üç kez tıkayan yükün aynısı — bu kez dışarıdan.
-- Bu çağrının şimdiye kadar yapıldığına dair bir kanıt YOK; iddia edilmiyor.
--
-- ÇAĞIRAN KİM (depo tarandı): yalnız pg_cron işi (postgres rolü). Uygulama,
-- uç işlevleri ve betikler bu işlevleri çağırmıyor. Yani dışarıya kapatmak
-- hiçbir akışı kırmaz.
--
-- NEDEN İŞLEV İÇİNE SINIR KOYMADIK: işlevi yeniden tanımlamak daha büyük bir
-- değişiklik ve asıl sorun sınır değil, YETKİ. Dışarıdan çağrılamayan bir
-- işlevin sınırı yalnız bizim cron'umuzu ilgilendirir.
--
-- PUBLIC'TEN DE ALINIYOR: Postgres'te işlevler varsayılan olarak PUBLIC'e
-- açılır; yalnız anon/authenticated'dan almak yetkiyi PUBLIC üzerinden açık
-- bırakırdı.
--
-- GERİ ALMA: grant execute on function ... to anon, authenticated;
-- (Gerekmesi beklenmiyor.)

revoke execute on function public.vektorle_toplu(text, integer, integer)   from public, anon, authenticated;
revoke execute on function public.vektorle_tetikle(text, integer, integer) from public, anon, authenticated;
grant  execute on function public.vektorle_toplu(text, integer, integer)   to service_role;
grant  execute on function public.vektorle_tetikle(text, integer, integer) to service_role;

-- Doğrulama: YALNIZ değişikliğin kendisi (0151 dersi).
select islev,
       has_function_privilege('anon',          islev, 'execute') as anon,
       has_function_privilege('authenticated', islev, 'execute') as girisli,
       has_function_privilege('service_role',  islev, 'execute') as servis,
       has_function_privilege('postgres',      islev, 'execute') as cron
from (values ('public.vektorle_toplu(text, integer, integer)'),
             ('public.vektorle_tetikle(text, integer, integer)')) v(islev);
