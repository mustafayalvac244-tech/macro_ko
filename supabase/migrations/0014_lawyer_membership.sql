-- Avukat üyeliği: kayıtta TC Kimlik No + Baro + Baro Sicil No
alter table profiles add column if not exists tc_no text;
alter table profiles add column if not exists baro text;
