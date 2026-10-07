/**
 * UYAP KEŞİF — sayfanın İSKELETİNİ kaydeder, içeriğini değil (07.10.2026).
 *
 * NEDEN VAR. Eklenti tek dosyayı okuyabiliyor ama dosya LİSTESİNİ
 * okuyamıyor; sebebi UYAP-ENTEGRASYON-YOLU.md'de yazılı: "Dosya listesi
 * sayfasının HTML'ini hiç görmedim". Portal e-imza istiyor, biz giremiyoruz.
 * Bu araçla bir avukat kendi oturumunda düğmeye basar; çıkan dosya bize
 * sayfanın YAPISINI (tablo mı, iframe mi, sütun başlıkları ne, kaç satır)
 * gösterir. Liste okuyucu bundan sonra tahminle değil, buna göre yazılır.
 *
 * MÜVEKKİL VERİSİ CİHAZDAN ÇIKMAZ. Değerler maskelenir, kalıbı kalır:
 * "2023/145" → ‹ESAS_NO›, "AHMET YILMAZ" → ‹BUYUK_METIN:12›. Yalnız bilinen
 * arayüz sözcüklerinden oluşan etiketler ("Esas No", "Davacı Vekili") ve
 * yalnız etiket rolündeki öğelerde (başlık hücresi, düğme, sekme) olduğu
 * gibi kalır. "Esas No: 2023/145" gibi satırda etiket kalır, değer maskelenir.
 * Form alanlarının DEĞERİ hiç okunmaz. Avukat dosyayı göndermeden önce
 * açıp okuyabilir — düz metin JSON.
 *
 * TEK PARÇA FONKSİYON. chrome.scripting.executeScript fonksiyonu kaynak
 * metniyle sayfaya taşır; dışarıdaki yardımcılar ve importlar gitmez. Bu
 * yüzden her şey `sayfaIskeleti`nin İÇİNDE tanımlı.
 */
export function sayfaIskeleti() {
  // Bilinen arayüz sözcükleri (küçük harf, Türkçe). Kişi adı olabilecek
  // sözcükler (ör. "adalet") BİLEREK yok: tek başına bir ad sızmasın.
  const SOZLUK = new Set(
    (
      'esas no numarası numara karar dosya dosyası dosyalar dosyaları birim birimi mahkeme mahkemesi mahkemeleri ' +
      'daire dairesi icra iflas yargı yargıtay istinaf bölge türü tür tipi durum durumu açık kapalı derdest ' +
      'taraf taraflar tarafı tarafları davacı davalı vekil vekili vekilleri alacaklı borçlu sanık katılan müşteki ' +
      'şüpheli müdahil rol rolü adı ad soyadı soyad unvan unvanı kimlik tc vergi sicil ' +
      'tarih tarihi saat saati açılış kapanış kayıt işlem işlemi işlemler açıklama açıklaması sonuç sonucu ' +
      'evrak evraklar evrakı belge belgeler safahat duruşma duruşmalar duruşması keşif tebligat tebligatlar ' +
      'tebliğ tebellüğ harç harçlar masraf masraflar tahsilat reddiyat tutar tutarı toplam bakiye ' +
      'sorgula sorgulama ara arama listele göster gizle detay detayı aç kapat indir görüntüle yazdır kaydet ' +
      'gönder seç seçiniz tümü hepsi temizle geri ileri önceki sonraki sayfa kayıtlı bulunan bulunamadı ' +
      'yok var ve ile veya için de da bilgi bilgileri bilgisi genel liste listesi kalem hukuk ceza idare ' +
      'idari asliye sulh ticaret iş aile tüketici kadastro ağır ilk derece savcılık cumhuriyet başsavcılığı ' +
      'uyap portal avukat portalı menü ana anasayfa çıkış oturum kullanıcı ayarlar yardım duyuru duyurular ' +
      'e dava davası davalar davaları takip takibi yolu yönetim not notlar adet sayı sayısı'
    ).split(/\s+/),
  );
  const ETIKET_ROLU = new Set(['th', 'button', 'label', 'legend', 'a', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'option', 'caption', 'summary']);
  const ATLA = new Set(['script', 'style', 'noscript', 'svg', 'template', 'link', 'meta', 'head']);
  const AZAMI_DUGUM = 6000;
  const AZAMI_DERINLIK = 60;
  let dugumSayisi = 0;

  const kucuk = (s) => s.replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase();
  const sozlukte = (s) => {
    const k = kucuk(s).split(/[^a-zçğıöşüâîû]+/).filter(Boolean);
    return k.length > 0 && k.every((w) => SOZLUK.has(w));
  };

  /** Değeri asla döndürmez; yalnız biçimini. */
  function sekil(s) {
    const t = s.trim();
    if (/^\d{4}\s*\/\s*\d+$/.test(t)) return '‹ESAS_NO›';
    if (/^\d{1,2}[./]\d{1,2}[./]\d{4}$/.test(t)) return '‹TARIH›';
    if (/^\d{1,2}[./]\d{1,2}[./]\d{4}\s+\d{1,2}:\d{2}(:\d{2})?$/.test(t)) return '‹TARIH_SAAT›';
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)) return '‹SAAT›';
    if (/^\d+$/.test(t)) return `‹${t.length}_HANE›`;
    if (/^[\d.,\s]+(TL|₺)?$/.test(t)) return '‹TUTAR›';
    const harf = t.replace(/[^A-Za-zÇĞİÖŞÜçğıöşüâîû]/g, '');
    const buyuk = harf.length > 0 && harf === harf.toLocaleUpperCase('tr-TR');
    return `‹${buyuk ? 'BUYUK_' : ''}METIN:${t.length}›`;
  }

  function metin(ham, etiketRolunde) {
    const t = (ham ?? '').replace(/\s+/g, ' ').trim();
    if (!t) return null;
    if (etiketRolunde && t.length <= 60 && sozlukte(t)) return t;
    const m = /^([^:]{2,40}):\s*(.*)$/.exec(t);
    if (m && sozlukte(m[1])) return `${m[1]}: ${m[2] ? sekil(m[2]) : ''}`.trim();
    return sekil(t);
  }

  function imza(el) {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id.replace(/\d{3,}/g, '‹n›')}` : '';
    const cls = (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean).slice(0, 4).map((c) => `.${c}`).join('');
    return tag + id + cls;
  }

  function dugum(el, derinlik) {
    if (dugumSayisi >= AZAMI_DUGUM || derinlik > AZAMI_DERINLIK) return { kesildi: true };
    dugumSayisi += 1;
    const tag = el.tagName.toLowerCase();
    const n = { e: imza(el) };
    const rol = el.getAttribute('role');
    if (rol) n.rol = rol;
    const etiketRolunde = ETIKET_ROLU.has(tag) || ['tab', 'columnheader', 'button', 'menuitem', 'link'].includes(rol ?? '');
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      // DEĞER OKUNMAZ. Yalnız alanın türü ve adı.
      n.alan = { tur: el.getAttribute('type') ?? tag, ad: el.getAttribute('name') ?? null };
      const ph = el.getAttribute('placeholder');
      if (ph) n.alan.ipucu = metin(ph, true);
    }
    if (tag === 'iframe' || tag === 'frame') n.cerceve = (el.getAttribute('src') ?? '').split('?')[0].replace(/\d{3,}/g, '‹n›');
    const aria = el.getAttribute('aria-label') ?? el.getAttribute('title');
    if (aria) n.etiket = metin(aria, true);

    const dogrudanMetin = [];
    const cocuklar = [];
    for (const c of Array.from(el.childNodes ?? [])) {
      if (c.nodeType === 3) {
        if (tag !== 'select' && tag !== 'textarea') dogrudanMetin.push(c.textContent ?? '');
      } else if (c.nodeType === 1 && !ATLA.has(c.tagName.toLowerCase())) {
        cocuklar.push(c);
      }
    }
    const x = metin(dogrudanMetin.join(' '), etiketRolunde);
    if (x) n.x = x;

    // TEKRARLAYAN SATIRLAR: aynı imzalı 3'ten fazla kardeş (hücre değilse) varsa ilk 2'si
    // açılır, gerisi sayılır. Hem dosya küçük kalır hem daha az veri görünür.
    if (cocuklar.length) {
      const k = [];
      let i = 0;
      while (i < cocuklar.length) {
        const im = imza(cocuklar[i]);
        let j = i;
        while (j < cocuklar.length && imza(cocuklar[j]) === im) j += 1;
        const adet = j - i;
        // Hücreler (th/td) kırpılmaz: sütunlar yapının kendisi.
        const hucre = /^t[hd]\b/.test(im);
        const kirp = adet > 3 && !hucre;
        const acilan = kirp ? 2 : adet;
        for (let q = i; q < i + acilan; q += 1) k.push(dugum(cocuklar[q], derinlik + 1));
        if (kirp) k.push({ tekrar: im, adet });
        i = j;
      }
      n.k = k;
    }
    return n;
  }

  const sorguAdlari = Array.from(new URLSearchParams(location.search).keys());
  return {
    adres: location.host + location.pathname.replace(/\d{3,}/g, '‹n›'),
    sorguAdlari,
    baslik: metin(document.title, true),
    cerceveMi: window.top !== window,
    kok: document.body ? dugum(document.body, 0) : null,
    dugumSayisi,
  };
}
