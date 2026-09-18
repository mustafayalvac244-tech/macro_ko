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

    // JSON:API'DE İLİŞKİ VERİSİ KENDİLİĞİNDEN GELMEZ — 18.09.2026'da öğrenildi.
    // İlk sürüm `bilgi.relationships.ageRatingDeclaration.data` okuyordu ve
    // boş çıkınca "beyan nesnesi yok" sanıldı. Oysa `include` istenmeden
    // ilişkiler yalnız `links` taşıyor. Doğrusu ilişki ucuna doğrudan sormak.
    try {
      const beyan = await api(`/appInfos/${bilgi.id}/ageRatingDeclaration`);
      if (beyan?.data) {
        yazdirAlanlar(`ageRatingDeclaration ${beyan.data.id}`, beyan.data.attributes);
        console.log(`\n  → YAZ modunda kullanılacak id: ${beyan.data.id}`);
      } else {
        console.log('  ageRatingDeclaration: uç cevap verdi ama data boş');
      }
    } catch (e) {
      console.log(`  ageRatingDeclaration okunamadı: ${String(e.message).split('\n')[0]}`);
    }
  }

  // Sürümler: hangi sürüm hangi durumda, hangi derleme bağlı.
  const surumler = await api(`/apps/${APP_ID}/appStoreVersions?limit=5`);
  for (const s of surumler?.data || []) {
    yazdirAlanlar(`appStoreVersion ${s.id}`, s.attributes);
  }
}

/**
 * ABONELİK DURUMUNU OKU — SALT OKUNUR.
 *
 * NEDEN VAR (18.09.2026). Ürün sahibi "bunları sen yapamaz mısın" dedi;
 * elimde ASC anahtarı var ve abonelik ürünleri Apple'ın en büyük
 * tıkanıklığı ("Unable to Add for Review" üç şartından biri). Ama
 * abonelik uçlarının bu anahtarla YAZILABİLİR olup olmadığını BİLMİYORUM
 * — Apple bazı uçları yalnız Account Holder rolüne açıyor, bazı uçlar
 * "Paid Apps" sözleşmesi imzalanmadan hiç çalışmıyor.
 *
 * Bu yüzden ilk adım TAHMİN DEĞİL ÖLÇÜM: ne var, ne yok, hangi uç ne
 * hata veriyor. Yazma ancak bu çıktı görüldükten sonra yazılır. Aynı
 * ders yaş sınırı beyanında işe yaradı: reddedilen istek hiçbir şeyi
 * değiştirmiyor, ama Apple'ın hata metni şemayı öğretiyor.
 */
async function abonelikOku() {
  console.log(`Uygulama: ${APP_ID}`);

  let gruplar = null;
  try {
    gruplar = await api(`/apps/${APP_ID}/subscriptionGroups?limit=50`);
  } catch (e) {
    console.log(`\nsubscriptionGroups OKUNAMADI:\n  ${e.message}`);
    console.log('\n→ Bu uç bu anahtara kapalıysa abonelik ürünleri ELLE açılmalı.');
    return;
  }

  const liste = gruplar?.data || [];
  console.log(`\nAbonelik grubu sayısı: ${liste.length}`);
  if (!liste.length) {
    console.log('→ Hiç grup yok. Grup oluşturmak POST /subscriptionGroups ister.');
  }

  for (const g of liste) {
    yazdirAlanlar(`subscriptionGroup ${g.id}`, g.attributes);

    // İLİŞKİ VERİSİ KENDİLİĞİNDEN GELMEZ (18.09.2026 dersi) — uca doğrudan sor.
    try {
      const urunler = await api(`/subscriptionGroups/${g.id}/subscriptions`);
      const u = urunler?.data || [];
      console.log(`\n  grup ${g.id} içinde ${u.length} ürün:`);
      for (const s of u) {
        yazdirAlanlar(`  subscription ${s.id}`, s.attributes);

        // Fiyat ve yerelleştirme ayrı nesneler; eksikleri burada görünür.
        for (const [ad, yol] of [
          ['fiyatlar', `/subscriptions/${s.id}/prices`],
          ['yerelleştirme', `/subscriptions/${s.id}/subscriptionLocalizations`],
        ]) {
          try {
            const c = await api(yol);
            console.log(`    ${ad}: ${(c?.data || []).length} kayıt`);
          } catch (e) {
            console.log(`    ${ad} okunamadı: ${String(e.message).split('\n')[0]}`);
          }
        }
      }
    } catch (e) {
      console.log(`  ürünler okunamadı: ${String(e.message).split('\n')[0]}`);
    }
  }

  // YAZMA İZNİ VE ŞEMA — BOŞ POST'LARLA SINA.
  //
  // Eksik gövdeyle gönderilen istek HİÇBİR ŞEY OLUŞTURMAZ. Üç cevaptan biri:
  //   409 / 400 "şu alan zorunlu"  → uç AÇIK, yalnız gövde eksik  → YAZABİLİRİM
  //   403 FORBIDDEN_ERROR          → uç bu anahtara KAPALI        → YAZAMAM
  //   başka                        → elle oku
  //
  // HER UÇ AYRI ÖLÇÜLÜYOR. `/subscriptionGroups` açık çıktı diye
  // `/subscriptions` de açıktır DENEMEZ — Apple izinleri uç bazında
  // veriyor. Bir uçtan diğerine genelleme yapmak tam da kaçındığımız şey.
  //
  // Yan fayda: 409 metni ZORUNLU ALAN ADLARINI sayıyor. Yaş sınırı
  // beyanında şema tam olarak böyle öğrenildi (koşu #10) ve ezberden
  // yazılan alan adlarının Apple'a yanlış beyan olma riski ortadan kalktı.
  console.log('\n── yazma izni + şema sınaması (HİÇBİR ŞEY OLUŞTURMAZ) ───────');
  for (const tip of ['subscriptionGroups', 'subscriptions', 'subscriptionLocalizations', 'subscriptionPrices']) {
    console.log(`\n  POST /${tip}`);
    try {
      await api(`/${tip}`, {
        method: 'POST',
        body: JSON.stringify({ data: { type: tip, attributes: {}, relationships: {} } }),
      });
      console.log('    BEKLENMEDİK: boş POST kabul edildi. Çıktıyı elle incele.');
    } catch (e) {
      for (const satir of String(e.message).split('\n').slice(1)) console.log(`   ${satir}`);
      const m = e.message;
      if (m.includes('403') || m.includes('FORBIDDEN')) {
        console.log('    → KAPALI (bu uç elle yapılacak)');
      } else if (m.includes('409') || m.includes('400')) {
        console.log('    → AÇIK (yalnız eksik alanlardan şikâyet etti)');
      } else {
        console.log('    → belirsiz; hata metnini oku');
      }
    }
  }

  // TÜRKİYE FİYAT NOKTASI. Apple abonelik fiyatını serbest sayı olarak
  // almıyor; önceden tanımlı "price point" kimliklerinden birini istiyor.
  // Var olan ürün üzerinden Türkiye noktalarını listeleyip 399 ₺'ye en
  // yakınını bulmak, yeni ürünün fiyatını API'den kurabilmenin ön şartı.
  const ilkUrun = (await api(`/subscriptionGroups/${liste[0]?.id}/subscriptions`).catch(() => null))?.data?.[0];
  if (ilkUrun) {
    console.log('\n── Türkiye fiyat noktaları (399 ₺ civarı) ───────────────────');
    //
    // SAYFALAMA ŞART — 18.09.2026'da yapılan ve AYNI KOŞUDA yakalanan hata.
    // İlk sürüm tek sayfa (`limit=200`) okuyup "399'a en yakın" diye sıraladı
    // ve 199,99 TL'yi en yakın gösterdi. Saçma: 399 varsa 199,99 en yakın
    // olamaz. Sebep, `limit=200` Apple'ın SAYFA BAŞINA üst sınırı olması ve
    // noktaların artan sırada gelmesi — yani liste 199,99'da KESİLMİŞTİ,
    // orada BİTMEMİŞTİ. "200 nokta" da toplam değil, ilk sayfanın boyutuydu.
    //
    // DERS: bir listenin sonunu gördüğünü, `next` bağlantısına bakmadan
    // varsayma. Kesilmiş liste, üzerinde yapılan her sıralamayı ve her
    // "en yakın/en büyük/toplam" iddiasını sessizce yanlışlar.
    try {
      let yol = `/subscriptions/${ilkUrun.id}/pricePoints?filter[territory]=TUR&limit=200`;
      const hepsi = [];
      let sayfa = 0;
      while (yol && sayfa < 20) {
        const nok = await api(yol);
        for (const p of nok?.data || []) {
          const tl = Number(p.attributes?.customerPrice);
          if (Number.isFinite(tl)) hepsi.push({ id: p.id, tl });
        }
        sayfa += 1;
        const sonraki = nok?.links?.next;
        yol = sonraki ? sonraki.replace(/^https:\/\/api\.appstoreconnect\.apple\.com\/v1/, '') : null;
      }
      const enBuyuk = hepsi.reduce((a, b) => (b.tl > a.tl ? b : a), { tl: -1 });
      console.log(`  ${sayfa} sayfada toplam ${hepsi.length} nokta (en yüksek ${enBuyuk.tl} TL)`);
      for (const hedef of [399, 2999]) {
        const yakin = [...hepsi].sort((a, b) => Math.abs(a.tl - hedef) - Math.abs(b.tl - hedef)).slice(0, 3);
        console.log(`  ${hedef} TL'ye en yakın:`);
        for (const p of yakin) console.log(`    ${p.tl} TL  → ${p.id}`);
      }
    } catch (e) {
      console.log(`  okunamadı: ${String(e.message).split('\n')[0]}`);
    }
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

const MODLAR = { yaz, 'abonelik-oku': abonelikOku, oku };
const islem = MODLAR[MOD] || oku;
islem().catch((e) => { console.error(`\n${e.message}`); process.exit(1); });
