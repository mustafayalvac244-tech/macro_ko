# Her açıdan 8/10 planı

Hedef: on özelliğin **her biri** avukat gözünden en az 8/10.

Puanlar tahminle değil ölçümle veriliyor. Ölçümü olmayan özelliğe puan
vermiyoruz — "bakmadan puanlamak", bu planın düzeltmeye çalıştığı hataların
birincisi.

---

## Bugünkü durum ve her birinin 8'e ne ile çıkacağı

| # | Özellik | Bugün | Kanıt | 8 için gereken |
|---|---------|-------|-------|----------------|
| 1 | Dilekçe üretimi | 7 | 10 senaryo; hepsi bir noktada geçti ama TEK KOŞUDA hiç %100 olmadı | Tek koşuda 9/10 |
| 2 | Hukuki mütalaa | 0 | 5 senaryo, ücretsiz katmanda 0/5 | Claude anahtarı — **kod hazır, karar sizde** |
| 3 | Belge inceleme | 7 | yalnız 3 senaryo — üçten %100 çıkarmak istatistik değil | Senaryo 3 → 15 |
| 4 | İçtihat arama | 7 | isabet@5 %89,3 — ama 30 soruyu da ölçütü de BEN yazdım. İki gerçek kusur düzeldi (eksik sonuç, uzunluk yanlılığı) | Avukat gözüyle doğrulama |
| 5 | Mevzuat arama | 7 | 67 soru, isabet %70,6 | İsabeti %80'e çıkarmak |
| 6 | Süre & duruşma takibi | 6 | **49 duruşmaya karşılık 9 süre** | Bildirim eklendi ama ORAN HENÜZ DEĞİŞMEDİ |
| 7 | Dosya & müvekkil yönetimi | 8 | 35 tabloda RLS tam, 42 dosya/48 müvekkil gerçek kullanım | ✅ tamam |
| 8 | AI sohbet | 6 | 13 soruda 9 geçti; 4 kusurun 3'ü "çok uzun", 1'i içerik | Kısalık + set büyütme |
| 9 | Dosya aktarma (UYAP) | 5 | 7/7 ama: senaryoları da istemi de ben yazdım, bir beklentiyi ölçüm sırasında değiştirdim, özellik KAPALI ve hiç kullanılmadı | Gerçek belge + gerçek kullanıcı |
| 10 | Finans | 6 | 51 kayıt, gerçek kullanım; ama şemada KDV/stopaj/makbuz YOK | KDV + stopaj + makbuz |

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

### C. Finans denetimi
51 kayıtla gerçekten kullanılan bir özellik ve hiç bakılmadı. Türk avukatının
gerçek ihtiyacı: KDV, stopaj, serbest meslek makbuzu, karşı yan vekalet ücreti,
tahsilat takibi.

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
