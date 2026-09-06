-- BESLENEN KURALIN ATLANDIĞINI GÖREBİLMEK.
--
-- ÖLÇÜLEN ARIZA (mütalaa koşusu, beş senaryonun ikisi). Her iki kusur da aynı
-- kökten geliyordu ve ikisi de KORPUS EKSİĞİ DEĞİLDİ — doğru kural havuzda
-- vardı, aramada da çıkıyordu, dosyaya da giriyordu; model onu yok saydı:
--
--   • İşe iade: ise_iade kuralı "fesih bildiriminin TEBLİĞİNDEN İTİBAREN 1 AY
--     içinde ARABULUCUYA başvurmak zorundadır (dava şartı)" diyor. Model
--     "4 hafta içinde dava açın" yazdı ve arabuluculuktan hiç söz etmedi.
--     Arabulucuya gidilmeden açılan dava USULDEN REDDEDİLİR: bu, tavsiyeye
--     uyan avukat için doğrudan hak kaybıdır.
--   • Trafik kazası: trafik_zamanasimi kuralı, kaza aynı zamanda suç
--     oluşturuyorsa CEZA zamanaşımının (daha uzun) uygulanacağını söylüyor.
--     Model yalnız iki yıllık süreyi yazdı; müvekkilin hâlâ dava açabileceği
--     bir dosyayı "zamanaşımına uğradı" saymaya götüren bir eksik.
--
-- İstem zaten "her kuralın olaya etkisini açıkça yaz, sessizce atlama" diyor.
-- Talimat tutmadı. Küçük modellerde koşudan koşuya değişiyor ve talimatla
-- tamamen giderilemiyor — ama ATLANDIĞINI GÖREBİLİRİZ.
--
-- Her kural için, o kuralın karşılığı metinde geçmiyorsa kuralın atlandığını
-- gösteren AYIRT EDİCİ terimler tutuluyor. Bir öğe '|' ile ayrılmış seçenekler
-- içerebilir; herhangi biri geçiyorsa kural işlenmiş sayılır.
--
-- YALNIZ UYARI ÜRETİR, hak düşürmez. Arama en iyi üç kuralı getiriyor ve
-- üçüncüsü konuyla teğet olabilir; teğet bir kuralın terimi geçmedi diye
-- çalışan bir mütalaayı kusurlu saymak, düzeltmeye çalıştığımız şeyden çok
-- zarar verirdi. Karar avukatın: uyarıyı görür, haksız bulursa "işe yaramadı"
-- der ve hakkını geri alır.

alter table public.legal_rules add column if not exists zorunlu_terimler text[] default '{}';

comment on column public.legal_rules.zorunlu_terimler is
  'Kural dosyaya girdiği hâlde cevapta işlenmediğini gösteren ayırt edici terimler; '
  '''|'' ile ayrılmış seçenekler "herhangi biri" demektir. Yalnız uyarı üretir.';

-- ATLANMASI HAK KAYBI OLAN KURALLAR. Liste bilerek dar: yanlış uyarı,
-- uyarının tamamını gürültüye çevirir ve avukat bir daha hiçbirine bakmaz.
-- Ölçütler — (a) atlanması usulden ret ya da süre kaçırma sonucu doğuruyor,
-- (b) terim ayırt edici, yani konuyu işleyen her metinde zaten geçer.
update public.legal_rules set zorunlu_terimler = t.terimler
from (values
  -- Dava şartları: atlanırsa dava usulden reddedilir.
  ('ise_iade',                       array['arabulucu']),
  ('arabuluculuk_dava_sarti_kapsam', array['arabulucu']),
  ('tuketici_hakem_heyeti',          array['hakem heyeti']),
  -- Süreler: atlanırsa hak düşer.
  ('trafik_zamanasimi',              array['ceza zamanaşımı|uzamış|daha uzun']),
  ('idari_dava_suresi',              array['altmış gün|60 gün']),
  ('is_kazasi_zamanasimi',           array['10 yıl|on yıl']),
  ('iscilik_zamanasimi',             array['5 yıl|beş yıl']),
  ('cevap_dilekcesi_suresi',         array['iki hafta|2 hafta']),
  ('bilirkisi_rapor_itiraz',         array['iki hafta|2 hafta']),
  ('mesafeli_cayma',                 array['14 gün|on dört gün']),
  ('tenkis_sure',                    array['1 yıl|bir yıl']),
  -- Merci: itiraz mahkemeye değil icra dairesine yapılır; karıştırmak süreyi
  -- geçirtir.
  ('odeme_emrine_itiraz',            array['icra daire']),
  -- Tek kullanımlık hak: ikinci kez ıslah yoktur.
  ('islah_bir_kez',                  array['bir kez|bir defa|yalnız bir'])
) as t(id, terimler)
where legal_rules.id = t.id;

-- Aramanın terimleri de döndürmesi gerekiyor; dönüş tipi değiştiği için
-- işlevin önce düşürülmesi şart.
drop function if exists public.search_legal_rules(text, integer);

create or replace function public.search_legal_rules(q text, match_count integer default 3)
returns table(id text, body text, score real, zorunlu_terimler text[])
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  stop text[] := array['dava','davasi','davasinda','davada','davaya','davanin','acilir','acilan','acmak','acilmasi',
    'sure','suresi','suresinde','surede','surenin','kac','yil','yili','gun','gunu','ay','ayi','hafta',
    'madde','maddesi','kanun','kanunu','hukuk','hukuki','hukuku','mahkeme','mahkemesi','mahkemede',
    'hakim','karar','karari','taraf','tarafi','kisi','kisinin','nedir','midir','mudur','var','yok',
    'ile','icin','olan','olarak','veya','gibi','bir','bu','ne','kadar','hangi','bagli','basvuru',
    'nasil','ise','yani','hem','daha','cok','vardir','olur','gerekir','ben','bana','benim','yapabilirim'];
  q_clean text; q_or text; tsq tsquery;
begin
  select string_agg(w,' ') into q_clean from (
    select w from unnest(regexp_split_to_array(lower(coalesce(q,'')), '[^0-9a-zğüşıöçâîû]+')) w
    where length(w) >= 3 and translate(w,'ğüşıöçâîû','gusiocaiu') <> all(stop)
  ) t;
  if q_clean is null or q_clean='' then return; end if;
  select string_agg(lexeme,' | ') into q_or from unnest(to_tsvector('turkish', q_clean));
  if q_or is null or q_or='' then return; end if;
  -- 'simple': lexeme'ler zaten indirgenmiş, ikinci kez indirgenmesin.
  tsq := to_tsquery('simple', q_or);
  return query
    select r.id, r.body, ts_rank(r.fts, tsq) as score, coalesce(r.zorunlu_terimler, '{}'::text[])
    from public.legal_rules r
    where r.fts @@ tsq
    order by score desc, r.id
    limit match_count;
end;
$function$;

grant execute on function public.search_legal_rules(text, integer) to authenticated, anon;
