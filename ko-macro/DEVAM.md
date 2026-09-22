# Devam notu — bu işi yerel makinede sürdürecek oturum için

Bu dosya, projenin bulutta yazılan kısmının **nerede bittiğini** anlatıyor.
Buraya kadar olan her şey bir bulut konteynerinde yazıldı: orada USB yok,
ekran yok, oyun yok. Yani kodun tamamı **oyunda hiç denenmedi.**

Yerel bir oturum bu dosyayı okuyup kaldığı yerden devam edebilir.

---

## Neyin kanıtlandığı, neyin kanıtlanmadığı

Bu ayrım projenin en önemli bilgisi; karıştırılırsa saatler boşa gider.

**Kanıtlanan** — 341 Python testi + 63 firmware kontrolü geçiyor:

- Kod kendi içinde tutarlı; yazdığı şeyi yapıyor
- Combo motoru adımları doğru sırayla ve doğru gecikmeyle kuyruğa yazıyor
- Firmware komutları doğru çözümlüyor, watchdog tuşları bırakıyor
- Doğuş tahmini, ekran okuma, savaş kaydı eşleme mantığı çalışıyor
- Exe Windows'ta derleniyor ve açılıyor

**Kanıtlanmayan** — hiçbiri denenmedi:

- Knight Online'ın Leonardo'nun tuşlarını kabul edip etmediği
- Ekrandaki bar/nameplate/savaş kaydı koordinatlarının doğruluğu
- Combo gecikmelerinin (`gap_ms`) oyunun saldırı hızına uyup uymadığı
- Mobun ölümünün gerçekten yakalanıp yakalanmadığı
- Oyunun Leonardo takılıyken normal açılıp açılmadığı

> Kullanıcı bir noktada "oyun Leonardo'yu engelliyor" dedi, ama sonra hiçbir
> şey yüklemediğini söyledi. Yani bu **doğrulanmamış bir tahmin**, kanıt değil.
> Aşağıdaki Test 0 tam olarak bunu ölçüyor.

---

## Yerel oturumun ilk yapacağı: sırayla üç test

Bunlar bitmeden yeni özellik yazmanın anlamı yok — her biri diğerinin
önkoşulu.

### Test 0 — Oyun Leonardo ile açılıyor mu

Leonardo'yu USB'ye tak, oyunu aç.

- Normal açılıyorsa → Test 1'e geç
- Uyarı veriyor / kapanıyorsa → **donanım yolu baştan tartışılmalı**,
  aşağıdaki hiçbir şeyin anlamı kalmaz

### Test 1 — Tuşlar oyuna ulaşıyor mu

```
ko-macro.exe tani          # zincirin hangi halkası kopuk, söyler
ko-macro.exe test "3-5"    # oyun penceresi önde, 3 sn geri sayım
```

Karakter skill atıyorsa donanım yolu çalışıyor demektir. Bu, projenin
tamamının dayandığı tek varsayım.

### Test 2 — Ekran okuma doğru mu

```
ko-macro.exe kalibre --yaz
ko-macro.exe vitals --samples 5
```

Yazdığı yüzde gerçek canına yakın olmalı. Değilse `config.yaml` içindeki
`vitals` koordinatları elle ölçülmeli.

---

## Ayarlanması gereken, ancak oyunda ayarlanabilecek değerler

Hepsi `config.yaml` içinde. Buradaki hazır değerler **tahmin**, ölçüm değil:

| Alan | Ne zaman değiştirilir |
| --- | --- |
| `gap_ms` (combo adımları) | Skill atlanıyorsa artır, combo yavaşsa azalt |
| `vitals.hp/mp` koordinatları | `vitals` yanlış yüzde yazıyorsa |
| `farm.target_bar` | Mobun öldüğü an anlaşılmıyorsa |
| `farm.min_target_hp_pct` | Ceset/yarım canlı mob seçiliyorsa |
| `farm.scan.color` | Nameplate tıklama ıskalıyorsa |
| `farm.kill_phrase` | `kayit-ogren kill` ile ekrandan öğretilir |

---

## Yapılmayan işler

- **Tüccar turu** (envanter dolunca NPC'ye gidip sat → tamir → aynı slota
  dön). Tasarımı konuşuldu, kodu **yazılmadı**. Takıldığı yer: "envanter
  doldu" sinyalinin oyundan nasıl okunacağı — KO bunu sohbete yazıyor mu,
  bilinmiyor.
- `signals.py` yazıldı ama `config`/`autocast`/`runtime` içine **bağlanmadı**.

---

## Sınır — bilerek yapılmayanlar

Kullanıcı hooking / bellek okuma işini beş kez istedi, beş kez reddedildi.
Bu bir eksiklik değil, bilinçli bir tasarım sınırı:

- Süreç enjeksiyonu yok
- Oyun belleğini okuma/yazma yok
- Paket manipülasyonu yok
- GameGuard/HackShield'a dokunma yok
- Leonardo'nun USB kimliğini tespit edilmemek için gizleme yok

Program dışarıdan, gerçek bir klavye/fare gibi davranıyor ve ekranı
okuyor — o kadar. Bu sınırı koruyun.

> Makro kullanmak Knight Online'ın kullanım şartlarına aykırı ve hesap
> banlanabilir. Bu tasarım o riski ortadan kaldırmaz.

---

## Klasör haritası

| Yol | Ne var |
| --- | --- |
| `ko-macro/python/ko_macro/` | Programın tamamı |
| `ko-macro/python/tests/` | 341 test |
| `ko-macro/python/profiles/` | `archer.yaml`, `priest.yaml` |
| `ko-macro/arduino/ko_hid_bridge/` | Leonardo firmware'i |
| `ko-macro/arduino/test/` | Firmware testleri (Linux'ta koşar) |
| `ko-macro/KURULUM.md` | Son kullanıcı rehberi |
| `.github/workflows/build-exe.yml` | Windows exe + Release |

Depo kökündeki `app/`, `src/`, `supabase/` **başka bir projeye** ait
(Expo uygulaması); ko-macro ile ilgisi yok.

## Testleri koşturmak

```
cd ko-macro/python && python -m pytest tests -q
./ko-macro/arduino/test/run_tests.sh
```
