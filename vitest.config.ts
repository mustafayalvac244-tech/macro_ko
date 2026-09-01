import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Testler yalnız SAF mantığı kapsar: react-native veya expo içe aktarmayan
// modüller. Ekran/bileşen testi için ayrı bir çalışma zamanı (jest-expo +
// react-native ön ayarı) gerekir; süre hesabı, kimlik doğrulama ve metin
// üretimi gibi hata maliyeti yüksek kısımlar burada, hızlı ve bağımlılıksız
// sınanır.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
