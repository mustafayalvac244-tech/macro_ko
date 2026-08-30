-- Vekil Pro :: premium flag on profile (drives the gold avatar ring)
alter table profiles add column if not exists is_premium boolean not null default false;
