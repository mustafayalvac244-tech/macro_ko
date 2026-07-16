# mioren 2-in-1 Kontur Fırçası — 3D Ürün Varlığı

Blender ile modellenmiş, GLB'ye optimize edilmiş ve profesyonel bir Three.js
görüntüleyicide sunulan gerçek ölçekli 3D ürün.

## Klasör yapısı

```
product-3d/
  blender/
    reference_upload.blend     Master .blend (tek parça serpantin gövde,
                               yoğun lif demeti, logo decal, stüdyo ışıkları)
    gen_product.py             Faz 1 — script ile parametrik geometri + ölçü
                               doğrulama render'ları (bpy / Blender 5.0 + Cycles)
    make_stone_textures.py     numpy ile gerçekçi serpantin PBR dokuları
                               (albedo / roughness / normal, 2048, tileable)
    make_textures.py           logo + kıl kartı yardımcı dokuları
    export_glb.py              Faz 3 — taşa serpantin malzeme, lifleri vertex
                               renge çevir + azalt, GLB (Draco) dışa aktar
    annotate_dims.py           ölçü etiketli doğrulama render'ları
  textures/                    üretilen PBR dokuları
  renders/                     doğrulama render'ları (ortografik + 3/4 + ölçü)
  web/
    index.html                 Three.js viewer (GLTFLoader + OrbitControls)
    mioren_brusher.glb         optimize edilmiş web varlığı (~4 MB, Draco)
    vendor/                    yerele gömülü three.js r168 (CDN gerektirmez)
```

## Gerçek ölçüler (geometriye uygulanmıştır)

| Ölçü | Hedef |
|---|---|
| Gövde genişliği (ön) | 8 cm |
| Gövde yüksekliği | 7 cm |
| Üst kesit (sol kenar → çentik) | 5 cm |
| Kıl yüksekliği | 2 cm |
| Gövde kalınlığı (yan) | 2.5 cm |
| Üst çıkıntı kalınlığı | 1 cm |
| Kıl demeti kalınlığı | 2 cm |

## Modeli yeniden üretme / dışa aktarma

Gereksinim: `pip install bpy==5.0.1 numpy pillow` (Blender'ın resmî Python
modülü; masaüstü Blender 4.5+/5.0 ile de çalışır).

```bash
cd product-3d/blender
python3 make_stone_textures.py       # serpantin PBR dokularını üret
python3 make_textures.py             # logo + kıl yardımcı dokuları
python3 gen_product.py --phase 1     # (opsiyonel) ölçü doğrulama render'ları
python3 export_glb.py                # web/mioren_brusher.glb üret
```

`export_glb.py` şunları yapar: taşı yeniden UV açar ve serpantin PBR
malzemesini atar, 17 280 lif eğrisini ~%60'a indirip mesh'e çevirir,
kök→uç bakır gradyanını **vertex renk** (COLOR_0) olarak yazar, gövde +
lif + logo + yatak parçalarını Draco sıkıştırmalı tek `.glb` olarak verir.

## Web görüntüleyiciyi yerelde çalıştırma

Tarayıcılar `file://` üzerinden ES-modül + GLB yüklemez; basit bir sunucu gerekir:

```bash
cd product-3d/web
python3 -m http.server 8080
# tarayıcıda:  http://localhost:8080/
```

Sitenize gömmek için `web/` klasörünü sunucunuza kopyalayın ve bir
`<iframe src=".../product-3d/web/index.html">` ekleyin; ya da GitHub Pages
ile `https://<kullanıcı>.github.io/macro_ko/product-3d/web/` adresinden yayınlayın.

### Görüntüleyici özellikleri
- GLTFLoader + DRACOLoader ile GLB yükleme (geometri Three.js'te yeniden
  üretilmez), yükleme yüzdesi ve hata durumu
- OrbitControls: 360° döndürme, yakınlaştırma, sönümlemeli (damping)
- Ön / arka / sol / sağ / üst / 3-çeyrek kamera presetleri
- Otomatik döndürme, görünümü sıfırla, tam ekran, açık-gri / koyu-yeşil arka plan
- Stüdyo HDRI ortamı (RoomEnvironment PMREM), key/fill/rim ışıklar, zemin +
  gerçek temas gölgesi
- ACES Filmic tone mapping, sRGB çıktı, ~85 mm ürün-fotoğrafı kadraj
- Masaüstü ve mobil duyarlı yerleşim
