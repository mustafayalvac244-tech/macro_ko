-- ATIF DENETİMİNİN KENDİSİNİ ÖLÇEBİLMEK İÇİN KAYIT.
--
-- NEDEN. 0117 ile karar atfı denetimi ürüne girdi ama "ne kadar işe yarıyor"
-- sorusunun cevabı YOK ve tahminle doldurmak yasak. Gerçek yapay zekâ çıktısı
-- üzerinde kaç uydurma atıf yakalandığını ölçmek için API bütçesi gerekiyordu;
-- bütçe yok. Bu tablo, ölçümü GERÇEK KULLANIMDAN toplar: her denetim sonucu
-- sayı olarak buraya düşer, birkaç hafta sonra "şu kadar istekte şu kadar
-- olanaksız atıf yakalandı" cümlesi ÖLÇÜM olarak kurulabilir.
--
-- KULLANICI KİMLİĞİ BİLEREK YOK. İki sebeple:
--   1. ÖLÇÜM KÖRLÜĞÜ. ai_istek.user_id, auth.users'a `on delete cascade` ile
--      bağlı. Ölçüm betikleri geçici kullanıcıyı sonunda sildiği için TAMAMLANMIŞ
--      ölçümlerin harcama satırları da siliniyordu; bu körlük yüzünden sağlıklı
--      koşan bir ölçüm "takıldı" sanılıp iptal edildi ve ölçüm kaybedildi.
--      Aynı tuzağa ikinci kez düşmüyoruz: burada silinecek bir bağ yok.
--   2. Gerek yok. Sorulan soru "kaç kez yakalandı", "kim yakalandı" değil.
--
-- METİN DE SAKLANMIYOR. Atfın kendisi (ör. "2019/12345 E.") avukatın dosyasına
-- dair bilgi taşıyabilir; sayı taşımaz. Yalnız sayı tutuyoruz.

create table if not exists public.atif_denetim_kaydi (
  id bigint generated always as identity primary key,
  olusturuldu timestamptz not null default now(),
  -- 'sohbet' | 'dilekce' | 'mutalaa' | 'belge'
  mod text not null,
  model text,
  toplam integer not null default 0,
  dogrulanan integer not null default 0,
  havuzda_yok integer not null default 0,
  olanaksiz integer not null default 0,
  -- Kanun maddesi denetiminin sonucu da aynı satırda: ikisi birlikte bakılmalı.
  uydurma_madde integer not null default 0
);

comment on table public.atif_denetim_kaydi is
  'Atıf denetimi sonuçlarının sayısal kaydı. Kullanıcı kimliği ve atıf metni BİLEREK tutulmaz.';

create index if not exists atif_denetim_kaydi_zaman_idx
  on public.atif_denetim_kaydi (olusturuldu desc);

-- Tablo hiçbir istemciye açılmaz: yalnız uç işlev (servis anahtarı) yazar,
-- yalnız rapor fonksiyonu okur. RLS açık ve politika YOK — yani anon ve
-- authenticated için tablo tamamen kapalı.
alter table public.atif_denetim_kaydi enable row level security;
revoke all on table public.atif_denetim_kaydi from public, anon, authenticated;
grant select, insert on table public.atif_denetim_kaydi to service_role;

/*
 * DENETİM ÖZETİ — "bu özellik işe yarıyor mu" sorusunun sayısal cevabı.
 *
 * Oran YOK, SAYI var. Yüzde vermek, payda küçükken (ilk haftalarda birkaç yüz
 * istek) olduğundan güçlü bir izlenim yaratır. Kaç istek, kaç atıf, kaç kez
 * yakalandı — üçü ayrı ayrı okunur.
 */
create or replace function public.atif_denetim_ozeti(gun integer default 30)
returns table(
  mod text,
  istek_sayisi bigint,
  atif_sayisi bigint,
  dogrulanan bigint,
  havuzda_yok bigint,
  olanaksiz bigint,
  uydurma_madde bigint
)
language sql
stable
security definer set search_path = public as $$
  select k.mod,
         count(*)                 as istek_sayisi,
         sum(k.toplam)::bigint    as atif_sayisi,
         sum(k.dogrulanan)::bigint,
         sum(k.havuzda_yok)::bigint,
         sum(k.olanaksiz)::bigint,
         sum(k.uydurma_madde)::bigint
  from public.atif_denetim_kaydi k
  where k.olusturuldu >= now() - make_interval(days => greatest(coalesce(gun, 30), 1))
  group by k.mod
  order by istek_sayisi desc;
$$;

comment on function public.atif_denetim_ozeti(integer) is
  'Atıf denetiminin son N gündeki sonucu. Oran değil sayı döner: payda küçükken yüzde yanıltır.';

revoke all on function public.atif_denetim_ozeti(integer) from public, anon, authenticated;
grant execute on function public.atif_denetim_ozeti(integer) to service_role;
