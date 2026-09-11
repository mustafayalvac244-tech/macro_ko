-- ÖLÇÜM: hasat önceliği GERÇEKTEN ayrışıyor mu?
-- ---------------------------------------------------------------------------
-- NEDEN VAR. 0093'ün öncelik puanlamasında üç hata vardı ve ÜÇÜ DE ancak
-- çalıştırınca görüldü:
--   • least(60, NULL) = 60 → eşleşmeyen terim de tam puan alıyordu; 134
--     terimin 128'i aynı puandaydı, yani "öncelik" diye bir şey yoktu.
--   • lower() Türkçe 'İ'yi doğru küçültmüyor → "İşçilik Alacakları" hiçbir
--     terimle eşleşmiyordu.
--   • like '%'||konu||'%' → kullanıcının yazdığı dava türündeki '%' karakteri
--     desene sızıyordu.
-- Bu dosya üçünü de bir daha sessizce geri gelemeyecek şekilde sınar.
--
-- Ön koşul: 0103 uygulanmış, ictihat_harvest_state.oncelik var olmalı.

\set ON_ERROR_STOP on

insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'olcum@ornek.test');
insert into public.profiles (id, email) values ('33333333-3333-3333-3333-333333333333', 'olcum@ornek.test');

-- Gerçekçi terimler (canlıdaki listeden bir kesit) + gerçek Türkçe harfler.
insert into public.ictihat_harvest_state (terim) values
  ('işçilik alacakları davası'),
  ('kira tespit davası'),
  ('boşanma davası'),
  ('marka hükümsüzlüğü'),
  ('zimmet suçu'),
  ('şirket genel kurul kararının iptali');

-- 8 davalık bir karışım. 'İşçilik Alacakları' BÜYÜK 'İ' ile yazıldı:
-- lower() ile eşleşmezdi, tr_kucult() ile eşleşmeli.
-- '%50 hisse' bilerek konuldu: joker karakter desene sızmamalı.
insert into public.cases (owner_id, case_type)
select '33333333-3333-3333-3333-333333333333', t
from (values ('İşçilik Alacakları'), ('İşçilik Alacakları'), ('İşçilik Alacakları'),
             ('Kira Tespit'), ('Kira Tespit'),
             ('Boşanma'), ('Ecrimisil'), ('%50 hisse')) v(t);

select public.hasat_onceligini_tazele();

select
  case
    when count(*) filter (where oncelik > 100) = 3 then 'GEÇTİ'
    else 'BOZULDU (' || count(*) filter (where oncelik > 100) || ' terim puan aldı, 3 bekleniyordu)'
  end as "puan alan terim sayısı"
from public.ictihat_harvest_state;

select
  case when (select oncelik from public.ictihat_harvest_state where terim = 'işçilik alacakları davası') = 123
    then 'GEÇTİ' else 'BOZULDU — Türkçe İ eşleşmesi çalışmıyor' end as "İ harfi eşleşmesi (123 olmalı)";

select
  case when (select oncelik from public.ictihat_harvest_state where terim = 'kira tespit davası') = 115
    then 'GEÇTİ' else 'BOZULDU' end as "kısmi eşleşme (115 olmalı)";

-- EN KRİTİK SATIR: eşleşmeyen terim TABANDA kalmalı. Burası bozulursa
-- puanlama sabitleşir ve öncelik özelliği sessizce yok olur.
select
  case when (select count(*) from public.ictihat_harvest_state
             where terim in ('marka hükümsüzlüğü','zimmet suçu','şirket genel kurul kararının iptali')
               and oncelik = 100) = 3
    then 'GEÇTİ' else 'BOZULDU — eşleşmeyen terim puan alıyor (least/NULL hatası geri geldi)' end
  as "eşleşmeyen terim tabanda (100) kalmalı";
