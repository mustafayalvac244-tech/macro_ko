# Her açıdan 8/10 planı

Hedef: on özelliğin **her biri** avukat gözünden en az 8/10.

Puanlar tahminle değil ölçümle veriliyor. Ölçümü olmayan özelliğe puan
vermiyoruz — "bakmadan puanlamak", bu planın düzeltmeye çalıştığı hataların
birincisi.

---

## Bugünkü durum ve her birinin 8'e ne ile çıkacağı

| # | Özellik | Bugün | Kanıt | 8 için gereken |
|---|---------|-------|-------|----------------|
| 1 | Dilekçe üretimi | 7 | 11 senaryo, tek koşuda hâlâ %100 yok. BU OTURUMDA: sunucuya "uydurma tutar" denetimi eklendi (üretime dağıtıldı) — daha önce bu koruma yalnız ölçüm betiğinde vardı, avukatın gördüğü çıktıda hiç çalışmıyordu. cevap-kismi-odeme regresyon senaryosu resmi ölçümde tekrar koşuldu: 1/1 geçti (tek koşu, tutarlılık kanıtı değil) | Tam 11 senaryonun tek koşuda 10/11'i |
| 2 | Hukuki mütalaa | 0 | 5 senaryo, ücretsiz katmanda 0/5 | Claude anahtarı — **kod hazır, karar sizde. Bu oturumda dokunulmadı.** |
| 3 | Belge inceleme | 7 | yalnız 3 senaryo — üçten %100 çıkarmak istatistik değil. BU OTURUMDA: aynı "uydurma tutar" denetimi belge incelemeye de bağlandı (üretime dağıtıldı) | Senaryo 3 → 15 (bu oturumda yapılmadı) |
| 4 | İçtihat arama | 7 | isabet@5 %89,3 — ama 30 soruyu da ölçütü de BEN yazdım | Avukat gözüyle doğrulama — bu oturumda yapılamaz (avukat gerekiyor) |
| 5 | Mevzuat arama | 7 | 67 soru, isabet %70,6 | İsabeti %80'e çıkarmak — bu oturumda denenmedi (üç önceki deneme ölçümde geriledi, bkz. geçmiş) |
| 6 | Süre & duruşma takibi | 6 | **49 duruşmaya karşılık 9 süre** | Bildirim eklendi ama ORAN HENÜZ DEĞİŞMEDİ — bu, günler içindeki gerçek kullanıcı davranışıyla ölçülür, bu oturumda ölçülemez |
| 7 | Dosya & müvekkil yönetimi | 8 | 35 tabloda RLS tam, 42 dosya/48 müvekkil gerçek kullanım | ✅ tamam |
| 8 | AI sohbet | 6 | 13 soruda 9 geçti (ÖLÇÜM BETİĞİ YOK — tekrarlanabilir değil, bu da bir eksiklik). Uzunluk kuralı sistem talimatında zaten var (önceki oturumda eklenmiş) | Kısalık + set büyütme — bu oturumda yeniden ölçülmedi |
| 9 | Dosya aktarma (UYAP) | 5 | 7/7 ama: senaryoları da istemi de ben yazdım, özellik KAPALI ve hiç kullanılmadı | Gerçek belge + gerçek kullanıcı — bu oturumda yapılamaz (kapalı özellik) |
| 10 | Finans | 7 | 51 kayıt, gerçek kullanım. BU OTURUMDA: KDV/stopaj/serbest meslek makbuzu desteği eklendi — canlı veritabanına dağıtıldı (mevcut 51 kayıt doğrulanarak korundu), 7 birim testiyle hesap mantığı sınandı | Gerçek kullanıcının bu alanları KULLANMASI ve doğru hesapladığının teyidi — henüz hiç kullanılmadı, bu yüzden 8 değil 7 |

> **Bu oturumun dürüst özeti.** Kullanıcı "hepsini 8'e çıkaralım" dedi. Gerçekte
> yapılan: (a) Finans'a gerçek, eksik bir yetenek eklendi ve canlıya dağıtıldı
> — 6'dan 7'ye, çünkü henüz KULLANILMADI; (b) sunucuda aylardır var olan bir
> güvenlik açığı (uydurma tutarın yalnız ölçümde yakalanıp üretimde hiç
> yakalanmaması) kapatıldı — dilekçe ve belge incelemeyi ikisini de etkiler
> ama tek başına puanı 8'e taşımaz, çünkü o özelliklerin 8 için eksik olduğu
> şey (istatistiksel örneklem, avukat doğrulaması) başka bir şey. Dört madde
> (mütalaa, süre takibi, dosya aktarma, içtihat arama) YAPISAL sebeplerle bu
> oturumda 8'e çıkarılamaz — bunu işin başında söyledim, sonunda da aynı kaldı.
> Üç madde (mevzuat arama, belge inceleme senaryo genişletmesi, AI sohbet
> ölçümü) zaman/kota kısıtı yüzünden bu oturumda hiç denenmedi; "denendi ama
> başarısız oldu" değil, "denenmedi" — ikisini karıştırmamak lazım.

> **Puanlama kuralı 1.** Bir puan ancak ÖLÇÜM değiştiğinde değişir. Kod yazmak
> puanı yükseltmez; ölçüm yükseltir. 6 numarada bildirim yazıldı ama 49/9 oranı
> yerinde duruyor — bu yüzden hâlâ 6.
>
> **Puanlama kuralı 2 — KENDİ SINAVIMI KENDİM HAZIRLIYORUM.** Ölçüm setlerinin
> hepsini ve ölçülen istemlerin hepsini ben yazdım. İçtihatta hangi mercinin
> "yanlış merci" sayılacağına ben karar verdim; dosya aktarmada model beklentimi
> tutturamayınca beklentiyi değiştirdim (gerekçe sağlamdı ama sonucu ben
> belirledim). Bu yüzden kendi ölçümüm tek başına 8 için yeterli DEĞİL:
> 8 demek için ya bir avukatın çıktıya bakması ya da gerçek kullanım verisi
> gerekiyor.
>
> **Puanlama kuralı 3 — ÖLÇÜLMEMİŞ TAHMİNDEN ÖLÇÜME "ilerleme" YOKTUR.**
> "4'ten 8'e çıktı" gibi cümleler kurmayacağım: 4 bir ölçüm değildi. Doğrusu
> "hiç ölçülmemişti, ilk ölçüm %54,7, şimdi %89,3".

---

## Bulundu ve düzeltildi: cevap/duplikte müvekkil aleyhine talep

"Kullanabilen özellikleri kullanıp emin ol" talimatı üzerine dilekçe
özelliğini gerçek avukat gibi kullanmaya devam ettim. İki bağımsız cevap
dilekçesi üretiminde, iki farklı biçimde aynı kök hatayı buldum: model
NETİCE-İ TALEP'te davalı vekilinin ağzından, kendi müvekkilinin ALEYHİNE
bir sonuç istiyordu — "kalan 30.000 TL'nin davalıya tahsil edilmesini" ve
ayrı bir üretimde "yargılama giderinin davalıya yükletilmesini". Sebep:
dava dilekçesi kalıbında "giderin davalıya yükletilmesi" davacı için doğru
bir cümledir; model bu kalıbı taraf değiştirmeden cevap dilekçesine
taşıyordu. Düşen bir talepten (HMK m.26) daha ağır: dikkatsiz avukat,
müvekkilinin aleyhine bir sonucu mahkemeye sunmuş olur.

İki katmanlı düzeltme dağıtıldı: `talepTarifi` model talimatını
güçlendirdi, `talepUyarilari` mekanik denetim ekledi (regex ile aleyhe
yön yakalanıyor). **İki bağımsız canlı üretimle doğrulandı** (iki farklı
model: `openai/gpt-oss-120b` ve yedek `gemini-flash-latest`) — ikisinde de
gider artık doğru tarafa (davacıya) yükletiliyor. Senaryo, regresyon
olarak `cevap-kismi-odeme` adıyla ölçüm setine eklendi; yoksa bu bulgu
"bir kerelik gözlem" olarak kalır, gelecekte biri bir şey değiştirirse
sessizce geri gelebilirdi.

Bu, kendi sınavımı kendim hazırlama sorununun İYİ tarafı: ölçüm setinin
kör noktasını ancak gerçek kullanım gösterdi — mevcut 11 senaryonun hiçbiri
"kısmi ödeme + kısmi ret" durumunu içermiyordu.

**Sonrası:** `cevap-kismi-odeme` resmi ölçümde koşulduğunda 0/1 başarısız
çıktı — ama sebep yukarıdaki düzeltme değil, ÖLÇÜM SETİNİN KENDİ İKİ KÖR
NOKTASIYDI: (1) `icermeli` deseni "davanın reddi" tam ifadesini zorunlu
tutuyordu, senaryo kısmi kabul içerdiği için bu hiç geçmeyecekti; (2)
`mesruTutarlar()` iki olay tutarı arasındaki FARKI (50.000 − 20.000 = 30.000
gibi) tanımıyordu, doğru bir kısmi ödeme hesabını "uydurma tutar" diye
işaretliyordu. İkisi de düzeltildi, ölçüm ikinci kez koşuldu: 1/1 geçti
(tek koşu — tutarlılık kanıtı değil, tek doğru gözlem).

Bu vesileyle fark edilen ayrı ve daha önemli bir eksiklik: "uydurma tutar"
denetimi (`mesruTutarlar`) aylardır YALNIZ ölçüm betiğinde vardı, taslağı
üreten SUNUCUDA hiç yoktu — madde atfı için var olan aynı korumanın (bkz.
`uydurmaMaddeDenetimi`) eşleniği hiç yazılmamıştı. Yani avukatın gerçekte
gördüğü çıktıda bu koruma hiçbir zaman çalışmıyordu. Bu oturumda
`_shared/dilekce.ts`'e `uydurmaTutarlariBul()` eklenip dilekçe VE belge
inceleme uçlarına bağlandı, üretime dağıtıldı (`ai-chat` v92) ve 7 birim
testiyle scripts/uydurma.mjs ile aynı sonucu verdiği doğrulandı.

---

## Sıra (etkiye göre)

### A. Süre takibi kullanılmıyor — en yüksek risk
Avukatın mesleki sorumluluğunun ana kaynağı süre kaçırmak. Uygulamada süre
sistemi VAR, tarih mantığı 24 testle sınanmış, duruşma çıkışından süre üreten
akış da yazılmış. Ama veri şunu söylüyor: **49 duruşma, 9 süre.** Yani mekanizma
çalışıyor, kimse açmıyor.

Sebep basit: "duruşma çıkışı" ekranını avukatın kendisi bulup açması gerekiyor.
Duruşmadan çıkan avukat telefonla uğraşmaz.

Yapılacak: süreyi avukata GÖTÜRMEK. Duruşma tarihi geçtiğinde ana ekranda
"Dün 3. Asliye'deki duruşma ne oldu?" kartı; tek dokunuşla süre kaydı.

### B. İçtihat aramasının ölçümü yok
Havuzda 7.100+ karar var ve arama kalitesi hiç ölçülmedi. Ölçmediğimiz şeyi
iyileştiremeyiz; mevzuat aramasında bugün tam bunu yaşadık — üç "iyileştirme"
denedik, üçü de ölçümde KÖTÜ çıktı.

Yapılacak: içtihat arama ölçüm seti (mevzuat setiyle aynı yapıda), sonra
iyileştirme.

### C. Finans denetimi — KDV/stopaj/makbuz ✅ yapıldı, karşı yan vekalet ücreti/tahsilat takibi hâlâ yok
KDV, stopaj ve serbest meslek makbuzu desteği eklendi (canlıya dağıtıldı,
mevcut 51 kayıt korundu). Karşı yan vekalet ücreti ve tahsilat takibi
(gecikmiş taksit/ödeme hatırlatması gibi) bu oturumda ele alınmadı.

### D. Mevzuat aramasını %69'dan %80'e
Kalan 21 kaçağın kök sebepleri ayrıştırılacak. İlk bakışta iki sınıf var:
kısa ama belirleyici kelimeler ("iş kazası", "iş mahkemesi") ve havuz eksiği.

### E. Belge inceleme senaryolarını 3'ten 15'e
Üç senaryodan %100 çıkarmak istatistik değil.

### F. Karar bekleyenler
- Mütalaa: Claude anahtarı
- AI sohbet, dosya aktarma: ölçülüp açılacak mı

---

## Kural

Her madde şu sırayla: **önce ölç → sonra değiştir → tekrar ölç.** Ölçüm
düşerse değişiklik geri alınır. Bugün üç arama iyileştirmesi tam böyle elendi.
