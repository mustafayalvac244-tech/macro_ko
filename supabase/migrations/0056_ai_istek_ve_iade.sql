-- İSTEK KAYDI VE HAK İADESİ.
--
-- SORUN. Kullanıcı bir soru sorup işe yaramaz bir cevap aldığında hem parası
-- (kontör) hem günlük hakkı gidiyordu. Bir avukat için bu, "program beni
-- oyaladı ve üstüne hakkımı yedi" demek; üründen soğutan şey tam olarak budur.
--
-- Kusurlu çıktının bir kısmını MEKANİK yakalıyoruz (zorunlu bölümü eksik ya da
-- yarım kesilmiş taslak) ve onu zaten hakka yazmıyoruz. Ama bir metin yapısal
-- olarak kusursuz görünüp hukuken işe yaramaz olabilir; bunu ancak avukat
-- bilir. Bu yüzden "işe yaramadı" diyebilmeli ve hakkını geri alabilmeli.
--
-- İADE İÇİN İSTEK KAYDI ŞART. Hangi isteğin iade edildiği tutulmazsa aynı
-- istek defalarca iade edilebilir. Tablo istek başına tek satır; küçük ve
-- kişisel veri taşımaz (soru metni SAKLANMAZ — yalnız ölçü bilgileri).
--
-- YAN FAYDA: iade oranı, kalitenin en dürüst göstergesi. Ölçüm senaryoları bizim
-- yazdığımız; iade, gerçek dosyada işe yaramadığını KULLANICININ söylemesidir.

create table if not exists public.ai_istek (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gun text not null,
  mod text not null,
  model text,
  tokens_in integer not null default 0,
  tokens_out integer not null default 0,
  maliyet_try numeric(12,4) not null default 0,
  -- Hak/kontör düşüldü mü? Mekanik olarak kusurlu bulunan çıktılarda baştan false.
  musteriye_yazildi boolean not null default true,
  iade_edildi boolean not null default false,
  iade_sebep text,
  olusturuldu timestamptz not null default now()
);

create index if not exists ai_istek_kullanici_gun on public.ai_istek (user_id, gun);

alter table public.ai_istek enable row level security;

drop policy if exists ai_istek_read on public.ai_istek;
create policy ai_istek_read on public.ai_istek
  for select to authenticated using (user_id = auth.uid());

revoke insert, update, delete on public.ai_istek from authenticated, anon;

/**
 * Hak iadesi. Günlük çağrı sayacını bir azaltır ve kontörü geri yükler.
 *
 * Yalnız SAHİBİ iade edebilir ve yalnız BİR KEZ: aksi hâlde aynı istek
 * defalarca iade edilip günlük hak sınırsız hâle gelirdi.
 */
create or replace function public.ai_istek_iade(p_istek uuid, p_user uuid, p_sebep text default null)
returns jsonb
language plpgsql
security definer set search_path = public as $$
declare r public.ai_istek;
begin
  select * into r from public.ai_istek where id = p_istek and user_id = p_user;
  if not found then
    return jsonb_build_object('ok', false, 'neden', 'bulunamadi');
  end if;
  if r.iade_edildi then
    return jsonb_build_object('ok', false, 'neden', 'zaten_iade');
  end if;

  update public.ai_istek set iade_edildi = true, iade_sebep = left(coalesce(p_sebep, ''), 300) where id = p_istek;

  -- Müşteriye hiç yazılmamışsa (mekanik kusur) geri verilecek bir şey yok;
  -- iade yine kaydedilir, çünkü kalite göstergesi olarak değerlidir.
  if not r.musteriye_yazildi then
    return jsonb_build_object('ok', true, 'iade_try', 0, 'hak', 0);
  end if;

  -- Günlük çağrı sayacı bir azalır (negatife düşmesin).
  update public.ai_usage
     set calls = greatest(0, calls - 1), updated_at = now()
   where user_id = p_user and period = r.gun;

  if r.maliyet_try > 0 then
    update public.ai_kontor
       set bakiye_try = bakiye_try + r.maliyet_try,
           toplam_harcanan_try = greatest(0, toplam_harcanan_try - r.maliyet_try),
           guncellendi = now()
     where user_id = p_user;
  end if;

  return jsonb_build_object('ok', true, 'iade_try', r.maliyet_try, 'hak', 1);
end;
$$;

grant execute on function public.ai_istek_iade(uuid, uuid, text) to service_role;
