-- AVUKAT REHBERİ FONKSİYONLARI ANONİME AÇIKTI.
--
-- BULUNAN TUTARSIZLIK. `profiles` tablosunun RLS politikası bilinçli olarak
-- oturum şartı koyuyor:
--     "profiles readable by authenticated"  qual: auth.role() = 'authenticated'
-- Yani tabloya anonim erişim KAPALI. Ama iki SECURITY DEFINER fonksiyonu —
-- public_profiles(uuid[]) ve search_lawyers(text) — anon rolüne de EXECUTE
-- yetkisiyle duruyordu ve SECURITY DEFINER oldukları için o politikayı
-- BAYPAS ediyorlardı. Sonuç: oturum açmamış biri, yayımlanabilir anahtarla
-- (uygulamanın içinde olduğu için herkese açıktır) avukat adı, büro adı ve
-- baro sicil numarasına ulaşabiliyordu.
--
-- ÖLÇÜLEN ETKİ SINIRLI, ABARTMIYORUM: dönen kolonlar zaten oturumlu
-- kullanıcının görebildiklerinin aynısı (tc_no, telefon ve e-posta YOK — 0024
-- ve 0083 ile kapatılmıştı) ve public_profiles rastgele UUID tahmini
-- gerektiriyor. Ama search_lawyers ad/büro ile ARAMA yapar; oturum açmadan
-- meslek rehberinde arama yapılabilmesi, tablonun politikasıyla açıkça
-- çelişir.
--
-- KIRILMA RİSKİ YOK: her iki fonksiyonun da uygulamadaki tek çağrı yeri
-- src/hooks/useChat.ts (mesajlaşma ve rehber) ve o akışların tamamı oturum
-- açtıktan sonra çalışır.

-- DİKKAT — PUBLIC'TEN DE ALINMALI. İlk denemede yalnız `anon`'dan revoke
-- edildi ve HİÇBİR ŞEY DEĞİŞMEDİ: fonksiyonların ACL'i "=X/postgres" idi, yani
-- yetki PUBLIC üzerinden geliyordu ve anon onu PUBLIC üyeliğiyle taşımaya devam
-- etti (ölçüldü: revoke sonrası has_function_privilege('anon', ...) hâlâ true).
-- Postgres'te fonksiyonlar varsayılan olarak PUBLIC'e EXECUTE verir; role bazlı
-- revoke bunu KALDIRMAZ. Aynı tuzağa 0079'da da düşülmüştü.
revoke execute on function public.public_profiles(uuid[]) from public, anon;
revoke execute on function public.search_lawyers(text) from public, anon;
grant execute on function public.public_profiles(uuid[]) to authenticated, service_role;
grant execute on function public.search_lawyers(text) to authenticated, service_role;
