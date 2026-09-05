-- MÜVEKKİLİN T.C. KİMLİK NUMARASI — dava dilekçesinin ZORUNLU unsuru.
--
-- NEDEN. HMK m.119/1-c: dava dilekçesinde "davacının Türkiye Cumhuriyeti
-- kimlik numarası" bulunur. Aynı maddenin ikinci fıkrası bunun eksikliğine
-- ağır bir sonuç bağlar: hâkim BİR HAFTALIK KESİN SÜRE verir ve süre içinde
-- tamamlanmazsa "dava açılmamış sayılır".
--
-- Program müvekkilin adını, adresini, telefonunu tutuyordu ama kimlik
-- numarasını tutmuyordu. Sonuç: üretilen her dava dilekçesinde
-- "[Davacı TCKN]" boşluğu kalıyor ve avukat onu her seferinde elle
-- dolduruyordu — hem de zorunlu bir unsuru.
--
-- Doğrulama uygulamada yapılıyor (src/utils/tckn.ts, resmî algoritma). Burada
-- yalnız BİÇİM kısıtı var: on bir hane ve baştaki hane sıfır olamaz. Kısıt
-- gevşek tutuldu bilerek — eski kayıtlarda eksik/yanlış veri olabilir ve
-- katı bir kısıt, ilgisiz bir kaydı güncellemeyi imkânsız hâle getirirdi.

alter table public.clients add column if not exists tc_no text;

alter table public.clients drop constraint if exists clients_tc_no_bicim;
alter table public.clients add constraint clients_tc_no_bicim
  check (tc_no is null or tc_no ~ '^[1-9][0-9]{10}$');

comment on column public.clients.tc_no is
  'Müvekkilin T.C. kimlik numarası. Dava dilekçesinde zorunlu unsurdur (HMK m.119/1-c); eksikliği bir haftalık kesin süreye ve tamamlanmazsa davanın açılmamış sayılmasına yol açar (m.119/2).';
