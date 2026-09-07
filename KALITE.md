# Her açıdan 8/10 planı

Hedef: on özelliğin **her biri** avukat gözünden en az 8/10.

Puanlar tahminle değil ölçümle veriliyor. Ölçümü olmayan özelliğe puan
vermiyoruz — "bakmadan puanlamak", bu planın düzeltmeye çalıştığı hataların
birincisi.

---

## Bugünkü durum ve her birinin 8'e ne ile çıkacağı

| # | Özellik | Bugün | Kanıt | 8 için gereken |
|---|---------|-------|-------|----------------|
| 1 | Dilekçe üretimi | 7 | 11 senaryo, tek koşuda hâlâ %100 yok. BU OTURUMDA: sunucuya "uydurma tutar" denetimi eklendi (üretime dağıtıldı). Tam 11 senaryonun resmi ölçümü başlatıldı ama ortam yeniden başlatılınca YARIDA KESİLDİ — yalnız 5/11 ölçüldü (4 geçti, 1'i BİLİNEN bir kusurdan [çakışan dayanak — TBK m.315/m.352 birlikte] düştü, bu YENİ bir bulgu değil). Tam koşu sonucu YOK | Tam 11 senaryonun tek koşuda 10/11'i — hâlâ ölçülemedi |
| 2 | Hukuki mütalaa | 0 | 5 senaryo, ücretsiz katmanda 0/5 | Claude anahtarı — **kod hazır, karar sizde. Bu oturumda dokunulmadı.** |
| 3 | Belge inceleme | 7 | BU OTURUMDA: senaryo havuzu 3'ten 6'ya çıkarıldı (kira sözleşmesi, vekâletname, icra ödeme emri) ve "uydurma tutar" denetimi bağlandı — ama yeni 3 senaryo GERÇEK MODELLE HENÜZ KOŞULMADI (kota/ortam kısıtı), yalnız kendi regex kalıpları örnek metinle sınandı | Senaryo 6 → 15, gerçek modelle ölçüm |
| 4 | İçtihat arama | 7 | isabet@5 %89,3 — ama 30 soruyu da ölçütü de BEN yazdım | Avukat gözüyle doğrulama — bu oturumda yapılamaz (avukat gerekiyor) |
| 5 | Mevzuat arama | 7 | 67 soru. BU OTURUMDA BAŞTAN ÖLÇÜLDÜ — ama sayı KARARSIZ çıktı: HIBRIT modda art arda koşularda %70,6 (48/68) sonra tutarlı biçimde %69,1 (47/68). Sebep araştırıldı: embed-ictihat çağrı hatası DEĞİL (ölçüldü, 0); muhtemelen anlamsal (ANN) aramanın kendi determinizm eksikliği. KÖK SEBEP BULUNDU (deterministik SQL analiziyle): "iş davası hangi mahkemede açılır" gibi sorgularda "iş" (2 harf) uzunluk filtresine takılıp atılıyor, geri kalan kelimeler (dava/mahkemede/açılır) stopword — sorgu TAMAMEN BOŞ kalıyor. Aday düzeltme (`search_mevzuat_fts_v2`, "iş" için uzunluk istisnası) KONTROLLÜ A/B ile ölçüldü: soru soru BİREBİR AYNI sonuç (no-op, ne iyileşme ne kötüleşme) | İsabeti %80'e çıkarmak. Bu, DÖRDÜNCÜ deneme — kök sebep NET ama düzeltme yetersiz; ayrıca ölçümün kendisinin gürültülü olduğu bu oturumda ortaya çıktı |
| 6 | Süre & duruşma takibi | 6 | **49 duruşmaya karşılık 9 süre** | Bildirim eklendi ama ORAN HENÜZ DEĞİŞMEDİ — bu, günler içindeki gerçek kullanıcı davranışıyla ölçülür, bu oturumda ölçülemez |
| 7 | Dosya & müvekkil yönetimi | 8 | 35 tabloda RLS tam, 42 dosya/48 müvekkil gerçek kullanım | ✅ tamam |
| 8 | AI sohbet | 6 | 13 soruda 9 geçti diye bir sayı vardı ama TEKRAR ÜRETİLEMİYORDU (ölçüm betiği yoktu). BU OTURUMDA: kalıcı ölçüm betiği (eval-sohbet.mjs) ve 10 senaryo yazıldı, saf değerlendirme mantığı 13 testle sınandı — ama GERÇEK MODELLE HENÜZ KOŞULMADI (kota/ortam kısıtı) | Kısalık + set büyütme + GERÇEK ölçüm — betik hazır, sonuç yok |
| 9 | Dosya aktarma (UYAP) | 5 | 7/7 ama: senaryoları da istemi de ben yazdım, özellik KAPALI ve hiç kullanılmadı | Gerçek belge + gerçek kullanıcı — bu oturumda yapılamaz (kapalı özellik) |
| 10 | Finans | 7 | 51 kayıt, gerçek kullanım. BU OTURUMDA: KDV/stopaj/serbest meslek makbuzu desteği eklendi — canlı veritabanına dağıtıldı (mevcut 51 kayıt doğrulanarak korundu), 7 birim testiyle hesap mantığı sınandı | Gerçek kullanıcının bu alanları KULLANMASI ve doğru hesapladığının teyidi — henüz hiç kullanılmadı, bu yüzden 8 değil 7 |

> **Bu oturumun dürüst özeti.** Kullanıcı "hepsini 8'e çıkaralım" dedi. Gerçekte
> yapılan: (a) Finans'a gerçek, eksik bir yetenek eklendi ve canlıya dağıtıldı
> — 6'dan 7'ye, çünkü henüz KULLANILMADI; (b) sunucuda aylardır var olan bir
> güvenlik açığı (uydurma tutarın yalnız ölçümde yakalanıp üretimde hiç
> yakalanmaması) kapatıldı — dilekçe ve belge incelemeyi ikisini de etkiler
> ama tek başına puanı 8'e taşımaz; (c) belge inceleme senaryo havuzu 3'ten
> 6'ya çıkarıldı ve AI sohbet için hiç var olmayan kalıcı ölçüm betiği
> yazıldı — ikisi de GERÇEK MODELLE HENÜZ KOŞULMADI, bu yüzden puanları
> DEĞİŞMEDİ (kod yazmak puan yükseltmez, ölçüm yükseltir); (d) mevzuat
> aramada kök sebep bulundu ve dördüncü bir düzeltme denendi — kontrollü
> A/B ölçümde SORU SORU BİREBİR AYNI çıktı (no-op, ne iyileşme ne
> kötüleşme), geri alındı, canlı davranış değişmedi. İlk ölçümde "%70,6'dan
> %69,1'e düştü" diye YANLIŞ bir sonuç çıkarmıştım — aynı anda değişmemiş
> orijinal fonksiyon da %69,1 verince bunun bir ölçüm dalgalanması olduğu
> anlaşıldı; ayrıca `eval-arama.mjs`'in HIBRIT modunun kendisinin (muhtemelen
> anlamsal aramanın ANN indeksi yüzünden) tam deterministik olmadığı ortaya
> çıktı; (e) dilekçenin tam 11 senaryolu resmi ölçümü ortam yeniden
> başlatılınca yarıda kesildi, 5/11'lik kısmi sonuç var ama "10/11" iddia
> edilemez. Dört madde (mütalaa, süre takibi, dosya aktarma, içtihat arama)
> YAPISAL sebeplerle bu oturumda 8'e çıkarılamaz. **Hiçbir özellik bu
> oturumda 8'e ulaşmadı.** İki gerçek üretim düzeltmesi (finans, uydurma
> tutar) canlıya dağıtıldı; geri kalanı ya ölçüm altyapısı (henüz koşulmadı)
> ya da "denendi, işe yaramadı, geri alındı" (mevzuat arama).

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

### D. Mevzuat aramasını %69'dan %80'e — 4. deneme NO-OP çıktı, ama ÖLÇÜMÜN KENDİSİNDE ayrı bir kusur bulundu
"İş davası hangi mahkemede açılır" gibi sorgularda `search_mevzuat_fts`'in
`q_clean` hesaplaması TAMAMEN BOŞ çıkıyor: "dava", "mahkemede", "açılır" hepsi
stopword, "iş" ise yalnızca 2 harf olduğu için `length(x) >= 3` filtresine
takılıp hiç değerlendirilmiyor — ağırlıklı arama kolu (tsq) devre dışı kalıyor.
Bu, deterministik SQL analiziyle (canlı veriye sorgu atarak, model çağırmadan)
doğrulandı — tahmin değil.

Düzeltme denendi: yalnız "iş" kelimesi için uzunluk istisnası, ayrı bir
`search_mevzuat_fts_v2` fonksiyonu olarak deploy edilip `EVAL_RPC` ile canlıdan
ölçüldü. İLK ölçüm %69,1 (47/68) çıktı ve bunu "bazdan (%70,6) kötü" diye
YANLIŞ RAPORLADIM — çünkü aynı ANDA, HİÇBİR ŞEY DEĞİŞTİRİLMEMİŞ orijinal
fonksiyonu TEKRAR ölçünce de %69,1 (47/68) çıktı. Yani ilk günkü %70,6 (48/68)
sayısı muhtemelen kendisi bir ölçüm dalgalanmasıydı, "v2 kötüleştirdi" değil.

Bunun üzerine KONTROLLÜ bir A/B yapıldı: v2 ve orijinal fonksiyon AYNI koşuda,
art arda, aynı 67 soruyla ölçüldü. Sonuç: SORU SORU BİREBİR AYNI (`diff` boş
çıktı) — 47/68, %69,1, hiçbir soru farklı geçmedi/kaldı. Yani "iş" istisnası
NE İYİLEŞTİRDİ NE KÖTÜLEŞTİRDİ; tamamen etkisiz bir değişiklik (no-op).
Hedeflenen sorgu ("iş davası...") bu haliyle de geçemedi — istisna kelimeyi
sorguya sokuyor ama İşK (İş Kanunu) maddeleri gürültü olarak araya girip
faydayı sıfırlıyor.

AYRI VE ÖNEMLİ BULGU: `eval-arama.mjs`'in HIBRIT (anlamsal) modu, AYNI
sorgu kümesinde, AYNI değişmemiş fonksiyonla, art arda koşularda FARKLI
sayı üretebiliyor (48/68 → 47/68 → 47/68). embed-ictihat çağrısının sessizce
başarısız olup saf FTS'e düşmesi ihtimaline karşı bir sayaç eklendi
(`degradeSoru`) — bu sayaç 0 çıktı, yani sebep bu DEĞİL. Muhtemel sebep,
`match_mevzuat_semantic`'in kullandığı yaklaşık en-yakın-komşu (ANN) vektör
indeksinin çağrılar arası TAM DETERMİNİSTİK olmaması. Bu, "%70,6" gibi tek
bir sayının kendisinin ±1-2 puan gürültü payı taşıdığı anlamına gelir ve
gelecekte biri bu sayıyı tek koşuyla karşılaştırıp yanlış sonuca varabilir —
bu yüzden burada kayda geçti.

Bu, DÖRDÜNCÜ ardışık başarısız deneme (bu kez "başarısız" = ölçülebilir etki
yok, "regresyon" değil). Kök sebep hâlâ doğru: "iş" gibi kısa kelimelerin
atılması gerçek bir sorun. Ama düzeltme YETMİYOR — "iş" tek başına sorguya
girince İşK/İşMK ayrımını yapamıyor; muhtemelen kanun kısaltmasına özgü bir
ağırlıklandırma ya da "iş davası"/"iş mahkemesi" gibi İKİ KELİMELİK öbekleri
tek birim sayan bir yaklaşım gerekiyor. Bu oturumda bulunamadı.

### E. Belge inceleme senaryolarını 3'ten 15'e — 6'ya çıkarıldı, GERÇEK MODELLE HENÜZ KOŞULMADI
Üç yeni senaryo eklendi (kira sözleşmesi, vekâletname, icra ödeme emri).
Regex kalıpları örnek "doğru/eksik inceleme" metinleriyle sınandı (canlı
modele gitmeden bir kör nokta bulunup düzeltildi — bkz. commit mesajı) ama
gerçek modelle hiç koşulmadı. 15'e ulaşmadı, kota/ortam kısıtı yüzünden.

### F. Karar bekleyenler
- Mütalaa: Claude anahtarı
- AI sohbet, dosya aktarma: ölçülüp açılacak mı

---

## Kural

Her madde şu sırayla: **önce ölç → sonra değiştir → tekrar ölç.** Ölçüm
düşerse değişiklik geri alınır. Bugün üç arama iyileştirmesi tam böyle elendi.
