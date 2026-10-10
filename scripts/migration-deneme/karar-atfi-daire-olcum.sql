-- KARAR ATFI — DAİRE EŞLEŞMESİ ÖLÇÜMÜ (0202)
-- ---------------------------------------------------------------------------
-- Her satır "GEÇTİ" ya da "KALDI" yazar. Ölçülen: havuzdaki_kararlar numara
-- aynı ama DAİRE farklıysa "bulundu" demez; daire bilinmiyorsa eskisi gibi
-- numaradan eşleşir. Taklit havuz: aynı esas/karar numarası iki ayrı dairede.

\set ON_ERROR_STOP on
\pset pager off

insert into public.ictihat_kararlar (id, kurul, daire, esas_no, karar_no, karar_tarihi, full_text)
values
  ('d1', 'Yargıtay', 'Yargıtay 3. Hukuk Dairesi',      '2019/1234', '2020/5678', '2020-03-04', 'uc hd'),
  ('d2', 'Yargıtay', 'Yargıtay 9. Ceza Dairesi',       '2018/777',  '2019/888',  '2019-05-06', 'dokuz cd'),
  ('d3', 'Yargıtay', 'Yargıtay Hukuk Genel Kurulu',    '2017/50',   '2018/60',   '2018-01-02', 'hgk'),
  ('d4', 'Danıştay', 'Danıştay 10. Daire',             '2016/11',   '2017/12',   '2017-02-03', 'dan'),
  ('d5', 'BAM',      'İstanbul Bölge Adliye Mahkemesi 45. Hukuk Dairesi', '2022/900', '2023/901', '2023-04-05', 'bam')
on conflict (id) do nothing;

-- Anahtar işlevi.
select case when public.karar_atfi_daire_no('Yargıtay 9. Hukuk Dairesi') = '9HD'
             and public.karar_atfi_daire_no('Yargıtay 3. Ceza Dairesi') = '3CD'
             and public.karar_atfi_daire_no('Danıştay 10. Daire') = '10D'
             and public.karar_atfi_daire_no('İstanbul Bölge Adliye Mahkemesi 45. Hukuk Dairesi') = '45HD'
             and public.karar_atfi_daire_no('Yargıtay Hukuk Genel Kurulu') is null
             and public.karar_atfi_daire_no('Yargıtay') is null
             and public.karar_atfi_daire_no(null) is null
       then 'GEÇTİ' else 'KALDI' end || '  daire anahtarı doğru çıkar, okunamayan NULL olur';

-- ASIL KUSUR: uydurma "9. HD 2019/1234" künyesi 3. HD'nin gerçek kararıyla
-- "doğrulandı" olmamalı.
select case when count(*) = 0 then 'GEÇTİ' else 'KALDI' end
       || '  numara aynı ama daire farklı (9HD isteniyor, kayıt 3. HD) → bulundu DENMEZ'
from public.havuzdaki_kararlar('[{"esas":"2019/1234","karar":"2020/5678","daire":"9HD"}]'::jsonb);

select case when count(*) = 1 and min(karar_id) = 'd1' then 'GEÇTİ' else 'KALDI' end
       || '  numara ve daire aynıysa (3HD) bulunur'
from public.havuzdaki_kararlar('[{"esas":"2019/1234","karar":"2020/5678","daire":"3HD"}]'::jsonb);

select case when count(*) = 0 then 'GEÇTİ' else 'KALDI' end
       || '  daire TÜRÜ farklıysa (9CD yerine 9HD) bulundu denmez'
from public.havuzdaki_kararlar('[{"esas":"2018/777","karar":"2019/888","daire":"9HD"}]'::jsonb);

select case when count(*) = 1 then 'GEÇTİ' else 'KALDI' end
       || '  daire göndermeyen eski istemci eskisi gibi numaradan bulur'
from public.havuzdaki_kararlar('[{"esas":"2019/1234","karar":"2020/5678"}]'::jsonb);

select case when count(*) = 1 then 'GEÇTİ' else 'KALDI' end
       || '  daire boş dizeyse numaradan bulur'
from public.havuzdaki_kararlar('[{"esas":"2019/1234","karar":"2020/5678","daire":""}]'::jsonb);

-- Kaydın dairesi okunamıyorsa (Genel Kurul) reddedilmez: bilinmeyen eşleşir.
select case when count(*) = 1 and min(karar_id) = 'd3' then 'GEÇTİ' else 'KALDI' end
       || '  kayıt Genel Kurulsa (daire okunamaz) numaradan eşleşir'
from public.havuzdaki_kararlar('[{"esas":"2017/50","karar":"2018/60","daire":"9HD"}]'::jsonb);

select case when count(*) = 1 and min(karar_id) = 'd4' then 'GEÇTİ' else 'KALDI' end
       || '  Danıştay 10. Daire anahtarı (10D) ile bulunur'
from public.havuzdaki_kararlar('[{"esas":"2016/11","karar":"2017/12","daire":"10D"}]'::jsonb);

select case when count(*) = 1 and min(karar_id) = 'd5' then 'GEÇTİ' else 'KALDI' end
       || '  BAM 45. Hukuk Dairesi (45HD) bulunur'
from public.havuzdaki_kararlar('[{"esas":"2022/900","karar":"2023/901","daire":"45HD"}]'::jsonb);

-- Yetki 0117'deki gibi kalmalı: create or replace ACL'yi bozmamalı.
select case when not has_function_privilege('anon', 'public.havuzdaki_kararlar(jsonb)', 'EXECUTE')
             and not has_function_privilege('authenticated', 'public.havuzdaki_kararlar(jsonb)', 'EXECUTE')
             and has_function_privilege('service_role', 'public.havuzdaki_kararlar(jsonb)', 'EXECUTE')
             and not has_function_privilege('anon', 'public.karar_atfi_daire_no(text)', 'EXECUTE')
             and not has_function_privilege('authenticated', 'public.karar_atfi_daire_no(text)', 'EXECUTE')
       then 'GEÇTİ' else 'KALDI' end || '  yetki yalnız service_role''de (iki işlev)';
