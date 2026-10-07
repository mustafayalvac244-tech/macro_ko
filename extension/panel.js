import { davaOlustur, oturumOku } from './lib/api.js';
import { doluSayisi, kunyeCikarYerel } from './lib/cikar.js';
import { sayfaIskeleti } from './lib/kesif.js';

const $ = (id) => document.getElementById(id);

function bilgi(m, sinif = '') {
  const b = $('bildirim');
  b.textContent = m;
  b.className = sinif;
  b.hidden = !m;
}

/**
 * Açık sekmenin görünen metnini okur.
 *
 * `activeTab` iznine dayanır: yalnız kullanıcı düğmeye bastığında ve yalnız
 * o sekmede çalışır. Arka planda dinleyen bir content script yoktur.
 */
async function sayfaMetni() {
  const [sekme] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!sekme?.id) throw new Error('sekme_yok');
  const [sonuc] = await chrome.scripting.executeScript({
    target: { tabId: sekme.id },
    func: () => document.body?.innerText ?? '',
  });
  return (sonuc?.result ?? '').replace(/\s{3,}/g, '\n').trim();
}

$('okuBtn').addEventListener('click', async () => {
  $('okuBtn').disabled = true;
  bilgi('Sayfa okunuyor…');
  try {
    const o = await oturumOku();
    if (!o?.access_token) {
      bilgi('Önce panelden Vekil Pro hesabınıza giriş yapın.', 'hata');
      return;
    }
    const metin = await sayfaMetni();
    // Yerel çıkarma: anında, bedava, kotasız (bkz. lib/cikar.js).
    const k = kunyeCikarYerel(metin);
    if (doluSayisi(k) === 0) {
      bilgi(`Bu sayfada dava bilgisi bulunamadı (${metin.length} karakter okundu). Dosyanın detay sayfasını açın.`, 'hata');
      return;
    }
    if (!k.title && !k.case_number) {
      bilgi('Dosya adı ya da esas no bulunamadı; kayıt açılamıyor.', 'hata');
      return;
    }
    await davaOlustur({
      title: k.title || k.case_number,
      case_number: k.case_number,
      court_name: k.court_name,
      case_type: k.case_type,
      opposing_party: k.opposing_party,
      status: 'active',
    });
    bilgi(`Dosya oluşturuldu: ${k.title || k.case_number}`, 'iyi');
    // Panel içindeki uygulama yeni kaydı görsün.
    $('uygulama').contentWindow?.location.reload();
  } catch (e) {
    const m = /plan_limiti:([a-z]+):(\d+)/.exec(String(e.message));
    bilgi(m ? `Ücretsiz planda ${m[2]} dava hakkınız doldu.` : `Olmadı: ${e.message}`, 'hata');
  } finally {
    $('okuBtn').disabled = false;
  }
});

// ── UYAP KEŞİF ────────────────────────────────────────────────────────────
// Sayfanın İSKELETİ (değerler maskeli) sekmenin her çerçevesinden alınır ve
// yalnız bu tarayıcıda (chrome.storage.local) birikir. Sunucuya GİTMEZ;
// avukat "İndir" ile dosyayı alır, açıp okur, isterse gönderir.
const KESIF = 'uyapKesif';

async function kesifOku() {
  const d = await chrome.storage.local.get(KESIF);
  return Array.isArray(d[KESIF]) ? d[KESIF] : [];
}

async function kesifSay() {
  const n = (await kesifOku()).length;
  $('kesifAdet').textContent = String(n);
  $('kesifIndir').disabled = n === 0;
  $('kesifTemizle').disabled = n === 0;
}

$('kesifKaydet').addEventListener('click', async () => {
  $('kesifKaydet').disabled = true;
  try {
    const [sekme] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!sekme?.id) throw new Error('sekme_yok');
    const sonuc = await chrome.scripting.executeScript({
      target: { tabId: sekme.id, allFrames: true },
      func: sayfaIskeleti,
    });
    const cerceveler = sonuc.map((r) => r.result).filter((r) => r && /(^|\.)uyap\.gov\.tr$/.test(r.adres.split('/')[0]));
    if (cerceveler.length === 0) {
      bilgi('Bu sekme UYAP değil. Avukat Portal sayfasını açıp tekrar deneyin.', 'hata');
      return;
    }
    const liste = await kesifOku();
    liste.push({ zaman: new Date().toISOString(), cerceveler });
    await chrome.storage.local.set({ [KESIF]: liste });
    const dugum = cerceveler.reduce((n, c) => n + (c.dugumSayisi || 0), 0);
    bilgi(`Kaydedildi: ${cerceveler.length} çerçeve, ${dugum} öğe. Toplam ${liste.length} sayfa.`, 'iyi');
  } catch (e) {
    bilgi(`Kaydedilemedi: ${e.message}`, 'hata');
  } finally {
    $('kesifKaydet').disabled = false;
    kesifSay();
  }
});

$('kesifIndir').addEventListener('click', async () => {
  const veri = { arac: 'vekil-uyap-kesif', surum: 1, sayfalar: await kesifOku() };
  const url = URL.createObjectURL(new Blob([JSON.stringify(veri, null, 1)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `vekil-uyap-kesif-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
});

$('kesifTemizle').addEventListener('click', async () => {
  await chrome.storage.local.remove(KESIF);
  bilgi('Kayıtlar silindi.');
  kesifSay();
});

kesifSay();
