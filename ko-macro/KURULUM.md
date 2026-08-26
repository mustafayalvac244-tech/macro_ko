# Kurulum — sıfırdan çalışır hâle

Bu rehber hiç programlama bilmediğini varsayıyor. Sırayla git.

**Gereken:** bir Arduino Leonardo (ya da Micro / Pro Micro), veri aktarabilen
bir USB kablosu, Windows bir bilgisayar.

> Şarj kablosu olmaz — bazı kablolar sadece güç taşır, veri taşımaz. Kartı
> taktığında bilgisayar hiç ses vermiyorsa büyük ihtimalle kablo bu yüzdendir.

---

## Adım 1 — Programı edin

Üç yol var. **A yolu en kolayı** — tek link, giriş bile gerekmiyor.

### A yolu: hazır sürümü indir (önerilen)

1. Şu adresi aç:
   `github.com/mustafayalvac244-tech/macro_ko/releases/latest`
2. Sayfanın altındaki **Assets** başlığı altından **`ko-macro-windows.zip`**
   dosyasına tıkla. İnmeye başlar.
3. Zip'i bir klasöre çıkar. İçinde `ko-macro.exe`, `config.yaml`,
   `baslat.bat` ve `firmware\` klasörü olacak.

> Bu yol için GitHub hesabına **giriş yapmana gerek yok.**

### B yolu: Actions'tan indir

Sadece henüz sürüm çıkmamış yeni bir değişikliği denemek istiyorsan.
**GitHub'a giriş yapmış olman şart** — giriş yapmadan çalışma satırlarına
tıklanmaz ve dosya inmez.

1. Depoyu aç, üstteki **Actions** sekmesine tıkla.
2. Soldaki listeden **"ko-macro exe"** seç.
3. En üstteki yeşil tikli satıra tıkla.
4. Sayfanın altında **Artifacts** kısmındaki **ko-macro-windows** dosyasını indir.

### C yolu: kendi bilgisayarında derle

1. `python.org/downloads` adresinden Python 3.10 veya üstünü kur.
   Kurulum ekranındaki **"Add Python to PATH"** kutusunu işaretle — bunu
   atlarsan çalışmaz.
2. Depoyu indir (yeşil **Code** düğmesi → **Download ZIP**), bir yere çıkar.
3. `ko-macro\python` klasörüne gir, **`derle.bat`** dosyasına çift tıkla.
4. Bitince `dist` klasöründe `ko-macro.exe` hazır olacak.

---

## Adım 2 — `baslat.bat`

Leonardo'yu USB'ye tak, **oyunu aç**, canın tam dolu olsun. Sonra
`baslat.bat` dosyasına **sağ tıkla → "Yönetici olarak çalıştır"**.

Gerisini kendisi yapıyor:

| | Ne yapar |
| --- | --- |
| 1 | Kartı arar. Cevap vermezse **firmware'i kendisi yükler** (1-2 dk). |
| 2 | Ekranın okunabildiğini doğrular. |
| 3 | `config.yaml` yoksa kurulumu çalıştırır, bar koordinatlarını ekrandan bulur. |
| 4 | Programı açar. |

Yönetici olması şart değil ama F9/F12 gibi kısayolların oyun penceresi
öndeyken çalışması için genelde gerekiyor.

Kapatmak için pencerede **Ctrl+C**.

> Firmware yüklendikten sonra kart bilgisayarda bir klavye olarak görünür ama
> kendi başına hiçbir tuşa basmaz — program ona "aç" komutu göndermeden tek
> bir tuş bile üretmez.

---

## Adım 3 — Takılırsan: `tani`

Bir yerde durursa `baslat.bat` zaten tanılamayı kendisi çalıştırır. Elle de
çalıştırabilirsin:

```
ko-macro.exe tani
```

Zinciri baştan sona dener — USB portu, firmware, ekran okuma, fare ivmesi,
oyun penceresi, ayar dosyası — ve **hangi halkanın koptuğunu** söyler. Her
hatanın altında `->` ile ne yapılacağı yazar.

Sonucu `tanilama.txt` dosyasına da yazar. Çözemezsen o dosyanın içeriğini
olduğu gibi paylaş — içinde sorunu bulmak için gereken her şey var.

<details>
<summary>Firmware'i elle yüklemek istersen</summary>

`baslat.bat` bunu kendisi yapıyor, ama ayrı çalıştırmak istersen:

| Nereden aldın | Klasör |
| --- | --- |
| İndirdiğin zip (Releases ya da Actions) | `firmware\` |
| Depoyu ZIP olarak indirdin | `ko-macro\arduino\` |

O klasördeki **`yukle.bat`** dosyasına çift tıkla. arduino-cli'yi ve AVR
çekirdeğini kendi klasörüne indirir, kartı bulur, derler ve yükler. Arduino
IDE gerekmez.

Kart bulunamazsa sık nedenler:

- Kablo veri taşımıyor (sadece şarj kablosu) — kabloyu değiştir
- Arduino IDE'nin Serial Monitor'ü açık — kapat
- Yükleme yarıda kaldı — kartın reset düğmesine **hızlıca iki kez** bas ve
  tekrar çalıştır

Arduino IDE ile yapmak istersen: `ko_hid_bridge\ko_hid_bridge.ino` dosyasını
aç, **Tools → Board → Arduino Leonardo**, portu seç, **Upload**.

> Dosyayı GitHub'ın web görünümünden kopyalayıp yapıştırma — satır sonları
> bozulabiliyor. Zip'i indir.

</details>

---

## Adım 4 — Kendi tuşlarını tanıt

`config.yaml` dosyasını Not Defteri ile aç. En önemli kısım `skillbar`:

```yaml
profile: archer        # okçu için archer, priest için priest

skillbar:
  spike: "1"           # 60 - Spike hangi tuşta?
  arrow_shower: "2"    # 70 - Arrow Shower hangi tuşta?
  multiple_shot: "3"   # 72 - Multiple Shot hangi tuşta?
  styx: "4"
  cure: "5"
  m20: "6"
```

Sol taraftaki isimlere dokunma, **sağ taraftaki tuşları kendi bar dizilimine
göre değiştir.** Oyunda Spike hangi tuştaysa onu yaz.

Kaydet, programı kapatıp tekrar aç.

Doğru mu diye bak:

```
ko-macro.exe combos
```

Bu komut her combonun hangi tuşlara basacağını sırayla yazar.

---

## Adım 5 — Combo hızını ayarla

Bu adımı atlarsan combolar ya "yenmez" ya da gereksiz yavaş olur. Her
karakterin saldırı hızı farklı olduğu için hazır değerler sadece başlangıç
noktası.

Önce tuşa basmadan dene:

```
ko-macro.exe test "60-70-72" --dry-run
```

Sonra oyunda dene (oyun penceresi önde olsun, 3 saniye geri sayım var):

```
ko-macro.exe test "60-70-72"
```

`config.yaml` içinde o combonun `gap_ms` değerlerini oynat:

- Skill **yenmiyorsa / atlanıyorsa** → `gap_ms` çok küçük, **artır**
- Combo **gereksiz yavaşsa** → `gap_ms` çok büyük, **azalt**

20-30 milisaniyelik adımlarla değiştir, her seferinde tekrar dene. Doğru
değeri bulman 10-15 deneme sürebilir, normal.

---

## Adım 6 — Can barını tanıt (otomatik)

Program can barını ekrandan okuyup otomatik pot basabilir, hedef barından da
mobun ne zaman öldüğünü anlar. Koordinatları **kendisi buluyor**:

1. Oyunu aç, canın **tam dolu** olsun, pencere görünür kalsın.
2. Şunu çalıştır:

   ```
   ko-macro.exe kalibre --yaz
   ```

Ekranı tarar, bar gibi duran yatay renk şeritlerini bulur, hangisinin can /
mana / hedef barı olduğunu tahmin eder ve `config.yaml`'a yazar. Eski hâli
`config.yaml.yedek` olarak saklanır.

> `baslat.bat`'ı ilk kez çalıştırdığında bunu zaten kendisi yapar.

Doğru bulmuş mu diye kontrol et:

```
ko-macro.exe vitals --samples 5
```

Canın gerçekten neyse ona yakın bir yüzde yazmalı. Yanlışsa:

- `ko-macro.exe kalibre` (yazmadan) ile tüm adayları listele
- Doğru olanın koordinatlarını `config.yaml`'a elle yaz
- Ekranda başka kırmızı/mavi öğeler varsa `--min-width` değerini büyüt

Pot eşiklerini kendine göre ayarla:

```yaml
vitals:
  hp_potions:
    - { below_pct: 35, key: "8", cooldown_ms: 1500 }   # can %35 altı: büyük pot
    - { below_pct: 70, key: "7", cooldown_ms: 2500 }   # can %70 altı: minor
```

---

## Adım 7 — Kısayollar

Program açıkken:

| Tuş | Ne yapar |
| --- | --- |
| **F12** | **ACİL DURDUR** — her şeyi bırakır. Panikleyince buna bas. |
| F9 | Farm döngüsünü aç/kapa |
| F11 | "Bu mobu öldürdüm" diye doğuş defterine yazar |
| F1-F8 | Combolar (hangisinin nerede olduğunu `combos` komutu yazar) |

> Kısayolları combolarda kullandığın tuşlara **bağlama**. Leonardo gerçek bir
> klavye olduğu için kendi bastığı tuşu da görür ve kendini tetikler.

---

## Bir şeyler ters giderse

**Önce her zaman şunu çalıştır:**

```
ko-macro.exe tani
```

Aşağıdakilerin çoğunu zaten kendisi tespit edip ne yapılacağını yazar.

**"Leonardo bulunamadı"**
Kablo veri taşımıyor olabilir, ya da firmware yüklenmemiştir. `tani` çıktısındaki
"USB / seri port" bölümü bilgisayardaki bütün portları listeler; kart hiç
görünmüyorsa sorun kablodadır. Arduino IDE'nin Serial Monitor'ü açıksa kapat —
portu kilitler.

**Fare ile mob etiketine tıklama ıskalıyor**
Windows'un "İşaretçi hassaslığını artır" ayarı açık. Leonardo göreli hareket
gönderiyor; ivme açıkken gittiği yer tutmuyor. Denetim Masası → Fare →
İşaretçi Seçenekleri'nden kapat. `tani` bunu da kontrol ediyor.

**Program açılıyor ama oyunda hiçbir tuşa basılmıyor**
Oyun penceresi önde mi? Bir de `ko-macro.exe test "3-5"` ile dene — geri
sayım sırasında oyuna geç.

**Kısayollar (F9/F12) çalışmıyor**
`baslat.bat`'ı yönetici olarak çalıştır. Oyun yönetici olarak çalışıyorsa
program da yönetici olmak zorunda.

**Combolar yarım kalıyor / tuşlar atlanıyor**
`gap_ms` değerlerini artır (Adım 5).

**Can barı yanlış okunuyor**
`tolerance` değerini artır (60 → 90). Arayüz ölçeğini ya da çözünürlüğü
değiştirdiysen koordinatları yeniden ölç.

**Tuş basılı kaldı**
Firmware 2 saniye komut gelmezse her şeyi kendiliğinden bırakır. Yine de
takılırsa Leonardo'nun kablosunu çıkar — donanımdır, çıkınca biter.

---

## Son bir hatırlatma

Makro kullanmak Knight Online'ın kullanım şartlarına aykırı ve hesabın
banlanabilir. Bu program o riski ortadan kaldırmaz — oyunun korumasına
dokunmuyor, sadece dışarıdan gerçek bir klavye gibi tuşa basıyor. Kararı
sen veriyorsun.
