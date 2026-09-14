---
name: olcum
description: Vekil Pro'da bir sayı, oran, hız, boyut, süre ya da "şu an durum ne" iddiası üretirken kendi ölçümünle kendini kandırmamanın yolları — aracı doğrulama, süzmeden bakma, "koştu" ile "doğru" ayrımı, eskimiş sabit tuzağı. Kullanıcı "ölç", "kaç", "ne kadar", "durum ne", "hızlandır", "karşılaştır", "daha iyi mi", "işe yarıyor mu" gibi bir şey sorduğunda; bir rapor, kıyas (benchmark), teşhis ya da performans iddiası yazarken; ve bir aracın/kütüphanenin/yaklaşımın bize uygun olup olmadığına karar verirken MUTLAKA bu skill'i kullan — kullanıcı "ölçüm" kelimesini hiç söylemese bile. Kod hakkında olmayan (ürün, piyasa, rakip, strateji) iddialar için de geçerlidir.
---

# Ölçüm disiplini

`AGENTS.md` "abartma, ölç" diyor. Bu dosya onun eksik yarısı: **nasıl ölçülür
ki insan kendi ölçümüyle kendini kandırmasın.**

> Aşağıdaki her madde bu depoda GERÇEKTEN OLMUŞ bir hatadan geliyor ve
> hepsi 14.09.2026'da, tek bir günde. Genel tavsiye yok.

---

## 1. Aleti okumadan önce aleti doğrula

Bir ölçüm yöntemi sana sayı verdiğinde, o sayı doğru olmayabilir — **yöntem
bozuk olabilir ve bozukken de sayı üretir.** Sessizce yanlış bir sayı,
hiç sayı olmamasından kötüdür: ona dayanıp karar verirsin.

**Kontrol vakası kur:** yöntemin, **orada olduğunu kesin bildiğin** bir şeyi
bulup bulmadığına bak. Bulamıyorsa, bulamadığı diğer şeyler de kanıt değildir.

- **Hermes olayı.** Android paketinde pano kodu var mı diye `.hbc` dosyasında
  dizge aradım. "Yok" çıktı ve sevindim — ta ki kontrol satırlarının da "yok"
  çıktığını görene kadar; oysa onlar orada OLMAK ZORUNDAYDI. Yöntem
  bozuktu. `--no-bytecode` ile yeniden aldım: bu sefer kontroller bulundu,
  demek ki "yok"lar gerçekti. **Play içerik anketinin cevabı buna
  dayanıyordu** — ilk sonuçla gitseydim yanlış beyan verecektim.

- **Kıyas üreteci olayı.** tsvector karşılaştırması için sentetik metin
  ürettim. Alt sorgu `generate_series`'e bağlı olmadığı için Postgres onu BİR
  KEZ değerlendirdi: 4553 karakterin tamamı aynı kelimeydi, tsvector'de tek
  lexeme vardı. Fark etmeseydim "tsvector ucuzmuş" diye tam ters sonuç
  çıkaracaktım. Yakalatan şey: `length(to_tsvector(...))` = 1 sayısının
  makul olmaması.

**Alışkanlık:** ölçüm çıktısında bir sayı "fazla temiz" ya da "fazla iyi"
görünüyorsa, önce aleti şüpheli say.

---

## 2. Ölçüm dosyasının çıktısı, içine gömülü sabitler kadar güvenilir

Bu, günün en pahalı hatasıydı.

`0121` teşhis dosyası **"6000 MB frenine kalan karar: 135.890"** yazıyordu.
Ben de ürün sahibine **"disk frenine 9 gün kaldı"** dedim. Yanlıştı: canlı
frenin gerçek eşiği `disk_musait_mi` fonksiyonunda **30.000 MB**. O `6000`
sayısı dosyanın içine elle yazılmıştı ve eskimişti. **Gerçek cevap 76 gündü.**

Yani ölçüm aracının çıktısını okurken, onun kendi varsayımını ölçüm sandım.

**Alışkanlık:**
- Bir ölçüm dosyasında eşik/limit/oran gibi bir sabit görürsen, o sabitin
  hâlâ doğru olup olmadığını **canlıdan** doğrula.
- Yazarken sabit gömmek yerine değeri kaynağından oku. `0121` artık eşiği
  `pg_get_functiondef` ile fonksiyondan okuyor; eşik değişince kendiliğinden
  doğruyu söylüyor.
- Bir sayıyı başkasına aktarırken **nereden geldiğini** de söyle. "9 gün"
  demek yerine "0121'in hesabına göre 9 gün" deseydim, ikimiz de sabiti
  sorgulardık.

---

## 3. Sonucu görmeden süzme

Ölçümü daraltmak bazen gereklidir ama **hangi satırın çıkacağını varsayıp onu
elemek ölçüm değil, tahmindir.**

`0133`'te indekssiz yabancı anahtarları sayarken eczane tablolarını bir
`not in (...)` listesiyle çıkarmıştım — "nasılsa onlar çıkar" diye. Süzgeci
kaldırınca gerçek sonuç göründü ve varsayımım doğru çıktı; ama **doğru
çıkması şanstı**, yöntem yanlıştı. Üstelik o ad listesi sağlık verisi
bekçisini de düşürdü.

**Alışkanlık:** önce filtresiz bak, çıkanı gör, sonra gerekiyorsa daralt —
ve daralttığını çıktıda yaz.

---

## 4. "Koştu" ile "doğru oturdu" aynı şey değil

`0131` ve `0132` canlıya uygulandı, iş akışı **"UYGULANDI"** dedi. O çıktı
yalnız *hata çıkmadığını* gösteriyordu. Göç hatasız koşup yine de beklenenden
farklı bir şema bırakabilir: sütun tipi, kısıt, politika, tetikleyici.

Ayrı bir **salt okunur doğrulama** koştum (`0133`) ve ancak o zaman
"`amount` gerçekten `ALWAYS` hesaplanan sütun, RLS açık, tetikleyici yerinde"
diyebildim.

Aynı ayrım her yerde geçerli:
- OTA "başarılı" = yayımlandı. **İndiğini** ancak cihazda görmek kanıtlar.
- Test "geçti" = bugünkü kod için geçti. **Isırdığını** ancak bilerek bozup
  düşürerek kanıtlarsın (bugün iki bekçide bunu yaptım).
- Derleme "başarılı" = paket çıktı. İçinde ne olduğu ayrı ölçüm.

---

## 5. Tek ölçüm hız vermez

Hasat raporunda "2,37 milyon künye bekliyor" sayısı vardı. "Ne zaman biter?"
sorusunun cevabı bu sayıda **yok**: hız, iki ölçüm arasındaki farktır.

Ürün sahibine ETA vermedim, "hız ölçülmedi" dedim. Sonra zaman damgalarından
gerçek hızı çıkardım (son 24 saatte 13.252 karar → 363,7 MB/gün) ve ancak o
zaman "76 gün" diyebildim.

**Alışkanlık:** tek fotoğraftan eğim çıkarma. Ya iki zaman noktası ölç, ya da
veride zaten duran zaman damgalarından geçmişi hesapla.

---

## 6. Yöntem güvenilmez çıkınca sonucu kurtarmaya çalışma

tsvector ara yolunu (`fts_simple`'ı düşürmek) sınayamadım: ürettiğim sentetik
metinde her satır her kelimeyi içerdiği için her sorgu her satırla eşleşti ve
planlayıcı indeksi hiç kullanmadı. Elimde iki sayı vardı (3 ms / 562 ms) ve
onlardan bir sonuç çıkarmak çok kolaydı.

Çıkarmadım. **"Doğrulanamadı" demek, zayıf bir kanıttan güçlü bir cümle
kurmaktan iyidir.**

---

## 7. Stratejik iddia da ölçüm ister

Kod hakkında ölçmeden konuşmuyordum ama ürün/piyasa hakkında konuşmayı
kendime serbest bırakmışım. Bir günde üç yanlış:

| Yazdığım | Gerçek | Doğrulaması |
|---|---|---|
| "Sıfır avukat bu uygulamayı kullandı" | Kodda **19 yerde** Burak'ın geri bildirimi var | `grep Burak` |
| UYAP'a "yapılamaz" | İki yoldan yalnız biri kapalı | mevzuatı okumak |
| "Tanıtım sitesi özellik listesi dilinde" | Manşet zaten doğruydu | dosyayı açmak |

Üçünün de doğrulaması birer dakikalıktı.

**Alışkanlık:** "rakipler", "kullanıcılar", "piyasa", "kimse", "hep", "hiç"
geçen bir cümle kurmadan önce kendine sor: bunu neyle doğruladım?

---

## 8. Popülerlik uygunluk değildir

`graphify` aracının 116,7 bin yıldızı vardı. Yıldız, **bize uygunluğu**
ölçmez. Kurdum, dört soru sordum (cevaplarını zaten ölçmüştüm), karşılaştırdım
ve kendi kod tabanımızda sınırlı kaldığını gördüm — sütun adı taşımıyor,
TypeScript↔SQL köprüsü yok.

Ayrıca **dört soru kapsamlı bir değerlendirme değildir** ve bunu da yazdım.

---

## Bir ölçüm sonucunu aktarırken

Çıplak sayı gönderme; yanında şunlar olsun:

- **Kaynak** — canlı mı, yerel mi, sentetik mi? Hiyerarşi:
  gerçek kullanıcı verisi > deterministik ölçüm > birkaç AI denemesi.
- **Kapsam** — kaç satır, hangi zaman aralığı, örneklem mi tam tarama mı.
- **Ne söylemediği** — "yayımlandı" mı "indi" mi; "çalıştı" mı "doğru" mu.
- **Kendi hatan** — yöntemi yol boyu düzelttiysen bunu sakla**ma**; okuyan
  kişi sayının ne kadar sağlam olduğunu ancak böyle bilir.

Sayı bir önceki sayıyla çelişiyorsa, **çelişkiyi düzeltmeden bildir.** Bugün
`ictihat_kararlar` 43.979 ile katalogdaki "metni inmiş" 22.733 tutmuyordu;
sebebini bilmediğimi yazdım. Yumuşatmak, okuyanın yanlış karar vermesine
yol açar.
