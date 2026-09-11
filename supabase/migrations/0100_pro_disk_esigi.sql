-- HASAT DİSK EŞİĞİ: FREE (500 MB) → PRO (8 GB)
-- ---------------------------------------------------------------------------
-- ⚠️ BU MIGRATION YALNIZCA PRO PLANA GEÇTİKTEN SONRA UYGULANMALIDIR.
-- Free plandayken uygulanırsa emniyet freni devre dışı kalmış olur: hasat
-- 500 MB'ı aşar ve Supabase projeyi kısıtlar. Sıra: önce yükselt, sonra bunu
-- çalıştır.
--
-- BULUNAN SORUN. 0084'te doğru bir emniyet freni kurulmuştu:
--     create function disk_musait_mi(p_esik_mb integer default 460)
-- 460 MB, Free planın 500 MB'lık disk sınırına göre seçilmiş bir değerdi ve o
-- plan için DOĞRUYDU. Ama eşik fonksiyonun varsayılanına gömülü; plan
-- değişince kendiliğinden güncellenmiyor. Pro'ya (8 GB) geçildiğinde hasat
-- hâlâ 460 MB'da duracak ve ödenen alanın ~%94'ü hiç kullanılmayacaktı.
-- Yani para verilip açılan kapasite, eski bir sabit yüzünden kapalı kalırdı.
--
-- YENİ EŞİK: 6000 MB (8 GB'ın ~%73'ü). Neden tavana yakın değil:
--   • pg_database_size yalnız veritabanını sayar; WAL, indeks bakımı ve
--     geçici alan bunun DIŞINDA büyür.
--   • Eşiğe çarpıldığında hasat durur ama uygulama çalışmaya devam etmeli —
--     avukatın dosya kaydetmesi için yer kalmalı. Boşluk onun içindir.
--   • Aşım ücretli ($0.125/GB); freni tavana dayamak sessiz fatura demektir.
--
-- ÖLÇÜLMEMİŞ VARSAYIM (açıkça söylüyorum): 6000 MB'a ne zaman ulaşılacağını
-- ÖLÇMEDİM. Hasat 0094 ile saatte 600 karar çekiyor ve her kaydın metin +
-- tsvector + vector(384) + HNSW indeksiyle kabaca 10–15 KB tuttuğunu TAHMİN
-- ediyorum. Gerçek boyut Supabase → Settings → Usage'da görülür; oradaki
-- rakam bu tahmini doğrular ya da yalanlar. Eşik buna göre yeniden ayarlanmalı.

create or replace function public.disk_musait_mi(p_esik_mb integer default 6000)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select pg_database_size(current_database()) < (p_esik_mb::bigint * 1024 * 1024)
$$;

-- drop KULLANILMADI: dönüş tipi ve imza aynı olduğu için create or replace
-- yetiyor ve yetkiler korunuyor. (0095-0097'de admin_recent_users'ta dönüş
-- tipi DEĞİŞTİĞİ için drop şarttı ve orada yetkileri elle geri kurmak
-- gerekmişti — burada o risk yok.)
revoke all on function public.disk_musait_mi(integer) from public, anon, authenticated;
grant execute on function public.disk_musait_mi(integer) to service_role;

-- Mevcut doluluk: bu migration'ı çalıştırınca sonucu görürsün.
do $$
declare
  mb numeric := round(pg_database_size(current_database()) / 1024.0 / 1024.0, 1);
begin
  raise notice 'Veritabanı şu an % MB. Yeni hasat eşiği: 6000 MB.', mb;
  if mb >= 6000 then
    raise notice 'DİKKAT: mevcut boyut zaten eşiğin üstünde — hasat çalışmayacak.';
  end if;
end $$;
