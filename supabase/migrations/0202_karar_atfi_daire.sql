-- "DOĞRULANDI" DAİREYE DE BAKAR — havuzdaki_kararlar (0117) düzeltmesi.
--
-- BULUNAN KUSUR (50 denetçi, 08.10.2026; 22. ajan doğruladı, 10.10.2026).
-- 0117 yalnız esas/karar NUMARASINA bakıyordu. Esas numarası her dairede AYRI
-- işler: "2019/1234" hem 3. HD'de hem 9. HD'de vardır. Yani modelin uydurduğu
-- "Yargıtay 9. HD 2019/1234 E." künyesi, havuzdaki BAŞKA dairenin gerçek kararı
-- yüzünden "doğrulandı" (yeşil) çıkabiliyordu — tam da bu denetimin engellemesi
-- gereken yanlış güvence.
--
-- DÜZELTME. Atıf artık isteğe bağlı `daire` anahtarı taşır (örn. "9HD", "3CD",
-- "10D" — bkz. _shared/kararAtif.ts > atifDaireAnahtari). Eşleşme için:
--   • atıf daire vermediyse ya da havuz kaydının dairesi okunamıyorsa (Genel
--     Kurul, yalnız "Yargıtay", boş) → ESKİSİ GİBİ: numara yeter. Bilinmeyeni
--     reddetmek gerçek kararı "yok" saymak olurdu; yanlış negatif yeşilden
--     iyidir ama gürültüdür, bu yüzden yalnız İKİ TARAF DA bilinirken karşılaştırılır.
--   • ikisi de biliniyorsa anahtarlar EŞİT olmalı.
-- Eski istemci (daire göndermeyen) hiçbir şey kaybetmez: jsonb'de eksik alan NULL.
--
-- NE ÇÖZMEZ. Mahkeme düzeyi (Yargıtay'a karşı BAM) ayrıca karşılaştırılmaz;
-- "12. Hukuk Dairesi" aynı numara + aynı esas numarasıyla hem Yargıtay'da hem
-- bir BAM'da olursa ayırt edilmez. Böyle bir çakışmanın sıklığı ÖLÇÜLMEDİ.
--
-- Canlıya uygulanmadı (yalnız yerel taklitte denendi: scripts/migration-deneme/
-- karar-atfi-daire-olcum.sql). Yetki 0117'deki gibi YALNIZ service_role.

create or replace function public.karar_atfi_daire_no(v text)
returns text
language sql
immutable
parallel safe
set search_path = public as $$
  select case
           when m is null then null
           else (m[1])::int::text
                || case lower(m[2]) when 'hukuk' then 'HD' when 'ceza' then 'CD' else 'D' end
         end
  from (select regexp_match(coalesce(v, ''), '(\d{1,2})\s*\.?\s*(hukuk|ceza|daire)', 'i') as m) t;
$$;

comment on function public.karar_atfi_daire_no(text) is
  'Daire adını "9HD" / "3CD" / "10D" anahtarına indirger; sıra numarası okunamıyorsa NULL (Genel Kurul vb.). _shared/kararAtif.ts > daireAnahtari ile aynı kural.';

revoke all on function public.karar_atfi_daire_no(text) from public, anon, authenticated;
grant execute on function public.karar_atfi_daire_no(text) to service_role;

-- Dönüş sütunları 0117 ile AYNI (create or replace dönüş tipini değiştiremez).
create or replace function public.havuzdaki_kararlar(atiflar jsonb)
returns table(esas text, karar text, karar_id text, daire text, karar_tarihi text)
language sql
stable
security definer set search_path = public as $$
  select distinct on (a.esas, a.karar)
         a.esas, a.karar, k.id, k.daire, k.karar_tarihi::text
  from jsonb_to_recordset(coalesce(atiflar, '[]'::jsonb)) as a(esas text, karar text, daire text)
  join public.ictihat_kararlar k
    on (
         nullif(a.esas, '') is null
         or public.karar_atfi_sade(k.esas_no) = public.karar_atfi_sade(a.esas)
       )
   and (
         nullif(a.karar, '') is null
         or public.karar_atfi_sade(k.karar_no) = public.karar_atfi_sade(a.karar)
       )
   -- 0202: daire biliniyorsa (iki tarafta da) aynı olmalı.
   and (
         nullif(a.daire, '') is null
         or public.karar_atfi_daire_no(k.daire) is null
         or public.karar_atfi_daire_no(k.daire) = a.daire
       )
  where nullif(a.esas, '') is not null or nullif(a.karar, '') is not null
  order by a.esas, a.karar, k.karar_tarihi desc nulls last, k.id;
$$;

comment on function public.havuzdaki_kararlar(jsonb) is
  'Yapay zekâ çıktısındaki içtihat atıflarından havuzda BULUNANLARI döner (numara + biliniyorsa daire). Bulunmayan atıf "uydurma" demek değildir — havuz eksik olabilir.';

revoke all on function public.havuzdaki_kararlar(jsonb) from public, anon, authenticated;
grant execute on function public.havuzdaki_kararlar(jsonb) to service_role;
