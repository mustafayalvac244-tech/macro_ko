-- İŞE İADE KURALI, DAVANIN YALNIZ YARISINI ANLATIYORDU.
--
-- ÖLÇÜLEN ARIZA (uçtan uca deneme). Soru: "İşe iade davasını kazandım, işçi ne
-- kadar sürede işverene başvurmak zorunda?" Asistanın cevabı:
--
--     "7 gün içinde işverene işe iade talebinde bulunmak zorundadır;
--      bu süre hak düşürücü niteliktedir."
--
-- YANLIŞ. Doğrusu ON İŞGÜNÜ'dür (4857 s. İş K. m.21/son). Bir hak düşürücü
-- sürenin yanlış söylenmesi, avukat için doğrudan hak kaybı demektir; bu,
-- programın verebileceği en pahalı hata türüdür.
--
-- NEDEN OLDU — SİSTEM TALİMATI DEĞİL, VERİ EKSİĞİ. Sistem talimatında
-- "metinde geçmiyorsa süre UYDURMA" kuralı zaten var ve güçlü. Ama modele
-- verilen ise_iade kuralı davanın YALNIZ ÖNCESİNİ anlatıyordu (1 ay arabulucu,
-- 2 hafta dava) ve "Süreler hak düşürücüdür" diye bitiyordu. Model bağlamda
-- süreler görüp bunlardan birini karar SONRASI aşamaya taşıdı. Yani kuralın
-- sessiz kaldığı yerde model boşluğu hafızasından doldurdu.
--
-- Talimatı daha da sertleştirmek doğru araç değil: kural zaten açıkça yasak
-- koyuyor, üstelik metni uzatmak yeni eklenen "kısa cevap ver" kuralıyla
-- çatışır. Doğru araç, boşluğu VERİYLE kapatmak.
--
-- METİN HAFIZADAN DEĞİL, KENDİ HAVUZUMUZDAN ALINDI: mevzuat_maddeleri'ndeki
-- İşK m.21 metni okunup özetlendi. (Bu oturumda bir kez ceza maddesini
-- hafızadan yazmaya başlayıp durmuştum; tam metin okununca hafızada olmayan
-- kritik bir istisna çıkmıştı. Aynı disiplin burada da uygulandı.)
--
-- Ayrıca tetikleyicilere uygulamada kullanılan adlar eklendi: avukat "işe
-- başlatmama tazminatı" ya da "boşta geçen süre ücreti" diye sorduğunda da
-- bu kural gelsin.

update public.legal_rules set
  triggers = 'işe iade ise iade feshin geçersizliği arabulucu arabuluculuk iş güvencesi is guvencesi '
           || 'fesih işe başlatmama tazminatı ise baslatmama tazminati boşta geçen süre ücreti '
           || 'bosta gecen sure ucreti işe başlatma on işgünü on isgunu işe iade kararı kesinleşti '
           || 'davayı kazandım işe başvuru işe iade sonrası',
  body = 'İŞE İADE (4857 s. İş K. m.20 ve m.21; 7036 s. Kanun m.3). '
       || 'DAVADAN ÖNCE: işçi, fesih bildiriminin TEBLİĞİNDEN İTİBAREN 1 AY içinde arabulucuya '
       || 'başvurmak zorundadır (dava şartı). Anlaşma olmazsa SON TUTANAK tarihinden itibaren '
       || '2 HAFTA içinde iş mahkemesinde işe iade davası açılır. '
       || 'KARAR KESİNLEŞTİKTEN SONRA (m.21): işçi, kesinleşen mahkeme veya özel hakem kararının '
       || 'TEBLİĞİNDEN İTİBAREN ON İŞGÜNÜ içinde işe başlamak için işverene başvurmak ZORUNDADIR; '
       || 'bu sürede başvurmazsa işverenin yaptığı fesih GEÇERLİ sayılır. İşveren, başvuru üzerine '
       || 'işçiyi 1 AY içinde işe başlatmak zorundadır; başlatmazsa işçiye EN AZ 4, EN ÇOK 8 AYLIK '
       || 'ücreti tutarında işe başlatmama tazminatı öder. Ayrıca kararın kesinleşmesine kadar '
       || 'çalıştırılmadığı süre için işçiye EN ÇOK 4 AYA KADAR doğmuş ücret ve diğer hakları '
       || 'ödenir (boşta geçen süre ücreti). Bu süreler hak düşürücüdür.'
where id = 'ise_iade';
