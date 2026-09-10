-- İDARİ DAVA SÜRESİ — havuzda YOKTU ve yerine HAGB kuralı geliyordu.
--
-- ÖLÇÜLEN ARIZA. "İdari para cezasına iptal davası açacağız, adli tatile denk
-- geliyor" sorusunda arama şunları döndürdü:
--
--   hagb (0.151) · dava_zamanasimi_ceza (0.100) · adli_yardim (0.086)
--
-- Yani CEZA hukukundaki hükmün açıklanmasının geri bırakılması, bir İDARİ dava
-- sorusuna "kesin hukuki kural" diye besleniyordu. İdari yargıda dava açma
-- süresini anlatan kural havuzda hiç yoktu; boş bıraktığımız yeri en yakın
-- görünen komşu doldurdu.
--
-- SÜRE HESABI BURADA HUKUK YARGISINDAN FARKLIDIR ve karıştırmak hak kaybettirir:
-- adli tatilde biten süre, tatilin bittiği günü İZLEYEN TARİHTEN itibaren yedi
-- gün uzar (İYUK m.8/3) — hukuk yargısındaki hesapla aynı değildir. Program bu
-- ayrımı tarih hesaplayıcısında zaten yapıyor (src/utils/legalDates.ts,
-- 'idari' kuralı); mütalaa ve dilekçe tarafında da söylenmesi gerekiyordu.
--
-- Metin havuzdaki İYUK m.7, m.8 ve m.61 okunarak yazıldı. Doğrulanan lafızlar:
--   m.7/1 "...Danıştayda ve idare mahkemelerinde altmış ve vergi
--          mahkemelerinde otuz gündür."
--   m.7/2-a "İdari uyuşmazlıklarda; yazılı bildirimin yapıldığı ... tarihi
--          izleyen günden başlar."
--   m.8/2 "Tatil günleri sürelere dahildir. Şu kadarki, sürenin son günü tatil
--          gününe rastlarsa, süre ... izleyen çalışma gününün bitimine kadar uzar."
--   m.8/3 "Bu Kanunda yazılı sürelerin bitmesi çalışmaya ara verme zamanına
--          rastlarsa bu süreler, ara vermenin sona erdiği günü izleyen tarihten
--          itibaren yedi gün uzamış sayılır."
--   m.61/1 "...yirmi temmuzdan otuz bir ağustosa kadar çalışmaya ara verirler."

insert into public.legal_rules (id, triggers, body) values (
  'idari_dava_suresi',
  'idari dava süresi idari dava suresi iptal davası iptal davasi idare mahkemesi '
  || 'idari para cezası idari para cezasi idari işlem idari islem vergi mahkemesi '
  || 'danıştay danistay altmış gün altmis gun 60 gün tam yargı davası tam yargi davasi '
  || 'yürütmenin durdurulması yurutmenin durdurulmasi idari yargı idari yargi '
  -- "itiraz" TEK BAŞINA ÇOK GENEL: ilk yazımda "cezaya itiraz edeceğiz" ve
  -- "itiraz üzerine dava süresi" konmuştu ve kural, bilirkişi raporuna itiraz
  -- sorusuna sızdı (0.195). Ölçülüp çıkarıldı — tetikleyici, kuralın kendi
  -- alanına özgü sözcüklerden kurulmalı.
  || 'çalışmaya ara verme idari yargı adli tatil idareye başvuru '
  || 'zımni ret zimni ret idari yaptırım idari yaptirim',
  'İDARİ DAVA SÜRESİ VE ADLİ TATİL — hukuk yargısıyla AYNI DEĞİLDİR.

(1) SÜRE (İYUK m.7): Özel kanununda ayrı süre yoksa dava açma süresi Danıştay ve '
  || 'İDARE mahkemelerinde ALTMIŞ GÜN, VERGİ mahkemelerinde OTUZ GÜNDÜR. Özel kanunda '
  || 'ayrı süre varsa o uygulanır — idari para cezalarında ilgili kanunun süresine BAK.

(2) BAŞLANGIÇ (İYUK m.7/2-a): Süre, YAZILI BİLDİRİMİN yapıldığı tarihi İZLEYEN '
  || 'GÜNDEN başlar. Tebliğ günü sayılmaz.

(3) TATİL GÜNLERİ SÜREYE DAHİLDİR (İYUK m.8/2). Yalnız son gün tatile rastlarsa süre, '
  || 'tatili izleyen ÇALIŞMA GÜNÜNÜN bitimine kadar uzar.

(4) ÇALIŞMAYA ARA VERME (adli tatil) — EN ÇOK KARIŞTIRILAN NOKTA. İdari yargıda ara '
  || 'verme 20 TEMMUZ - 31 AĞUSTOS''tur (İYUK m.61/1). Süresi bu döneme rastlayarak biten '
  || 'işler için süre, ARA VERMENİN SONA ERDİĞİ GÜNÜ İZLEYEN TARİHTEN itibaren YEDİ GÜN '
  || 'uzamış sayılır (İYUK m.8/3). Yani sayım 1 EYLÜLDE değil, onu izleyen günden başlar; '
  || 'hukuk yargısındaki hesapla aynı değildir ve bir gün kayması dava süresini kaçırtır.

(5) YÜRÜTMENİN DURDURULMASI ayrı ve AÇIK bir taleptir; dava dilekçesinde istenmezse '
  || 'mahkeme kendiliğinden karar vermez. İdari işlem dava açmakla durmaz.

KARIŞTIRMA: Hükmün açıklanmasının geri bırakılması (HAGB), ceza yargılamasına özgüdür '
  || 've idari dava süresiyle ilgisi yoktur.'
) on conflict (id) do update set triggers = excluded.triggers, body = excluded.body;
