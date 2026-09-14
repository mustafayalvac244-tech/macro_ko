-- CANLI DOĞRULAMA — SALT OKUNUR. Hiçbir şeyi değiştirmez.
-- ---------------------------------------------------------------------------
-- NEDEN VAR. 14.09.2026'da 0131 (zaman kaydı) ve 0132 (eksik indeksler)
-- canlıya uygulandı ve iş akışı "UYGULANDI" dedi. Ama "uygulandı" ile
-- "doğru oturdu" aynı şey değil: göç hatasız koşup yine de beklenenden
-- farklı bir şema bırakabilir (sütun tipi, kısıt, politika, tetikleyici).
--
-- Yerelde ölçmüştüm ama yerel ≠ canlı: canlıda pgvector var, pg_cron var,
-- KURULUM.sql çalıştırılmış ve 130 göç birikmiş. Bu dosya o farkı kapatıyor.
--
-- 0116/0120/0121 ile aynı desen: yazmayan, yalnız ölçen göç. Çıktısı
-- Actions kaydında görünür.

-- ── 1. Zaman kaydı tablosu gerçekten var mı ve şekli doğru mu ───────────
select
  'time_entries sutunlari' as olcum,
  string_agg(column_name || ':' || data_type, ', ' order by ordinal_position) as deger
from information_schema.columns
where table_schema = 'public' and table_name = 'time_entries';

-- ── 2. amount GERÇEKTEN hesaplanan sütun mu ────────────────────────────
-- Sıradan bir sütun olsaydı uygulama ne yazarsa o kalırdı ve ekranla rapor
-- ayrışabilirdi. Beklenen: is_generated = ALWAYS.
select
  'amount hesaplanan mi' as olcum,
  coalesce(max(is_generated), 'SUTUN YOK') as deger
from information_schema.columns
where table_schema = 'public' and table_name = 'time_entries' and column_name = 'amount';

-- ── 3. Kısıtlar duruyor mu ─────────────────────────────────────────────
-- minutes > 0 ve <= 1440, açıklama boş olamaz, hourly_rate negatif olamaz.
select
  'time_entries kisitlari' as olcum,
  coalesce(string_agg(conname, ', ' order by conname), 'KISIT YOK') as deger
from pg_constraint
where conrelid = to_regclass('public.time_entries') and contype = 'c';

-- ── 4. RLS açık mı ve politikası var mı ────────────────────────────────
-- Kapalıysa her avukat herkesin çalışma kaydını görür. Bu, sessiz ve en
-- pahalı kusur olurdu.
select
  'time_entries RLS' as olcum,
  case
    when c.relrowsecurity then 'ACIK · politika: ' || coalesce(
      (select string_agg(polname, ', ') from pg_policy p where p.polrelid = c.oid), 'YOK (!)')
    else 'KAPALI (!)'
  end as deger
from pg_class c
where c.oid = to_regclass('public.time_entries');

-- ── 5. Sahiplik tetikleyicisi duruyor mu ───────────────────────────────
-- Bu olmadan bir kullanıcı BAŞKASININ dosya kimliğine kayıt iliştirebilir;
-- göremez ama o dosya silinince kaydı da silinir (sessiz veri kaybı).
select
  'sahiplik tetikleyicisi' as olcum,
  coalesce(string_agg(tgname, ', '), 'YOK (!)') as deger
from pg_trigger
where tgrelid = to_regclass('public.time_entries') and not tgisinternal;

-- ── 6. profiles.hourly_rate eklendi mi ─────────────────────────────────
select
  'profiles.hourly_rate' as olcum,
  coalesce(max(data_type), 'SUTUN YOK') as deger
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles' and column_name = 'hourly_rate';

-- ── 7. 0132'den sonra indekssiz yabancı anahtar kaldı mı ───────────────
-- BİZE AİT tablolarda boş dönmeli. Eczane tabloları (kullanici_ilaclar,
-- kullanici_alimlar) bizim değil ve AGENTS.md gereği onlara dokunulmuyor —
-- bu yüzden sayımın dışında tutuluyorlar.
select
  'indekssiz FK (bizim tablolar)' as olcum,
  coalesce(string_agg(t.ad, ', ' order by t.ad), 'yok - temiz') as deger
from (
  select c.conrelid::regclass::text || '.' || a.attname as ad
  from pg_constraint c
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
  join pg_class cl on cl.oid = c.conrelid
  join pg_namespace n on n.oid = cl.relnamespace
  where c.contype = 'f'
    and n.nspname = 'public'
    and array_length(c.conkey, 1) = 1
    and cl.relname not in ('kullanici_ilaclar', 'kullanici_alimlar', 'ilaclar', 'prospektusler')
    and not exists (
      select 1 from pg_index i
      where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1]
    )
) t;

-- ── 8. Kullanımda mı — canlıda kaç çalışma kaydı var ───────────────────
-- Sıfır beklenir (özellik henüz kimsede yok). Sıfırdan büyükse özellik
-- kullanılmaya başlanmış demektir ve bu iyi haberdir.
select 'canli zaman kaydi sayisi' as olcum, count(*)::text as deger from public.time_entries;
