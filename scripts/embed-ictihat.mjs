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
//   EMBED_MAX_CALLS    bu çalışmadaki en fazla çağrı (vars. 500)
//   EMBED_DELAY        çağrılar arası bekleme, ms (vars. 750)
//   EMBED_MAX_STRIKES  art arda kaç geçici hataya katlanılacağı (vars. 15)
//   EMBED_KAYNAK       'ictihat' (vars.) | 'mevzuat' — hangi havuz doldurulacak
//   EMBED_SIRA         'asc' (vars.) | 'desc' — iki işçiyi iki uçtan çalıştırıp
//                      toplu doldurmayı hızlandırmak için
// ---------------------------------------------------------------------------

const BATCH = Math.min(6, Math.max(1, Number(process.env.EMBED_BATCH ?? 4)));
const MAX_CALLS = Number(process.env.EMBED_MAX_CALLS ?? 500);
// Ölçüldü: 250ms'lik hızda ~85 çağrı sonra worker kaynak sınırına takılıyor.
// Daha nazik hız, sınıra hiç çarpmadan tamamlama şansını artırıyor.
const DELAY = Number(process.env.EMBED_DELAY ?? 750);
const MAX_STRIKES = Number(process.env.EMBED_MAX_STRIKES ?? 15);
const KAYNAK = process.env.EMBED_KAYNAK === 'mevzuat' ? 'mevzuat' : 'ictihat';
const SIRA = process.env.EMBED_SIRA === 'desc' ? 'desc' : 'asc';

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
  log(`Vektörleme başlıyor · kaynak=${KAYNAK} · sıra=${SIRA} · batch=${BATCH} · max_calls=${MAX_CALLS}`);

  let processed = 0;
  let failed = 0;
  let calls = 0;
  // İki ayrı sayaç, çünkü iki ayrı arıza:
  //   httpStrikes  → fonksiyon hiç yanıt veremedi (503 / WORKER_RESOURCE_LIMIT).
  //                  Ölçüldü: geçicidir, aralarında başarılı çağrılar oluyor.
  //   idleStrikes  → fonksiyon 200 döndü ama hiçbir kaydı işleyemedi. Kalan
  //                  kayıtların metni bozuk demektir; beklemek düzeltmez.
  let httpStrikes = 0;
  let idleStrikes = 0;

  while (calls < MAX_CALLS) {
    calls++;
    let res;
    let body = '';
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          apikey: key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ limit: BATCH, kaynak: KAYNAK, sira: SIRA }),
      });
      body = await res.text();
    } catch (e) {
      body = `ağ hatası: ${e.message}`;
      res = null;
    }

    let j = null;
    if (res && res.ok) {
      try {
        j = JSON.parse(body);
      } catch {
        j = null;
      }
    }

    if (!j) {
      httpStrikes++;
      const detail = res ? `${res.status} ${body.slice(0, 120)}` : body;
      // Üst üste hata geldikçe geri çekil: worker'a toparlanma payı bırakır.
      // Hemen tekrar denemek sınırı besliyor.
      const wait = Math.min(60000, 4000 * 2 ** Math.min(httpStrikes - 1, 4));
      log(`çağrı ${calls} başarısız (${detail}) — ${Math.round(wait / 1000)}sn bekle [${httpStrikes}/${MAX_STRIKES}]`);
      if (httpStrikes >= MAX_STRIKES) {
        log(`üst üste ${MAX_STRIKES} hata · işlenen=${processed} · duruluyor`);
        break;
      }
      await sleep(wait);
      continue;
    }

    httpStrikes = 0;
    const now = Number(j.processed ?? 0);
    processed += now;
    failed += Number(j.failed ?? 0);
    const remaining = j.remaining;

    if (remaining === 0) {
      log(`tamamlandı · işlenen=${processed} · hatalı=${failed} · çağrı=${calls}`);
      return;
    }

    if (now === 0) {
      idleStrikes++;
      if (idleStrikes >= 3) {
        log(`ilerleme durdu (işlenemeyen kayıt) · işlenen=${processed} · hatalı=${failed} · kalan=${remaining}`);
        break;
      }
    } else {
      idleStrikes = 0;
    }

    if (calls % 20 === 0) log(`  ${calls} çağrı · işlenen=${processed} · kalan=${remaining}`);
    await sleep(DELAY);
  }

  // Buraya düşmek hata DEĞİL: fonksiyon idempotent, kalanları bir sonraki
  // çalışma kaldığı yerden alır. Tek gerçek arıza, hiçbir şeyin işlenememesi —
  // o zaman yapılandırma bozuktur ve iş akışı bunu görmelidir.
  log(`durdu · işlenen=${processed} · hatalı=${failed} · çağrı=${calls}`);
  if (processed === 0) {
    console.error('HATA: hiçbir kayıt vektörlenemedi.');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('HATA:', e);
  process.exit(1);
});
