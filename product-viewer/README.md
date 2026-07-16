# mioren — 3D Ürün Görüntüleyici

`index.html` — Yeşim taşı gua sha fırçasının **etkileşimli 3D** sunumu.
Tek dosya, **harici kütüphane yok** (saf WebGL). İnternet bağlantısı olmadan da çalışır.

## Özellikler

- Fareyle sürükleyerek 360° döndürme, tekerlek / parmak sıkıştırma (pinch) ile yakınlaştırma
- Otomatik dönüş ve "Görünümü Sıfırla" düğmeleri
- Prosedürel 3D model: mermer dokulu yeşim taş + altın *mioren* logosu + yelpaze fırça
- Stüdyo aydınlatması, yumuşak zemin gölgesi, mobil uyumlu (dokunmatik destekli)

## Kullanım

Dosyayı doğrudan tarayıcıda açabilir ya da web sitenize koyabilirsiniz.

### Sayfaya gömme (iframe)

```html
<iframe
  src="product-viewer/index.html"
  style="width:100%; height:640px; border:0; border-radius:16px;"
  title="mioren 3D ürün görüntüleyici"
  loading="lazy"
  allowfullscreen>
</iframe>
```

Shopify / WordPress / Wix gibi platformlarda "özel HTML / embed" bloğuna
yukarıdaki `<iframe>` kodunu yapıştırmanız yeterli. `index.html` dosyasını
sunucunuza (ör. `product-viewer/` klasörü olarak) yüklemeyi unutmayın.

## Özelleştirme

`index.html` içinde kolayca değiştirebileceğiniz yerler:

| Ne | Nerede |
|----|--------|
| Taş rengi / mermer damarları | `marbleCanvas()` fonksiyonu (`#20402f`, `#173026` …) |
| Logo yazısı ve amblem | `marbleCanvas(withLogo)` içinde `c.fillText('mioren', …)` |
| Fırça kılı rengi | `buildBrush()` → `c0` (dip) ve `c1` (uç) renkleri |
| Arka plan | `<style>` içindeki `#wrap` `background` gradyanı |
| Başlık / alt yazı | `.brand` bloğundaki HTML metni |
| Aydınlatma | `setLights()` fonksiyonu |

## Notlar

- Model, ürün fotoğrafına göre elle şekillendirilmiş prosedürel bir 3B
  temsildir. Birebir tarama (photogrammetry) isterseniz, gerçek `.glb`/`.gltf`
  dosyası üretmek için ürünün çok açılı fotoğraflarıyla bir 3D tarama servisi
  gerekir; o modeli de aynı görüntüleyiciye bağlayabiliriz.
