-- KVKK RIZA KAYDINA İMZA KANITI — "okudu ve imzaladı" iddiasının dayanağı.
-- ===========================================================================
-- NEDEN. Kayıt ekranı artık aydınlatma metnini tam gövdesiyle açıyor, metnin
-- sonuna gelinmesini bekliyor ve beyanı orada imzalatıyor. Bu akışın bir
-- DEĞERİ olması için, imzanın hangi koşulda atıldığının kaydı da tutulmalı;
-- tutulmazsa "avukat metni okuyup imzaladı" cümlesi bir iddia olarak kalır ve
-- uyuşmazlıkta gösterilecek hiçbir şey olmaz.
--
-- ⚠️ DÜRÜSTLÜK SINIRI — BU BİR OKUMA KANITI DEĞİLDİR. Ölçtüğümüz iki olgu var:
--   • sona_gelindi : metnin tamamı ekrandan geçirildi mi,
--   • saniye       : metin penceresi kaç saniye açık kaldı.
-- İnsan metni kaydırıp geçebilir; "okudu" sonucunu bu veriden ÇIKARAMAYIZ.
-- Kaydın anlamı şudur: metnin tamamı kullanıcının önüne kondu ve kullanıcı
-- okuduğunu BEYAN ederek imzaladı. Sütun adı bu yüzden `kanit` (koşulun
-- kanıtı), `okundu` değil — sütun adı da yalan söylememeli.
--
-- Tabloya EKLEMELİ günlük mantığı dokunulmuyor: satır güncellenmiyor,
-- silinmiyor; rızanın geri alınması yine ayrı bir satır.

alter table public.kvkk_onay
  add column if not exists kanit jsonb;

comment on column public.kvkk_onay.kanit is
  'İmza koşulunun ölçülmüş kanıtı: {saniye, sona_gelindi, yontem, surum}. '
  'Okuma kanıtı DEĞİL — metnin tamamının gösterildiği ve kullanıcının okuduğunu '
  'beyan ederek imzaladığı olgusunu kaydeder.';

-- Tetikleyici, kanıtı üstveriden alıp yazsın. `->` ile okunuyor (nesne),
-- `->>` ile değil: `->>` metne çevirir ve jsonb sütuna yazılırken kaçışlı bir
-- STRING olarak düşerdi, sorgulanamayan bir hâl.
create or replace function public.kvkk_onay_kaydet()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  riza  boolean;
  surum text;
  kanit jsonb;
begin
  riza  := coalesce((new.raw_user_meta_data ->> 'kvkk_riza')::boolean, false);
  surum := nullif(new.raw_user_meta_data ->> 'kvkk_surum', '');
  kanit := new.raw_user_meta_data -> 'kvkk_kanit';

  -- Üstveri istemciden gelir: nesne olmayan bir şey gönderilirse (dizi, sayı,
  -- metin) sütuna yazmayız. Kanıt alanının biçimi bozuksa kanıt YOK sayılır —
  -- bozuk bir kanıdı "var" saymak, olmayan delili varmış gibi göstermektir.
  if kanit is null or jsonb_typeof(kanit) <> 'object' then
    kanit := null;
  end if;

  if riza and surum is not null then
    insert into public.kvkk_onay (user_id, tur, surum, onay, kaynak, kanit)
    values (new.id, 'yurtdisi_ai', surum, true, 'kayit', kanit);
  end if;

  return new;
end;
$$;

-- Doğrulama.
select
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'kvkk_onay' and column_name = 'kanit') as kanit_sutunu,
  (select count(*) from public.kvkk_onay where kanit is not null) as kanitli_satir,
  (select count(*) from pg_trigger where tgname = 'kvkk_onay_kayit_tetik') as tetikleyici;
