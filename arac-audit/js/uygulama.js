// ARAÇ AUDIT — uygulama akışı.
// Tasarım ilkesi: bir hatayı kaydetmek EN FAZLA üç dokunuş olmalı.
//   (1) 3B modelde parçaya dokun  (2) hata tipini seç  (3) Kaydet
// Fotoğraf ve not isteğe bağlıdır; sonradan da eklenebilir.

import { BOLGELER, PARCA_INDEKS, HATA_TIPI_INDEKS, HATA_GRUPLARI, SIDDETLER, parcaHataTipleri, bolgelerAracIcin, HIZLI_KALIPLAR } from './katalog.js';
import { vinDogrula, plakaDogrula, VIN_UZUNLUK } from './vin.js';
import { ARACLAR, ARAC_INDEKS, ModelGoruntuleyici, geometriUret } from './model3d.js';
import { denetimOzeti, hataAdi, SIDDET_INDEKS, VARSAYILAN_ESIKLER } from './puan.js';
import * as depo from './depo.js';
import { excelUret, topluExcelUret, csvUret, htmlRapor, bicimTarih } from './rapor.js';
import { fotografKucult } from './goruntu.js';

const durum = {
  ekran: 'ana',
  denetim: null,
  goruntuleyici: null,
  mod: 'dis',
  seciliParca: null,
  fotoUrlleri: new Map(),
  ayarlar: { denetci: '', hat: '', vardiya: '', dil: 'tr', esikler: { ...VARSAYILAN_ESIKLER } },
};

const $ = (s, k = document) => k.querySelector(s);
const el = (etiket, ozellikler = {}, ...cocuklar) => {
  const d = document.createElement(etiket);
  for (const [a, v] of Object.entries(ozellikler)) {
    if (v === null || v === undefined || v === false) continue;
    if (a === 'sinif') d.className = v;
    else if (a === 'metin') d.textContent = v;
    else if (a === 'html') d.innerHTML = v;
    else if (a.startsWith('on')) d.addEventListener(a.slice(2), v);
    else d.setAttribute(a, v === true ? '' : v);
  }
  for (const c of cocuklar.flat()) if (c) d.append(c.nodeType ? c : document.createTextNode(c));
  return d;
};

// ---------------------------------------------------------------------------
// ÇATI
// ---------------------------------------------------------------------------

function ciz() {
  const kok = $('#kok');
  kok.textContent = '';
  const ekranlar = { ana: ekranAna, yeni: ekranYeni, denetim: ekranDenetim, rapor: ekranRapor, ayarlar: ekranAyarlar };
  kok.append((ekranlar[durum.ekran] ?? ekranAna)());
}

function git(ekran) { durum.ekran = ekran; ciz(); window.scrollTo(0, 0); }

function ustCubuk(baslik, altYazi, geriEkran) {
  return el('div', { sinif: 'ust' },
    geriEkran ? el('button', { sinif: 'geri', 'aria-label': 'Geri', onclick: () => git(geriEkran) }, '‹') : null,
    el('div', { sinif: 'ust-sol' },
      el('h1', { metin: baslik }),
      altYazi ? el('div', { sinif: 'alt', metin: altYazi }) : null));
}

function bildir(mesaj, tur = 'bilgi') {
  const k = el('div', { sinif: tur === 'hata' ? 'hata-kutu' : tur === 'uyari' ? 'uyari' : 'bilgi', metin: mesaj,
    style: 'position:fixed;left:14px;right:14px;bottom:86px;z-index:60;box-shadow:0 8px 24px rgba(0,0,0,.18)' });
  document.body.append(k);
  setTimeout(() => k.remove(), 3800);
}

// ---------------------------------------------------------------------------
// EKRAN: ANA
// ---------------------------------------------------------------------------

function ekranAna() {
  const sayfa = el('div', { sinif: 'sayfa' });
  const parca = el('div', {}, ustCubuk('Araç Audit', 'QA denetim kayıt ve raporlama'), el('main', {}, sayfa));

  sayfa.append(el('div', { sinif: 'dugme-satir' },
    el('button', { sinif: 'birincil genis', onclick: () => git('yeni') }, '+  Yeni Denetim'),
    el('button', { sinif: 'kucuk', style: 'flex:0 0 auto', onclick: () => git('ayarlar') }, '⚙ Ayarlar')));

  const liste = el('div', { sinif: 'kart' }, el('h2', { metin: 'Son denetimler' }), el('div', { sinif: 'yukleniyor', metin: 'Yükleniyor…' }));
  sayfa.append(liste);

  depo.denetimListele(60).then((denetimler) => {
    liste.textContent = '';
    liste.append(el('h2', { metin: `Son denetimler (${denetimler.length})` }));
    if (!denetimler.length) {
      // Boş kabuk yerine aracın NE YAPTIĞINI göster. Örnek denetim kaydı
      // KOYMUYORUZ: bir QA aracında uydurma hata kaydı, gerçek sanılma riski
      // taşır ve bu ürünün tek kırmızı çizgisi odur.
      liste.append(el('div', { sinif: 'nasil' },
        el('p', { metin: 'Henüz denetim kaydı yok. Akış üç adım:' }),
        el('ol', {},
          el('li', {}, el('b', { metin: 'Araç ve şasi' }), ' — barkodu okutun ya da 17 haneyi yazın; kontrol hanesi ve model yılı anında doğrulanır.'),
          el('li', {}, el('b', { metin: '3B modelde parçaya dokunun' }), ' — 166 parça, her biri yalnız kendisinde anlamlı hata tiplerini açar.'),
          el('li', {}, el('b', { metin: 'Hatayı seçin, isterseniz fotoğraflayın' }), ' — Excel’e fotoğraf hatanın yanına gömülü iner.')),
        el('p', { sinif: 'nasil-not', metin: 'Her şey cihazda saklanır; internet olmadan da çalışır.' })));
      return;
    }
    const kutu = el('div', { sinif: 'hata-liste' });
    for (const d of denetimler) {
      const o = denetimOzeti(d, durum.ayarlar.esikler);
      kutu.append(el('button', { sinif: 'liste-satir', onclick: () => denetimAc(d.id) },
        el('div', {},
          el('div', { sinif: 'vin', metin: d.vin || '(şasi yok)' }),
          el('div', { sinif: 'meta', metin: `${ARAC_INDEKS[d.aracId]?.ad ?? d.aracId} · ${d.plaka || 'plakasız'} · ${bicimTarih(d.baslangic)}` })),
        el('div', { sinif: 'sag' },
          el('span', { sinif: `sonuc-pul sonuc-${o.sonuc.kod}`, metin: o.sonuc.ad }),
          el('span', { metin: `${o.toplamAdet} hata` }))));
    }
    liste.append(kutu);
    liste.append(el('div', { sinif: 'dugme-satir', style: 'margin-top:12px' },
      el('button', { sinif: 'kucuk', onclick: () => topluDisaAktar(denetimler) }, '⤓ Tümünü Excel’e aktar'),
      el('button', { sinif: 'kucuk', onclick: yedekIndir }, '💾 Yedek al')));
  }).catch((h) => {
    liste.textContent = '';
    liste.append(el('div', { sinif: 'hata-kutu', metin: `Kayıtlar okunamadı: ${h.message}` }));
  });

  return parca;
}

async function denetimAc(id) {
  durum.denetim = await depo.denetimGetir(id);
  await fotoUrlleriTazele();
  durum.mod = 'dis';
  durum.seciliParca = null;
  git('denetim');
}

// ---------------------------------------------------------------------------
// EKRAN: YENİ DENETİM
// ---------------------------------------------------------------------------

function ekranYeni() {
  const sayfa = el('div', { sinif: 'sayfa' });
  const parca = el('div', {}, ustCubuk('Yeni Denetim', 'Araç ve şasi bilgisi', 'ana'), el('main', {}, sayfa));

  let seciliArac = ARACLAR[0].id;

  // --- Araç seçimi
  const aracKutu = el('div', { sinif: 'arac-izgara' });
  const aracKartlari = ARACLAR.map((a) => {
    const k = el('button', { sinif: 'arac-kart', 'aria-pressed': a.id === seciliArac, onclick: () => {
      seciliArac = a.id;
      aracKartlari.forEach((kk, i) => kk.setAttribute('aria-pressed', ARACLAR[i].id === seciliArac));
    } },
      el('b', { metin: a.ad }),
      el('span', { metin: `${a.tip === 'ev' ? 'Elektrikli' : 'İçten yanmalı'} · ${a.uzunluk}×${a.genislik}×${a.yukseklik} mm` }),
      a.olcuDogrulandi ? null : el('span', { sinif: 'rozet uyar', metin: 'ölçü doğrulanmadı' }));
    aracKutu.append(k);
    return k;
  });
  sayfa.append(el('div', { sinif: 'kart' }, el('h2', { metin: 'Araç' }), aracKutu));

  // --- Şasi
  // maxlength KOYMA: barkod okuyucu ayraçlı metin gönderebilir ("NLH-B51...").
  // 17'de kırpılırsa ayraç yüzünden SON HANE sessizce kaybolur ve hatalı VIN
  // geçerli görünür. Uzunluk kırpmayla değil, normalize + doğrulama ile kontrol
  // edilir. (15.09.2026 tarayıcı sınavında yakalandı.)
  const vinGirdi = el('input', { sinif: 'vin-girdi', maxlength: '40', autocapitalize: 'characters',
    autocomplete: 'off', spellcheck: 'false', placeholder: '17 haneli şasi numarası', inputmode: 'text' });
  const vinDurum = el('div', { sinif: 'bilgi', metin: `Barkodu okutun ya da elle girin — ${VIN_UZUNLUK} hane.` });
  const plakaGirdi = el('input', { placeholder: '41 ABC 12 (varsa)', autocapitalize: 'characters' });

  const vinKontrol = () => {
    const r = vinDogrula(vinGirdi.value);
    vinGirdi.value = r.vin;
    vinDurum.className = r.gecerli ? (r.uyarilar.length ? 'uyari' : 'bilgi') : 'hata-kutu';
    if (!vinGirdi.value) { vinDurum.className = 'bilgi'; vinDurum.textContent = `Barkodu okutun ya da elle girin — ${VIN_UZUNLUK} hane.`; return r; }
    const satirlar = [...r.hatalar, ...r.uyarilar];
    if (r.gecerli && !satirlar.length) {
      const b = r.bilgi;
      vinDurum.textContent = `✓ Geçerli · ${b.uretici ?? b.wmi} · model yılı ${b.modelYili ?? '?'}`;
    } else {
      vinDurum.textContent = satirlar.join(' ');
    }
    return r;
  };
  vinGirdi.addEventListener('input', vinKontrol);

  sayfa.append(el('div', { sinif: 'kart' },
    el('h2', { metin: 'Şasi numarası (VIN)' }),
    el('div', { style: 'display:grid;gap:9px' },
      vinGirdi, vinDurum,
      el('div', { sinif: 'dugme-satir' },
        el('button', { sinif: 'kucuk', onclick: () => vinTara(vinGirdi, vinKontrol) }, '📷 Barkod okut'),
        el('button', { sinif: 'kucuk', onclick: () => { vinGirdi.value = ''; vinKontrol(); vinGirdi.focus(); } }, '✕ Temizle')),
      el('label', { sinif: 'alan' }, 'Plaka (varsa)', plakaGirdi))));

  // --- Denetim bilgileri
  const raporNo = el('input', { placeholder: 'örn. QA-2026-0412' });
  const denetci = el('input', { placeholder: 'Ad Soyad', value: durum.ayarlar.denetci ?? '' });
  const hat = el('input', { placeholder: 'örn. Montaj 2', value: durum.ayarlar.hat ?? '' });
  const vardiya = el('select', {}, ...['', 'A', 'B', 'C'].map((v) => el('option', { value: v, metin: v || 'Seçiniz' })));
  vardiya.value = durum.ayarlar.vardiya ?? '';
  const tip = el('select', {}, ...['Seri denetim', 'Ara denetim', 'Final audit', 'Yol testi', 'Müşteri şikâyeti', 'Yeniden kontrol']
    .map((v) => el('option', { value: v, metin: v })));

  sayfa.append(el('div', { sinif: 'kart' },
    el('h2', { metin: 'Denetim bilgileri' }),
    el('div', { sinif: 'izgara2' },
      el('label', { sinif: 'alan' }, 'Rapor No', raporNo),
      el('label', { sinif: 'alan' }, 'Denetçi', denetci),
      el('label', { sinif: 'alan' }, 'Üretim hattı', hat),
      el('label', { sinif: 'alan' }, 'Vardiya', vardiya),
      el('label', { sinif: 'alan' }, 'Denetim tipi', tip))));

  const basla = async () => {
    const r = vinKontrol();
    if (!r.gecerli) { bildir('Şasi numarası eksik ya da hatalı.', 'hata'); vinGirdi.focus(); return; }
    const p = plakaDogrula(plakaGirdi.value);
    if (p.uyarilar.length) bildir(p.uyarilar[0], 'uyari');

    durum.ayarlar.denetci = denetci.value.trim();
    durum.ayarlar.hat = hat.value.trim();
    durum.ayarlar.vardiya = vardiya.value;
    await depo.ayarYaz('varsayilanlar', durum.ayarlar);

    durum.denetim = {
      id: depo.kimlikUret('d'),
      aracId: seciliArac,
      vin: r.vin,
      plaka: p.bicimli,
      raporNo: raporNo.value.trim(),
      denetci: durum.ayarlar.denetci,
      hat: durum.ayarlar.hat,
      vardiya: durum.ayarlar.vardiya,
      denetimTipi: tip.value,
      baslangic: new Date().toISOString(),
      bitis: null,
      durum: 'devam',
      hatalar: [],
    };
    await depo.denetimKaydet(durum.denetim);
    durum.fotoUrlleri.clear();
    durum.mod = 'dis';
    git('denetim');
  };

  parca.append(el('div', { sinif: 'alt-cubuk' },
    el('button', { sinif: 'birincil', onclick: basla }, 'Denetime Başla →')));
  return parca;
}

/** Kamera + BarcodeDetector ile VIN okuma; desteklenmiyorsa elle girişe düşer. */
async function vinTara(girdi, kontrol) {
  if (!('BarcodeDetector' in window)) {
    bildir('Bu tarayıcı barkod okumayı desteklemiyor — elle girin ya da Chrome (Android) kullanın.', 'uyari');
    girdi.focus();
    return;
  }
  let akis;
  try {
    akis = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  } catch {
    bildir('Kameraya erişilemedi. Tarayıcı izinlerini kontrol edin.', 'hata');
    return;
  }

  const video = el('video', { autoplay: true, playsinline: true, muted: true,
    style: 'width:100%;border-radius:12px;background:#000;max-height:60vh;object-fit:cover' });
  video.srcObject = akis;

  const kapat = () => { akis.getTracks().forEach((t) => t.stop()); perde.remove(); };
  const perde = el('div', { sinif: 'perde', onclick: (e) => { if (e.target === perde) kapat(); } },
    el('div', { sinif: 'sayfa-alt' },
      el('div', { sinif: 'tutamak' }),
      el('h3', { metin: 'Şasi barkodunu kameraya gösterin' }),
      video,
      el('div', { sinif: 'bilgi', metin: 'Code 128 / Code 39 / QR / DataMatrix okunur. Okunan metin 17 haneye göre süzülür.' }),
      el('button', { onclick: kapat }, 'Vazgeç')));
  document.body.append(perde);

  const okuyucu = new window.BarcodeDetector({ formats: ['code_128', 'code_39', 'qr_code', 'data_matrix', 'pdf417', 'itf'] });
  const dongu = async () => {
    if (!document.body.contains(perde)) return;
    try {
      const bulunan = await okuyucu.detect(video);
      for (const b of bulunan) {
        const aday = vinDogrula(b.rawValue);
        if (aday.gecerli) {
          girdi.value = aday.vin;
          kontrol();
          navigator.vibrate?.(60);
          kapat();
          return;
        }
      }
    } catch { /* kare atlandı, döngü sürer */ }
    requestAnimationFrame(dongu);
  };
  video.addEventListener('loadeddata', () => requestAnimationFrame(dongu), { once: true });
}

// ---------------------------------------------------------------------------
// EKRAN: DENETİM (ana çalışma ekranı)
// ---------------------------------------------------------------------------

function ekranDenetim() {
  const d = durum.denetim;
  const arac = ARAC_INDEKS[d.aracId];
  const ozet = denetimOzeti(d, durum.ayarlar.esikler);
  const sayfa = el('div', { sinif: 'sayfa' });
  const parca = el('div', {}, ustCubuk(d.vin || 'Denetim', `${arac?.ad ?? d.aracId} · ${d.plaka || 'plakasız'}`, 'ana'), el('main', {}, sayfa));

  // --- Özet ölçüler
  sayfa.append(el('div', { sinif: 'olcu-izgara' },
    el('div', { sinif: 'olcu' }, el('b', { metin: String(ozet.toplamAdet) }), el('span', { metin: 'hata adedi' })),
    el('div', { sinif: 'olcu' }, el('b', { metin: String(ozet.toplamPuan) }), el('span', { metin: 'ceza puanı' })),
    el('div', { sinif: 'olcu' }, el('b', { metin: String(ozet.siddetDagilimi.A.adet) }), el('span', { metin: 'kritik (A)' })),
    el('div', { sinif: 'olcu' }, el('b', { metin: String(ozet.fotografliHata) }), el('span', { metin: 'fotoğraflı' })),
    el('div', { sinif: 'olcu' }, el('span', { sinif: `sonuc-pul sonuc-${ozet.sonuc.kod}`, metin: ozet.sonuc.ad }), el('span', { style: 'margin-top:6px', metin: 'sonuç' }))));

  // --- 3B model
  const tuval = el('canvas', { id: 'model' });
  const modBtn = (ad, etiket) => el('button', { 'aria-pressed': durum.mod === ad, onclick: () => { durum.mod = ad; ciz(); } }, etiket);
  const bakisBtn = (ad, etiket) => el('button', { onclick: () => durum.goruntuleyici?.bakis(ad) }, etiket);

  const modelSarma = el('div', { sinif: 'model-sarma' },
    tuval,
    el('div', { sinif: 'model-arac' }, modBtn('dis', 'Dış'), modBtn('ic', 'İç')),
    el('div', { sinif: 'model-bakis' }, bakisBtn('sol', 'Sol'), bakisBtn('sag', 'Sağ'), bakisBtn('on', 'Ön'), bakisBtn('arka', 'Arka'), bakisBtn('ust', 'Üst')),
    el('div', { sinif: 'model-alt' },
      el('span', { sinif: 'ipucu', metin: 'Parçaya dokunun · sürükleyerek döndürün' }),
      el('button', { onclick: () => bolgeListesiAc() }, '☰ Listeden seç')));
  sayfa.append(modelSarma);
  if (!arac?.olcuDogrulandi) {
    sayfa.append(el('div', { sinif: 'uyari', metin: `${arac.ad}: ${arac.not} Model şematiktir; hata yerini parça adıyla birlikte not alın.` }));
  }

  // --- Hızlı seçim
  const hizliKutu = el('div', { sinif: 'hizli' });
  sayfa.append(el('div', { sinif: 'kart' }, el('h2', { metin: 'Hızlı seçim — en sık kaydedilenler' }), hizliKutu));
  hizliDoldur(hizliKutu);

  // --- Hata listesi
  const listeKart = el('div', { sinif: 'kart' }, el('h2', { metin: `Kaydedilen hatalar (${d.hatalar.length})` }));
  if (!d.hatalar.length) {
    listeKart.append(el('div', { sinif: 'bos', metin: 'Henüz hata kaydı yok. Modelden bir parçaya dokunun.' }));
  } else {
    const liste = el('div', { sinif: 'hata-liste' });
    d.hatalar.forEach((h, i) => {
      const p = PARCA_INDEKS[h.parcaId];
      const ht = HATA_TIPI_INDEKS[h.hataTipiId];
      const fotoSayi = (h.fotograflar ?? []).length;
      const ilkFoto = fotoSayi ? durum.fotoUrlleri.get(h.fotograflar[0]) : null;
      liste.append(el('button', { sinif: 'hata-satir', onclick: () => hataDuzenleAc(i) },
        el('div', { sinif: `siddet-pul siddet-${h.siddet}`, metin: h.siddet }),
        el('div', {},
          el('div', { sinif: 'ad', metin: `${p?.ad ?? h.parcaId} — ${ht?.ad ?? h.hataTipiId}` }),
          el('div', { sinif: 'yol', metin: `${p?.bolgeAd ?? ''}${h.adet > 1 ? ` · ${h.adet} adet` : ''}${h.konum ? ` · ${h.konum}` : ''}` })),
        el('div', { sinif: 'sag' },
          ilkFoto ? el('img', { sinif: 'foto-pul', src: ilkFoto, alt: '' }) : null,
          fotoSayi > 1 ? el('span', { sinif: 'foto-sayi', metin: `+${fotoSayi - 1}` }) : null,
          fotoSayi === 0 ? el('span', { metin: '📷—' }) : null)));
    });
    listeKart.append(liste);
  }
  sayfa.append(listeKart);

  // --- Alt çubuk
  parca.append(el('div', { sinif: 'alt-cubuk' },
    el('button', { sinif: 'birincil', onclick: () => bolgeListesiAc() }, '+ Hata Ekle'),
    el('button', { onclick: excelIndir }, '⤓ Excel'),
    el('button', { onclick: () => git('rapor') }, '🗎 Rapor')));

  // 3B'yi DOM'a girdikten sonra kur
  queueMicrotask(() => modelKur(tuval));
  return parca;
}

function tuvalOlcusuGuncelle(tuval) {
  const olcek = Math.min(window.devicePixelRatio || 1, 2);
  const en = Math.max(1, Math.round(tuval.clientWidth * olcek));
  const boy = Math.max(1, Math.round(tuval.clientHeight * olcek));
  if (tuval.width === en && tuval.height === boy) return false;
  tuval.width = en; tuval.height = boy;
  return true;
}

function modelKur(tuval) {
  tuvalOlcusuGuncelle(tuval);

  // Tuval, kurulduktan SONRA da yeniden boyutlanabilir (hızlı seçim şeridi
  // sonradan dolar, cihaz döner, klavye açılır). İzlemezsek arka plan tamponu
  // eski ölçüde kalır ve dokunma isabeti kayar — 15.09.2026'da tam bu oldu.
  if (durum.tuvalIzleyici) durum.tuvalIzleyici.disconnect();
  if (typeof ResizeObserver !== 'undefined') {
    durum.tuvalIzleyici = new ResizeObserver(() => {
      if (tuvalOlcusuGuncelle(tuval)) durum.goruntuleyici?.ciz();
    });
    durum.tuvalIzleyici.observe(tuval);
  }

  durum.goruntuleyici = new ModelGoruntuleyici(tuval, {
    dokunuldu: (mesh) => {
      const parcaId = meshParcaBul(mesh);
      if (parcaId) hataEkleAc(parcaId);
    },
  });
  durum.goruntuleyici.yukle(geometriUret(durum.denetim.aracId, durum.mod));
  durum.goruntuleyici.vurgula(hataVurgulari());
  durum.goruntuleyici.bakis(durum.mod === 'ic' ? 'kabin' : 'serbest');
}

/** mesh kimliği -> parça kimliği (katalogda mesh alanıyla eşleşir). */
function meshParcaBul(mesh) {
  for (const b of BOLGELER) for (const p of b.parcalar) if (p.mesh === mesh) return p.id;
  return null;
}

/** Hatası olan parçaları en yüksek şiddetin rengiyle boyar. */
function hataVurgulari() {
  const harita = new Map();
  const oncelik = { A: 3, B: 2, C: 1 };
  const enIyi = new Map();
  for (const h of durum.denetim.hatalar) {
    const p = PARCA_INDEKS[h.parcaId];
    if (!p?.mesh) continue;
    const mevcut = enIyi.get(p.mesh);
    if (!mevcut || oncelik[h.siddet] > oncelik[mevcut]) enIyi.set(p.mesh, h.siddet);
  }
  for (const [mesh, siddet] of enIyi) harita.set(mesh, SIDDET_INDEKS[siddet]?.renk ?? '#D92D20');
  return harita;
}

function hizliDoldur(kutu) {
  depo.sikKullanilanlar(10).then((sik) => {
    const kaynak = sik.length >= 4
      ? sik.map((s) => [s.parcaId, s.hataTipiId])
      : HIZLI_KALIPLAR;
    kutu.textContent = '';
    const gecerli = kaynak.filter(([p, h]) => PARCA_INDEKS[p] && HATA_TIPI_INDEKS[h]).slice(0, 14);
    if (!gecerli.length) { kutu.append(el('div', { sinif: 'bos', metin: 'Kalıp yok.' })); return; }
    for (const [parcaId, hataId] of gecerli) {
      const p = PARCA_INDEKS[parcaId], h = HATA_TIPI_INDEKS[hataId];
      kutu.append(el('button', { onclick: () => hataEkleAc(parcaId, hataId) },
        el('b', { metin: `${p.ad} — ${h.ad}` }),
        el('span', { metin: p.bolgeAd })));
    }
  });
}

// ---------------------------------------------------------------------------
// BÖLGE / PARÇA SEÇİMİ
// ---------------------------------------------------------------------------

function altSayfa(baslik, ...icerik) {
  const kapat = () => perde.remove();
  const perde = el('div', { sinif: 'perde', onclick: (e) => { if (e.target === perde) kapat(); } },
    el('div', { sinif: 'sayfa-alt' },
      el('div', { sinif: 'tutamak' }),
      el('h3', { metin: baslik }),
      ...icerik.flat()));
  document.body.append(perde);
  return { perde, kapat };
}

function bolgeListesiAc() {
  const arac = ARAC_INDEKS[durum.denetim.aracId];
  const bolgeler = bolgelerAracIcin(arac);
  const arama = el('input', { placeholder: 'Parça ara (örn. arka kapı, garniş, far)…', type: 'search' });
  const sonuc = el('div', { style: 'display:grid;gap:8px' });

  const { kapat } = altSayfa('Bölge ve parça seç', arama, sonuc);

  const cizListe = () => {
    const q = arama.value.trim().toLocaleLowerCase('tr');
    sonuc.textContent = '';
    for (const b of bolgeler) {
      const parcalar = q
        ? b.parcalar.filter((p) => `${p.ad} ${p.en} ${b.ad}`.toLocaleLowerCase('tr').includes(q))
        : b.parcalar;
      if (!parcalar.length) continue;
      sonuc.append(el('div', { sinif: 'grup-basligi', metin: `${b.simge ?? ''} ${b.ad}` }));
      const izgara = el('div', { sinif: 'secenek-izgara' });
      for (const p of parcalar) {
        izgara.append(el('button', { sinif: 'secenek', onclick: () => { kapat(); hataEkleAc(p.id); } },
          p.ad, el('small', { metin: p.en })));
      }
      sonuc.append(izgara);
    }
    if (!sonuc.children.length) sonuc.append(el('div', { sinif: 'bos', metin: 'Eşleşen parça yok.' }));
  };
  arama.addEventListener('input', cizListe);
  cizListe();
}

// ---------------------------------------------------------------------------
// HATA EKLEME / DÜZENLEME
// ---------------------------------------------------------------------------

function hataEkleAc(parcaId, onSecilenHata = null) {
  hataSayfasi({
    parcaId,
    hataTipiId: onSecilenHata,
    siddet: onSecilenHata ? HATA_TIPI_INDEKS[onSecilenHata]?.siddet ?? 'C' : null,
    adet: 1, konum: '', aciklama: '', fotograflar: [], durum: 'acik',
  }, null);
}

function hataDuzenleAc(sira) {
  hataSayfasi({ ...durum.denetim.hatalar[sira] }, sira);
}

function hataSayfasi(taslak, duzenlenenSira) {
  const p = PARCA_INDEKS[taslak.parcaId];
  const tipler = parcaHataTipleri(taslak.parcaId);
  const gruplar = [...new Set(tipler.map((t) => t.grup))];

  const tipKutu = el('div', { style: 'display:grid;gap:8px' });
  const siddetKutu = el('div', { sinif: 'siddet-secim' });
  const adetGirdi = el('input', { type: 'number', min: '1', max: '99', value: String(taslak.adet ?? 1), inputmode: 'numeric' });
  const konumGirdi = el('input', { placeholder: 'örn. üst köşe, kol dayama hizası', value: taslak.konum ?? '' });
  const aciklamaGirdi = el('textarea', { rows: '2', placeholder: 'Ek açıklama (isteğe bağlı)' });
  aciklamaGirdi.value = taslak.aciklama ?? '';
  const fotoSerit = el('div', { sinif: 'foto-serit' });

  const siddetCiz = () => {
    siddetKutu.textContent = '';
    for (const s of SIDDETLER) {
      siddetKutu.append(el('button', { sinif: `secenek s-${s.id}`, 'aria-pressed': taslak.siddet === s.id,
        onclick: () => { taslak.siddet = s.id; siddetCiz(); } },
        `${s.id} · ${s.ad}`, el('small', { metin: `${s.puan} puan` })));
    }
  };

  const tipCiz = () => {
    tipKutu.textContent = '';
    for (const g of gruplar) {
      tipKutu.append(el('div', { sinif: 'grup-basligi', metin: HATA_GRUPLARI[g]?.ad ?? g }));
      const izgara = el('div', { sinif: 'secenek-izgara' });
      for (const t of tipler.filter((x) => x.grup === g)) {
        izgara.append(el('button', { sinif: 'secenek', 'aria-pressed': taslak.hataTipiId === t.id,
          onclick: (ev) => {
            taslak.hataTipiId = t.id;
            if (duzenlenenSira === null) taslak.siddet = t.siddet;
            tipCiz(); siddetCiz();
            // Hata tipi seçildi; sırada Kaydet var. Uzun listede o düğme
            // ekranın çok altında kalıyor ve "üç dokunuş" sözü bozuluyordu.
            ev.currentTarget.closest('.sayfa-alt')?.querySelector('.eylemler')
              ?.scrollIntoView({ behavior: 'smooth', block: 'end' });
          } },
          t.ad, el('small', { metin: t.en })));
      }
      tipKutu.append(izgara);
    }
  };

  const fotoCiz = () => {
    fotoSerit.textContent = '';
    for (const fid of taslak.fotograflar) {
      const url = durum.fotoUrlleri.get(fid);
      fotoSerit.append(el('div', { sinif: 'foto-kutu' },
        url ? el('img', { src: url, alt: '' }) : null,
        el('button', { 'aria-label': 'Fotoğrafı sil', onclick: async () => {
          taslak.fotograflar = taslak.fotograflar.filter((x) => x !== fid);
          await depo.fotografSil(fid);
          durum.fotoUrlleri.delete(fid);
          fotoCiz();
        } }, '×')));
    }
    fotoSerit.append(el('label', { sinif: 'foto-ekle' }, '📷', 'Fotoğraf',
      el('input', { type: 'file', accept: 'image/*', capture: 'environment', multiple: true, style: 'display:none',
        onchange: async (e) => {
          const dosyalar = [...e.target.files];
          e.target.value = '';
          for (const dosya of dosyalar) {
            try {
              const { blob, en, boy } = await fotografKucult(dosya);
              const kayit = await depo.fotografKaydet(durum.denetim.id, blob, { en, boy });
              taslak.fotograflar.push(kayit.id);
              durum.fotoUrlleri.set(kayit.id, URL.createObjectURL(blob));
            } catch (h) {
              bildir(`Fotoğraf işlenemedi: ${h.message}`, 'hata');
            }
          }
          fotoCiz();
        } })));
  };

  tipCiz(); siddetCiz(); fotoCiz();

  const kaydet = async () => {
    if (!taslak.hataTipiId) { bildir('Hata tipi seçin.', 'uyari'); return; }
    if (!taslak.siddet) taslak.siddet = HATA_TIPI_INDEKS[taslak.hataTipiId]?.siddet ?? 'C';
    taslak.adet = Math.max(1, Math.min(99, Number(adetGirdi.value) || 1));
    taslak.konum = konumGirdi.value.trim();
    taslak.aciklama = aciklamaGirdi.value.trim();
    if (duzenlenenSira === null) {
      taslak.id = depo.kimlikUret('h');
      taslak.zaman = new Date().toISOString();
      durum.denetim.hatalar.push(taslak);
    } else {
      durum.denetim.hatalar[duzenlenenSira] = taslak;
    }
    await depo.denetimKaydet(durum.denetim);
    await depo.kalipSay(taslak.parcaId, taslak.hataTipiId);
    kapat();
    ciz();
  };

  const sil = async () => {
    if (duzenlenenSira === null) { kapat(); return; }
    for (const fid of durum.denetim.hatalar[duzenlenenSira].fotograflar ?? []) {
      await depo.fotografSil(fid);
      durum.fotoUrlleri.delete(fid);
    }
    durum.denetim.hatalar.splice(duzenlenenSira, 1);
    await depo.denetimKaydet(durum.denetim);
    kapat();
    ciz();
  };

  const { kapat } = altSayfa(`${p?.ad ?? taslak.parcaId}`,
    el('div', { sinif: 'bilgi', metin: `${p?.bolgeAd ?? ''} · ${p?.en ?? ''}` }),
    el('div', { sinif: 'grup-basligi', metin: 'Hata tipi' }), tipKutu,
    el('div', { sinif: 'grup-basligi', metin: 'Şiddet' }), siddetKutu,
    el('div', { sinif: 'izgara2' },
      el('label', { sinif: 'alan' }, 'Adet',
        el('div', { sinif: 'adet-kutu' },
          el('button', { onclick: () => { adetGirdi.value = Math.max(1, Number(adetGirdi.value) - 1); } }, '−'),
          adetGirdi,
          el('button', { onclick: () => { adetGirdi.value = Math.min(99, Number(adetGirdi.value) + 1); } }, '+'))),
      el('label', { sinif: 'alan' }, 'Konum', konumGirdi)),
    el('label', { sinif: 'alan' }, 'Açıklama', aciklamaGirdi),
    el('div', { sinif: 'grup-basligi', metin: 'Fotoğraf (Excel’e otomatik gömülür)' }), fotoSerit,
    el('div', { sinif: 'dugme-satir eylemler', style: 'margin-top:8px' },
      duzenlenenSira !== null ? el('button', { sinif: 'tehlike', onclick: sil }, 'Sil') : null,
      el('button', { onclick: () => kapat() }, 'Vazgeç'),
      el('button', { sinif: 'birincil', onclick: kaydet }, 'Kaydet')));
}

// ---------------------------------------------------------------------------
// FOTOĞRAF URL'leri
// ---------------------------------------------------------------------------

async function fotoUrlleriTazele() {
  for (const url of durum.fotoUrlleri.values()) URL.revokeObjectURL(url);
  durum.fotoUrlleri.clear();
  const kayitlar = await depo.fotograflariGetir(durum.denetim.id);
  for (const k of kayitlar) durum.fotoUrlleri.set(k.id, URL.createObjectURL(k.blob));
}

// ---------------------------------------------------------------------------
// DIŞA AKTARIM
// ---------------------------------------------------------------------------

// claude.ai Artifact kabuğu, sayfanın KENDİ başlattığı indirmeleri (blob
// bağlantısı, <a download>) engeller. Orada dosyayı 'downloads' yeteneğiyle
// veririz; kullanıcı bir onay kutusu görür. Başka her yerde (kendi sunucunuz,
// tek dosya sürümü, yerel http) o yetenek yoktur ve normal bağlantı çalışır.
// Tek kod yolu iki ortamı da karşılasın diye yetenek bir kez sorulup saklanır.
let _indirmeYetenegi;
function indirmeYetenegi() {
  if (_indirmeYetenegi === undefined) {
    _indirmeYetenegi = (typeof window !== 'undefined' && typeof window.claude?.use === 'function')
      ? Promise.resolve(window.claude.use('downloads')).catch(() => null)
      : Promise.resolve(null);
  }
  return _indirmeYetenegi;
}

/**
 * Dosyayı kullanıcıya verir.
 * @returns {Promise<boolean>} kullanıcı reddettiyse false
 */
async function indir(veri, adi, tur) {
  const blob = veri instanceof Blob ? veri : new Blob([veri], { type: tur });

  const yetenek = await indirmeYetenegi();
  if (yetenek) {
    try {
      await yetenek.save({ filename: adi, data: blob });
      return true;
    } catch (h) {
      // Kullanıcı reddettiyse sessizce bırak; başka bir aksaklıkta normal
      // bağlantı yolunu dene — dosyayı hiç vermemektense denemek yeğdir.
      if (h?.code === 'declined' || h?.code === 'rate_limited') {
        if (h.code === 'rate_limited') bildir('Bir indirme onayı zaten açık. Onu bitirip tekrar deneyin.', 'uyari');
        return false;
      }
      if (h?.code === 'too_large') {
        bildir('Dosya bu ortamda indirilemeyecek kadar büyük. Denetimi bölün ya da kendi sunucunuzdan açın.', 'hata');
        return false;
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: adi });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}

function dosyaAdi(d, uzanti) {
  const t = new Date(d.baslangic ?? Date.now());
  const iki = (n) => String(n).padStart(2, '0');
  return `denetim_${d.vin || 'sasisiz'}_${t.getFullYear()}${iki(t.getMonth() + 1)}${iki(t.getDate())}_${iki(t.getHours())}${iki(t.getMinutes())}.${uzanti}`;
}

async function excelIndir() {
  try {
    const fotolar = await depo.fotografBaytlari(durum.denetim.id);
    const kitap = excelUret(durum.denetim, fotolar, durum.ayarlar);
    const verildi = await indir(kitap, dosyaAdi(durum.denetim, 'xlsx'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    if (verildi) bildir(`Excel indirildi — ${fotolar.size} fotoğraf dosyanın içine gömüldü.`);
  } catch (h) {
    bildir(`Excel üretilemedi: ${h.message}`, 'hata');
  }
}

async function topluDisaAktar(denetimler) {
  try {
    const hepsi = new Map();
    for (const d of denetimler) {
      for (const [k, v] of await depo.fotografBaytlari(d.id)) hepsi.set(k, v);
    }
    const kitap = topluExcelUret(denetimler, hepsi, durum.ayarlar);
    const t = new Date();
    const verildi = await indir(kitap, `toplu_denetim_${t.getFullYear()}${String(t.getMonth() + 1).padStart(2, '0')}${String(t.getDate()).padStart(2, '0')}.xlsx`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    if (verildi) bildir(`${denetimler.length} denetim tek dosyaya aktarıldı.`);
  } catch (h) {
    bildir(`Toplu aktarım başarısız: ${h.message}`, 'hata');
  }
}

async function yedekIndir() {
  const y = await depo.yedekAl();
  const verildi = await indir(JSON.stringify(y), `arac_audit_yedek_${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
  if (verildi) bildir(`${y.denetimler.length} denetim, ${y.fotograflar.length} fotoğraf yedeklendi.`);
}

// ---------------------------------------------------------------------------
// EKRAN: RAPOR
// ---------------------------------------------------------------------------

function ekranRapor() {
  const d = durum.denetim;
  const sayfa = el('div', { sinif: 'sayfa' });
  const parca = el('div', {}, ustCubuk('Rapor', d.vin, 'denetim'), el('main', {}, sayfa));

  const urlHarita = new Map();
  for (const [id, url] of durum.fotoUrlleri) urlHarita.set(id, { url });
  sayfa.append(el('div', { html: htmlRapor(d, urlHarita, durum.ayarlar) }));

  parca.append(el('div', { sinif: 'alt-cubuk yazdirma-gizle' },
    el('button', { onclick: () => window.print() }, '🖨 Yazdır / PDF'),
    el('button', { onclick: excelIndir }, '⤓ Excel'),
    el('button', { onclick: () => { indir(csvUret(d, durum.ayarlar), dosyaAdi(d, 'csv'), 'text/csv;charset=utf-8').catch((h) => bildir(`CSV verilemedi: ${h.message}`, 'hata')); } }, '⤓ CSV'),
    el('button', { sinif: 'yesilb', onclick: denetimiBitir }, '✓ Bitir')));
  return parca;
}

async function denetimiBitir() {
  durum.denetim.durum = 'tamam';
  durum.denetim.bitis = new Date().toISOString();
  await depo.denetimKaydet(durum.denetim);
  bildir('Denetim kapatıldı.');
  git('ana');
}

// ---------------------------------------------------------------------------
// EKRAN: AYARLAR
// ---------------------------------------------------------------------------

function ekranAyarlar() {
  const sayfa = el('div', { sinif: 'sayfa' });
  const parca = el('div', {}, ustCubuk('Ayarlar', null, 'ana'), el('main', {}, sayfa));
  const e = durum.ayarlar.esikler;

  const sartli = el('input', { type: 'number', value: String(e.sartliPuan), min: '1' });
  const red = el('input', { type: 'number', value: String(e.redPuan), min: '1' });
  const kritik = el('input', { type: 'checkbox' });
  kritik.checked = e.kritikVarsaRed;
  const dil = el('select', {}, el('option', { value: 'tr', metin: 'Türkçe' }), el('option', { value: 'en', metin: 'English' }));
  dil.value = durum.ayarlar.dil;

  sayfa.append(el('div', { sinif: 'kart' },
    el('h2', { metin: 'Karar eşikleri' }),
    el('div', { sinif: 'uyari', metin: 'Bu ağırlıklar ve eşikler ÖRNEK başlangıç değerleridir; resmî bir audit standardından alınmamıştır. Kendi standardınızın sayılarını girin.' }),
    el('div', { sinif: 'izgara2', style: 'margin-top:10px' },
      el('label', { sinif: 'alan' }, 'Şartlı kabul eşiği (puan)', sartli),
      el('label', { sinif: 'alan' }, 'Red eşiği (puan)', red)),
    el('label', { sinif: 'alan', style: 'margin-top:10px;display:flex;align-items:center;gap:10px' },
      kritik, el('span', { metin: 'Tek bir kritik (A) hata aracı reddetsin' })),
    el('div', { style: 'margin-top:12px' },
      el('div', { sinif: 'grup-basligi', metin: 'Ceza puanı ağırlıkları' }),
      el('div', { sinif: 'hata-liste' }, ...SIDDETLER.map((s) =>
        el('div', { sinif: 'hata-satir' },
          el('div', { sinif: `siddet-pul siddet-${s.id}`, metin: s.id }),
          el('div', {}, el('div', { sinif: 'ad', metin: `${s.ad} — ${s.puan} puan` }), el('div', { sinif: 'yol', metin: s.aciklama })),
          el('div', {})))))));

  sayfa.append(el('div', { sinif: 'kart' },
    el('h2', { metin: 'Rapor dili' }),
    el('label', { sinif: 'alan' }, 'Excel ve rapor başlıkları', dil)));

  const yedekGirdi = el('input', { type: 'file', accept: 'application/json', style: 'display:none',
    onchange: async (ev) => {
      const dosya = ev.target.files[0];
      if (!dosya) return;
      try {
        const sonuc = await depo.yedekYukle(JSON.parse(await dosya.text()));
        bildir(`${sonuc.denetim} denetim, ${sonuc.fotograf} fotoğraf geri yüklendi.`);
      } catch (h) { bildir(`Yedek okunamadı: ${h.message}`, 'hata'); }
      ev.target.value = '';
    } });

  const depoBilgi = el('div', { sinif: 'bilgi', metin: 'Depolama ölçülüyor…' });
  depo.depoDurumu().then((s) => {
    depoBilgi.textContent = s
      ? `Kullanılan alan: ${(s.kullanilan / 1048576).toFixed(1)} MB / ${(s.kota / 1048576).toFixed(0)} MB (%${(s.oran * 100).toFixed(1)})`
      : 'Tarayıcı depolama ölçümünü desteklemiyor.';
  }).catch(() => { depoBilgi.textContent = 'Depolama durumu okunamadı.'; });

  sayfa.append(el('div', { sinif: 'kart' },
    el('h2', { metin: 'Veri' }), depoBilgi,
    el('div', { sinif: 'dugme-satir', style: 'margin-top:10px' },
      el('button', { onclick: yedekIndir }, '💾 Yedek al'),
      el('button', { onclick: () => yedekGirdi.click() }, '↥ Yedek yükle')),
    yedekGirdi));

  parca.append(el('div', { sinif: 'alt-cubuk' },
    el('button', { sinif: 'birincil', onclick: async () => {
      durum.ayarlar.esikler = {
        sartliPuan: Math.max(1, Number(sartli.value) || 15),
        redPuan: Math.max(1, Number(red.value) || 40),
        kritikVarsaRed: kritik.checked,
      };
      durum.ayarlar.dil = dil.value;
      await depo.ayarYaz('varsayilanlar', durum.ayarlar);
      bildir('Ayarlar kaydedildi.');
      git('ana');
    } }, 'Kaydet')));
  return parca;
}

// ---------------------------------------------------------------------------
// BAŞLANGIÇ
// ---------------------------------------------------------------------------

export async function baslat() {
  // Belgenin dili Türkçe olmazsa CSS'in text-transform: uppercase kuralı
  // "denetimler" -> "DENETIMLER" yazar; Türkçe'de doğrusu "DENETİMLER"dir.
  // Kendi index.html'imizde lang="tr" var, ama uygulama bir kabuğun (ör.
  // claude.ai Artifact) içine gömülüyse o kabuğun <html>'ini biz yazmayız.
  if (typeof document !== 'undefined') document.documentElement.lang = 'tr';

  try {
    const kayitli = await depo.ayarOku('varsayilanlar', null);
    if (kayitli) durum.ayarlar = { ...durum.ayarlar, ...kayitli, esikler: { ...VARSAYILAN_ESIKLER, ...(kayitli.esikler ?? {}) } };
  } catch { /* ilk açılış: ayar yok */ }
  ciz();
  window.addEventListener('resize', () => {
    const t = document.getElementById('model');
    if (durum.ekran === 'denetim' && t && tuvalOlcusuGuncelle(t)) durum.goruntuleyici?.ciz();
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', baslat);
  else baslat();
}
