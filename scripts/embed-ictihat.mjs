#!/usr/bin/env node
// Vekil :: İçtihat vektörleyicisi (embedding doldurucu)
// ---------------------------------------------------------------------------
// Hasat biten kararların anlamsal arama vektörünü doldurur. Kendisi vektör
// ÜRETMEZ; embed-ictihat Edge Function'ını tekrar tekrar çağırır. Vektör orada,
// Supabase Edge çalışma zamanının yerleşik gte-small modeliyle üretilir:
// ücretsizdir ve API anahtarı istemez.
//
// Neden döngü: edge çalışma zamanının işlem bütçesi sınırlı, tek çağrıda en
// fazla ~4-6 karar vektörlenebiliyor (8'de WORKER_RESOURCE_LIMIT). 300 yeni
// karar = ~75 çağrı. Fonksiyon idempotent (yalnız embedding'i NULL olanları
// işler), bu yüzden döngü güvenle tekrar edilebilir.
//
// Vektörsüz karar, anlamsal aramada GÖRÜNMEZ — yalnız kelime aramasıyla
// bulunabilir. Bu adım atlanırsa havuz büyüdükçe arama kalitesi geriler.
//
// Çalıştırma:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/embed-ictihat.mjs
//
// Env:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (zorunlu)
//   EMBED_BATCH        çağrı başına karar (vars. 4, en fazla 6)
//   EMBED_MAX_CALLS    bu çalışmadaki en fazla çağrı (vars. 400)
//   EMBED_DELAY        çağrılar arası bekleme, ms (vars. 250)
// ---------------------------------------------------------------------------

const BATCH = Math.min(6, Math.max(1, Number(process.env.EMBED_BATCH ?? 4)));
const MAX_CALLS = Number(process.env.EMBED_MAX_CALLS ?? 400);
const DELAY = Number(process.env.EMBED_DELAY ?? 250);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function log(...a) {
  console.log(new Date().toISOString().slice(11, 19), ...a);
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('HATA: SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.');
    process.exit(1);
  }

  const endpoint = `${url.replace(/\/+$/, '')}/functions/v1/embed-ictihat`;
  log(`Vektörleme başlıyor · batch=${BATCH} · max_calls=${MAX_CALLS}`);

  let processed = 0;
  let failed = 0;
  let calls = 0;
  // Art arda hiç ilerleme olmazsa dur: kalan kayıtların metni bozuk olabilir ve
  // fonksiyon onları hep atlar — sonsuz döngüye girmemek için.
  let stuck = 0;

  while (calls < MAX_CALLS) {
    calls++;
    let res;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          apikey: key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ limit: BATCH }),
      });
    } catch (e) {
      log(`ağ hatası: ${e.message} — 5sn sonra tekrar`);
      await sleep(5000);
      continue;
    }

    const body = await res.text();
    if (!res.ok) {
      // Kaynak sınırı geçici olabilir; birkaç kez toparlanmaya şans ver.
      log(`çağrı ${calls} başarısız (${res.status}): ${body.slice(0, 200)}`);
      stuck++;
      if (stuck >= 5) {
        console.error('HATA: fonksiyon üst üste 5 kez başarısız oldu, duruluyor.');
        process.exit(1);
      }
      await sleep(5000);
      continue;
    }

    let j;
    try {
      j = JSON.parse(body);
    } catch {
      log(`çağrı ${calls}: yanıt okunamadı — ${body.slice(0, 200)}`);
      stuck++;
      if (stuck >= 5) process.exit(1);
      continue;
    }

    processed += Number(j.processed ?? 0);
    failed += Number(j.failed ?? 0);
    const remaining = j.remaining;

    if (Number(j.processed ?? 0) === 0) {
      stuck++;
      // Kalan varken ilerleme yoksa bu kayıtlar işlenemiyor demektir.
      if (stuck >= 3) {
        log(`ilerleme durdu · işlenen=${processed} · hatalı=${failed} · kalan=${remaining}`);
        break;
      }
    } else {
      stuck = 0;
    }

    if (remaining === 0) {
      log(`tamamlandı · işlenen=${processed} · hatalı=${failed} · çağrı=${calls}`);
      return;
    }

    if (calls % 10 === 0) log(`  ${calls} çağrı · işlenen=${processed} · kalan=${remaining}`);
    await sleep(DELAY);
  }

  // Bütçe bitti ama kalan olabilir: hata değil, sonraki çalışma devam eder
  // (fonksiyon idempotent olduğu için kaldığı yerden sürer).
  log(`bütçe doldu · işlenen=${processed} · hatalı=${failed} · çağrı=${calls}`);
}

main().catch((e) => {
  console.error('HATA:', e);
  process.exit(1);
});
