-- UZUN VADELİ YEDEK: 21 günlük pencere, geç fark edilen bozulmalara karşı
-- yetersiz (ör. 2 ay önce bozulan bir kayıt). Her ayın ilk yedeğini 12 ay
-- saklayan ikinci bir katman ekliyoruz. Yer maliyeti düşük (ayda 1 kopya).
create table if not exists backup.monthly (
  id bigint generated always as identity primary key,
  snap_month date not null,
  snap_at timestamptz not null,
  tbl text not null,
  row_data jsonb not null
);
create index if not exists monthly_idx on backup.monthly (snap_month, tbl);
alter table backup.monthly enable row level security;

create or replace function backup.take_monthly()
returns integer language plpgsql security definer set search_path = public as $$
declare
  m date := date_trunc('month', now())::date;
  n integer;
begin
  -- Bu ay zaten alındıysa tekrar alma
  if exists (select 1 from backup.monthly where snap_month = m) then
    return 0;
  end if;
  insert into backup.monthly (snap_month, snap_at, tbl, row_data)
  select m, s.snap_at, s.tbl, s.row_data
  from backup.snapshots s
  where s.snap_at = (select max(snap_at) from backup.snapshots);
  get diagnostics n = row_count;
  -- 12 aydan eskiyi sil
  delete from backup.monthly where snap_month < (current_date - interval '12 months');
  return n;
end;
$$;

-- Her ayın 1'inde 04:00 UTC
select cron.unschedule('vekil_monthly_backup') where exists (
  select 1 from cron.job where jobname = 'vekil_monthly_backup'
);
select cron.schedule('vekil_monthly_backup', '0 4 1 * *', $$select backup.take_monthly()$$);
-- İlk aylık kopyayı hemen al
select backup.take_monthly() as ilk_aylik_satir;
