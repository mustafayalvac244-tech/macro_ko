# UYAP / Bedesten içtihat kaynağı — ölçülmüş notlar

Bu dosya, başka bir projeye **yapıştırılmak** üzere yazıldı. İçindeki her sayı
bu depoda gerçek isteklerle ölçüldü (12.09.2026); tahmin yok. Tekrar koşulursa
aynı çıkması beklenir.

**Vekil Pro'nun altyapısına erişim GEREKTİRMEZ.** Anlatılan uç noktalar
Adalet Bakanlığı'nın herkese açık servisidir; anahtar, hesap, izin yok.

---

## Uç noktalar

```
POST https://bedesten.adalet.gov.tr/emsal-karar/searchDocuments
POST https://bedesten.adalet.gov.tr/emsal-karar/getDocumentContent
```

Başlıklar (üçü de gerekli):

```
Content-Type: application/json
Accept: application/json
AdaletApplicationName: UyapMevzuat
User-Agent: Mozilla/5.0
```

Gövde her zaman `{"data": { ... }}` sarmalıyla gider.

### Arama

```json
{"data":{
  "pageSize": 100,
  "pageNumber": 1,
  "itemTypeList": ["YARGITAYKARARI"],
  "phrase": "kira",
  "kararTarihiStart": "2024-03-05T00:00:00.000Z",
  "kararTarihiEnd":   "2024-03-05T23:59:59.999Z"
}}
```

`itemTypeList`: `YARGITAYKARARI` | `DANISTAYKARAR` (ikisi birden verilebilir).

### Belge

```json
{"data":{"documentId":"1045700100"}}
```

Yanıt `data.content` **base64**; çözünce HTML. Türkçe harflerin bozulmaması
için baytları `TextDecoder('utf-8')` ile çözün, `atob` çıktısını doğrudan
string saymayın.

---

## Ölçülen davranışlar — bunları bilmeden vakit kaybedilir

| Konu | Ölçüm |
|---|---|
| **Boş `phrase`** | Reddediliyor: `ADALET_PARAMETER_VALIDATION_EXCEPTION` — "Sadece harf ve rakam içeren aramalar yapılabilir" |
| **Tek harf / durak kelime** | `"a"`, `"ve"` → aynı hata |
| **Evrensel kelime** | `"mahkeme"`, `"karar"`, `"dava"` aynı toplamı veriyor (2024-03-05 Yargıtay: üçü de 1.632). `"kamulastirma"` 0. Yani süzgeç gerçek, bu kelimeler her kararda geçiyor → **boş aramanın yerine geçer** |
| **Tarih süzgeci** | Çalışıyor: `phrase="kira"` tüm zaman 123.458 · 2024 Ocak 339 · tek gün 36 |
| **`pageSize`** | 100 çalışıyor, **200 → `ADALET_EMPTY_EXCEPTION`** |
| **Derin sayfa** | `pageNumber` 5.000'de bile satır dönüyor — tavan görülmedi |
| **Sayfa sonu** | 1.632 kayıtlı günde sayfa 17 → 32 kayıt, sayfa 18 → 0. Eksik sayfa = pencerenin sonu |
| **`birimAdi` süzgeci** | Çalışıyor: `"Hukuk Genel Kurulu"` + 2024 → 747 |
| **Toplu belge indirme** | **YOK.** `documentIdList` / `documentIds` / `idList` → `ADALET_RUNTIME_EXCEPTION`. Karar başına 1 HTTP isteği kırılmaz taban |
| **Aramaya metin iliştirme** | **YOK.** `includeContent` / `withContent` / `returnFields` kabul ediliyor ama **yok sayılıyor** |
| **Sahte başarı** | HTTP 200 dönüp `metadata.FMTY == "ERROR"` olabiliyor. "Sonuç yok" sanmayın, **hata sayın** |

### Kesme işareti tuzağı

`phrase` içindeki `'` `’` `ʼ` aramayı **tamamen öldürüyor** (ölçüldü: 0 kayıt
vs 86.985). Temizleyin.

---

## Hız ve boyut

```
arama (pageSize 100)     1,08 sn  → 100 künye
belge, seri + 300ms uyku 1,01 belge/sn
belge, eşzamanlılık 4    4,24 belge/sn   0 hata
belge, eşzamanlılık 8    8,29 belge/sn   0 hata  (yalnız 16 belgelik TEK patlama)
üstveri toplama          271 satır/sn (eşzamanlılık 4)
ortalama karar metni     ~8,3 KB
```

**Eşzamanlılık 8 sürekli denenmedi.** Önceki bir ölçümde 16'da `429` geldiği
kaydedilmiş. 4 güvenli görünüyor.

### Güvenilirlik — bunu hafife almayın

Aynı gün, aynı arama:

- bir denemede **TLS el sıkışması zaman aşımı**
- ikinci denemede **dört tekrarla 34,86 saniye** (sağlıklıyken 1,08 sn)
- ayrıca ayrı bir turda **HTTP 429 Too Many Requests**

Sebep: aynı anda başka bir işimiz kaynağa yükleniyordu. **Kaynak çoğu zaman
hızlı, bazen ölü.** Kullanıcının beklediği bir yola koyacaksanız sıkı zaman
aşımı + devre kesici şart; tekrar denemeyin (tekrar, bekleyen kullanıcının
süresini katlar).

---

## Korpusun büyüklüğü (`phrase="mahkeme"` ile, yıl yıl)

```
1990-2026 TOPLAM   Yargıtay 9.977.503   Danıştay   414.267   = 10.391.770
2005-2026          Yargıtay 9.976.045   Danıştay   407.292   = 10.383.337  (%99,92)
```

Yoğunluk: Yargıtay'ın zirvesi **2012-2015 (yılda ~900 bin)**, Danıştay'ınki
**2023-2024**. Danıştay 2006-2019 arası yılda 300-2.600 karar — neredeyse boş.

### Pencere boyu seçimi

Korpusu süpürmek için tarih penceresi kullanın. Pencere **çok küçükse** boş
gün keşfetmeye istek harcarsınız, **çok büyükse** sayfa derinliği artar.

```
Yargıtay · GÜN penceresi   7.925 pencere + 99.760 sayfa = ~107.685 istek
Yargıtay · AY  penceresi     273 pencere + 99.760 sayfa = ~100.033 istek  (%7 kazanç)
Danıştay · GÜN penceresi   7.925 pencere +  4.073 sayfa =  ~11.998 istek
Danıştay · AY  penceresi     273 pencere +  4.073 sayfa =   ~4.346 istek  (2,8 kat kazanç)
```

Yargıtay'da ay penceresi %7 kazandırır ama yoğun bir ay **750 sayfa**
derinliğine iner. Derin sayfanın çalıştığı ölçüldü; **sıralamanın sayfalar
arasında kararlı olduğu ÖLÇÜLMEDİ**. Kararsızsa derin sayfalama karar atlar.
%7 için bu risk alınmadı — Yargıtay gün, Danıştay ay.

---

## Mimari tavsiyesi (bizim vardığımız yer)

Tam metinle korpusun tamamı ≈ **340 GB** ve yıllar. Sadece **üstveri**
(documentId, daire, esas no, karar no, tarih) ≈ **3 GB** ve günler; ölçülen
maliyet satır başına **316 bayt**.

Bu yüzden iki katman:

1. **Katalog** — korpusun tamamı, üstveri olarak. "Bu karar var mı?" sorusunu
   cevaplar. Yapay zekâ uygulamalarında en değerli şey budur: uydurma atıfı
   tahminle değil **aramayla** yakalarsınız.
2. **Metin** — yalnız gerçekten gereken kararlar; talep geldikçe canlı çekip
   saklayın. Havuz kullanıcının gerçek ihtiyacına yakınsar.

---

## ⚠️ İKİ UYGULAMA AYNI ANDA HASAT YAPARSA

Kaynağın hız sınırı **bizim tarafımızda değil, onların tarafında**. İki ayrı
projeniz aynı anda toplarsa **aynı bütçeyi paylaşırlar** ve ikisi de yavaşlar
— bugün tam olarak bu yaşandı (429 + TLS zaman aşımı).

Bir kamu hizmetini iki koldan zorlamak ayrıca **IP yasağı** riski taşır ve o,
her iki ürünü birden öldürür. İki proje de toplayacaksa:

- saatleri **bölüşün** (biri gündüz, biri gece), ya da
- tek bir toplayıcı olsun, diğeri onun çıktısını okusun

---

## Vekil Pro'dan doğrudan kullanılabilecekler

| Kaynak | Adres | Not |
|---|---|---|
| Kanun metinleri (17 kanun, 5 MB) | `https://vekilpro.app/app/veri/kanun/*.json` | `index.json` listeyi verir |
| Atıf denetimi (derlenmiş) | `https://vekilpro.app/denetim.js` | `window.VekilDenetim`, 3 KB |

**Bunları hotlink etmeyin, kopyalayın.** GitHub Pages ağır trafik için
tasarlanmadı; yüksek kullanım kısıtlanmaya yol açar ve o durumda Vekil Pro'nun
kendi web sürümü de düşer.

## ⛔ Paylaşılmayacaklar

- **`service_role` / `sb_secret_...` anahtarı** — hiçbir koşulda, hiçbir
  projeye. Bu anahtar RLS'i baypas eder; sızarsa tüm avukat verisi gider.
- **İçtihat havuzuna doğrudan veritabanı erişimi.** `ictihat_kararlar` zaten
  `anon` ve `authenticated`'a kapalı; öyle kalmalı. Başka bir uygulamanın
  havuza ihtiyacı varsa doğru yol, ona **kendi** okuma ucunu yazmaktır —
  paylaşılan anahtar değil.
- Zaten gerek de yok: havuzumuzda 16.809 karar var, kaynakta 10,4 milyon.
  Öteki uygulama doğrudan kaynağa gitsin, daha iyisini alır.
