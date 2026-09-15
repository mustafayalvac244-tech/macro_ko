// 3B tuvalinin NATIVE taşıyıcısı — react-native-webview.
//
// Platform ayrımı neden burada: `react-native-webview` web'i desteklemiyor
// (web paketinde hiçbir şey çizmiyor). Ayrımı bu küçük taşıyıcıda yapınca
// Model3B'nin geri kalanı — düğmeler, vurgular, mesajlaşma — tek bir kod
// olarak kalıyor. Metro, web paketinde otomatik olarak ModelTuvali.web.tsx
// dosyasını seçer.

import React, { useImperativeHandle, useRef } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

export interface TuvalKolu {
  gonder: (n: unknown) => void;
}

export const ModelTuvali = React.forwardRef<TuvalKolu, {
  html: string;
  onMesaj: (ham: string) => void;
}>(function ModelTuvali({ html, onMesaj }, ref) {
  const web = useRef<WebView>(null);
  useImperativeHandle(ref, () => ({
    gonder: (n) => web.current?.postMessage(JSON.stringify(n)),
  }), []);

  return (
    <WebView
      ref={web}
      source={{ html }}
      originWhitelist={['*']}
      onMessage={(e) => onMesaj(e.nativeEvent.data)}
      style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent' }]}
      javaScriptEnabled
      domStorageEnabled={false}
      scrollEnabled={false}
      bounces={false}
      androidLayerType={Platform.OS === 'android' ? 'hardware' : undefined}
      setSupportMultipleWindows={false}
    />
  );
});
