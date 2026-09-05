-- CEVAP DİLEKÇESİ (def'i–itiraz ayrımı) + ödeme emrine itirazın LAFZI.
--
-- Her iki ekleme de dilekçe ölçümünde ÇIKAN kusurlardan doğdu; ikisi de
-- "biçim" değil, hak kaybı sınıfındandır.
--
-- ÖLÇÜLEN ARIZA 1 (cevap-alacak senaryosu). Taslak, zamanaşımını "USULE
-- İLİŞKİN İTİRAZLAR" başlığı altında "zamanaşımı (5 yıllık) savunması" diye
-- yazdı. Üç ayrı yanlış:
--   • Zamanaşımı bir İTİRAZ değil DEF'İdir: hâkim kendiliğinden göz önüne
--     ALAMAZ (TBK m.161). "Savunma" gibi yumuşak bir ifade, dosyada def'inin
--     usulünce ileri sürülüp sürülmediği tartışmasına yol açar.
--   • Usule ilişkin değil ESASA ilişkindir; ilk itirazlarla (HMK m.116) aynı
--     başlığa konması kavram hatasıdır.
--   • Beş yıllık süreyi TBK m.147/1'e ("kira bedelleri, anapara faizleri ve
--     ücret gibi dönemsel edimler") dayandırdı; oysa bir hizmet bedeli oraya
--     değil, giriyorsa m.147/5-6'ya girer. Girmiyorsa süre 10 yıldır (m.146)
--     ve def'i baştan yersizdir.
-- Ayrıca HMK m.128 "davalının iddiaları inkâr ettiği varsayımı" diye tarif
-- edildi; madde, süresinde cevap VERMEYEN davalı için sonuç doğurur.
--
-- Metin havuzdaki madde metinleri okunarak yazıldı. Doğrulanan lafızlar:
--   TBK m.161 "Zamanaşımı ileri sürülmedikçe, hâkim bunu kendiliğinden göz
--              önüne alamaz."
--   TBK m.146 "Kanunda aksine bir hüküm bulunmadıkça, her alacak on yıllık
--              zamanaşımına tabidir."
--   HMK m.117 "İlk itirazların hepsi cevap dilekçesinde ileri sürülmek
--              zorundadır; aksi hâlde dinlenemez."
--   HMK m.131 "Cevap dilekçesinin verilmesinden sonra, cevap süresi dolmamış
--              olsa bile ilk itirazlar ileri sürülemez."
--   HMK m.141 "Dilekçelerin karşılıklı verilmesinden sonra iddia veya savunma
--              genişletilemez yahut değiştirilemez."
--   HMK m.127 "...tebliğinden itibaren iki haftadır."

insert into public.legal_rules (id, triggers, body) values (
  'cevap_dilekcesi',
  'cevap dilekçesi cevap dilekcesi davaya cevap dava dilekçesi tebliğ edildi '
  || 'zamanaşımı defi zamanaşımı def''i zamanasimi defi ilk itiraz yetki itirazı '
  || 'tahkim itirazı derdestlik esasa cevap inkâr savunma iki hafta ek süre '
  || 'süresinde cevap verilmedi ikinci cevap cevaba cevap savunmanın genişletilmesi',
  'CEVAP DİLEKÇESİ — SÜRE, ZORUNLU İÇERİK ve DEF''İ/İTİRAZ AYRIMI.

(1) SÜRE (HMK m.127): Cevap süresi, dava dilekçesinin TEBLİĞİNDEN itibaren İKİ HAFTADIR. '
  || 'Hazırlanması çok zor ya da imkânsızsa, bu süre içinde başvurulmak kaydıyla BİR DEFAYA '
  || 'MAHSUS ve BİR AYI GEÇMEMEK üzere ek süre verilebilir; ek süre, cevap süresinin '
  || 'BİTİMİNDEN itibaren işler. Süresinde cevap verilmezse davalı, dava dilekçesindeki '
  || 'vakıaların TAMAMINI İNKÂR ETMİŞ SAYILIR (HMK m.128) — bu bir savunma imkânı değil, '
  || 'cevap vermemenin sonucudur.

(2) ZORUNLU İÇERİK (HMK m.129): mahkemenin adı; tarafların ad-soyad ve adresleri; '
  || 'DAVALININ T.C. KİMLİK NUMARASI; vekilin bilgileri; savunmanın dayanağı BÜTÜN VAKIALARIN '
  || 'SIRA NUMARASI ALTINDA açık özetleri; HER BİR VAKIANIN HANGİ DELİLLE ispat edileceği; '
  || 'hukuki sebepler; AÇIK talep sonucu; imza.

(3) DEF''İ İLE İTİRAZ AYNI ŞEY DEĞİLDİR — dilekçede DOĞRU KELİME kullanılmalıdır.
• İTİRAZ, hakkın doğmadığını/sona erdiğini söyler ve hâkim kendiliğinden dikkate alır.
• DEF''İ, borç doğmuş olsa bile ödemekten kaçınma yetkisidir ve ANCAK İLERİ SÜRÜLÜRSE '
  || 'dikkate alınır. ZAMANAŞIMI BİR DEF''İDİR: "Zamanaşımı ileri sürülmedikçe, hâkim bunu '
  || 'kendiliğinden göz önüne alamaz" (TBK m.161). Bu yüzden dilekçede "zamanaşımı '
  || 'DEF''İNDE BULUNUYORUZ" biçiminde AÇIKÇA yazılır; "zamanaşımı savunması/itirazı" gibi '
  || 'muğlak ifadeyle geçiştirilmez. Takas ve hapis hakkı da def''idir.

(4) DEF''İ İLE ESASA CEVAP BİRLİKTE ileri sürülür ve bu bir çelişki değildir: '
  || 'zamanaşımı def''i, iddiaların kabulü anlamına GELMEZ. Sıralama: önce def''i, '
  || 'ardından "kabul anlamına gelmemek üzere" esasa cevaplar.

(5) İLK İTİRAZLAR (HMK m.116): kesin yetki kuralı yoksa YETKİ İTİRAZI ve TAHKİM İTİRAZI. '
  || 'Hepsi CEVAP DİLEKÇESİNDE ileri sürülmek ZORUNDADIR, aksi hâlde DİNLENMEZ (m.117). '
  || 'Cevap dilekçesi verildikten sonra, süre dolmamış olsa bile ilk itiraz ileri '
  || 'SÜRÜLEMEZ (m.131).

(6) SONRADAN İLERİ SÜRME YASAĞI (HMK m.141): Dilekçelerin karşılıklı verilmesinden sonra '
  || 'savunma GENİŞLETİLEMEZ ve DEĞİŞTİRİLEMEZ (ıslah ve karşı tarafın açık muvafakati '
  || 'saklıdır). Bu nedenle akla gelen TÜM def''i ve savunmalar cevap dilekçesine yazılır.

(7) ZAMANAŞIMI SÜRESİNİ GELİŞİGÜZEL SEÇME. Kural ON YILDIR (TBK m.146). Beş yıl, TBK '
  || 'm.147''de SAYILAN alacaklara özgüdür: (1) kira bedelleri, anapara faizleri ve ücret '
  || 'gibi DÖNEMSEL edimler; (2) konaklama/yeme-içme bedelleri; (3) küçük sanat işleri ve '
  || 'küçük çapta perakende satış; (4) ortaklık ilişkisinden doğanlar; (5) vekâlet, komisyon, '
  || 'acentalık ve simsarlık; (6) eser sözleşmesinden doğanlar (yüklenicinin ağır kusuru '
  || 'hariç). Bir hizmet bedeli için beş yıl diyorsan HANGİ BENDE girdiğini yaz; hiçbirine '
  || 'girmiyorsa süre on yıldır ve def''i yersizdir. Asıl alacak zamanaşımına uğrayınca faiz '
  || 've bağlı alacaklar da uğrar (TBK m.152).'
) on conflict (id) do update set triggers = excluded.triggers, body = excluded.body;

-- ÖLÇÜLEN ARIZA 2 (itiraz-odeme-emri senaryosu). Merci, süre ve dayanak artık
-- doğru çıkıyor (0049 çalıştı) ama taslak itirazı LAFZEN yapmadı:
-- "müvekkilin söz konusu alacakla hiçbir ilişkisi yoktur" yazdı; "borca itiraz
-- ediyoruz" demedi. İcra dairesi itirazı SEBEBİNE göre kaydeder; dolaylı
-- anlatım, hangi sebeple itiraz edildiğinin tartışılmasına yol açar ve imza
-- itirazı yönünden İİK m.62/son gereği imza kabul edilmiş sayılabilir.
--
-- İki ek kusur daha: taslak "imza sahteciliği iddiası" dedi (sahtecilik ayrı
-- bir iddiadır; icra takibinde yapılan, imzanın borçluya ait olmadığının
-- beyanıdır) ve netice-i talebe "alacaklının ödeme emrini iptal etmesi"ni
-- koydu — ki 0049 zaten talebin itirazın kaydı ve takibin durması olduğunu
-- söylüyordu.
update public.legal_rules set body = body || '

DİLEKÇENİN LAFZI (itirazın kaydı buna göre yapılır):
• İtiraz sebepleri AÇIK KELİMELERLE yazılır: "BORCA İTİRAZ EDİYORUZ", "İMZAYA AYRICA VE
  AÇIKÇA İTİRAZ EDİYORUZ", "YETKİYE İTİRAZ EDİYORUZ". "Müvekkilin alacakla ilişkisi
  yoktur" gibi dolaylı anlatım, itirazın sebebini göstermez ve yeterli sayılmaz.
• İmzaya itiraz ile SAHTECİLİK İDDİASI aynı şey değildir; itiraz dilekçesinde
  "sahtecilik" deme. Burada beyan edilen, senetteki imzanın borçluya AİT OLMADIĞIDIR.
• Netice-i talebe "ödeme emrinin iptali" ya da "alacaklının ödeme emrini iptal etmesi"
  yazma: itiraz bir dava değildir, takip itirazla kendiliğinden durur (İİK m.66).'
where id = 'odeme_emrine_itiraz';
