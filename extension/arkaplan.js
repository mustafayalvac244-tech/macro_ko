/**
 * Simgeye tıklayınca YAN PANELİ açar.
 *
 * NEDEN POPUP DEĞİL. İlk sürümde tek düğmelik bir popup vardı ve kullanıcı
 * haklı olarak "eklenti dediğin ekran açılır, uygulamanın her işlevi burada
 * olmalı" dedi. Popup küçük, geçici ve sayfadan uzaklaşınca kapanır; yan panel
 * ise UYAP'ın yanında AÇIK KALIR — avukat dosyayı okurken ajandası ve
 * içtihat araması yanında durur.
 */
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
