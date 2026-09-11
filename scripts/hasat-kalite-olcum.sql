-- ⚠️ SUPABASE SQL EDITOR UYARISI (bu dosya birden çok SELECT içerir).
-- Editor çok ifadeli bir betikte YALNIZ SON ifadenin sonucunu gösterir. Bu
-- dosyayı olduğu gibi çalıştırırsan yalnızca en alttaki sorgunun tablosunu
-- görürsün — diğerleri koşar ama görünmez. Bu, üç tur boyunca ölçüm sonucunu
-- alamamamızın sebebiydi ve kusur bendeydi, dosyayı çalıştıranda değil.
--
-- İKİ YOL:
--   a) Hepsini tek tabloda isteyen özet için: scripts/hasat-tek-rapor.sql
--   b) Buradaki sorguları TEK TEK seçip (fareyle işaretle) Run'a bas.

-- HASAT KALİTESİ — "en önemli içtihat" kararını verecek ölçümler.
-- ===========================================================================
-- BUGÜNE KADAR CANLIDA ÖLÇÜLENLER:
--   havuz 9.705 karar | son 24 saatte +334 | vektörsüz yalnız 98
--   Yargıtay 3.435 (%35,4) · Danıştay 2.777 (%28,6) · BAM 2.255 (%23,2)
--   · Yerel 1.238 (%12,8)
--   404 terim, hiçbiri bitmemiş
--
-- Yüksek yargı (Yargıtay+Danıştay) havuzun %64'ü. Geri kalan %36 istinaf ve
-- yerel. İlk bakışta "yerel kararları toplamayı bırak, %12,8 kapasite açılır"
-- demek geliyor. AMA ÖNCE ÖLÇMEK GEREK, ÇÜNKÜ:
--
--   harvest-tick'teki kurulOf() bir SON ÇARE etiketi olarak 'Yerel' veriyor:
--       if bölge adliye → BAM ... if anayasa → AYM
--       return 'Yerel';          ← eşleşmeyen HER ŞEY buraya düşüyor
--   Yani `daire` alanı boşsa, beklenmedik yazılmışsa ya da yeni bir mahkeme
--   adı geldiyse karar 'Yerel' sayılıyor. 1.238'in içinde YANLIŞ etiketlenmiş
--   gerçek Yargıtay kararları olabilir. Ölçmeden silmek ya da toplamayı
--   kesmek, emsal değeri olan kararları çöpe atmak olurdu.
--
-- Bu dosya hiçbir şeyi DEĞİŞTİRMEZ, yalnız okur.

-- ── 1) 'Yerel' kutusunun içinde GERÇEKTEN ne var? ───────────────────────────
-- Beklenen: "İstanbul 3. Asliye Hukuk Mahkemesi" gibi adlar.
-- Endişe: boş daire, ya da içinde Yargıtay/Danıştay geçen ama kurulOf'un
--         kaçırdığı yazımlar.
select 'yerel_daire_ornekleri' as olcum,
       coalesce(nullif(trim(daire), ''), '(DAİRE BOŞ)') as daire,
       count(*) as adet
from public.ictihat_kararlar
where kurul = 'Yerel'
group by 2
order by adet desc
limit 25;

-- ── 2) 'Yerel' etiketlilerin kaçı aslında yüksek yargı? ─────────────────────
-- Bu satır kritik: sıfırdan büyükse kurulOf() hatalı sınıflandırıyor demektir
-- ve düzeltilmesi gereken şey hasat değil, sınıflandırıcıdır.
select 'yanlis_etiketlenmis' as olcum,
       count(*) filter (where daire is null or trim(daire) = '') as daire_bos,
       count(*) filter (where daire ilike '%yargıtay%' or daire ilike '%yargitay%') as aslinda_yargitay,
       count(*) filter (where daire ilike '%danıştay%' or daire ilike '%danistay%') as aslinda_danistay,
       count(*) filter (where daire ilike '%bölge%') as aslinda_bolge,
       count(*) as toplam_yerel
from public.ictihat_kararlar
where kurul = 'Yerel';

-- ── 3) Hangi kaynak hangi kurulu getiriyor? ─────────────────────────────────
-- Üç cron işi EŞİT hızda çalışıyor. Bu tablo, eşitliğin doğru olup olmadığını
-- söyleyecek: emsal kaynağı ağırlıkla yerel/istinaf getiriyorsa payı
-- düşürülmeli. Terim öneki kaynağı ele veriyor (yargitay: / danistay: / öneksiz).
select 'kaynak_x_kurul' as olcum,
       case
         when arama_terimi like 'yargitay:%' then 'yargitay kaynağı'
         when arama_terimi like 'danistay:%' then 'danistay kaynağı'
         else 'emsal kaynağı'
       end as kaynak,
       kurul,
       count(*) as adet
from public.ictihat_kararlar
group by 2, 3
order by kaynak, adet desc;

-- ── 4) Öncelik puanı GERÇEKTEN ayrıştı mı? ──────────────────────────────────
-- 0103 uygulanınca hasat_onceligini_tazele() çalıştı. Hepsi 100'de duruyorsa
-- kullanıcı dava karışımı sinyali canlıda da hiçbir şeye dokunmuyor demektir.
select 'oncelik_dagilimi' as olcum, oncelik, count(*) as terim_adedi
from public.ictihat_harvest_state
group by 2
order by 2 desc
limit 15;

-- ── 5) 0103'ün ölü sinyalleri canlı 404 terimde de ölü mü? ──────────────────
-- DÜRÜSTLÜK NOTU: 0103'teki ölçümü depodaki 134 terimlik liste üzerinde
-- yaptım. Canlıda 404 terim var — yani ölçümüm listenin ÜÇTE BİRİNİ kapsıyordu.
-- Bu satır, kaldırdığım iki kuralın canlı listede de gerçekten işe yaramaz
-- olduğunu doğrular ya da beni yalanlar.
select 'olu_sinyal_kontrolu' as olcum,
       count(*) filter (where lower(terim) ~ 'içtihadı birleştirme|ictihadi birlestirme|genel kurul|hgk|cgk') as eski_arti40_eslesen,
       count(*) filter (where lower(terim) ~ 'yerel mahkeme|asliye|sulh'
                          and lower(terim) !~ 'yargıtay|yargitay|danıştay|danistay') as eski_eksi30_eslesen,
       count(*) as toplam_terim
from public.ictihat_harvest_state;

-- ── 6) Terim verimi: hangi terimler havuzu besliyor, hangileri boş dönüyor? ──
-- Hiç karar getirmeyen terimler kotayı boşa harcıyor.
select 'terim_verimi' as olcum,
       case
         when k.adet is null then 'HİÇ KARAR GETİRMEDİ'
         when k.adet < 10 then '1-9 karar'
         when k.adet < 50 then '10-49 karar'
         when k.adet < 200 then '50-199 karar'
         else '200+ karar'
       end as kova,
       count(*) as terim_adedi
from public.ictihat_harvest_state h
left join (
  select arama_terimi, count(*) as adet from public.ictihat_kararlar group by 1
) k on k.arama_terimi = regexp_replace(h.terim, '^(yargitay|danistay):', '')
group by 2
order by 3 desc;
