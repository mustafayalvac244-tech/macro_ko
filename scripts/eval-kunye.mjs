#!/usr/bin/env node
// Vekil :: dosya aktarma (künye çıkarımı) ölçümü
// ---------------------------------------------------------------------------
// NEDEN VAR. Dosya aktarma hiç ölçülmemişti ve hiç kullanılmamıştı (sıfır
// kayıt). Çıkardığı künye DOĞRUDAN dosya kaydına yazılıyor; yani buradaki bir
// uydurma, dilekçedekinden sinsidir: yanlış esas numarasıyla açılmış dosya DOLU
// görünür ve kimse bir daha bakmaz.
//
// ÖLÇÜT üç şeyi birlikte sayar:
//   • DOĞRU  : beklenen alan, beklenen değerle çıkarıldı mı,
//   • UYDURMA: boş olması gereken alan doldurulmuş mu (ağır kusur),
//   • YANLIŞ : bilinen bir tuzağa düşülmüş mü (karar no'yu esas no sanmak gibi).
//
// Uydurma, eksikten AĞIR sayılır: eksik alanı avukat doldurur, uydurma alanı
// fark etmez.
//
// Kullanım:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... \
//     node scripts/eval-kunye.mjs
// Env: EVAL_BEKLEME (vars. 25000), EVAL_SENARYO (virgüllü kimlik listesi)
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { beklemeSuresi } from './bekleme.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const url = (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const anon = process.env.SUPABASE_ANON_KEY ?? '';
if (!url || !svc || !anon) {
  console.error('HATA: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY ve SUPABASE_ANON_KEY gerekli.');
  process.exit(1);
}

const BEKLEME = Number(process.env.EVAL_BEKLEME ?? 25000);
const uyu = (ms) => new Promise((r) => setTimeout(r, ms));
const EPOSTA = `eval-kunye-${Date.now()}@vekil.local`;
const SIFRE = `Ev!${Math.random().toString(36).slice(2)}A9`;
const svcBaslik = { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json' };

async function kullaniciAc() {
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST', headers: svcBaslik,
    body: JSON.stringify({ email: EPOSTA, password: SIFRE, email_confirm: true }),
  });
  if (!res.ok) throw new Error(`kullanıcı açılamadı: ${res.status}`);
  return (await res.json()).id;
}
async function kullaniciSil(id) {
  if (!id) return;
  await fetch(`${url}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: svcBaslik }).catch(() => {});
}
/** Jeton her denemede tazelenir: kota beklemesi jetonun ömrünü aşabiliyor. */
async function jwtAl() {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EPOSTA, password: SIFRE }),
  });
  const j = await res.json();
  if (!j.access_token) throw new Error('oturum açılamadı');
  return j.access_token;
}

async function cikar(belge, deneme = 0) {
  const jwt = await jwtAl();
  const res = await fetch(`${url}/functions/v1/ai-chat`, {
    method: 'POST',
    headers: { apikey: anon, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'kunye', question: belge }),
  });
  if (res.status === 429 || res.status === 502) {
    const govde = await res.text();
    const bekle = beklemeSuresi(govde) ?? 60000;
    if (deneme < 4) {
      console.log(`    (kota doldu; ${Math.round(bekle / 60000)} dk bekleniyor)`);
      await uyu(bekle);
      return cikar(belge, deneme + 1);
    }
    throw new Error('DAILY_QUOTA');
  }
  if (!res.ok) throw new Error(`ai-chat ${res.status}: ${(await res.text()).slice(0, 140)}`);
  const j = await res.json();
  return { kunye: j?.kunye ?? {}, atilan: j?.atilan ?? [], model: j?.model ?? '?' };
}

const kucult = (x) => String(x ?? '').toLocaleLowerCase('tr').replace(/[^0-9a-zçğıöşü/]+/g, ' ').replace(/\s+/g, ' ').trim();
/** Mahkeme adı birebir değil, ÖZÜ tutmalı: "T.C." ön eki ya da nokta farkı sorun değil. */
const esitMi = (a, b) => kucult(a) === kucult(b) || kucult(a).includes(kucult(b)) || kucult(b).includes(kucult(a));

const SECIM = (process.env.EVAL_SENARYO ?? '').split(',').map((x) => x.trim()).filter(Boolean);
const { senaryolar: tumSenaryolar } = JSON.parse(readFileSync(join(__dirname, 'kunye-senaryolari.json'), 'utf8'));
if (SECIM.length) {
  const bilinmeyen = SECIM.filter((k) => !tumSenaryolar.some((s) => s.id === k));
  if (bilinmeyen.length) throw new Error(`bilinmeyen senaryo: ${bilinmeyen.join(', ')}`);
}
const senaryolar = SECIM.length ? tumSenaryolar.filter((s) => SECIM.includes(s.id)) : tumSenaryolar;

let uid = null;
let dogru = 0, beklenenToplam = 0, uydurma = 0, yanlis = 0, gecen = 0;

try {
  uid = await kullaniciAc();
  await jwtAl();
  console.log(`Künye çıkarımı ölçümü · ${senaryolar.length} senaryo\n`);

  let ilk = true;
  for (const s of senaryolar) {
    if (!ilk) await uyu(BEKLEME);
    ilk = false;

    let sonuc;
    try {
      sonuc = await cikar(s.belge);
    } catch (e) {
      console.error(`\nDURDURULDU (${e.message}): sağlayıcı cevap vermiyor. Bu koşudan oran ÇIKARMAYIN.`);
      break;
    }
    const k = sonuc.kunye ?? {};
    const eksik = [], hatali = [], uydurulan = [];

    for (const [alan, deger] of Object.entries(s.beklenen ?? {})) {
      beklenenToplam++;
      if (!k[alan]) eksik.push(alan);
      else if (esitMi(k[alan], deger)) dogru++;
      else hatali.push(`${alan}: "${k[alan]}" ≠ "${deger}"`);
    }
    // BOŞ KALMASI GEREKEN ALAN DOLDURULMUŞSA UYDURMADIR — en ağır kusur.
    for (const alan of s.bosOlmali ?? []) {
      if (k[alan]) uydurulan.push(`${alan}: "${k[alan]}"`);
    }
    // Bilinen tuzaklar (karar no'yu esas no sanmak, tebliğ tarihini duruşma sanmak).
    for (const [alan, kotu] of Object.entries(s.olmamali ?? {})) {
      if (k[alan] && esitMi(k[alan], kotu)) hatali.push(`TUZAK — ${alan}: "${k[alan]}"`);
    }

    uydurma += uydurulan.length;
    yanlis += hatali.length;
    const temiz = eksik.length === 0 && hatali.length === 0 && uydurulan.length === 0;
    if (temiz) gecen++;

    console.log(`${temiz ? '✓' : '✗'} ${s.id}  ·  ${sonuc.model}`);
    if (eksik.length) console.log(`    EKSİK    : ${eksik.join(', ')}`);
    if (hatali.length) console.log(`    YANLIŞ   : ${hatali.join(' | ')}`);
    if (uydurulan.length) console.log(`    UYDURMA  : ${uydurulan.join(' | ')}`);
    if (sonuc.atilan.length) console.log(`    (sunucu attı: ${sonuc.atilan.join(', ')})`);
  }
} finally {
  await kullaniciSil(uid);
}

console.log('\n' + '─'.repeat(60));
console.log(`KÜNYE: ${gecen}/${senaryolar.length} senaryo tam temiz`);
console.log(`Beklenen alanların doğru çıkarılanı: ${dogru}/${beklenenToplam}`);
console.log(`UYDURULAN alan (boş kalmalıydı): ${uydurma}`);
console.log(`Yanlış/tuzağa düşen alan: ${yanlis}`);
