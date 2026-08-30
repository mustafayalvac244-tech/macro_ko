-- Alıcı geri bildirimi (v3.5.0): dava dizini, karar bilgileri, karşı vekil,
-- müvekkil unvanı, müvekkil bazlı belge
alter table clients add column if not exists title text;
alter table cases add column if not exists opposing_counsel text;
alter table cases add column if not exists instance_stage text;
alter table cases add column if not exists case_stage text;
alter table cases add column if not exists closed_result text;
alter table cases add column if not exists decision_number text;
alter table cases add column if not exists decision_date date;
alter table cases add column if not exists decision_served_date date;
alter table documents add column if not exists client_id uuid references clients (id) on delete set null;
