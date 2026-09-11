// AI SOHBET ölçümü — bugüne kadar hiç kalıcı/tekrarlanabilir betiği yoktu.
// ---------------------------------------------------------------------------
// KALITE.md'de "13 soruda 9 geçti" diye bir sayı vardı ama hangi 13 soru,
// hangi ölçüt olduğu hiçbir dosyada durmuyordu — yani o sayı TEKRAR
// ÜRETİLEMEZDİ. Ölçülmüş gibi görünen ama aslında doğrulanamayan bir sayı,
// hiç ölçülmemiş olmaktan daha kötüdür: yanlış güven verir.
//
// BURADA HUKUKİ İÇERİK DOĞRULUĞU ÖLÇÜLMÜYOR — o, avukat gözüyle doğrulama
// gerektirir (bkz. KALITE.md puanlama kuralı 2). Ölçülen şey, sistem
// talimatının KENDİ İDDİA ETTİĞİ üç mekanik kuralın gerçekten tutup
// tutmadığı:
//   1) CEVAP UZUNLUĞU — tek bilgi sorusuna kısa cevap mı geliyor.
//   2) KAPSAM kilidi — hukuk dışı soru reddediliyor mu.
//   3) KİMLİK kilidi — model/şirket adı sızıyor mu.
//
// Kullanım:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... \
//   node scripts/eval-sohbet.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { yeniKunye } from './olcum-kunyesi.mjs';
import { beklemeSuresi } from './bekleme.mjs';
import { degerlendir } from './sohbetDegerlendir.mjs';
import { katmanAyarla } from './eval-katman.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ÖLÇÜM KÜNYESİ: sonucun HANGİ MODELDEN geldiğini kaydeder.
// Bu olmadan "N kusur çıktı" cümlesi neyin N kusur verdiğini söylemiyor;
// sonuç ne karşılaştırılabilir ne tekrarlanabilir olur.
const kunye = yeniKunye();

const url = process.env.SUPABASE_URL ?? '';
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const anon = process.env.SUPABASE_ANON_KEY ?? '';
if (!url || !svc || !anon) {
  console.error('HATA: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY ve SUPABASE_ANON_KEY gerekli.');
  process.exit(1);
}

const BEKLEME = Number(process.env.EVAL_BEKLEME ?? 25000);
const uyu = (ms) => new Promise((r) => setTimeout(r, ms));

const EPOSTA = `eval-sohbet-${Date.now()}@vekil.local`;
const SIFRE = `Ev!${Math.random().toString(36).slice(2)}A9`;

async function kullaniciAc() {
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EPOSTA, password: SIFRE, email_confirm: true }),
  });
  if (!res.ok) throw new Error(`kullanıcı açılamadı: ${res.status}`);
  const uid = (await res.json()).id;
  // ÜCRETLİ KATMANA AL. Yoksa kullanıcı 'baslangic' kalır ve YAŞAM BOYU
  // 3 deneme hakkıyla sınırlanır; dördüncü senaryodan sonrası
  // "deneme_hakki_bitti" döner ve ölçüm kaliteyi değil KOTAYI ölçer.
  await katmanAyarla(url, svc, uid);
  return uid;
}
async function kullaniciSil(id) {
  if (!id) return;
  await fetch(`${url}/auth/v1/admin/users/${id}`, {
    method: 'DELETE',
    headers: { apikey: svc, Authorization: `Bearer ${svc}` },
  }).catch(() => {});
}
/** Her denemeden önce yeniden çağrılır — bkz. eval-belge.mjs'teki aynı gerekçe. */
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

async function sor(soru, deneme = 0) {
  const jwt = await jwtAl();
  const res = await fetch(`${url}/functions/v1/ai-chat`, {
    method: 'POST',
    headers: { apikey: anon, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', text: soru }] }),
  });
  if (res.status === 429) {
    const g = await res.text();
    const bekle = beklemeSuresi(g);
    if (bekle && deneme < 6) {
      console.log(`    (kota doldu; ${Math.round(bekle / 60000)} dk bekleniyor)`);
      await uyu(bekle);
      return sor(soru, deneme + 1);
    }
    if (g.includes('daily_quota')) throw new Error('DAILY_QUOTA');
    if (deneme < 4) {
      await uyu(30000 * (deneme + 1));
      return sor(soru, deneme + 1);
    }
  }
  if (res.status >= 500 && deneme < 5) {
    await uyu(120000 * (deneme + 1));
    return sor(soru, deneme + 1);
  }
  if (!res.ok) throw new Error(`ai-chat ${res.status}: ${(await res.text()).slice(0, 140)}`);
  const j = await res.json();
  kunye.gor({ model: j?.model });
  return { metin: String(j?.text ?? ''), model: String(j?.model ?? '?') };
}

const SECIM = (process.env.EVAL_SENARYO ?? '').split(',').map((x) => x.trim()).filter(Boolean);
const { senaryolar: tumSenaryolar } = JSON.parse(readFileSync(join(__dirname, 'sohbet-senaryolari.json'), 'utf8'));
if (SECIM.length) {
  const bilinmeyen = SECIM.filter((k) => !tumSenaryolar.some((x) => x.id === k));
  if (bilinmeyen.length) throw new Error(`bilinmeyen senaryo: ${bilinmeyen.join(', ')}`);
}
const senaryolar = SECIM.length ? tumSenaryolar.filter((x) => SECIM.includes(x.id)) : tumSenaryolar;

let uid = null;
const sonuclar = [];
const kusurlu = [];

try {
  uid = await kullaniciAc();
  await jwtAl();
  console.log(`AI sohbet ölçümü · ${senaryolar.length} senaryo\n`);

  let ilk = true;
  for (const s of senaryolar) {
    if (!ilk) await uyu(BEKLEME);
    ilk = false;

    let cikti;
    try {
      cikti = await sor(s.soru);
    } catch (e) {
      if (e.message === 'DAILY_QUOTA') {
        console.error('\nDURDURULDU (DAILY_QUOTA): sağlayıcı cevap vermiyor. Bu koşudan oran ÇIKARMAYIN.');
        process.exitCode = 2;
        break;
      }
      console.log(`✗ ${s.id}\n    HATA: ${e.message}`);
      kusurlu.push({ id: s.id, sebep: e.message });
      continue;
    }

    const sorunlar = degerlendir(s, cikti);
    const gecti = sorunlar.length === 0;
    sonuclar.push({ id: s.id, tur: s.tur, gecti, sorunlar, uzunluk: cikti.metin.length });

    console.log(`${gecti ? '✓' : '✗'} ${s.id} (${s.tur})  ${cikti.metin.length} krktr · ${cikti.model}`);
    if (sorunlar.length) console.log(`    ${sorunlar.join(' | ')}`);
    if (!gecti) kusurlu.push({ id: s.id, tur: s.tur, sorunlar, cevap: cikti.metin });
  }
} finally {
  await kullaniciSil(uid);
}

if (kusurlu.length) {
  const yol = join(__dirname, 'eval-sohbet-hatalar.json');
  writeFileSync(yol, JSON.stringify(kunye.ozet({ kusurlu }), null, 1), 'utf8');
  console.log(`\nKusurlu cevapların tam metni: ${yol}`);
}

const olculen = sonuclar.length;
const gecen = sonuclar.filter((s) => s.gecti).length;

console.log('\n' + '─'.repeat(60));
console.log(kunye.satir());
console.log(`SOHBET: ${gecen}/${olculen} senaryo tam geçti (%${olculen ? ((gecen / olculen) * 100).toFixed(1) : 0})` +
  (olculen < tumSenaryolar.length ? ` — havuzdaki ${tumSenaryolar.length} senaryonun ${olculen} tanesi ölçüldü` : ''));
for (const tur of ['tekBilgi', 'kapsamDisi', 'kimlik', 'jailbreak', 'gorev']) {
  const buTur = sonuclar.filter((s) => s.tur === tur);
  if (!buTur.length) continue;
  const gecenTur = buTur.filter((s) => s.gecti).length;
  console.log(`  ${tur}: ${gecenTur}/${buTur.length}`);
}
