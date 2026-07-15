-- Duruşma/görev bir davaya bağlı olmadan da oluşturulabilsin (ör. toplantı).
alter table hearings alter column case_id drop not null;
alter table deadlines alter column case_id drop not null;
