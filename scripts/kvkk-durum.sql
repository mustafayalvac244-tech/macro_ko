-- KVKK RIZA ENVANTERİ — "denetimi açarsak kimi keseriz?"
-- ===========================================================================
-- NEDEN BU DOSYA VAR. Yapay zekâ uçlarında rıza DENETİMİ hâlâ yok: rıza kaydı
-- olmayan bir kullanıcının yazdığı metin de ABD'ye gidiyor. Denetimi açmak
-- doğru olan, ama kaç kişiyi kapıda bırakacağını BİLMEDEN açmak körlemesine
-- iş yapmaktır. Bu rapor o sayıyı verir.
--
-- Üç ayrı grubu karıştırmamak şart:
--   • rızası VAR            → denetim açılınca hiçbir şey değişmez
--   • rızasını GERİ ALMIŞ   → zaten kapanmasını kendisi istemiş
--   • hiç KAYDI YOK         → denetim açılınca kesilecek olan grup. Çoğu,
--                             rıza akışı yazılmadan önce kaydolmuş olabilir;
--                             "reddetti" DEĞİL, "hiç sorulmadı" demektir.
--
-- Son grubun içinde de ayrım var: son 30 günde yapay zekâ kullanmış olanlar
-- kesintiyi HEMEN hisseder, kullanmayanlar farkı görmez bile.
--
-- Hiçbir şeyi DEĞİŞTİRMEZ, yalnız okur.
--
-- NOT — bu dosyada üçüncü kez düşülebilecek tuzak: `group by` KONUM
-- numarasıdır ve seçim listesi (sira, bolum, alan, deger) olduğu için
-- gruplanacak ifade 3. konumdadır. `group by 2` sabit bölüm metnine göre
-- gruplar ve 42803 ile düşer.

with son_riza as (
  -- Her kullanıcının EN SON satırı. Günlük eklemeli olduğu için "şu anki
  -- durum" sorusunun cevabı budur; önceki satırlar geçmiştir, silinmez.
  select distinct on (o.user_id)
         o.user_id, o.onay, o.surum, o.verildi_at, o.kanit
  from public.kvkk_onay o
  where o.tur = 'yurtdisi_ai'
  order by o.user_id, o.verildi_at desc, o.id desc
),
ai_son30 as (
  -- `gun` METİN sütunudur (canlıda 42883 ile öğrenildi); ISO biçiminde
  -- tutulduğu için metin karşılaştırması tarih sırasıyla aynı sonucu verir.
  select distinct i.user_id
  from public.ai_istek i
  where i.gun >= (current_date - 30)::text and i.user_id is not null
),
kullanici as (
  select u.id,
         coalesce(nullif(p.ai_tier, ''), 'ücretsiz') as katman,
         r.user_id is not null as kayit_var,
         coalesce(r.onay, false) as riza,
         (a.user_id is not null) as ai_kullandi
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join son_riza r on r.user_id = u.id
  left join ai_son30 a on a.user_id = u.id
),
satirlar as (
  select 10::numeric as sira, 'ÖZET' as bolum, 'toplam hesap' as alan,
         count(*)::text as deger from kullanici
  union all
  select 11, 'ÖZET', 'son 30 günde yapay zekâ kullanan hesap',
         count(*) filter (where ai_kullandi)::text from kullanici

  union all
  select 20, 'RIZA', 'rızası VAR (en son kayıt onay)',
         count(*) filter (where kayit_var and riza)::text from kullanici
  union all
  select 21, 'RIZA', 'rızasını GERİ ALMIŞ',
         count(*) filter (where kayit_var and not riza)::text from kullanici
  union all
  select 22, 'RIZA', '>> hiç KAYDI YOK (hiç sorulmamış)',
         count(*) filter (where not kayit_var)::text from kullanici

  -- ASIL SORU: denetimi bugün açsak kaç kişi duvara çarpar?
  union all
  select 30, 'ETKİ', '>> kaydı yok VE son 30 günde ai kullandı',
         count(*) filter (where not kayit_var and ai_kullandi)::text from kullanici
  union all
  select 31, 'ETKİ', 'kaydı yok ama ai da kullanmamış (fark etmez)',
         count(*) filter (where not kayit_var and not ai_kullandi)::text from kullanici

  -- Ödeyen üyeyi kesmek en pahalı hata olur; ayrı sayılıyor.
  union all
  select 40, 'KATMAN', katman,
         count(*) || ' hesap · rızalı ' || count(*) filter (where kayit_var and riza)
         || ' · kayıtsız ' || count(*) filter (where not kayit_var)
         || ' · kayıtsız+aktif ' || count(*) filter (where not kayit_var and ai_kullandi)
  from kullanici group by 3

  -- Kanıtın ne kadarı gerçekten yazılmış (0130 sonrası imzalar).
  union all
  select 50, 'KANIT', 'rıza satırı (tüm geçmiş)',
         count(*)::text from public.kvkk_onay
  union all
  select 51, 'KANIT', 'kanıt alanı dolu satır',
         count(*) filter (where kanit is not null)::text from public.kvkk_onay
  -- Sürüm ALAN sütununa yazılıyor, DEĞER'e değil: aynı `alan` değerine sahip
  -- birden çok satır olsaydı son sıralama (sira, alan) onları rastgele
  -- dizerdi ve rapor her koşuda başka görünürdü.
  union all
  select 52, 'KANIT', 'sürüm ' || surum, count(*)::text || ' satır'
  from public.kvkk_onay group by 3
)
select bolum, alan, deger from satirlar order by sira, alan;
