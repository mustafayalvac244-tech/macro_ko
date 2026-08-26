# ko-macro

Knight Online için combo / farm makrosu ve mob doğuş (respawn) takipçisi.
Tuşlara bir **Arduino Leonardo** basar; PC tarafındaki Python programı ne
zaman neye basılacağına karar verir.

---

## Önce okunması gerekenler

**Makro kullanmak Knight Online'ın kullanım şartlarına aykırıdır ve hesabın
banlanabilir.** Bu araç o riski ortadan kaldırmaz. Kullanıp kullanmamak senin
kararın, sonuçları da sana ait.

**Bu proje oyunun koruma sistemine dokunmaz.** Bilerek ve isteyerek dışarıda
duruyor:

| Yapılan | Yapılmayan |
| --- | --- |
| Leonardo üzerinden gerçek USB klavye/fare olayı | Oyun sürecine kod enjekte etmek |
| Ekran görüntüsünden piksel okumak (can barı, hedef barı) | Oyunun hafızasını okumak/yazmak |
| Oyunun kendi arayüzünü kullanmak (Tab, skill tuşları) | Ağ paketlerini değiştirmek |
| — | GameGuard/HackShield'e hook atmak veya kapatmak |

**Mob seçer ve öldürür.** Döngü şöyle: Tab → hedef barı belirdi mi → canı dolu
mu (ceset ve başkasının mobu elenir) → adı tuttu mu (istersen) → combo → bar
boşalınca öldüğünü anlar → loot → yeni Tab.

Bunun bir bedeli var ve saklamıyorum: **mob listesini koordinatıyla okuyamaz,
otomatik yürüyemez, ışınlanamaz.** Hedefleme oyunun kendi Tab'ı üzerinden gider;
mobu ayırt etmek gerekiyorsa adının ekrandaki görüntüsü tanınır, oyunun verisi
değil. Yürüyen, ışınlanan bir bot arıyorsan bu proje o değil.

---

## Özellik karşılığı

Piyasadaki pedal/makro programlarının özellik listesine göre nerede duruyoruz:

### Okçu

| Özellik | Durum | Nerede |
| --- | --- | --- |
| 3-5 combosu | ✅ | `profiles/archer.yaml` |
| 60-70-72 combosu | ✅ | aynı |
| 70-72 combosu | ✅ | aynı |
| Styx combo içinde | ✅ | `60-70-72+styx` |
| Cure combo içinde | ✅ | `70-72+cure` |
| M20 combo içinde | ✅ | `70-72+m20` |
| Mana çekme (yürüme/koşma) | ✅ | `mana-pull`, `mana-pull-run` |
| Z duruşundan çıkma düzeltmesi | ✅ | `restore_stance` + `stance_key` |
| Adımlar arası minimum gecikme | ✅ | firmware kuyruğu, 1 ms çözünürlük |
| Gelişmiş hedef takibi | ✅ | hedef barı okuma; mob düşünce combo kesilir |
| Sadece belirli mobu dövme | ✅ | ad görüntüsü parmak izi (`mob-ogren`) |

### Priest

| Özellik | Durum | Nerede |
| --- | --- | --- |
| Helis combosu | ✅ | `profiles/priest.yaml` |
| Book / Wildness / Malice | ✅ | aynı |
| Buff seti | ✅ | `buff` combosu |
| Heal / minor heal | ✅ | `heal`, `minor` |
| Otomatik heal (eşiğe göre) | ✅ | `autocast` + `vitals` |
| Otomatik malice | ✅ | `autocast` |
| Parazit temizleme | ⚠️ | `autocast` — **süreye** dayalı, olaya değil |
| Otomatik CC | ⚠️ | aynı sınır |

### Genel

| Özellik | Durum | Nerede |
| --- | --- | --- |
| Ayarlanabilir skillbar | ✅ | `skillbar` |
| Akıllı HP/MP/minor pot seçimi | ✅ | `vitals` — eşiğe göre en uygun pot |
| Tek tuşla başlat/durdur | ✅ | F9 / F12 |
| Upgrade makrosu (hız ayarlı) | ✅ | `utility.upgrade_*` |
| Anti-AFK mob tıklama | ✅ | `utility.anti_afk_*` |
| Otomatik Descent | ✅ | `utility.descent_key` + `autocast` |
| Magic Hammer tamir | ✅ | `utility.repair_*` + `autocast` |
| Ekipman değiştirme | ✅ | `utility.equipment_sets` + kısayol |

**⚠️ işaretliler neden tam değil:** oyunun durumunu okumadığımız için
"parazit yedin mi", "stun yedin mi" gibi sorulara cevap veremeyiz. Bu kurallar
belirli aralıklarla tetiklenir — işe yarar ama olay bazlı değildir.

**Listede olmayanlar:** mob koordinatlarını okuma, otomatik yürüme/rota,
ışınlanma. Bunlar hafıza okuma gerektirir, bu proje yapmaz.

---

## Hooking'e göre nerede duruyor

Dürüst cevap: **hooking daha yetenekli.** Eşit değil, öyleymiş gibi de
davranmıyorum.

| | Hooking / hafıza okuma | Bu proje |
| --- | --- | --- |
| Etraftaki mobların listesi | Hepsini bilir (duvar arkası dahil) | Sadece **ekranda görünenler** (`targeting: click`) |
| Otomatik yürüme, rota takibi | Yapar | Yapmaz, park ettiğin yerde durur |
| Can / mana | Kesin sayı | Piksel oranı, yaklaşık |
| Zehir / stun / buff durumu | Olay bazlı bilir | Bilmez, süreye dayalı tahmin |
| Tepki gecikmesi | ~1 ms | ~20-100 ms (ekran yoklama aralığı) |
| Pencere arkadayken / küçükken | Çalışır | Çalışmaz, ekranı görmesi gerekir |

Farkın sanıldığı kadar olmadığı yerler:

- **Combo hızı.** Hooking burada bir şey kazandırmaz; tavanı oyunun
  cast/cooldown ritmi belirler, girdi yöntemi değil. Firmware kuyruğu zaten
  1 ms çözünürlükte.
- **Ölüm tespiti, pot basma, comboyu kesme.** Bar okumayla güvenilir çalışıyor.

Karşılığında alınan tek şey, ama önemlisi: **oyun sürecinde bulunacak hiçbir
şey yok.** Enjekte edilmiş modül, yamalanmış fonksiyon, yabancı thread,
dışarıdan hafıza okuması — hiçbiri. Yan fayda olarak istemci güncellemeleri
memory offset'lerini bozar, pikselleri bozmaz.

Takas bu. Proje bilerek bu tarafta duruyor.

---

## Nasıl çalışır

```
┌──────────────┐   USB seri   ┌──────────────┐   USB HID   ┌──────────┐
│  PC (Python) │ ───────────▶ │   Leonardo   │ ──────────▶ │  Windows │
│              │  "QK 1 40 120"│ ko_hid_bridge│  gerçek tuş │  + oyun  │
│  combo/farm  │              │  (firmware)  │             │          │
│  karar verir │ ◀─────────── │              │             │          │
└──────┬───────┘   "DONE 3"   └──────────────┘             └──────────┘
       │
       │ mss ile ekran okuma (can barı, hedef barı)
       ▼
   piksel örnekleri
```

Combo adımları tek tek gönderilmez; **önce Leonardo'nun kuyruğuna yüklenir**
(`QK`), sonra tek komutla çalıştırılır (`G`). Böylece adımlar arası zamanlamayı
PC'nin seri gecikmesi ve Windows zamanlayıcısı değil, mikrodenetleyicinin
kendi saati belirler — 1 ms çözünürlükle.

---

## Kurulum

> Hiç programlama bilmiyorsan **[KURULUM.md](./KURULUM.md)** dosyasını oku —
> sıfırdan adım adım anlatıyor. Aşağısı özet.

### Hazır exe

Python kurmadan kullanmak için:

- **GitHub derlesin:** depoda **Actions → "ko-macro exe" → Run workflow**.
  Bitince çalışmanın altındaki **Artifacts → ko-macro-windows** paketini indir.
- **Kendin derle:** `ko-macro/python/derle.bat` dosyasına çift tıkla
  (Python 3.10+ gerekir). Sonuç `dist/ko-macro.exe`.

Exe ilk çalıştığında yanına bir `config.yaml` oluşturur; ayarları oradan
yaparsın. Kayıtlar (`spawns.json`) da exe'nin yanında durur.

> PyInstaller çapraz derleme yapmaz — Windows exe'si Windows'ta derlenmek
> zorunda. GitHub Actions bunu bir Windows makinesinde yapıyor.

### 1. Leonardo'ya firmware yükle

`arduino/yukle.bat` dosyasına çift tıkla — arduino-cli'yi kendi indirir, kartı
bulur, derler ve yükler. Arduino IDE gerekmez.

Elle yapmak istersen: Arduino IDE ile `arduino/ko_hid_bridge/ko_hid_bridge.ino`
dosyasını aç, kart olarak **Arduino Leonardo** seç, yükle.

Firmware açılışta **kapalı** gelir: `E` komutu gelene kadar tek bir tuşa bile
basmaz. Kart üstündeki LED, çıkış açıkken yanar.

> Yükledikten sonra kart bir klavye olarak görünür. Firmware kendi başına
> hiçbir şey yazmaz, ama yine de yükleme sırasında kartı kilitlersen
> bootloader'a düşürmek için reset'e iki kez basman gerekebilir.

### 2. Python tarafı

```bash
cd ko-macro/python
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt

cp config.example.yaml config.yaml
```

Kartın görünüyor mu diye bak:

```bash
python -m ko_macro devices
```

---

## Ayar

`config.yaml` bir **profilin üstüne** biner. Profiller `profiles/` altında:

```bash
python -m ko_macro profiles     # archer, priest
```

`profile: archer` yazdığında `profiles/archer.yaml` taban olarak okunur,
`config.yaml`'daki alanlar onun üstüne yazılır. Yani hazır combo setini
bozmadan sadece kendi tuş dizilimini geçebilirsin:

```yaml
profile: archer

skillbar:
  spike: "2"          # profildeki "1" yerine kendi tuşun
  arrow_shower: "3"
```

### Skill bar

`skillbar` mantıksal adı gerçek tuşa bağlar. Combolar adı kullanır, tuşu değil —
bar dizilimini değiştirdiğinde tek yerden düzeltirsin.

### Combolar

```yaml
combos:
  - name: "60-70-72"
    hotkey: "f3"
    cooldown_ms: 1800
    steps:
      - { skill: spike,         hold_ms: 40, gap_ms: 120 }
      - { skill: arrow_shower,  hold_ms: 40, gap_ms: 130 }
      - { skill: multiple_shot, hold_ms: 40, gap_ms: 220 }
```

- `hold_ms` — tuşun basılı kalma süresi
- `gap_ms` — o adımdan sonraki bekleme (**ayarlanması gereken asıl değer**)
- `cooldown_ms` — combo tekrar tetiklenmeden önceki bekleme

**Profillerdeki süreler başlangıç değeridir.** Doğru `gap_ms` senin attack
speed'ine, sunucuya ve ping'ine göre değişir. Ayarlama yöntemi:

```bash
python -m ko_macro combos                      # diziyi ve süreyi gör
python -m ko_macro test "60-70-72" --dry-run   # tuşa basmadan dene
python -m ko_macro test "60-70-72"             # oyunda dene
```

Skill "yenmiyorsa" `gap_ms` küçük, combo gereksiz yavaşsa büyük demektir.
20-30 ms adımlarla oynat.

### Can/mana barı

Koordinatları kendin ölçmen gerekiyor: oyunun ekran görüntüsünü al, bir resim
programında can barının sol ucunu (`x0`), sağ ucunu (`x1`), dikey ortasını
(`y`) ve dolu kısmın rengini oku.

```yaml
vitals:
  enabled: true
  hp: { x0: 40, x1: 190, y: 44, color: [168, 32, 32], tolerance: 60 }
  mp: { x0: 40, x1: 190, y: 58, color: [32, 64, 190], tolerance: 60 }
  pause_combo_below_hp: 25
  hp_potions:
    - { below_pct: 35, key: "8", cooldown_ms: 1500, label: "büyük hp" }
    - { below_pct: 70, key: "7", cooldown_ms: 2500, label: "minor hp" }
```

Doğrula:

```bash
python -m ko_macro vitals --samples 5
```

Pot seçimi eşiğe göre yapılır: canın ne kadar azsa o kadar güçlü pot seçilir
(yukarıdaki örnekte %35 altında büyük, %70 altında minor).

### Hedef barı — farm döngüsünün gözü

`farm.target_bar` tanımlarsan döngü kör çalışmaz:

```yaml
farm:
  enabled: true
  combo: "farm"
  target_bar: { x0: 700, x1: 900, y: 60, color: [190, 40, 40], tolerance: 60 }
  stall_seconds: 4.0
```

Bununla döngü şunları bilir:

- **Tab bir şey seçti mi?** Bar belirmezse çevirip yeniden dener.
- **Mob öldü mü?** Bar boşalınca hemen loot'lar ve yeni hedefe geçer — sabit
  süre beklemez.
- **Vuruş isabet ediyor mu?** `stall_seconds` boyunca can azalmazsa (menzil
  dışı, yanlış hedef) hedefi bırakır.

Tanımlamazsan `engage_seconds` kadar körlemesine vurur ve öldüğünü varsayar.

---

## Tek bölgede farm (harpy, kekoit vb.)

Karakteri mob alanının ortasına götür, orada dur, F9'a bas. Makro yürümez —
etrafındakini keser, sen nereye park ettiysen orada kalır.

```yaml
farm:
  enabled: true
  combo: "farm"
  target_bar: { x0: 700, x1: 900, y: 60, color: [190, 40, 40], tolerance: 60 }
  min_target_hp_pct: 90
  post_kill_delay_ms: 250
  stall_seconds: 4.0
```

### Hedefleme kipi: Tab yerine tıklama

Tab tek hedef verir, üstelik en yakındakini. `targeting: click` ile ekranı
tarayıp **görüş alanındaki bütün mob isim etiketlerini** bulur ve aralarından
seçer:

```yaml
farm:
  targeting: click
  target_bar: { x0: 700, x1: 900, y: 60, color: [190, 40, 40], tolerance: 60 }
  scan:
    color: [235, 235, 130]     # mob adı yazısının rengi
    tolerance: 70
    excluded:                  # sohbet kutusunu tarama
      - { x0: 0, y0: 780, x1: 700, y1: 1079 }
```

İlk denemede baktığın yöndeki (ekran ortasına en yakın) mobu seçer; tutmazsa
sıradakine geçer. Seçilen hedef yine aynı elemelerden geçer — bar var mı, canı
dolu mu, adı tuttu mu.

İmleci konuma götürmek için Leonardo'nun göreli hareketi kullanılıyor: önce
sol üst köşeye dayanıp oradan sayarak gidiyor. **Windows'ta "İşaretçi
hassasiyetini artır" kapalı olmalı** — açıkken işletim sistemi hareketi hıza
göre ölçekler ve imleç hesaplanan yere düşmez.

**Sınırları (hafıza listesiyle farkı burada):**

- Ekranda görünmeyen mob yoktur: arkanda kalan, tepenin ardındaki, kadraj
  dışındaki görünmez
- Bir şeyin arkasında kalan etiket bölünebilir ya da hiç çıkmaz
- Mesafe bilinmez, sadece etiket büyüklüğünden kabaca tahmin edilir
- Oyuncu ve NPC adları da aynı renkte olabilir — `excluded` bölgeleri ve mob
  adı filtresi bunu azaltır, sıfırlamaz

Tarama kurulmamışsa ya da ekran okunamazsa sessizce Tab'a düşer.

### Tab'ın yanlış hedef seçmesi

Tab **en yakındakini** seçer. Bu üç sorunu doğurur ve üçü de çözülü:

| Sorun | Çözüm |
| --- | --- |
| Öldürdüğün mobun **cesedi** hâlâ en yakında, Tab onu seçiyor | Ölümden sonra `post_kill_delay_ms` kadar beklenir; sonra bar boş çıkarsa hedef reddedilip Tab'a tekrar basılır |
| Başkasının dövdüğü **yarım canlı** mobu seçiyor | Canı `min_target_hp_pct` altındaki hedef atlanır — taze mobun canı doludur |
| Menzil dışındaki mobu seçip boşa vuruyor | `stall_seconds` boyunca bar düşmezse hedef bırakılır |

Yine de birkaç Tab boşa giderse (`turn_after_attempts`) karakter biraz
çevrilip tekrar denenir.

### Mob ölünce cesedine skill atma sorunu

Klasik makro derdi: mob ölür, makro combonun kalanını cesedine boşaltır.

Burada iki katmanlı bir kesme var:

- **Adımlar arasında** — her skill'den önce hedef barına bakılır.
- **Combo Leonardo'da çalışırken** — burst kipinde adımlar mikrodenetleyicinin
  kuyruğunda olduğu için PC araya giremez. Ayrı bir izleyici barı okur ve ölümü
  görünce firmware'e **iptal baytı** yollar (`A`); kuyruk o anda durur.

Yani harpy birinci skill'de ölürse ikinci skill çıkmaz. Panoda `kesilen combo`
sayacı bunu kaç kez yaptığını gösterir.

### Sadece belirli mobu dövme

Karışık bir bölgedeysen (harpy + başka moblar) mobu adından ayırt edebilir.
Adı **okumaz** — adın ekrandaki **görüntüsünü** parmak izi olarak tanır.

```
ko-macro.exe mob-ogren harpy     # harpy seçiliyken çalıştır
```

Komut hedef adının yazıldığı bölgeyi hedef barının üstünden bulur, oradaki
yazı desenini küçük bir imzaya indirger ve `config.yaml`'a yazar. Sonrasında
farm döngüsü her yeni hedefte aynı bölgeyi okur; imza tutmuyorsa hedefi
dövmeden Tab'a tekrar basar.

Birden fazla mob öğretebilirsin — komutu her biri için bir kez çalıştır:

```
ko-macro.exe mob-ogren harpy
ko-macro.exe mob-ogren kekoit
```

Panoda `yanlış mob` sayacı kaç hedefi elediğini gösterir.

**Sınırları:**

- Çözünürlük ya da arayüz ölçeği değişirse imza geçersiz olur, yeniden öğret
- Adı birbirine çok benzeyen moblar karışabilir — `name_threshold` değerini
  yükselt (0.85 → 0.92)
- Her hedeflemede bir ekran karesi alınır; çok yavaş bir makinede döngüyü
  bir miktar yavaşlatır

Filtreyi kurmazsan (varsayılan) her hedef kabul edilir — tek tip mobun olduğu
bir noktada zaten gerek yok.

### Neyi yapamaz

**Oyuncuyu mobdan ayıramaz** — canı dolu bir oyuncu Tab'la seçilirse ona
vurur. Mob adı filtresi bunu kısmen engeller (oyuncu adı mob adına
benzemez), ama garanti değil.

Mobun konumunu, tipini ya da mesafesini oyunun verisinden okumaz — bunlar
hafıza erişimi gerektirir.

---

## Kullanım

```bash
python -m ko_macro run --watch
```

Varsayılan kısayollar:

| Tuş | İş |
| --- | --- |
| F9 | farm döngüsünü aç/kapa |
| F12 | **acil durdur** — çalışan comboyu keser, tüm tuşları bırakır |
| F11 | öldürmeyi doğuş defterine yaz |
| F1-F8 | profildeki combolar |

> **Kısayolları combo içinde kullandığın tuşlara bağlama.** Leonardo gerçek bir
> klavye olduğu için bastığı tuşları kısayol dinleyicisi de görür ve makro
> kendini tetikler. Motor combo çalışırken gelen tetiklemeleri yok sayar ama
> yine de ayrı tuşlar kullan.

---

## Doğuş takibi

Asıl iş burada. Öldürme zamanlarını kaydeder, gerçek doğuş süresini
kayıtlardan öğrenir ve sıradaki pencereyi tahmin eder.

```bash
python -m ko_macro spawn add felankor --name Felankor --zone Ronark \
       --min 20 --max 30 --priority 5
python -m ko_macro spawn kill felankor              # şimdi öldü
python -m ko_macro spawn kill felankor --ago 12     # 12 dakika önce ölmüş
python -m ko_macro spawn list
python -m ko_macro spawn watch                      # canlı sayaç
```

```
mob       bölge   durum     pencere  doğmuş?  güven  örnek  kaçan
--------  ------  --------  -------  -------  -----  -----  -----
Felankor  Ronark  pencere   ŞİMDİ    %62      %71    7      -
Kekoit    Ronark  bekliyor  4d 12s   %0       %45    3      1
```

Nasıl hesaplıyor:

- **Kaçırılan tur katlama.** İki öldürme arası süre doğuş süresinin tam katıysa
  (3 turu kaçırmışsın) bölünerek tek tura indirgenir. Yoksa tek bir kaçırılmış
  tur bütün istatistiği bozardı.
- **Dayanıklı istatistik.** Ortalama yerine medyan ve MAD — tek hatalı kayıt
  tahmini kaydırmaz.
- **Pencere daralması.** 3+ örnek birikince pencere gözlemden hesaplanır,
  azken config'teki `--min`/`--max` kullanılır.
- **İleri sarma.** Pencere kapandığı hâlde kayıt girilmediyse tahmin tur tur
  ileri sarılır ve güven düşürülür (`kaçan` sütunu).
- **"doğmuş?"** — şu an doğmuş olma olasılığı. Yeterli örnek varsa normal
  dağılım, yoksa pencere içinde düzgün dağılım varsayılır.

### Konumu oyundan okuma

Oyun, oyuncunun konumunu arayüzde yazıyor. Program o rakamları tanıyabilir —
oyunun hafızasına ya da sürecine dokunmadan, sadece pikselden.

Bir kez kurulur: bir yerde dur, ekranda yazan X ve Y'yi gör, iki kutunun
koordinatlarını ver.

```
ko-macro.exe koordinat-ogren 512 378 --bolge-x 1700,20,1750,36 --bolge-y 1760,20,1810,36
```

Program o kutulardaki karakterleri senin yazdığın rakamlarla eşleştirip
kalıpları çıkarır. Bir seferde göremediği rakamlar için başka bir yere gidip
komutu tekrar çalıştır — eksikleri söyler.

```
ko-macro.exe koordinat          # şu anki konumu oku
```

Doğuş noktası eklerken konum da yazılır:

```
ko-macro.exe spawn add harpy --min 5 --max 8 --oku
```

Konumu bilinen noktalar arasında **yol süresi mesafeden hesaplanır** —
`spawn travel` ile elle girmene gerek kalmaz. Karakter hızını
`spawns.json` içindeki `units_per_second` ile ayarlarsın (varsayılan 12).

**Neden iki ayrı kutu:** tek kutudan iki sayıyı boşluğa bakarak ayırmayı
denedim, çalışmıyor — `1` gibi dar rakamlar normal harf aralığını boşluk gibi
gösteriyor ve sessizce yanlış koordinat üretiyor. İki kutu belirsizlik
bırakmıyor.

**Sınırları:** çözünürlük ya da arayüz ölçeği değişirse kalıplar geçersiz
olur, yeniden öğretmen gerekir. Tanınmayan bir karakter çıkarsa program
tahmin etmez, hata verir — yarım okunmuş koordinat yanlış veriden beterdir.

### Rota planı

Birden fazla boss takip ediyorsan hangisine sırayla gideceğini önerir:

```bash
python -m ko_macro spawn travel felankor kekoit 150   # aradaki yol: 150 sn
python -m ko_macro spawn route --start felankor
```

```
sıra  mob                 yol      bekleme   varış     puan
  1.  Felankor                0s       0s   20:12   1.899
  2.  Kekoit             2d 30s       0s   20:15   0.214
```

Her adımda "yakalama şansı × öncelik / (yol + bekleme)" en yüksek olan nokta
seçilir, saat ilerletilir, kalanlar için tekrar hesaplanır. Pencere açılmadan
varmak tam puan; pencere ilerledikçe (başkası almış olabilir) puan düşer.

---

## Otomatik yetenekler (autocast)

Buff yenileme, malice, parazit temizleme, descent, acil heal — arka planda
kendi kendine çalışır. Combo çalışırken araya girmez, aralarda tetiklenir.

```yaml
autocast:
  - name: buff-yenile
    combo: "buff"
    every_s: 900              # 15 dakikada bir
  - name: malice
    combo: "malice"
    every_s: 25
    only_when_farming: true   # sadece farm açıkken
  - name: self-heal
    combo: "heal"
    when_hp_below: 55         # ekrandan okunan gerçek can (vitals açık olmalı)
  - name: mana-pot
    key: "9"
    when_mp_below: 30
```

- `every_s` — aralık (kurallar aynı anda patlamasın diye ilk tetikleme
  rastgele dağıtılır, aralığa da jitter uygulanır)
- `when_hp_below` / `when_mp_below` — ekrandan okunan cana/manaya bakar; can
  okunamıyorsa kural **tetiklenmez** (kör basmaktansa hiç basmamak yeğdir)
- İkisi birlikte verilirse ikisi de sağlanmalı

**Dürüst sınır:** parazit/CC yediğini oyunun hafızasına bakmadan anlayamayız.
Temizleme kuralları bu yüzden süreye dayanır, olaya değil. Can/mana koşulları
ise gerçekten ekrandan okunur.

## Duruş (Z) geri alma

Bazı skill dizileri okçuyu Z duruşundan çıkarıyor. `restore_stance: true` olan
combolar bittiğinde duruş tuşuna basıp geri döner:

```yaml
stance_key: "z"
stance_delay_ms: 120

combos:
  - name: "60-70-72"
    restore_stance: true
    steps: [...]
```

## Yardımcı makrolar

`utility` bölümünde tanımlanır, hepsi combo motorunu kullanır:

```yaml
utility:
  upgrade_keys: ["enter", "enter"]   # anvil dizisi
  upgrade_speed_ms: 220
  repair_keys: ["r", "enter"]        # magic hammer
  anti_afk_interval_s: 120
  anti_afk_click: left
  descent_key: "f8"
  equipment_sets:
    pvp:  ["f1", "f2"]
    farm: ["f3", "f4"]
  hotkeys:                           # kısayola bağla
    repair: "home"
    upgrade: "insert"
```

Üç şekilde tetiklenir:

- **Kısayolla** — `utility.hotkeys` (combo ve kontrol tuşlarıyla çakışamaz,
  çakışırsa config yüklenirken hata verir)
- **Otomatik** — `autocast` kuralı adı doğrudan kullanabilir:
  ```yaml
  autocast:
    - { name: oto-tamir,   combo: "repair",  every_s: 900 }
    - { name: oto-descent, combo: "descent", every_s: 300, only_when_farming: true }
  ```
- **Elle** — `python -m ko_macro test repair`

`python -m ko_macro combos` combolarla birlikte yardımcı makroları ve
autocast kurallarını da listeler.

---

## Komutlar

| Komut | İş |
| --- | --- |
| `run` | motoru çalıştır (`--watch` canlı pano, `--dry-run` tuşa basmadan) |
| `test <combo>` | tek combo çalıştır |
| `combos` | comboları, kısayolları ve sürelerini listele |
| `vitals` | can/mana barını oku (koordinat ayarı için) |
| `devices` | bağlı Leonardo'ları listele |
| `profiles` | hazır sınıf profilleri |
| `spawn add/kill/list/watch/route/travel/rm` | doğuş takibi |

Her komutta `--dry-run` var: hiçbir tuşa basmadan ne yapacağını yazdırır.

---

## Leonardo yoksa

`transport.kind` üç değer alır:

- `leonardo` — donanım (önerilen)
- `software` — `pydirectinput` ile yazılımsal tuş (yalnız Windows)
- `dry-run` — hiçbir tuşa basmaz, sadece yazdırır

---

## Seri protokol

Leonardo'ya doğrudan konuşmak istersen (115200 baud, satır sonu `\n`):

| Komut | Cevap | İş |
| --- | --- | --- |
| `V` | `VER ko-hid 1.0` | sürüm |
| `P` | `PONG` | heartbeat (watchdog besler) |
| `E` / `X` | `ARMED` / `DISARMED` | çıkışı aç / kapat |
| `R` | `RELEASED` | basılı tuşları bırak |
| `T <tuş> [ms]` | `OK` | tuşa bas-bırak |
| `D` / `U <tuş>` | `OK` | basılı tut / bırak |
| `C <buton> [ms]` | `OK` | fare tıkla |
| `MV <dx> <dy>` | `OK` | fareyi hareket ettir |
| `QC` / `QK` / `QM` | `OK` | combo kuyruğunu temizle / adım ekle |
| `G [tekrar]` | `DONE <adım>` | kuyruğu çalıştır |
| `A` | `ABORT` | çalışan comboyu kes |

Güvenlik: açılışta kapalı, `E` gelmeden HID çıkışı yok. ARMED iken 2 saniye
komut gelmezse (PC çöktü, kablo çıktı) her şeyi bırakıp kapanır. Seri port
kapanınca da aynısı olur.

---

## Testler

```bash
cd python && python -m pytest tests -q      # 267 test
arduino/test/run_tests.sh                    # firmware testleri (donanım gerekmez)
```

Firmware testleri Arduino çekirdeğini `arduino/test/stubs/` altındaki
taklitlerle değiştirip `.ino`'yu doğrudan PC'de derler — protokol
ayrıştırıcısı, combo kuyruğu, iptal ve watchdog davranışı gerçek kart
olmadan doğrulanır.

---

## Dosya düzeni

```
arduino/
  ko_hid_bridge/ko_hid_bridge.ino   Leonardo firmware'i
  test/                             PC'de çalışan firmware testleri

python/
  main.py           exe giriş noktası
  ko-macro.spec     PyInstaller yapılandırması
  derle.bat         tek tıkla exe derleme (Windows)
  baslat.bat        exe'yi başlatan kısayol
  ko_macro/
    paths.py        kaynak/exe yol çözümlemesi
    calibrate.py    barları ekranda otomatik bulma
    nameplate.py    hedef adını görüntüsünden tanıma
    mobscan.py      ekranda mob isim etiketlerini bulma
    ocr.py          ekrandaki rakamları okuma (konum)
    transport.py    Leonardo / yazılımsal / kuru mod taşıma katmanları
    sequence.py     combo motoru (jitter, burst, cooldown)
    farm.py         hedef seç → vur → öldüğünü gör → yağmala döngüsü
    vitals.py       can/mana ve hedef barı okuma, pot seçimi
    autocast.py     arka planda çalışan tekrarlı/koşullu yetenekler
    spawn.py        doğuş kaydı, tahmin, rota planı
    utility.py      upgrade / tamir / anti-AFK / ekipman
    runtime.py      hepsini çalıştıran motor
    hotkeys.py      global kısayollar
    dashboard.py    canlı pano
    cli.py          komut satırı
  profiles/         archer.yaml, priest.yaml
  tests/
```

---

## Bilinen sınırlar

- **Mob seçimi oyunun Tab'ına bağlı.** Ekrandaki mobları koordinatıyla
  bulamaz; hafıza okumadan bu mümkün değil ve bu proje onu yapmıyor.
- **Otomatik yürüme yok.** Bir noktada durup etraftakini farmlar.
- **Bar koordinatları çözünürlüğe bağlı.** Çözünürlük ya da arayüz ölçeği
  değişirse yeniden ölçmen gerekir.
- **Burst combo sırasında pot basılamaz.** Can kontrolü combo turları arasında
  yapılır; en fazla bir tur (genelde 1 sn'nin altı) gecikme olur.
- **Zamanlamalar tahmini değil, deneysel.** Profillerdeki değerler başlangıç
  noktasıdır, kendi karakterinde ölçüp ayarlaman gerekir.
