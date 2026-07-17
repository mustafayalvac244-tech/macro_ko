# mioren 3D görüntüleyici — siteye yükleme

Bu klasör (`web/`) **kendi kendine yeterlidir** — hiçbir CDN/internet
bağımlılığı yoktur (three.js, Draco çözücü, HDRI, model hepsi içeride).
Tüm yollar görelidir, yani sunucunuzda hangi klasöre koyarsanız çalışır.

## İçerik
```
index.html            görüntüleyici
mioren_brusher.glb    3D model (Draco sıkıştırmalı, ~6 MB)
studio.hdr            stüdyo ışık ortamı (yansımalar)
vendor/               three.js r168 + GLTF/DRACO/RGBE yükleyiciler
embed-example.html    iframe ile gömme örneği (isteğe bağlı)
```

## 1) Doğrudan yükleme (en basit)
`web/` klasörünü olduğu gibi sunucunuza yükleyin, örn:
`https://siteniz.com/product-3d/web/`
Ardından ürün sayfanıza şu kodu ekleyin:

```html
<iframe
  src="https://siteniz.com/product-3d/web/index.html"
  style="width:100%; aspect-ratio:4/5; max-height:80vh; border:0; border-radius:18px;"
  title="mioren 3D ürün görüntüleyici"
  loading="lazy" allowfullscreen>
</iframe>
```

## 2) Shopify / WordPress / Wix
- Dosyaları platformun dosya/medya yöneticisine yükleyin (ya da bir alt alan
  adına/CDN'e koyun).
- Ürün açıklamasına **"Özel HTML" / "Embed"** bloğu ekleyip yukarıdaki
  `<iframe>` kodunu yapıştırın; `src`'yi yüklediğiniz gerçek adrese göre düzeltin.

## Sunucu notları
- Statik dosya sunumu yeterlidir; özel bir backend gerekmez.
- `.glb`, `.hdr`, `.wasm` dosyaları ikili (binary) olarak sunulmalıdır —
  neredeyse tüm barındırmalarda varsayılan budur. `.wasm` sunulamazsa
  görüntüleyici otomatik olarak saf-JS Draco çözücüye düşer.
- `file://` ile (çift tıklayıp) açılmaz; bir web sunucusu üzerinden
  (http/https) açılmalıdır. Yerel test için: `python3 -m http.server`

## Görünümü koruma
Renkler, taş dokusu ve lif şekli modele (`mioren_brusher.glb`) ve
`index.html` içindeki malzeme ayarlarına gömülüdür; dosyaları değiştirmediğiniz
sürece görünüm sabit kalır.
