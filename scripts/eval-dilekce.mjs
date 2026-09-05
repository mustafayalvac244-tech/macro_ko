// Dilekçe üretimi ölçümü.
// ---------------------------------------------------------------------------
// NEDEN AYRI BİR ÖLÇÜM. Dilekçe, programın en çok zaman kazandırması gereken
// yeri; ama "iyi görünüyor" ile "mahkemeye verilebilir" arasındaki fark
// gözle okuyarak ölçülemez. Burada üç şey ayrı ayrı puanlanır:
//
//   1) ZORUNLU UNSUR — usul kanununun aradığı içerik var mı (HMK m.119 dava
//      değeri, netice-i talep, deliller...). Eksikse dilekçe ihtarı gelir.
//   2) UYDURMA — taslakta, avukatın ANLATMADIĞI bir tarih ya da tutar var mı.
//      İlk ölçümde model, verilmeyen bir sözleşme tarihi ("01.02.2026") ve
//      ihtar tarihi ("30.09.2026") uydurup netice-i talebe taşıdı. Avukat fark
//      etmezse mahkemeye YANLIŞ TARİH sunar; bu, biçim hatasından ağırdır.
//   3) BOŞLUK DÜRÜSTLÜĞÜ — bilinmeyen bilgi köşeli parantezle bırakılmış mı.
//
// Kullanım:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... \
//   node scripts/eval-dilekce.mjs
//
// EVAL_BEKLEME  sorular arası bekleme (vars. 25000). Ücretsiz sağlayıcılar
//               hızlı ardışık isteklerde birlikte throttle oluyor; kısa
//               aralık, modelin değil sağlayıcının ölçülmesine yol açar.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gecer, sadelestir } from './eslestir.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const url = process.env.SUPABASE_URL ?? '';
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const anon = process.env.SUPABASE_ANON_KEY ?? '';
if (!url || !svc || !anon) {
  console.error('HATA: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY ve SUPABASE_ANON_KEY gerekli.');
  process.exit(1);
}

const BEKLEME = Number(process.env.EVAL_BEKLEME ?? 25000);
const uyu = (ms) => new Promise((r) => setTimeout(r, ms));

const EPOSTA = `eval-dilekce-${Date.now()}@vekil.local`;
const SIFRE = `Ev!${Math.random().toString(36).slice(2)}A9`;

async function kullaniciAc() {
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EPOSTA, password: SIFRE, email_confirm: true }),
  });
  if (!res.ok) throw new Error(`kullanıcı açılamadı: ${res.status}`);
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

async function uret(jwt, tip, olay, deneme = 0) {
  const res = await fetch(`${url}/functions/v1/ai-chat`, {
    method: 'POST',
    headers: { apikey: anon, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'dilekce', dilekceType: tip, question: olay }),
  });
  if (res.status === 429) {
    const g = await res.text();
    if (g.includes('daily_quota')) throw new Error('DAILY_QUOTA');
    if (deneme < 4) {
      await uyu(30000 * (deneme + 1));
      return uret(jwt, tip, olay, deneme + 1);
    }
  }
  // 502 'upstream' DA GEÇİCİDİR ve yeniden denenmelidir. İlk koşuda 5
  // senaryonun 3'ü buna takıldı; ölçüm modelin değil, o anki sağlayıcı
  // durumunun fotoğrafını çekti ve "0/2" gibi anlamsız bir oran çıktı.
  if (res.status >= 500 && deneme < 4) {
    await uyu(20000 * (deneme + 1));
    return uret(jwt, tip, olay, deneme + 1);
  }
  if (!res.ok) throw new Error(`ai-chat ${res.status}: ${(await res.text()).slice(0, 140)}`);
  const j = await res.json();
  // Yedek mevzuat özeti dilekçe DEĞİLDİR; model cevabı sayılırsa ölçüm
  // modelin değil sağlayıcı yoğunluğunun fotoğrafını çeker (bkz. eval-cevap).
  if (j?.yapayZekasiz || j?.model === 'mevzuat-yedek') {
    if (deneme < 4) {
      await uyu(30000 * (deneme + 1));
      return uret(jwt, tip, olay, deneme + 1);
    }
    throw new Error('YEDEK_OZET');
  }
  return String(j?.text ?? '');
}

/** Metindeki tarihleri tek biçime indirger: 01.02.2026 / 1/2/2026 / 2026-02-01 */
function tarihler(metin) {
  const bulunan = new Set();
  const d = String(metin ?? '');
  for (const m of d.matchAll(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/g)) {
    bulunan.add(`${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`);
  }
  for (const m of d.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) bulunan.add(`${m[1]}-${m[2]}-${m[3]}`);
  return bulunan;
}

/**
 * Metindeki para tutarları (sayı olarak). "12.000 TL", "12 000 TL", "36.000,00 TL".
 * Yalnız TL/₺ ile birlikte geçenler alınır; madde numarası ya da yıl sayılmasın.
 */
function tutarlar(metin) {
  const bulunan = new Set();
  for (const m of String(metin ?? '').matchAll(/([\d][\d.\s ]*\d|\d)\s*(?:TL|₺|Türk Lirası)/gi)) {
    const sayi = Number(String(m[1]).replace(/[.\s ]/g, ''));
    if (Number.isFinite(sayi) && sayi > 0) bulunan.add(sayi);
  }
  return bulunan;
}

const { senaryolar } = JSON.parse(readFileSync(join(__dirname, 'dilekce-senaryolari.json'), 'utf8'));

let uid = null;
const sonuclar = [];
const kusurlu = [];

try {
  uid = await kullaniciAc();
  const jwt = await jwtAl();
  console.log(`Dilekçe ölçümü · ${senaryolar.length} senaryo\n`);

  let ilk = true;
  for (const s of senaryolar) {
    if (!ilk) await uyu(BEKLEME);
    ilk = false;

    let taslak;
    try {
      taslak = await uret(jwt, s.tip, s.olay);
    } catch (e) {
      if (e.message === 'DAILY_QUOTA' || e.message === 'YEDEK_OZET') {
        console.error(
          `\nDURDURULDU (${e.message}): sağlayıcı cevap vermiyor. Bu koşudan oran ÇIKARMAYIN —\n` +
            'ölçülen modelin kalitesi değil, o andaki sağlayıcı durumudur.'
        );
        process.exitCode = 2;
        break;
      }
      console.log(`✗ ${s.id}\n    HATA: ${e.message}`);
      kusurlu.push({ id: s.id, sebep: e.message });
      continue;
    }

    const eksik = (s.icermeli ?? []).filter((k) => !gecer(taslak, k));
    const yasak = (s.icermemeli ?? []).filter((k) => gecer(taslak, k));

    // UYDURMA: taslaktaki tarih/tutar, olayda geçmiyorsa uydurulmuştur.
    const olayTarih = tarihler(s.olay);
    const uydurmaTarih = [...tarihler(taslak)].filter((t) => !olayTarih.has(t));
    const olayTutar = tutarlar(s.olay);
    // Toplamlar meşrudur (3 × 12.000 = 36.000); olaydaki tutarların katları
    // ve toplamları uydurma sayılmaz.
    const mesruTutar = new Set(olayTutar);
    for (const a of olayTutar) for (let k = 2; k <= 24; k++) mesruTutar.add(a * k);
    const uydurmaTutar = [...tutarlar(taslak)].filter((t) => !mesruTutar.has(t));

    const bosluk = (taslak.match(/\[[^\]]{2,40}\]/g) ?? []).length;

    const gecti = eksik.length === 0 && yasak.length === 0 && uydurmaTarih.length === 0;
    sonuclar.push({ id: s.id, gecti, eksik, yasak, uydurmaTarih, uydurmaTutar, bosluk, uzunluk: taslak.length });

    console.log(`${gecti ? '✓' : '✗'} ${s.id} (${s.tip})  ${taslak.length} krktr · ${bosluk} boşluk`);
    if (eksik.length) console.log(`    EKSİK UNSUR : ${eksik.join(' | ')}`);
    if (yasak.length) console.log(`    OLMAMALIYDI : ${yasak.join(' | ')}`);
    if (uydurmaTarih.length) console.log(`    UYDURMA TARİH: ${uydurmaTarih.join(', ')}`);
    if (uydurmaTutar.length) console.log(`    UYDURMA TUTAR: ${uydurmaTutar.join(', ')}`);
    if (!gecti) kusurlu.push({ id: s.id, tip: s.tip, eksik, yasak, uydurmaTarih, uydurmaTutar, taslak });
  }
} finally {
  await kullaniciSil(uid);
}

if (kusurlu.length) {
  const yol = join(__dirname, 'eval-dilekce-hatalar.json');
  writeFileSync(yol, JSON.stringify({ tarih: new Date().toISOString(), kusurlu }, null, 1), 'utf8');
  console.log(`\nKusurlu taslakların tam metni: ${yol}`);
}

const olculen = sonuclar.length;
const gecen = sonuclar.filter((s) => s.gecti).length;
const uydurmali = sonuclar.filter((s) => s.uydurmaTarih.length || s.uydurmaTutar.length).length;
const unsurEksik = sonuclar.reduce((t, s) => t + s.eksik.length, 0);

console.log('\n' + '─'.repeat(60));
console.log(`DİLEKÇE: ${gecen}/${olculen} senaryo tam geçti (%${olculen ? ((gecen / olculen) * 100).toFixed(1) : 0})`);
console.log(`Uydurma veri içeren taslak: ${uydurmali}/${olculen}`);
console.log(`Toplam eksik zorunlu unsur: ${unsurEksik}`);
