-- KARAR ATFI DENETİMİ ÖLÇÜMÜ (0117)
-- ---------------------------------------------------------------------------
-- Bu dosya iddiayı SINAR, anlatmaz. Her satır "GEÇTİ" ya da "KALDI" yazar.
-- Ölçülen şey: havuzdaki_kararlar hangi atfı bulur, hangisini bulmaz ve
-- yetkisi kimde. Fonksiyonun "uydurma" kararı VERMEDİĞİ (yalnız bulduğunu
-- söylediği) burada da korunuyor: eşleşmeyen satır çıktıda hiç görünmez.

\set ON_ERROR_STOP on
\pset pager off

-- Havuz taklidi: iki gerçek karar.
insert into public.ictihat_kararlar (id, kurul, daire, esas_no, karar_no, karar_tarihi, full_text)
values
  ('t1', 'Yargıtay', '9. Hukuk Dairesi', '2019/12345', '2020/6789', '2020-03-04', 'metin bir'),
  -- Aynı esas/karar çiftinin MÜKERRER satırı: DISTINCT ON kararsız kalmasın.
  ('t2', 'Yargıtay', '9. Hukuk Dairesi', '2019/12345', '2020/6789', '2021-01-01', 'metin iki'),
  -- Biçim gürültüsü: boşluklu yazılmış numara. Sadeleştirme çalışmazsa
  -- GERÇEKTEN havuzda olan bu kararı "bulunamadı" diye gösterirdik.
  ('t3', 'Yargıtay', '4. Hukuk Dairesi', '2021 / 500', '2022/77', '2022-05-06', 'metin uc')
on conflict (id) do nothing;

select case when count(*) = 1 then 'GEÇTİ' else 'KALDI' end || '  tam eşleşen atıf bulunur'
from public.havuzdaki_kararlar('[{"esas":"2019/12345","karar":"2020/6789"}]'::jsonb);

select case when count(*) = 0 then 'GEÇTİ' else 'KALDI' end || '  havuzda olmayan atıf dönmez (uydurma denmez, susulur)'
from public.havuzdaki_kararlar('[{"esas":"2015/9999","karar":"2016/8888"}]'::jsonb);

select case when count(*) = 0 then 'GEÇTİ' else 'KALDI' end || '  esası tutup kararı tutmayan satır eşleşme sayılmaz'
from public.havuzdaki_kararlar('[{"esas":"2019/12345","karar":"2020/1111"}]'::jsonb);

select case when count(*) = 1 then 'GEÇTİ' else 'KALDI' end || '  yalnız esas verilen atıf esastan eşleşir'
from public.havuzdaki_kararlar('[{"esas":"2019/12345","karar":""}]'::jsonb);

select case when count(*) = 1 then 'GEÇTİ' else 'KALDI' end || '  boşluklu yazılmış havuz numarası yine de bulunur'
from public.havuzdaki_kararlar('[{"esas":"2021/500","karar":"2022/77"}]'::jsonb);

-- Mükerrer satırda TEK sonuç dönmeli ve hep AYNI olmalı (en yeni tarihli).
select case when count(*) = 1 and min(karar_id) = 't2' then 'GEÇTİ' else 'KALDI' end
       || '  mükerrer havuz satırında tek ve kararlı sonuç döner'
from public.havuzdaki_kararlar('[{"esas":"2019/12345","karar":"2020/6789"}]'::jsonb);

select case when count(*) = 0 then 'GEÇTİ' else 'KALDI' end || '  boş liste boş döner'
from public.havuzdaki_kararlar('[]'::jsonb);

-- YETKİ. anon/authenticated bu fonksiyonu çağırabilirse korpus jsonb listesiyle
-- sorgulanabilir hâle gelir — 0107'nin kapattığı sızıntının aynısı.
select case when not has_function_privilege('anon', 'public.havuzdaki_kararlar(jsonb)', 'EXECUTE')
             and not has_function_privilege('authenticated', 'public.havuzdaki_kararlar(jsonb)', 'EXECUTE')
             and has_function_privilege('service_role', 'public.havuzdaki_kararlar(jsonb)', 'EXECUTE')
       then 'GEÇTİ' else 'KALDI' end || '  yetki yalnız service_role''de';
