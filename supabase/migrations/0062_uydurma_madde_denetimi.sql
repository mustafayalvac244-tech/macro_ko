-- UYDURMA MADDE ATFI DENETİMİ — sunucu tarafında.
--
-- NEDEN. Bu denetim bugüne kadar YALNIZ ölçüm betiğinde vardı: uydurma madde
-- atfını ölçüyorduk ama kullanıcıyı ondan korumuyorduk. Ölçüm çıktısında
-- "UYDURMA MADDE" satırını biz görüyorduk; aynı metni ekranda gören avukat
-- hiçbir şey görmüyordu.
--
-- Uydurma madde, avukat için en pahalı hata türüdür çünkü GERÇEK GÖRÜNÜR:
-- biçimi doğru, numarası var, cümlesi hukukçu gibi kurulmuş. Yanlış olduğu
-- ancak karşı taraf ya da hâkim baktığında anlaşılır — yani en geç anda.
--
-- İKİ KOŞUL BİRLİKTE ARANIR:
--   1. Kanun havuzda OLMALI. Havuzda olmayan bir kanuna (örn. KTK 2918, bkz.
--      scripts/korpus-eksikleri.md) yapılan atfı "uydurma" saymak, bizim
--      eksiğimizi kullanıcının hatasıymış gibi göstermek olurdu — üstelik
--      doğru bir atfı yanlış diye işaretlerdik.
--   2. Madde havuzda OLMAMALI. Kanun bizde tam olduğuna göre o numaranın
--      yokluğu gerçekten yokluktur.
--
-- MADDE NUMARASI TABANDAN EŞLEŞİR. Havuzda "309/a", "176/b", "48/A" gibi harf
-- ekli numaralar var (399 satır). "m.309" atfını uydurma saymamak için bölü
-- işaretinden ÖNCEKİ kısım karşılaştırılır. "Ek 17" ve "Geçici 110" bilerek
-- eşleşmez: "m.17" atfı, ek maddeye değil asıl 17. maddeye yapılmıştır.
--
-- Yanlış pozitif burada pahalıdır: doğru bir atfı "uydurma" diye işaretlemek
-- uyarıyı gürültüye çevirir ve avukat bir daha hiçbirine bakmaz.

create or replace function public.uydurma_maddeler(atiflar jsonb)
returns table(kanun text, madde text)
language sql
stable
security definer set search_path = public as $$
  select a.kanun, a.madde
  from jsonb_to_recordset(coalesce(atiflar, '[]'::jsonb)) as a(kanun text, madde text)
  where a.kanun is not null
    and a.madde is not null
    and exists (
      select 1 from public.mevzuat_maddeleri m where m.kanun_short = a.kanun
    )
    and not exists (
      select 1 from public.mevzuat_maddeleri m
      where m.kanun_short = a.kanun
        and split_part(btrim(m.madde_no), '/', 1) = a.madde
    );
$$;

-- Mevzuat havuzu herkese açık bilgidir (kanun metni); denetim de öyle.
grant execute on function public.uydurma_maddeler(jsonb) to authenticated, anon;

-- Atıf denetimi her istekte çalışacak: taban numaraya göre arama indekslensin.
create index if not exists mevzuat_maddeleri_kanun_taban_idx
  on public.mevzuat_maddeleri (kanun_short, (split_part(btrim(madde_no), '/', 1)));
