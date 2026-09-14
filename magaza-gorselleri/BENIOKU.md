# Mağaza görselleri

`npm run magaza:gorsel` ile üretilir (`scripts/magaza-ekranlari.mjs`).

| Dosya | Play'de nereye |
|---|---|
| `ikon-512.png` | Uygulama simgesi (512×512) |
| `01-pano.png` … `06-ictihat.png` | Telefon ekran görüntüleri (1079×2397) |

**Eksik: öne çıkan görsel (1024×500).** Henüz üretilmedi.

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
