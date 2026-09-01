#!/usr/bin/env node
// Vekil :: AI CEVAP doğruluğu ölçümü
// ---------------------------------------------------------------------------
// eval-arama.mjs doğru maddenin BULUNUP bulunmadığını ölçer. Bu betik bir adım
// ötesini ölçer: asistanın verdiği CEVAP doğru mu?
//
// Neden ayrı: doğru madde beslemeye girse bile model yanlış cevap verebiliyor.
// Ölçüldü — HMK m.4 beslemedeyken asistan görevli mahkemeyi "asliye hukuk"
// yazmıştı. Yani arama isabetini ölçmek yetmez; cevabı da ölçmek gerekir.
//
// Beklentiler kanundan gelir: her soru için hangi ifadenin GEÇMESİ, hangisinin
// GEÇMEMESİ gerektiği, veritabanındaki gerçek madde metni okunarak yazılmıştır.
// "icermemeli" listesindekiler uydurulmuş değil, ölçülmüş yanlış cevaplardır.
//
// Kullanım:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... \
//   node scripts/eval-cevap.mjs
//
// Ölçüm için geçici bir kullanıcı açılır ve sonunda SİLİNİR (ai-chat yalnız
// oturum açmış kullanıcıya yanıt verir).
//
// Sorular arasında bekleme var: sağlayıcının dakikalık hız sınırı, arka arkaya
// atılan çağrılarda 429 veriyor. Bekleme olmadan ölçüm, modelin doğruluğunu
// değil hız sınırını ölçer.
//
// Env: EVAL_BEKLEME  sorular arası ms (vars. 20000)
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const anon = process.env.SUPABASE_ANON_KEY ?? '';
if (!url || !svc || !anon) {
  console.error('HATA: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY ve SUPABASE_ANON_KEY gerekli.');
  process.exit(1);
}

const BEKLEME = Number(process.env.EVAL_BEKLEME ?? 20000);
const uyu = (ms) => new Promise((r) => setTimeout(r, ms));

const EPOSTA = `eval-cevap-${Date.now()}@vekil.local`;
const SIFRE = `Ev!${Math.random().toString(36).slice(2)}A9`;

async function kullaniciAc() {
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EPOSTA, password: SIFRE, email_confirm: true }),
  });
  if (!res.ok) throw new Error(`kullanıcı açılamadı: ${res.status} ${(await res.text()).slice(0, 150)}`);
  return (await res.json()).id;
}

async function kullaniciSil(id) {
  if (!id) return;
  await fetch(`${url}/auth/v1/admin/users/${id}`, {
    method: 'DELETE',
    headers: { apikey: svc, Authorization: `Bearer ${svc}` },
  }).catch(() => {});
}

async function jwtAl() {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EPOSTA, password: SIFRE }),
  });
  const j = await res.json();
  if (!j.access_token) throw new Error('oturum açılamadı');
  return j.access_token;
}

async function sor(jwt, soru, deneme = 0) {
  const res = await fetch(`${url}/functions/v1/ai-chat`, {
    method: 'POST',
    headers: { apikey: anon, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', text: soru }] }),
  });
  if (res.status === 429 && deneme < 4) {
    const bekle = 30000 * (deneme + 1);
    console.log(`    (hız sınırı — ${bekle / 1000}sn bekleniyor)`);
    await uyu(bekle);
    return sor(jwt, soru, deneme + 1);
  }
  if (!res.ok) throw new Error(`ai-chat ${res.status}: ${(await res.text()).slice(0, 150)}`);
  return String((await res.json())?.text ?? '');
}

/**
 * Türkçe aksanları sadeleştirir. Model "tebliğinden" yerine "tebliginden"
 * yazabiliyor; bu bir yazım farkı, hukuk hatası değil. Sadeleştirmeden
 * ölçtüğümde doğru bir cevabı YANLIŞ saymıştım — ölçüm aracının kendisi
 * hataya sebep olmuştu.
 */
function sadelestir(v) {
  return v
    .toLocaleLowerCase('tr')
    .replace(/[ğüşıöçâîû]/g, (c) => ({ ğ: 'g', ü: 'u', ş: 's', ı: 'i', ö: 'o', ç: 'c', â: 'a', î: 'i', û: 'u' })[c]);
}

/** 'a|b' → biri geçse yeterli. */
function gecer(metin, kalip) {
  const d = sadelestir(metin);
  return kalip.split('|').some((p) => d.includes(sadelestir(p)));
}

const { sorular } = JSON.parse(readFileSync(join(__dirname, 'cevap-sorulari.json'), 'utf8'));

let uid = null;
let dogru = 0;
const basarisiz = [];

try {
  uid = await kullaniciAc();
  const jwt = await jwtAl();
  console.log(`AI cevap ölçümü · ${sorular.length} soru\n`);

  let ilk = true;
  for (const s of sorular) {
    if (!ilk) await uyu(BEKLEME);
    ilk = false;
    let cevap;
    try {
      cevap = await sor(jwt, s.soru);
    } catch (e) {
      console.log(`✗ ${s.soru}\n    HATA: ${e.message}`);
      basarisiz.push({ soru: s.soru, sebep: e.message });
      continue;
    }

    const eksik = (s.icermeli ?? []).filter((k) => !gecer(cevap, k));
    const yasak = (s.icermemeli ?? []).filter((k) => gecer(cevap, k));

    if (eksik.length === 0 && yasak.length === 0) {
      dogru++;
      console.log(`✓ ${s.soru}`);
    } else {
      console.log(`✗ ${s.soru}`);
      console.log(`    dayanak : ${s.dayanak}`);
      if (eksik.length) console.log(`    EKSİK   : ${eksik.join(' · ')}`);
      if (yasak.length) console.log(`    YANLIŞ  : ${yasak.join(' · ')}`);
      basarisiz.push({ soru: s.soru, eksik, yasak });
    }
  }
} finally {
  await kullaniciSil(uid);
}

const oran = sorular.length ? ((dogru / sorular.length) * 100).toFixed(1) : '0.0';
console.log(`\n${'─'.repeat(60)}`);
console.log(`CEVAP DOĞRULUĞU: ${dogru}/${sorular.length} (%${oran})`);
if (basarisiz.length) {
  console.log(`Hatalı cevap: ${basarisiz.length}`);
  process.exitCode = 1;
}
