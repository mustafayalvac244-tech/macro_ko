-- ZAMAN / ÇALIŞMA KAYDI.
-- ---------------------------------------------------------------------------
-- NEDEN. Rakip taramasında (RAKIP-OZELLIK-ANALIZI.md) ölçülen en büyük boşluk
-- buydu: Clio, MyCase, PracticePanther ve Smokeball'un dördünde de zaman kaydı
-- çekirdek özellik; bizim şemamızda `minutes`, `billable`, saatlik ücret diye
-- bir şey hiç yoktu.
--
-- TÜRKİYE İTİRAZI VE CEVABI. Avukatların çoğu saat başı çalışmıyor, nispi
-- vekalet ücreti alıyor. Ama kayıt yalnız fatura için değildir:
--   • nispi ücretli dosyada da "hangi dosya zamanımı yiyor" sorusunun cevabı
--   • kurumsal/danışmanlık işinde saatlik ücret zaten var
--   • tevkil verirken "bu iş ne kadar sürdü" diye bakılacak tek yer
-- Bu yüzden `billable` varsayılanı true AMA saatlik ücret ZORUNLU DEĞİL.
-- Ücretsiz de kayıt tutulabilir; süre yine toplanır, tutar 0 görünür.
--
-- case_id NEDEN NULL OLABİLİYOR. Her çalışma bir dosyaya ait değil: büro işi,
-- eğitim, ilk görüşme. Bunları kaydedemezsek avukat gününün bir kısmını
-- göremez ve "dosyalar toplam 3 saat, ben 9 saat çalıştım" boşluğu açıklanamaz
-- kalır. Dosyasız kayıtlar raporda ayrı satırda toplanır.

alter table profiles add column if not exists hourly_rate numeric
  check (hourly_rate is null or hourly_rate >= 0);

comment on column profiles.hourly_rate is
  'Varsayılan saatlik ücret (₺). Yeni zaman kaydı formunu ön-doldurur; kayda '
  'kopyalanır, sonradan değişmesi eski kayıtları BOZMAZ.';

create table if not exists time_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  -- Dosya silinince o dosyanın çalışma kaydı da gider: case_expenses ile aynı
  -- davranış. "set null" seçilseydi kayıt sessizce "dosyasız"a düşer ve
  -- raporda açıklanamayan bir yığın oluştururdu.
  case_id uuid references cases (id) on delete cascade,
  description text not null check (length(trim(description)) > 0),
  -- Üst sınır bir gün. Tek kayıtta 1440'tan fazla dakika, neredeyse her zaman
  -- parmak hatasıdır (saat yerine dakika yazmak gibi) ve raporu bozar.
  minutes integer not null check (minutes > 0 and minutes <= 1440),
  worked_at timestamptz not null default now(),
  billable boolean not null default true,
  -- Kaydın KENDİ ücreti. Profildeki varsayılanın kopyası; tarifesini yıl
  -- ortasında değiştiren avukatın geçmiş kayıtları geriye dönük değişmesin
  -- diye referans değil kopya tutuluyor.
  hourly_rate numeric check (hourly_rate is null or hourly_rate >= 0),
  -- Tutar veritabanında hesaplanır ki uygulama ile rapor asla ayrışmasın.
  -- Ücretlendirilmeyen ya da ücreti girilmemiş kayıt 0 verir — NULL değil,
  -- çünkü toplamda NULL bütün toplamı NULL yapardı.
  amount numeric generated always as (
    case
      when billable and hourly_rate is not null
        then round(hourly_rate * minutes / 60.0, 2)
      else 0
    end
  ) stored,
  created_at timestamptz not null default now()
);

-- Dosya ekranı: bu dosyanın kayıtları, yeniden eskiye.
create index if not exists time_entries_case_idx
  on time_entries (case_id, worked_at desc);
-- Rapor ve "bu hafta ne kadar çalıştım": sahibin tüm kayıtları, tarihe göre.
create index if not exists time_entries_owner_idx
  on time_entries (owner_id, worked_at desc);

alter table time_entries enable row level security;
drop policy if exists "time_entries own" on time_entries;
create policy "time_entries own" on time_entries
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Yabancı anahtar owner_id'yi zorluyor ama case_id BAŞKASININ dosyası
-- olabilirdi: RLS yalnız satırın owner_id'sine bakar, işaret ettiği dosyaya
-- bakmaz. Bu tetikleyici olmadan, bir kullanıcı başka bir avukatın dosya
-- kimliğini ele geçirirse ona kayıt iliştirebilirdi (görüntüleyemez ama
-- o dosya silinince kaydı da silinir — sessiz veri kaybı).
create or replace function time_entries_dosya_sahibi()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.case_id is not null
     and not exists (
       select 1 from cases
        where id = new.case_id and owner_id = new.owner_id
     ) then
    raise exception 'time_entries.case_id baska bir kullanicinin dosyasi';
  end if;
  return new;
end;
$$;

drop trigger if exists time_entries_dosya_sahibi_t on time_entries;
create trigger time_entries_dosya_sahibi_t
  before insert or update on time_entries
  for each row execute function time_entries_dosya_sahibi();
