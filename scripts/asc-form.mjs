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
          const dahil = f?.included || [];
          const ulkeler = dahil.filter((d) => d.type === 'territories').map((d) => d.id);
          const noktalar = dahil.filter((d) => d.type === 'subscriptionPricePoints');
          console.log(`    fiyat detayı: ${ulkeler.length} ülke — ${ulkeler.slice(0, 8).join(', ')}${ulkeler.length > 8 ? ' …' : ''}`);
          for (const n of noktalar.slice(0, 3)) {
            console.log(`      nokta ${n.id.slice(0, 10)}… customerPrice=${n.attributes?.customerPrice} proceeds=${n.attributes?.proceeds}`);
          }
          const tur = noktalar.find((n) => {
            try { return JSON.parse(Buffer.from(n.id, 'base64').toString()).t === 'TUR'; } catch { return false; }
          });
          if (tur) console.log(`      TÜRKİYE kaydı: ${tur.attributes?.customerPrice} TL`);
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
  const hatalar = [];
  for (const u of tanim.urunler || []) {
    try {
      await urunKur(u, grupId, mevcut);
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

async function urunKur(u, grupId, mevcut) {
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

    // 3) FİYAT
    const fiyatlar = (await api(`/subscriptions/${urun.id}/prices`))?.data || [];
    if (fiyatlar.length) {
      console.log(`  fiyat zaten var (${fiyatlar.length} kayıt) — DOKUNULMADI`);
    } else {
      console.log(`  fiyat yok → ${u.fiyatTL} TL kademesi aranıyor`);
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
    ['startDate: null + preserveCurrentPrice: false', { startDate: null, preserveCurrentPrice: false }],
    ['preserveCurrentPrice: false', { preserveCurrentPrice: false }],
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

const MODLAR = { yaz, 'abonelik-oku': abonelikOku, 'abonelik-yaz': abonelikYaz, oku };
const islem = MODLAR[MOD] || oku;
islem().catch((e) => { console.error(`\n${e.message}`); process.exit(1); });
