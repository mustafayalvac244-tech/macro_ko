import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { CAPTCHA_ENABLED, TURNSTILE_SITE_KEY } from '@/config/captcha';

/**
 * Görünmez Cloudflare Turnstile doğrulaması.
 *
 * TASARIM KARARI — "insanları sinir etmeyen" şu demek: bileşen normalde
 * YÜKSEKLİĞİ SIFIR olarak çizilir, kullanıcı hiçbir şey görmez ve hiçbir şeye
 * tıklamaz. Turnstile arka planda çalışıp jetonu verir. YALNIZCA Turnstile
 * gerçekten insan onayı isterse (before-interactive geri çağrısı) kutu açılır.
 * Yani sürtünme, ancak şüpheli bir durumda ve o kadarla sınırlı olarak doğar.
 *
 * NEDEN WebView. Turnstile bir tarayıcı bileşenidir; React Native'de karşılığı
 * yoktur. react-native-webview zaten projede kuruluydu, bu yüzden yeni bir
 * native bağımlılık EKLENMEDİ — mevcut derlemeler bozulmaz.
 *
 * ANAHTAR YOKSA HİÇ ÇİZİLMEZ (null döner) ve çağıran ekran jetonsuz devam
 * eder; bu, bugünkü davranışın aynısıdır.
 */
export function Captcha({
  onToken,
  onError,
}: {
  onToken: (token: string) => void;
  onError?: () => void;
}) {
  const [interaktif, setInteraktif] = useState(false);
  const webRef = useRef<WebView>(null);

  // Jeton tek kullanımlıktır ve ~5 dakikada süresi dolar. Ekran uzun süre açık
  // kalırsa elde eskimiş bir jeton kalmasın diye Turnstile kendini yeniler;
  // 'expired-callback' bunu tetikler.
  const html = `<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1">
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script>
<style>html,body{margin:0;padding:0;background:transparent;display:flex;justify-content:center}</style>
</head><body><div id="cf"></div>
<script>
  function gonder(m){ window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
  window.onloadTurnstileCallback = function () {
    turnstile.render('#cf', {
      sitekey: ${JSON.stringify(TURNSTILE_SITE_KEY)},
      appearance: 'interaction-only',
      callback: function (t) { gonder({ tip: 'jeton', jeton: t }); },
      'before-interactive-callback': function () { gonder({ tip: 'etkilesim' }); },
      'expired-callback': function () { gonder({ tip: 'suresi-doldu' }); turnstile.reset('#cf'); },
      'error-callback': function () { gonder({ tip: 'hata' }); }
    });
  };
  var bekle = setInterval(function () {
    if (window.turnstile) { clearInterval(bekle); window.onloadTurnstileCallback(); }
  }, 100);
</script></body></html>`;

  const mesaj = useCallback(
    (ham: string) => {
      let m: { tip?: string; jeton?: string };
      try {
        m = JSON.parse(ham);
      } catch {
        return;
      }
      if (m.tip === 'jeton' && m.jeton) {
        setInteraktif(false);
        onToken(m.jeton);
      } else if (m.tip === 'etkilesim') {
        setInteraktif(true);
      } else if (m.tip === 'hata') {
        onError?.();
      }
    },
    [onToken, onError]
  );

  useEffect(() => {
    if (!CAPTCHA_ENABLED) onError?.();
    // Anahtar yokken çağıran taraf beklemeye düşmesin diye bir kez haber verilir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!CAPTCHA_ENABLED) return null;

  return (
    <View style={interaktif ? styles.gorunur : styles.gizli} pointerEvents={interaktif ? 'auto' : 'none'}>
      <WebView
        ref={webRef}
        source={{ html, baseUrl: 'https://vekilpro.app' }}
        onMessage={(e) => mesaj(e.nativeEvent.data)}
        originWhitelist={['https://*']}
        javaScriptEnabled
        // Arka plan şeffaf: gizliyken hiçbir iz bırakmaz.
        style={styles.web}
        containerStyle={styles.web}
        scrollEnabled={false}
        onError={() => onError?.()}
        onHttpError={() => onError?.()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Görünmez hâl: yer kaplamaz, dokunma almaz. Kullanıcı varlığını fark etmez.
  gizli: { height: 0, width: 0, opacity: 0, overflow: 'hidden' },
  // Yalnız Turnstile insan onayı istediğinde açılır.
  gorunur: { height: 74, width: '100%', marginBottom: 12 },
  web: { backgroundColor: 'transparent', flex: 1 },
});
