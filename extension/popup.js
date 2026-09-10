import { cikisYap, davaOlustur, girisYap, kunyeCikar, oturumOku } from './lib/api.js';

const $ = (id) => document.getElementById(id);
const durum = $('durum');

function bilgi(m, hata = false) {
  durum.textContent = m;
  durum.classList.toggle('hata', hata);
}

function gorunum(girisli) {
  $('giris').hidden = girisli;
  $('calisma').hidden = !girisli;
}

/**
 * SAYFA METNİNİ OKUR — seçici yok, sadece görünen yazı.
 *
 * `activeTab` izniyle ve YALNIZ kullanıcı düğmeye bastığında çalışır: eklentinin
 * arka planda sürekli sayfa dinlemesi yok. Bu hem mağaza incelemesini
 * kolaylaştırır hem de "hangi sayfalarımı okuyor?" sorusunu ortadan kaldırır —
 * cevap: yalnız bastığınız andaki sekme.
 */
async function sayfaMetni() {
  const [sekme] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!sekme?.id) throw new Error('sekme_yok');
  const [sonuc] = await chrome.scripting.executeScript({
    target: { tabId: sekme.id },
    func: () => document.body?.innerText ?? '',
  });
  const metin = (sonuc?.result ?? '').replace(/\s{3,}/g, '\n').trim();
  if (metin.length < 120) throw new Error('metin_yetersiz');
  return metin;
}

const ALANLAR = [
  ['title', 'Dosya adı'],
  ['case_number', 'Esas no'],
  ['court_name', 'Mahkeme'],
  ['case_type', 'Dava türü'],
  ['opposing_party', 'Karşı taraf'],
];

let bulunan = null;

function onizlemeCiz(k) {
  const kap = $('alanlar');
  kap.innerHTML = '';
  for (const [anahtar, etiket] of ALANLAR) {
    const deger = (k[anahtar] ?? '').toString().trim();
    const satir = document.createElement('div');
    satir.className = 'satir';
    const b = document.createElement('b');
    b.textContent = etiket;
    const s = document.createElement('span');
    // ÇIKARILAMAYAN ALAN BOŞ GÖSTERİLİR, TAHMİN EDİLMEZ. Yanlış bir esas
    // numarasıyla dosya kurmak, eksik dosyadan daha pahalıdır.
    s.textContent = deger || 'bulunamadı';
    if (!deger) s.className = 'bos';
    satir.append(b, s);
    kap.append(satir);
  }
  $('onizleme').hidden = false;
}

$('girisBtn').addEventListener('click', async () => {
  const email = $('email').value.trim();
  const sifre = $('sifre').value;
  if (!email || !sifre) return bilgi('E-posta ve şifre gerekli.', true);
  $('girisBtn').disabled = true;
  bilgi('Giriş yapılıyor…');
  try {
    await girisYap(email, sifre);
    $('sifre').value = '';
    gorunum(true);
    bilgi('');
  } catch (e) {
    bilgi(String(e.message) === 'giris_basarisiz' ? 'E-posta veya şifre hatalı.' : 'Giriş yapılamadı.', true);
  } finally {
    $('girisBtn').disabled = false;
  }
});

$('okuBtn').addEventListener('click', async () => {
  $('okuBtn').disabled = true;
  $('onizleme').hidden = true;
  bilgi('Sayfa okunuyor…');
  try {
    const metin = await sayfaMetni();
    bilgi('Bilgiler çıkarılıyor…');
    bulunan = await kunyeCikar(metin);
    onizlemeCiz(bulunan);
    bilgi('');
  } catch (e) {
    const kod = String(e.message);
    if (kod === 'metin_yetersiz') bilgi('Bu sayfada okunacak yeterli metin yok.', true);
    else if (kod === 'deneme_hakki_bitti') bilgi('Ücretsiz deneme hakkınız doldu. AI paketiyle devam edebilirsiniz.', true);
    else if (kod === 'oturum_yok') { gorunum(false); bilgi('Oturumunuz doldu, tekrar giriş yapın.', true); }
    else bilgi('Bilgiler çıkarılamadı. Sayfayı kontrol edip tekrar deneyin.', true);
  } finally {
    $('okuBtn').disabled = false;
  }
});

$('kaydetBtn').addEventListener('click', async () => {
  if (!bulunan) return;
  const baslik = (bulunan.title ?? '').trim() || (bulunan.case_number ?? '').trim();
  if (!baslik) return bilgi('Dosya adı ya da esas no olmadan kayıt açılamaz.', true);
  $('kaydetBtn').disabled = true;
  bilgi('Kaydediliyor…');
  try {
    await davaOlustur({
      title: baslik,
      case_number: bulunan.case_number || null,
      court_name: bulunan.court_name || null,
      case_type: bulunan.case_type || null,
      opposing_party: bulunan.opposing_party || null,
      status: 'active',
    });
    $('onizleme').hidden = true;
    bulunan = null;
    bilgi('Dosya oluşturuldu. Uygulamada görebilirsiniz.');
  } catch (e) {
    const m = /plan_limiti:([a-z]+):(\d+)/.exec(String(e.message));
    bilgi(m ? `Ücretsiz planda ${m[2]} dava hakkınız doldu. Vekil Pro ile sınırsız.` : 'Kaydedilemedi.', true);
  } finally {
    $('kaydetBtn').disabled = false;
  }
});

$('vazgecBtn').addEventListener('click', () => {
  bulunan = null;
  $('onizleme').hidden = true;
  bilgi('');
});

$('cikisBtn').addEventListener('click', async () => {
  await cikisYap();
  gorunum(false);
  bilgi('');
});

(async () => gorunum(!!(await oturumOku())?.access_token))();
