# Kurulum — sıfırdan çalışır hâle

Bu rehber hiç programlama bilmediğini varsayıyor. Sırayla git.

**Gereken:** bir Arduino Leonardo (ya da Micro / Pro Micro), veri aktarabilen
bir USB kablosu, Windows bir bilgisayar.

> Şarj kablosu olmaz — bazı kablolar sadece güç taşır, veri taşımaz. Kartı
> taktığında bilgisayar hiç ses vermiyorsa büyük ihtimalle kablo bu yüzdendir.

---

## Adım 1 — Programı edin

İki yol var. **A yolu daha kolay**, bilgisayarına hiçbir şey kurmuyorsun.

### A yolu: GitHub derlesin (önerilen)

1. Tarayıcıdan depoyu aç: `github.com/mustafayalvac244-tech/macro_ko`
2. Üstteki **Actions** sekmesine tıkla.
3. Soldaki listeden **"ko-macro exe"** seç.
4. Sağdaki **"Run workflow"** düğmesine bas, dalı seç, tekrar **"Run workflow"**.
5. 3-5 dakika bekle. Yeşil tik gelince o satıra tıkla.
6. Sayfanın altında **Artifacts** kısmındaki **ko-macro-windows** dosyasını indir.
7. Zip'i bir klasöre çıkar. İçinde `ko-macro.exe`, `config.yaml` ve
   `baslat.bat` olacak.

### B yolu: kendi bilgisayarında derle

1. `python.org/downloads` adresinden Python 3.10 veya üstünü kur.
   Kurulum ekranındaki **"Add Python to PATH"** kutusunu işaretle — bunu
   atlarsan çalışmaz.
2. Depoyu indir (yeşil **Code** düğmesi → **Download ZIP**), bir yere çıkar.
3. `ko-macro\python` klasörüne gir, **`derle.bat`** dosyasına çift tıkla.
4. Bitince `dist` klasöründe `ko-macro.exe` hazır olacak.

---

## Adım 2 — Leonardo'ya firmware yükle

Bu adım tek seferlik. Kart bir kez programlandıktan sonra bir daha
uğraşmayacaksın.

1. `arduino.cc/en/software` adresinden **Arduino IDE**'yi indir ve kur.
2. Leonardo'yu USB ile bilgisayara tak.
3. Arduino IDE'yi aç.
4. **File → Open** ile şu dosyayı aç:
   `ko-macro\arduino\ko_hid_bridge\ko_hid_bridge.ino`
5. **Tools → Board → Arduino AVR Boards → Arduino Leonardo** seç.
   (Micro kullanıyorsan Arduino Micro seç.)
6. **Tools → Port** menüsünden kartın portunu seç (genelde `COM3`, `COM4`
   gibi bir şey ve yanında "Arduino Leonardo" yazar).
7. Sol üstteki **→** (Upload) düğmesine bas.
8. Altta **"Done uploading"** yazısını görene kadar bekle.

Yükleme başarısız olursa: kartın reset düğmesine hızlıca **iki kez** bas ve
hemen Upload'a tekrar tıkla. Leonardo'da bu normaldir.

> Firmware yüklendikten sonra kart bilgisayarda bir klavye olarak görünür ama
> kendi başına hiçbir tuşa basmaz — program ona "aç" komutu göndermeden tek
> bir tuş bile üretmez.

---

## Adım 3 — İlk çalıştırma

1. Leonardo takılı olsun.
2. `baslat.bat` dosyasına **sağ tıkla → "Yönetici olarak çalıştır"**.

   Yönetici olması şart değil ama F9/F12 gibi kısayolların oyun penceresi
   öndeyken çalışması için genelde gerekiyor.

3. Ekranda önce kartın bulunup bulunmadığı yazacak:

   ```
   COM5    Arduino Leonardo
   ```

   Böyle bir satır görüyorsan her şey yolunda. **"Leonardo bulunamadı"**
   yazıyorsa Adım 2'ye dön ya da kabloyu değiştir.

4. Sonra program açılır ve kısayolları listeler.

Kapatmak için pencerede **Ctrl+C**.

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

## Adım 6 — Can barını tanıt (isteğe bağlı ama çok işe yarar)

Program can barını ekrandan okuyup otomatik pot basabilir. Bunun için barın
ekranda tam olarak nerede olduğunu söylemen gerekiyor.

1. Oyunu aç, canın **tam doluyken** ekran görüntüsü al (PrintScreen).
2. Görüntüyü Paint'e yapıştır.
3. Fareyi can barının **sol ucuna** getir — sol altta koordinat yazar,
   not al. Bu `x0`.
4. Fareyi barın **sağ ucuna** getir → `x1`.
5. Barın **dikey ortasındaki** y değeri → `y`.
6. Paint'te damlalık aracıyla barın dolu kısmına tıkla, sonra
   "Renkleri düzenle" ile Kırmızı/Yeşil/Mavi değerlerini oku → `color`.

`config.yaml`:

```yaml
vitals:
  enabled: true
  hp: { x0: 40, x1: 190, y: 44, color: [168, 32, 32], tolerance: 60 }
  mp: { x0: 40, x1: 190, y: 58, color: [32, 64, 190], tolerance: 60 }
  hp_potions:
    - { below_pct: 35, key: "8", cooldown_ms: 1500 }   # can %35 altı: büyük pot
    - { below_pct: 70, key: "7", cooldown_ms: 2500 }   # can %70 altı: minor
```

Doğru okuyor mu diye kontrol et:

```
ko-macro.exe vitals --samples 5
```

Canın gerçekten neyse ona yakın bir yüzde yazmalı. Tutmuyorsa koordinatları
ya da rengi düzelt.

**Aynı yöntemle hedef barını da tanıtırsan** (`farm.target_bar`) farm döngüsü
mobun ne zaman öldüğünü görür — sabit süre beklemez, çok daha hızlı olur.

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

**"Leonardo bulunamadı"**
Kablo veri taşımıyor olabilir, ya da firmware yüklenmemiştir. Arduino IDE'yi
açıp Tools → Port'ta kart görünüyor mu bak. Arduino IDE'nin Serial Monitor'ü
açıksa kapat — portu kilitler.

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
