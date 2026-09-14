# Mağaza görselleri

`npm run magaza:gorsel` ile üretilir (`scripts/magaza-ekranlari.mjs`).

| Dosya | Play'de nereye |
|---|---|
| `ikon-512.png` | Uygulama simgesi (512×512) |
| `01-pano.png` … `06-ictihat.png` | Telefon ekran görüntüleri (1079×2397) |
| `one-cikan-1024x500.png` | Öne çıkan görsel (feature graphic) |

Öne çıkan görsel ayrı üretilir: `npm run magaza:one-cikan`
(`scripts/one-cikan-gorsel.mjs`). Fontlar node_modules'ten okunup data URI
olarak gömülüyor; render sırasında ağa çıkılmıyor.

## Ekran görüntülerindeki veri KURGUDUR

Av. Selin Aydın, Mehmet Korkmaz, Zeynep Arslan, Doruk İnşaat A.Ş. ve
bütün dosya numaraları uydurmadır. Gerçek müvekkil verisi mağazaya
konulamaz; boş ekran da ürünü olduğundan kötü gösterir.

## Nasıl çalışıyor

Derlenmiş web sürümü (`docs/app`) yerel bir sunucudan servis edilir,
Playwright bütün Supabase isteklerini yakalayıp sahte cevap döner. Yani
çekilen şey ekranın GERÇEĞİDİR — maket değil.

⚠️ **Görseller `docs/app` ile birlikte eskir.** Arayüz değişince
`npm run export:web` sonra `npm run magaza:gorsel` koşulmalı.
