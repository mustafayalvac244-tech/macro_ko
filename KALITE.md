# Her açıdan 8/10 planı

Hedef: on özelliğin **her biri** avukat gözünden en az 8/10.

Puanlar tahminle değil ölçümle veriliyor. Ölçümü olmayan özelliğe puan
vermiyoruz — "bakmadan puanlamak", bu planın düzeltmeye çalıştığı hataların
birincisi.

---

## Bugünkü durum ve her birinin 8'e ne ile çıkacağı

| # | Özellik | Bugün | Kanıt | 8 için gereken |
|---|---------|-------|-------|----------------|
| 1 | Dilekçe üretimi | 8 | 10 senaryo ölçüldü | ✅ tamam |
| 2 | Hukuki mütalaa | 0 | 5 senaryo, ücretsiz katmanda 0/5 | Claude anahtarı — **kod hazır, karar sizde** |
| 3 | Belge inceleme | 8 | 3 senaryo + okunamayan sayfa uyarısı | ✅ tamam (senaryo sayısı ince, 15'e çıkarılmalı) |
| 4 | İçtihat arama | ? | **ÖLÇÜM YOK** | Önce ölçüm seti, sonra iyileştirme |
| 5 | Mevzuat arama | 7 | 67 soru, isabet %69,1 | İsabeti %80'e çıkarmak |
| 6 | Süre & duruşma takibi | 6 | **49 duruşmaya karşılık 9 süre** | Süreyi avukata GÖTÜRMEK |
| 7 | Dosya & müvekkil yönetimi | 8 | 35 tabloda RLS tam, 42 dosya/48 müvekkil gerçek kullanım | ✅ tamam |
| 8 | AI sohbet | kapalı | 13 soruluk set, sonuç eski | Ölçüm + karar |
| 9 | Dosya aktarma (UYAP) | kapalı | **hiç kullanılmamış (0 kayıt)** | Ölçüm + karar |
| 10 | Finans | ? | 51 kayıt — gerçekten kullanılıyor | Denetim yapılacak |

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
