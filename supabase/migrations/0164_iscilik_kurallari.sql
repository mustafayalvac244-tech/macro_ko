-- 02.10.2026 — İŞÇİLİK KURALLARI DÜZELTİLDİ / EKLENDİ (kural havuzu, legal_rules).
--
-- ÖLÇÜLEN HATA (01.10.2026, Sonnet deneme dilekçesi, işçilik alacak davası):
--  1. Dilekçe "son tutanaktan itibaren 2 hafta içinde dava açılır" yazdı. KAYNAK
--     BİZİM KURALIMIZDI: arabuluculuk_dava_sarti_kapsam bunu istisnasız söylüyordu.
--     İş K. m.20 (src/data/laws/is-kanunu.json): bu süre YALNIZ İŞE İADE davası
--     içindir. ise_iade kuralı da "arabulucu"+"fesih" ile alacak davalarında
--     tetikleniyor; artık kapsamını kendisi söylüyor.
--  2. Ödenmeyen ücrete "yasal faiz" istendi. İş K. m.34: "Gününde ödenmeyen
--     ücretler için mevduata uygulanan en yüksek faiz oranı uygulanır." Havuzda
--     faiz türü kuralı yoktu → iscilik_faiz eklendi. Dayanak kararlar havuzda:
--     Yargıtay 22. HD 20.10.2014, 7. HD 20.04.2016.
-- Kod tarafı (ai-chat LEGAL_KB) aynı metinlerle güncellendi; çıktı denetimi
-- _shared/iscilikDenetim.ts.

update public.legal_rules
set body = replace(body,
  'Anlaşamama hâlinde son tutanaktan itibaren 2 HAFTA içinde dava açılır.',
  'Anlaşamama sonrası dava açma için ayrı bir süre YALNIZ İŞE İADEDE vardır (son tutanaktan itibaren 2 hafta, İş K. m.20); işçilik ALACAK, ticari, kira ve tüketici davalarında böyle bir süre yoktur — bu davalarda yalnız zamanaşımı ve kanuni süreler işler.')
where id = 'arabuluculuk_dava_sarti_kapsam'
  and body like '%Anlaşamama hâlinde son tutanaktan itibaren 2 HAFTA içinde dava açılır.%';

update public.legal_rules
set body = body || ' Bu 2 haftalık dava açma süresi YALNIZ İŞE İADE davası içindir; kıdem, ihbar, ücret, fazla çalışma ve yıllık izin ALACAĞI davalarında böyle bir süre YOKTUR.'
where id = 'ise_iade'
  and body not like '%YALNIZ İŞE İADE davası içindir%';

insert into public.legal_rules (id, triggers, body, zorunlu_terimler)
values (
  'iscilik_faiz',
  'kıdem tazminatı kidem tazminati ücret alacağı ucret alacagi ödenmeyen ücret odenmeyen ucret fazla çalışma fazla calisma fazla mesai yıllık izin ücreti yillik izin ucreti ihbar tazminatı işçilik alacağı iscilik alacagi faiz türü en yüksek mevduat faizi yasal faiz',
  'İŞÇİLİK ALACAKLARINDA FAİZ TÜRÜ: Gününde ödenmeyen ÜCRET için mevduata uygulanan EN YÜKSEK faiz istenir (İş K. m.34); Yargıtay ücret alacağına başka faiz yürütülmesini hatalı bulmuştur. KIDEM tazminatı için de bankalarca mevduata uygulanan EN YÜKSEK faiz istenir (1475 s. Kanun m.14, İş K. m.120 ile yürürlükte). İhbar tazminatı, fazla çalışma ücreti ve yıllık izin ücreti için uygulamada genellikle YASAL faiz istenir. Faizin BAŞLANGIÇ tarihi kaleme göre değişir (fesih/temerrüt, dava veya ıslah tarihi); her kalem için faiz türü ve başlangıcı AYRI yazılmalıdır.',
  array['en yüksek']
)
on conflict (id) do update set triggers = excluded.triggers, body = excluded.body, zorunlu_terimler = excluded.zorunlu_terimler;
