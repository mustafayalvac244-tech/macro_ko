-- EN AZ YETKİ: anon ve authenticated rollerinden TRUNCATE / REFERENCES /
-- TRIGGER yetkileri geri alınır.
--
-- BULUNAN DURUM (ölçüldü). 36 tabloda — cases, clients, documents, hearings,
-- deadlines, finance_entries, payments dahil — hem `anon` hem `authenticated`
-- rolüne TRUNCATE, REFERENCES ve TRIGGER yetkisi verilmişti. TRUNCATE
-- ÖZELLİKLE DİKKAT ÇEKİCİDİR ÇÜNKÜ RLS'İ HİÇ DİNLEMEZ: satır düzeyi güvenlik
-- politikaları TRUNCATE'i sınırlamaz, tablo tek hamlede boşaltılır.
--
-- BUGÜN SÖMÜRÜLEBİLİR DEĞİL — ABARTMAYALIM. Ölçüldü:
--   • PostgREST'e TRUNCATE isteği  → HTTP 501 (verb hiç uygulanmamış)
--   • Filtresiz DELETE denemesi     → HTTP 400 "DELETE requires a WHERE clause"
--   • TRUNCATE çalıştıran, istemciye açık bir fonksiyon → yok (arandı, sıfır)
-- Yani API üzerinden bu yetkiye ulaşan bir yol bulunamadı.
--
-- O HÂLDE NEDEN KALDIRILIYOR. Çünkü bugünkü güvenlik, PostgREST'in bir verbi
-- uygulamamış olmasına dayanıyor — bizim koyduğumuz bir korumaya değil. Yarın
-- biri TRUNCATE kullanan bir SECURITY INVOKER fonksiyonu eklerse ya da başka
-- bir erişim yolu açılırsa, bu yetki sessizce canlı bir silahtır. Kaldırmanın
-- maliyeti sıfır: PostgREST'in ihtiyacı olan tek şey SELECT/INSERT/UPDATE/
-- DELETE'tir; REFERENCES ve TRIGGER de istemci tarafından hiç kullanılmaz
-- (ikisi de DDL yetkisidir ve API üzerinden DDL yapılamaz).
--
-- Bir hukuk uygulamasında "silinemez" güvencesi, "silme yolu şu an kapalı
-- görünüyor"dan daha değerlidir.

do $$
declare t record;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('revoke truncate, references, trigger on public.%I from anon, authenticated', t.tablename);
  end loop;
end $$;
