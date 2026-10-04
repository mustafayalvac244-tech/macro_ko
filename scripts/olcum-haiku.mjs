// HAIKU ÖLÇÜMÜ — 04.10.2026, ürün sahibi: "ölçelim ama en fazla 1 dolar kullan,
// olabildiğince verimli; cevaplardan çıkarım yapacaksın".
//
// Her iş Haiku 4.5'e geçtikten sonra (PR #143) tek koşuda: 3 sohbet sorusu,
// 1 dilekçe, aynı dilekçeye 1 yapay zekâ düzeltmesi, 2. sayfası TARANMIŞ
// (yalnız görüntü) bir PDF ile 1 belge incelemesi, 1 hukuki araştırma.
// Cevapların TAM METNİ yazılır (scripts/olcum-haiku-sonuc.json): değerlendirme
// mekanik puanla değil, cevaplar okunarak yapılacak. Senaryoları ben seçtim;
// bu bağımsız bir sınav değildir.
//
// PARA TAVANI: OLCUM_TL_TAVANI (varsayılan ₺40 ≈ 0,95 $, kur 42). Maliyet
// cevaptaki token sayılarından Haiku fiyatıyla ($1/$5 per M) HESAPLANIR —
// sunucunun maliyetTL'si kusurlu cevapta 0 yazar, harcamayı gizlerdi.
// Bir sonraki istekten önce harcanan + ₺4 tavanı aşacaksa durulur.
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anon || !svc) throw new Error('SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY gerekli');

const KUR = 42;
// Fiyat ($/M girdi, çıktı) cevaptaki modele göre; bilinmeyen model en pahalıdan.
const FIYAT = { 'claude-haiku-4-5-20251001': [1, 5], 'claude-sonnet-5': [2, 10] };
const TAVAN_TL = Number(process.env.OLCUM_TL_TAVANI ?? process.env.EVAL_PARA_BUTCESI ?? 40);
const PAY_TL = 4; // bir isteğin üst tahmini — ölçülmedi, tavanı aşmamak için pay
// Sonuç dosyası çağrılan betiğin adından: olcum-sonnet.mjs -> olcum-sonnet-sonuc.json.
const SONUC = join(__dirname, `${basename(process.argv[1] ?? 'olcum-haiku', '.mjs')}-sonuc.json`);

const EPOSTA = `olcum-haiku-${Date.now()}@vekil.local`;
const SIFRE = `Ol!${Math.random().toString(36).slice(2)}A9`;
const sonuclar = [];
let harcananTL = 0;

const kaydet = () =>
  writeFileSync(SONUC, JSON.stringify({ tarih: new Date().toISOString(), tavanTL: TAVAN_TL, harcananTL: Math.round(harcananTL * 100) / 100, sonuclar }, null, 1), 'utf8');

async function kullaniciAc() {
  const r = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json' },
    // KVKK yurt dışı rızası kayıt tetikleyicisiyle yazılır (0128).
    body: JSON.stringify({ email: EPOSTA, password: SIFRE, email_confirm: true, user_metadata: { kvkk_riza: true, kvkk_surum: 'olcum' } }),
  });
  if (!r.ok) throw new Error(`kullanıcı açılamadı: ${r.status} ${(await r.text()).slice(0, 200)}`);
  const id = (await r.json()).id;
  const k = await fetch(`${url}/rest/v1/profiles?id=eq.${id}`, {
    method: 'PATCH',
    headers: { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ ai_tier: 'ai' }),
  });
  if (!k.ok) throw new Error(`katman ayarlanamadı: ${k.status}`);
  return id;
}

async function jwt() {
  const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EPOSTA, password: SIFRE }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('oturum açılamadı');
  return j.access_token;
}

async function cagir(islev, govde) {
  const t0 = Date.now();
  const r = await fetch(`${url}/functions/v1/${islev}`, {
    method: 'POST',
    headers: { apikey: anon, Authorization: `Bearer ${await jwt()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(govde),
    signal: AbortSignal.timeout(200_000),
  });
  const ms = Date.now() - t0;
  let veri = null;
  try { veri = await r.json(); } catch { veri = null; }
  return { durum: r.status, ms, veri };
}

/** Yapay zekâ isteği: tavan denetimi + maliyet + tam metin kaydı. */
async function ai(tur, id, govde, not = '') {
  if (harcananTL + PAY_TL > TAVAN_TL) {
    console.log(`ATLANDI (tavan): ${tur}/${id}`);
    sonuclar.push({ tur, id, atlandi: 'para tavanı' });
    kaydet();
    return null;
  }
  const { durum, ms, veri } = await cagir('ai-chat', govde);
  const k = veri?.kullanim ?? {};
  const [fg, fc] = FIYAT[veri?.model ?? k.model] ?? [5, 25];
  const tl = (((k.girdiToken ?? 0) / 1e6) * fg + ((k.ciktiToken ?? 0) / 1e6) * fc) * KUR;
  harcananTL += tl;
  const kayit = {
    tur, id, not, durum, sureSn: Math.round(ms / 100) / 10,
    model: veri?.model ?? k.model ?? null,
    girdiToken: k.girdiToken ?? null, ciktiToken: k.ciktiToken ?? null,
    hesaplananTL: Math.round(tl * 100) / 100,
    karakter: (veri?.text ?? '').length,
    hata: veri?.error ?? null,
    uyarilar: {
      ayiklananTarih: veri?.ayiklananTarih, uydurmaMadde: veri?.uydurmaMadde, uydurmaTutar: veri?.uydurmaTutar,
      kararDenetimi: veri?.kararDenetimi, eksikBolum: veri?.eksikBolum, talepEksik: veri?.talepEksik,
      ekUyari: veri?.ekUyari, hakDusulmedi: veri?.hakDusulmedi, kisaKaldi: veri?.kisaKaldi,
    },
    metin: veri?.text ?? null,
  };
  sonuclar.push(kayit);
  kaydet();
  console.log(`${tur}/${id}: HTTP ${durum}, ${kayit.sureSn} sn, ${kayit.model}, ${kayit.girdiToken}/${kayit.ciktiToken} token, ₺${kayit.hesaplananTL} (toplam ₺${harcananTL.toFixed(2)})`);
  return veri;
}

const oku = (ad) => JSON.parse(readFileSync(join(__dirname, ad), 'utf8'));
const sohbetler = oku('sohbet-senaryolari.json').senaryolar;
const dilekceler = oku('dilekce-senaryolari.json').senaryolar;
const mutalaalar = oku('mutalaa-senaryolari.json').senaryolar;

let uid = null;
try {
  uid = await kullaniciAc();
  console.log('Test kullanıcısı açıldı (ai katmanı, rıza var).');

  // 1) Sohbet — doğrusu bilinen üç soru: süre, kavram farkı, tarih hesabı.
  for (const id of ['tek-bilgi-istinaf-suresi', 'tek-bilgi-kavram-farki', 'gorev-sure-hesabi']) {
    const s = sohbetler.find((x) => x.id === id);
    await ai('sohbet', id, { messages: [{ role: 'user', text: s.soru }] }, s.soru);
  }

  // 2) Dilekçe + 3) aynı taslağa yapay zekâ düzeltmesi.
  const d = dilekceler.find((x) => x.id === 'dava-kira-tahliye');
  const dil = await ai('dilekce', d.id, { mode: 'dilekce', dilekceType: d.tip, question: d.olay }, d.olay);
  if (dil?.text) {
    const talimat = 'Netice-i talepte tahliye talebini birinci sıraya al ve dilekçenin en sonuna "EKLER" başlığı altında "1- Kira sözleşmesi, 2- Noter ihtarnamesi ve tebliğ şerhi" listesini ekle.';
    await ai('duzelt', d.id, { mode: 'duzelt', question: talimat, taslak: dil.text, kaynak: d.olay }, talimat);
  }

  // 4) Belge incelemesi — 2 sayfalık PDF; 2. sayfa yalnız GÖRÜNTÜ (Madde 7-9:
  // süresiz rekabet yasağı orada). Metin çıkarımı ücretsiz (doc-extract).
  const pdf = readFileSync(join(__dirname, 'olcum-ornek-sozlesme.pdf')).toString('base64');
  const cik = await cagir('doc-extract', { filename: 'olcum-ornek-sozlesme.pdf', base64: pdf });
  const c = cik.veri ?? {};
  console.log(`doc-extract: HTTP ${cik.durum}, sayfa ${c.sayfa}, okunamayan ${JSON.stringify(c.okunamayanSayfa ?? [])}`);
  sonuclar.push({ tur: 'doc-extract', durum: cik.durum, sayfa: c.sayfa, okunamayanSayfa: c.okunamayanSayfa ?? [], metinIcindeRekabet: /rekabet/i.test(c.text ?? '') });
  await ai('belge', 'pdf-taranmis-sayfa', {
    mode: 'belge', docKind: 'sozlesme', question: '',
    ekler: [{ ad: 'sozlesme.pdf', metin: c.text ?? '', pdf, sayfa: c.sayfa ?? 2, taranmis: (c.okunamayanSayfa ?? []).length }],
  }, '2. sayfa taranmış: Madde 7 (süresiz rekabet yasağı) yalnız görüntüde.');

  // 5) Hukuki araştırma (çok adımlı).
  const m = mutalaalar[0];
  await ai('mutalaa', m.id, { mode: 'mutalaa', question: m.olay }, m.olay);
} catch (e) {
  console.log('HATA:', e.message);
  sonuclar.push({ hata: e.message });
} finally {
  kaydet();
  if (uid) {
    await fetch(`${url}/auth/v1/admin/users/${uid}`, { method: 'DELETE', headers: { apikey: svc, Authorization: `Bearer ${svc}` } }).catch(() => {});
  }
  console.log(`Bitti. Hesaplanan toplam harcama ₺${harcananTL.toFixed(2)} (tavan ₺${TAVAN_TL}). Sonuç: ${SONUC}`);
}
