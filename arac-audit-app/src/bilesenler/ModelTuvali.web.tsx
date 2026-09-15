// 3B tuvalinin WEB taşıyıcısı — <iframe srcDoc>.
//
// react-native-webview web'de çalışmaz. react-native-web zaten React DOM
// üzerine kurulu olduğu için burada doğrudan bir iframe kullanabiliyoruz;
// böylece aynı çizici kodu hem tablette hem tarayıcıda koşuyor.

import React, { useEffect, useImperativeHandle, useRef } from 'react';

import type { TuvalKolu } from './ModelTuvali';

export type { TuvalKolu };

export const ModelTuvali = React.forwardRef<TuvalKolu, {
  html: string;
  onMesaj: (ham: string) => void;
}>(function ModelTuvali({ html, onMesaj }, ref) {
  const cerceve = useRef<HTMLIFrameElement | null>(null);

  useImperativeHandle(ref, () => ({
    gonder: (n) => cerceve.current?.contentWindow?.postMessage(JSON.stringify(n), '*'),
  }), []);

  useEffect(() => {
    const dinle = (e: MessageEvent) => {
      // Yalnız kendi çerçevemizden gelen mesajı dinle; sayfadaki başka bir
      // çerçeve ya da eklenti mesajı modeli sürüklemesin.
      if (e.source !== cerceve.current?.contentWindow) return;
      if (typeof e.data === 'string') onMesaj(e.data);
    };
    window.addEventListener('message', dinle);
    return () => window.removeEventListener('message', dinle);
  }, [onMesaj]);

  return (
    <iframe
      ref={cerceve}
      srcDoc={html}
      title="Araç modeli"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, background: 'transparent' }}
    />
  );
});
