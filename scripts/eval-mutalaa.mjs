// Mütalaa üretimi ölçümü.
// ---------------------------------------------------------------------------
// NEDEN AYRI BİR ÖLÇÜM. "İşimi hızlandırsın" beklentisinin üç ayağı var:
// dilekçe, MÜTALAA ve belge inceleme. Dilekçe ölçülüyordu; mütalaa bugüne
// kadar HİÇ ölçülmedi. Ölçülmeyen bir özellik hakkında "iyi" ya da "kötü"
// demek tahmindir — ve bu üründe tahminle karar vermenin bedeli, avukatın
// güvendiği bir metnin yanlış çıkmasıdır.
//
// MÜTALAA DİLEKÇEDEN FARKLI BİR İŞ YAPAR ve ölçütü de farklıdır. Dilekçede
// avukat ne isteyeceğini biliyordur; ölçülen şey BİÇİMİN eksiksizliğidir
// (HMK m.119 unsurları). Mütalaada ise avukat henüz KARAR VERMEMİŞTİR;
// ölçülmesi gereken, metnin karar verdirip verdirmediğidir:
//
//   1) KAÇIRILMAMASI GEREKEN — o olayda gözden kaçarsa hak kaybı doğuran
//      unsur (işe iadede bir aylık arabuluculuk süresi, kambiyoda beş gün...).
//      Eksikse mütalaa "güzel yazılmış" ama işe yaramaz.
//   2) UYDURMA VERİ — anlatılmayan tarih/tutar. Dilekçedekiyle aynı denetim.
//   3) UYDURMA MADDE — havuzumuzda bulunan bir kanuna yapılan ama O KANUNDA
//      OLMAYAN madde atfı. Bunu ölçebiliyoruz çünkü 17 kanunun tam metni
//      elimizde; "TBK m.999" gibi bir atıf mekanik olarak yakalanır.
//      Havuzda olmayan kanunlara yapılan atıflar SAYILMAZ: orada eksik olan
//      bizim korpusumuzdur, modelin atfı değil.
//   4) YAPI — mütalaa altı bölümlü sabit bir iskeletle isteniyor; bölüm
//      düşerse avukat aradığını bulamaz.
//   5) ADIMLARDA SÜRE — "ATILACAK ADIMLAR" bölümü süre içermiyorsa mütalaa
//      tavsiye değil, deneme yazısıdır.
//
// Kullanım:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... \
//   node scripts/eval-mutalaa.mjs
//
// EVAL_BEKLEME  senaryolar arası bekleme (vars. 30000). Mütalaa ÇOK ADIMLIDIR
//               (sorun çıkarma + her sorun için araştırma + sentez): tek
//               senaryo, bir dilekçenin birkaç katı token yakar. Aralık kısa
//               olursa ölçtüğümüz şey modelin kalitesi değil, sağlayıcının o
//               anki kotası olur.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { yeniKunye } from './olcum-kunyesi.mjs';
import { beklemeSuresi } from './bekleme.mjs';
import { gecer, sadelestir } from './eslestir.mjs';
import { istek, Butce, ParaButcesi } from './istek.mjs';
import { maddeAtiflari, mesruTutarlar, tarihler, tutarlar } from './uydurma.mjs';
import { adimlarBolumu, eksikBolumler, sureIceriyor } from './mutalaa-olcut.mjs';

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

const BEKLEME = Number(process.env.EVAL_BEKLEME ?? 30000);
// BÜTÇELİ UYKU. Tek bir 429, bekleme.mjs'in 30 dakikalık üst sınırı ve 6
// denemeyle birlikte TEK soruyu 3 saate kadar uzatabiliyor; işin tavanı ise
// 120 dakika. Sonuç yalnız SONDA yazıldığı için tavana çarpan koşudan elde
// hiçbir ölçüm kalmıyor — 2026-09-11'de mütalaa tam olarak böyle kayboldu
// (14 dakika koştu, hiçbir şey yazılmadı).
// Artık uyku kalan bütçeyi aşamaz; bütçe dolunca ölçüm, o ana kadar ölçtüğünü
// RAPORLAYARAK durur. Ayrıntılı teşhis ve o gün yaptığım YANLIŞ teşhisin
// düzeltmesi: scripts/istek.mjs başlığı.
const butce = new Butce();
const uyu = (ms) => new Promise((r) => setTimeout(r, Math.min(ms, butce.kalan())));

const EPOSTA = `eval-mutalaa-${Date.now()}@vekil.local`;
const SIFRE = `Ev!${Math.random().toString(36).slice(2)}A9`;

const svcBaslik = { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json' };

async function kullaniciAc() {
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: svcBaslik,
    body: JSON.stringify({ email: EPOSTA, password: SIFRE, email_confirm: true }),
  });
  if (!res.ok) throw new Error(`kullanıcı açılamadı: ${res.status}`);
  return (await res.json()).id;
}

/**
 * MÜTALAA ÜCRETLİ KATMANA AÇIKTIR (pro/elit/ai). Ölçüm kullanıcısı varsayılan
 * katmanda kalırsa uç 403 tier_required döner ve ölçüm "model kötü" değil
 * "yetki yok" yüzünden çöker. Katman ölçüm için elle yükseltilir; sağlayıcı
 * yine ücretsiz hattadır (anahtar yoksa tierConfig Groq'a düşürür).
 */
async function katmaniYukselt(uid) {
  // PATCH, satır YOKSA da 200 döner ve hiçbir şey değiştirmez. Sessiz
  // başarısızlık burada ölçümün tamamını yanlış okuturdu: katman yükselmemiş
  // olur, uç 403 verir ve "mütalaa çalışmıyor" sanılırdı. Bu yüzden dönen
  // temsil OKUNUR ve boşsa satır açılır.
  const res = await fetch(`${url}/rest/v1/profiles?id=eq.${uid}&select=id,ai_tier`, {
    method: 'PATCH',
    headers: { ...svcBaslik, Prefer: 'return=representation' },
    body: JSON.stringify({ ai_tier: 'ai' }),
  });
  if (!res.ok) throw new Error(`katman yükseltilemedi: ${res.status} ${(await res.text()).slice(0, 120)}`);
  const satir = await res.json();
  if (Array.isArray(satir) && satir.length > 0) return;

  const ins = await fetch(`${url}/rest/v1/profiles?select=id,ai_tier`, {
    method: 'POST',
    headers: { ...svcBaslik, Prefer: 'return=representation,resolution=merge-duplicates' },
    body: JSON.stringify({ id: uid, ai_tier: 'ai' }),
  });
  if (!ins.ok) throw new Error(`profil açılamadı: ${ins.status} ${(await ins.text()).slice(0, 160)}`);
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

/** Havuzdaki (kanun, madde) çiftleri — uydurma madde denetiminin dayanağı. */
async function maddeKumesi() {
  const kume = new Set();
  const kanunlar = new Set();
  for (let sayfa = 0; ; sayfa++) {
    const res = await fetch(
      `${url}/rest/v1/mevzuat_maddeleri?select=kanun_short,madde_no&limit=1000&offset=${sayfa * 1000}`,
      { headers: { apikey: svc, Authorization: `Bearer ${svc}` } }
    );
    if (!res.ok) throw new Error(`madde listesi alınamadı: ${res.status}`);
    const d = await res.json();
    for (const m of d) {
      kume.add(`${m.kanun_short}#${String(m.madde_no).trim()}`);
      kanunlar.add(m.kanun_short);
    }
    if (d.length < 1000) break;
  }
  return { kume, kanunlar };
}

async function uret(olay, deneme = 0) {
  // JETON HER DENEMEDE TAZELENİR. Kota beklemesi tek bir senaryoda 30 dakikayı
  // bulabiliyor; jetonun ömrü bir saat. Denemeler arasında tazelenmezse ölçüm,
  // modelle ilgisi olmayan bir 401 yüzünden yarıda kalır.
  const jwt = await jwtAl();
  const res = await istek(`${url}/functions/v1/ai-chat`, {
    method: 'POST',
    headers: { apikey: anon, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'mutalaa', question: olay }),
  });
  if (res.status === 403) throw new Error(`YETKI: ${(await res.text()).slice(0, 120)}`);
  if (res.status === 429) {
    const g = await res.text();
    // KOTA KAYAN PENCEREYLE YENİLENİYOR. Uç, gövdede "kaç saniye sonra"
    // diyorsa beklemek ölçümü kurtarır: eskiden burada koşu tamamen
    // kesiliyor ve 10 senaryonun 4'ünden sonrası hiç ölçülmüyordu.
    const bekle = beklemeSuresi(g);
    if (bekle && deneme < 6) {
      console.log(`    (kota doldu; ${Math.round(bekle / 60000)} dk bekleniyor)`);
      await uyu(bekle);
      return uret(olay, deneme + 1);
    }
    if (g.includes('daily_quota')) throw new Error('DAILY_QUOTA');
    if (deneme < 4) {
      await uyu(30000 * (deneme + 1));
      return uret(olay, deneme + 1);
    }
  }
  // SAĞLAYICI ARIZASI DAKİKALAR SÜREBİLİR. Bekleme 20-80 saniyeydi ve ölçümde
  // yetmedi: Groq ile Gemini aynı anda düştü (biri 5xx, diğeri "high demand"),
  // dört deneme üç dakikaya sığdı ve senaryo ölçülemedi. Koşu zaten saatler
  // sürüyor; birkaç dakika beklemek bir senaryoyu kurtarmaya değer.
  if (res.status >= 500 && deneme < 5) {
    await uyu(120000 * (deneme + 1));
    return uret(olay, deneme + 1);
  }
  if (!res.ok) throw new Error(`ai-chat ${res.status}: ${(await res.text()).slice(0, 140)}`);
  const j = await res.json();
  // Yedek mevzuat özeti mütalaa DEĞİLDİR; model cevabı sayılırsa ölçüm modelin
  // değil sağlayıcı yoğunluğunun fotoğrafını çeker.
  if (j?.yapayZekasiz || j?.model === 'mevzuat-yedek') {
    if (deneme < 4) {
      await uyu(30000 * (deneme + 1));
      return uret(olay, deneme + 1);
    }
    throw new Error('YEDEK_OZET');
  }
  // Hangi model cevapladı: ücretsiz hat Groq'tan Gemini'ye düşebiliyor ve
  // "kalite düştü" ile "yedeğe inildi" ancak böyle ayırt edilir.
  // SUNUCUNUN KENDİ KORUMALARI DA KAYDA GEÇER. Uydurma madde atfı ve dosyaya
  // girip mütalaada izi bulunmayan kural, uçta denetleniyor ve avukata
  // gösteriliyor. Ölçüm bunları kaydetmezse "senaryo kaldı" ile "koruma
  // çalıştı, avukat uyarıldı" ayırt edilemez — yani ölçüm, kullanıcının
  // gerçekte ne gördüğünü ölçmüyor olur.
  //
  // dayanak: dosyaya giren kural özetleri. Bir senaryo kaldığında asıl soru
  // "kural havuzda var mıydı" değil, "dosyaya girdi mi ve model yok mu saydı"
  // sorusudur; ikisinin ayrımı düzeltmenin nereye yapılacağını belirler.
  return {
    metin: String(j?.text ?? ''),
    model: String(j?.model ?? '?'),
    uydurmaMadde: Array.isArray(j?.uydurmaMadde) ? j.uydurmaMadde : [],
    // Karar atfı denetimi (0117). `olanaksiz` kusurdur; `havuzdaYok` değildir.
    kararDenetimi: j?.kararDenetimi ?? null,
    atlananKural: Array.isArray(j?.atlananKural) ? j.atlananKural : [],
    dayanak: Array.isArray(j?.dayanak) ? j.dayanak.map((k) => k?.id).filter(Boolean) : [],
    // KULLANIM BİLGİSİ (token + maliyet). Mütalaa çok adımlı ama adımlar UÇTA
    // koşuyor; dönen kullanim tüm adımların toplamı. Ölçüm bunu ATIYORDU ve
    // künye maliyeti bu alandan topladığı için rapor satırı bugüne kadar her
    // koşuda "₺0.00" yazdı — bu bir ölçüm değil, atılmış bir alandı.
    kullanim: j?.kullanim ?? { model: j?.model },
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
// NEDEN VAR. Bir kusuru düzeltip DOĞRULAMAK için tüm havuzu koşmak gerekmiyor;
// gereken, kusurlu senaryoları koşmak. Tam koşu saatler sürüyor ve günlük
// kotanın büyük kısmını yakıyor — yani "düzelttim mi?" sorusunun cevabı ertesi
// güne kalıyordu. Düzeltmeyle ölçüm arasındaki süre uzadıkça, düzeltmenin işe
// yarayıp yaramadığı bilinmeden yenisi yazılıyor.
const SECIM = (process.env.EVAL_SENARYO ?? '').split(',').map((x) => x.trim()).filter(Boolean);
const { senaryolar: tumSenaryolar } = JSON.parse(readFileSync(join(__dirname, 'mutalaa-senaryolari.json'), 'utf8'));
if (SECIM.length) {
  // Yazım hatası sessizce "sıfır senaryo" olmamalı: saatlerce koşup hiçbir şey
  // ölçmemenin en sinsi yolu, olmayan bir kimlik yazmaktır.
  const bilinmeyen = SECIM.filter((k) => !tumSenaryolar.some((x) => x.id === k));
  if (bilinmeyen.length) throw new Error(`bilinmeyen senaryo: ${bilinmeyen.join(', ')}`);
}
const secilen = SECIM.length ? tumSenaryolar.filter((x) => SECIM.includes(x.id)) : tumSenaryolar;
const senaryolar = SINIR > 0 ? secilen.slice(0, SINIR) : secilen;

// PARA BÜTÇESİ — süre bütçesinin parasal eşi. 11 Eylül 2026'da 5 dolarlık API
// kredisi tek koşuda tükendi: o gün yalnız duvar saati sayılıyordu, parayı
// sayan hiçbir şey yoktu. EVAL_PARA_BUTCESI (TL) verilmezse sınırsız çalışır
// ama harcama yine de raporlanır — görünmeyen harcama, yakılan harcamadır.
const para = new ParaButcesi(Number(process.env.EVAL_PARA_BUTCESI ?? 0), senaryolar.length);

let uid = null;
const sonuclar = [];
const kusurlu = [];

try {
  const { kume, kanunlar } = await maddeKumesi();
  console.log(`Havuz: ${kume.size} madde · ${kanunlar.size} kanun`);

  uid = await kullaniciAc();
  await katmaniYukselt(uid);
  const jwt = await jwtAl();
  console.log(`Mütalaa ölçümü · ${senaryolar.length} senaryo\n`);

  let ilk = true;
  for (const s of senaryolar) {
    // BÜTÇE KONTROLÜ — eksik ölçüm, hiç ölçümden iyidir; ama eksik olduğu
    // SÖYLENMEK zorunda, yoksa oran düşük çıkar ve gerileme sanılır.
    if (butce.doldu() || para.doldu()) {
      console.error(
        `\nBÜTÇE DOLDU (${butce.satir()} · ${para.satir()}) — kalan senaryolar ÖLÇÜLMEDİ.\n` +
          'Bu koşudan oran ÇIKARMAYIN: ölçülen kalite değil, ayrılan süre ve paradır.'
      );
      process.exitCode = 2;
      break;
    }
    if (!ilk) await uyu(BEKLEME);
    ilk = false;

    let metin;
    let kullanilanModel = '?';
    let uydurmaMaddeUyari = [];
    let kararUyari = null;
    let atlananKuralUyari = [];
    let dayanakKurallar = [];
    let kullanimBilgisi = null;
    try {
      ({
        metin,
        model: kullanilanModel,
        uydurmaMadde: uydurmaMaddeUyari,
        kararDenetimi: kararUyari,
        atlananKural: atlananKuralUyari,
        dayanak: dayanakKurallar,
        kullanim: kullanimBilgisi,
      } = await uret(s.olay));
      kunye.gor(kullanimBilgisi ?? { model: kullanilanModel });
      para.gor(kullanimBilgisi);
      // ÖN YOKLAMA — yalnız İLK ölçülen istekten sonra. Tüm koşunun öngörülen
      // maliyeti tavanı aşıyorsa burada dururuz: 11 Eylül'de eksik olan tam
      // olarak buydu — tek senaryonun maliyeti ölçülmeden tam koşu başlatıldı.
      if (para.olculen === 1) {
        const o = para.ongoru();
        if (o) {
          console.log(`ÖN YOKLAMA: ilk senaryo ₺${para.harcanan.toFixed(2)} · ${senaryolar.length} senaryo için öngörü ₺${o.ongoru.toFixed(2)}`);
          if (o.asar) {
            console.error(
              `\nKOŞU DURDURULDU — öngörülen maliyet (₺${o.ongoru.toFixed(2)}) tavanı (₺${para.tavan.toFixed(2)}) aşıyor.\n` +
                'Tavanı yükseltin ya da EVAL_SINIR ile senaryo sayısını düşürün. Ölçülen tek senaryo raporda.'
            );
            process.exitCode = 2;
            break;
          }
        } else if (para.tavan > 0) {
          // KÖR KOŞMAK YASAK. Buraya düşmek "maliyet sıfır" demek değil,
          // "sunucu hiçbir kullanım bilgisi göndermedi" demektir — yani
          // harcamayı izleyemiyoruz. Para tavanı İSTENMİŞKEN ücretli modeli
          // kör koşturmak, 5 doları yakan davranışın aynısıdır.
          console.error(
            '\nKOŞU DURDURULDU — sunucu kullanım/maliyet bilgisi döndürmedi, harcama İZLENEMİYOR.\n' +
              'Bu SIFIR HARCAMA DEĞİLDİR. Tavanı bilerek kaldırmak için EVAL_PARA_BUTCESI=0 verin.'
          );
          process.exitCode = 2;
          break;
        } else {
          console.error('UYARI: sunucu kullanım/maliyet bilgisi döndürmedi — harcama İZLENEMİYOR (tavan yok, devam ediliyor).');
        }
      }
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

    const sade = sadelestir(metin);
    const kacan = (s.kacirilmamali ?? []).filter((k) => !gecer(metin, k));
    const yasak = (s.olmamali ?? []).filter((k) => gecer(metin, k));
    const eksikBolum = eksikBolumler(sade);

    // MÜTALAADA TARİH HESAPLAMAK İŞİN KENDİSİDİR. Dilekçede olayda geçmeyen
    // her tarih uydurma sayılır ve ayıklanır; burada tersi geçerli: "fesih
    // 14.04.2026, bir aylık süre 14.05.2026'da doluyor" cümlesi mütalaanın ta
    // kendisi. Bunları başarısızlık saymak, doğru çalışan bir özelliği kusurlu
    // göstermek olurdu — nitekim ilk koşuda tam bu oldu.
    //
    // Onun yerine iki şey yapılıyor: hesaplanan tarihler RAPORLANIR (avukat
    // teyit etsin diye arayüz de bunu gösteriyor) ve senaryo BEKLENEN bir tarih
    // bildirdiyse onun metinde geçmesi ARANIR — asıl ölçülmesi gereken bu.
    const olayTarih = tarihler(s.olay);
    const hesaplananTarih = [...tarihler(metin)].filter((t) => !olayTarih.has(t));
    const eksikTarih = (s.beklenenTarih ?? []).filter((t) => !metin.includes(t));
    const mesru = mesruTutarlar(tutarlar(s.olay));
    const uydurmaTutar = [...tutarlar(metin)].filter((t) => !mesru.has(t));

    // Havuzda BULUNAN bir kanuna yapılıp o kanunda OLMAYAN madde atfı.
    const uydurmaMadde = maddeAtiflari(metin)
      .filter((a) => kanunlar.has(a.kanun) && !kume.has(`${a.kanun}#${a.madde}`))
      .map((a) => `${a.kanun} m.${a.madde}`);

    const adimlar = adimlarBolumu(sade);
    const adimdaSure = sureIceriyor(adimlar);

    const gecti =
      kacan.length === 0 &&
      yasak.length === 0 &&
      eksikBolum.length === 0 &&
      eksikTarih.length === 0 &&
      uydurmaMadde.length === 0 &&
      (kararUyari?.olanaksiz?.length ?? 0) === 0 &&
      adimdaSure;

    sonuclar.push({ id: s.id, gecti, kacan, yasak, eksikBolum, hesaplananTarih, eksikTarih, uydurmaTutar, uydurmaMadde, adimdaSure, uzunluk: metin.length });

    console.log(`${gecti ? '✓' : '✗'} ${s.id}  ${metin.length} krktr · ${kullanilanModel}`);
    if (dayanakKurallar.length) console.log(`    DOSYAYA GİREN KURAL: ${dayanakKurallar.join(', ')}`);
    if (atlananKuralUyari.length) console.log(`    SUNUCU UYARDI (atlanan kural): ${atlananKuralUyari.join(', ')}`);
    if (uydurmaMaddeUyari.length) console.log(`    SUNUCU UYARDI (uydurma madde): ${uydurmaMaddeUyari.join(', ')}`);
    if (kacan.length) console.log(`    KAÇIRILAN   : ${kacan.join(' | ')}`);
    if (yasak.length) console.log(`    OLMAMALIYDI : ${yasak.join(' | ')}`);
    if (eksikBolum.length) console.log(`    EKSİK BÖLÜM : ${eksikBolum.join(', ')}`);
    if (eksikTarih.length) console.log(`    HESAPLANMAMIŞ SÜRE: ${eksikTarih.join(', ')} (beklenen tarih metinde yok)`);
    if (hesaplananTarih.length) console.log(`    (hesaplanan tarih: ${hesaplananTarih.join(', ')} — avukat teyit etmeli)`);
    if (uydurmaTutar.length) console.log(`    UYDURMA TUTAR: ${uydurmaTutar.join(', ')}`);
    if (uydurmaMadde.length) console.log(`    UYDURMA MADDE: ${uydurmaMadde.join(', ')}`);
    if (kararUyari?.olanaksiz?.length) console.log(`    OLANAKSIZ KARAR ATFI: ${kararUyari.olanaksiz.map((o) => `${o.atif} (${o.sebep})`).join(', ')}`);
    if (kararUyari?.havuzdaYok?.length) console.log(`    havuzda bulunamayan karar atfı (kusur değil): ${kararUyari.havuzdaYok.join(', ')}`);
    if (!adimdaSure) console.log('    ADIMLARDA SÜRE YOK (tavsiye değil, deneme yazısı)');
    if (!gecti) kusurlu.push({ id: s.id, kacan, yasak, eksikBolum, hesaplananTarih, eksikTarih, uydurmaTutar, uydurmaMadde, metin });
  }
} finally {
  await kullaniciSil(uid);
}

if (kusurlu.length) {
  const yol = join(__dirname, 'eval-mutalaa-hatalar.json');
  writeFileSync(yol, JSON.stringify(kunye.ozet({ kusurlu }), null, 1), 'utf8');
  console.log(`\nKusurlu mütalaaların tam metni: ${yol}`);
}

const olculen = sonuclar.length;
const gecen = sonuclar.filter((s) => s.gecti).length;
const kacirilan = sonuclar.reduce((t, s) => t + s.kacan.length, 0);
const maddeUydurma = sonuclar.filter((s) => s.uydurmaMadde.length).length;

console.log('\n' + '─'.repeat(60));
console.log(kunye.satir());
// HARCAMA HER KOŞUDA YAZILIR. Görünmeyen harcama, yakılan harcamadır: 11 Eylül
// 2026'da rapor "₺0,00" yazdığı için 5 dolarlık kredinin bittiği ancak
// sağlayıcı panelinden anlaşıldı.
console.log(`HARCAMA: ${para.satir()}`);
console.log(`MÜTALAA: ${gecen}/${olculen} senaryo tam geçti (%${olculen ? ((gecen / olculen) * 100).toFixed(1) : 0})` +
  (olculen < tumSenaryolar.length ? ` — havuzdaki ${tumSenaryolar.length} senaryonun ${olculen} tanesi ölçüldü` : ''));
console.log(`Kaçırılan kritik unsur: ${kacirilan}`);
console.log(`Havuzda olmayan maddeye atıf yapan mütalaa: ${maddeUydurma}/${olculen}`);
