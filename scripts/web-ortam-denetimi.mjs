// WEB DERLEMESİ ÖNCESİ ORTAM DENETİMİ — 26.09.2026.
//
// OLAY: 18.09.2026'dan (b6800e2) 26.09.2026'ya kadar canlı web uygulaması
// giriş yaptıramadı. Web paketi EXPO_PUBLIC_SUPABASE_URL tanımsızken
// derlenmişti; src/lib/supabase.ts bu durumda "placeholder.supabase.co"ya
// düşüyor ve hata vermeden derleniyor. Üç ardışık derleme aynı hatayla
// canlıya gitti, çünkü hiçbir şey durdurmadı.
//
// Bu betik `npm run export:web`in İLK adımı: değişkenler yoksa eas.json'daki
// production değerleriyle doldurur (ikisi de herkese açık: URL ve anon /
// publishable anahtar — gizli değil). Hâlâ yoksa derlemeyi DURDURUR.
import { readFileSync, writeFileSync } from 'node:fs';

const eas = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8'));
const env = eas.build?.production?.env ?? {};
const gerekli = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'];
const satirlar = [];
for (const k of gerekli) {
  const deger = process.env[k] || env[k];
  if (!deger || /placeholder/.test(deger)) {
    console.error(`HATA: ${k} yok ya da placeholder. Web paketi Supabase'e bağlanamaz — derleme durduruldu.`);
    process.exit(1);
  }
  satirlar.push(`${k}=${deger}`);
}
// Expo CLI proje kökündeki .env.production.local dosyasını okur; bu dosya
// .gitignore'da, yani depoya girmez.
writeFileSync(new URL('../.env.production.local', import.meta.url), satirlar.join('\n') + '\n');
console.log('web ortamı tamam:', gerekli.join(', '));
