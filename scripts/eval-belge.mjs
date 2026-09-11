// Belge inceleme ölçümü.
// ---------------------------------------------------------------------------
// NEDEN AYRI BİR ÖLÇÜM. "İşimi hızlandırsın" beklentisinin üçüncü ayağı belge
// incelemedir ve bugüne kadar hiç ölçülmedi. Avukat bu ekrana, belgeyi baştan
// sona okumaya vakti olmadığı için gelir: incelemenin işi, riski ve süreyi
// ONUN YERİNE görmektir. Görmezse özellik zaman kazandırmaz, aksine yanlış
// bir güven verir.
//
// BELGELER ELİMİZDE YAZILDI, KUSURLAR BİLEREK YERLEŞTİRİLDİ. Böylece "doğru
// cevap" tartışmaya açık olmaz: sözleşmede tek taraflı fesih hakkının,
// kararda hüküm fıkrasında karara bağlanmamış faizin bulunduğunu biz
// biliyoruz. Gerçek bir müvekkil belgesiyle ölçüm yapılsaydı, modelin
// "kaçırdığı" şeyin gerçekten kusur olup olmadığı her seferinde tartışılırdı.
//
// ÖLÇÜLEN ÜÇ ŞEY:
//   1) YAKALAMA — yerleştirilmiş kusurları buldu mu.
//   2) UYDURMA TARİH — incelemede geçip BELGEDE OLMAYAN tarih. Bu, dilekçedeki
//      uydurma tarihten daha sinsidir: avukat belgeyi okuduğunu varsayar ve
//      incelemedeki tarihi ajandasına yazar.
//   3) YAPI — beş başlık (özet, riskler, eksikler, süreler, öneriler) yerinde
//      mi; biri düşerse avukat aradığını bulamaz.
//
// Kullanım:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... \
//   node scripts/eval-belge.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { yeniKunye } from './olcum-kunyesi.mjs';
import { beklemeSuresi } from './bekleme.mjs';
import { gecer, sadelestir } from './eslestir.mjs';
import { tarihler } from './uydurma.mjs';
import { katmanAyarla } from './eval-katman.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ÖLÇÜM KÜNYESİ: sonucun HANGİ MODELDEN geldiğini kaydeder.
// Bu olmadan "N kusur çıktı" cümlesi neyin N kusur verdiğini söylemiyor;
// sonuç ne karşılaştırılabilir ne tekrarlanabilir olur.
const kunye = yeniKunye();

const url = process.env.SUPABASE_URL ?? '';
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const anon = process.env.SUPABASE_ANON_KEY ?? '';
if (!url || !svc || !anon) {
  console.error('HATA: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY ve SUPABASE_ANON_KEY gerekli.');
  process.exit(1);
}

const BEKLEME = Number(process.env.EVAL_BEKLEME ?? 25000);
const uyu = (ms) => new Promise((r) => setTimeout(r, ms));

const EPOSTA = `eval-belge-${Date.now()}@vekil.local`;
const SIFRE = `Ev!${Math.random().toString(36).slice(2)}A9`;

async function kullaniciAc() {
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EPOSTA, password: SIFRE, email_confirm: true }),
  });
  if (!res.ok) throw new Error(`kullanıcı açılamadı: ${res.status}`);
  const uid = (await res.json()).id;
  // ÜCRETLİ KATMANA AL. Yoksa kullanıcı 'baslangic' kalır ve YAŞAM BOYU
  // 3 deneme hakkıyla sınırlanır; dördüncü senaryodan sonrası
  // "deneme_hakki_bitti" döner ve ölçüm kaliteyi değil KOTAYI ölçer.
  await katmanAyarla(url, svc, uid);
  return uid;
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

async function incele(kind, metin, deneme = 0) {
  // JETON HER DENEMEDE TAZELENİR. Kota beklemesi tek bir senaryoda 30 dakikayı
  // bulabiliyor; jetonun ömrü bir saat. Denemeler arasında tazelenmezse ölçüm,
  // modelle ilgisi olmayan bir 401 yüzünden yarıda kalır.
  const jwt = await jwtAl();
  const res = await fetch(`${url}/functions/v1/ai-chat`, {
    method: 'POST',
    headers: { apikey: anon, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'belge', docKind: kind, question: metin }),
  });
  if (res.status === 429) {
    const g = await res.text();
    // KOTA KAYAN PENCEREYLE YENİLENİYOR. Uç, gövdede "kaç saniye sonra"
    // diyorsa beklemek ölçümü kurtarır: eskiden burada koşu tamamen
    // kesiliyor ve 10 senaryonun 4'ünden sonrası hiç ölçülmüyordu.
    const bekle = beklemeSuresi(g);
    if (bekle && deneme < 6) {
      console.log(`    (kota doldu; ${Math.round(bekle / 60000)} dk bekleniyor)`);
      await uyu(bekle);
      return incele(kind, metin, deneme + 1);
    }
    if (g.includes('daily_quota')) throw new Error('DAILY_QUOTA');
    if (deneme < 4) {
      await uyu(30000 * (deneme + 1));
      return incele(kind, metin, deneme + 1);
    }
  }
  // SAĞLAYICI ARIZASI DAKİKALAR SÜREBİLİR. Bekleme 20-80 saniyeydi ve ölçümde
  // yetmedi: Groq ile Gemini aynı anda düştü (biri 5xx, diğeri "high demand"),
  // dört deneme üç dakikaya sığdı ve senaryo ölçülemedi. Koşu zaten saatler
  // sürüyor; birkaç dakika beklemek bir senaryoyu kurtarmaya değer.
  if (res.status >= 500 && deneme < 5) {
    await uyu(120000 * (deneme + 1));
    return incele(kind, metin, deneme + 1);
  }
  if (!res.ok) throw new Error(`ai-chat ${res.status}: ${(await res.text()).slice(0, 140)}`);
  const j = await res.json();
  kunye.gor({ model: j?.model });
  if (j?.yapayZekasiz || j?.model === 'mevzuat-yedek') {
    if (deneme < 4) {
      await uyu(30000 * (deneme + 1));
      return incele(kind, metin, deneme + 1);
    }
    throw new Error('YEDEK_OZET');
  }
  // Sunucunun uydurma madde denetimi de kayda geçer: koruma çalıştıysa
  // "senaryo kaldı" ile "avukat uyarıldı" ayırt edilebilsin.
  return {
    metin: String(j?.text ?? ''),
    ayiklananTarih: j?.ayiklananTarih ?? [],
    model: String(j?.model ?? '?'),
    uydurmaMadde: Array.isArray(j?.uydurmaMadde) ? j.uydurmaMadde : [],
  };
}

// Başlık denetimi SADELEŞTİRİLMİŞ metinde yapılır: JavaScript'in /i bayrağı
// Türkçe büyük İ'yi küçük i'ye eşlemez, "RİSKLER" hiçbir zaman eşleşmezdi.
const BASLIKLAR = [
  ['ozet', /ozet/],
  ['riskler', /risk/],
  ['eksikler', /eksik/],
  ['sureler', /sure/],
  ['oneriler', /oneri|degisiklik/],
];

// EVAL_SINIR: kaç senaryo koşulacak (vars. hepsi).
//
// NEDEN VAR. Ücretsiz kota günde 200.000 token ve tek koşu saatler sürüyor;
// kota bitmişken tam koşu başlatmak, hiçbir şey ölçmeden saat harcamak demek.
// Az sayıda senaryoyu ÖLÇMEK, çok sayıda senaryoyu ölçememekten iyidir —
// yeter ki oranın kaç senaryodan çıktığı raporda görünsün.
const SINIR = Number(process.env.EVAL_SINIR ?? 0);
// EVAL_SENARYO: virgülle ayrılmış senaryo kimlikleri (vars. hepsi).
//
// NEDEN VAR. Bir kusuru düzeltip DOĞRULAMAK için tüm havuzu koşmak gerekmiyor;
// gereken, kusurlu senaryoları koşmak. Tam koşu saatler sürüyor ve günlük
// kotanın büyük kısmını yakıyor — yani "düzelttim mi?" sorusunun cevabı ertesi
// güne kalıyordu. Düzeltmeyle ölçüm arasındaki süre uzadıkça, düzeltmenin işe
// yarayıp yaramadığı bilinmeden yenisi yazılıyor.
const SECIM = (process.env.EVAL_SENARYO ?? '').split(',').map((x) => x.trim()).filter(Boolean);
const { senaryolar: tumSenaryolar } = JSON.parse(readFileSync(join(__dirname, 'belge-senaryolari.json'), 'utf8'));
if (SECIM.length) {
  // Yazım hatası sessizce "sıfır senaryo" olmamalı: saatlerce koşup hiçbir şey
  // ölçmemenin en sinsi yolu, olmayan bir kimlik yazmaktır.
  const bilinmeyen = SECIM.filter((k) => !tumSenaryolar.some((x) => x.id === k));
  if (bilinmeyen.length) throw new Error(`bilinmeyen senaryo: ${bilinmeyen.join(', ')}`);
}
const secilen = SECIM.length ? tumSenaryolar.filter((x) => SECIM.includes(x.id)) : tumSenaryolar;
const senaryolar = SINIR > 0 ? secilen.slice(0, SINIR) : secilen;

let uid = null;
const sonuclar = [];
const kusurlu = [];

try {
  uid = await kullaniciAc();
  // Ön kontrol: oturum açılamıyorsa saatler sürecek koşuyu hiç başlatma.
  await jwtAl();
  console.log(`Belge inceleme ölçümü · ${senaryolar.length} senaryo\n`);

  let ilk = true;
  for (const s of senaryolar) {
    if (!ilk) await uyu(BEKLEME);
    ilk = false;

    let cikti;
    try {
      cikti = await incele(s.kind, s.metin);
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

    const inc = cikti.metin;
    const sade = sadelestir(inc);
    const kacan = (s.yakalamali ?? []).filter((k) => !gecer(inc, k));
    const yasak = (s.olmamali ?? []).filter((k) => gecer(inc, k));
    const eksikBaslik = BASLIKLAR.filter(([, d]) => !d.test(sade)).map(([ad]) => ad);

    const belgeTarih = tarihler(s.metin);
    const uydurmaTarih = [...tarihler(inc)].filter((t) => !belgeTarih.has(t));

    const gecti = kacan.length === 0 && yasak.length === 0 && eksikBaslik.length === 0 && uydurmaTarih.length === 0;
    sonuclar.push({ id: s.id, gecti, kacan, yasak, eksikBaslik, uydurmaTarih, ayiklanan: cikti.ayiklananTarih, uzunluk: inc.length });

    console.log(`${gecti ? '✓' : '✗'} ${s.id} (${s.kind})  ${inc.length} krktr · ${cikti.model}`);
    if (cikti.uydurmaMadde?.length) console.log(`    SUNUCU UYARDI (uydurma madde): ${cikti.uydurmaMadde.join(', ')}`);
    if (kacan.length) console.log(`    KAÇIRILAN KUSUR: ${kacan.join(' | ')}`);
    if (yasak.length) console.log(`    OLMAMALIYDI    : ${yasak.join(' | ')}`);
    if (eksikBaslik.length) console.log(`    EKSİK BAŞLIK   : ${eksikBaslik.join(', ')}`);
    if (uydurmaTarih.length) console.log(`    UYDURMA TARİH  : ${uydurmaTarih.join(', ')}`);
    // Sunucu, belgede olmayan tarihleri zaten ayıklıyor; ayıklananların sayısı
    // modelin ne sıklıkta tarih uydurmaya kalktığını gösterir.
    if ((cikti.ayiklananTarih ?? []).length) console.log(`    (sunucu ayıkladı: ${cikti.ayiklananTarih.join(', ')})`);
    if (!gecti) kusurlu.push({ id: s.id, kind: s.kind, kacan, yasak, eksikBaslik, uydurmaTarih, inceleme: inc });
  }
} finally {
  await kullaniciSil(uid);
}

if (kusurlu.length) {
  const yol = join(__dirname, 'eval-belge-hatalar.json');
  writeFileSync(yol, JSON.stringify(kunye.ozet({ kusurlu }), null, 1), 'utf8');
  console.log(`\nKusurlu incelemelerin tam metni: ${yol}`);
}

const olculen = sonuclar.length;
const gecen = sonuclar.filter((s) => s.gecti).length;
const kacirilan = sonuclar.reduce((t, s) => t + s.kacan.length, 0);
const tarihUyduran = sonuclar.filter((s) => s.uydurmaTarih.length).length;

console.log('\n' + '─'.repeat(60));
console.log(kunye.satir());
console.log(`BELGE: ${gecen}/${olculen} senaryo tam geçti (%${olculen ? ((gecen / olculen) * 100).toFixed(1) : 0})` +
  (olculen < tumSenaryolar.length ? ` — havuzdaki ${tumSenaryolar.length} senaryonun ${olculen} tanesi ölçüldü` : ''));
console.log(`Kaçırılan yerleştirilmiş kusur: ${kacirilan}`);
console.log(`Belgede olmayan tarih içeren inceleme: ${tarihUyduran}/${olculen}`);
