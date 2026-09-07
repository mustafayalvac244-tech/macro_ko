-- BAKIM UÇLARI İÇİN KESİN YETKİ PROBU.
--
-- NEDEN. embed-ictihat/harvest-tick uçlarını servis yetkisine kilitlerken ilk
-- iki deneme CANLI TESTTE ELENDİ:
--   1) "Gelen jetonu SUPABASE_SERVICE_ROLE_KEY ile karşılaştır" → bu projede
--      iki anahtar biçimi bir arada (eski 219 karakterlik JWT, yeni 41
--      karakterlik sb_secret_...). Cron, Vault'taki ESKİ JWT'yi gönderiyor;
--      ortam değişkeni başka biçim taşıyor. Bu yaklaşım 20 dakikada bir çalışan
--      içtihat hasadını sessizce bozardı (gerçek çağrıda 403 alındı).
--   2) "Politikası olmayan bir tabloyu okumayı dene" → RLS satırları FİLTRELER,
--      HATA DÖNDÜRMEZ: anon anahtarıyla sorgu hatasız ama BOŞ döndü ve kontrol
--      onu "yetkili" saydı. Gerçek testte anon anahtarı ucu tetikleyebildi
--      (HTTP 200) — yani koruma hiç çalışmıyordu.
--
-- ÇÖZÜM: yalnız service_role'ün ÇALIŞTIRABİLDİĞİ, yan etkisi olmayan küçük bir
-- fonksiyon. Yetkisiz çağrıda Postgres NET BİR HATA verir (42501), boş sonuç
-- değil — yani "filtrelendi mi, yetkisiz mi" belirsizliği ortadan kalkar.
-- İmzayı da Postgres/PostgREST doğrular; ağ geçidinin verify_jwt ayarından
-- bağımsızdır.
create or replace function public.servis_yetki_kontrol()
returns boolean
language sql
immutable
as $$ select true $$;

revoke all on function public.servis_yetki_kontrol() from public, anon, authenticated;
grant execute on function public.servis_yetki_kontrol() to service_role;
