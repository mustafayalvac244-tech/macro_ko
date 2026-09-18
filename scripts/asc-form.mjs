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
  try {
    const b = await api(`/appStoreVersions/${surumId}/build`);
    console.log(`  derleme: ${b?.data ? `${b.data.id} (${b.data.attributes?.version})` : 'YOK (!)'}`);
  } catch (e) {
    console.log(`  derleme: YOK (!) — ${String(e.message).split('\n')[0]}`);
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

async function incelemeyeGonder() {
  const surumler = await api(`/apps/${APP_ID}/appStoreVersions?limit=5`);
  const surum = (surumler?.data || []).find((s) => s.attributes?.appStoreState === 'PREPARE_FOR_SUBMISSION');
  if (!surum) {
    console.log('Gönderilecek PREPARE_FOR_SUBMISSION sürümü yok. Mevcut durumlar:');
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
    if (gonderim) console.log(`  Açık gönderim VAR: ${gonderim.id} state=${gonderim.attributes?.state}`);
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
  console.log(`  SONUÇ: ${(await api(`/appStoreVersions/${surum.id}`))?.data?.attributes?.appStoreState === 'PREPARE_FOR_SUBMISSION' ? 'HÂLÂ GÖNDERİLMEDİ' : 'GÖNDERİLDİ'}`);
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
  const surum = (surumler?.data || []).find((s) => s.attributes?.appStoreState === 'PREPARE_FOR_SUBMISSION');
  if (!surum) { console.error('PREPARE_FOR_SUBMISSION sürümü yok.'); process.exit(1); }
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

  console.log('═══ UYGULAMA ═══');
  const app = (await oku(`/apps/${APP_ID}`))?.data;
  yaz('bundleId', app?.attributes?.bundleId);
  yaz('contentRightsDeclaration', app?.attributes?.contentRightsDeclaration);

  // FİYAT VE ÜLKE — bugüne kadar HİÇ ÖLÇÜLMEDİ. Uygulamanın kendisinin
  // fiyat çizelgesi ve satış ülkesi yoksa yayınlanamaz; aboneliklerde
  // aynı tuzağa düşülmüştü (satışa açıklık fiyattan önce gelir).
  const fiyat = await oku(`/apps/${APP_ID}/appPriceSchedule`);
  yaz('fiyat çizelgesi', fiyat?._hata ? `okunamadı (${fiyat._hata.slice(0, 40)})` : (fiyat?.data ? fiyat.data.id : null));
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
  const s = ((await oku(`/apps/${APP_ID}/appStoreVersions?limit=5`))?.data || [])
    .find((x) => x.attributes?.appStoreState === 'PREPARE_FOR_SUBMISSION');
  if (!s) { console.log('  PREPARE_FOR_SUBMISSION sürümü YOK'); return; }
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
  for (const g of (await oku(`/apps/${APP_ID}/subscriptionGroups?limit=50`))?.data || []) {
    for (const u of (await oku(`/subscriptionGroups/${g.id}/subscriptions`))?.data || []) {
      console.log(`  ${u.attributes?.productId.padEnd(24)} state=${u.attributes?.state}`);
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
    console.log('  yok → POST /v2/appAvailabilities (yalnız Türkiye)');
    try {
      const c = await v2('/appAvailabilities', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'appAvailabilities',
            attributes: { availableInNewTerritories: false },
            relationships: {
              app: { data: { type: 'apps', id: APP_ID } },
              territoryAvailabilities: { data: [{ type: 'territoryAvailabilities', id: 'TUR' }] },
            },
          },
          included: [{
            type: 'territoryAvailabilities',
            id: 'TUR',
            attributes: { available: true },
            relationships: { territory: { data: { type: 'territories', id: 'TUR' } } },
          }],
        }),
      });
      console.log(`  ✓ kuruldu: ${c?.data?.id}`);
    } catch (e) {
      for (const s of String(e.message).split('\n')) console.log(`    ${s}`);
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
