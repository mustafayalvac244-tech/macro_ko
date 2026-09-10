import { cikisYap, davaOlustur, girisYap, kunyeCikar, oturumOku } from './lib/api.js';
import { doluSayisi, kunyeCikarYerel } from './lib/cikar.js';

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

/** Kaydı açmaya yetecek asgari bilgi: ad ya da esas no. */
function kayitlanabilirMi(k) {
  return !!((k.title ?? '').trim() || (k.case_number ?? '').trim());
}

/**
 * HİÇBİR ŞEY BULUNAMADIYSA TABLO GÖSTERİLMEZ.
 *
 * BULUNAN KUSUR (kullanıcı bildirdi). Beş satır da "bulunamadı" yazıp altında
 * aktif bir "Dosyayı oluştur" düğmesi duruyordu. Bu, doğru davranışın en kötü
 * anlatımıydı: sunucu belgede karşılığı olmayan alanı bilerek atıyor (uydurma
 * esas numarası boş alandan tehlikelidir) ama ekran bunu ARIZA gibi gösteriyor
 * ve kullanıcıya ne yapacağını söylemiyordu.
 *
 * Artık hiç alan çıkmadıysa tablo yerine ne yapılacağı yazılıyor; kayıt düğmesi
 * de asgari bilgi yoksa kapalı.
 */
function onizlemeCiz(k, okunanKarakter, kaynak) {
  const kap = $('alanlar');
  kap.innerHTML = '';

  const doluSayisi = ALANLAR.filter(([a]) => (k[a] ?? '').toString().trim()).length;
  if (doluSayisi === 0) {
    $('onizleme').hidden = true;
    bilgi(
      `Bu sayfada dava bilgisi bulunamadı (${okunanKarakter} karakter okundu). ` +
        'UYAP\'ta dosyanın DETAY sayfasını açıp tekrar deneyin.',
      true
    );
    return;
  }

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
  $('kaydetBtn').disabled = !kayitlanabilirMi(k);
  $('onizleme').hidden = false;
  if (!kayitlanabilirMi(k)) bilgi('Dosya adı ya da esas no bulunamadı; kayıt açılamıyor.', true);
  else bilgi(kaynak === 'yerel' ? `${doluSayisi(k)} alan sayfadan okundu.` : 'Yapay zekâ ile çıkarıldı.');
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

    /**
     * ÖNCE YEREL ÇIKARICI, SONRA (GEREKİRSE) SUNUCU.
     *
     * İlk sürüm her seferinde sunucudaki AI ucuna gidiyordu. Bu fazla
     * mühendislikti: "Esas No: 2023/145", "ANKARA 3. ASLİYE HUKUK MAHKEMESİ",
     * "DAVALI:" sayfada düz yazıyla duruyor ve düzenli ifadeyle çıkıyor —
     * anında, bedava, kota harcamadan, API anahtarı olmadan, çevrimdışı.
     *
     * AI yalnız yerel çıkarıcı HİÇBİR ŞEY bulamazsa denenir (alışılmadık bir
     * biçim, taranmış bir belge metni vb.). Anahtar tanımlı değilse orada da
     * hata döner ama o noktada zaten kaybedecek bir şey yoktur.
     */
    bilgi(`Sayfa okundu (${metin.length} karakter), bilgiler çıkarılıyor…`);
    let k = kunyeCikarYerel(metin);
    let kaynak = 'yerel';

    if (doluSayisi(k) === 0) {
      bilgi('Bilinen kalıp bulunamadı, yapay zekâ deneniyor…');
      k = await kunyeCikar(metin);
      kaynak = 'ai';
    }

    bulunan = k;
    onizlemeCiz(k, metin.length, kaynak);
  } catch (e) {
    const kod = String(e.message);
    // TANIDIĞIMIZ KODLAR AÇIKÇA ANLATILIR; TANIMADIĞIMIZ KOD OLDUĞU GİBİ
    // GÖSTERİLİR. "Bilgiler çıkarılamadı" gibi bir mesaj, sebebi hem
    // kullanıcıdan hem geliştiriciden saklıyordu.
    const SOZLUK = {
      metin_yetersiz: 'Bu sayfada okunacak yeterli metin yok. Dosyanın detay sayfasını açın.',
      deneme_hakki_bitti: 'Ücretsiz deneme hakkınız doldu (3 hak). AI paketiyle devam edebilirsiniz.',
      not_configured: 'Yapay zekâ servisi şu an yapılandırılmamış. Sunucuda API anahtarı tanımlanmalı.',
      ai_soru_kota_bitti: 'Bu ayki AI sorunuz doldu. Hak ayın başında yenilenir.',
      quota_exceeded: 'Bu ayki AI kullanım hakkınız doldu. Hak ayın başında yenilenir.',
      daily_quota: 'Ücretsiz AI havuzu şu an dolu (tüm kullanıcılarla ortak). Bir süre sonra tekrar deneyin.',
      sekme_yok: 'Etkin sekme bulunamadı.',
    };
    if (kod === 'oturum_yok') {
      gorunum(false);
      bilgi('Oturumunuz doldu, tekrar giriş yapın.', true);
    } else if (SOZLUK[kod]) {
      bilgi(SOZLUK[kod], true);
    } else {
      const ek = e.ayrinti ? ` — ${e.ayrinti}` : '';
      bilgi(`Çıkarma başarısız: ${kod}${ek}`, true);
    }
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

// Açılışta oturum durumuna göre görünümü ayarla. Hata olursa GİRİŞ ekranı
// açık kalır (HTML'de varsayılan görünür) — boş popup yerine kullanılabilir bir
// ekran görürsünüz.
(async () => {
  try {
    const o = await oturumOku();
    gorunum(!!o?.access_token);
  } catch (e) {
    bilgi('Oturum okunamadı: ' + String(e?.message ?? e), true);
  }
})();
