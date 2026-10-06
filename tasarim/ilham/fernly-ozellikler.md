# Fernly panosu: videodaki özellikler ve Vekil karşılığı

Kaynak: Instagram @_code_and_chill_, "Bento dashboard animation" (https://www.instagram.com/p/DeHGjlZPIHF/). Video 30 sn.
Videodan 12 kare alındı (1–28. sn). Bu depo herkese açık olduğu için görüntüler buraya konmadı; sahibin bilgisayarında ilaçpro/docs/vekil-ilham/fernly/ altında duruyor, gerekirse sohbete yapıştırılır. Yalnız fikir için: tasarımı, renkleri ya da görselleri birebir kopyalama.

| Kare | Ne görünüyor | Vekil'de karşılığı |
|---|---|---|
| 01-pano | Üstte 4 sayı kartı: toplam, biten, süren, bekleyen proje. Her kartta "geçen aya göre" notu ve köşede ok. Altında haftalık çubuk grafik, seçili gün vurgulu ve yüzde balonlu. Yanında "Hatırlatma" kartı ("Check-in…", saat aralığı, "Toplantıyı başlat"), proje listesi bitiş tarihleriyle, ekip listesi durum haplarıyla, ilerleme göstergesi (yarım halka %41) ve büyük zaman sayacı. | Ana sayfa: aktif dava, kapanan dava, bu hafta duruşma, yaklaşan süre kartları. Haftalık duruşma ve süre grafiği. "Sıradaki duruşma" kartı ve "Duruşma çıkışı" düğmesi. Yaklaşan süreler listesi. Dava ilerleme göstergesi. |
| 02-yeni-proje-eklenince | "Yeni proje" penceresi (ad, bitiş tarihi). Eklenince bütün sayılar canlı değişiyor. Altta "Add a project — every number follows" yazısı. | Dava eklenince ana sayfadaki sayıların ve grafiğin anında, animasyonla güncellenmesi. |
| 03-zaman-sayaci | Tam ekran zaman sayacı: büyük 01:24:08, başlat ve durdur düğmeleri, koyu yeşil desenli zemin. | Vekil'de `time_entries` tablosu var ama kullanılmıyor. Dava başına "süre tut" sayacı açılabilir: başlat, durdur, kaydet, saat ücretiyle çarp. |
| 04-pano-sayilar-guncellendi | Proje eklendikten sonra toplam 25, ilerleme %40, sayaç çalışıyor. | Aynı canlı güncelleme. |
| 05-gorev-panosu-surukle | Kanban: Yapılacak, Sürüyor, İncelemede, Bitti. Kartlarda etiket (Frontend, Design), öncelik, ilerleme çubuğu, kalan gün, yorum sayısı ve kişi baş harfleri. Kart sürükleniyor. Üstte filtre hapları: Tümü, Benim işlerim, Yüksek öncelik, Bu hafta. | Dava aşamaları panosu: Hazırlık, Dilekçe, Duruşma, Karar. Ya da büro iş listesi. Kartta mahkeme, kalan süre, sorumlu avukat. Sürükleyerek aşama değiştirme. |
| 06-ekip | Ekip kartları: ad, görev, açık ve biten iş sayısı, iş yükü çubuğu, "Mesaj" ve "Profil" düğmeleri. Bölüm filtreleri. | Büro ekibi: avukat ve stajyer kartları, açık dava sayısı, iş yükü. Ofis özelliği beklemede, buraya bağlanabilir. |
| 07-ekip-uye-profili | Sağdan açılan profil paneli: açık, bitmiş, yük yüzdesi, atanan işler durumlarıyla, "İş ata" düğmesi. | Avukat profili: atanan davalar, yaklaşan duruşmalar, "Dava ata". |
| 08-takvim | Ay görünümü, olaylar renkli haplar hâlinde (toplantı, ekip, inceleme, son tarih). Sağda "Bugün" ve "Yaklaşanlar" listesi. Bugün kutusu vurgulu. | Takvim: duruşma, süre sonu, müvekkil görüşmesi ve tebligat ayrı renklerde. Sağda bugünün duruşmaları ve yaklaşan süreler. |
| 09-analiz | Dört sayı kartı ve altlarında küçük çizgi grafik, "önceki 90 güne göre %" notu. 7G, 30G, 90G seçici. "CSV dışa aktar". Haftalık ortalama çizgisi ve kesikli önceki dönem. Projeye göre süre halkası. Etkinlik ısı haritası. En çok katkı verenler. | Büro analizi: tahsilat, tutulan saat, zamanında karşılanan süre oranı, ortalama dava süresi. Gelir grafiği ve önceki dönem çizgisi. Müvekkile göre saat halkası. Excel dışa aktarma. |
| 10-analiz-grafik-ipucu | Grafiğin üstüne gelince ipucu: "Sep 4 · 9 tasks · 7-day avg 7.6". | Grafik ipuçları: o günün tahsilatı ya da duruşma sayısı. |
| 11-gorunum-vurgu-rengi | Ayarlar → Görünüm: vurgu rengi seçimi (Orman, Okyanus, Erik, Kor). "Hafta pazar ya da pazartesi başlar" seçimi. | Ayarlar: büro rengi seçimi. Haftanın ilk günü: Türkiye için pazartesi varsayılan. |
| 12-renk-her-seyi-boyar | Renk değişince bütün arayüz yeni renge geçiyor. Altta "One accent re-tints everything" yazısı. | Tek vurgu rengi bütün ekranları boyar. Tasarım sisteminde renk zaten jeton olarak tutuluyorsa kolay. |

## Ortak tasarım dili (videonun beğenilen yanı)
- **"Bento" yerleşim:** Farklı boyda yuvarlak köşeli kartlar, aralarında eşit boşluk, açık gri zemin.
- **Tek koyu vurgu rengi:** Orman yeşili. Öne çıkan kart (toplam, zaman sayacı) koyu zeminli, gerisi beyaz.
- **Durum hapları:** Tamamlandı yeşil, sürüyor sarı, bekliyor pembe. Her kartta tek fikir.
- **Hareket:** Sayılar değişince sayma animasyonu, kartlar sırayla belirir, grafikler büyüyerek çizilir.
- **Kenar çubuğu:** Sabit sol menü (Pano, Görevler, Takvim, Analiz, Ekip; altta Ayarlar, Yardım, Çıkış). En altta "iOS ve Android için indir" kartı.
