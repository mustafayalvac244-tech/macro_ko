#!/usr/bin/env node
// Vekil :: İÇTİHAT AI (olay analizi + özet) canlı yoklaması
// ---------------------------------------------------------------------------
// NEDEN VAR. eval-ictihat.mjs yalnız ARAMAYI ölçer (search_ictihat_fts). Ucun
// AI tarafı — avukatın anlattığı olaydan plan çıkarıp gerçek kararlarla analiz
// yazan 'analyze' ve seçili kararları özetleyen 'summarize' — hiç ölçülmüyordu.
// 2026-09-11'de ortaya çıktı ki bu iki eylem ücretli katmanda bile ÜCRETSİZ
// modelde koşuyordu ve kimse fark etmemişti; ölçüm olsaydı 'model' alanı
// bunu ilk koşuda gösterirdi.
//
// BU BİR KALİTE ÖLÇÜMÜ DEĞİL, YOKLAMA: "çalışıyor mu, hangi modelde, kaça,
// kota kapısı kapalı mı" sorularına cevap verir. Analizin hukuken doğru olup
// olmadığını ölçmez; onun için avukat değerlendirmesi gerekir.
//
// DENETLENENLER
//   1) analyze → 200, model 'claude*', analiz boş değil, [n] atfı var,
//      hits boş değil, 'model' alanı yanıtta.
//   2) summarize → 200, model 'claude*', özet boş değil.
//   3) KOTA KAPISI (para harcamadan): deneme katmanındaki kullanıcının 3 hakkı
//      servis anahtarıyla doğrudan RPC'den tüketilir, sonra analyze çağrılır →
//      402 deneme_hakki_bitti beklenir, MODEL ÇAĞRISI OLMADAN. Bu, "Opus'u
//      açınca içtihat ekranı sınırsız Opus olur" riskinin kapandığının
//      ölçümüdür.
//
// Kullanım (olcum.yml, grup ai, betikler "eval-ictihat-ai"):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... \
//   node scripts/eval-ictihat-ai.mjs
//
// MALİYET: 1 analiz (2 Opus çağrısı, ~10-15k girdi token) + 1 özet. Kota
// denetimi model çağrısı yapmaz. Ölçüm kullanıcıları sonunda SİLİNİR.
// ---------------------------------------------------------------------------
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { istek, Butce } from './istek.mjs';
import { yeniKunye } from './olcum-kunyesi.mjs';
import { katmanAyarla } from './eval-katman.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const kunye = yeniKunye();
const butce = new Butce();

const url = (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const anon = process.env.SUPABASE_ANON_KEY ?? '';
if (!url || !svc || !anon) {
  console.error('HATA: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY ve SUPABASE_ANON_KEY gerekli.');
  process.exit(1);
}

const svcBaslik = { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json' };

async function kullaniciAc(etiket) {
  const eposta = `eval-ictihat-ai-${etiket}-${Date.now()}@vekil.local`;
  const sifre = `Ev!${Math.random().toString(36).slice(2)}A9`;
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: svcBaslik,
    body: JSON.stringify({ email: eposta, password: sifre, email_confirm: true }),
  });
  if (!res.ok) throw new Error(`kullanıcı açılamadı: ${res.status} ${(await res.text()).slice(0, 150)}`);
  const uid = (await res.json()).id;
  return { uid, eposta, sifre };
}

async function kullaniciSil(uid) {
  if (!uid) return;
  await fetch(`${url}/auth/v1/admin/users/${uid}`, { method: 'DELETE', headers: svcBaslik }).catch(() => {});
}

async function jwtAl(k) {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: k.eposta, password: k.sifre }),
  });
  const j = await res.json();
  if (!j.access_token) throw new Error('oturum açılamadı');
  return j.access_token;
}

async function cagir(jwt, govde) {
  const res = await istek(`${url}/functions/v1/ictihat`, {
    method: 'POST',
    headers: { apikey: anon, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(govde),
  });
  const metin = await res.text();
  let j;
  try { j = JSON.parse(metin); } catch { j = { ham: metin.slice(0, 300) }; }
  return { durum: res.status, j };
}

/** Deneme hakkını servis anahtarıyla doğrudan tüketir — model çağrısı yok. */
async function denemeHakkiTuket(uid, limit) {
  for (let i = 0; i < limit; i++) {
    const res = await fetch(`${url}/rest/v1/rpc/deneme_hakki_rezerve_et`, {
      method: 'POST',
      headers: svcBaslik,
      body: JSON.stringify({ p_user: uid, p_limit: limit }),
    });
    if (!res.ok) throw new Error(`deneme_hakki_rezerve_et ${res.status}: ${(await res.text()).slice(0, 120)}`);
  }
}

const OLAY =
  'Müvekkilim kiracı; ev sahibi kendi oğlunun oturacağı gerekçesiyle tahliye davası açtı. ' +
  'Ancak oğlu başka bir ilde çalışıyor ve orada kendi evi var. Kira sözleşmesi 2021 tarihli, ' +
  'ihtarname 2025 Ekim ayında tebliğ edildi. İhtiyacın gerçek ve samimi olmadığını düşünüyoruz.';

const sonuc = { analyze: null, summarize: null, kota: null };
let kusur = 0;
const kayit = (ad, gecti, ayrinti) => {
  console.log(`${gecti ? '✓' : '✗'} ${ad}${ayrinti ? `  ·  ${ayrinti}` : ''}`);
  if (!gecti) kusur++;
};

let ucretli = null;
let deneme = null;
try {
  // ── 1) ANALİZ, "ai" katmanı ─────────────────────────────────────────────
  ucretli = await kullaniciAc('ai');
  await katmanAyarla(url, svc, ucretli.uid, 'ai');
  const jwt = await jwtAl(ucretli);
  console.log('İçtihat AI yoklaması\n');

  const t0 = Date.now();
  const a = await cagir(jwt, { action: 'analyze', olay: OLAY });
  const sn = Math.round((Date.now() - t0) / 1000);
  sonuc.analyze = { durum: a.durum, model: a.j?.model, tier: a.j?.tier, sureSn: sn, hata: a.j?.error, detay: a.j?.detail };
  if (a.durum === 200) {
    const analiz = String(a.j?.analysis ?? '');
    const hits = Array.isArray(a.j?.hits) ? a.j.hits : [];
    kunye.gor(a.j?.kullanim ?? { model: a.j?.model });
    kayit('analyze 200', true, `${sn}sn · model ${a.j?.model ?? '(yok)'} · tier ${a.j?.tier}`);
    kayit('analyze model Claude', String(a.j?.model ?? '').startsWith('claude'), a.j?.model);
    kayit('analyze metin dolu (≥600 krktr)', analiz.length >= 600, `${analiz.length} krktr`);
    kayit('analyze [n] atfı var', /\[\d+\]/.test(analiz));
    kayit('analyze kararlar döndü', hits.length > 0, `${hits.length} karar`);
    kayit('analyze plan sorguları üretildi', Array.isArray(a.j?.queries) && a.j.queries.length > 0, JSON.stringify(a.j?.queries ?? []));
    sonuc.analyze.uzunluk = analiz.length;
    sonuc.analyze.hits = hits.length;
    sonuc.analyze.queries = a.j?.queries;
    sonuc.analyze.metin = analiz;
  } else {
    kayit('analyze 200', false, `${a.durum} ${JSON.stringify(a.j).slice(0, 200)}`);
  }

  // ── 2) ÖZET, aynı kullanıcı, analizin bulduğu kararlarla ────────────────
  const ids = Array.isArray(a.j?.hits) ? a.j.hits.map((h) => h.id).filter(Boolean).slice(0, 3) : [];
  if (ids.length > 0) {
    const s = await cagir(jwt, { action: 'summarize', query: 'gerçek olmayan ihtiyaç nedeniyle tahliye', ids });
    sonuc.summarize = { durum: s.durum, model: s.j?.model, hata: s.j?.error, uzunluk: String(s.j?.summary ?? '').length };
    if (s.durum === 200) {
      kunye.gor(s.j?.kullanim ?? { model: s.j?.model });
      kayit('summarize 200', true, `model ${s.j?.model ?? '(yok)'} · ${String(s.j?.summary ?? '').length} krktr`);
      kayit('summarize model Claude', String(s.j?.model ?? '').startsWith('claude'), s.j?.model);
      kayit('summarize metin dolu', String(s.j?.summary ?? '').length >= 200);
      sonuc.summarize.metin = String(s.j?.summary ?? '');
    } else {
      kayit('summarize 200', false, `${s.durum} ${JSON.stringify(s.j).slice(0, 200)}`);
    }
  } else {
    kayit('summarize (atlandı: analiz karar döndürmedi)', false);
  }

  // ── 3) KOTA KAPISI, deneme katmanı — model çağrısı YOK ──────────────────
  deneme = await kullaniciAc('deneme');
  // katman ayarlanmaz: yeni kullanıcı 'baslangic' → denemeCfg (3 hak)
  await denemeHakkiTuket(deneme.uid, 3);
  const jwt2 = await jwtAl(deneme);
  const k = await cagir(jwt2, { action: 'analyze', olay: OLAY });
  sonuc.kota = { durum: k.durum, hata: k.j?.error, hak: k.j?.hak };
  kayit('deneme hakkı bitince analyze 402 deneme_hakki_bitti', k.durum === 402 && k.j?.error === 'deneme_hakki_bitti', `${k.durum} ${k.j?.error ?? ''}`);
} catch (e) {
  kayit(`YOKLAMA KESİLDİ: ${e.message}`, false);
} finally {
  await kullaniciSil(ucretli?.uid);
  await kullaniciSil(deneme?.uid);
}

// Dosya adı diğer ölçümlerle aynı kalıpta (eval-*-hatalar.json): olcum.yml
// yalnız bu kalıbı artefakt olarak yükleyip dala işliyor. İçerik "hata" değil
// yoklama sonucu; kalıbı bozmak yerine ada uyuyoruz.
const dosya = join(__dirname, 'eval-ictihat-ai-hatalar.json');
writeFileSync(dosya, JSON.stringify(kunye.ozet({ sonuc, kusur }), null, 2));
console.log(`\nSonuç: ${dosya}`);
console.log('\n' + '─'.repeat(60));
console.log(kunye.satir());
console.log(`İÇTİHAT AI YOKLAMASI: ${kusur === 0 ? 'temiz' : `${kusur} kusur`}  ·  ${butce.satir()}`);
if (kusur > 0) process.exitCode = 1;
