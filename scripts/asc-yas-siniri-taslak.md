# App Store yaş sınırı beyanı — cevaplar ve gerekçeleri

> **18.09.2026.** Ürün sahibi onayı: *"önerdiğin gibi yap."* Öneri şuydu:
> korpus ceza kararları içerdiği için şiddet ve yetişkin temalarını
> **"seyrek/hafif"** beyan etmek; muhtemel sonuç 12+ ya da 17+.
>
> **NEDEN EKSİK BEYAN ETMİYORUZ.** Vekil Pro'nun kendi yazdığı hiçbir içerik
> yok; ama uygulama **ham Yargıtay ve Danıştay kararlarını** gösteriyor ve o
> korpusta cinsel saldırı, kasten öldürme ve yaralama dosyaları var. Karar
> metni olayı açıkça anlatır. Apple'ın sorusu "uygulamada bu içerik var mı" —
> kaynağının mahkeme kararı olması onu içerik olmaktan çıkarmıyor.
>
> **Maliyeti sıfır, riski büyük.** Hedef kitlenin tamamı avukat, yani zaten
> yetişkin; 17+ hiçbir kullanıcı kaybettirmiyor. Eksik beyan ise sonradan
> fark edilirse yayından kaldırma sebebi.

## Ölçülen durum (koşu #8, 18.09.2026)

```
app
  bundleId                 = com.vekilpro.app
  name                     = Vekil Pro: Avukat Asistanı
  primaryLocale            = tr
  isOrEverWasMadeForKids   = false
  contentRightsDeclaration = null   ← doldurulacak

appInfo 3e8a75b7-414e-474e-9b9a-f43b29f53620
  appStoreState     = PREPARE_FOR_SUBMISSION
  appStoreAgeRating = null          ← anket cevaplanınca Apple hesaplayacak

appStoreVersion 1837e750-3b34-4bef-ba72-98e770d8f5b9
  versionString = 3.4.0             ← ürün sahibi düzeltti, DOĞRULANDI
  usesIdfa      = null              ← doldurulacak
  copyright     = null              ← doldurulacak
```

## Cevaplar — gerekçeleriyle

**ALAN ADLARI HENÜZ YAZILMADI.** Apple'ın doküman sayfaları JavaScript ile
çiziliyor; alan adları canlı API'den okunup buraya geçirilecek. Aşağıdakiler
**cevapların kendisi**, alan eşlemesi ölçümden sonra yapılacak.

| soru | cevap | gerekçe |
|---|---|---|
| Karikatür/fantezi şiddet | yok | uygulamada oyun/çizim yok |
| **Gerçekçi şiddet** | **seyrek/hafif** | ceza kararları yaralama ve öldürme olaylarını anlatıyor |
| **Uzun süreli grafik şiddet** | **yok** | metin var, görsel/video yok |
| **Cinsel içerik / çıplaklık** | **seyrek/hafif** | cinsel saldırı kararlarının metni olayı tarif ediyor |
| Müstehcen mizah | yok | — |
| **Yetişkin/rahatsız edici temalar** | **seyrek/hafif** | suç, ölüm, istismar dosyaları |
| Korku | yok | — |
| Küfür / kaba dil | seyrek/hafif | hakaret davalarında sözler karar metninde aynen geçiyor |
| Alkol, tütün, uyuşturucu | seyrek/hafif | uyuşturucu ticareti kararları |
| Kumar (simüle/gerçek) | yok | uygulamada kumar öğesi yok |
| Yarışma | yok | — |
| Tıbbi/tedavi bilgisi | **yok** | ürün hukuk ürünü; sağlık verisi bu depoya girmiyor (AGENTS.md) |
| **Kullanıcı üretimi içerik** | **yok** | tevkil panosu, avukat sohbeti ve büro sohbeti ekranları PARK EDİLDİ (`src/ekranlar-beklemede/`); Play içerik anketinde de aynı cevap verildi |
| **Mesajlaşma / sohbet** | **yok** | aynı gerekçe. AI sohbeti kullanıcı–model arasındadır, kullanıcılar birbirine içerik gösteremez |
| Sosyal medya | yok | ürün sosyal ağ değil |
| Sınırsız web erişimi | yok | uygulama içinde gömülü tarayıcı yok; bağlantılar `Linking.openURL` ile sistem tarayıcısına gidiyor |
| Konum paylaşımı | yok | kullanıcılar birbirine konum gösteremiyor |

## Ayrıca doldurulacak, yaş sınırından ayrı

| alan | cevap | gerekçe |
|---|---|---|
| `usesIdfa` | **false** | uygulamada reklam yok, izleme yok — `PAZAR.md`'de reklamsızlık ürünün ayırt edici yanı olarak ölçüldü |
| `contentRightsDeclaration` | üçüncü taraf içerik **içeriyor** | mahkeme kararları ve kanun metinleri. Bunlar kamuya açık resmî belgeler; yine de "içermiyor" demek yanlış olur |
| `copyright` | `2026 Vekil Pro` | ürün sahibi isterse ticari unvanla değiştirir |

## BU DOSYANIN KAPSAMADIĞI — ürün sahibinin vermesi gereken beyanlar

- **App Privacy (veri etiketi)** — hangi veriyi topladığımızın hukuki beyanı.
  `docs/privacy.html` ile birebir tutmalı. Taslağı ayrıca çıkarılacak.
- **Trader status** — AB'de tacir olup olmadığı beyanı. Tamamen ürün
  sahibinin; üçüncü kişi veremez.

## Apple'ın öğrettiği: dört alan ZORUNLU (koşu #10, 18.09.2026)

İlk PATCH 409 döndü ve tip hatası vermedi — yalnız dört alanın eksik
olduğunu söyledi:

```
409 ENTITY_ERROR.ATTRIBUTE.REQUIRED
  gunsOrOtherWeapons · ageAssurance · advertising · parentalControls
```

Gönderilen 19 alanın tipleri hakkında **şikâyet yoktu**; yani sıklık
enum'u / boolean ayrımı doğru tahmin edilmiş görünüyor (kesin kanıt değil,
Apple önce zorunluluğu denetliyor olabilir).

| alan | cevap | gerekçe |
|---|---|---|
| `gunsOrOtherWeapons` | **seyrek/hafif** | ceza kararları ateşli silahla işlenen suçları anlatıyor; diğer şiddet alanlarıyla aynı çizgi |
| `advertising` | **hayır** | uygulamada reklam yok. `PAZAR.md`'de ölçüldü: rakip Corpus Hukuk'un 1 yıldızlarının çoğu uygunsuz reklamdan; reklamsızlık bizim ayırt edici yanımız |
| `parentalControls` | **hayır** | ebeveyn denetimi özelliği yok; hedef kitle avukat |
| `ageAssurance` | **hayır** | yaş doğrulama mekanizması yok |
