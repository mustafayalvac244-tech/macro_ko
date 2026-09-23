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
  // GÖVDE NESNE OLARAK GELİRSE JSON'A ÇEVİR — 19.09.2026'da eklendi.
  //
  // Bu yardımcı `...secenek`i doğrudan fetch'e yayıyordu. `body` bir NESNE
  // olarak verilirse fetch onu `"[object Object]"` diye gönderir ve Apple
  // haklı olarak şunu der:
  //   422 ENTITY_UNPROCESSABLE: The request entity is not a valid request
  //   document object — Unexpected error
  // Hata mesajı alan adı vermediği için saatlerce Apple'ın şemasında
  // aranacak bir sorun sanıldı; oysa kusur bizim aracımızdaydı. Dosyadaki
  // eski yazmaların hepsi `JSON.stringify` yazdığı için tuzak görünmüyordu:
  // kural yazılı değildi, yalnız alışkanlıktı — ve yeni kod alışkanlığı
  // bilmiyordu.
  const govde = secenek.body && typeof secenek.body === 'object' && !(secenek.body instanceof ArrayBuffer) && !ArrayBuffer.isView(secenek.body)
    ? JSON.stringify(secenek.body)
    : secenek.body;
  const cevap = await fetch(`${API}${yol}`, {
    ...secenek,
    body: govde,
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

        // FİYAT KAYITLARINI AÇ — 18.09.2026, koşu #17'den sonra eklendi.
        //
        // NEDEN. Yeni ürüne 399 TL kurma denemesi dört ayrı gövdeyle de
        // "An error occurred while processing the pricing information"
        // aldı ve ilk hipotezim "Paid Apps sözleşmesi imzasız" idi. Ama
        // bu hipotezi ZAYIFLATAN bir ölçüm var: var olan AI ürününün
        // 50 fiyat kaydı ZATEN DURUYOR. Sözleşme fiyatlamayı komple
        // kilitliyor olsaydı o 50 kaydın da olmaması gerekirdi.
        //
        // Bu yüzden hipotezi savunmak yerine ALTERNATİFİ ölçüyorum:
        // o 50 kayıt 50 ayrı ülke mi (yani Apple bir TEMEL ülkeden
        // türetmiş), yoksa hepsi Türkiye mi? Temel-ülke düzeniyse yeni
        // ürüne doğrudan TUR noktası göndermek yanlış sıra demektir ve
        // hata da bunu anlatıyor olur.
        try {
          const f = await api(`/subscriptions/${s.id}/prices?include=subscriptionPricePoint,territory&limit=200`);
          const kayitlar = f?.data || [];
          const dahil = new Map((f?.included || []).map((d) => [`${d.type}:${d.id}`, d]));

          // HER FİYAT KAYDINI KENDİ ÜLKESİYLE EŞLEŞTİR.
          //
          // ÖNCEKİ SÜRÜM YANLIŞ OKUYORDU — 18.09.2026, koşu #18. `included`
          // dizisinde ülkeleri ve fiyat noktalarını AYRI AYRI sayıp "175
          // ülke" dedi ve TUR noktasını arayıp "Türkiye kaydı 399,99 TL"
          // diye bastı. Ama `included` bir HAVUZ: kaydın kendi ilişkisine
          // bakmadan oradan seçilen nokta, o kaydın noktası olmayabilir.
          // Yani o satır bir ÖLÇÜM DEĞİL, eşleştirilmemiş bir tahmindi.
          // Doğrusu: her `prices` kaydının relationships'inden gidip
          // ülkesini ve noktasını birlikte çözmek.
          const satirlar = [];
          for (const k of kayitlar) {
            const uId = k.relationships?.territory?.data?.id;
            const nId = k.relationships?.subscriptionPricePoint?.data?.id;
            const n = nId ? dahil.get(`subscriptionPricePoints:${nId}`) : null;
            satirlar.push({ ulke: uId || '?', fiyat: n?.attributes?.customerPrice ?? '?' });
          }
          console.log(`    fiyat detayı: ${satirlar.length} kayıt`);
          const turkiye = satirlar.find((x) => x.ulke === 'TUR');
          console.log(`      TÜRKİYE: ${turkiye ? `${turkiye.fiyat} TL` : 'KAYIT YOK'}`);
          for (const x of satirlar.slice(0, 5)) console.log(`      ${x.ulke} = ${x.fiyat}`);
        } catch (e) {
          console.log(`    fiyat detayı okunamadı: ${String(e.message).split('\n')[0]}`);
        }

        // SATIŞA AÇIKLIK — 18.09.2026, koşu #20'den SONRA eklendi, ACİL.
        //
        // NEDEN ACİL. O koşuda AI ürününün availability ucu 404 döndü ve
        // betiğim "yok demek ki" deyip YENİ BİR TANE kurdu — içinde
        // YALNIZ TÜRKİYE. Oysa AI ürününün 175 ülkede fiyatı vardı, yani
        // bir yerde satışa açıklığı olmalıydı. 404'ü "yok" diye okumak
        // benim çıkarımımdı, Apple'ın sözü değil.
        // Sonuç: AI'ın satış alanını 175 ülkeden 1'e DARALTMIŞ olabilirim.
        // Bu ekran o ihtimali ölçüyor. Daraldıysa geri genişletilecek.
        try {
          const a = await api(`/subscriptions/${s.id}/subscriptionAvailability`);
          if (a?.data) {
            const ulk = await api(`/subscriptionAvailabilities/${a.data.id}/availableTerritories?limit=200`);
            const l = (ulk?.data || []).map((t) => t.id);
            console.log(`    satışa açık: ${l.length} ülke · yeni ülkelere otomatik=${a.data.attributes?.availableInNewTerritories}`);
            console.log(`      ${l.slice(0, 10).join(', ')}${l.length > 10 ? ' …' : ''}`);
          } else {
            console.log('    satışa açık: uç cevap verdi ama data boş');
          }
        } catch (e) {
          console.log(`    fiyat detayı okunamadı: ${String(e.message).split('\n')[0]}`);
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

/**
 * ABONELİK ÜRÜNLERİNİ KUR — YAZAR.
 *
 * ÜRÜN SAHİBİ ONAYI: 18.09.2026, "Hepsini kur". Onay şu bilgiyle alındı:
 * App Store'da bir ürün kimliği BİR KEZ oluşturulunca SİLİNEMEZ, yalnız
 * "kullanılamaz" yapılabilir.
 *
 * NE YAPAR (hepsi ölçülmüş şemayla — alan adları koşu #14'te Apple'ın
 * kendi 409 metninden okundu, ezberlenmedi):
 *   1. Ürün yoksa  POST /subscriptions
 *   2. Yerelleştirme yoksa  POST /subscriptionLocalizations
 *   3. Fiyat yoksa  POST /subscriptionPrices
 *
 * TEKRAR KOŞULABİLİR. Her adım önce canlıyı okur, var olanı atlar. Betik
 * yarıda düşerse yeniden koşmak kaldığı yerden devam eder, kopya üretmez —
 * kopya üretilemeyecek bir yerde (silinemeyen ürün kimliği) bu şart.
 *
 * FİYAT KADEMESİ ÜRÜNE BAĞLI — 18.09.2026'da ölçüldü. Fiyat noktası
 * kimliği base64 ve içi {"s":"<abonelik id>","t":"TUR","p":"..."}. Yani
 * var olan ürünün 399 TL kademesi YENİ ürüne geçmez; her ürünün kendi
 * kademesi kendi ucundan okunmalı. Bunu kontrol etmeseydim yeni ürüne
 * başka bir ürünün fiyat kimliğini göndermiş olurdum.
 */
async function abonelikYaz() {
  const yol = 'scripts/asc-abonelik.json';
  if (!fs.existsSync(yol)) {
    console.error(`HATA: ${yol} yok. Ürün tanımı olmadan yazma yapılmaz.`);
    process.exit(1);
  }
  const tanim = JSON.parse(fs.readFileSync(yol, 'utf8'));
  const grupId = tanim.grupId;
  if (!grupId) { console.error('HATA: grupId yok.'); process.exit(1); }

  // Canlıdaki grubu DOĞRULA. Dosyadaki id eskimişse yanlış gruba ürün
  // eklemek, silinemeyen bir ürünü yanlış yere koymak demek.
  const gruplar = await api(`/apps/${APP_ID}/subscriptionGroups?limit=50`);
  const grup = (gruplar?.data || []).find((g) => g.id === grupId);
  if (!grup) {
    console.error(`HATA: grup ${grupId} bu uygulamada yok. Canlıdaki gruplar:`);
    for (const g of gruplar?.data || []) console.error(`  ${g.id} = ${g.attributes?.referenceName}`);
    process.exit(1);
  }
  console.log(`Grup doğrulandı: ${grupId} = "${grup.attributes?.referenceName}"`);

  // ── GRUBUN YERELLEŞTİRMESİ ────────────────────────────────────────────────
  // 19.09.2026'da BULUNDU VE BU BİR HAFTALIK ENGELİN SEBEBİYDİ.
  //
  // referenceName yalnız İÇERİDE görünen bir etikettir; müşteriye görünen ad
  // AYRI bir nesnededir: subscriptionGroupLocalizations. O nesne hiç
  // oluşturulmamıştı ve grubun adı HİÇBİR DİLDE yoktu. Grup adsızken
  // gruptaki her ürün MISSING_METADATA'da takılı kalıyor.
  //
  // Denetim bunu neden görmedi: ürünün dört alanını (fiyat, yerelleştirme,
  // inceleme notu, inceleme görseli) tek tek ölçüyordu ama GRUBUN KENDİSİNE
  // hiç bakmıyordu. Dördü de ✓ göründüğü için eksik "API'nin dışında" sanıldı
  // ve ürün sahibine günlerce yanlış sebep (Paid Apps sözleşmesi) söylendi.
  {
    const mevcutYerel = (await api(`/subscriptionGroups/${grupId}/subscriptionGroupLocalizations`))?.data || [];
    const istenen = tanim.grupYerel || { locale: 'tr', name: 'Vekil Pro', customAppName: 'Vekil Pro' };
    const ayni = mevcutYerel.find((l) => l.attributes?.locale === istenen.locale);
    if (ayni) {
      console.log(`  ✓ grup yerelleştirmesi zaten var (${istenen.locale}): "${ayni.attributes?.name}"`);
    } else {
      console.log(`  grup yerelleştirmesi YOK → POST /subscriptionGroupLocalizations (${istenen.locale})`);

      // ŞEMAYI APPLE'A SÖYLETİYORUZ — 19.09.2026.
      // İlk deneme 422 ENTITY_UNPROCESSABLE ile düştü ve Apple HANGİ alanın
      // sorunlu olduğunu söylemedi ("Unexpected error"). Alan adı tahmin
      // etmek yerine, BOŞ attributes ile bir sonda atılıyor: Apple o zaman
      // ENTITY_ERROR.ATTRIBUTE.REQUIRED ile zorunlu alanları TEK TEK sayıyor.
      // Bu numara bu depoda abonelik ürünleri kurulurken zaten işe yaramıştı.
      // Sonda yazma DEĞİL: boş gövde hiçbir zaman kabul edilmez.
      const gonder = async (attrs) => api('/subscriptionGroupLocalizations', {
        method: 'POST',
        body: {
          data: {
            type: 'subscriptionGroupLocalizations',
            attributes: attrs,
            relationships: {
              subscriptionGroup: { data: { type: 'subscriptionGroups', id: grupId } },
            },
          },
        },
      });

      let c = null;
      try {
        c = await gonder({
          locale: istenen.locale,
          name: istenen.name,
          customAppName: istenen.customAppName,
        });
      } catch (e1) {
        console.log(`  ✗ tam gövde reddedildi: ${String(e1.message).split('\n')[0]}`);

        // SONDA 1: boş attributes → zorunlu alanların listesi.
        try {
          await gonder({});
          console.log('  (!) boş gövde KABUL EDİLDİ — beklenmedik, şema varsayımı yanlış.');
        } catch (e2) {
          console.log('  Apple\'ın zorunlu alan listesi (boş gövde sondası):');
          for (const satir of String(e2.message).split('\n')) {
            if (satir.trim()) console.log(`    ${satir.trim()}`);
          }
        }

        // SONDA 2: customAppName olmadan. Apple bu alanı bazı durumlarda
        // reddediyor (uygulama adıyla çakışma). Zorunlu olan yalnız
        // name + locale ise bu geçer.
        try {
          c = await gonder({ locale: istenen.locale, name: istenen.name });
          console.log('  ✓ customAppName OLMADAN kabul edildi — o alan sorunluymuş.');
        } catch (e3) {
          console.log(`  ✗ customAppName'siz de reddedildi: ${String(e3.message).split('\n')[0]}`);
          throw e1;
        }
      }
      console.log(`  ✓ grup adı yazıldı: ${c?.data?.id}`);
      // KABUL EDİLDİ ≠ YAZILDI. Geri okumadan "oldu" denmez — bu depoda
      // contentRightsDeclaration tam olarak böyle yanıltmıştı (2xx döndü,
      // alan null kaldı).
      const geri = (await api(`/subscriptionGroups/${grupId}/subscriptionGroupLocalizations`))?.data || [];
      const dogrula = geri.find((l) => l.attributes?.locale === istenen.locale);
      console.log(dogrula?.attributes?.name
        ? `  ✓ geri okundu: "${dogrula.attributes.name}"`
        : '  ✗ GERİ OKUNAMADI — yazıldığı doğrulanamadı (!)');
    }
  }

  const mevcut = (await api(`/subscriptionGroups/${grupId}/subscriptions`))?.data || [];
  console.log(`Gruptaki mevcut ürünler: ${mevcut.map((s) => s.attributes?.productId).join(', ') || '(yok)'}`);

  // BİR ÜRÜNÜN HATASI DİĞERİNİ ENGELLEMESİN — 18.09.2026, koşu #16 dersi.
  // İlk sürümde fiyat POST'u 409 verince betik komple düştü ve SIRADAKİ
  // ürünün yerelleştirmesi hiç yazılmadı. Oysa o yerelleştirme, var olan
  // ürünün MISSING_METADATA olmasının ÖLÇÜLEN sebebiydi — yani en çok
  // ihtiyaç duyulan adım, en az önemli adımın hatası yüzünden atlandı.
  // ÜLKE LİSTESİNİ VAR OLAN ÜRÜNDEN KOPYALA — uydurma.
  //
  // İlk sürüm yeni ürünü YALNIZ Türkiye'ye açıyordu. Bu, 175 ülkede
  // satılan AI ürünüyle tutarsız olurdu: aynı grupta biri dünyaya açık,
  // diğeri tek ülkeye kapalı. Grup içi yükseltme/düşürme böyle bir
  // eşitsizlikte beklendiği gibi çalışmaz.
  // Doğrusu, canlıda ne varsa onu kopyalamak. Okunamazsa TUR'a düşülür
  // ve bu AÇIKÇA yazılır — sessizce daraltmak en kötüsü olurdu.
  let ulkeler = ['TUR'];
  for (const s of mevcut) {
    try {
      const a = await api(`/subscriptions/${s.id}/subscriptionAvailability`);
      if (!a?.data) continue;
      const ulk = await api(`/subscriptionAvailabilities/${a.data.id}/availableTerritories?limit=200`);
      const liste = (ulk?.data || []).map((t) => t.id);
      if (liste.length) {
        ulkeler = liste;
        console.log(`Ülke listesi ${s.attributes?.productId} ürününden kopyalandı: ${liste.length} ülke`);
        break;
      }
    } catch { /* sıradaki ürünü dene */ }
  }
  if (ulkeler.length === 1) console.log('UYARI: ülke listesi okunamadı, yalnız TUR kullanılacak.');

  const hatalar = [];
  for (const u of tanim.urunler || []) {
    try {
      await urunKur(u, grupId, mevcut, ulkeler);
    } catch (e) {
      console.log(`\n  ✗ ${u.productId} yarıda kaldı: ${String(e.message).split('\n')[0]}`);
      hatalar.push(`${u.productId}: ${String(e.message).split('\n').slice(0, 3).join(' | ')}`);
    }
  }

  console.log('\n═══ YAZIM SONRASI CANLI DURUM ═══');
  await abonelikOku();

  if (hatalar.length) {
    console.log('\n═══ TAMAMLANMAYANLAR ═══');
    for (const h of hatalar) console.log(`  ${h}`);
  }
}

async function urunKur(u, grupId, mevcut, ulkeler) {
  {
    console.log(`\n═══ ${u.productId} ═══`);

    // 1) ÜRÜN
    let urun = mevcut.find((s) => s.attributes?.productId === u.productId);
    if (urun) {
      console.log(`  ürün zaten var (${urun.id}) — OLUŞTURULMADI`);
    } else {
      console.log('  ürün yok → POST /subscriptions');
      const c = await api('/subscriptions', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'subscriptions',
            attributes: {
              name: u.name,
              productId: u.productId,
              subscriptionPeriod: u.subscriptionPeriod,
              familySharable: u.familySharable,
              groupLevel: u.groupLevel,
            },
            relationships: { group: { data: { type: 'subscriptionGroups', id: grupId } } },
          },
        }),
      });
      urun = c.data;
      console.log(`  ✓ oluşturuldu: ${urun.id}  state=${urun.attributes?.state}`);
    }

    // 2) YERELLEŞTİRME — MISSING_METADATA'nın ölçülen sebebi.
    const yereller = (await api(`/subscriptions/${urun.id}/subscriptionLocalizations`))?.data || [];
    const varOlan = yereller.find((y) => y.attributes?.locale === u.yerel.locale);
    if (varOlan) {
      console.log(`  yerelleştirme (${u.yerel.locale}) zaten var — dokunulmadı`);
    } else {
      console.log(`  yerelleştirme yok → POST /subscriptionLocalizations (${u.yerel.locale})`);
      const c = await api('/subscriptionLocalizations', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'subscriptionLocalizations',
            attributes: { locale: u.yerel.locale, name: u.yerel.name, description: u.yerel.description },
            relationships: { subscription: { data: { type: 'subscriptions', id: urun.id } } },
          },
        }),
      });
      console.log(`  ✓ yerelleştirme: ${c.data.id}`);
    }

    // 3) SATIŞA AÇIKLIK (availability) — 18.09.2026'da eklenen hipotez.
    //
    // NEDEN. Yeni ürüne Türkiye fiyatı kurma denemesi DÖRT ayrı gövdeyle de
    // "An error occurred while processing the pricing information" aldı.
    // İlk hipotezim (Paid Apps imzasız) kendi ölçümümle çürüdü: var olan
    // AI ürününün 175 ülkede fiyatı DURUYOR.
    //
    // Yeni hipotez: bir ürüne bir ÜLKENİN fiyatı, o ürün o ülkede SATIŞA
    // AÇIK değilse kurulamıyor. AI ürününün açıklığı arayüzden kurulmuş
    // (175 ülke), yeni ürünün hiç yok. "Türkiye fiyatı" ile "Türkiye'de
    // satılıyor" ayrı iki nesne ve ikincisi önce gelmeli.
    //
    // DOĞRULANMADI — aşağıdaki okuma bunu söyleyecek. Hipotez yanlışsa
    // çıktı da öyle diyecek; iddia etmiyorum, ölçüyorum.
    // Açıklık yazmadan ÖNCE fiyat sayısını öğren: aşağıdaki koruma buna
    // dayanıyor (fiyatı olan ürünün satış alanı da vardır).
    let fiyatSayisi = null;
    try {
      fiyatSayisi = ((await api(`/subscriptions/${urun.id}/prices?limit=200`))?.data || []).length;
    } catch { fiyatSayisi = null; }

    let acikMi = null;
    try {
      const a = await api(`/subscriptions/${urun.id}/subscriptionAvailability`);
      acikMi = a?.data || null;
      if (acikMi) {
        console.log(`  satışa açıklık: VAR (${acikMi.id}) availableInNewTerritories=${acikMi.attributes?.availableInNewTerritories}`);
        const ulk = await api(`/subscriptionAvailabilities/${acikMi.id}/availableTerritories?limit=200`);
        const liste = (ulk?.data || []).map((t) => t.id);
        console.log(`    ${liste.length} ülke · Türkiye ${liste.includes('TUR') ? 'İÇİNDE' : 'YOK'}`);
      } else {
        console.log('  satışa açıklık: uç cevap verdi ama data boş');
      }
    } catch (e) {
      console.log(`  satışa açıklık YOK — ${String(e.message).split('\n')[0]}`);
    }

    // 404'Ü "YOK" DİYE OKUMA — 18.09.2026, koşu #20'de canlıda hasar verdi.
    //
    // O koşuda AI ürününün availability ucu 404 döndü. Betik "yok demek ki"
    // deyip YENİ bir açıklık kurdu, içinde YALNIZ TÜRKİYE — çünkü ülke
    // listesini kopyalama denemesi de aynı 404'e takılıp sessizce TUR'a
    // düşmüştü. Oysa o ürünün 175 ÜLKEDE FİYATI vardı; yani bir yerde
    // satışa açıklığı olmalıydı ve 404 "yok" demek değildi.
    //
    // KURAL: bir nesnenin YOKLUĞUNU tek bir 404'ten çıkarma, hele o
    // çıkarımla YAZACAKSAN. Aynı nesneye dair başka bir ölçüm (burada:
    // 175 ülkelik fiyat listesi) tersini söylüyorsa, yazma DUR.
    if (!acikMi && (fiyatSayisi ?? 0) > 1) {
      console.log(`  ⚠ satışa açıklık okunamadı AMA ürünün ${fiyatSayisi} fiyat kaydı var.`);
      console.log('    Çelişki: fiyatı olan ürünün satış alanı da olmalı. YAZILMIYOR —');
      console.log('    daraltma riski var. Ülke listesi elle doğrulanmalı.');
    } else if (!acikMi) {
      console.log('  → satışa açıklık kuruluyor (POST /subscriptionAvailabilities)');
      try {
        const c = await api('/subscriptionAvailabilities', {
          method: 'POST',
          body: JSON.stringify({
            data: {
              type: 'subscriptionAvailabilities',
              attributes: { availableInNewTerritories: true },
              relationships: {
                subscription: { data: { type: 'subscriptions', id: urun.id } },
                availableTerritories: { data: ulkeler.map((t) => ({ type: 'territories', id: t })) },
              },
            },
          }),
        });
        console.log(`  ✓ satışa açıklık kuruldu: ${c.data.id}`);
      } catch (e) {
        for (const satir of String(e.message).split('\n')) console.log(`    ${satir}`);
      }
    }

    // 3d) İNCELEME NOTU VE GÖRSELİ — MISSING_METADATA'nın kalan sebebi.
    //
    // 18.09.2026: fiyat ve Türkçe metin tamamlandıktan sonra bile iki
    // abonelik de MISSING_METADATA kaldı. Apple abonelik için AYRICA
    // inceleme notu ve satın alma ekranının GÖRSELİNİ istiyor.
    // Görsel hazır: magaza-pazarlama/inceleme/premium.png — bugün ücretsiz
    // kullanıcıyla yeniden çekildi ki inceleyen planları ve fiyatı görsün.
    if (!urun.attributes?.reviewNote && u.incelemeNotu) {
      try {
        await api(`/subscriptions/${urun.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            data: { type: 'subscriptions', id: urun.id, attributes: { reviewNote: u.incelemeNotu } },
          }),
        });
        console.log('  ✓ inceleme notu yazıldı');
      } catch (e) {
        for (const s of String(e.message).split('\n')) console.log(`    ${s}`);
      }
    } else if (urun.attributes?.reviewNote) {
      console.log('  inceleme notu zaten var');
    }

    const gorselYolu = 'magaza-pazarlama/inceleme/premium.png';
    let mevcutGorsel = null;
    try { mevcutGorsel = (await api(`/subscriptions/${urun.id}/appStoreReviewScreenshot`))?.data || null; } catch { /* yok */ }

    // BAŞARISIZ GÖRSELİ SİL — 18.09.2026'da ölçüldü.
    //
    // İlk yükleme "başarılı" göründü ama Apple'ın kendi durumu FAILED
    // yazıyordu: görsel 1079×2797'ydi, oysa Apple inceleme görselinde
    // GERÇEK CİHAZ BOYUTU istiyor (6.7 inç için 1290×2796).
    // Yükleme adımlarının hepsi 2xx döndüğü için "oldu" sanmıştım;
    // ASIL ÖLÇÜM `assetDeliveryState.state` alanıymış.
    //
    // Ders: bir yüklemenin kabul edildiğini HTTP durumundan değil,
    // nesnenin kendi durum alanından öğren.
    const durum = mevcutGorsel?.attributes?.assetDeliveryState?.state;
    if (mevcutGorsel && durum !== 'COMPLETE') {
      console.log(`  inceleme görseli durumu ${durum} → siliniyor`);
      try {
        await api(`/subscriptionAppStoreReviewScreenshots/${mevcutGorsel.id}`, { method: 'DELETE' });
        mevcutGorsel = null;
      } catch (e) {
        console.log(`    silinemedi: ${String(e.message).split('\n')[1] || e.message}`);
      }
    }

    if (mevcutGorsel) {
      console.log('  inceleme görseli zaten var (COMPLETE)');
    } else if (!fs.existsSync(gorselYolu)) {
      console.log(`  ✗ inceleme görseli bulunamadı: ${gorselYolu}`);
    } else {
      const icerik = fs.readFileSync(gorselYolu);
      try {
        const rez = await api('/subscriptionAppStoreReviewScreenshots', {
          method: 'POST',
          body: JSON.stringify({
            data: {
              type: 'subscriptionAppStoreReviewScreenshots',
              attributes: { fileName: 'premium.png', fileSize: icerik.length },
              relationships: { subscription: { data: { type: 'subscriptions', id: urun.id } } },
            },
          }),
        });
        for (const op of rez.data.attributes?.uploadOperations || []) {
          const basliklar = {};
          for (const h of op.requestHeaders || []) basliklar[h.name] = h.value;
          const c = await fetch(op.url, { method: op.method, headers: basliklar, body: icerik.subarray(op.offset, op.offset + op.length) });
          if (!c.ok) throw new Error(`yükleme ${c.status}`);
        }
        // Özet DOSYADAN hesaplanıyor; yanlış özet görseli sessizce reddettirir.
        const ozet = crypto.createHash('md5').update(icerik).digest('hex');
        await api(`/subscriptionAppStoreReviewScreenshots/${rez.data.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            data: { type: 'subscriptionAppStoreReviewScreenshots', id: rez.data.id, attributes: { uploaded: true, sourceFileChecksum: ozet } },
          }),
        });
        // "Yüklendi" DEMEDEN ÖNCE APPLE'A SOR. Bugün bir kez HTTP 2xx'i
        // başarı sandım ve Apple'ın durumu FAILED'dı.
        const son = await api(`/subscriptionAppStoreReviewScreenshots/${rez.data.id}`);
        const d = son?.data?.attributes?.assetDeliveryState?.state;
        if (d === 'COMPLETE') console.log('  ✓ inceleme görseli yüklendi (COMPLETE)');
        else console.log(`  ✗ inceleme görseli durumu: ${d} — ${JSON.stringify(son?.data?.attributes?.assetDeliveryState?.errors || [])}`);
      } catch (e) {
        for (const s of String(e.message).split('\n').slice(0, 4)) console.log(`    ${s}`);
      }
    }

    // 4) FİYAT
    const fiyatlar = (await api(`/subscriptions/${urun.id}/prices`))?.data || [];
    const turFiyat = await turkiyeFiyatiniOku(urun.id);
    if (turFiyat !== null && turFiyat === u.fiyatTL) {
      console.log(`  Türkiye fiyatı zaten ${turFiyat} TL — DOKUNULMADI`);
    } else {
      if (turFiyat !== null) {
        // ÜRÜN SAHİBİ KARARI 18.09.2026: "2 paketimiz var ... 399 ve 2999".
        // Yani yanlış kademede duran fiyat DÜZELTİLECEK. Abone yok, o
        // yüzden preserveCurrentPrice gerekmiyor — ama varyant merdiveninde
        // yine de deneniyor.
        console.log(`  Türkiye fiyatı ${turFiyat} TL ama ${u.fiyatTL} olmalı → DÜZELTİLECEK`);
      }
      console.log(`  ${u.fiyatTL} TL kademesi aranıyor (mevcut ${fiyatlar.length} kayıt)`);
      let sayfaYolu = `/subscriptions/${urun.id}/pricePoints?filter[territory]=TUR&limit=200`;
      let nokta = null;
      let sayfa = 0;
      while (sayfaYolu && !nokta && sayfa < 20) {
        const s = await api(sayfaYolu);
        nokta = (s?.data || []).find((p) => Number(p.attributes?.customerPrice) === u.fiyatTL) || null;
        sayfa += 1;
        const sonraki = s?.links?.next;
        sayfaYolu = sonraki ? sonraki.replace(/^https:\/\/api\.appstoreconnect\.apple\.com\/v1/, '') : null;
      }
      if (!nokta) {
        console.log(`  ✗ ${u.fiyatTL} TL kademesi bulunamadı (${sayfa} sayfa tarandı). Fiyat ATLANDI.`);
      } else {
        console.log(`  kademe bulundu: ${nokta.id}`);
        await fiyatKur(urun.id, nokta.id);
      }
    }
  }
}

/**
 * Bir ürünün BUGÜNKÜ Türkiye fiyatını oku (yoksa null).
 *
 * Her `prices` kaydının `territory` ve `subscriptionPricePoint`
 * ilişkileri BİRLİKTE çözülüyor. Tek başına `included` havuzundan nokta
 * seçmek 18.09.2026'da yanlış sayı ürettiydi — kaydın kendi ilişkisine
 * bakılmadan seçilen nokta o kaydın noktası değildir.
 */
async function turkiyeFiyatiniOku(abonelikId) {
  try {
    const f = await api(`/subscriptions/${abonelikId}/prices?include=subscriptionPricePoint,territory&limit=200`);
    const dahil = new Map((f?.included || []).map((d) => [`${d.type}:${d.id}`, d]));
    for (const k of f?.data || []) {
      if (k.relationships?.territory?.data?.id !== 'TUR') continue;
      const nId = k.relationships?.subscriptionPricePoint?.data?.id;
      const n = nId ? dahil.get(`subscriptionPricePoints:${nId}`) : null;
      const tl = Number(n?.attributes?.customerPrice);
      return Number.isFinite(tl) ? tl : null;
    }
  } catch { /* okunamadıysa yokmuş gibi davran; yazma adımı zaten hata basar */ }
  return null;
}

/**
 * FİYAT KUR — VARYANTLARI SIRAYLA DENE.
 *
 * KOŞU #16'DA DÜŞTÜ. Gövde yalnız iki ilişki taşıyordu (Apple'ın boş-POST
 * sınamasında ZORUNLU dediği tam olarak bu ikisiydi) ve Apple şunu döndü:
 *   409 ENTITY_ERROR.RELATIONSHIP.INVALID
 *   "An error occurred while processing the pricing information."
 *
 * Bu metin hangi alanın eksik olduğunu SÖYLEMİYOR — zorunluluk sınaması
 * sadece "olmazsa olmaz"ları sayıyor, "kabul edilmek için gereken"leri
 * değil. İkisi aynı şey değilmiş; bu ders burada öğrenildi.
 *
 * Bu yüzden tek gövde yerine bir merdiven deneniyor ve HER BİRİNİN cevabı
 * basılıyor. Reddedilen POST hiçbir şey oluşturmaz, yani merdiven güvenli.
 *
 * MUHTEMEL AMA ÖLÇÜLMEMİŞ BİR SEBEP DAHA VAR: Paid Apps (Uygulama İçi
 * Satın Alma) sözleşmesi imzalanmadan Apple fiyat işlemeyi reddediyor
 * olabilir. Bunu API'den okuyamıyorum, yani DOĞRULANMADI — merdiven
 * hepsinde düşerse en güçlü aday bu, ama iddia değil hipotez.
 */
async function fiyatKur(abonelikId, noktaId) {
  const varyantlar = [
    ['yalnız ilişkiler', {}],
    ['startDate: null', { startDate: null }],
    ['preserveCurrentPrice: true', { preserveCurrentPrice: true }],
    ['startDate: null + preserveCurrentPrice: false', { startDate: null, preserveCurrentPrice: false }],
  ];
  for (const [ad, nitelikler] of varyantlar) {
    console.log(`  fiyat denemesi — ${ad}`);
    try {
      await api('/subscriptionPrices', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'subscriptionPrices',
            attributes: nitelikler,
            relationships: {
              subscription: { data: { type: 'subscriptions', id: abonelikId } },
              subscriptionPricePoint: { data: { type: 'subscriptionPricePoints', id: noktaId } },
            },
          },
        }),
      });
      console.log(`  ✓ KABUL EDİLDİ — çalışan gövde: ${ad}`);
      return true;
    } catch (e) {
      for (const satir of String(e.message).split('\n').slice(1)) console.log(`     ${satir}`);
    }
  }
  console.log('  ✗ dört gövdenin dördü de reddedildi. Fiyat KURULMADI.');
  console.log('    En güçlü aday (DOĞRULANMADI): Paid Apps sözleşmesi imzalı değil.');
  return false;
}

/**
 * KALAN ASC ALANLARINI YAZ — yaş sınırından AYRI üç beyan.
 *
 * ÜRÜN SAHİBİ ONAYI: 18.09.2026, "önerdiğin gibi yap" (yaş sınırı
 * taslağıyla birlikte) ve "sen yap her şeyi bitir".
 * Cevaplar ve gerekçeleri scripts/asc-yas-siniri-taslak.md'de:
 *
 *   usesIdfa=false               uygulamada reklam ve izleme yok
 *   copyright="2026 Vekil Pro"   ürün sahibi isterse ticari unvanla değişir
 *   contentRightsDeclaration     mahkeme kararları ve kanun metinleri
 *                                üçüncü taraf içeriktir; kamuya açık resmî
 *                                belge olmaları bunu değiştirmez
 *
 * ALAN DEĞERLERİ EZBERLENMİYOR. contentRightsDeclaration bir enum ve
 * doğru değeri bilmiyorum; önce YANLIŞ bir değer gönderilip Apple'ın
 * kabul ettiği listeyi söylemesi sağlanıyor. Reddedilen PATCH hiçbir
 * şeyi değiştirmez — bu numara yaş sınırında şemayı öğretmişti.
 */
async function alanlarYaz() {
  const surumler = await api(`/apps/${APP_ID}/appStoreVersions?limit=5`);
  const surum = (surumler?.data || []).find((s) => s.attributes?.appStoreState === 'PREPARE_FOR_SUBMISSION')
    || (surumler?.data || [])[0];
  if (!surum) { console.error('HATA: yazılacak sürüm bulunamadı.'); process.exit(1); }
  console.log(`Sürüm ${surum.id} — ${surum.attributes?.versionString} (${surum.attributes?.appStoreState})`);
  console.log(`  bugünkü usesIdfa=${JSON.stringify(surum.attributes?.usesIdfa)} copyright=${JSON.stringify(surum.attributes?.copyright)}`);

  // 1) SÜRÜM ALANLARI
  try {
    const c = await api(`/appStoreVersions/${surum.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        data: {
          type: 'appStoreVersions', id: surum.id,
          attributes: { usesIdfa: false, copyright: '2026 Vekil Pro' },
        },
      }),
    });
    console.log(`  ✓ usesIdfa=${c?.data?.attributes?.usesIdfa} copyright=${JSON.stringify(c?.data?.attributes?.copyright)}`);
  } catch (e) {
    for (const s of String(e.message).split('\n')) console.log(`  ${s}`);
  }

  // 2) İÇERİK HAKLARI — enum değeri ölçülerek bulunuyor.
  const app = await api(`/apps/${APP_ID}`);
  console.log(`\ncontentRightsDeclaration bugün: ${JSON.stringify(app?.data?.attributes?.contentRightsDeclaration)}`);

  const adaylar = [
    'USES_THIRD_PARTY_CONTENT',
    'CONTAINS_THIRD_PARTY_CONTENT',
    'DOES_NOT_USE_THIRD_PARTY_CONTENT',
  ];
  for (const deger of adaylar) {
    // "Üçüncü taraf içerik İÇERİYOR" cevabını veren ilk aday kabul edilince
    // durulur. Son aday ("içermiyor") listede YALNIZ Apple'ın enum'unu
    // öğrenmek için var; ona sıra gelirse bir öncekiler reddedilmiş demektir
    // ve o zaman da GÖNDERİLMEZ — yanlış beyan olurdu.
    if (deger === 'DOES_NOT_USE_THIRD_PARTY_CONTENT') {
      console.log('  → doğru enum bulunamadı. "içermiyor" GÖNDERİLMEDİ (yanlış beyan olurdu).');
      break;
    }
    console.log(`  deneme: ${deger}`);
    try {
      const c = await api(`/apps/${APP_ID}`, {
        method: 'PATCH',
        body: JSON.stringify({ data: { type: 'apps', id: APP_ID, attributes: { contentRightsDeclaration: deger } } }),
      });
      console.log(`  ✓ KABUL: ${c?.data?.attributes?.contentRightsDeclaration}`);
      break;
    } catch (e) {
      for (const s of String(e.message).split('\n').slice(1)) console.log(`    ${s}`);
    }
  }

  // 3) APP PRIVACY (veri etiketi) — API'den yazılabiliyor mu ÖLÇ.
  // Bilmiyorum; Apple bu beyanı uzun süre yalnız arayüzde tuttu. Boş POST
  // ile sınanıyor, hiçbir şey oluşturmaz.
  console.log('\n── App Privacy uçları sınanıyor (HİÇBİR ŞEY OLUŞTURMAZ) ─────');
  for (const tip of ['appDataUsages', 'appDataUsagePublishStates', 'appDataUsagesPublishState']) {
    try {
      await api(`/${tip}`, { method: 'POST', body: JSON.stringify({ data: { type: tip, attributes: {}, relationships: {} } }) });
      console.log(`  /${tip}: BEKLENMEDİK — boş POST kabul edildi`);
    } catch (e) {
      const m = String(e.message);
      const ilk = m.split('\n')[1] || m.split('\n')[0];
      console.log(`  /${tip}: ${ilk.trim().slice(0, 150)}`);
    }
  }

  console.log('\n═══ YAZIM SONRASI ═══');
  await oku();

  // ÖZET EN SONA — 18.09.2026, koşu #25'te öğrenildi.
  // GitHub'ın iş kaydı API'si yalnız son ~130 satırı veriyor. `oku()` çıktısı
  // uzun ve alanlar alfabetik; `contentRightsDeclaration` listenin başında
  // olduğu için tam da doğrulamak istediğim satır kesiliyordu. Yani rapor
  // üretildi ama raporun tek önemli satırı okunamadı.
  // Ders: uzun çıktının SONUNDA, ölçmek istediğin şeyi tek satır tekrarla.
  const son = await api(`/apps/${APP_ID}`);
  const sonSurum = await api(`/appStoreVersions/${surum.id}`);
  console.log('\n═══ ÖZET (doğrulama) ═══');
  console.log(`  contentRightsDeclaration = ${JSON.stringify(son?.data?.attributes?.contentRightsDeclaration)}`);
  console.log(`  usesIdfa                 = ${JSON.stringify(sonSurum?.data?.attributes?.usesIdfa)}`);
  console.log(`  copyright                = ${JSON.stringify(sonSurum?.data?.attributes?.copyright)}`);
}

/**
 * İNCELEMEYE GÖNDER — Apple'a sürümü sun.
 *
 * ÜRÜN SAHİBİ: 18.09.2026, "abi artık sal şu programı ya".
 *
 * NEDEN BU MOD VAR. Bütün oturum boyunca ona "Paid Apps sözleşmesi
 * olmadan incelemeye giremezsin" dedim — ama BUNU HİÇ DENEMEDİM.
 * Ekranda gördüğü bir uyarıyı kendi iddiama çevirdim. Bu, bu oturumda
 * defalarca yaptığım hatanın aynısı: ölçmeden söylemek.
 *
 * Doğrusu: göndermeyi DENE. Apple reddederse hata metni GERÇEK eksik
 * listesidir; benim tahminim değil. Reddedilen bir istek hiçbir şeyi
 * değiştirmez — aynı numara yaş sınırında ve aboneliklerde şemayı
 * öğretmişti.
 *
 * ÜÇ ADIM (Apple'ın inceleme akışı):
 *   1. POST /reviewSubmissions          — boş bir gönderim kabı aç
 *   2. POST /reviewSubmissionItems      — içine sürümü koy
 *   3. PATCH /reviewSubmissions/{id}    — submitted: true ile mühürle
 *
 * GERİ ALINABİLİR. Gönderim App Store Connect'ten iptal edilebilir
 * (state CANCELING). Yani bu, silinemeyen bir ürün kimliği gibi
 * kalıcı bir adım DEĞİL.
 */
/**
 * SÜRÜM NEDEN İNCELEMEYE ALINMIYOR — eksikleri TEK TEK oku.
 *
 * NEDEN VAR (18.09.2026). Gönderim denendi ve Apple şunu dedi:
 *   409 STATE_ERROR "not in valid state ... check associated errors"
 * Yani "eksik var" diyor ama neyin eksik olduğunu SÖYLEMİYOR.
 *
 * Buradaki her satır, App Store'un yayın için zorunlu tuttuğu bir
 * parçayı ayrı ayrı ölçüyor. Tahmin listesi değil: her biri canlı
 * uçtan okunuyor ve boşsa "YOK" yazıyor.
 */
async function surumEksikleri(surumId) {
  console.log('\n═══ SÜRÜMÜN EKSİKLERİ (ölçüm) ═══');

  // 1) DERLEME BAĞLI MI. TestFlight'a yüklenmiş olmak YETMEZ — o derlemenin
  //    App Store sürümüne AYRICA bağlanması gerekir. İki ayrı şey.
  let derlemeId = null;
  try {
    const b = await api(`/appStoreVersions/${surumId}/build`);
    derlemeId = b?.data?.id ?? null;
    console.log(`  derleme: ${b?.data ? `${b.data.id} (${b.data.attributes?.version})` : 'YOK (!)'}`);
  } catch (e) {
    console.log(`  derleme: YOK (!) — ${String(e.message).split('\n')[0]}`);
  }

  // 1b) İHRACAT UYUMLULUĞU (export compliance) — 19.09.2026'da eklendi.
  //
  // NEDEN: gönderim denemesi Apple'dan şunu aldı:
  //   409 STATE_ERROR.ENTITY_STATE_INVALID — appStoreVersions ... is not in
  //   valid state. "please check associated errors to see why."
  // Apple o "ilişkili hataları" API'den vermiyor. Bu alan, o hatayı veren en
  // yaygın sebeplerden biri ve BUGÜNE KADAR HİÇ ÖLÇÜLMEMİŞTİ.
  //
  // `usesNonExemptEncryption` null ise App Store Connect derlemeyi "Missing
  // Compliance" sayar ve sürüm incelemeye alınamaz. Bu bir BEYANDIR; burada
  // yalnız OKUNUYOR, yazılmıyor — yanlış beyan hukuki sonuç doğurur ve kararı
  // ürün sahibi verir.
  if (derlemeId) {
    try {
      const d = await api(`/builds/${derlemeId}`);
      const v = d?.data?.attributes?.usesNonExemptEncryption;
      if (v === null || v === undefined) {
        console.log('  ihracat uyumluluğu: BEYAN EDİLMEMİŞ (!) — "Missing Compliance"');
        console.log('    Bu, sürümün incelemeye alınmasını ENGELLER.');
      } else {
        console.log(`  ihracat uyumluluğu: beyan edilmiş (usesNonExemptEncryption=${v})`);
      }
    } catch (e) {
      console.log(`  ihracat uyumluluğu: OKUNAMADI — ${String(e.message).split('\n')[0]}`);
    }
  }

  // 2) METİNLER: açıklama, anahtar kelime, "yenilikler".
  let yereller = [];
  try {
    const y = await api(`/appStoreVersions/${surumId}/appStoreVersionLocalizations`);
    yereller = y?.data || [];
    console.log(`  yerelleştirme: ${yereller.length} dil`);
    for (const l of yereller) {
      const a = l.attributes || {};
      console.log(`    ${a.locale}: açıklama=${a.description ? `${a.description.length} krktr` : 'YOK (!)'} · anahtar=${a.keywords ? 'var' : 'YOK (!)'} · destek=${a.supportUrl ? 'var' : 'YOK (!)'} · yenilikler=${a.whatsNew ? 'var' : '(ilk sürümde gerekmez)'}`);
    }
  } catch (e) {
    console.log(`  yerelleştirme okunamadı: ${String(e.message).split('\n')[0]}`);
  }

  // 3) EKRAN GÖRÜNTÜLERİ — her dil için ayrı küme.
  for (const l of yereller) {
    try {
      const k = await api(`/appStoreVersionLocalizations/${l.id}/appScreenshotSets`);
      const kumeler = k?.data || [];
      if (!kumeler.length) { console.log(`    ${l.attributes?.locale} ekran görüntüsü: HİÇ KÜME YOK (!)`); continue; }
      for (const s of kumeler) {
        const g = await api(`/appScreenshotSets/${s.id}/appScreenshots`);
        console.log(`    ${l.attributes?.locale} ${s.attributes?.screenshotDisplayType}: ${(g?.data || []).length} görsel`);
      }
    } catch (e) {
      console.log(`    ${l.attributes?.locale} ekran görüntüsü okunamadı: ${String(e.message).split('\n')[0]}`);
    }
  }

  // 3b) APP PRIVACY — API'den OKUNABİLİYOR MU?
  //
  // Vitrinin doldurulabilen HER PARÇASI dolduruldu ve doğrulandı, ama
  // Apple hâlâ "not in valid state" diyor. Geriye API'nin açmadığını
  // ölçtüğüm tek alan kaldı: veri etiketi.
  // Daha önce üç YAZMA ucu denendi (hepsi 404). Şimdi OKUMA uçları
  // deneniyor: biri cevap verirse beyan API'den erişilebilir demektir ve
  // yazılabilir; hepsi 404 verirse bu alan gerçekten yalnız arayüzde.
  // APPLE'A KENDİ ŞEMASINI SÖYLET — 18.09.2026.
  //
  // Uç adlarını TAHMİN ederek dokuz kez 404 aldım. Tahmin, yokluğun
  // kanıtı değildir: yanlış adı denemiş de olabilirim. Doğrusu Apple'a
  // sordurmak — `include=` alanına saçma bir değer verilince Apple hata
  // metninde GEÇERLİ ilişkilerin tamamını sayıyor.
  // Aynı numara bugün yaş sınırında ve aboneliklerde şemayı öğretmişti.
  console.log('  — Apple\'ın kabul ettiği ilişkiler (kendi ağzından):');
  for (const [ad, yol] of [
    ['apps', `/apps/${APP_ID}?include=gecersizIliskiAdi`],
    ['appStoreVersions', `/appStoreVersions/${surumId}?include=gecersizIliskiAdi`],
  ]) {
    try {
      await api(yol);
      console.log(`      ${ad}: BEKLENMEDİK — saçma include kabul edildi`);
    } catch (e) {
      const metin = String(e.message).replace(/\s+/g, ' ');
      console.log(`      ${ad}: ${metin.slice(0, 700)}`);
    }
  }

  console.log('  — App Privacy okuma uçları:');
  for (const yol of [
    `/apps/${APP_ID}/appPrivacyDetails`,
    '/appDataUsageCategories?limit=1',
    '/appDataUsagePurposes?limit=1',
    '/appDataUsageDataProtections?limit=1',
    `/apps/${APP_ID}/appDataUsages?limit=1`,
    `/apps/${APP_ID}/appDataUsagesPublishState`,
  ]) {
    try {
      const c = await api(yol);
      console.log(`      ${yol.replace(APP_ID, '{app}')} → VAR (${(c?.data?.length ?? (c?.data ? 1 : 0))} kayıt)`);
    } catch (e) {
      const m = String(e.message).split('\n')[1] || '';
      console.log(`      ${yol.replace(APP_ID, '{app}')} → ${m.trim().slice(0, 60)}`);
    }
  }

  // 5) appInfo TARAFI — 18.09.2026'da fark edildi, HİÇ ÖLÇÜLMEMİŞTİ.
  //
  // Sürüm alanlarını (açıklama, anahtar kelime, ekran görüntüsü) ölçüp
  // "vitrin doldu" dedim. Ama App Store'da vitrin İKİ nesneye bölünmüş:
  //   appStoreVersion      → sürüme özel: açıklama, anahtar, görseller
  //   appInfo              → uygulamaya özel: KATEGORİ, ad, altbaşlık,
  //                          GİZLİLİK POLİTİKASI ADRESİ
  // İkincisine hiç bakmadım. Kategori ya da gizlilik adresi boşsa Apple
  // sürümü kesinlikle almaz ve hatası yine "not in valid state" olur.
  // Yani "her şeyi doldurdum" dediğim yerde bakmadığım bir yarı vardı.
  try {
    const infos = await api(`/apps/${APP_ID}/appInfos`);
    for (const bilgi of infos?.data || []) {
      for (const [ad, yol] of [
        ['birincil kategori', `/appInfos/${bilgi.id}/primaryCategory`],
        ['ikincil kategori', `/appInfos/${bilgi.id}/secondaryCategory`],
      ]) {
        try {
          const c = await api(yol);
          console.log(`  ${ad}: ${c?.data ? c.data.id : 'YOK (!)'}`);
        } catch (e) {
          console.log(`  ${ad}: YOK (!) — ${String(e.message).split('\n')[0].slice(0, 60)}`);
        }
      }
      try {
        const y = await api(`/appInfos/${bilgi.id}/appInfoLocalizations`);
        for (const l of y?.data || []) {
          const a = l.attributes || {};
          console.log(`  appInfo ${a.locale}: ad=${a.name || 'YOK (!)'} · altbaşlık=${a.subtitle || '(boş, zorunlu değil)'}`);
          console.log(`    gizlilik adresi = ${a.privacyPolicyUrl || 'YOK (!)'}`);
          console.log(`    gizlilik seçenek adresi = ${a.privacyChoicesUrl || '(boş, zorunlu değil)'}`);
        }
      } catch (e) {
        console.log(`  appInfoLocalizations okunamadı: ${String(e.message).split('\n')[0]}`);
      }
    }
  } catch (e) {
    console.log(`  appInfo okunamadı: ${String(e.message).split('\n')[0]}`);
  }

  // 4) İNCELEME BİLGİSİ: Apple'ın ulaşacağı kişi + demo hesap.
  try {
    const d = await api(`/appStoreVersions/${surumId}/appStoreReviewDetail`);
    const a = d?.data?.attributes || {};
    console.log(`  inceleme bilgisi: ${d?.data ? 'var' : 'YOK (!)'}`);
    if (d?.data) {
      console.log(`    kişi=${a.contactFirstName || 'YOK (!)'} ${a.contactLastName || ''} · e-posta=${a.contactEmail || 'YOK (!)'} · telefon=${a.contactPhone || 'YOK (!)'}`);
      console.log(`    demo hesap gerekli mi=${a.demoAccountRequired} · kullanıcı=${a.demoAccountName ? 'var' : 'YOK'}`);
    }
  } catch (e) {
    console.log(`  inceleme bilgisi: YOK (!) — ${String(e.message).split('\n')[0]}`);
  }
}

// GÖNDERİLEBİLİR SÜRÜM DURUMLARI.
//
// 23.09.2026'DA ÖLÇÜLDÜ VE BU LİSTE BU YÜZDEN VAR. Apple 20.09'da
// Guideline 2.1 ile reddetti; cevabı yazdım ama sürüm sıraya girmedi ve
// üç gün öylece durdu. Sebep Apple değildi: reddedilen sürümün durumu
// REJECTED olur, PREPARE_FOR_SUBMISSION'a DÖNMEZ. Bu işlev yalnız
// PREPARE_FOR_SUBMISSION arıyordu, dolayısıyla "gönderilecek sürüm yok"
// deyip çıkıyordu. Yani üç günlük gecikmenin sebebi tek bir eksik durum
// adıydı — ve kimse fark etmedi çünkü çıktı "yok" diyordu, "neden yok"
// demiyordu.
//
// REJECTED            = Apple reddetti, sürüm düzenlenebilir, TEKRAR GÖNDERİLİR.
// DEVELOPER_REJECTED  = biz geri çektik, aynı şekilde tekrar gönderilir.
// PREPARE_FOR_SUBMISSION = hiç gönderilmemiş yeni sürüm.
const GONDERILEBILIR = ['PREPARE_FOR_SUBMISSION', 'REJECTED', 'DEVELOPER_REJECTED'];

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ API'DEN GÖNDERİM 23.09.2026'DA TIKANDI — SONRAKİ OTURUM OKUSUN.      ║
// ╚══════════════════════════════════════════════════════════════════════╝
// Altı koşu harcandı. Apple'ın kendi cevapları (tahmin değil, hepsi kayıtta):
//
//   POST   /reviewSubmissionItems
//     409 appStoreVersions '891482751' is not in valid state.
//         This resource cannot be reviewed.
//   PATCH  /reviewSubmissions { submitted: true }
//     409 App must have an approved appStoreVersions, or an appStoreVersions
//         must be included in this review submission.
//   DELETE /reviewSubmissions/071b176e-...
//     403 The resource 'reviewSubmissions' does not allow 'DELETE'.
//   PATCH  /reviewSubmissions { canceled: true }
//     409 Resource is not in cancellable state
//
// DURUM: sürüm 3.4.0 = REJECTED. 18.09'dan kalma, sürüm İÇERMEYEN bir
// gönderim kabı (071b176e, READY_FOR_REVIEW) duruyor; silinemiyor,
// iptal edilemiyor, içine sürüm konulamıyor. Dört kapı da kapalı.
//
// SÜRÜMDE EKSİK YOK (aynı koşuda ölçüldü): derleme 3 · ihracat uyumluluğu
// beyan edilmiş · tr açıklama 1249 krktr · anahtar kelime var · destek
// adresi var · 12 ekran görüntüsü · kategori · gizlilik adresi · inceleme
// bilgisi + demo hesap. Yani engel eksik alan DEĞİL, sürümün REJECTED
// durumu ile bayat kabın birlikte yarattığı kilit.
//
// ÇALIŞAN YOL: App Store Connect ARAYÜZÜ. Hesap sahibi
// (bayram.gomukpnar@icloud.com) uygulamayı açar → 3.4.0 (Rejected) →
// "Add for Review" → "Submit to App Review". Arayüz bu durumu çözüyor,
// API çözmüyor.
//
// SONRAKİ OTURUM: buradan devam etme. Önce `tam-denetim` koş; sürüm
// PREPARE_FOR_SUBMISSION ya da WAITING_FOR_REVIEW'a geçmişse bu tıkanıklık
// kalkmış demektir. Geçmemişse yeniden API denemek altı koşu daha yakar.

async function incelemeyeGonder() {
  const surumler = await api(`/apps/${APP_ID}/appStoreVersions?limit=5`);
  const surum = (surumler?.data || []).find((s) => GONDERILEBILIR.includes(s.attributes?.appStoreState));
  if (!surum) {
    console.log(`Gönderilebilir sürüm yok (aranan: ${GONDERILEBILIR.join(', ')}). Mevcut durumlar:`);
    for (const s of surumler?.data || []) console.log(`  ${s.attributes?.versionString} = ${s.attributes?.appStoreState}`);
    return;
  }
  console.log(`Sürüm ${surum.attributes?.versionString} (${surum.id}) — ${surum.attributes?.appStoreState}`);

  // EKSİK ÖLÇÜMÜ ÇIKTININ SONUNDA — 18.09.2026 dersi. Başa konduğunda
  // GitHub'ın iş kaydı API'si (son ~130 satır) tam da o listeyi kesiyordu.

  // Açık bir gönderim zaten var mı? İkinci bir tane açmak hataya yol açar.
  let gonderim = null;
  try {
    const acik = await api(`/reviewSubmissions?filter[app]=${APP_ID}&filter[platform]=IOS&filter[state]=READY_FOR_REVIEW,WAITING_FOR_REVIEW,IN_REVIEW,UNRESOLVED_ISSUES`);
    gonderim = (acik?.data || [])[0] || null;
    if (gonderim) {
      console.log(`  Açık gönderim VAR: ${gonderim.id} state=${gonderim.attributes?.state}`);
      // 23.09.2026: PATCH submitted:true "bir appStoreVersion eklenmeli" diye
      // düştü, oysa özet "1 öğe" diyordu. Yani öğenin NE olduğu bilinmiyordu.
      // Sayı değil, İÇERİK bas — sayı teşhis etmiyor.
      // BAYAT KAP TEMİZLİĞİ — 23.09.2026, ölçülerek bulundu.
      //
      // Apple aynı anda İKİ çelişkili şey söylüyordu:
      //   POST  /reviewSubmissionItems → "appStoreVersions ... is not in valid state"
      //   PATCH /reviewSubmissions     → "an appStoreVersions must be included"
      // Yani "sürümü ekleyemezsin" ve "sürümü eklemelisin". Çelişki değil:
      // 18.09'da açılmış, hiç mühürlenmemiş bir gönderim kabı duruyor ve
      // içindeki öğe sürüm DEĞİL. Sürüm o kaba bağlı olduğu için ikinci bir
      // kaba eklenemiyor; kap da sürüm içermediği için mühürlenemiyor.
      //
      // Çözüm: mühürlenmemiş kabı sil, temizini aç. Mühürlenmemiş bir
      // gönderim Apple'a HİÇ ULAŞMAMIŞTIR; silmek inceleme sırasını
      // etkilemez, geri alınamaz bir şey kaybolmaz.
      let surumIceriyorMu = false;
      try {
        const ogeler = await api(`/reviewSubmissions/${gonderim.id}/items?include=appStoreVersion`);
        for (const o of ogeler?.data || []) {
          const v = o.relationships?.appStoreVersion?.data?.id || null;
          if (v) surumIceriyorMu = true;
          console.log(`    öğe state=${o.attributes?.state} appStoreVersion=${v || 'YOK'}`);
        }
        if (!(ogeler?.data || []).length) console.log('    (öğe yok)');
      } catch (e) {
        console.log(`    öğeler okunamadı: ${String(e.message).split('\n')[1] || e.message}`);
      }

      const muhurlu = gonderim.attributes?.submitted === true;
      if (!surumIceriyorMu && !muhurlu) {
        // DELETE DENENDİ VE APPLE REDDETTİ (23.09.2026, kendi ağzından):
        //   403 FORBIDDEN_ERROR: The resource 'reviewSubmissions' does not
        //   allow 'DELETE'. Allowed operations are: CREATE, GET_COLLECTION,
        //   GET_INSTANCE, UPDATE
        // Yani kap silinmiyor, yalnız GÜNCELLENİYOR. İptal etmenin yolu da
        // bu: PATCH { canceled: true }. Tahmin değil — izin verilen işlem
        // listesini Apple'ın kendisi saydı.
        console.log(`  → Kap sürüm içermiyor ve mühürlenmemiş; İPTAL EDİLİYOR: ${gonderim.id}`);
        try {
          const c = await api(`/reviewSubmissions/${gonderim.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              data: { type: 'reviewSubmissions', id: gonderim.id, attributes: { canceled: true } },
            }),
          });
          console.log(`    ✓ iptal edildi — state=${c?.data?.attributes?.state} — temiz kap açılacak`);
          gonderim = null;
        } catch (e) {
          console.log('    ✗ iptal edilemedi — Apple\'ın söylediği:');
          for (const t of String(e.message).split('\n')) console.log(`      ${t}`);
        }
      } else if (surumIceriyorMu) {
        console.log('  → Kap zaten sürümü içeriyor; yeniden eklenmeyecek.');
      }
    }
  } catch (e) {
    console.log(`  açık gönderim sorgusu: ${String(e.message).split('\n')[1] || e.message}`);
  }

  // 1) KAP
  if (!gonderim) {
    console.log('\n1) POST /reviewSubmissions');
    try {
      const c = await api('/reviewSubmissions', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'reviewSubmissions',
            attributes: { platform: 'IOS' },
            relationships: { app: { data: { type: 'apps', id: APP_ID } } },
          },
        }),
      });
      gonderim = c.data;
      console.log(`  ✓ açıldı: ${gonderim.id} state=${gonderim.attributes?.state}`);
    } catch (e) {
      console.log('  ✗ AÇILAMADI — Apple\'ın söylediği:');
      for (const s of String(e.message).split('\n')) console.log(`    ${s}`);
      return;
    }
  }

  // 2) SÜRÜMÜ KABA KOY
  // Kap yeni açıldıysa sürüm kesinlikle yok; eski kap sürümü zaten
  // içeriyorsa ikinci kez POST etmek 409 verir ve çıktıyı kirletir.
  console.log('\n2) POST /reviewSubmissionItems');
  try {
    const c = await api('/reviewSubmissionItems', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'reviewSubmissionItems',
          relationships: {
            reviewSubmission: { data: { type: 'reviewSubmissions', id: gonderim.id } },
            appStoreVersion: { data: { type: 'appStoreVersions', id: surum.id } },
          },
        },
      }),
    });
    console.log(`  ✓ sürüm eklendi: ${c.data.id}`);
  } catch (e) {
    console.log('  Apple\'ın söylediği:');
    for (const s of String(e.message).split('\n')) console.log(`    ${s}`);
  }

  // 3) MÜHÜRLE
  console.log('\n3) PATCH /reviewSubmissions — submitted: true');
  try {
    const c = await api(`/reviewSubmissions/${gonderim.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ data: { type: 'reviewSubmissions', id: gonderim.id, attributes: { submitted: true } } }),
    });
    console.log(`  ✓ GÖNDERİLDİ — state=${c?.data?.attributes?.state}`);
  } catch (e) {
    console.log('  ✗ GÖNDERİLEMEDİ — Apple\'ın söylediği EKSİKLER:');
    for (const s of String(e.message).split('\n')) console.log(`    ${s}`);
  }

  await surumEksikleri(surum.id);

  // ÖZET EN SONDA VE KISA — GitHub iş kaydı API'si yalnız son ~130 satır
  // veriyor ve bugün üç kez tam da okumak istediğim satırı kesti. Kural:
  // uzun çıktının sonunda, ölçtüğün şeyi tek satır tekrarla.
  console.log('\n═══ ÖZET ═══');
  try {
    const son = await api(`/appStoreVersions/${surum.id}`);
    console.log(`  appStoreState = ${JSON.stringify(son?.data?.attributes?.appStoreState)}`);
  } catch { /* yoksay */ }
  try {
    const b = await api(`/appStoreVersions/${surum.id}/build`);
    console.log(`  derleme       = ${b?.data ? b.data.attributes?.version : 'YOK (!)'}`);
  } catch { console.log('  derleme       = YOK (!)'); }
  try {
    const g = await api(`/reviewSubmissions/${gonderim.id}`);
    console.log(`  gönderim      = ${JSON.stringify(g?.data?.attributes?.state)} (submitted=${g?.data?.attributes?.submitted})`);
    const ogeler = await api(`/reviewSubmissions/${gonderim.id}/items`);
    console.log(`  gönderim öğe  = ${(ogeler?.data || []).length} adet`);
  } catch (e) {
    console.log(`  gönderim okunamadı: ${String(e.message).split('\n')[1] || e.message}`);
  }
  // SONUÇ ölçüsü de düzeltildi (23.09.2026): eskiden yalnız
  // PREPARE_FOR_SUBMISSION'a bakıyordu, dolayısıyla REJECTED'da kalmış bir
  // sürüm için "GÖNDERİLDİ" yazardı — yanlış bir başarı raporu.
  const sonDurum = (await api(`/appStoreVersions/${surum.id}`))?.data?.attributes?.appStoreState;
  console.log(`  SONUÇ: ${GONDERILEBILIR.includes(sonDurum) ? `HÂLÂ GÖNDERİLMEDİ (${sonDurum})` : `GÖNDERİLDİ (${sonDurum})`}`);
}

/**
 * APP STORE VİTRİNİNİ DOLDUR — derleme, metin, ekran görüntüleri.
 *
 * NEDEN VAR (18.09.2026). Gönderim denendi, Apple "not in valid state"
 * dedi ve eksikleri ölçtüğümde vitrinin TAMAMEN BOŞ olduğu çıktı:
 *   derleme YOK · açıklama YOK · anahtar kelime YOK · destek adresi YOK
 *   ekran görüntüsü HİÇ YOK · inceleme bilgisi YOK
 *
 * BÜTÜN OTURUM BOYUNCA YANLIŞ ŞEYİ SÖYLEDİM. Ürün sahibine tıkanıklığın
 * "Paid Apps sözleşmesi" olduğunu söyledim; o, ekranda gördüğü bir uyarıydı
 * ve ben ölçmeden kendi iddiama çevirdim. Gerçek tıkanıklık bu listeydi ve
 * neredeyse tamamı API'den doldurulabiliyormuş.
 *
 * TEKRAR KOŞULABİLİR: her adım önce canlıyı okur, dolu olanı atlar.
 */
async function vitrinYaz() {
  const surumler = await api(`/apps/${APP_ID}/appStoreVersions?limit=5`);
  // 23.09.2026: REJECTED sürüm de düzenlenebilir — bkz. GONDERILEBILIR.
  // Burası yalnız PREPARE_FOR_SUBMISSION arıyordu, bu yüzden red sonrası
  // inceleme bilgisi (demo hesap dâhil) hiç yazılamadı.
  const surum = (surumler?.data || []).find((s) => GONDERILEBILIR.includes(s.attributes?.appStoreState));
  if (!surum) { console.error(`Düzenlenebilir sürüm yok (aranan: ${GONDERILEBILIR.join(', ')}).`); process.exit(1); }
  console.log(`Sürüm ${surum.attributes?.versionString} — ${surum.attributes?.appStoreState}`);
  console.log(`Sürüm ${surum.attributes?.versionString} (${surum.id})`);

  // ── 1) DERLEMEYİ BAĞLA ────────────────────────────────────────────────
  // TestFlight'a yüklemek YETMİYOR: derlemenin App Store sürümüne AYRICA
  // bağlanması gerekiyor. Bu iki işlem Apple'da ayrı ve bunu bilmiyordum.
  let derli = null;
  try { derli = (await api(`/appStoreVersions/${surum.id}/build`))?.data || null; } catch { /* yok */ }
  if (derli) {
    console.log(`  derleme zaten bağlı: ${derli.attributes?.version}`);
  } else {
    const derlemeler = await api(`/builds?filter[app]=${APP_ID}&sort=-uploadedDate&limit=10`);
    // İŞLENMESİ BİTMİŞ olanı seç. VALID olmayan derleme bağlanamaz.
    const uygun = (derlemeler?.data || []).find((b) => b.attributes?.processingState === 'VALID');
    if (!uygun) {
      console.log('  ✗ bağlanabilir derleme YOK. Yüklenenlerin durumu:');
      for (const b of derlemeler?.data || []) console.log(`      ${b.attributes?.version} → ${b.attributes?.processingState}`);
    } else {
      console.log(`  derleme bağlanıyor: ${uygun.attributes?.version} (${uygun.id})`);
      try {
        await api(`/appStoreVersions/${surum.id}/relationships/build`, {
          method: 'PATCH',
          body: JSON.stringify({ data: { type: 'builds', id: uygun.id } }),
        });
        console.log('  ✓ derleme bağlandı');
      } catch (e) {
        for (const s of String(e.message).split('\n')) console.log(`    ${s}`);
      }
    }
  }

  // ── 2) METİNLER ───────────────────────────────────────────────────────
  // Metin YAYIN-SIRASI.md'deki onaylı mağaza metninden alınıyor, burada
  // yeniden yazılmıyor — iki yerde iki farklı metin olmasın diye.
  const metin = JSON.parse(fs.readFileSync('scripts/asc-vitrin.json', 'utf8'));
  const yereller = (await api(`/appStoreVersions/${surum.id}/appStoreVersionLocalizations`))?.data || [];
  for (const l of yereller) {
    const a = l.attributes || {};
    if (a.description && a.keywords && a.supportUrl) {
      console.log(`  ${a.locale} metni zaten dolu — dokunulmadı`);
      continue;
    }
    console.log(`  ${a.locale} metni yazılıyor`);
    try {
      const c = await api(`/appStoreVersionLocalizations/${l.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          data: {
            type: 'appStoreVersionLocalizations', id: l.id,
            attributes: {
              description: metin.aciklama,
              keywords: metin.anahtarKelimeler,
              supportUrl: metin.destekAdresi,
              marketingUrl: metin.tanitimAdresi,
              promotionalText: metin.tanitimMetni,
            },
          },
        }),
      });
      const y = c?.data?.attributes || {};
      console.log(`  ✓ açıklama ${y.description?.length} krktr · anahtar "${y.keywords}" · destek ${y.supportUrl}`);
    } catch (e) {
      for (const s of String(e.message).split('\n')) console.log(`    ${s}`);
    }
  }

  // ── 3) EKRAN GÖRÜNTÜLERİ ──────────────────────────────────────────────
  for (const l of yereller) {
    for (const kume of metin.ekranKumeleri) {
      await ekranKumesiYukle(l, kume);
    }
  }

  // ── 3c) appInfo: GİZLİLİK ADRESİ VE KATEGORİ ──────────────────────────
  //
  // 18.09.2026'da ölçüldü: `privacyPolicyUrl` BOŞTU. Hesap açan ve veri
  // toplayan bir uygulamada bu alan ZORUNLU; boşken Apple sürümü almaz ve
  // verdiği hata yine belirsiz "not in valid state" olur.
  //
  // Bu alanı günlerce gözden kaçırdım çünkü vitrini yalnız
  // `appStoreVersion` tarafında aradım. Vitrin iki nesneye bölünmüş ve
  // ikinci yarıya hiç bakmamıştım.
  const appInfolar = (await api(`/apps/${APP_ID}/appInfos`))?.data || [];
  for (const bilgi of appInfolar) {
    // KATEGORİ — yalnız boşsa yazılır. Doluysa ürün sahibinin seçimi
    // olabilir ve üstüne yazmak onun kararını sessizce değiştirmek olur.
    for (const [ad, iliski, deger] of [
      ['primaryCategory', 'primaryCategory', metin.birincilKategori],
      ['secondaryCategory', 'secondaryCategory', metin.ikincilKategori],
    ]) {
      let varMi = null;
      try { varMi = (await api(`/appInfos/${bilgi.id}/${iliski}`))?.data || null; } catch { /* yok */ }
      if (varMi) { console.log(`  ${ad} zaten dolu: ${varMi.id}`); continue; }
      if (!deger) { console.log(`  ${ad} boş bırakıldı (tanım dosyasında yok)`); continue; }
      try {
        await api(`/appInfos/${bilgi.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            data: {
              type: 'appInfos', id: bilgi.id,
              relationships: { [iliski]: { data: { type: 'appCategories', id: deger } } },
            },
          }),
        });
        console.log(`  ✓ ${ad} = ${deger}`);
      } catch (e) {
        for (const s of String(e.message).split('\n')) console.log(`    ${s}`);
      }
    }

    const yerelBilgi = (await api(`/appInfos/${bilgi.id}/appInfoLocalizations`))?.data || [];
    for (const l of yerelBilgi) {
      if (l.attributes?.privacyPolicyUrl) {
        console.log(`  ${l.attributes.locale} gizlilik adresi zaten var`);
        continue;
      }
      try {
        const c = await api(`/appInfoLocalizations/${l.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            data: {
              type: 'appInfoLocalizations', id: l.id,
              attributes: { privacyPolicyUrl: metin.gizlilikAdresi },
            },
          }),
        });
        console.log(`  ✓ ${l.attributes?.locale} gizlilik adresi = ${c?.data?.attributes?.privacyPolicyUrl}`);
      } catch (e) {
        for (const s of String(e.message).split('\n')) console.log(`    ${s}`);
      }
    }
  }

  // ── 4) İNCELEME BİLGİSİ ───────────────────────────────────────────────
  // Apple, inceleme sırasında bir sorun çıkarsa ULAŞACAĞI kişiyi istiyor.
  // Kamuya açık değil; mağaza sayfasında görünmez.
  // Bilgiyi ürün sahibi verdi (18.09.2026) — uydurulmadı.
  const inc = JSON.parse(fs.readFileSync('scripts/asc-inceleme.json', 'utf8'));
  const nitelikler = {
    contactFirstName: inc.contactFirstName,
    contactLastName: inc.contactLastName,
    contactPhone: inc.contactPhone,
    contactEmail: inc.contactEmail,
    demoAccountRequired: inc.demoAccountRequired,
    // 23.09.2026 ÖLÇÜLDÜ: canlıda `demoAccountRequired=false · kullanıcı=YOK`
    // duruyordu. Sebep buydu — bu iki alan hiç yazılmıyordu. Guideline 2.1
    // reddi tam da "uygulamaya nasıl gireceğiz" sorusuydu; hesabı mesaja
    // yazıp forma yazmamak, inceleyeni aynı soruya geri götürür.
    // Apple demoAccountRequired=false iken ad/şifre kabul etmiyor, o yüzden
    // yalnız gerekliyse gönderiliyor.
    ...(inc.demoAccountRequired
      ? { demoAccountName: inc.demoAccountName, demoAccountPassword: inc.demoAccountPassword }
      : {}),
    notes: inc.notes,
  };
  let mevcutInc = null;
  try { mevcutInc = (await api(`/appStoreVersions/${surum.id}/appStoreReviewDetail`))?.data || null; } catch { /* yok */ }
  try {
    if (mevcutInc) {
      const c = await api(`/appStoreReviewDetails/${mevcutInc.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ data: { type: 'appStoreReviewDetails', id: mevcutInc.id, attributes: nitelikler } }),
      });
      console.log(`  ✓ inceleme bilgisi güncellendi: ${c?.data?.attributes?.contactFirstName} ${c?.data?.attributes?.contactLastName}`);
    } else {
      const c = await api('/appStoreReviewDetails', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'appStoreReviewDetails',
            attributes: nitelikler,
            relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: surum.id } } },
          },
        }),
      });
      console.log(`  ✓ inceleme bilgisi yazıldı: ${c?.data?.attributes?.contactFirstName} ${c?.data?.attributes?.contactLastName} · ${c?.data?.attributes?.contactPhone}`);
    }
  } catch (e) {
    for (const s of String(e.message).split('\n')) console.log(`    ${s}`);
  }

  console.log('\n═══ VİTRİN SONRASI EKSİKLER ═══');
  await surumEksikleri(surum.id);
}

/**
 * BİR EKRAN GÖRÜNTÜSÜ KÜMESİNİ YÜKLE — Apple'ın dört adımlı akışı.
 *
 * Apple görseli doğrudan kabul etmiyor; önce yer ayırtıyorsun, verdiği
 * adrese dosyayı PUT ediyorsun, sonra MD5 özetiyle "yükledim" diyorsun.
 * Özet yanlışsa Apple görseli sessizce reddeder — bu yüzden checksum
 * dosyadan hesaplanıyor, uydurulmuyor.
 */
async function ekranKumesiYukle(yerel, kume) {
  const yol = kume.klasor;
  if (!fs.existsSync(yol)) { console.log(`  ${kume.tip}: klasör yok (${yol})`); return; }
  const dosyalar = fs.readdirSync(yol).filter((f) => f.endsWith('.png') && /^\d/.test(f)).sort();
  if (!dosyalar.length) { console.log(`  ${kume.tip}: görsel yok`); return; }

  // Küme var mı?
  const kumeler = (await api(`/appStoreVersionLocalizations/${yerel.id}/appScreenshotSets`))?.data || [];
  let k = kumeler.find((x) => x.attributes?.screenshotDisplayType === kume.tip);
  if (!k) {
    try {
      const c = await api('/appScreenshotSets', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'appScreenshotSets',
            attributes: { screenshotDisplayType: kume.tip },
            relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: yerel.id } } },
          },
        }),
      });
      k = c.data;
      console.log(`  ${kume.tip}: küme açıldı ${k.id}`);
    } catch (e) {
      console.log(`  ${kume.tip}: küme AÇILAMADI —`);
      for (const s of String(e.message).split('\n').slice(1)) console.log(`      ${s}`);
      return;
    }
  }

  const mevcut = (await api(`/appScreenshotSets/${k.id}/appScreenshots`))?.data || [];
  if (mevcut.length >= dosyalar.length) {
    console.log(`  ${kume.tip}: zaten ${mevcut.length} görsel var — atlandı`);
    return;
  }
  const varOlanAdlar = new Set(mevcut.map((m) => m.attributes?.fileName));

  for (const dosya of dosyalar) {
    if (varOlanAdlar.has(dosya)) { console.log(`    ${dosya} zaten var`); continue; }
    const tamYol = `${yol}/${dosya}`;
    const icerik = fs.readFileSync(tamYol);
    try {
      // (a) YER AYIRT
      const rez = await api('/appScreenshots', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'appScreenshots',
            attributes: { fileName: dosya, fileSize: icerik.length },
            relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: k.id } } },
          },
        }),
      });
      const gorsel = rez.data;

      // (b) APPLE'IN VERDİĞİ ADRESLERE PARÇA PARÇA YÜKLE
      for (const op of gorsel.attributes?.uploadOperations || []) {
        const basliklar = {};
        for (const h of op.requestHeaders || []) basliklar[h.name] = h.value;
        const cevap = await fetch(op.url, {
          method: op.method,
          headers: basliklar,
          body: icerik.subarray(op.offset, op.offset + op.length),
        });
        if (!cevap.ok) throw new Error(`yükleme ${cevap.status} ${await cevap.text()}`);
      }

      // (c) ÖZETLE MÜHÜRLE — checksum DOSYADAN hesaplanıyor, uydurulmuyor
      const ozet = crypto.createHash('md5').update(icerik).digest('hex');
      await api(`/appScreenshots/${gorsel.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          data: { type: 'appScreenshots', id: gorsel.id, attributes: { uploaded: true, sourceFileChecksum: ozet } },
        }),
      });
      console.log(`    ✓ ${dosya}`);
    } catch (e) {
      console.log(`    ✗ ${dosya}: ${String(e.message).split('\n').slice(0, 2).join(' | ')}`);
    }
  }
}

/**
 * TAM DENETİM — Apple'ın yayın için istediği HER nesneyi tek koşuda dök.
 *
 * NEDEN VAR (18.09.2026). Ürün sahibi haklı olarak patladı: "bu kadar
 * basit bir işi yapamıyorsun". Sebebi yöntemdi. Gönderim reddedilince
 * TEK bir eksik arayıp düzelttim, tekrar denedim, yine reddedildi, bir
 * sonrakini aradım. Apple'ın hatası belirsiz ("not in valid state") ve
 * bu döngü eksik sayısı kadar tur atıyor. Beş tur attı:
 *   derleme bağlı değil → açıklama yok → görsel yok → inceleme bilgisi
 *   yok → gizlilik adresi yok → ...
 *
 * DOĞRU YÖNTEM: aramayı bırak, LİSTEYİ ÇIKAR. Bu mod hiçbir şey yazmaz;
 * yayın için gereken her nesneyi okuyup dolu/boş diye basar. Bir tur.
 *
 * KAPSAM BEYANI: aşağıdaki liste Apple'ın istediklerinin TAMAMI DEĞİL,
 * bugüne kadar karşılaşılanların toplamıdır. Yeni bir eksik çıkarsa
 * BURAYA EKLENECEK — tekrar tek tek aramaya dönülmeyecek.
 */
async function tamDenetim() {
  const yaz = (etiket, deger, zorunlu = true) => {
    const bos = deger === null || deger === undefined || deger === '' || deger === 0;
    console.log(`  ${bos ? (zorunlu ? '✗' : '·') : '✓'} ${etiket.padEnd(34)} ${bos ? (zorunlu ? 'YOK — ZORUNLU' : 'boş (zorunlu değil)') : deger}`);
  };
  const oku = async (yol) => { try { return await api(yol); } catch (e) { return { _hata: String(e.message).split('\n')[1] || e.message }; } };

  // HESAP ROLLERİ — 18.09.2026'da eklendi.
  //
  // NEDEN. Ürün sahibi "Paid Apps yok" dedi. Sebebi menüyü bulamamak
  // olabilir, ama daha olası bir açıklama var ve ÖLÇÜLEBİLİR: Apple
  // sözleşme sayfasını YALNIZ "Account Holder" rolüne gösteriyor. Rol
  // farklıysa o bölüm menüde hiç çıkmaz ve insan haklı olarak "yok" der.
  //
  // Bunu sormak yerine okuyorum. Rol listesi API'de duruyor.
  console.log('═══ HESAP ROLLERİ ═══');
  const kullanicilar = await oku('/users?limit=50');
  if (kullanicilar?._hata) {
    console.log(`  okunamadı: ${kullanicilar._hata}`);
    console.log('  (bu uç App Manager anahtarına kapalı olabilir — o da bir bilgi)');
  } else {
    for (const k of kullanicilar?.data || []) {
      const a = k.attributes || {};
      console.log(`  ${(a.username || '?').padEnd(34)} roller=${(a.roles || []).join(',')}`);
    }
    const sahip = (kullanicilar?.data || []).find((k) => (k.attributes?.roles || []).includes('ACCOUNT_HOLDER'));
    console.log(`  → ACCOUNT_HOLDER: ${sahip ? sahip.attributes?.username : 'listede görünmüyor'}`);
    console.log('  Sözleşme sayfasını yalnız bu rol görür.');
  }

  console.log('\n═══ UYGULAMA ═══');
  const app = (await oku(`/apps/${APP_ID}`))?.data;
  yaz('bundleId', app?.attributes?.bundleId);
  yaz('contentRightsDeclaration', app?.attributes?.contentRightsDeclaration);

  // FİYAT VE ÜLKE — bugüne kadar HİÇ ÖLÇÜLMEDİ. Uygulamanın kendisinin
  // fiyat çizelgesi ve satış ülkesi yoksa yayınlanamaz; aboneliklerde
  // aynı tuzağa düşülmüştü (satışa açıklık fiyattan önce gelir).
  // ⚠ BU KONTROL BİR HAFTA BOYUNCA YANLIŞ ✓ VERDİ (19.09.2026'da bulundu).
  //
  // Eskiden yalnız `appPriceSchedule` NESNESİNİN var olup olmadığına
  // bakıyordu ve nesne vardı — ama İÇİ BOŞTU. Apple'ın arayüzü şunu
  // diyordu: "You must choose a price tier in Pricing." Denetim ise
  // "✓ fiyat çizelgesi" diye rapor ediyordu.
  //
  // Bir ilişkinin VAR OLMASI, İÇİNİN DOLU OLMASI demek değildir. Aynı tuzak
  // abonelik grubunda da vardı: grup vardı, adı yoktu. İkisi de "nesne var
  // mı" diye sorup "içinde ne var" diye sormamaktan çıktı.
  const fiyat = await oku(`/apps/${APP_ID}/appPriceSchedule`);
  if (fiyat?._hata) {
    yaz('fiyat çizelgesi', `okunamadı (${fiyat._hata.slice(0, 40)})`);
  } else if (!fiyat?.data) {
    yaz('fiyat çizelgesi', null);
  } else {
    const fiyatlar = await oku(`/appPriceSchedules/${fiyat.data.id}/manualPrices?limit=10`);
    const adet = fiyatlar?._hata ? null : (fiyatlar?.data || []).length;
    if (adet === null) {
      yaz('fiyat çizelgesi', `çizelge ${fiyat.data.id} — fiyatlar OKUNAMADI`);
    } else if (adet === 0) {
      yaz('fiyat çizelgesi', null);
      console.log('      Çizelge nesnesi var ama İÇİ BOŞ — Apple bunu');
      console.log('      "You must choose a price tier in Pricing" diye reddeder.');
    } else {
      yaz('fiyat çizelgesi', `${adet} fiyat kaydı (${fiyat.data.id})`);
    }
  }
  for (const yol of [`/apps/${APP_ID}/appAvailabilityV2`, `/apps/${APP_ID}/appAvailability`]) {
    const a = await oku(yol);
    if (!a?._hata) { yaz(`satış ülkeleri (${yol.split('/').pop()})`, a?.data ? a.data.id : null); break; }
    console.log(`  ? ${yol.split('/').pop().padEnd(34)} ${a._hata.slice(0, 60)}`);
  }

  console.log('\n═══ appInfo (uygulamaya özel vitrin) ═══');
  for (const bilgi of (await oku(`/apps/${APP_ID}/appInfos`))?.data || []) {
    yaz('appStoreAgeRating', bilgi.attributes?.appStoreAgeRating);
    for (const k of ['primaryCategory', 'secondaryCategory']) {
      const c = await oku(`/appInfos/${bilgi.id}/${k}`);
      yaz(k, c?._hata ? null : c?.data?.id, k === 'primaryCategory');
    }
    for (const l of (await oku(`/appInfos/${bilgi.id}/appInfoLocalizations`))?.data || []) {
      const a = l.attributes || {};
      yaz(`${a.locale} ad`, a.name);
      yaz(`${a.locale} altbaşlık`, a.subtitle, false);
      yaz(`${a.locale} gizlilik adresi`, a.privacyPolicyUrl);
    }
  }

  console.log('\n═══ appStoreVersion (sürüme özel vitrin) ═══');
  // 23.09.2026 — BURASI BİR ÇIKMAZDI, DÜZELTİLDİ.
  // Eskiden yalnız "PREPARE_FOR_SUBMISSION sürümü YOK" yazıp dönüyordu.
  // Ürün sahibi "onaylandı mı" diye sorduğunda denetim tam da bunu bastı ve
  // TEŞHİS OLMADIĞI İÇİN bir koşu daha gerekti: sürüm neden yok, hangi
  // durumda, ne yapılmalı — hiçbiri yazmıyordu. Bir denetimin işi eksiği
  // söylemek değil, SEBEBİ söylemektir.
  const tumSurumler = (await oku(`/apps/${APP_ID}/appStoreVersions?limit=5`))?.data || [];
  const s = tumSurumler.find((x) => x.attributes?.appStoreState === 'PREPARE_FOR_SUBMISSION');
  if (!s) {
    console.log('  PREPARE_FOR_SUBMISSION sürümü YOK — düzenlenebilir sürüm yok.');
    if (!tumSurumler.length) {
      console.log('  Uygulamanın HİÇ sürümü yok; App Store Connect\'te yeni sürüm açılmalı.');
    } else {
      console.log('  Mevcut sürümler ve durumları:');
      for (const x of tumSurumler) {
        console.log(`    ${x.attributes?.versionString}  =  ${x.attributes?.appStoreState}  (id ${x.id})`);
      }
      console.log('  NE ANLAMA GELİR:');
      console.log('    REJECTED / DEVELOPER_REJECTED → sürüm düzenlenebilir hâle');
      console.log('      gelir ama durumu PREPARE_FOR_SUBMISSION olmaz; yeniden');
      console.log('      göndermek için aynı sürüm nesnesi kullanılır.');
      console.log('    WAITING_FOR_REVIEW / IN_REVIEW → zaten Apple\'da, bekle.');
      console.log('    READY_FOR_SALE → yayında; yeni sürüm açılmalı.');
    }
    return;
  }
  yaz('versionString', s.attributes?.versionString);
  yaz('copyright', s.attributes?.copyright);
  yaz('usesIdfa', String(s.attributes?.usesIdfa));
  const b = await oku(`/appStoreVersions/${s.id}/build`);
  yaz('derleme', b?._hata ? null : b?.data?.attributes?.version);
  for (const l of (await oku(`/appStoreVersions/${s.id}/appStoreVersionLocalizations`))?.data || []) {
    const a = l.attributes || {};
    yaz(`${a.locale} açıklama`, a.description && `${a.description.length} krktr`);
    yaz(`${a.locale} anahtar kelime`, a.keywords);
    yaz(`${a.locale} destek adresi`, a.supportUrl);
    for (const kume of (await oku(`/appStoreVersionLocalizations/${l.id}/appScreenshotSets`))?.data || []) {
      const g = await oku(`/appScreenshotSets/${kume.id}/appScreenshots`);
      const sayi = (g?.data || []).length;
      const eksik = (g?.data || []).filter((x) => x.attributes?.assetDeliveryState?.state !== 'COMPLETE');
      yaz(`${a.locale} ${kume.attributes?.screenshotDisplayType}`, `${sayi} görsel${eksik.length ? ` — ${eksik.length} TAMAMLANMAMIŞ (!)` : ''}`);
    }
  }
  const d = await oku(`/appStoreVersions/${s.id}/appStoreReviewDetail`);
  yaz('inceleme bilgisi', d?._hata ? null : `${d?.data?.attributes?.contactFirstName} ${d?.data?.attributes?.contactLastName}`);

  console.log('\n═══ ABONELİKLER ═══');
  // HATAYI YUTMA — 18.09.2026'da bu bölüm BOŞ döndü ve boşluğun sebebi
  // anlaşılamadı: ürünler mi silindi, Apple mı cevap vermedi? `oku()`
  // hatayı `{_hata}` olarak döndürüyor, `?.data || []` ise onu sessizce
  // boş listeye çeviriyordu. Yani ölçüm aracı, ölçmek istediğim şeyi
  // gizliyordu — bugün üçüncü kez aynı tür hata.
  const grupCevap = await oku(`/apps/${APP_ID}/subscriptionGroups?limit=50`);
  if (grupCevap?._hata) {
    console.log(`  ✗ GRUPLAR OKUNAMADI: ${grupCevap._hata}`);
    console.log('    (boş liste DEĞİL — Apple cevap vermedi. Bugün bu uçta 500 alınmıştı.)');
  } else if (!(grupCevap?.data || []).length) {
    console.log('  ✗ HİÇ GRUP YOK — bu beklenmedik, ürünler bu sabah oradaydı.');
  } else {
    console.log(`  ${grupCevap.data.length} grup okundu`);
  }
  // HER PARÇAYI AYRI GÖSTER — 18.09.2026. "MISSING_METADATA" tek başına
  // hangi parçanın eksik olduğunu söylemiyor. Fiyat, Türkçe metin,
  // inceleme notu ve inceleme görseli tek tek basılıyor ki hangisinin
  // yazılmadığı görünsün.
  //
  // 19.09.2026 DÜZELTMESİ: bu yorumun eski hâli "dördü de doluyken hâlâ
  // MISSING_METADATA ise eksik Paid Apps sözleşmesidir" diyordu. Bu bir
  // ÇIKARIMDI, ölçüm değildi — ve ürün sahibine günlerce sebep diye
  // söylendi. Gönderim gerçekten denendiğinde Apple bambaşka bir şey dedi:
  //   409 STATE_ERROR.ENTITY_STATE_INVALID — appStoreVersions ... is not in
  //   valid state.
  // Yani engel sözleşme değil, SÜRÜMÜN KENDİSİYDİ. O cümle buradan silindi;
  // yerine hiçbir tahmin konmadı. Eksik bulunamıyorsa doğru cevap
  // "bilmiyorum, Apple'ın arayüzüne bakılmalı"dır.
  for (const g of grupCevap?.data || []) {
    // GRUBUN KENDİ YERELLEŞTİRMESİ — 19.09.2026'da eklendi.
    //
    // NEDEN: denetim bugüne kadar "N grup okundu" deyip grubun İÇİNE
    // bakıyordu ama GRUBUN KENDİSİNİ hiç ölçmüyordu. Abonelik grubunun her
    // dil için bir adı (ve müşteriye görünen uygulama adı) olmak zorunda;
    // eksikse gruptaki ürünler MISSING_METADATA'dan çıkamaz.
    //
    // Bu, "her parçayı ayrı göster" fikrinin atlanmış parçasıydı: ürünün
    // dört alanı tek tek basılıyordu, grubunki hiç basılmıyordu.
    const gYerel = await oku(`/subscriptionGroups/${g.id}/subscriptionGroupLocalizations`);
    if (gYerel?._hata) {
      console.log(`  ✗ grup ${g.id} yerelleştirmesi OKUNAMADI: ${gYerel._hata}`);
    } else if (!(gYerel?.data || []).length) {
      console.log(`  ✗ grup ${g.id} YERELLEŞTİRMESİ YOK (!) — grubun adı hiçbir dilde yazılmamış.`);
      console.log('    Grup adsızken gruptaki ürünler MISSING_METADATA\'dan çıkamaz.');
    } else {
      for (const gl of gYerel.data) {
        const a = gl.attributes || {};
        const eksik = [];
        if (!a.name) eksik.push('ad');
        if (!a.customAppName) eksik.push('uygulama adı (isteğe bağlı)');
        console.log(`  ${eksik.includes('ad') ? '✗' : '✓'} grup yerelleştirme ${a.locale}: ad=${a.name || 'YOK (!)'} · uygulama adı=${a.customAppName || '(boş)'}`);
      }
    }

    const urunCevap = await oku(`/subscriptionGroups/${g.id}/subscriptions`);
    if (urunCevap?._hata) { console.log(`  ✗ grup ${g.id} ürünleri okunamadı: ${urunCevap._hata}`); continue; }
    if (!(urunCevap?.data || []).length) console.log(`  ✗ grup ${g.id} BOŞ görünüyor`);
    for (const u of urunCevap?.data || []) {
      console.log(`\n  ${u.attributes?.productId}  state=${u.attributes?.state}`);
      // SÜRE (subscriptionPeriod) — 19.09.2026'da eklendi, ürün sahibinin
      // uyarısıyla: "aylığı seçmedik, doldurmadık". Denetim bu alanı hiç
      // basmıyordu; oysa süresi olmayan bir abonelik MISSING_METADATA'dan
      // çıkamaz. Yazma kodunda (POST /subscriptions) gönderiliyor ama
      // gönderildiği ile YAZILDIĞI ayrı şeyler — bu yüzden geri okunuyor.
      yaz('  süre (subscriptionPeriod)', u.attributes?.subscriptionPeriod || null);
      yaz('  aile paylaşımı', u.attributes?.familySharable === undefined ? null : String(u.attributes.familySharable));
      const f = await oku(`/subscriptions/${u.id}/prices?limit=200`);
      yaz('  fiyat kaydı', f?._hata ? null : `${(f?.data || []).length} adet`);
      const y = await oku(`/subscriptions/${u.id}/subscriptionLocalizations`);
      yaz('  yerelleştirme', y?._hata ? null : `${(y?.data || []).length} dil`);
      yaz('  inceleme notu', u.attributes?.reviewNote && `${u.attributes.reviewNote.length} krktr`);
      const g2 = await oku(`/subscriptions/${u.id}/appStoreReviewScreenshot`);
      // FAILED'ı 'dolu' sayma: bugün tam da bu yüzden 'görsel var' sanıldı.
      const gd = g2?._hata ? null : g2?.data?.attributes?.assetDeliveryState?.state;
      yaz('  inceleme görseli', gd === 'COMPLETE' ? 'COMPLETE' : (gd ? null : null));
      if (gd && gd !== 'COMPLETE') console.log(`      (durum: ${gd} — Apple reddetti)`);
      const a = await oku(`/subscriptions/${u.id}/subscriptionAvailability`);
      yaz('  satışa açıklık', a?._hata ? null : (a?.data ? 'var' : null));

      // ÜLKE SAYISI ile FİYAT SAYISI KARŞILAŞTIRILIYOR — 19.09.2026'da eklendi.
      //
      // NEDEN: grup adı yazıldıktan sonra vekil_ai_monthly READY_TO_SUBMIT'e
      // geçti ama vekil_premium_monthly MISSING_METADATA'da kaldı. İkisi
      // arasındaki tek görünür fark fiyat kaydı sayısıydı: 175'e karşı 1.
      //
      // Bir abonelik N ülkede satışa açıksa o N ülkenin HEPSİNDE fiyatı
      // olmalı. Açık ülke > fiyatlı ülke ise Apple ürünü eksik sayar ve
      // bunu "MISSING_METADATA" diye tek kelimeyle söyler — hangi parçanın
      // eksik olduğunu söylemez. Denetim bugüne kadar iki sayıyı ayrı ayrı
      // basıyordu ama BİRBİRİYLE KARŞILAŞTIRMIYORDU; yan yana konmayan iki
      // doğru sayı, yanlış bir sonuca yol açabiliyor.
      if (a?.data?.id) {
        const ulk = await oku(`/subscriptionAvailabilities/${a.data.id}/availableTerritories?limit=200`);
        const ulkeSayisi = ulk?._hata ? null : (ulk?.data || []).length;
        const fiyatSayisi = f?._hata ? null : (f?.data || []).length;
        if (ulkeSayisi === null || fiyatSayisi === null) {
          console.log('  ?   ülke/fiyat karşılaştırması yapılamadı (biri okunamadı)');
        } else if (ulkeSayisi === fiyatSayisi) {
          console.log(`  ✓   ülke=fiyat                        ${ulkeSayisi} ülke, ${fiyatSayisi} fiyat`);
        } else {
          console.log(`  ✗   ÜLKE/FİYAT UYUŞMUYOR (!)          ${ulkeSayisi} ülkede satışta ama ${fiyatSayisi} fiyat kaydı var`);
          console.log('      Fiyatsız ülke, ürünü MISSING_METADATA\'da tutar.');
        }
      }
    }
  }

  console.log('\n→ Bu liste TAM DEĞİL; bugüne kadar karşılaşılanların toplamı.');
  console.log('  Apple\'ın arayüzdeki "Add for Review" uyarısı hâlâ en kesin kaynak.');
}

/**
 * FİYAT VE SATIŞ ÜLKESİ — uygulamanın kendisi için.
 *
 * NEDEN VAR (18.09.2026). Tam denetim tek eksik bıraktı:
 *   appAvailabilityV2 → 404 NOT_FOUND
 * Bu 404 diğerlerinden FARKLI. Ötekiler "PATH_ERROR: URL path is not
 * valid" diyordu — yol yok demek. Bu ise "NOT_FOUND: The specified
 * resource does not exist" — yol VAR, KAYIT yok. Yani uygulamanın hiç
 * satış ülkesi seçilmemiş ve ülkesi olmayan uygulama yayınlanamaz.
 *
 * İki 404'ü ayırt etmek bu işi çözdü; ayırt etmeseydim "bu uç da kapalı"
 * deyip geçecektim. Hata metninin KELİMESİ ölçümün parçası.
 *
 * TÜRKİYE İLE SINIRLI — bilinçli:
 *   • ürün Türk hukuku ürünü, arayüz Türkçe
 *   • abonelikler de Türkiye ile sınırlı (aynı gün kuruldu)
 *   • AB'de satış `YAYIN-SIRASI.md` B7'deki TRADER STATUS beyanını
 *     zorunlu kılıyor ve o beyan hâlâ verilmedi
 * Genişletmek sonradan tek koşu; daraltmak ise satıştayken sorun olur.
 */
async function fiyatUlkeYaz() {
  // v2 ucu /v1 tabanında değil; tam adresle çağrılıyor.
  const v2 = async (yol, secenek) => {
    const cevap = await fetch(`https://api.appstoreconnect.apple.com/v2${yol}`, {
      ...secenek,
      headers: { Authorization: `Bearer ${TOKEN ??= jwtUret()}`, 'Content-Type': 'application/json', ...(secenek?.headers || {}) },
    });
    const metin = await cevap.text();
    let veri = null;
    try { veri = metin ? JSON.parse(metin) : null; } catch { /* HTML */ }
    if (!cevap.ok) {
      const detay = veri?.errors ? veri.errors.map((e) => `${e.status} ${e.code}: ${e.title} — ${e.detail}`).join('\n  ') : metin.slice(0, 400);
      throw new Error(`Apple API ${cevap.status} ${secenek?.method || 'GET'} v2${yol}\n  ${detay}`);
    }
    return veri;
  };

  console.log('═══ SATIŞ ÜLKESİ ═══');
  let acik = null;
  try { acik = (await v2(`/apps/${APP_ID}/appAvailability`))?.data || null; } catch (e) {
    console.log(`  okunamadı: ${String(e.message).split('\n')[1] || e.message}`);
  }
  if (acik) {
    console.log(`  zaten var: ${acik.id} · yeni ülkelere otomatik=${acik.attributes?.availableInNewTerritories}`);
  } else {
    // APPLE BÜTÜN ÜLKELERİ BİRDEN İSTİYOR — 18.09.2026, ikinci denemede
    // öğrenildi. Yalnız TUR gönderilince Apple tek tek saymaya başladı:
    //   "expects an included resource with type 'territories' and id 'MLI'
    //    but no matching resource was included" · PLW · MRT · JAM · …
    // Yani bu uç KISMİ güncelleme kabul etmiyor; satış haritasının TAMAMI
    // gönderiliyor. Her ülke için bir kayıt, Türkiye'de available=true,
    // ötekilerde false.
    //
    // ÜLKE LİSTESİ UYDURULMUYOR: Apple'ın kendi /territories ucundan
    // sayfalanarak okunuyor. Elle yazılmış bir liste eksik ya da fazla
    // olurdu ve hata yine tek tek eksik ülke saymakla geçerdi.
    const ulkeler = [];
    let sayfaYolu = '/territories?limit=200';
    let sayfa = 0;
    while (sayfaYolu && sayfa < 10) {
      const c = await api(sayfaYolu);
      for (const t of c?.data || []) ulkeler.push(t.id);
      sayfa += 1;
      const sonraki = c?.links?.next;
      sayfaYolu = sonraki ? sonraki.replace(/^https:\/\/api\.appstoreconnect\.apple\.com\/v1/, '') : null;
    }
    console.log(`  Apple'ın ülke listesi: ${ulkeler.length} ülke (${sayfa} sayfa)`);
    if (!ulkeler.includes('TUR')) {
      console.log('  ✗ TUR listede yok — beklenmedik, durduruldu.');
      return;
    }

    // SATIR İÇİ KİMLİK '${yerel}' BİÇİMİNDE OLMALI — ilk denemede 'TUR'
    // yazıldı ve Apple söyledi: "For inline creation, the id must be a
    // local id with the format '${local-id}'". O kimlik ülke kodu değil,
    // istek içinde `data` ile `included`ı bağlayan geçici takma ad.
    const yerelKimlik = (u) => `\${u_${u}}`;
    console.log(`  → POST /v2/appAvailabilities — yalnız TUR açık, ${ulkeler.length - 1} ülke kapalı`);
    try {
      const c = await v2('/appAvailabilities', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'appAvailabilities',
            attributes: { availableInNewTerritories: false },
            relationships: {
              app: { data: { type: 'apps', id: APP_ID } },
              territoryAvailabilities: {
                data: ulkeler.map((u) => ({ type: 'territoryAvailabilities', id: yerelKimlik(u) })),
              },
            },
          },
          included: ulkeler.map((u) => ({
            type: 'territoryAvailabilities',
            id: yerelKimlik(u),
            attributes: { available: u === 'TUR' },
            relationships: { territory: { data: { type: 'territories', id: u } } },
          })),
        }),
      });
      console.log(`  ✓ kuruldu: ${c?.data?.id}`);
    } catch (e) {
      // Hata uzun olabilir (ülke başına bir satır); ilk beşi yeter.
      const satirlar = String(e.message).split('\n');
      for (const s of satirlar.slice(0, 6)) console.log(`    ${s}`);
      if (satirlar.length > 6) console.log(`    … ${satirlar.length - 6} satır daha`);
    }
  }

  console.log('\n═══ FİYAT (ücretsiz uygulama) ═══');
  let cizelge = null;
  try { cizelge = (await api(`/apps/${APP_ID}/appPriceSchedule`))?.data || null; } catch (e) {
    console.log(`  okunamadı: ${String(e.message).split('\n')[1] || e.message}`);
  }
  if (cizelge) {
    console.log(`  zaten var: ${cizelge.id}`);
  } else {
    console.log('  yok → POST /v1/appPriceSchedules (ücretsiz)');
    // ÜCRETSİZ = Apple'ın "0" kademesi. Kademe kimliğini UYDURMUYORUM:
    // uygulamanın kendi fiyat noktalarından Türkiye'de 0 olanı aranıyor.
    let nokta = null;
    try {
      const nk = await api(`/apps/${APP_ID}/appPricePoints?filter[territory]=TUR&limit=200`);
      nokta = (nk?.data || []).find((p) => Number(p.attributes?.customerPrice) === 0) || null;
      console.log(`  ${(nk?.data || []).length} fiyat noktası okundu; sıfır kademesi ${nokta ? 'bulundu' : 'BULUNAMADI'}`);
    } catch (e) {
      console.log(`  fiyat noktaları okunamadı: ${String(e.message).split('\n')[1] || e.message}`);
    }
    try {
      const govde = {
        data: {
          type: 'appPriceSchedules',
          relationships: {
            app: { data: { type: 'apps', id: APP_ID } },
            baseTerritory: { data: { type: 'territories', id: 'TUR' } },
            manualPrices: { data: nokta ? [{ type: 'appPrices', id: '${yeni}' }] : [] },
          },
        },
        included: nokta ? [{
          type: 'appPrices', id: '${yeni}',
          attributes: { startDate: null },
          relationships: { appPricePoint: { data: { type: 'appPricePoints', id: nokta.id } } },
        }] : [],
      };
      const c = await api('/appPriceSchedules', { method: 'POST', body: JSON.stringify(govde) });
      console.log(`  ✓ kuruldu: ${c?.data?.id}`);
    } catch (e) {
      for (const s of String(e.message).split('\n')) console.log(`    ${s}`);
    }
  }
}

const MODLAR = {
  yaz,
  'tam-denetim': tamDenetim,
  'fiyat-ulke-yaz': fiyatUlkeYaz,
  'vitrin-yaz': vitrinYaz,
  'abonelik-oku': abonelikOku,
  'abonelik-yaz': abonelikYaz,
  'alanlar-yaz': alanlarYaz,
  'incelemeye-gonder': incelemeyeGonder,
  oku,
};
const islem = MODLAR[MOD] || oku;
islem().catch((e) => { console.error(`\n${e.message}`); process.exit(1); });
