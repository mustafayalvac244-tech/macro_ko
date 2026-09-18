// MAĞAZA EKRAN GÖRÜNTÜLERİ — gerçek uygulamayı sahte veriyle çekip PNG üretir.
// ---------------------------------------------------------------------------
// NEDEN VAR. Google Play en az 2 telefon ekran görüntüsü istiyor ve bunlar
// olmadan mağaza kaydı yayınlanamıyor. Elle çekmek için gerçek veri girilmiş
// bir hesap ve bir telefon gerekiyordu; ikisi de yoktu.
//
// NEDEN SAHTE VERİ. Boş ekranların görüntüsü mağazada ürünü olduğundan kötü
// gösterir ("hiçbir şey yok" gibi durur). Gerçek müvekkil verisi ise mağazaya
// konulamaz — o yüzden tamamen uydurma kayıtlar kullanılıyor.
//
// İSİMLER 16.09.2026'DA BAŞ HARFE İNDİRİLDİ. Ürün sahibi sordu: "niye Avukat
// Selin?" Bakınca daha büyük bir sorun çıktı: sahte veri GERÇEK GİBİ
// duruyordu — "Mehmet Korkmaz — Kıdem ve İhbar Tazminatı · İstanbul 9. İş
// Mahkemesi · 2026/418". Gerçek ad-soyad, gerçek mahkeme, gerçek biçimli
// esas numarası yan yana gelince birinin DOSYASI gibi görünüyor.
//   (a) Kişilik hakkı: o adda biri o mahkemede gerçekten dava açmış olabilir.
//   (b) Ters mesaj: bu ürün MÜVEKKİL GİZLİLİĞİ satıyor; vitrininde gerçek
//       gibi duran müvekkil adı ve dosya numarası göstermek, sattığı şeyle
//       çelişir. Dikkatli bir avukat bunu fark eder.
// Çözüm: müvekkiller baş harf (M. K.), şirketler jenerik, mahkemeler
// "Örnek ...", esas numaraları 2026/0001 biçiminde. Ekran dolu görünmeye
// devam ediyor ama kimsenin dosyası gibi durmuyor.
//
// NASIL ÇALIŞIR. docs/app (derlenmiş web sürümü) yerel bir sunucudan servis
// edilir, Playwright bütün Supabase isteklerini yakalayıp sahte cevap döner.
// Yani çekilen şey ekranın GERÇEK kendisidir — çizim ya da maket değil.
//
// ÖĞRENİLMİŞ TUZAKLAR (önceki denemede saatler yedi, tekrar yaşanmasın):
//   • Profil `profiles` TABLOSUNDAN değil `my_profile` RPC'sinden okunuyor.
//     Yalnız tabloyu taklit etmek "İyi günler, Avukat" yazdırıyor.
//   • `.single()`/`.maybeSingle()` PostgREST'e `Accept: ...object+json`
//     gönderiyor; dizi dönerseniz ekran boş kalır. Tekil istek TEK NESNE ister.
//   • Finans tablosunun adı `finance` değil `finance_entries`.
//   • İLİŞKİ ALANI `cases` DEĞİL `case`. Duruşma ve süre sorguları
//     '*, case:cases(id, title, case_number)' ile TAKMA AD veriyor
//     (src/hooks/useHearings.ts ve useDeadlines.ts). Taklitte `cases` yazılıydı
//     ve ekranlarda dosya adının olduğu her yer sessizce "—" çiziyordu —
//     15.09.2026'da terminal panosunun "dosya" sütunu boş çıkınca fark edildi.
//     Yani düzenek ekranı YANLIŞ gösteriyordu; ekranda hata yoktu.
//   • Oturum web'de AsyncStorage üzerinden localStorage'a yazılıyor.

import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import { join, extname } from 'node:path';

const KOK = new URL('..', import.meta.url).pathname;
const WEB = join(KOK, 'docs', 'app');
// ÇIKTI VE GÖRÜNÜM ALANI DIŞARIDAN AYARLANABİLİR — 14.09.2026.
// Sebep: bu düzenek Play mağaza görselleri için telefon boyutunda (412×915)
// yazıldı. Ama WEB SÜRÜMÜ masaüstünde kullanılıyor ve oradaki görünümü hiç
// kimse görmemişti. 300 satırlık sunucu + Supabase taklidini kopyalamak
// yerine üç değişken env'den okunuyor; varsayılanlar aynen mağaza ayarı.
//   VP_CIKTI=... VP_GENISLIK=1440 VP_YUKSEKLIK=900 VP_OLCEK=1
const CIKTI = join(KOK, process.env.VP_CIKTI ?? 'magaza-gorselleri');
const PORT = 4599;
const PROJE = 'wjshlysfmeqlnfiibknj.supabase.co';

if (!existsSync(CIKTI)) mkdirSync(CIKTI, { recursive: true });

/* ---------------- Sahte veri (tamamı kurgudur) ---------------- */

const KULLANICI_ID = '11111111-1111-1111-1111-111111111111';

// VP_UCRETSIZ=1 → sahte kullanıcı ÜCRETSİZ pakette olur.
//
// NEDEN EKLENDİ (18.09.2026). Apple, abonelik ürünü için "Review
// Information" ekran görüntüsü istiyor: satın alma ekranının KENDİSİ.
// İlk çekimde profil `is_premium: true` olduğu için /premium ekranı
// "Premium Üyeliğiniz aktif" rozetiyle çıktı — yani inceleyene satın alma
// akışı DEĞİL, zaten satın almış birinin ekranı gönderilecekti. Bu bir
// ret sebebi; Apple'ın görmek istediği şey planlar ve fiyat.
//
// Varsayılan hâlâ `true`: mağaza vitrini görselleri ürünün dolu hâlini
// göstermeli, kilit ekranını değil.
const UCRETSIZ = process.env.VP_UCRETSIZ === '1';

const profil = {
  id: KULLANICI_ID,
  full_name: 'Av. Deniz Aksoy',
  email: 'ornek@vekilpro.app',
  firm_name: 'Aksoy Hukuk Bürosu',
  bar_number: '00000',
  phone: null,
  avatar_url: null,
  is_premium: !UCRETSIZ,
  ai_tier: UCRETSIZ ? 'free' : 'ai',
  is_admin: false,
  hourly_rate: 3000,
  created_at: '2026-01-04T09:00:00Z',
  updated_at: '2026-09-01T09:00:00Z',
};

const musteriler = [
  { id: 'c1', owner_id: KULLANICI_ID, full_name: 'M. K.', company: null, client_type: 'gercek', phone: '0500 000 00 00', email: null, created_at: '2026-02-01T09:00:00Z' },
  { id: 'c2', owner_id: KULLANICI_ID, full_name: 'Z. A.', company: null, client_type: 'gercek', phone: null, email: null, created_at: '2026-03-11T09:00:00Z' },
  { id: 'c3', owner_id: KULLANICI_ID, full_name: 'İnşaat Firması A.Ş.', company: 'İnşaat Firması A.Ş.', client_type: 'tuzel', phone: null, email: null, created_at: '2026-04-02T09:00:00Z' },
];

const bugun = new Date();
const gunEkle = (n) => new Date(bugun.getTime() + n * 86400000).toISOString();

const davalar = [
  { id: 'd1', owner_id: KULLANICI_ID, client_id: 'c1', title: 'M. K. — Kıdem ve İhbar Tazminatı', case_number: '2026/0001', court_name: 'Örnek İş Mahkemesi', court_category: 'hukuk', case_type: 'İş Hukuku', status: 'active', priority: 'high', instance_stage: 'ilk_derece', case_stage: 'tahkikat', opened_date: '2026-02-04', opposing_party: 'Lojistik Firması Ltd. Şti.', description: null, fee_amount: 48000, created_at: '2026-02-04T09:00:00Z', updated_at: gunEkle(-2), client: { id: 'c1', full_name: 'M. K.', company: null } },
  { id: 'd2', owner_id: KULLANICI_ID, client_id: 'c2', title: 'Z. A. — Anlaşmalı Boşanma', case_number: '2026/0002', court_name: 'Örnek Aile Mahkemesi', court_category: 'hukuk', case_type: 'Aile Hukuku', status: 'active', priority: 'medium', instance_stage: 'ilk_derece', case_stage: 'on_inceleme', opened_date: '2026-03-12', opposing_party: 'K. A.', description: null, fee_amount: 32000, created_at: '2026-03-12T09:00:00Z', updated_at: gunEkle(-5), client: { id: 'c2', full_name: 'Z. A.', company: null } },
  { id: 'd3', owner_id: KULLANICI_ID, client_id: 'c3', title: 'İnşaat Firması — Eser Sözleşmesinden Alacak', case_number: '2026/0003', court_name: 'Örnek Asliye Ticaret Mahkemesi', court_category: 'hukuk', case_type: 'Ticaret Hukuku', status: 'active', priority: 'critical', instance_stage: 'istinaf', case_stage: null, opened_date: '2025-11-20', opposing_party: 'Yapı Firması A.Ş.', description: null, fee_amount: 175000, created_at: '2025-11-20T09:00:00Z', updated_at: gunEkle(-1), client: { id: 'c3', full_name: 'İnşaat Firması A.Ş.', company: 'İnşaat Firması A.Ş.' } },
  { id: 'd4', owner_id: KULLANICI_ID, client_id: 'c1', title: 'M. K. — Fazla Mesai Alacağı', case_number: '2026/0004', court_name: 'Örnek İş Mahkemesi', court_category: 'hukuk', case_type: 'İş Hukuku', status: 'pending', priority: 'low', instance_stage: 'ilk_derece', case_stage: 'dilekceler', opened_date: '2026-06-18', opposing_party: 'Lojistik Firması Ltd. Şti.', description: null, fee_amount: 22000, created_at: '2026-06-18T09:00:00Z', updated_at: gunEkle(-9), client: { id: 'c1', full_name: 'M. K.', company: null } },
];

// BUGÜN İÇİN EN AZ BİR İŞ OLMALI — 16.09.2026'da mağaza görselinde yakalandı.
// Panonun "BUGÜN" bölümü boşken "Bugün için planlanmış bir işlem yok." yazıyor
// ve bu, mağaza sayfasında ürünü ÇALIŞMIYOR gösteriyor. Sahte veri zaten
// kurgu; kurgunun dolu olması gerekiyor.
const bugunSaat = (saat, dakika = 0) => {
  const d = new Date(bugun);
  d.setHours(saat, dakika, 0, 0);
  return d.toISOString();
};

const durusmalar = [
  { id: 'h0', owner_id: KULLANICI_ID, case_id: 'd1', title: 'Duruşma — tanık beyanları', type: 'hearing', scheduled_at: bugunSaat(14, 30), location: 'Örnek İş Mahkemesi', notes: null, reminder_minutes_before: 1440, is_completed: false, created_at: '2026-09-01T09:00:00Z', case: { id: 'd1', title: 'M. K. — Kıdem ve İhbar Tazminatı', case_number: '2026/0001' } },
  { id: 'h1', owner_id: KULLANICI_ID, case_id: 'd1', title: 'Tanık dinlenmesi', type: 'hearing', scheduled_at: gunEkle(2), location: 'Örnek İş Mahkemesi', notes: null, reminder_minutes_before: 1440, is_completed: false, created_at: '2026-08-01T09:00:00Z', case: { id: 'd1', title: 'M. K. — Kıdem ve İhbar Tazminatı', case_number: '2026/0001' } },
  { id: 'h2', owner_id: KULLANICI_ID, case_id: 'd2', title: 'Ön inceleme duruşması', type: 'hearing', scheduled_at: gunEkle(6), location: 'Örnek Aile Mahkemesi', notes: null, reminder_minutes_before: 1440, is_completed: false, created_at: '2026-08-04T09:00:00Z', case: { id: 'd2', title: 'Z. A. — Anlaşmalı Boşanma', case_number: '2026/0002' } },
  { id: 'h3', owner_id: KULLANICI_ID, case_id: 'd3', title: 'Bilirkişi raporu duruşması', type: 'hearing', scheduled_at: gunEkle(13), location: 'Örnek Bölge Adliye Mahkemesi', notes: null, reminder_minutes_before: 2880, is_completed: false, created_at: '2026-08-09T09:00:00Z', case: { id: 'd3', title: 'İnşaat Firması — Eser Sözleşmesinden Alacak', case_number: '2026/0003' } },
];

const sureler = [
  { id: 's0', owner_id: KULLANICI_ID, case_id: 'd2', title: 'Cevap dilekçesi son gün', due_at: bugunSaat(17, 0), is_completed: false, notes: null, reminder_minutes_before: 1440, created_at: '2026-09-02T09:00:00Z', case: { id: 'd2', title: 'Z. A. — Anlaşmalı Boşanma', case_number: '2026/0002' } },
  { id: 's1', owner_id: KULLANICI_ID, case_id: 'd3', title: 'İstinaf dilekçesine cevap', due_at: gunEkle(3), is_completed: false, notes: null, reminder_minutes_before: 1440, created_at: '2026-09-01T09:00:00Z', case: { id: 'd3', title: 'İnşaat Firması — Eser Sözleşmesinden Alacak', case_number: '2026/0003' } },
  { id: 's2', owner_id: KULLANICI_ID, case_id: 'd1', title: 'Bilirkişi raporuna itiraz', due_at: gunEkle(8), is_completed: false, notes: null, reminder_minutes_before: 1440, created_at: '2026-09-03T09:00:00Z', case: { id: 'd1', title: 'M. K. — Kıdem ve İhbar Tazminatı', case_number: '2026/0001' } },
];

const finans = [
  { id: 'f1', owner_id: KULLANICI_ID, kind: 'income', category: 'fee', title: 'İnşaat Firması — 2. taksit', amount: 60000, entry_date: gunEkle(-6).slice(0, 10), is_recurring: false, recurring_until: null, note: null, vat_rate: 20, withholding_rate: 20, vat_amount: 12000, withholding_amount: 12000, net_total: 60000, receipt_no: 'ÖRNEK-01', receipt_issued: true, created_at: gunEkle(-6) },
  { id: 'f2', owner_id: KULLANICI_ID, kind: 'income', category: 'fee', title: 'M. K. — peşinat', amount: 20000, entry_date: gunEkle(-14).slice(0, 10), is_recurring: false, recurring_until: null, note: null, vat_rate: 20, withholding_rate: 20, vat_amount: 4000, withholding_amount: 4000, net_total: 20000, receipt_no: 'ÖRNEK-02', receipt_issued: true, created_at: gunEkle(-14) },
  // GEÇEN AY KAYITLARI — 16.09.2026'da eklendi. Öncesinde pano üç kutuda birden
  // "%0 geçen aya göre" yazıyordu: kıyaslanacak önceki ay verisi yoktu. Mağaza
  // görselinde üç sıfır yan yana, çalışmayan bir özellik gibi duruyordu.
  { id: 'f4', owner_id: KULLANICI_ID, kind: 'income', category: 'fee', title: 'Z. A. — vekâlet ücreti', amount: 45000, entry_date: gunEkle(-38).slice(0, 10), is_recurring: false, recurring_until: null, note: null, vat_rate: 20, withholding_rate: 20, vat_amount: 9000, withholding_amount: 9000, net_total: 45000, receipt_no: 'ÖRNEK-03', receipt_issued: true, created_at: gunEkle(-38) },
  { id: 'f5', owner_id: KULLANICI_ID, kind: 'expense', category: 'office', title: 'Büro kirası', amount: 28000, entry_date: gunEkle(-40).slice(0, 10), is_recurring: true, recurring_until: null, note: null, vat_rate: null, withholding_rate: null, vat_amount: null, withholding_amount: null, net_total: 28000, receipt_no: null, receipt_issued: false, created_at: gunEkle(-40) },
  { id: 'f6', owner_id: KULLANICI_ID, kind: 'expense', category: 'other', title: 'Bilirkişi ücreti', amount: 6500, entry_date: gunEkle(-44).slice(0, 10), is_recurring: false, recurring_until: null, note: null, vat_rate: null, withholding_rate: null, vat_amount: null, withholding_amount: null, net_total: 6500, receipt_no: null, receipt_issued: false, created_at: gunEkle(-44) },
  { id: 'f3', owner_id: KULLANICI_ID, kind: 'expense', category: 'office', title: 'Büro kirası', amount: 28000, entry_date: gunEkle(-10).slice(0, 10), is_recurring: true, recurring_until: null, note: null, vat_rate: null, withholding_rate: null, vat_amount: null, withholding_amount: null, net_total: 28000, receipt_no: null, receipt_issued: false, created_at: gunEkle(-10) },
];

const zamanKayitlari = [
  { id: 'z1', owner_id: KULLANICI_ID, case_id: 'd1', description: 'Bilirkişi raporu incelendi, itiraz noktaları çıkarıldı', minutes: 95, worked_at: gunEkle(-1), billable: true, hourly_rate: 3000, amount: 4750, created_at: gunEkle(-1) },
  { id: 'z2', owner_id: KULLANICI_ID, case_id: 'd1', description: 'Müvekkil görüşmesi', minutes: 45, worked_at: gunEkle(-3), billable: true, hourly_rate: 3000, amount: 2250, created_at: gunEkle(-3) },
  { id: 'z3', owner_id: KULLANICI_ID, case_id: 'd1', description: 'Tanık listesi hazırlığı', minutes: 30, worked_at: gunEkle(-6), billable: false, hourly_rate: null, amount: 0, created_at: gunEkle(-6) },
];

/** Tablo adına göre sahte satırlar. */
const TABLOLAR = {
  cases: davalar,
  clients: musteriler,
  hearings: durusmalar,
  deadlines: sureler,
  finance_entries: finans,
  time_entries: zamanKayitlari,
  documents: [],
  payments: [],
  case_expenses: [],
  case_installments: [],
  payment_promises: [],
  client_advances: [],
  client_expenses: [],
  enforcement_files: [],
  enforcement_collections: [],
  powers_of_attorney: [],
  kvkk_onay: [{ id: 'k1', user_id: KULLANICI_ID, onay: true, created_at: '2026-01-04T09:00:00Z' }],
  ai_kontor: [],
  ai_usage: [],
  oturum_cihazlari: [],
  profiles: [profil],
};

/* ---------------- Sahte JWT ---------------- */
// NEDEN GEREKLİ. İlk denemede access_token olarak düz 'sahte' metni yazıldı ve
// oturum tanınmadı: supabase-js belirteci JWT olarak ÇÖZÜYOR (süre ve kullanıcı
// bilgisi için). Çözemeyince oturumu geçersiz sayıp giriş ekranına düşüyor.
// İmza doğrulanmıyor — bütün ağ istekleri zaten yakalanıyor — ama BİÇİM
// geçerli olmak zorunda.
function b64url(nesne) {
  return Buffer.from(JSON.stringify(nesne)).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const SON_KULLANMA = Math.floor(Date.now() / 1000) + 3600;
const SAHTE_JWT = [
  b64url({ alg: 'HS256', typ: 'JWT' }),
  b64url({
    aud: 'authenticated', role: 'authenticated', sub: KULLANICI_ID,
    email: profil.email, exp: SON_KULLANMA, iat: Math.floor(Date.now() / 1000),
    iss: `https://${PROJE}/auth/v1`, session_id: 'ornek',
  }),
  'imza-dogrulanmiyor',
].join('.');

/* ---------------- Yerel sunucu ---------------- */

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.woff2': 'font/woff2',
};

const sunucu = createServer(async (istek, cevap) => {
  let yol = decodeURIComponent(istek.url.split('?')[0]);
  // PAKET `/app/...` ÖN EKİYLE İSTENİYOR. docs/app, GitHub Pages'te
  // vekilpro.app/app altında duruyor ve index.html mutlak yol yazıyor
  // (`/app/_expo/...`). Bu ön ek soyulmazsa .js istekleri dosyayı bulamaz,
  // index.html'e düşer ve tarayıcı "Unexpected token '<'" der — ilk denemede
  // tam olarak bu oldu ve altı ekran da açılış ekranı olarak çekildi.
  if (yol.startsWith('/app/')) yol = yol.slice(4);
  else if (yol === '/app') yol = '/';
  if (yol === '/' || !extname(yol)) yol = '/index.html';
  try {
    const icerik = await readFile(join(WEB, yol));
    cevap.writeHead(200, { 'Content-Type': MIME[extname(yol)] ?? 'application/octet-stream' });
    cevap.end(icerik);
  } catch {
    // expo-router derin yolları index.html'e düşer
    try {
      cevap.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      cevap.end(await readFile(join(WEB, 'index.html')));
    } catch {
      cevap.writeHead(404).end('yok');
    }
  }
});

/* ---------------- Çekim ---------------- */

const EKRANLAR = (process.env.VP_EKRANLAR
  ? process.env.VP_EKRANLAR.split(',').map((y) => ({ ad: y.replace(/\W+/g, '-').replace(/^-|-$/g, '') || 'kok', yol: y, bekle: 2600 }))
  : null) ?? [
  { ad: '01-pano', yol: '/', bekle: 2600 },
  { ad: '02-davalar', yol: '/cases', bekle: 2200 },
  { ad: '03-takvim', yol: '/calendar', bekle: 2200 },
  { ad: '04-dava-detay', yol: '/cases/d1', bekle: 2600 },
  { ad: '05-finans', yol: '/finance', bekle: 2400 },
  { ad: '06-ictihat', yol: '/ictihat', bekle: 2000 },
];

/* ---------------- Türkçe büyük harf taraması (VP_TARA=1) ---------------- */
//
// NEDEN BU DÜZENEĞİN İÇİNDE. CSS `text-transform: uppercase` dil bilmez:
// Türkçe "i" harfini "I" yapar, "İ" değil. Hata GÖZLE aranınca kaçıyor —
// 14.09.2026'da pano ("AKTIF DOSYA"), 15.09.2026'da dava listesi ("KRITIK")
// ve yan menü ("ARAÇLAR VE YÖNETIM") ayrı ayrı, aylar sonra fark edildi.
//
// KAÇIRILAN İLK DENEME, KAYDA GEÇİYOR: taramayı önce BOŞ veriyle koşan ayrı
// bir betik olarak yazdım ve "3 hata var" dedim. Oysa veriye bağlı ekranlar
// (rozetler, "SIRADAKI" başlığı) boş veriyle hiç çizilmiyor — yani en çok
// görünen hatalar taramanın dışında kalmıştı. Bu yüzden tarama, SAHTE VERİSİ
// zaten dolu olan bu düzeneğin içine taşındı.
//
// NE ÖLÇER: DOM'daki metin orijinaldir (büyütme yalnız görsel). Bir öğeye
// uppercase uygulanıyorsa ve metninde küçük "i" varsa, ekranda mutlaka yanlış
// harf çıkar. Bu deterministiktir — tekrar koşulunca aynı sonucu verir.
//
// NE ÖLÇMEZ: yalnız GEZİLEN ekranları ve o an EKRANDA OLAN öğeleri görür.
// Açılmamış bir kip, boş liste, hata durumu taranmaz. "Temiz" çıkması
// "hiç yok" demek değildir; "gezilenlerde yok" demektir.
const TARA = !!process.env.VP_TARA;
const buyukHarfBulgu = new Map();

function buyukHarfTara(sayfa) {
  return sayfa.evaluate(() => {
    const cikti = [];
    for (const el of document.querySelectorAll('*')) {
      if (getComputedStyle(el).textTransform !== 'uppercase') continue;
      // Yalnız kendi metnini taşıyan yaprak öğeler — aksi hâlde aynı metin
      // her ata öğe için tekrar sayılır.
      const metin = Array.from(el.childNodes)
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent)
        .join('')
        .trim();
      if (metin && /i/.test(metin)) cikti.push(metin);
    }
    return cikti;
  }).catch(() => []);
}

async function main() {
  await new Promise((c) => sunucu.listen(PORT, c));
  console.log(`sunucu: http://127.0.0.1:${PORT}`);

  const tarayici = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  // Play telefon ekran görüntüsü: 9:16, en az 320px. 1080x1920 standart.
  const baglam = await tarayici.newContext({
    viewport: {
      width: Number(process.env.VP_GENISLIK ?? 412),
      height: Number(process.env.VP_YUKSEKLIK ?? 915),
    },
    // 412*2.62 ≈ 1080 → Play'in istediği genişlik. Masaüstü incelemesinde 1.
    deviceScaleFactor: Number(process.env.VP_OLCEK ?? 2.62),
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
  });

  // ⚠️ SIRA KRİTİK. Playwright'ta SON kaydedilen rota ÖNCE eşleşir. Bu genel
  // kural Supabase taklidinden ÖNCE kaydedilmek zorunda; sonra kaydedilirse
  // taklidi ezer, Supabase istekleri gerçek ağa çıkar ve ekranlar boş kalır.
  // İlk denemede tam olarak bu oldu: oturum açıldı ama hiçbir veri gelmedi.
  await baglam.route('**', async (rota) => {
    const u = rota.request().url();
    if (u.includes('127.0.0.1') || u.startsWith('data:') || u.startsWith('blob:')) return rota.continue();
    return rota.abort();
  });

  // Supabase'in tamamı taklit ediliyor — ağa hiç çıkılmıyor.
  await baglam.route(`**://${PROJE}/**`, async (rota) => {
    const istek = rota.request();
    const url = new URL(istek.url());
    const kabul = istek.headers()['accept'] ?? '';
    const tekil = kabul.includes('vnd.pgrst.object');
    const json = (govde, durum = 200) =>
      rota.fulfill({ status: durum, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(govde) });

    if (istek.method() === 'OPTIONS') {
      return rota.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    }

    // PROFİL RPC'DEN GELİYOR — tabloyu taklit etmek yetmez.
    if (url.pathname.endsWith('/rest/v1/rpc/my_profile')) return json(profil);
    if (url.pathname.includes('/rest/v1/rpc/')) return json([]);

    // İÇTİHAT UÇ İŞLEVİ — 16.09.2026'da eklendi.
    // "Davana Emsal" kartı ve içtihat ekranı `functions.invoke('ictihat')`
    // çağırıyor; bu yol taklit edilmediği için kart mağaza görselinde
    // "Bu konuda emsal karar bulunamadı" yazıyordu. Bir ARAMA ürününün
    // vitrininde boş sonuç, ürünün en kötü tanıtımıdır.
    // Buradaki kararlar KURGUDUR — gerçek karar metni mağazaya konulamaz.
    if (url.pathname.includes('/functions/v1/ictihat')) {
      return json({
        hits: [
          { id: 'y1', daire: '9. Hukuk Dairesi', esasNo: '2024/8812', kararNo: '2025/1043', kararTarihi: '2025-01-22', durum: 'Kesinleşti', src: 'yargitay', outcome: 'Bozma', matched: true,
            snippet: 'Kıdem tazminatına esas ücretin belirlenmesinde, işçinin son ücreti ile birlikte süreklilik arz eden ikramiye ve sosyal yardımların da dikkate alınması gerekir.' },
          { id: 'y2', daire: '22. Hukuk Dairesi', esasNo: '2024/6190', kararNo: '2024/14785', kararTarihi: '2024-11-08', durum: 'Kesinleşti', src: 'yargitay', outcome: 'Onama', matched: true,
            snippet: 'İhbar önelinin kullandırılmadığı hâllerde, ihbar tazminatının brüt ücret üzerinden hesaplanması ve fesih tarihindeki ücretin esas alınması yerindedir.' },
          { id: 'y3', daire: '9. Hukuk Dairesi', esasNo: '2023/15402', kararNo: '2024/3311', kararTarihi: '2024-03-14', durum: 'Kesinleşti', src: 'emsal', outcome: 'Bozma', matched: true,
            snippet: 'İşyeri devri hâlinde devralan işveren, devir tarihinden önce doğmuş işçilik alacaklarından devreden ile birlikte müteselsilen sorumludur.' },
        ],
        total: 3,
      });
    }

    if (url.pathname.includes('/auth/v1/')) {
      return json({
        access_token: SAHTE_JWT, token_type: 'bearer', expires_in: 3600,
        expires_at: SON_KULLANMA, refresh_token: 'yenile',
        user: { id: KULLANICI_ID, email: profil.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-04T09:00:00Z' },
      });
    }

    const m = url.pathname.match(/\/rest\/v1\/([a-z_]+)/);
    if (m) {
      let satirlar = TABLOLAR[m[1]] ?? [];
      // id=eq.X süzgeci — dava detayı bunu kullanıyor.
      const idSuzgec = url.searchParams.get('id');
      if (idSuzgec?.startsWith('eq.')) {
        const hedef = idSuzgec.slice(3);
        satirlar = satirlar.filter((r) => r.id === hedef);
      }
      const caseSuzgec = url.searchParams.get('case_id');
      if (caseSuzgec?.startsWith('eq.')) {
        satirlar = satirlar.filter((r) => r.case_id === caseSuzgec.slice(3));
      }
      // TEKİL İSTEK TEK NESNE İSTER; dizi dönerse ekran boş kalır.
      return json(tekil ? (satirlar[0] ?? {}) : satirlar);
    }

    return json([]);
  });

  const sayfa = await baglam.newPage();
  // Sessiz başarısızlık bir daha olmasın: sayfa hatası varsa konsola düşsün.
  const hatalar = [];
  sayfa.on('pageerror', (e) => hatalar.push(String(e).split('\n')[0]));
  sayfa.on('console', (m) => { if (m.type() === 'error') hatalar.push(m.text().slice(0, 120)); });

  // Oturumu önceden yaz: giriş ekranı yerine doğrudan panoya düşsün.
  // Anahtar adı paketten OKUNDU: `sb-${hostname.split('.')[0]}-auth-token`.
  // OTURUM AÇMADAN ÇEKİM — VP_GIRISSIZ=1.
  // Sebep: giriş/kayıt/şifre ekranları oturum açıkken hiç görünmüyordu, bu
  // yüzden onlardaki hatalar (ör. 15.09.2026'da bildirilen kesik "Şifremi
  // unuttum" bağlantısı) render edilip incelenemiyordu.
  if (!process.env.VP_GIRISSIZ) await sayfa.addInitScript(
    ([id, eposta, jwt, exp, anahtar]) => {
      const oturum = {
        access_token: jwt, token_type: 'bearer', expires_in: 3600,
        expires_at: exp, refresh_token: 'yenile',
        user: { id, email: eposta, aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-04T09:00:00Z' },
      };
      localStorage.setItem(anahtar, JSON.stringify(oturum));
      localStorage.setItem('vekil-kilit', JSON.stringify({ acik: false }));
    },
    [KULLANICI_ID, profil.email, SAHTE_JWT, SON_KULLANMA, `sb-${PROJE.split('.')[0]}-auth-token`],
  );

  // TEMA SEÇİMİ — VP_TEMA=terminal-light gibi.
  //
  // YORUM İKİ KEZ DÜZELTİLDİ, ÇÜNÜKÜ İKİ KEZ ESKİDİ — bu satırlar
  // varsayılan tema her değiştiğinde GÜNCELLENMELİ:
  //   16.09.2026 → "Klasik (açık)" yazıyordu, varsayılan `terminal` olmuştu.
  //   18.09.2026 → `terminal` yazıyordu, varsayılan `dark` (Gece) oldu.
  // Bugünkü doğru hâli: varsayılan `dark` — bkz. themeStore.ts >
  // ACILIS_TEMASI. Yani mağaza görselleri için ARTIK VP_TEMA VERMEYE GEREK
  // YOK; uygulamanın kendi açılış teması zaten vitrindeki temadır.
  //
  // VP_TEMA VERİLMEZSE uygulamanın KENDİ varsayılanı çekilir, yani yeni bir
  // kullanıcının ilk açılışta gördüğü hâl. Mağaza görselinde doğrusu genelde
  // budur; başka bir tema çekmek, indiren kişinin göreceğinden farklı bir
  // vitrin göstermek olur.
  // Anahtar `src/theme/themeStore.ts` içindeki STORAGE_KEY ile aynı olmalı;
  // AsyncStorage web'de anahtarı olduğu gibi localStorage'a yazıyor
  // (yukarıdaki 'vekil-kilit' de aynı yoldan yazılıyor).
  if (process.env.VP_TEMA) {
    await sayfa.addInitScript((tema) => {
      localStorage.setItem('vekil-theme', tema);
    }, process.env.VP_TEMA);
  }

  for (const ekran of EKRANLAR) {
    try {
      await sayfa.goto(`http://127.0.0.1:${PORT}/app${ekran.yol}`, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // AÇILIŞ ANİMASYONU HER SAYFA YÜKLEMESİNDE BAŞTAN OYNUYOR.
      // `hasPlayed` modül düzeyinde tutuluyor ama goto sayfayı yeniden
      // yüklediği için modül de sıfırlanıyor.
      //
      // İKİ AŞAMALI BEKLEME ŞART. Yalnız "slogan kayboldu mu" diye bakmak
      // İŞE YARAMADI: animasyon fontlar yüklendikten sonra monte oluyor,
      // yani kontrol anında metin henüz DOM'da değil, koşul hemen doğru
      // çıkıyor ve kare tam animasyonun ortasında çekiliyordu. Önce
      // BELİRMESİNİ, sonra KAYBOLMASINI bekliyoruz (LaunchIntro perde
      // bitince setVisible(false) ile kendini DOM'dan kaldırıyor).
      const slogan = () => document.body.innerText.toUpperCase().includes('BÜRONUZ CEBİNİZDE');
      await sayfa.waitForFunction(slogan, { timeout: 10000 }).catch(() => {});
      await sayfa
        .waitForFunction(() => !document.body.innerText.toUpperCase().includes('BÜRONUZ CEBİNİZDE'), { timeout: 20000 })
        .catch(() => console.log('    (açılış perdesi kalkmadı — kare erken çekilmiş olabilir)'));

      await sayfa.waitForTimeout(ekran.bekle);

      if (TARA) {
        for (const m of await buyukHarfTara(sayfa)) {
          if (!buyukHarfBulgu.has(m)) buyukHarfBulgu.set(m, new Set());
          buyukHarfBulgu.get(m).add(ekran.yol);
        }
        console.log(`  · ${ekran.ad} tarandı`);
        continue;
      }

      const dosya = join(CIKTI, `${ekran.ad}.png`);
      await sayfa.screenshot({ path: dosya });
      console.log(`  ✓ ${ekran.ad}.png${hatalar.length ? '  ⚠ ' + hatalar[0] : ''}`);
      hatalar.length = 0;
    } catch (e) {
      console.log(`  ✗ ${ekran.ad}: ${e.message.split('\n')[0]}`);
    }
  }

  await tarayici.close();
  sunucu.close();

  if (TARA) {
    console.log('\nTÜRKÇE BÜYÜK HARF TARAMASI\n');
    if (buyukHarfBulgu.size === 0) {
      console.log('  Temiz — CSS ile büyütülüp içinde "i" geçen metin yok.');
      return;
    }
    for (const [metin, yollar] of [...buyukHarfBulgu].sort()) {
      console.log(`  "${metin}"`);
      console.log(`      ekranda çıkan : ${metin.toUpperCase()}`);
      console.log(`      olması gereken: ${metin.toLocaleUpperCase('tr-TR')}`);
      console.log(`      görüldüğü yer : ${[...yollar].join(', ')}\n`);
    }
    process.exitCode = 1;
    return;
  }
  console.log('bitti →', CIKTI);
}

main().catch((e) => { console.error(e); process.exit(1); });
