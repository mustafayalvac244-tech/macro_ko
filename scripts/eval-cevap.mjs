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
//
// DİKKAT: bu ölçüm gerçek AI çağrısı yapar ve ücretsiz katmanın GÜNLÜK
// kotasından yer. Arka arkaya birkaç koşu, kotayı bitirip uygulamadaki AI'yi
// o gün için kullanılamaz hâle getirebilir. Ölçümü seyrek ve tek koşu yapın.
// ---------------------------------------------------------------------------
import { readFileSync, writeFileSync } from 'node:fs';
import { gecer } from './eslestir.mjs';
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
  if (res.status === 429) {
    const govde = await res.text();
    // GÜNLÜK KOTA ile ANLIK HIZ SINIRI farklıdır ve karıştırmak ölçümü bozar:
    // kota bittiyse beklemek işe yaramaz, her soru "yanlış" sayılır ve ortaya
    // modelin kalitesini değil kotanın bittiğini gösteren sahte bir oran çıkar.
    // Bu ölçüm bir kez tam da böyle yanıldı (%75 → %25 "gerileme" sanılmıştı).
    // İkinci kez de benzer şekilde yanıldı: yedek mevzuat özeti model cevabı
    // sayılınca 13/13 sonuç 9/13 göründü (bkz. aşağıdaki YEDEK_OZET kontrolü).
    if (govde.includes('daily_quota')) throw new Error('DAILY_QUOTA');
    if (deneme < 4) {
      const bekle = 30000 * (deneme + 1);
      console.log(`    (hız sınırı — ${bekle / 1000}sn bekleniyor)`);
      await uyu(bekle);
      return sor(jwt, soru, deneme + 1);
    }
  }
  if (!res.ok) throw new Error(`ai-chat ${res.status}: ${(await res.text()).slice(0, 150)}`);
  const govde = await res.json();

  // YEDEK ÖZET, MODEL CEVABI DEĞİLDİR. İki sağlayıcı da anlık sınıra takılınca
  // ai-chat 200 ile "mevzuat özeti" döner (hata kutusu göstermemek için). Bunu
  // model cevabı sayarsak, ölçüm modelin kalitesini değil o andaki sağlayıcı
  // yoğunluğunu ölçer — nitekim bir koşuda 13/13 olan sonuç, üçü özet olduğu
  // için 9/13 göründü. Özet geldiğinde beklenip yeniden sorulur.
  if (govde?.yapayZekasiz || govde?.model === 'mevzuat-yedek') {
    if (deneme < 4) {
      const bekle = 30000 * (deneme + 1);
      console.log(`    (sağlayıcı yoğun, mevzuat özeti döndü — ${bekle / 1000}sn bekleniyor)`);
      await uyu(bekle);
      return sor(jwt, soru, deneme + 1);
    }
    throw new Error('YEDEK_OZET');
  }
  return String(govde?.text ?? '');
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
      if (e.message === 'DAILY_QUOTA') {
        console.error(
          '\nDURDURULDU: sağlayıcının GÜNLÜK kotası tükendi. Kalan sorular ölçülmedi.\n' +
            'Bu koşudan oran ÇIKARMAYIN — eksik ölçüm, gerçek bir gerilemeymiş gibi görünür.\n' +
            'Kota yenilenince tekrar çalıştırın.'
        );
        process.exitCode = 2;
        break;
      }
      if (e.message === 'YEDEK_OZET') {
        console.error(
          '\nDURDURULDU: iki sağlayıcı da yoğun; ai-chat model yerine mevzuat özeti\n' +
            'döndürüyor. Bu koşudan oran ÇIKARMAYIN — ölçülen modelin kalitesi değil,\n' +
            'o andaki sağlayıcı yoğunluğudur. Daha seyrek aralıkla (EVAL_BEKLEME) tekrar deneyin.'
        );
        process.exitCode = 2;
        break;
      }
      console.log(`✗ ${s.soru}\n    HATA: ${e.message}`);
      basarisiz.push({ soru: s.soru, sebep: e.message });
      continue;
    }

    const eksik = (s.icermeli ?? []).filter((k) => !gecer(cevap, k));
    const yasak = (s.icermemeli ?? []).filter((k) => gecer(cevap, k));
    // UZUNLUK da bir kalite ölçütüdür: tek bilgi sorulan soruya tablo + adım
    // planı + kontrol listesi üretmek cevabı iyileştirmiyor, aradığı satırı
    // avukattan gizliyor. Doğru ama gereksiz uzun cevap BAŞARISIZ sayılır.
    const uzun = s.enFazlaKarakter && cevap.length > s.enFazlaKarakter
      ? `${cevap.length} karakter (üst sınır ${s.enFazlaKarakter})`
      : null;

    if (eksik.length === 0 && yasak.length === 0 && !uzun) {
      dogru++;
      console.log(`✓ ${s.soru}  (${cevap.length} krktr)`);
    } else {
      console.log(`✗ ${s.soru}`);
      console.log(`    dayanak : ${s.dayanak}`);
      if (eksik.length) console.log(`    EKSİK   : ${eksik.join(' · ')}`);
      if (yasak.length) console.log(`    YANLIŞ  : ${yasak.join(' · ')}`);
      if (uzun) console.log(`    ÇOK UZUN: ${uzun}`);
      basarisiz.push({ soru: s.soru, eksik, yasak, uzun, uzunluk: cevap.length, cevap });
    }
  }
} finally {
  await kullaniciSil(uid);
}

// Hatalı cevapların TAM METNİ dosyaya yazılır. Yoksa teşhis için soruyu
// yeniden sormak gerekir; bu hem kotadan yer hem de model değişken olduğu için
// başka bir cevabı incelemeye yol açar (bir kez tam olarak böyle oldu).
if (basarisiz.length) {
  const dosya = join(__dirname, 'eval-cevap-hatalar.json');
  writeFileSync(dosya, JSON.stringify({ tarih: new Date().toISOString(), basarisiz }, null, 2));
  console.log(`\nHatalı cevapların tam metni: ${dosya}`);
}

const oran = sorular.length ? ((dogru / sorular.length) * 100).toFixed(1) : '0.0';
console.log(`\n${'─'.repeat(60)}`);
console.log(`CEVAP DOĞRULUĞU: ${dogru}/${sorular.length} (%${oran})`);
if (basarisiz.length) {
  console.log(`Hatalı cevap: ${basarisiz.length}`);
  process.exitCode = 1;
}
