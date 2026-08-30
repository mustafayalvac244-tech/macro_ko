-- Alıcı revizyonu (v3.6.0): mahkeme kategorisi + müvekkil tipi
alter table cases add column if not exists court_category text;   -- hukuk | ceza | idare
alter table clients add column if not exists client_type text default 'gercek'; -- gercek | tuzel
