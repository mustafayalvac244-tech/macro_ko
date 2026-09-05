// Mütalaa üretimi ölçümü.
// ---------------------------------------------------------------------------
// NEDEN AYRI BİR ÖLÇÜM. "İşimi hızlandırsın" beklentisinin üç ayağı var:
// dilekçe, MÜTALAA ve belge inceleme. Dilekçe ölçülüyordu; mütalaa bugüne
// kadar HİÇ ölçülmedi. Ölçülmeyen bir özellik hakkında "iyi" ya da "kötü"
// demek tahmindir — ve bu üründe tahminle karar vermenin bedeli, avukatın
// güvendiği bir metnin yanlış çıkmasıdır.
//
// MÜTALAA DİLEKÇEDEN FARKLI BİR İŞ YAPAR ve ölçütü de farklıdır. Dilekçede
// avukat ne isteyeceğini biliyordur; ölçülen şey BİÇİMİN eksiksizliğidir
// (HMK m.119 unsurları). Mütalaada ise avukat henüz KARAR VERMEMİŞTİR;
// ölçülmesi gereken, metnin karar verdirip verdirmediğidir:
//
//   1) KAÇIRILMAMASI GEREKEN — o olayda gözden kaçarsa hak kaybı doğuran
//      unsur (işe iadede bir aylık arabuluculuk süresi, kambiyoda beş gün...).
//      Eksikse mütalaa "güzel yazılmış" ama işe yaramaz.
//   2) UYDURMA VERİ — anlatılmayan tarih/tutar. Dilekçedekiyle aynı denetim.
//   3) UYDURMA MADDE — havuzumuzda bulunan bir kanuna yapılan ama O KANUNDA
//      OLMAYAN madde atfı. Bunu ölçebiliyoruz çünkü 17 kanunun tam metni
//      elimizde; "TBK m.999" gibi bir atıf mekanik olarak yakalanır.
//      Havuzda olmayan kanunlara yapılan atıflar SAYILMAZ: orada eksik olan
//      bizim korpusumuzdur, modelin atfı değil.
//   4) YAPI — mütalaa altı bölümlü sabit bir iskeletle isteniyor; bölüm
//      düşerse avukat aradığını bulamaz.
//   5) ADIMLARDA SÜRE — "ATILACAK ADIMLAR" bölümü süre içermiyorsa mütalaa
//      tavsiye değil, deneme yazısıdır.
//
// Kullanım:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... \
//   node scripts/eval-mutalaa.mjs
//
// EVAL_BEKLEME  senaryolar arası bekleme (vars. 30000). Mütalaa ÇOK ADIMLIDIR
//               (sorun çıkarma + her sorun için araştırma + sentez): tek
//               senaryo, bir dilekçenin birkaç katı token yakar. Aralık kısa
//               olursa ölçtüğümüz şey modelin kalitesi değil, sağlayıcının o
//               anki kotası olur.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beklemeSuresi } from './bekleme.mjs';
import { gecer, sadelestir } from './eslestir.mjs';
import { maddeAtiflari, mesruTutarlar, tarihler, tutarlar } from './uydurma.mjs';
import { adimlarBolumu, eksikBolumler, sureIceriyor } from './mutalaa-olcut.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const url = process.env.SUPABASE_URL ?? '';
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const anon = process.env.SUPABASE_ANON_KEY ?? '';
if (!url || !svc || !anon) {
  console.error('HATA: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY ve SUPABASE_ANON_KEY gerekli.');
  process.exit(1);
}

const BEKLEME = Number(process.env.EVAL_BEKLEME ?? 30000);
const uyu = (ms) => new Promise((r) => setTimeout(r, ms));

const EPOSTA = `eval-mutalaa-${Date.now()}@vekil.local`;
const SIFRE = `Ev!${Math.random().toString(36).slice(2)}A9`;

const svcBaslik = { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json' };

async function kullaniciAc() {
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: svcBaslik,
    body: JSON.stringify({ email: EPOSTA, password: SIFRE, email_confirm: true }),
  });
  if (!res.ok) throw new Error(`kullanıcı açılamadı: ${res.status}`);
  return (await res.json()).id;
}

/**
 * MÜTALAA ÜCRETLİ KATMANA AÇIKTIR (pro/elit/ai). Ölçüm kullanıcısı varsayılan
 * katmanda kalırsa uç 403 tier_required döner ve ölçüm "model kötü" değil
 * "yetki yok" yüzünden çöker. Katman ölçüm için elle yükseltilir; sağlayıcı
 * yine ücretsiz hattadır (anahtar yoksa tierConfig Groq'a düşürür).
 */
async function katmaniYukselt(uid) {
  // PATCH, satır YOKSA da 200 döner ve hiçbir şey değiştirmez. Sessiz
  // başarısızlık burada ölçümün tamamını yanlış okuturdu: katman yükselmemiş
  // olur, uç 403 verir ve "mütalaa çalışmıyor" sanılırdı. Bu yüzden dönen
  // temsil OKUNUR ve boşsa satır açılır.
  const res = await fetch(`${url}/rest/v1/profiles?id=eq.${uid}&select=id,ai_tier`, {
    method: 'PATCH',
    headers: { ...svcBaslik, Prefer: 'return=representation' },
    body: JSON.stringify({ ai_tier: 'pro' }),
  });
  if (!res.ok) throw new Error(`katman yükseltilemedi: ${res.status} ${(await res.text()).slice(0, 120)}`);
  const satir = await res.json();
  if (Array.isArray(satir) && satir.length > 0) return;

  const ins = await fetch(`${url}/rest/v1/profiles?select=id,ai_tier`, {
    method: 'POST',
    headers: { ...svcBaslik, Prefer: 'return=representation,resolution=merge-duplicates' },
    body: JSON.stringify({ id: uid, ai_tier: 'pro' }),
  });
  if (!ins.ok) throw new Error(`profil açılamadı: ${ins.status} ${(await ins.text()).slice(0, 160)}`);
}

async function kullaniciSil(id) {
  if (!id) return;
  await fetch(`${url}/auth/v1/admin/users/${id}`, {
    method: 'DELETE',
    headers: { apikey: svc, Authorization: `Bearer ${svc}` },
  }).catch(() => {});
}

/**
 * Oturum açar ve erişim jetonu döner.
 *
 * HER DENEMEDEN ÖNCE YENİDEN ÇAĞRILIR. Jetonun ömrü bir saat; ücretsiz
 * kotanın kayan penceresi yüzünden tek bir ölçüm koşusu SAATLER sürüyor ve
 * koşunun ortasında jeton ölüyordu: ölçüm "ai-chat 401 Invalid JWT" diye
 * kesiliyor, kalan senaryolar hiç ölçülmüyordu. Modelin kalitesiyle ilgisi
 * olmayan bir sebeple saatlerce süren bir ölçümü kaybetmek en pahalı ölçüm
 * hatasıdır. Jeton almak model tüketmez, kotadan bir şey götürmez.
 */
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

/** Havuzdaki (kanun, madde) çiftleri — uydurma madde denetiminin dayanağı. */
async function maddeKumesi() {
  const kume = new Set();
  const kanunlar = new Set();
  for (let sayfa = 0; ; sayfa++) {
    const res = await fetch(
      `${url}/rest/v1/mevzuat_maddeleri?select=kanun_short,madde_no&limit=1000&offset=${sayfa * 1000}`,
      { headers: { apikey: svc, Authorization: `Bearer ${svc}` } }
    );
    if (!res.ok) throw new Error(`madde listesi alınamadı: ${res.status}`);
    const d = await res.json();
    for (const m of d) {
      kume.add(`${m.kanun_short}#${String(m.madde_no).trim()}`);
      kanunlar.add(m.kanun_short);
    }
    if (d.length < 1000) break;
  }
  return { kume, kanunlar };
}

async function uret(olay, deneme = 0) {
  // JETON HER DENEMEDE TAZELENİR. Kota beklemesi tek bir senaryoda 30 dakikayı
  // bulabiliyor; jetonun ömrü bir saat. Denemeler arasında tazelenmezse ölçüm,
  // modelle ilgisi olmayan bir 401 yüzünden yarıda kalır.
  const jwt = await jwtAl();
  const res = await fetch(`${url}/functions/v1/ai-chat`, {
    method: 'POST',
    headers: { apikey: anon, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'mutalaa', question: olay }),
  });
  if (res.status === 403) throw new Error(`YETKI: ${(await res.text()).slice(0, 120)}`);
  if (res.status === 429) {
    const g = await res.text();
    // KOTA KAYAN PENCEREYLE YENİLENİYOR. Uç, gövdede "kaç saniye sonra"
    // diyorsa beklemek ölçümü kurtarır: eskiden burada koşu tamamen
    // kesiliyor ve 10 senaryonun 4'ünden sonrası hiç ölçülmüyordu.
    const bekle = beklemeSuresi(g);
    if (bekle && deneme < 6) {
      console.log(`    (kota doldu; ${Math.round(bekle / 60000)} dk bekleniyor)`);
      await uyu(bekle);
      return uret(olay, deneme + 1);
    }
    if (g.includes('daily_quota')) throw new Error('DAILY_QUOTA');
    if (deneme < 4) {
      await uyu(30000 * (deneme + 1));
      return uret(olay, deneme + 1);
    }
  }
  if (res.status >= 500 && deneme < 4) {
    await uyu(20000 * (deneme + 1));
    return uret(olay, deneme + 1);
  }
  if (!res.ok) throw new Error(`ai-chat ${res.status}: ${(await res.text()).slice(0, 140)}`);
  const j = await res.json();
  // Yedek mevzuat özeti mütalaa DEĞİLDİR; model cevabı sayılırsa ölçüm modelin
  // değil sağlayıcı yoğunluğunun fotoğrafını çeker.
  if (j?.yapayZekasiz || j?.model === 'mevzuat-yedek') {
    if (deneme < 4) {
      await uyu(30000 * (deneme + 1));
      return uret(olay, deneme + 1);
    }
    throw new Error('YEDEK_OZET');
  }
  return String(j?.text ?? '');
}

const { senaryolar } = JSON.parse(readFileSync(join(__dirname, 'mutalaa-senaryolari.json'), 'utf8'));

let uid = null;
const sonuclar = [];
const kusurlu = [];

try {
  const { kume, kanunlar } = await maddeKumesi();
  console.log(`Havuz: ${kume.size} madde · ${kanunlar.size} kanun`);

  uid = await kullaniciAc();
  await katmaniYukselt(uid);
  const jwt = await jwtAl();
  console.log(`Mütalaa ölçümü · ${senaryolar.length} senaryo\n`);

  let ilk = true;
  for (const s of senaryolar) {
    if (!ilk) await uyu(BEKLEME);
    ilk = false;

    let metin;
    try {
      metin = await uret(s.olay);
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

    const sade = sadelestir(metin);
    const kacan = (s.kacirilmamali ?? []).filter((k) => !gecer(metin, k));
    const yasak = (s.olmamali ?? []).filter((k) => gecer(metin, k));
    const eksikBolum = eksikBolumler(sade);

    const olayTarih = tarihler(s.olay);
    const uydurmaTarih = [...tarihler(metin)].filter((t) => !olayTarih.has(t));
    const mesru = mesruTutarlar(tutarlar(s.olay));
    const uydurmaTutar = [...tutarlar(metin)].filter((t) => !mesru.has(t));

    // Havuzda BULUNAN bir kanuna yapılıp o kanunda OLMAYAN madde atfı.
    const uydurmaMadde = maddeAtiflari(metin)
      .filter((a) => kanunlar.has(a.kanun) && !kume.has(`${a.kanun}#${a.madde}`))
      .map((a) => `${a.kanun} m.${a.madde}`);

    const adimlar = adimlarBolumu(sade);
    const adimdaSure = sureIceriyor(adimlar);

    const gecti =
      kacan.length === 0 &&
      yasak.length === 0 &&
      eksikBolum.length === 0 &&
      uydurmaTarih.length === 0 &&
      uydurmaMadde.length === 0 &&
      adimdaSure;

    sonuclar.push({ id: s.id, gecti, kacan, yasak, eksikBolum, uydurmaTarih, uydurmaTutar, uydurmaMadde, adimdaSure, uzunluk: metin.length });

    console.log(`${gecti ? '✓' : '✗'} ${s.id}  ${metin.length} krktr`);
    if (kacan.length) console.log(`    KAÇIRILAN   : ${kacan.join(' | ')}`);
    if (yasak.length) console.log(`    OLMAMALIYDI : ${yasak.join(' | ')}`);
    if (eksikBolum.length) console.log(`    EKSİK BÖLÜM : ${eksikBolum.join(', ')}`);
    if (uydurmaTarih.length) console.log(`    UYDURMA TARİH: ${uydurmaTarih.join(', ')}`);
    if (uydurmaTutar.length) console.log(`    UYDURMA TUTAR: ${uydurmaTutar.join(', ')}`);
    if (uydurmaMadde.length) console.log(`    UYDURMA MADDE: ${uydurmaMadde.join(', ')}`);
    if (!adimdaSure) console.log('    ADIMLARDA SÜRE YOK (tavsiye değil, deneme yazısı)');
    if (!gecti) kusurlu.push({ id: s.id, kacan, yasak, eksikBolum, uydurmaTarih, uydurmaTutar, uydurmaMadde, metin });
  }
} finally {
  await kullaniciSil(uid);
}

if (kusurlu.length) {
  const yol = join(__dirname, 'eval-mutalaa-hatalar.json');
  writeFileSync(yol, JSON.stringify({ tarih: new Date().toISOString(), kusurlu }, null, 1), 'utf8');
  console.log(`\nKusurlu mütalaaların tam metni: ${yol}`);
}

const olculen = sonuclar.length;
const gecen = sonuclar.filter((s) => s.gecti).length;
const kacirilan = sonuclar.reduce((t, s) => t + s.kacan.length, 0);
const maddeUydurma = sonuclar.filter((s) => s.uydurmaMadde.length).length;

console.log('\n' + '─'.repeat(60));
console.log(`MÜTALAA: ${gecen}/${olculen} senaryo tam geçti (%${olculen ? ((gecen / olculen) * 100).toFixed(1) : 0})`);
console.log(`Kaçırılan kritik unsur: ${kacirilan}`);
console.log(`Havuzda olmayan maddeye atıf yapan mütalaa: ${maddeUydurma}/${olculen}`);
