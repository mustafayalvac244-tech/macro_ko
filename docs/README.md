# Yayınlanan sayfalar (GitHub Pages)

`main` dalının bu klasöründen yayınlanır:

- `index.html` — TANITIM SAYFASI (ana sayfa). Elle yazılır; terms.html gibi
  üretilmez. İçindeki ÖLÇÜM SAYILARI gerçek koşulardan gelir — değiştirmeden
  önce yeni ölçüm koşun, yoksa sayfa ölçülmemiş bir iddia yayınlar.
- `privacy.html` — Gizlilik Politikası (App Store zorunlu alanı)
- `terms.html` — Kullanım Koşulları / EULA (App Store Review 3.1.2)
- `app/` — Vekil Pro'nun WEB SÜRÜMÜ (Chrome eklentisinin yan panelinde açılan sayfa)

## `.nojekyll` neden var — silmeyin

GitHub Pages varsayılan olarak Jekyll ile çalışır ve Jekyll **alt çizgiyle
başlayan klasörleri yok sayar**. Expo web paketi `app/_expo/static/js/...`
altında duruyor: `.nojekyll` olmadan `index.html` 200 döner ama JavaScript
paketi **404** olur ve uygulama BOŞ EKRAN açılır. Hata mesajı da vermez —
sessiz bir arıza.

Ölçüldü: dosya eklenmeden önce paket 404, eklendikten sonra 200.

## `app/` nasıl yeniden üretilir

    npx expo export --platform web --output-dir docs/app

`app.json` içindeki `experiments.baseUrl` = `/macro_ko/app` olmalı; yoksa
varlık yolları kökten aranır ve alt yolda 404 verir.
