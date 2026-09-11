-- HASAT ÖNCELİĞİ — "her şeyi değil, ÖNEMLİ olanı topla".
--
-- SORUN. Terim seçimi "en uzun süredir işlenmemiş" kuralıyla dönüyordu
-- (harvest-tick: order by last_run asc). Yani 134 terim eşit ağırlıkta sırayla
-- taranıyor: Yargıtay Hukuk Genel Kurulu kararı ile hiçbir müvekkilimizi
-- ilgilendirmeyen bir konu aynı hızda toplanıyor. Günde ~1.300 karar
-- çekebiliyorsak, o kotayı neyin harcadığı önemlidir.
--
-- ÜÇ SİNYAL, sırayla:
--
--   1) KURUL AĞIRLIĞI. İçtihadı Birleştirme > Genel Kurul > Yargıtay dairesi >
--      Danıştay > istinaf (BAM/BİM) > yerel. Bir İBK kararı bağlayıcıdır; bir
--      yerel mahkeme kararı emsal bile sayılmaz. Eşit toplamak yanlıştır.
--
--   2) BİZİM KULLANICILARIMIZIN GERÇEK DAVA KARIŞIMI. `cases` tablosundaki
--      dava türü/mahkeme dağılımına bakıp, avukatlarımızın FİİLEN çalıştığı
--      konuları öne alır. Rakiplerin yapamayacağı şey budur: onlarda dosya
--      yok, bizde var. 11 milyon kararın hepsini toplamak yerine, bizim
--      avukatlarımızın davasına dokunanı önce toplarız.
--
--   3) TAZELİK. Aynı konuda yeni içtihat eskisini bastırır.
--
-- DÜZELTME (2026-09-11, sonradan eklendi — yorum satırı, SQL değişmedi):
-- Yukarıdaki "KIRILGANLIK NOTU" başlığıyla burada şu yazıyordu: "terim listesi
-- (134 satır) bu depoda değil, yalnız canlı veritabanında." BU YANLIŞTI. Liste
-- depoda: scripts/ictihat-terms.txt (137 satır, 3'ü tekrar → 134 tekil terim,
-- canlıdaki sayıyla aynı). Yanlış not, listeyi görmeden puanlama yazmama yol
-- açtı; doğrusunu görünce bu migration'ın iki sinyalinin hiç eşleşmediği
-- ölçüldü. Ölçüm ve düzeltme: migration 0103.
--
-- Aşağıdaki puanlama terim METNİNE bakarak çalışır; yeni terim eklenirse
-- kendiliğinden puanlanır.

alter table public.ictihat_harvest_state
  add column if not exists oncelik integer not null default 100;

comment on column public.ictihat_harvest_state.oncelik is
  'Hasat önceliği. Büyük olan önce taranır. public.hasat_onceligini_tazele() haftalık günceller.';

create index if not exists ictihat_harvest_state_oncelik_idx
  on public.ictihat_harvest_state (oncelik desc, last_run asc nulls first);

/*
 * Terim önceliğini yeniden hesaplar.
 *
 * Taban 100. Üstüne:
 *   +60  terim, kullanıcılarımızın dava türlerinden biriyle eşleşiyorsa
 *        (eşleşme sayısıyla orantılı, en çok 60)
 *   +40  yüksek yargı sinyali taşıyan terimler (genel kurul, içtihadı
 *        birleştirme) — bunlar bağlayıcı kararlara götürür
 *   -30  yalnız yerel/istinaf sinyali taşıyanlar
 *
 * NEDEN FONKSİYON, NEDEN SABİT DEĞİL: kullanıcı kitlesi değiştikçe öncelik de
 * değişmeli. Sabit bir liste, bugünün müvekkil karışımını yarına dayatırdı.
 */
create or replace function public.hasat_onceligini_tazele()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  guncellenen integer;
begin
  with dava_konulari as (
    -- Kullanıcılarımızın gerçek dava karışımı. Boş/çöp değerler elenir.
    select lower(trim(coalesce(case_type, ''))) as konu, count(*)::numeric as adet
    from public.cases
    where case_type is not null and length(trim(case_type)) >= 3
    group by 1
  ),
  toplam as (select greatest(sum(adet), 1) as t from dava_konulari),
  puanlar as (
    select
      h.terim,
      100
      -- 1) Kullanıcı dava karışımı (en çok +60)
      + coalesce((
          select least(60, round(60 * sum(d.adet) / (select t from toplam)))::integer
          from dava_konulari d
          where lower(h.terim) like '%' || d.konu || '%'
             or d.konu like '%' || lower(h.terim) || '%'
        ), 0)
      -- 2) Yüksek yargı sinyali
      + case
          when lower(h.terim) ~ 'içtihadı birleştirme|ictihadi birlestirme|genel kurul|hgk|cgk' then 40
          else 0
        end
      -- 3) Yalnız alt derece sinyali
      + case
          when lower(h.terim) ~ 'yerel mahkeme|asliye|sulh' and lower(h.terim) !~ 'yargıtay|yargitay|danıştay|danistay' then -30
          else 0
        end
      as yeni_oncelik
    from public.ictihat_harvest_state h
  )
  update public.ictihat_harvest_state h
  set oncelik = greatest(1, p.yeni_oncelik)
  from puanlar p
  where h.terim = p.terim and h.oncelik is distinct from greatest(1, p.yeni_oncelik);

  get diagnostics guncellenen = row_count;
  return guncellenen;
end;
$$;

revoke execute on function public.hasat_onceligini_tazele() from public, anon, authenticated;

-- Haftada bir tazele: dava karışımı günlük değişmez, saatlik hesap israftır.
select cron.unschedule('vekil_hasat_onceligi') where exists (
  select 1 from cron.job where jobname = 'vekil_hasat_onceligi'
);
select cron.schedule('vekil_hasat_onceligi', '17 4 * * 1', $$select public.hasat_onceligini_tazele()$$);

-- İlk hesabı hemen yap ki bir hafta beklenmesin.
select public.hasat_onceligini_tazele();
