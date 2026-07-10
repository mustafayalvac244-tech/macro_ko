/**
 * Hazır dilekçe şablonları — köşeli parantezli alanlar doldurulup
 * paylaşılır/kopyalanır. Metinler yaygın usul dilekçeleri için genel
 * çerçevedir; hukuki içerik davaya göre düzenlenmelidir.
 */
export interface PetitionTemplate {
  key: string;
  category: 'durusma' | 'usul' | 'icra' | 'kanunyolu';
  title: string;
  description: string;
  body: string;
}

const IMZA = `\n\nSaygılarımla, [TARİH]\n\n[DAVACI/DAVALI] Vekili\nAv. [AD SOYAD]\n(e-imzalıdır)`;

export const PETITION_TEMPLATES: PetitionTemplate[] = [
  {
    key: 'mazeret',
    category: 'durusma',
    title: 'Duruşma Mazeret Dilekçesi',
    description: 'Başka bir duruşma/rahatsızlık nedeniyle duruşmaya katılamama',
    body: `[MAHKEME ADI] MAHKEMESİ SAYIN HÂKİMLİĞİ'NE
[ŞEHİR]

DOSYA NO: [ESAS NO]

[DAVACI/DAVALI]: [MÜVEKKİL AD SOYAD]
VEKİLİ: Av. [AD SOYAD]

KONU: [DURUŞMA TARİHİ] tarihli duruşma için mazeret bildirimimizdir.

AÇIKLAMALAR:

Sayın Mahkemenizin yukarıda esas numarası yazılı dosyasının [DURUŞMA TARİHİ] tarihli duruşmasına, aynı gün ve saatte [BAŞKA MAHKEME / MAZERET AÇIKLAMASI] nedeniyle katılmam mümkün olamayacaktır. Mazeretimi tevsik eden belge dilekçemiz ekinde sunulmuştur.

SONUÇ VE İSTEM: Yukarıda arz edilen nedenle mazeretimizin kabulü ile duruşmanın ileri bir tarihe ertelenmesine, yeni duruşma gününün tarafımıza (UYAP/e-tebligat üzerinden) bildirilmesine karar verilmesini saygılarımla vekaleten arz ve talep ederim.

EK: Mazeret belgesi` + IMZA,
  },
  {
    key: 'vareste',
    category: 'durusma',
    title: 'Duruşmadan Vareste Tutulma Talebi',
    description: 'Müvekkilin duruşmalara katılım zorunluluğundan bağışık tutulması',
    body: `[MAHKEME ADI] MAHKEMESİ SAYIN HÂKİMLİĞİ'NE
[ŞEHİR]

DOSYA NO: [ESAS NO]

SANIK/TARAF: [MÜVEKKİL AD SOYAD]
VEKİLİ/MÜDAFİİ: Av. [AD SOYAD]

KONU: Müvekkilin duruşmalardan vareste tutulması talebimizdir.

AÇIKLAMALAR:

Müvekkil [MÜVEKKİL AD SOYAD], [GEREKÇE: ikametinin farklı şehirde bulunması / sağlık durumu / iş zorunluluğu] nedeniyle duruşmalara bizzat katılamamaktadır. Yargılamanın bulunduğu aşama itibarıyla müvekkilin sorgusu yapılmış olup hazır bulunması zorunlu bir işlem kalmamıştır.

SONUÇ VE İSTEM: Müvekkilin bundan sonraki duruşmalardan VARESTE TUTULMASINA karar verilmesini saygılarımla vekaleten arz ve talep ederim.` + IMZA,
  },
  {
    key: 'tanik',
    category: 'usul',
    title: 'Tanık Listesi Bildirimi',
    description: 'Dinlenmesi istenen tanıkların mahkemeye sunulması',
    body: `[MAHKEME ADI] MAHKEMESİ SAYIN HÂKİMLİĞİ'NE
[ŞEHİR]

DOSYA NO: [ESAS NO]

[DAVACI/DAVALI]: [MÜVEKKİL AD SOYAD]
VEKİLİ: Av. [AD SOYAD]

KONU: Tanık listemizin sunulmasıdır.

AÇIKLAMALAR:

Sayın Mahkemenizce tarafımıza verilen süre içinde, [İSPAT KONUSU VAKIA] hususunda dinlenmesini talep ettiğimiz tanıklarımız aşağıda bildirilmiştir:

1) [TANIK 1 AD SOYAD] – T.C. No: [TC NO] – Adres: [ADRES]
   Tanıklık edeceği konu: [KONU]
2) [TANIK 2 AD SOYAD] – T.C. No: [TC NO] – Adres: [ADRES]
   Tanıklık edeceği konu: [KONU]

SONUÇ VE İSTEM: Yukarıda kimlik ve adres bilgileri yazılı tanıkların duruşmada dinlenmesine ve adlarına davetiye çıkarılmasına karar verilmesini saygılarımla vekaleten arz ve talep ederim.` + IMZA,
  },
  {
    key: 'delil',
    category: 'usul',
    title: 'Delil Listesi Bildirimi',
    description: 'Dayanılan delillerin sunulması ve celbi talebi',
    body: `[MAHKEME ADI] MAHKEMESİ SAYIN HÂKİMLİĞİ'NE
[ŞEHİR]

DOSYA NO: [ESAS NO]

[DAVACI/DAVALI]: [MÜVEKKİL AD SOYAD]
VEKİLİ: Av. [AD SOYAD]

KONU: Delil listemizin sunulması ve bir kısım delillerin celbi talebimizdir.

DELİLLERİMİZ:

1) [BELGE/DELİL 1 — ör. taraflar arasındaki .... tarihli sözleşme] (ekte sunulmuştur)
2) [BELGE/DELİL 2 — ör. banka kayıtları] — [BANKA/KURUM] nezdinde olup CELBİNİ talep ederiz
3) Tanık (listesi ayrıca sunulacaktır)
4) Bilirkişi incelemesi, keşif, yemin ve sair her türlü yasal delil

SONUÇ VE İSTEM: Ekte sunulan delillerimizin kabulü ile celbini talep ettiğimiz kayıtların ilgili kurumlardan getirtilmesine karar verilmesini saygılarımla vekaleten arz ve talep ederim.

EKLER: [EK LİSTESİ]` + IMZA,
  },
  {
    key: 'sure',
    category: 'usul',
    title: 'Ek Süre Talebi',
    description: 'Beyan/delil sunumu için ek süre istenmesi',
    body: `[MAHKEME ADI] MAHKEMESİ SAYIN HÂKİMLİĞİ'NE
[ŞEHİR]

DOSYA NO: [ESAS NO]

[DAVACI/DAVALI]: [MÜVEKKİL AD SOYAD]
VEKİLİ: Av. [AD SOYAD]

KONU: [BEYAN/DELİL/BİLİRKİŞİ RAPORUNA İTİRAZ] sunumu için ek süre talebimizdir.

AÇIKLAMALAR:

Sayın Mahkemenizce tarafımıza verilen süre, [GEREKÇE: belgelerin ilgili kurumdan temin edilememesi / dosyanın kapsamlı olması] nedeniyle yeterli olmamıştır. Telafisi güç hak kayıplarının önlenmesi bakımından tarafımıza makul bir ek süre verilmesini talep etme zorunluluğu doğmuştur.

SONUÇ VE İSTEM: [SUNULACAK İŞLEM] için tarafımıza [SÜRE — ör. iki haftalık] EK SÜRE verilmesine karar verilmesini saygılarımla vekaleten arz ve talep ederim.` + IMZA,
  },
  {
    key: 'dosya-goruntuleme',
    category: 'usul',
    title: 'Kesinleşme Şerhi Talebi',
    description: 'Kararın kesinleştiğinin şerh edilmesi talebi',
    body: `[MAHKEME ADI] MAHKEMESİ SAYIN HÂKİMLİĞİ'NE
[ŞEHİR]

DOSYA NO: [ESAS NO]
KARAR NO: [KARAR NO]

TALEP EDEN: [MÜVEKKİL AD SOYAD]
VEKİLİ: Av. [AD SOYAD]

KONU: Kesinleşme şerhi talebimizdir.

AÇIKLAMALAR:

Sayın Mahkemenizin [KARAR TARİHİ] tarih ve yukarıda numarası yazılı kararı taraflara tebliğ edilmiş, yasal süresi içinde kanun yoluna başvurulmamıştır.

SONUÇ VE İSTEM: Kararın kesinleştiğine ilişkin KESİNLEŞME ŞERHİNİN karar üzerine işlenerek kesinleşme şerhli karar örneğinin tarafımıza verilmesini saygılarımla vekaleten arz ve talep ederim.` + IMZA,
  },
  {
    key: 'icra-itiraz',
    category: 'icra',
    title: 'İcra Takibine İtiraz (Borca İtiraz)',
    description: 'İlamsız takipte 7 gün içinde borca itiraz',
    body: `[İCRA DAİRESİ] İCRA MÜDÜRLÜĞÜ'NE
[ŞEHİR]

DOSYA NO: [TAKİP NO]

İTİRAZ EDEN (BORÇLU): [MÜVEKKİL AD SOYAD] – T.C. No: [TC NO]
VEKİLİ: Av. [AD SOYAD]

KONU: Ödeme emrine ve borca itirazlarımızdır.

AÇIKLAMALAR:

Müdürlüğünüzün yukarıda numarası yazılı dosyasından gönderilen ödeme emri müvekkile [TEBLİĞ TARİHİ] tarihinde tebliğ edilmiştir. Yasal süresi içinde;

1) Müvekkilin alacaklıya herhangi bir borcu bulunmamaktadır; BORCUN TAMAMINA,
2) [VARSA: Faize ve faiz oranına],
3) [VARSA: Yetkiye — yetkili icra dairesi ... İcra Dairesidir],
tüm ferileriyle birlikte açıkça İTİRAZ EDERİZ.

SONUÇ VE İSTEM: İtirazımızın kabulü ile hakkımızdaki takibin DURDURULMASINA karar verilmesini saygılarımla vekaleten arz ve talep ederim.` + IMZA,
  },
  {
    key: 'sure-tutum',
    category: 'kanunyolu',
    title: 'İstinaf Süre Tutum Dilekçesi',
    description: 'Gerekçeli karar tebliğinden önce istinaf hakkını korumak için',
    body: `[MAHKEME ADI] MAHKEMESİ SAYIN HÂKİMLİĞİ'NE
Gönderilmek Üzere
[BÖLGE ADLİYE MAHKEMESİ İLGİLİ HUKUK/CEZA DAİRESİ]'NE
[ŞEHİR]

DOSYA NO: [ESAS NO]
KARAR NO: [KARAR NO]

İSTİNAF YOLUNA BAŞVURAN: [MÜVEKKİL AD SOYAD]
VEKİLİ: Av. [AD SOYAD]

KONU: Süre tutum (istinaf) talebimizdir.

AÇIKLAMALAR:

Sayın Mahkemenizin [KARAR TARİHİ] tarihli duruşmasında tefhim edilen karar usul ve yasaya aykırı olup; gerekçeli kararın tarafımıza tebliğinden sonra ayrıntılı istinaf nedenlerimiz sunulmak üzere, süresi içinde İSTİNAF yoluna başvurduğumuzu bildiririz.

SONUÇ VE İSTEM: İstinaf başvuru hakkımızın saklı tutularak süre tutum dilekçemizin kabulüne, gerekçeli kararın tarafımıza tebliğine karar verilmesini saygılarımla vekaleten arz ve talep ederim.` + IMZA,
  },
  {
    key: 'adli-yardim',
    category: 'usul',
    title: 'Adli Yardım Talebi',
    description: 'Yargılama giderlerini karşılayamayan müvekkil için',
    body: `[MAHKEME ADI] MAHKEMESİ SAYIN HÂKİMLİĞİ'NE
[ŞEHİR]

DOSYA NO: [ESAS NO — yoksa "Yeni dava"]

TALEP EDEN: [MÜVEKKİL AD SOYAD]
VEKİLİ: Av. [AD SOYAD]

KONU: Adli yardım talebimizdir (HMK m.334 vd.).

AÇIKLAMALAR:

Müvekkil, [MALİ DURUM AÇIKLAMASI: düzenli geliri bulunmaması / asgari ücretle geçinmesi / bakmakla yükümlü olduğu kişiler] nedeniyle yargılama giderlerini karşılayabilecek durumda değildir. Fakirlik belgesi ve mali durumu gösterir belgeler ekte sunulmuştur. Davamız açıkça dayanaktan yoksun da değildir.

SONUÇ VE İSTEM: Adli yardım talebimizin KABULÜ ile müvekkilin yargılama harç ve giderlerinden geçici olarak muaf tutulmasına karar verilmesini saygılarımla vekaleten arz ve talep ederim.

EKLER: Fakirlik belgesi, [DİĞER BELGELER]` + IMZA,
  },
  {
    key: 'tahliye-taahhut',
    category: 'icra',
    title: 'Haciz Talebi',
    description: 'Kesinleşen takipte haciz işlemlerine geçilmesi',
    body: `[İCRA DAİRESİ] İCRA MÜDÜRLÜĞÜ'NE
[ŞEHİR]

DOSYA NO: [TAKİP NO]

ALACAKLI: [MÜVEKKİL AD SOYAD]
VEKİLİ: Av. [AD SOYAD]
BORÇLU: [BORÇLU AD SOYAD] – T.C. No: [TC NO]

KONU: Haciz talebimizdir.

AÇIKLAMALAR:

Müdürlüğünüzün yukarıda numarası yazılı dosyasında borçluya gönderilen ödeme emri [TEBLİĞ TARİHİ] tarihinde tebliğ edilmiş, yasal süresi içinde itiraz edilmediğinden takip kesinleşmiştir.

SONUÇ VE İSTEM: Takip kesinleşmiş olduğundan;
1) Borçlunun bilinen ve UYAP/ilgili sistemler üzerinden tespit edilecek adreslerinde HACİZ işlemi yapılmasına,
2) Borçlu adına kayıtlı taşınmaz, araç ve banka hesaplarına HACİZ konulmasına,
3) [VARSA: Maaş haczi için işyerine müzekkere yazılmasına],
karar verilmesini saygılarımla vekaleten arz ve talep ederim.` + IMZA,
  },
];

export const TEMPLATE_CATEGORIES: Array<{ key: PetitionTemplate['category'] | 'all'; labelKey: string }> = [
  { key: 'all', labelKey: 'tpl.catAll' },
  { key: 'durusma', labelKey: 'tpl.catHearing' },
  { key: 'usul', labelKey: 'tpl.catProcedure' },
  { key: 'icra', labelKey: 'tpl.catEnforcement' },
  { key: 'kanunyolu', labelKey: 'tpl.catAppeal' },
];
