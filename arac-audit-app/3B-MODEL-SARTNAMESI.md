# 3B araç modeli — şartname

Bu belge, QA denetim uygulaması için sipariş edilecek 3B araç modelinin
teknik gereksinimlerini tanımlar. Modeli hazırlayacak kişiye/firmaya
bu belge olduğu gibi iletilebilir.

Model **görsel amaçlı değildir**: denetçi tablette araca dokunur, dokunduğu
panel seçilir ve hata o panele yazılır. Bu yüzden en kritik gereksinim
poligon kalitesi değil, **panellerin ayrı ve doğru adlandırılmış olması**dır.

---

## 1. En kritik madde — ayrı nesneler

Araç **tek parça (single mesh) OLMAMALIDIR.** Tek parça gelirse dokunmayla
panel seçimi çalışmaz ve modelin uygulamada hiçbir işlevi kalmaz.

Aşağıdaki listedeki her satır **ayrı bir nesne (mesh/object)** olmalı ve
**tam olarak o adı** taşımalıdır. Adlar ASCII'dir, Türkçe karakter yoktur.

Adlandırma birebir tutarsa entegrasyon işi sıfırdır. Modelleyici kendi
adlandırmasını kullanmak zorundaysa sorun değil — o zaman **karşılık tablosu**
(hangi nesne hangi panel) ayrıca gönderilsin.

### Dış — 38 nesne

| Nesne adı | Panel |
|---|---|
| `on_tampon` | Ön tampon |
| `on_izgara` | Ön ızgara / kapalı panel |
| `kaput` | Kaput |
| `sol_far` · `sag_far` | Farlar |
| `on_cam` | Ön cam |
| `tavan` | Tavan sacı |
| `arka_cam` | Arka cam |
| `bagaj_kapagi` | Bagaj kapağı |
| `arka_tampon` | Arka tampon |
| `sol_stop` · `sag_stop` | Stop lambaları |
| `sol_on_camurluk` · `sag_on_camurluk` | Ön çamurluk |
| `sol_arka_camurluk` · `sag_arka_camurluk` | Arka çamurluk |
| `sol_on_kapi` · `sag_on_kapi` | Ön kapı sacı |
| `sol_arka_kapi` · `sag_arka_kapi` | Arka kapı sacı |
| `sol_on_kapi_cam` · `sag_on_kapi_cam` | Ön kapı camı |
| `sol_arka_kapi_cam` · `sag_arka_kapi_cam` | Arka kapı camı |
| `sol_a_diregi` · `sag_a_diregi` | A direği (dış) |
| `sol_b_diregi` · `sag_b_diregi` | B direği (dış) |
| `sol_c_diregi` · `sag_c_diregi` | C direği (dış) |
| `sol_marspiyel` · `sag_marspiyel` | Marşpiyel / eşik |
| `sol_ayna` · `sag_ayna` | Dış dikiz aynası |
| `sol_jant_on` · `sag_jant_on` | Ön jant + lastik |
| `sol_jant_arka` · `sag_jant_arka` | Arka jant + lastik |

> `sol` = sürücü tarafı (soldan direksiyon), `sag` = yolcu tarafı.

### İç — 21 nesne

İç mekân **atlanmasın**: en sık hata alan parçaların bir kısmı burada
(garnişler, kapı döşemeleri, gösterge paneli).

| Nesne adı | Panel |
|---|---|
| `ic_ip` | Gösterge paneli üstü (IP) |
| `ic_gosterge` | Gösterge ekranı (cluster) |
| `ic_ekran` | Multimedya ekranı |
| `ic_konsol` | Orta konsol |
| `ic_direksiyon` | Direksiyon simidi |
| `ayak_bolge` | Ayak bölgesi / halı |
| `ic_tavan_doseme` | Tavan döşemesi |
| `ic_bagaj` | Bagaj taban döşemesi |
| `koltuk_sol_on` | Sürücü koltuğu |
| `koltuk_sag_on` | Ön yolcu koltuğu |
| `koltuk_arka` | Arka koltuk sırtlığı |
| `sol_on_kapi_doseme` · `sag_on_kapi_doseme` | Ön kapı döşemesi |
| `sol_arka_kapi_doseme` · `sag_arka_kapi_doseme` | Arka kapı döşemesi |
| `sol_a_garnis` · `sag_a_garnis` | A direği garnişi |
| `sol_b_garnis` · `sag_b_garnis` | B direği garnişi |
| `sol_c_garnis` · `sag_c_garnis` | C direği garnişi |

---

## 2. Dosya biçimi

- **İstenen: glTF 2.0 ikili — `.glb`** (tek dosya, dokular içinde gömülü).
- Kabul edilir: `.gltf` + doku klasörü, `.fbx`, `.obj` + `.mtl`.
- **Gönderilmesin:** `.blend`, `.max`, `.c4d`, `.skp` gibi programa özel
  biçimler — bunlar tarayıcıda/tablette açılmaz.

## 3. Poligon bütçesi

Model **tablette** çalışacak, masaüstü render için değil.

- Hedef: **60.000 – 100.000 üçgen** (tüm araç, iç dahil).
- Üst sınır: **150.000 üçgen**. Üstü tablette kasar.
- Subdivision/turbosmooth açık bırakılmasın, **bake edilmiş** hâli gönderilsin.
- N-gon değil, üçgen ya da dörtgen.

## 4. Ölçek ve yön

- **Gerçek ölçekte** olsun. Birim milimetre ya da metre — hangisi olduğu
  yazılsın, yeterli.
- Referans ölçüler (IONIQ 3): boy 4155 mm, en 1800 mm, yükseklik 1505 mm,
  dingil mesafesi 2680 mm.
- Başlangıç noktası (origin): **aracın ortası, yer hizasında** (lastiklerin
  yere değdiği düzlem Y=0).
- Yön tercihimiz: **+X ileri (ön), +Y yukarı, +Z sola**. Farklı bir eksen
  düzeni kullanıldıysa sorun değil, sadece hangisi olduğu yazılsın.

## 5. Malzeme ve renk — dikkat

Uygulama hatalı paneli **renk değiştirerek** işaretler (A şiddeti kırmızı,
B turuncu, C sarı). Bu yüzden:

- Her nesnenin **tek, düz renkli basit bir malzemesi** olsun.
- **Yüksek çözünürlüklü doku, metalik boya, yansıma, HDRI istenmiyor** —
  gövde parlak kırmızı gelirse kırmızı hata vurgusu okunmaz hâle gelir.
- Camlar yarı saydam olabilir.

## 6. Diğer

- Kapılar, kaput ve bagaj **kapalı** konumda.
- **Rig / animasyon / iskelet gerekmiyor.**
- Soldan direksiyon (LHD).
- Motor içi, şanzıman, alt takım detayı **gerekmiyor** — görünmüyor, sadece
  poligon yer.
- Satın alınan hazır modelse: **lisansın şirket içi uygulamada kullanıma
  izin verdiği teyit edilsin.**

---

## Model geldiğinde uygulama tarafında ne olacak

Şu anki çizici elle yazılmış bir tuval çizicisidir; her karede ~150 yüzeyi
derinliğe göre sıralar. 100.000 üçgenlik gerçek bir modelde bu yöntem çalışmaz.
Model gelince WebView içine **three.js** konacak.

Bunun önemli bir sonucu var: three.js WebView'ın **içinde** çalışır, yani
**yeni bir yerel (native) bağımlılık değildir** — yeni derleme gerektirmez.
Uygulamanın içine gömülecek, CDN'den çekilmeyecek; böylece tablet internetsizken
de model açılır.
