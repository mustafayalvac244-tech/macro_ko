-- "AI" KATMANI KOTASINI ATOMİK HALE GETİR — 0073'teki YARIŞ DURUMU (race
-- condition) düzeltmesi.
--
-- BULUNAN AÇIK. 0073'teki ai_mod_sayaci "önce SAY, sonra KARAR VER, en sonda
-- İSTEK BİTİNCE KAYDET" deseniydi: istek Claude'a gidip dönene kadar (birkaç
-- saniye, mütalaada çok adımlı olduğu için daha uzun) SAYIM HİÇ GÜNCELLENMEZ.
-- Yani aynı kullanıcı adına art arda değil AYNI ANDA (eşzamanlı) 50 istek
-- gönderilirse, hepsi "kotam dolmamış" görüp hepsi geçer — kota, tam da
-- korumak için var olduğu senaryoda (kötüye kullanım ya da bozuk bir
-- istemcinin döngüye girmesi) işlemez. Bu, kontör sisteminin AYNI SINIFTAN
-- kusuru için zaten çözülmüştü (bkz. 0055 > ai_kontor_dus: "Tek deyimde
-- yapılır: iki eşzamanlı istek aynı bakiyeyi iki kez harcayamasın") — kota
-- eklenirken bu ilke unutulmuştu.
--
-- ÇÖZÜM: kontördeki İLE AYNI DESEN — SATIR KİLİDİ (SELECT ... FOR UPDATE).
-- İstek BAŞLAMADAN ÖNCE, TEK bir veritabanı işleminde "say VE artır" atomik
-- yapılır. Aynı anda gelen ikinci istek, birincinin işlemi bitene kadar bu
-- satırda BEKLER — yani "kontrol" ile "yazma" arasında hiçbir yarış penceresi
-- kalmaz. Postgres'in kendisi sıraya koyar, bizim kodumuz değil.
--
-- KUSURLU ÇIKTIDA HAK GİTMEZ İLKESİ KORUNUYOR (bkz. 0056). Rezervasyon
-- İSTEK BAŞLAMADAN yapıldığı için, çıktı kusurlu çıkarsa (yarım dilekçe,
-- eksik bölüm) rezervasyon GERİ VERİLİR (ai_mod_serbest_birak) — aksi hâlde
-- bizim hatamızın bedelini avukatın aylık kotası öderdi.
create table if not exists public.ai_mod_kota (
  user_id uuid not null references auth.users(id) on delete cascade,
  ay text not null,
  soru integer not null default 0,
  mutalaa integer not null default 0,
  guncellendi timestamptz not null default now(),
  primary key (user_id, ay)
);

alter table public.ai_mod_kota enable row level security;

drop policy if exists ai_mod_kota_read on public.ai_mod_kota;
create policy ai_mod_kota_read on public.ai_mod_kota
  for select to authenticated using (user_id = auth.uid());

revoke insert, update, delete on public.ai_mod_kota from authenticated, anon;

/**
 * Bir soru/mütalaa hakkını ATOMİK biçimde rezerve eder. Limit dolmuşsa
 * hiçbir şey değiştirmeden false döner; doluymuşsa sayaç ARTAR ve true döner.
 *
 * "SELECT ... FOR UPDATE" satırı kilitler: bu fonksiyonu AYNI (user_id, ay)
 * için aynı anda çağıran ikinci bir istek, birincinin işlemi (transaction)
 * bitene kadar burada bekler. Bu yüzden eşzamanlı istekler kotayı ASLA
 * birlikte aşamaz — kontrol ve artırma tek, bölünemez adımdır.
 */
create or replace function public.ai_mod_rezerve_et(
  p_user uuid,
  p_ay text,
  p_mutalaa boolean,
  p_soru_limit integer,
  p_mutalaa_limit integer
)
returns boolean
language plpgsql
security definer set search_path = public as $$
declare
  guncel_soru integer;
  guncel_mutalaa integer;
begin
  insert into public.ai_mod_kota (user_id, ay, soru, mutalaa)
  values (p_user, p_ay, 0, 0)
  on conflict (user_id, ay) do nothing;

  select soru, mutalaa into guncel_soru, guncel_mutalaa
  from public.ai_mod_kota
  where user_id = p_user and ay = p_ay
  for update;

  if p_mutalaa then
    if guncel_mutalaa >= p_mutalaa_limit then
      return false;
    end if;
    update public.ai_mod_kota set mutalaa = mutalaa + 1, guncellendi = now()
      where user_id = p_user and ay = p_ay;
  else
    if guncel_soru >= p_soru_limit then
      return false;
    end if;
    update public.ai_mod_kota set soru = soru + 1, guncellendi = now()
      where user_id = p_user and ay = p_ay;
  end if;

  return true;
end;
$$;

/**
 * Kusurlu çıktıda rezerve edilen hakkı geri verir. Sıfırın altına düşmez
 * (greatest ile korunuyor) — aynı isteğin yanlışlıkla iki kez serbest
 * bırakılması sayaç negatife düşürüp gelecekteki kontrolleri bozmasın.
 */
create or replace function public.ai_mod_serbest_birak(p_user uuid, p_ay text, p_mutalaa boolean)
returns void
language sql
security definer set search_path = public as $$
  update public.ai_mod_kota
  set soru = greatest(0, soru - case when not p_mutalaa then 1 else 0 end),
      mutalaa = greatest(0, mutalaa - case when p_mutalaa then 1 else 0 end),
      guncellendi = now()
  where user_id = p_user and ay = p_ay
$$;

grant execute on function public.ai_mod_rezerve_et(uuid, text, boolean, integer, integer) to service_role;
grant execute on function public.ai_mod_serbest_birak(uuid, text, boolean) to service_role;

-- ai_mod_sayaci (0073) ARTIK KULLANILMIYOR — yerini ai_mod_kota'nın kendi
-- sayaçları aldı (rezervasyon anında güncellenir, istek bitince değil).
-- Düşürülmüyor: geçmiş ay verisini (ai_istek üzerinden) sorgulamak için hâlâ
-- işe yarayabilir, dashboard/denetim amaçlı zararsız kalır.
