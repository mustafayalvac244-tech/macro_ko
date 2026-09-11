-- MEVZUAT ARAMASI %58,8 — TEŞHİS + ADAY SIRALAYICILARIN SQL İÇİNDE ÖLÇÜMÜ.
-- ŞEMA DEĞİŞTİRMEZ; yalnız geçici tablo/fonksiyon. Tekrar uygulanabilir.
-- ===========================================================================
-- ÖLÇÜM (eval-arama, canlı, 2026-09-11 20:23): 68 beklenen maddenin 40'ı ilk
-- 7 sonuçta (%58,8), 28 soru kaçırıyor. Kalıp: gündelik dille sorulan soruda
-- hedef maddenin KOMŞULARI dönüyor, kendisi dönmüyor (HMK 389 yerine
-- 390-397; TMK 605 yerine 640/672; TKHK 11 yerine 10).
--
-- search_mevzuat_fts (0067) sorguyu OR ile kuruyor ve ts_rank(fts_w2) ile
-- sıralıyor. Soru cümlesindeki dolgu fiiller ("istiyorum", "yapabilirim",
-- "edebilir miyim") stopA'da YOK; kanun metninde çok geçen "istemek/yapmak"
-- kökleriyle eşleşip gürültü üretiyor olabilir. Ama bu bir TAHMİN; bu dosya
-- her soru için sebebi ve dört aday sıralayıcının isabetini ÖLÇER:
--
--   v0  canlı fonksiyon (referans)
--   v1  ÖNCE AND (tüm terimler), dolmazsa OR — 0111'deki yaklaşım
--   v2  v1 + soru dolgularını (istiyorum, yapabilirim, …) sorgudan ayıklama
--   v3  v2 + 4 harf önek (simple) puanını sıralamaya KATMA (tier değil, toplam)
--
-- Sonuç: önce özet (varyant → isabet@7 / 68), sonra v0'ın kaçırdığı her soru
-- için "madde havuzda var mı" ve dört varyanttaki sırası. Karar buradan.

create temp table sorular (id int, soru text, kanun text, madde text);
insert into sorular values
  (1, 'kiracı kirayı ödemiyor tahliye etmek istiyorum ne yapmalıyım', 'TBK', '315'),
  (1, 'kiracı kirayı ödemiyor tahliye etmek istiyorum ne yapmalıyım', 'HMK', '4'),
  (2, 'kira nedeniyle tahliye davası hangi mahkemede açılır', 'HMK', '4'),
  (3, 'istinafa başvurmak için kaç günüm var', 'HMK', '345'),
  (4, 'bölge adliye mahkemesi kararını temyiz edebilir miyim', 'HMK', '361'),
  (5, 'boşanıyorum eşim bana nafaka ödemek zorunda mı', 'TMK', '175'),
  (6, 'eşimle şiddetli geçimsizlik var boşanma davası açacağım', 'TMK', '166'),
  (7, 'işçinin ücreti ödenmiyor sözleşmeyi feshedebilir mi', 'İşK', '24'),
  (8, 'işçi işyerinde hırsızlık yaptı tazminatsız çıkarabilir miyim', 'İşK', '25'),
  (9, 'belirsiz süreli sözleşmede ihbar öneli ne kadar', 'İşK', '17'),
  (10, 'alacağım için en geç kaç yıl içinde dava açmalıyım', 'TBK', '146'),
  (11, 'kira bedeli alacağında zamanaşımı kaç yıldır', 'TBK', '147'),
  (12, 'bilirkişi raporuna itiraz için ne kadar sürem var', 'HMK', '281'),
  (13, 'hakimin verdiği kesin süreyi kaçırırsam ne olur', 'HMK', '94'),
  (14, 'dava dilekçesinde hangi bilgiler bulunmak zorunda', 'HMK', '119'),
  (15, 'cevap dilekçesi vermek için kaç haftam var', 'HMK', '127'),
  (16, 'açtığım davayı ıslah edebilir miyim', 'HMK', '176'),
  (17, 'karşı tarafın malı üzerine ihtiyati tedbir koydurmak istiyorum', 'HMK', '389'),
  (18, 'mahkeme görevsizlik kararı verdi şimdi ne yapmalıyım', 'HMK', '20'),
  (19, 'davacı alacağın miktarını baştan tam olarak belirleyemiyorsa davasını nasıl açar', 'HMK', '107'),
  (20, 'mahkemenin esasa girmeden kendiliğinden araştırdığı hususlar nelerdir', 'HMK', '114'),
  (21, 'tanık dinletmek istiyorum mahkemeye nasıl bildiririm', 'HMK', '240'),
  (22, 'mirası reddetmek istiyorum nasıl yapabilirim', 'TMK', '605'),
  (23, 'mirasçı olduğumu belgelemek için nereye başvurmalıyım', 'TMK', '598'),
  (24, 'tapusuz taşınmazı yirmi yıldır kullanıyorum adıma tescil ettirebilir miyim', 'TMK', '713'),
  (25, 'haksız fiilden doğan tazminat isteminde zamanaşımı ne kadardır', 'TBK', '72'),
  (26, 'komşum bahçemdeki ağaçlara zarar verdi tazminat isteyebilir miyim', 'TBK', '49'),
  (27, 'borçlu edimini hiç yerine getirmedi uğradığım zararı isteyebilir miyim', 'TBK', '112'),
  (28, 'sosyal medyada hakkımda hakaret içerikli paylaşım yapıldı ne yapabilirim', 'TCK', '125'),
  (29, 'otuz işçi çalışan işyerinde işten çıkarma için geçerli sebep aranır mı', 'İşK', '18'),
  (30, 'işveren geçersiz sebeple işten çıkardı işe iade edilirsem ne alırım', 'İşK', '21'),
  (31, 'savcılık takipsizlik kararı verdi buna itiraz edebilir miyim', 'CMK', '173'),
  (32, 'tutuklama kararı verilebilmesi için hangi şartlar aranır', 'CMK', '100'),
  (33, 'uzlaştırma hangi suçlarda uygulanabilir', 'CMK', '253'),
  (34, 'kamu davasında dava zamanaşımı süreleri nedir', 'TCK', '66'),
  (35, 'tacir hangi ticari defterleri tutmak zorundadır', 'TTK', '64'),
  (36, 'boşanmada çocuğun velayeti kimde kalır', 'TMK', '335'),
  (37, 'edinilmiş mallara katılma rejimi neleri kapsar', 'TMK', '218'),
  (38, 'sözleşmede faiz kararlaştırılmamışsa temerrüt faizi ne olur', 'TBK', '120'),
  (39, 'borçlu verilen sürede borcunu ifa etmezse alacaklının hakları nelerdir', 'TBK', '125'),
  (40, 'sebepsiz zenginleşen kişiden iade istenebilir mi', 'TBK', '77'),
  (41, 'fazla çalışma ücreti nasıl ödenir', 'İşK', '41'),
  (42, 'yıllık ücretli izin hakkı ne zaman doğar ve kaç gündür', 'İşK', '53'),
  (43, 'dava masraflarını karşılayamıyorum adli yardım alabilir miyim', 'HMK', '334'),
  (44, 'borçlu ödeme emrine itiraz etti takip durdu ne yapmalıyım', 'İİK', '67'),
  (45, 'borcum olmadığının tespiti için dava açabilir miyim', 'İİK', '72'),
  (46, 'borçlunun malları kaçırılmasın diye ihtiyati haciz istiyorum', 'İİK', '257'),
  (47, 'maaş haczinde ücretin ne kadarı kesilebilir', 'İİK', '83'),
  (48, 'borçlunun üçüncü kişideki alacağını haczettirebilir miyim', 'İİK', '89'),
  (49, 'borçlu mallarını devretti bu tasarrufun iptalini isteyebilir miyim', 'İİK', '277'),
  (50, 'icra müdürünün işlemine karşı nereye şikayet ederim', 'İİK', '16'),
  (51, 'idari işleme karşı dava açma süresi kaç gündür', 'İYUK', '7'),
  (52, 'dava açmadan önce üst makama başvurmam gerekir mi', 'İYUK', '11'),
  (53, 'idare mahkemesi kararına karşı istinafa gidebilir miyim', 'İYUK', '45'),
  (54, 'Danıştay temyiz incelemesi sonunda hangi kararları verebilir', 'İYUK', '49'),
  (55, 'idari davada yürütmenin durdurulması hangi şartlarda verilir', 'İYUK', '27'),
  (56, 'aldığım ürün ayıplı çıktı hangi haklara sahibim', 'TKHK', '11'),
  (57, 'ayıplı mal ne demektir', 'TKHK', '8'),
  (58, 'internetten alışverişte mesafeli sözleşme nedir', 'TKHK', '48'),
  (59, 'tüketici hakem heyetine başvuru nasıl yapılır', 'TKHK', '68'),
  (60, 'avukatlık ücreti nasıl belirlenir', 'AvK', '164'),
  (61, 'dava takibini avukat olmayan biri yapabilir mi', 'AvK', '35'),
  (62, 'hangi haller iş kazası sayılır', 'SSGSS', '13'),
  (63, 'meslek hastalığı nasıl tanımlanır', 'SSGSS', '14'),
  (64, 'kamulaştırma bedeli mahkemece nasıl tespit edilir', 'KamK', '10'),
  (65, 'vergi borcu için gelen ödeme emrine itiraz edebilir miyim', 'AATUHK', '58'),
  (66, 'işçilik alacağı için önce arabulucuya gitmek zorunlu mu', 'İşMK', '3'),
  (67, 'iş davası hangi mahkemede açılır', 'İşMK', '5');

-- Havuzda var mı?
create temp table varlik as
select s.id, s.kanun, s.madde,
       exists (select 1 from public.mevzuat_maddeleri m where m.kanun_short = s.kanun and m.madde_no = s.madde) as var_mi
from sorular s;

-- Sorgu temizleme: canlı fonksiyonun stopA'sı (temel) ve genişletilmiş hâli.
create function pg_temp.temizle(q text, genis boolean)
returns table(tsq_or tsquery, tsq_and tsquery, kelimeler text[]) language plpgsql stable as $$
declare
  stopA text[] := array[
    'dava','davasi','davasinda','davada','davaya','davanin','acilir','acilan','acmak','acilmasi',
    'sure','suresi','suresinde','surede','surenin','kac','yil','yili','gun','gunu','ay','ayi','hafta',
    'madde','maddesi','kanun','kanunu','hukuk','hukuki','hukuku','mahkeme','mahkemesi','mahkemede',
    'hakim','karar','karari','taraf','tarafi','kisi','kisinin','nedir','midir','mudur','mi','mu',
    'ile','icin','olan','olarak','veya','gibi','bir','bu','ne','kadar','hangi','bagli','basvuru',
    'nasil','ise','yani','hem','daha','cok','vardir','var','yok','olur','gerekir','zorunlu','zorunda'
  ];
  -- Soru dolguları: fiil/kip ekleri, "sahip olmak" kalıpları. Kanun metninde
  -- "istemek/yapmak/etmek" kökleri her yerde geçer; sorguda gürültüdür.
  dolgu text[] := array[
    'istiyorum','istiyor','isteyebilir','isteyebilirim','yapabilir','yapabilirim','yapmaliyim','yapmam',
    'edebilir','edebilirim','ettirebilir','ettirebilirim','alabilir','alabilirim','miyim','miyiz','misin',
    'gerekiyor','gerekli','lazim','sahip','sahibim','sahibiz','nelerdir','neler','nasil','kimde','kalir',
    'ben','beni','bana','benim','bize','simdi','once','sonra','oldu','olur','olmasi','etti','ettim',
    'verdi','verildi','verilebilmesi','aranir','sayilir','sayilan','kapsar','demektir','tanimlanir',
    'ne','neye','neyi','ile','icin','ama','fakat','ancak','olmadigi','olmadiginin','diye','artik'
  ];
  q_clean text; q_or text; q_and text; ks text[];
begin
  select array_agg(x), string_agg(x, ' ') into ks, q_clean from (
    select x from unnest(regexp_split_to_array(lower(coalesce(q, '')), '[^0-9a-zğüşıöçâîû]+')) x
    where length(x) >= 3
      and translate(x, 'ğüşıöçâîû', 'gusiocaiu') <> all(stopA)
      and (not genis or translate(x, 'ğüşıöçâîû', 'gusiocaiu') <> all(dolgu))) t;
  if q_clean is null or q_clean = '' then q_clean := coalesce(q, ''); end if;
  select string_agg(lexeme, ' | '), string_agg(lexeme, ' & ') into q_or, q_and from unnest(to_tsvector('turkish', q_clean));
  return query select
    case when q_or  is null or q_or  = '' then null else to_tsquery('turkish', q_or)  end,
    case when q_and is null or q_and = '' then null else to_tsquery('turkish', q_and) end,
    coalesce(ks, '{}'::text[]);
end $$;

create temp table sira (varyant text, id int, kanun text, madde text, sira int);

-- v0: canlı fonksiyon
insert into sira
select 'v0', s.id, s.kanun, s.madde,
  (select r.n::int from public.search_mevzuat_fts(s.soru, 100) with ordinality as r(kanun_short, kanun_name, madde_no, baslik, snippet, score, n)
    where r.kanun_short = s.kanun and r.madde_no = s.madde limit 1)
from sorular s;

-- v1 / v2: önce AND, sonra OR (fts_w2, ts_rank) — genis=false / true
insert into sira
select v.varyant, s.id, s.kanun, s.madde,
  (select r.n::int from (
     select m.kanun_short, m.madde_no,
            row_number() over (order by (m.fts_w2 @@ t.tsq_and) desc,
                                        ts_rank(m.fts_w2, case when m.fts_w2 @@ t.tsq_and then t.tsq_and else t.tsq_or end) desc, m.id) n
     from public.mevzuat_maddeleri m, pg_temp.temizle(s.soru, v.genis) t
     where t.tsq_or is not null and m.fts_w2 @@ t.tsq_or
   ) r where r.kanun_short = s.kanun and r.madde_no = s.madde limit 1)
from sorular s, (values ('v1', false), ('v2', true)) v(varyant, genis);

-- v3: v2 + önek puanı toplama. Puan = AND ise 2 + ts_rank, değilse ts_rank; + eşleşen önek sayısı × 0,5.
insert into sira
select 'v3', s.id, s.kanun, s.madde,
  (select r.n::int from (
     select m.kanun_short, m.madde_no,
            row_number() over (order by
              (case when m.fts_w2 @@ t.tsq_and then 2.0 else 0.0 end)
              + ts_rank(m.fts_w2, case when m.fts_w2 @@ t.tsq_and then t.tsq_and else t.tsq_or end)
              + 0.5 * (select count(*) from unnest(t.kelimeler) k where m.fts_simple @@ to_tsquery('simple', left(k, 4) || ':*')) desc,
              m.id) n
     from public.mevzuat_maddeleri m, pg_temp.temizle(s.soru, true) t
     where t.tsq_or is not null
       and (m.fts_w2 @@ t.tsq_or
            or exists (select 1 from unnest(t.kelimeler) k where m.fts_simple @@ to_tsquery('simple', left(k, 4) || ':*')))
   ) r where r.kanun_short = s.kanun and r.madde_no = s.madde limit 1)
from sorular s;

-- ── ÇIKTI ──────────────────────────────────────────────────────────────────
select '0-ÖZET' as bolum, varyant as soru, null::text as beklenen, null::boolean as var_mi,
       (count(*) filter (where sira is not null and sira <= 7))::text || '/68 isabet@7' as v0,
       (count(*) filter (where sira is not null and sira <= 15))::text || '/68 isabet@15' as v1,
       null::text as v2, null::text as v3
from sira group by varyant
union all
select '1-KAÇAN (v0)', s.id || '. ' || left(s.soru, 60), s.kanun || ' ' || s.madde, vl.var_mi,
       coalesce((select sira::text from sira x where x.varyant='v0' and x.id=s.id and x.kanun=s.kanun and x.madde=s.madde), '—'),
       coalesce((select sira::text from sira x where x.varyant='v1' and x.id=s.id and x.kanun=s.kanun and x.madde=s.madde), '—'),
       coalesce((select sira::text from sira x where x.varyant='v2' and x.id=s.id and x.kanun=s.kanun and x.madde=s.madde), '—'),
       coalesce((select sira::text from sira x where x.varyant='v3' and x.id=s.id and x.kanun=s.kanun and x.madde=s.madde), '—')
from sorular s join varlik vl on vl.id = s.id and vl.kanun = s.kanun and vl.madde = s.madde
where coalesce((select sira from sira x where x.varyant='v0' and x.id=s.id and x.kanun=s.kanun and x.madde=s.madde), 999) > 7
order by 1, 2;
