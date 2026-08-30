-- Yönetici hesapları: is_admin bayrağı
alter table profiles add column if not exists is_admin boolean not null default false;
