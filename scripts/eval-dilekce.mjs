// Dilekçe üretimi ölçümü.
// ---------------------------------------------------------------------------
// NEDEN AYRI BİR ÖLÇÜM. Dilekçe, programın en çok zaman kazandırması gereken
// yeri; ama "iyi görünüyor" ile "mahkemeye verilebilir" arasındaki fark
// gözle okuyarak ölçülemez. Burada üç şey ayrı ayrı puanlanır:
//
//   1) ZORUNLU UNSUR — usul kanununun aradığı içerik var mı (HMK m.119 dava
//      değeri, netice-i talep, deliller...). Eksikse dilekçe ihtarı gelir.
//   2) UYDURMA — taslakta, avukatın ANLATMADIĞI bir tarih ya da tutar var mı.
//      İlk ölçümde model, verilmeyen bir sözleşme tarihi ("01.02.2026") ve
//      ihtar tarihi ("30.09.2026") uydurup netice-i talebe taşıdı. Avukat fark
//      etmezse mahkemeye YANLIŞ TARİH sunar; bu, biçim hatasından ağırdır.
//   3) BOŞLUK DÜRÜSTLÜĞÜ — bilinmeyen bilgi köşeli parantezle bırakılmış mı.
//
// Kullanım:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... \
//   node scripts/eval-dilekce.mjs
//
// EVAL_BEKLEME  sorular arası bekleme (vars. 25000). Ücretsiz sağlayıcılar
//               hızlı ardışık isteklerde birlikte throttle oluyor; kısa
//               aralık, modelin değil sağlayıcının ölçülmesine yol açar.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { yeniKunye } from './olcum-kunyesi.mjs';
import { beklemeSuresi } from './bekleme.mjs';
import { gecer, sadelestir } from './eslestir.mjs';
import { istek, Butce } from './istek.mjs';
// Tarih/tutar ayıklayıcıları AYRI MODÜLDE ve TESTLİ: bu denetim, ölçümün en
// ağır kararını veriyor ("bu taslakta uydurma veri var"). Buradan taşınırken
// gerçek bir kör nokta çıktı: kuruşlu yazılan tutar ("36.000,00 TL") hiç
// eşleşmiyordu, yani resmî dilekçe dilindeki tutarların çoğu denetlenmiyordu.
import { mesruTutarlar, tarihler, tutarlar } from './uydurma.mjs';
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
// BÜTÇELİ UYKU — ölçülen arıza (2026-09-11, koşu 34635964721): tek bir 429,
// bekleme.mjs'in 30 dakikalık üst sınırı ve 6 denemeyle birlikte, TEK soruyu
// 3 saate kadar uzatabiliyordu. İşin tavanı 120 dakika olduğu için koşu
// öldürülüyor ve sonuç yalnız SONDA yazıldığından elde HİÇBİR ölçüm kalmıyordu.
// Artık uyku kalan bütçeyi aşamaz; bütçe dolunca ölçüm, o ana kadar ölçtüğünü
// RAPORLAYARAK durur — sessizce bir saat beklemek yerine.
const butce = new Butce();
const uyu = (ms) => new Promise((r) => setTimeout(r, Math.min(ms, butce.kalan())));

const EPOSTA = `eval-dilekce-${Date.now()}@vekil.local`;
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

async function uret(tip, olay, deneme = 0) {
  // JETON HER DENEMEDE TAZELENİR. Kota beklemesi tek bir senaryoda 30 dakikayı
  // bulabiliyor; jetonun ömrü bir saat. Denemeler arasında tazelenmezse ölçüm,
  // modelle ilgisi olmayan bir 401 yüzünden yarıda kalır.
  const jwt = await jwtAl();
  const res = await istek(`${url}/functions/v1/ai-chat`, {
    method: 'POST',
    headers: { apikey: anon, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'dilekce', dilekceType: tip, question: olay }),
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
      return uret(tip, olay, deneme + 1);
    }
    if (g.includes('daily_quota')) throw new Error('DAILY_QUOTA');
    if (deneme < 4) {
      await uyu(30000 * (deneme + 1));
      return uret(tip, olay, deneme + 1);
    }
  }
  // 502 'upstream' DA GEÇİCİDİR ve yeniden denenmelidir. İlk koşuda 5
  // senaryonun 3'ü buna takıldı; ölçüm modelin değil, o anki sağlayıcı
  // durumunun fotoğrafını çekti ve "0/2" gibi anlamsız bir oran çıktı.
  // SAĞLAYICI ARIZASI DAKİKALAR SÜREBİLİR. Bekleme 20-80 saniyeydi ve ölçümde
  // yetmedi: Groq ile Gemini aynı anda düştü (biri 5xx, diğeri "high demand"),
  // dört deneme üç dakikaya sığdı ve senaryo ölçülemedi. Koşu zaten saatler
  // sürüyor; birkaç dakika beklemek bir senaryoyu kurtarmaya değer.
  if (res.status >= 500 && deneme < 5) {
    await uyu(120000 * (deneme + 1));
    return uret(tip, olay, deneme + 1);
  }
  if (!res.ok) throw new Error(`ai-chat ${res.status}: ${(await res.text()).slice(0, 140)}`);
  const j = await res.json();
  // Yedek mevzuat özeti dilekçe DEĞİLDİR; model cevabı sayılırsa ölçüm
  // modelin değil sağlayıcı yoğunluğunun fotoğrafını çeker (bkz. eval-cevap).
  if (j?.yapayZekasiz || j?.model === 'mevzuat-yedek') {
    if (deneme < 4) {
      await uyu(30000 * (deneme + 1));
      return uret(tip, olay, deneme + 1);
    }
    throw new Error('YEDEK_OZET');
  }
  // HANGİ MODELİN CEVAPLADIĞI KAYDA GEÇER. Ücretsiz hat Groq'tan Gemini'ye
  // düşebiliyor ve iki modelin çıktısı aynı kalitede değil; hangisinin
  // ölçüldüğü bilinmezse "kalite düştü" ile "yedeğe inildi" ayırt edilemez.
  //
  // SUNUCUNUN KENDİ UYARILARI da alınır: kanun yolu dilekçelerinde talep
  // cümlesi denetimi (istinafta "kaldırılması", temyizde "bozulması") uçta
  // yapılıyor. Ölçüm bunu kaydetmezse "senaryo kaldı" ile "koruma çalıştı"
  // ayırt edilemez — yani korumanın işe yarayıp yaramadığı bilinmez.
  return {
    metin: String(j?.text ?? ''),
    model: String(j?.model ?? '?'),
    talepEksik: Array.isArray(j?.talepEksik) ? j.talepEksik : [],
    // Uydurma madde atfı denetimi (havuzdaki kanunun olmayan maddesi) kayda
    // geçer: korumanın işe yarayıp yaramadığı ancak ölçümde görünürse bilinir.
    //
    // ATLANAN KURAL UYARISI DİLEKÇEDE KALDIRILDI. Dört senaryoluk koşuda üç
    // uyarı çıktı ve üçü de konu dışıydı (istinafta "arabulucu", bilirkişi
    // itirazında ve düplikte "def'i"). Dilekçe hedefli bir belgedir; komşu bir
    // kuralın orada geçmemesi normaldir. Denetim mütalaada kalıyor.
    uydurmaMadde: Array.isArray(j?.uydurmaMadde) ? j.uydurmaMadde : [],
    // Çakışan dayanak denetimi (alternatif iki kuralın birlikte dayanak
    // gösterilmesi). Talimatla tutarlı gideremediğimiz bir arıza için mekanik
    // denetim; ölçümde bunun ateşleyip ateşlemediği görünmezse "koruma
    // çalıştı" ile "kimse fark etmedi" ayırt edilemez.
    cakisanDayanak: Array.isArray(j?.cakisanDayanak) ? j.cakisanDayanak : [],
  };
}

// EVAL_SINIR: kaç senaryo koşulacak (vars. hepsi).
//
// NEDEN VAR. Ücretsiz kota günde 200.000 token ve tek koşu saatler sürüyor;
// kota bitmişken tam koşu başlatmak, hiçbir şey ölçmeden saat harcamak demek.
// Az sayıda senaryoyu ÖLÇMEK, çok sayıda senaryoyu ölçememekten iyidir —
// yeter ki oranın kaç senaryodan çıktığı raporda görünsün.
const SINIR = Number(process.env.EVAL_SINIR ?? 0);

// EVAL_SENARYO: virgülle ayrılmış senaryo kimlikleri (vars. hepsi).
//
// NEDEN VAR. Bir kusuru düzeltip DOĞRULAMAK için on senaryoyu birden koşmak
// gerekmiyor; gereken, kusurlu iki senaryoyu koşmak. Tam koşu saatler sürüyor
// ve günlük kotanın büyük kısmını yakıyor — yani "düzelttim mi?" sorusunun
// cevabı ertesi güne kalıyordu. Düzeltmeyle ölçüm arasındaki süre uzadıkça
// düzeltmenin işe yarayıp yaramadığı bilinmeden yenisi yazılıyor.
//
// SINIR ile birlikte kullanılabilir; önce kimlik süzgeci uygulanır.
const SECIM = (process.env.EVAL_SENARYO ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const { senaryolar: tumSenaryolar } = JSON.parse(readFileSync(join(__dirname, 'dilekce-senaryolari.json'), 'utf8'));
if (SECIM.length) {
  // Yazım hatası sessizce "sıfır senaryo" olmamalı: saatlerce koşup hiçbir şey
  // ölçmemenin en sinsi yolu, olmayan bir kimlik yazmaktır.
  const bilinmeyen = SECIM.filter((k) => !tumSenaryolar.some((s) => s.id === k));
  if (bilinmeyen.length) throw new Error(`bilinmeyen senaryo: ${bilinmeyen.join(', ')}`);
}
const secilen = SECIM.length ? tumSenaryolar.filter((s) => SECIM.includes(s.id)) : tumSenaryolar;
const senaryolar = SINIR > 0 ? secilen.slice(0, SINIR) : secilen;

let uid = null;
const sonuclar = [];
const kusurlu = [];

try {
  uid = await kullaniciAc();
  // Ön kontrol: oturum açılamıyorsa saatler sürecek koşuyu hiç başlatma.
  await jwtAl();
  console.log(`Dilekçe ölçümü · ${senaryolar.length} senaryo\n`);

  let ilk = true;
  for (const s of senaryolar) {
    // BÜTÇE KONTROLÜ — eksik ölçüm, hiç ölçümden iyidir; ama eksik olduğu
    // SÖYLENMEK zorunda, yoksa oran düşük çıkar ve gerileme sanılır.
    if (butce.doldu()) {
      console.error(
        `\nBÜTÇE DOLDU (${butce.satir()}) — kalan senaryolar ÖLÇÜLMEDİ.\n` +
          'Bu koşudan oran ÇIKARMAYIN: ölçülen kalite değil, ayrılan süredir.'
      );
      process.exitCode = 2;
      break;
    }
    if (!ilk) await uyu(BEKLEME);
    ilk = false;

    let taslak;
    let kullanilanModel = '?';
    let talepUyari = [];
    let uydurmaMaddeUyari = [];
    let cakisanUyari = [];
    try {
      ({
        metin: taslak,
        model: kullanilanModel,
        talepEksik: talepUyari,
        uydurmaMadde: uydurmaMaddeUyari,
        cakisanDayanak: cakisanUyari,
      } = await uret(s.tip, s.olay));
      // Künyeye HER istekte besle: koşu ortasında model değişirse (sağlayıcı
      // yedeğe düştü, katman değişti) sonuç tek modele atfedilemez ve künye
      // bunu karisikModel ile işaretler.
      kunye.gor({ model: kullanilanModel });
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

    const eksik = (s.icermeli ?? []).filter((k) => !gecer(taslak, k));
    // "OLMAMALI" DENETİMİ YALNIZ ANA GÖVDEDE YAPILIR, KONTROL LİSTESİNDE DEĞİL.
    //
    // ÖLÇÜLEN YANLIŞ POZİTİF: kira tahliye senaryosunda model artık HUKUKİ
    // SEBEPLER'de yalnız doğru dayanağı (temerrüt, TBK m.315) kullanıyordu;
    // yasak ifade ("iki haklı ihtar") yalnız KONTROL LİSTESİ'nde, "bu şart
    // KARŞILANMIYOR" uyarısı olarak geçiyordu. Bu, hata değil DOĞRU davranış
    // — model ayrımı yapıp avukatı uyarıyor. Ölçüt bunu ayırt edemediği için
    // "düzelmedi" sanılabilirdi; ölçütün kendisi yanlıştı, çözüm değil.
    //
    // Kontrol listesi avukata yönelik bir uyarı bölümüdür ve doğası gereği
    // "bu doğru değil / bu şart yok" gibi olumsuzlamalar içerir; ana gövdedeki
    // (dayanak olarak sunulan) bir ifadeyle karıştırılmamalı.
    const govde = taslak.split(/⚠️?\s*KONTROL LİSTESİ/)[0];
    const yasak = (s.icermemeli ?? []).filter((k) => gecer(govde, k));

    // UYDURMA: taslaktaki tarih/tutar, olayda geçmiyorsa uydurulmuştur.
    const olayTarih = tarihler(s.olay);
    const uydurmaTarih = [...tarihler(taslak)].filter((t) => !olayTarih.has(t));
    const olayTutar = tutarlar(s.olay);
    // Toplamlar meşrudur (3 × 12.000 = 36.000); olaydaki tutarların katları
    // ve toplamları uydurma sayılmaz.
    const mesruTutar = mesruTutarlar(olayTutar);
    const uydurmaTutar = [...tutarlar(taslak)].filter((t) => !mesruTutar.has(t));

    const bosluk = (taslak.match(/\[[^\]]{2,40}\]/g) ?? []).length;

    const gecti = eksik.length === 0 && yasak.length === 0 && uydurmaTarih.length === 0;
    sonuclar.push({ id: s.id, gecti, eksik, yasak, uydurmaTarih, uydurmaTutar, bosluk, model: kullanilanModel, uzunluk: taslak.length, talepUyari, uydurmaMaddeUyari });

    console.log(`${gecti ? '✓' : '✗'} ${s.id} (${s.tip})  ${taslak.length} krktr · ${bosluk} boşluk · ${kullanilanModel}`);
    if (eksik.length) console.log(`    EKSİK UNSUR : ${eksik.join(' | ')}`);
    if (yasak.length) console.log(`    OLMAMALIYDI : ${yasak.join(' | ')}`);
    // Sunucu korumasının çalışıp çalışmadığı: senaryo kalsa bile avukat uyarıyı
    // görüyorsa dilekçe kör teslim edilmiyor demektir.
    if (talepUyari.length) console.log(`    SUNUCU UYARDI: ${talepUyari.join(' | ')}`);
    if (uydurmaMaddeUyari.length) console.log(`    SUNUCU UYARDI (uydurma madde): ${uydurmaMaddeUyari.join(', ')}`);
    if (cakisanUyari.length) console.log(`    SUNUCU UYARDI (çakışan dayanak): ${cakisanUyari.join(' | ')}`);
    if (uydurmaTarih.length) console.log(`    UYDURMA TARİH: ${uydurmaTarih.join(', ')}`);
    if (uydurmaTutar.length) console.log(`    UYDURMA TUTAR: ${uydurmaTutar.join(', ')}`);
    if (!gecti) kusurlu.push({ id: s.id, tip: s.tip, model: kullanilanModel, eksik, yasak, uydurmaTarih, uydurmaTutar, taslak });
  }
} finally {
  await kullaniciSil(uid);
}

// HATA DOSYASI HER KOŞUDA YAZILIR — kusur yoksa BOŞ olarak.
//
// Eskiden yalnız kusur varken yazılıyordu ve bu, dosyayı yalancı yapıyordu:
// istinaf ile temyiz kusurları düzeltilip yeniden ölçüldükten sonra dosya hâlâ
// o iki kusuru anlatıyordu. Bir sonraki okuyan (yarınki ben dahil) düzeltilmiş
// bir arızayı açık sanır ve ya boşuna uğraşır ya da düzelmediğini sanıp
// raporlar. Hangi senaryoların ölçüldüğü de yazılıyor: "kusur yok" ile
// "o senaryo hiç koşulmadı" ayırt edilebilsin.
{
  const yol = join(__dirname, 'eval-dilekce-hatalar.json');
  writeFileSync(
    yol,
    JSON.stringify(
      kunye.ozet({ olculenSenaryolar: sonuclar.map((s) => s.id), kusurlu }),
      null,
      1
    ),
    'utf8'
  );
  if (kusurlu.length) console.log(`\nKusurlu taslakların tam metni: ${yol}`);
}

const olculen = sonuclar.length;
const gecen = sonuclar.filter((s) => s.gecti).length;
const uydurmali = sonuclar.filter((s) => s.uydurmaTarih.length || s.uydurmaTutar.length).length;
const unsurEksik = sonuclar.reduce((t, s) => t + s.eksik.length, 0);

console.log('\n' + '─'.repeat(60));
console.log(kunye.satir());
console.log(`DİLEKÇE: ${gecen}/${olculen} senaryo tam geçti (%${olculen ? ((gecen / olculen) * 100).toFixed(1) : 0})` +
  (olculen < tumSenaryolar.length ? ` — havuzdaki ${tumSenaryolar.length} senaryonun ${olculen} tanesi ölçüldü` : ''));
console.log(`Uydurma veri içeren taslak: ${uydurmali}/${olculen}`);
console.log(`Toplam eksik zorunlu unsur: ${unsurEksik}`);
