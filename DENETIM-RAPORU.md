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

## 1. Düzeltildi — YAYINDA (09.10.2026, ürün sahibi "Yayımla")

PR #157 ile main'e birleştirildi. Her biri testli; tüm takım **1113/1113**
geçiyor; CI yeşil. Web: vekilpro.app/app yeni paketi sunuyor (birleştirmeden
27 sn sonra ölçüldü). Telefon: OTA `1505a910` (çalışma zamanı 3.4.0); cihaza
indiği ÖLÇÜLMEDİ.

| # | Ne bozuktu (kodla doğrulandı) | Commit |
|---|---|---|
| 1 | **Tutar ×10/×100**: düzenleyip kaydetmek 1.250,50 ₺'yi 12.505 ₺ yapıyordu (finans, saat ücreti, icra). Taksit 1.000 ₺/3 → 33.333'lük taksitler. Faiz "24.5" → %245. "10.000" → 10 ₺. Sözleşmede "%12,5" → 125. 11 ekran tek, testli ayrıştırıcıda. | ed6dc0a |
| 2 | **İstinaf süresi** ceza dosyasında 7 gün (süre tablosu 2 hafta); tebliğ düzeltilince görev güncellenmiyordu. **Bilirkişi itirazı** duruşma gününden sayılıyordu (son gün GEÇ). Kanun yolu her dosyaya "HMK 345, 14 gün". | 9e71173 |
| 3 | **Sohbet geçmişi** hesaba bağlı değildi, çıkışta silinmiyordu: aynı cihazdaki ikinci hesap birincinin müvekkil sorularını görüyordu. Ağ yokken çıkış oturumu silmiyordu. Cevap yanlış sohbete yazılabiliyordu. | d580234 |
| 4 | **UDF** emoji/kontrol karakteri/`]]>` yüzünden UYAP Editör'de açılmıyordu; taraf satırları ortalanıyordu. Gerçek UYAP Editör 5.4.20'de düzeltme sonrası açıldı. | 750b486 |
| 5 | **UYAP keşif aracı** "Dosya 2023/145", "TC Kimlik No 12345678901" maskelemiyordu. | 70aa9d3 |
| 6 | **Belgeden dosya aç**: mahkeme "MAHKEMESİ" çıkıyordu; 7 haneli esas no kesiliyordu; TC no başlığa giriyordu; geçmiş duruşma takvime yazılıyordu. | 36ec777 |
| 7 | **PDF önizleme belgeyi Google'a gönderiyordu** (gizlilik metni aksini söylüyor). Belge yüklemede çift uyarı; belge silmede depo hatası yutuluyordu. | 21c5df9 |
| 8 | **Satış metinleri**: AI bitince "Pro'ya geç" (Pro'da AI yok); web'de AI kartı "₺2.999 / yıl"; Pro kartında ücretsizde de olan 10 deneme. | b10fafe |
| 9 | **Web'de tarih seçilemiyordu** (13 ekran; süre asistanı hep bugünden hesaplıyordu). Takvimde Android iptal ertelemeyi uyguluyordu. Atıf denetimi tanımı gerçeğe uyduruldu. | c674e88 |
| 10 | **Web'de yenilemeden sonra geri oku ölüydü**: form kaydedince kapanmıyor, ikinci basış çift kayıt. Sayfa dili "en" → "HUKUKI". | dff8051 |
| 11 | **AI ekranları** yedek modelle üretildiğini söylemiyordu; hak satırı yanlış sebep veriyordu; dilekçe sonundaki "⚠️ KONTROL LİSTESİ" iç notları UDF'ye (UYAP'a) giriyordu. | 7391b97 |
| 12 | **Toplu aktarım**: Windows-1254 CSV bozuk; "31.02" tüm aktarımı durduruyordu; "0 dosya eklendi"; tekrar yüklemede ikileme. | 3e958a1 |
| 13 | **Duruşma formu**: toplantı/arabuluculuk düzenlenince yer "Ofis"e dönüyordu. | f1fc25c |
| 14 | **Tema (GÖRSEL)**: varsayılan Gece temasında altın düğmelerde beyaz yazı (1,7:1) — "Dilekçe Taslağı Üret" soluk okunuyordu. Takvimde seçili gün açık temalarda görünmüyordu. | 6ff49c6 |
| 15 | Kalıcı biyometrik kilit; profil formunun kendiliğinden sıfırlanması; silinen davanın bildirimleri; "SIL" eşleşmesi; KDV "(%20) (%10)"; **kıdemde 1 yıl şartı** ve takvimle hizmet süresi; şifre değiştirme hata ayrımı; giriş/kayıt eski hata. | 77e17f3 |
| 16 | **Dilekçe taslağı** kayboluyordu (çıkış/yenile/yeniden üret); artık saklanır ve geri yüklenir. | 1ba4ae3 |

Önce/sonra görüntüleri (sohbette gönderildi): süre asistanı (web tarih),
AI satış kartı, dilekçe düğmesi (kontrast), geri yüklenen taslak.

## 2. Canlıya dokunan işler — UYGULANDI (09.10.2026)

| İş | Durum | Commit |
|---|---|---|
| ai-chat: avukatın kendi künyesi ("Ankara 5. Asliye … 2025/123 E.") Yargıtay'da aranıp "uydurma" diye metinden SİLİNİYORDU | ai-chat v144 (JWT kapalı, önceki gibi) | 1fb2e23 |
| ai-chat: mevzuat özeti (yapay zekâsız) cevabında hak iade edilmiyordu | ai-chat v144 | d639d24 |
| ai-saglik: her kullanıcıya açıktı, ücretli sağlayıcıları yoklatıyordu | ai-saglik v29 (JWT açık, önceki gibi) | 01ea423 |
| Göç 0175: katalog pencereleri 13.09'dan beri açılmıyor (yeni Yargıtay/Danıştay kararları havuza girmiyor) | Canlıda: 26 Yargıtay günü (09-13 → 10-08) + Danıştay Ekim penceresi eklendi, iki zamanlama kuruldu. Katalog-tick'in işlediği ÖLÇÜLMEDİ. Eylül Danıştay penceresi pazartesi (12.10) haftalık taramayla yeniden açılır. | 8c78650 |

Hazırlanmadı, karar gerekiyor:
- **revenuecat-webhook**: SANDBOX olayları gerçek premium açıyor ve geliri
  şişiriyor; olay sırası denetimi yok; kaçan EXPIRATION premium'u süresiz
  bırakır. DİKKAT: SANDBOX'ı tümden atlamak **Apple incelemesini kırar**
  (inceleyen sandbox'ta satın alır). Doğrusu geliri/metrikleri ayırmak.
- **profiles tablosu** tüm oturumlulara açık (ad, baro sicil, yönetici
  bayrağı). Kapatmak ofis/liderlik ekranlarını etkiler → göç + deneme.

## 3. Sizin kararınız gereken

- **Mevzuat verisi bozuk**: HMK m.102 (adli tatil) ayrı madde değil, m.101'in
  sonuna yapışık; TCK 217/A yok; Anayasa'da dipnot artıkları. Elle düzeltmek
  kanun metnine dokunmak demek — kaynaktan yeniden çıkarılmalı.
- **GitHub'a günlük tam veri yedeği** (backup.yml, 90 gün) gizlilik metninde
  yok. Çalışıp çalışmadığı ÖLÇÜLMEDİ.
- **Yönetici panelinde kişi başı gelir/gider** görünüyor; gizlilik metni
  "başka kimse göremez" diyor.
- Sözleşme şablonundaki Av.K. m.174/m.163 atıfları ve kambiyo itiraz süresi
  bir meslektaşa teyit ettirilmeli (denetçi ŞÜPHE dedi).

## 4. Kalan bulgular (denetçi iddiası; ben doğrulamadım)

Alan alan özet, önem sırasıyla — tam liste denetim notlarında:

- **Kayıt/giriş**: TC no auth üstverisinde kalıyor (her istekte jetonla
  gidiyor olabilir — ŞÜPHE); web'de doğrulama bağlantısı `vekil://` adresine
  gidebilir (ŞÜPHE, canlı ayar ölçülmedi); şifre sıfırlamada "kod kullanıldı"
  durumu gereksiz yeni kod istetiyor.
- **Dilekçe (sunucu)**: dosya kaydındaki tebliğ/karar tarihi "[tarih —
  doldurun]" oluyor; vekil profili sorgusu filtresiz (ŞÜPHE); ay adlı tarih
  ("10 Haziran 2026") tanınmıyor; olay metninin ilk 120 karakteri arama
  terimi olarak kalıcı yazılıyor.
- **PDF/belge**: 40.000 karakterden sonrası sessizce kesiliyor; yedek modelde
  taranmış PDF hiç görülmüyor; DOCX izlenen değişiklikleri karıştırıyor.
- **Mütalaa**: yedeğe düşüş sessiz; süre sınırında "internet" mesajı;
  ekran "mütalaa değildir" diyor, istem "resmî mütalaa" üretiyor.
- **İçtihat**: kapalı havuz tablosu kullanıcı yetkisiyle okunuyor (ŞÜPHE: hep
  boş dönüyor olabilir); "document" boş künyeyle üzerine yazıyor; arama
  sorgusu rıza kapısı olmadan Gemini'ye gidiyor ve boyut uyuşmadığı için
  zaten işe yaramıyor.
- **Takvim/duruşma**: 24 saatten yakın duruşmaya hatırlatma kurulmuyor; iOS'ta saati değişen duruşmanın eski
  bildirimi kalıyor (cihazda ölçülmedi); sonraki duruşma saati 09:30 sabit.
- **Süre hesabı**: adli tatil uzaması süre bazlı değil grup bazlı (ŞÜPHE,
  hukuken teyit gerek); dini bayramlar uzatılmıyor (güvenli yönde).
- **Web**: hata kaydı async hataları (window.onerror) görmüyor; WhatsApp
  hatırlatması web'de `whatsapp://` açıyor.
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

## 5. 30 ajan turu (09–10.10.2026) — DALDA, YAYINLANMADI

Ürün sahibi: "her hataya bir ajan, 30 ajan, hata istemiyorum, kötü özellik istemiyorum".
30 alanın hepsi dalda birleşti; tüm takım 180 dosya / 2088 test geçiyor, tsc (uygulama + uç)
temiz, yeni göçler taklit Postgres'te bağımlılıklarıyla koştu ve tekrar koşu temiz.
Ekranlar cihazda/tarayıcıda GÖRÜLMEDİ (kanıt test + tsc). Ajan raporları birer AI çıktısıdır.

**Canlıya gereken (onayınızla):** web + OTA (tema renkleri dahil — görsel, önce ekran
görüntüsü); uç işlevleri ai-chat, ictihat, doc-extract, resmi-gazete, katalog-tick,
harvest-tick, revenuecat-webhook, stripe-webhook, payment-sheet; göçler 0181 (TC'nin auth
üstverisindeki kopyasını SİLER, geri alınamaz), 0187, 0190 (arama_terimi'ndeki kullanıcı
metnini SİLER), 0191, 0194 (RLS: profiller yalnız sahibine), 0202 (önce, sonra ai-chat),
0205 (önce, sonra revenuecat-webhook; günlük süpürücü süresi dolan sandbox hesabın premium'unu
kapatır); Chrome eklentisi elle yeniden yüklenmeli. KVKK_SURUM artırıldı → rızası olan
herkese "yeni sürüm" notu çıkar.

**Kararınız gereken:**
1. 15 kanun maddesi 2025-26 değişikliğinden ESKİ: HMK 109 147 166 168 362; TCK 31 57 158 170
   220 233; TMK 733 734; TBK 55; İşK 108 — kaynaktan güncellensin mi.
2. GitHub günlük yedeği (backup.yml) 31.08–09.10 arası 40 koşunun HİÇBİRİ başarılı değil (dış
   yedek yok): düzeltilsin mi, kaldırılsın mı; gizlilik metni buna göre.
3. KVKK başvuru kanalı olarak gösterilen geri bildirim tablosunu kimse okumuyor (30 gün süre).
4. Hesap silme, dosya deposu hatasında artık hesabı SİLMİYOR (eski karar tersine döndü).
5. Kullanıcının elle hak iadesi sunucuda kapatıldı (sınırsızdı); sınırlı iade istenir mi.
6. Ölçülmemiş sınırlar (TAHMİN): yedek model 25/gün, mesaj 12.000/60.000 krktr, istemci 120 sn,
   mütalaa iç süre 120 sn, içtihat 30 istek/60 sn, kullanım sayacı 500 satır/gün.
7. Meslektaş teyidi: AAÜT dilimleri (RG 4.11.2025, taranmış ekten GÖZLE okundu); sözleşme
   şablonu atıfları (mevzuat.gov.tr özetinden); süre hesabı: Pazar→Pazartesi kayan sürede
   HMK 104 uzaması, işe iade arabuluculuğunda adli tatil, AYM bireysel başvuru artık uzamıyor.
8. Kullanım Koşulları "399 ₺", App Store 399,99 ₺.
9. Web'de doğrulama e-postası bağlantısı (Supabase site_url `vekil://` olabilir; panel ayarı).
10. Aylık danışmanlıkta "tahsil edilecek"; icrada dönemli faiz tablosu; harç maktu taban; /365.
11. Yönetici panelinde kişi başı gelir ↔ gizlilik metni.
12. Duruşma brifi: ad maskeleniyor ama dava konusu metni yapay zekâya gidiyor.
13. Mütalaa taşmasında Haiku; taranmış PDF'te tarih "[doldurun]" / tutar "uydurma" işareti.
14. payment-sheet / stripe-webhook ölü kod (silme); `nobetci` uç işlevi canlıda var, depoda yok.
15. Android push: Firebase projesi + google-services.json + EAS FCM V1 anahtarı.
16. RevenueCat TRANSFER olayı işlenmiyor (GET /subscribers için gizli anahtar gerekir).
