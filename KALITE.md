# Her açıdan 8/10 planı

Hedef: on özelliğin **her biri** avukat gözünden en az 8/10.

Puanlar tahminle değil ölçümle veriliyor. Ölçümü olmayan özelliğe puan
vermiyoruz — "bakmadan puanlamak", bu planın düzeltmeye çalıştığı hataların
birincisi.

---

## Bugünkü durum (11 Eylül 2026 · Opus dönemi yeniden puanlama)

Önceki tablo **ücretsiz katman** (Groq/Gemini) dönemine aitti. Anthropic
anahtarı geldikten sonra ölçüm yeniden koşuldu. Aşağıdaki puanlar bu koşunun
**dosyaya yazılmış** sonuçlarına dayanıyor; koşu ortasında API kredisi
tükendiği için üç madde ölçülemedi ve o maddelere puan VERİLMEDİ.

**Uygulanan kural (çelişki vardı, sıkı olanı seçtim).** Tabloda her satır için
bir "8 için gereken" yazıyordu; ayrıca 2. puanlama kuralı "kendi hazırladığım
sınav tek başına 8 etmez" diyor. Dilekçede birinci bariyer aşıldı ama ikinci
kural hâlâ karşılanmadı. İkisi çeliştiğinde SIKI olanı uyguladım: **kendi
ölçüm setimle en fazla 7 veriyorum**; 8 için ya bir avukatın çıktıya bakması
ya da gerçek kullanım verisi gerekiyor (7 numara 8 aldı çünkü kanıtı gerçek
kullanım).

**Ortalama almıyorum.** Bu satırların kanıtları farklı ağırlıkta (gerçek
kullanım > deterministik SQL/kod ölçümü > az sayıda AI denemesi). Hepsini tek
sayıya sıkıştırmak yanıltır.

| # | Özellik | Önce | Şimdi | Ölçüm değişti mi | Kanıt |
|---|---------|------|-------|------------------|-------|
| 1 | Dilekçe üretimi | 7 | **7** | ✅ evet | `eval-dilekce-hatalar.json`, 11.09.2026 19:37, `claude-opus-5`, **11/11 senaryo, 0 kusurlu**, 29 dk. Tablonun kendi bariyeri ("tek koşuda 10/11") AŞILDI. 8 vermiyorum: sınavı ben yazdım, tek koşu — tutarlılık kanıtı değil |
| 2 | Hukuki mütalaa | 0 | **ölçülmedi** | ✅ evet (eski sayı geçersizleşti) | Eski 0/5 ÜCRETSİZ KATMANI ölçüyordu; o yapılandırma artık yok. Opus koşusu `modeller: []` ile bitti — **tek bir model çağrısı bile tamamlanmadı** (`eval-mutalaa-hatalar.json`, 18:41, 10 sn). "0" demek de "düzeldi" demek de yanlış olur |
| 3 | Belge inceleme | 7 | **7** | ❌ hayır | Opus koşusu 6 senaryodan **yalnız 2'sini** çalıştırdı, 1'i kusurlu (`eval-belge-hatalar.json`, 18:43). Kısmi koşu puan değiştirmez |
| 4 | İçtihat arama | 7 | **7** | ✅ evet (büyük) | Zaman aşımı **17/30 → 0/30**, dönen sonuç **65 → 140**, sorgu süresi **15-17 sn → 176-800 ms** (migration 0111/0113, deterministik SQL ölçümü). Dönen sonuçlarda isabet %93,6 — bu sayıyı BEN puanladım. Bariyer ("avukat gözüyle doğrulama") hâlâ aşılmadı |
| 5 | Mevzuat arama | 7 | **7** | ✅ evet (önceki sayı YANLIŞTI) | Eski %58,8 / %70,6 rakamları `search_mevzuat_fts`'i ölçüyordu; ai-chat onu KULLANMIYOR (`search_mevzuat_kural` + `match_mevzuat_semantic` kullanıyor). Doğru yol ölçüldü: **57/68 = %83,8**. Bu bir ilerleme DEĞİL, ilk doğru ölçüm — eskisi yanlış şeyi ölçüyordu |
| 6 | Süre & duruşma takibi | 6 | **6** | ❌ hayır | 49 duruşma / 9 süre oranı bu oturumda yeniden ölçülmedi. Bildirim kodu yazıldı, oran bilinmiyor |
| 7 | Dosya & müvekkil yönetimi | 8 | **8** | ❌ hayır | 42 dava / 48 müvekkil / 49 duruşma (11.09 canlı sayım). Kanıtı gerçek kullanım olduğu için 8'de kalıyor |
| 8 | AI sohbet | 6 | **7** | ✅ evet | Önceki 6 bir ÖLÇÜM DEĞİLDİ (tekrar üretilemeyen bir sayıydı). İlk gerçek ölçüm: `eval-sohbet-hatalar.json`, 19:01, `claude-opus-5`, **10 senaryoda 8 geçti**. "6'dan 7'ye çıktı" demiyorum; "hiç ölçülmemişti, ilk ölçüm 8/10" diyorum |
| 9 | Dosya aktarma (UYAP) | 5 | **5** | ❌ hayır | Özellik hâlâ kapalı, hiç kullanılmadı |
| 10 | Finans | 7 | **7** | ❌ hayır | KDV/stopaj/SMM kodu canlıda ama gerçek kullanıcı hiç kullanmadı |

### Tabloya bu oturumda eklenen satırlar

| # | Özellik | Puan | Kanıt |
|---|---------|------|-------|
| 11 | Atıf denetimi (madde + karar) | **ölçülmedi** | Ayıklayıcı deterministik olarak temiz: 20 GERÇEK Yargıtay künyesi × 4 yazılış = **80 cümlede 0 yanlış alarm, 0 kaçan atıf** (`tests/atifYanlisPozitif.test.ts`) + 17 birim + 8 veritabanı testi. Ama asıl soru — "gerçek model çıktısındaki kaç uydurmayı yakalıyor" — ÖLÇÜLMEDİ. Sayı gerçek kullanımdan birikiyor (`atif_denetim_kaydi`, admin ekranı) |
| 12 | UYAP (UDF) çıktısı | **ölçülmedi** | Üretilen dosya geçerli bir arşiv ve kendi okuyucumuz geri okuyabiliyor (12 test). **Gerçek UYAP Editör'de hiç açılmadı** |
| 13 | Çıktıyı uygulama içinde düzenleme | **ölçülmedi** | Bugün eklendi; kullanılıp kullanılmadığına dair veri yok |

> **Dürüst özet — API kredisini ben yaktım.** Ölçümü `sınır: 0` ile, yani tüm
> senaryolarla başlattım ve önce TEK bir senaryonun maliyetini ölçmedim. Çok
> adımlı mütalaa senaryoları krediyi bitirdi; dahası koşuyu "takıldı" sanıp
> İPTAL ETTİM — oysa sağlıklı koşuyordu (iptal sonrası loglar gösterdi). Yanlış
> teşhisin sebebi kendi kör noktamdı: `ai_istek.user_id` auth.users'a cascade
> bağlı olduğu için ölçüm betiği geçici kullanıcıyı silince TAMAMLANMIŞ
> harcama satırları da siliniyordu. Sonuç: mütalaa ve belge inceleme Opus'ta
> ölçülmeden kaldı ve bu tablo onlara puan veremiyor.
>
> **Bu oturumda gerçekten değişen üç ölçüm:** içtihat aramasında zaman aşımı
> (17/30 → 0/30), mevzuat aramasında yanlış fonksiyonun ölçülüyor olması
> (%83,8 ilk doğru sayı) ve dilekçenin ilk tam koşusu (11/11). Bir de
> ölçülmeyen ama söylenmesi gereken bir arıza: **uydurma madde denetimi
> 0079'dan beri üretimde sessizce ölüydü** (yetki 0079'da geri alınmış, hata
> da yutuluyordu; 11.09 canlı ölçüm: HTTP 401 / 42501). Yani dilekçedeki
> 11/11 sonucu, "uydurma madde atfı yok" konusunda KANIT DEĞİLDİR — o denetim
> o sırada çalışmıyordu ve ölçümün geç/kal kararına zaten girmiyordu.

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
