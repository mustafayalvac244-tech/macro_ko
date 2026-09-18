#!/usr/bin/env node
/**
 * APP STORE CONNECT FORMLARI — OKU / YAZ
 * ---------------------------------------------------------------------------
 * NEDEN VAR (18.09.2026). Ürün sahibi App Store Connect'teki yaş sınırı
 * anketini ve diğer formları doldurmamı istedi. Arayüze erişimim yok ama
 * ASC API'sinin bu alanları yazabildiği doğrulandı:
 *   PATCH /v1/ageRatingDeclarations/{id}   (29 yazılabilir alan)
 *
 * ALAN ADLARI EZBERLENMİYOR. Apple'ın doküman sayfaları JavaScript ile
 * çiziliyor ve okunamıyor; ezberden alan adı yazmak Apple'a YANLIŞ BEYAN
 * vermek demek. Bu yüzden betiğin varsayılan modu `oku`: canlı nesneyi
 * çekip bütün alanları ve bugünkü değerlerini olduğu gibi basar. Cevaplar
 * ancak o çıktı görüldükten sonra yazılır.
 *
 * KULLANIM
 *   ASC_KEY_PATH=./asc-api-key.p8 ASC_KEY_ID=... ASC_ISSUER_ID=... \
 *   APP_ID=6812859016 node scripts/asc-form.mjs oku
 *
 *   ... node scripts/asc-form.mjs yaz   # YAZ modu: CEVAPLAR dosyasından
 *
 * YAZ MODU BİLEREK AYRI BİR KOMUT. Bu alanlar Apple'a verilen beyandır;
 * yanlışı inceleme reddi ya da yanlış yaş sınırı demektir. Kazara
 * çalışmasın diye ayrı.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';

const API = 'https://api.appstoreconnect.apple.com/v1';

function gerekli(ad) {
  const v = process.env[ad];
  if (!v) { console.error(`HATA: ${ad} tanımlı değil.`); process.exit(1); }
  return v;
}
const KEY_PATH = gerekli('ASC_KEY_PATH');
const KEY_ID = gerekli('ASC_KEY_ID');
const ISSUER_ID = gerekli('ASC_ISSUER_ID');
const APP_ID = gerekli('APP_ID');
const MOD = (process.argv[2] || 'oku').toLowerCase();

/** ES256 JWT. dsaEncoding olmadan Apple 401 döner ve sebebini söylemez. */
function jwtUret() {
  const anahtar = fs.readFileSync(KEY_PATH, 'utf8');
  const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
  const simdi = Math.floor(Date.now() / 1000);
  const govde = `${b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' })}.${b64({
    iss: ISSUER_ID, iat: simdi, exp: simdi + 900, aud: 'appstoreconnect-v1',
  })}`;
  const imza = crypto.sign('sha256', Buffer.from(govde), { key: anahtar, dsaEncoding: 'ieee-p1363' });
  return `${govde}.${imza.toString('base64url')}`;
}

let TOKEN = null;
async function api(yol, secenek = {}) {
  TOKEN ??= jwtUret();
  const cevap = await fetch(`${API}${yol}`, {
    ...secenek,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...(secenek.headers || {}) },
  });
  if (cevap.status === 204) return null;
  const metin = await cevap.text();
  let veri = null;
  try { veri = metin ? JSON.parse(metin) : null; } catch { /* Apple bazen HTML döner */ }
  if (!cevap.ok) {
    const detay = veri?.errors
      ? veri.errors.map((e) => `${e.status} ${e.code}: ${e.title} — ${e.detail}`).join('\n  ')
      : metin.slice(0, 400);
    throw new Error(`Apple API ${cevap.status} ${secenek.method || 'GET'} ${yol}\n  ${detay}`);
  }
  return veri;
}

function yazdirAlanlar(baslik, nitelikler) {
  console.log(`\n── ${baslik} ${'─'.repeat(Math.max(0, 60 - baslik.length))}`);
  const anahtarlar = Object.keys(nitelikler || {}).sort();
  if (!anahtarlar.length) { console.log('  (alan yok)'); return; }
  const en = Math.max(...anahtarlar.map((k) => k.length));
  for (const k of anahtarlar) {
    const d = nitelikler[k];
    console.log(`  ${k.padEnd(en)} = ${d === null ? 'null (BOŞ)' : JSON.stringify(d)}`);
  }
}

async function oku() {
  console.log(`Uygulama: ${APP_ID}`);

  const app = await api(`/apps/${APP_ID}`);
  yazdirAlanlar('app', app?.data?.attributes);

  // appInfos: kategori, içerik hakları, yaş sınırı beyanı buraya bağlı.
  const infos = await api(`/apps/${APP_ID}/appInfos`);
  for (const bilgi of infos?.data || []) {
    yazdirAlanlar(`appInfo ${bilgi.id}`, bilgi.attributes);
    const iliski = bilgi.relationships?.ageRatingDeclaration?.data;
    if (iliski?.id) {
      const beyan = await api(`/ageRatingDeclarations/${iliski.id}`);
      yazdirAlanlar(`ageRatingDeclaration ${iliski.id}`, beyan?.data?.attributes);
      console.log(`\n  → YAZ modunda kullanılacak id: ${iliski.id}`);
    } else {
      console.log('  (bu appInfo için ageRatingDeclaration bağlı değil)');
    }
  }

  // Sürümler: hangi sürüm hangi durumda, hangi derleme bağlı.
  const surumler = await api(`/apps/${APP_ID}/appStoreVersions?limit=5`);
  for (const s of surumler?.data || []) {
    yazdirAlanlar(`appStoreVersion ${s.id}`, s.attributes);
  }
}

async function yaz() {
  const yol = 'scripts/asc-yas-siniri.json';
  if (!fs.existsSync(yol)) {
    console.error(
      `HATA: ${yol} yok.\n` +
      'Önce `oku` modunu koşun, gerçek alan adlarını görün ve cevapları o\n' +
      'dosyaya yazın. Alan adı uydurmak Apple\'a yanlış beyan vermektir.',
    );
    process.exit(1);
  }
  const { beyanId, nitelikler } = JSON.parse(fs.readFileSync(yol, 'utf8'));
  if (!beyanId || !nitelikler) {
    console.error(`HATA: ${yol} içinde beyanId ve nitelikler olmalı.`);
    process.exit(1);
  }
  console.log(`PATCH /ageRatingDeclarations/${beyanId}`);
  console.log('Gönderilen alanlar:');
  for (const [k, v] of Object.entries(nitelikler)) console.log(`  ${k} = ${JSON.stringify(v)}`);

  const sonuc = await api(`/ageRatingDeclarations/${beyanId}`, {
    method: 'PATCH',
    body: JSON.stringify({ data: { type: 'ageRatingDeclarations', id: beyanId, attributes: nitelikler } }),
  });
  yazdirAlanlar('yazıldıktan sonra', sonuc?.data?.attributes);
}

const islem = MOD === 'yaz' ? yaz : oku;
islem().catch((e) => { console.error(`\n${e.message}`); process.exit(1); });
