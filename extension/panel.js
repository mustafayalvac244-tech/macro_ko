import { davaOlustur, oturumOku } from './lib/api.js';
import { doluSayisi, kunyeCikarYerel } from './lib/cikar.js';

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
