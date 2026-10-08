# 50 denetçi taraması — 08.10.2026 gece

Ürün sahibi: *"50 denetçiyle uygulamayı denetleyin eksikleri tespit edin. PDF
yükleme, dilekçe vs hepsini kontrol et."* / *"onaysız şeyleri yap önce"*.

## Yöntem ve sınırları (önce bu)

- 50 ayrı yapay zekâ alt-ajanı, her biri tek alan, **salt okunur kod okuması**.
  Canlıya (Supabase, uç işlevleri, site, yapay zekâ) istek ATILMADI. Bazıları
  küçük yerel denemeler koştu (çıkarıcıyı sahte metinle, gerçek UYAP Editör'ü
  üretilen UDF ile, kontrast hesabı).
- Bu bir **AI denetimi**, bağımsız doğrulama değil. Denetim istemlerini ben
  yazdım. Bir bulgu "doğrulandı" diye işaretliyse **kodu ben de okudum** ya da
  test/ölçümle gördüm; işaretsizse yalnız denetçinin iddiasıdır.
- Kullanıcı verisi, gerçek cihaz (iPhone/Android) ve gerçek avukat kullanımı
  bu taramada YOK. Cihaza özgü bulgular (bildirim, Android) ölçülmedi.

## 1. Düzeltildi — DALDA, YAYINLANMADI (web/OTA için onayınız gerekiyor)

Dal: `claude/legal-case-management-app-dipuvb`. Her biri testli; tüm takım
1087/1087 geçiyor.

| # | Ne bozuktu (kodla doğrulandı) | Commit |
|---|---|---|
| 1 | **Tutar ×10/×100**: kaydı düzenleyip kaydetmek 1.250,50 ₺'yi 12.505 ₺ yapıyordu (finans, saat ücreti, icra). Taksit taslağı 1.000 ₺/3 → 33.333 ₺'lik taksitler (toplam 100.000). Faiz "24.5" → %245. Dava detayı/müvekkil "10.000" → 10 ₺. Sözleşmede "%12,5" → 125, taksit toplamı ücretle tutmuyor. 11 ekran tek, testli ayrıştırıcıya bağlandı; okunamayan tutar artık söyleniyor. | ed6dc0a |
| 2 | **İstinaf süresi**: dosya detayı ceza istinafını 7 gün sayıyordu, uygulamanın süre tablosu 2 hafta (7445 s.K.). Tebliğ tarihi düzeltilince görev güncellenmiyordu. **Bilirkişi itirazı** duruşma gününden sayılıyordu (rapor önceden tebliğ edildiyse son gün GEÇ). Duruşma çıkışında kanun yolu her dosyaya "HMK 345, 14 gün". | 9e71173 |
| 3 | **Sohbet geçmişi** tek ortak anahtarda, çıkışta silinmiyordu: aynı cihaza giren ikinci hesap birincinin müvekkil sorularını görüyordu. Ağ yokken çıkış oturumu silmiyordu. Başka cihazdan "oturumları kapat" sonrası önbellek/bildirim/geçmiş kalıyordu. Cevap yanlış sohbete yazılabiliyordu. | d580234 |
| 4 | **UDF**: emoji, `\f`/`\v`, `]]>` dosyayı UYAP Editör'de açılmaz yapıyordu; "DAVACI : AHMET" satırları ortalanıp kalın oluyordu. **Gerçek UYAP Editör 5.4.20'de** düzeltme sonrası açıldı (scripts/udf-editor-denetim.md). | 750b486 |
| 5 | **UYAP keşif aracı** (dün yazdığım): "Dosya 2023/145", "TC Kimlik No 12345678901" maskelenmeden kalıyordu. | 70aa9d3 |
| 6 | **Belgeden dosya aç** çıkarıcısı: mahkeme "MAHKEMESİ" çıkıp yapay zekâ atlanıyordu; 7 haneli esas no kesiliyordu; TC no başlığa giriyordu; "T.C. Ziraat Bankası" siliniyordu; geçmiş duruşma tarihi takvime yazılıyordu. | 36ec777 |
| 7 | **PDF önizleme** dosya bağlantısını Google'a (gview) veriyordu — gizlilik metni belgelerin üçüncü tarafa gitmediğini söylüyor. Belge yüklemede çift uyarı "Planları gör" penceresini ezip ham kod gösteriyordu. Belge silmede depo hatası yutuluyordu. | 21c5df9 |
| 8 | **Satış metinleri**: AI hakkı bitince düğme "Pro'ya geç" diyordu (Pro'da AI yok, kullanıcı yanlış paketi alır). Web'de AI kartı "₺2.999 / yıl" yazıyordu. Pro kartı ücretsizde de olan 10 denemeyi Pro avantajı gibi listeliyordu. | b10fafe |
| 9 | **Web'de tarih seçilemiyordu** (13 ekran): süre asistanı web'de hep BUGÜNDEN hesaplıyordu. Yerel derlemede ölçüldü: tarih kutusu eski sürümde 0, yenide 1. Takvimde Android iptal ertelemeyi uyguluyordu. | c674e88 |

Önce/sonra görüntüleri: süre asistanı ve satış ekranı (sohbette gönderildi).

## 2. Hazır ama CANLIYA DOKUNUYOR — onayınızla

Henüz yapılmadı; sırayla hazırlanacak:

- **ai-chat**: kullanıcının kendi dosya/karar numarası ("2025/123 E.") ilk
  derece kararı olduğu hâlde Yargıtay'da aranıp "uydurma" diye metinden
  SİLİNİYOR (iki denetçi ayrı ayrı buldu). Mevzuat-yedek cevabında hak iade
  edilmiyor. Girdi boyutu tavanı yok. → uç işlevi dağıtımı gerekir.
- **ai-saglik** uç işlevi her giriş yapmış kullanıcıya açık (yönetici denetimi
  yalnız ekranda); her çağrı ücretli sağlayıcıları yokluyor. → dağıtım.
- **revenuecat-webhook**: SANDBOX olayları gerçek premium açıyor ve geliri
  şişiriyor; olay sırası denetimi yok (eski EXPIRATION yeni aboneliği
  kapatabilir); kaçan EXPIRATION premium'u süresiz bırakır. → ödeme yolu,
  dikkatli dağıtım.
- **Katalog hasadı**: pencereler yalnız göç anında tohumlanmış; 13.09'dan
  sonraki Yargıtay günleri / Danıştay ayları için pencere eklenmiyor. Göç
  (0175) tasarlandı, henüz yazılmadı.
- **profiles tablosu** tüm oturumlu kullanıcılara açık (ad, baro sicil no,
  yönetici bayrağı listelenebilir). Kapatmak ofis/liderlik ekranlarını
  etkileyebilir → göç + deneme.

## 3. Sizin kararınız gereken

- **Mevzuat verisi bozuk**: HMK m.102 (adli tatil) ayrı madde değil, m.101'in
  sonuna yapışık; TCK 217/A yok; Anayasa'da dipnot artıkları. Elle düzeltmek
  kanun metnine dokunmak demek — kaynaktan yeniden çıkarılmalı.
- **GitHub'a günlük tam veri yedeği** (backup.yml, 90 gün) gizlilik metninde
  yok. Çalışıp çalışmadığı ÖLÇÜLMEDİ.
- **Yönetici panelinde kişi başı gelir/gider** görünüyor; gizlilik metni
  "başka kimse göremez" diyor.
- **Tema kontrastı**: denetçi, varsayılan Gece temasında altın zemin üstüne
  beyaz yazının 1.72:1 olduğunu hesapladı (dilekçe/mütalaa düğmeleri, FAB).
  Ekranda bakılmadı.
- Sözleşme şablonundaki Av.K. m.174/m.163 atıfları ve kambiyo itiraz süresi
  bir meslektaşa teyit ettirilmeli (denetçi ŞÜPHE dedi).

## 4. Kalan bulgular (denetçi iddiası; ben doğrulamadım)

Alan alan özet, önem sırasıyla — tam liste denetim notlarında:

- **Kayıt/giriş**: kayıt↔giriş arasında eski hata taşınıyor; TC no auth
  üstverisinde kalıyor; biyometrik kilit cihaz kilidi kalkınca kalıcı
  kilitleyebilir; şifre değiştirmede her hata "mevcut şifre hatalı".
- **Dilekçe**: taslak hiçbir yerde saklanmıyor (çıkınca gider); yedek model
  uyarısı ekranda yok; "KONTROL LİSTESİ" iç notları UDF'ye/kopyaya gidiyor;
  dosya kaydındaki tarih "[tarih — doldurun]" oluyor; vekil profili sorgusu
  filtresiz (ŞÜPHE).
- **PDF/belge**: 40.000 karakterden sonrası sessizce kesiliyor; yedek modelde
  taranmış PDF hiç görülmüyor; DOCX izlenen değişiklikleri karıştırıyor.
- **Mütalaa**: yedeğe düşüş sessiz; süre sınırında "internet" mesajı;
  ekran "mütalaa değildir" diyor, istem "resmî mütalaa" üretiyor.
- **İçtihat**: kapalı havuz tablosu kullanıcı yetkisiyle okunuyor (ŞÜPHE: hep
  boş dönüyor olabilir); "document" boş künyeyle üzerine yazıyor; arama
  sorgusu rıza kapısı olmadan Gemini'ye gidiyor ve boyut uyuşmadığı için
  zaten işe yaramıyor.
- **Takvim/duruşma**: toplantı yeri düzenlemede "Ofis"e dönüyor; 24 saatten
  yakın duruşmaya hatırlatma kurulmuyor; iOS'ta saati değişen duruşmanın eski
  bildirimi kalıyor (cihazda ölçülmedi); sonraki duruşma saati 09:30 sabit.
- **Süre hesabı**: adli tatil uzaması süre bazlı değil grup bazlı (ŞÜPHE,
  hukuken teyit gerek); dini bayramlar uzatılmıyor (güvenli yönde).
- **Toplu aktarım**: Windows-1254 CSV bozuk okunuyor; geçersiz tarih tüm
  aktarımı durduruyor; "N dosya eklendi" sayacı hep 0; tekrar yüklemede dava
  ikileniyor.
- **Web**: sayfa yenilenince geri oku ölü → form kapanmıyor, çift kayıt;
  `lang="en"` yüzünden büyük harf "HUKUKI"; web hata kaydı async hataları
  görmüyor.
- **Satın alma**: logIn hatası yutuluyor (ödeme anonim kimliğe düşebilir);
  "Geri yükle" hiçbir şey bulmasa da "bulundu" diyor; abonelik yönet bağlantısı
  yok.
- **Push**: Android'de FCM yapılandırması yok (push hiç kaydolmayabilir —
  ŞÜPHE); Expo gönderim sonucu okunmuyor; kilit ekranında müvekkil adı.
- **Resmî Gazete**: bozuk/boş ayrıştırma sağlam günün üstüne yazılıyor.
- **Hasat**: katalog yazımı düşse de pencere ilerliyor (künye kaybı); otomatik
  yük freni yok; izleme alarm üretmiyor.
- **Chrome eklentisi**: "Sayfadan dosya aç" ölü (giriş jetonu hiç yazılmıyor).
- **Çeviri**: giriş hataları İngilizce'de Türkçe; finans CSV'sinde ham `{n}`.
