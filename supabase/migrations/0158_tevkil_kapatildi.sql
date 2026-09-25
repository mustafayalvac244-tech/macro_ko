-- 26.09.2026 — TEVKİL PANOSU VE MESLEKTAŞ MESAJLARI KAPATILDI (ürün sahibi: "tevkili kapat").
--
-- Gerekçe (yayın öncesi hukuki tarama): panoda ücret teklifli iş ilanı
-- Av.K. m.48 ve reklam yasağı yönünden yoruma açık; kayıtta avukat
-- doğrulaması olmadığından ilanı/mesajı avukat olmayan biri de görebiliyordu.
--
-- NE YAPILIYOR — yalnız ERİŞİM kapanıyor, VERİ SİLİNMİYOR (geri alınabilir):
--  • jobs: "readable by authenticated" politikası kaldırılıyor → herkes
--    yalnız KENDİ ilanını görür; yeni ilan INSERT'i kapanıyor.
--  • dm_messages: yeni mesaj INSERT'i kapanıyor; taraflar eski mesajlarını
--    görmeye devam eder (KVKK erişim hakkı).
--  • search_lawyers / public_profiles: başka avukatın ad/büro/sicil bilgisini
--    döndüren iki RPC authenticated'dan geri alınıyor.
--
-- GERİ ALMA: 0007/0027/0134'teki politika ve grant'ları yeniden uygula.

do $$
declare f record;
begin
  if to_regclass('public.jobs') is not null then
    drop policy if exists "jobs readable by authenticated" on public.jobs;
    drop policy if exists "jobs owner read" on public.jobs;
    create policy "jobs owner read" on public.jobs for select using (auth.uid() = owner_id);
    revoke insert on public.jobs from authenticated, anon;
  end if;

  if to_regclass('public.dm_messages') is not null then
    revoke insert on public.dm_messages from authenticated, anon;
  end if;

  for f in
    select p.oid::regprocedure as imza
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('search_lawyers', 'public_profiles')
  loop
    execute format('revoke execute on function %s from authenticated, anon, public', f.imza);
  end loop;
end $$;
