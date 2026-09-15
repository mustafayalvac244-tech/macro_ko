// Metro paketleyici yapılandırması.
//
// NEDEN VAR: expo-sqlite'ın web sürümü SQLite'ı WebAssembly olarak yükler.
// Metro varsayılan olarak .wasm dosyasını varlık saymaz ve paketleme
// "unable to resolve wa-sqlite.wasm" ile düşer. Ayrıca wa-sqlite,
// SharedArrayBuffer kullandığı için tarayıcının sayfayı YALITILMIŞ
// (cross-origin isolated) sayması gerekir; bunun için iki başlık şart.
//
// Native (Android/iOS) tarafında bunların hiçbiri gerekmez — SQLite orada
// yerleşiktir. Bu dosya yalnız web hedefini ayakta tutar.

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('wasm');

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => (istek, yanit, sonraki) => {
    yanit.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    yanit.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    return middleware(istek, yanit, sonraki);
  },
};

module.exports = config;
