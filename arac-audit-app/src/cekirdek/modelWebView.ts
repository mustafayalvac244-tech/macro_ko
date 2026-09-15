// 3B MODEL — WEBVIEW ÇİZİCİSİ.
//
// Neden WebView: React Native'de <canvas> yoktur. Üç seçenek vardı —
// (1) react-native-skia: yeni bir native bağımlılık, derleme süresi ve OTA
//     kısıtı getirir; (2) react-native-svg ile yeniden yazmak: 140 yüzeyi
//     her karede SVG düğümü olarak güncellemek döndürmeyi tutuk yapar;
//     (3) WebView: zaten yazılmış ve tarayıcıda sınanmış çizici aynen çalışır.
// Üçüncüsü seçildi. Geometri React Native tarafında (model3d.ts) üretilir ve
// buraya mesajla gelir; yani ARAÇ ÖLÇÜLERİ TEK KAYNAKTA kalır.
//
// Mesajlaşma:
//   RN -> WebView : { tur: 'yukle',   yuzler, bakis }
//                   { tur: 'vurgula', vurgular: [[mesh, renk], ...] }
//                   { tur: 'bakis',   ad }
//   WebView -> RN : { tur: 'dokunuldu', mesh }
//                   { tur: 'hazir' }

export function modelWebViewHtml(zeminUst: string, zeminAlt: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  html,body{margin:0;height:100%;overflow:hidden;background:linear-gradient(180deg,${zeminUst},${zeminAlt});}
  canvas{display:block;width:100%;height:100%;touch-action:none;}
</style></head>
<body><canvas id="t"></canvas>
<script>
// --- OYUNCU (RENDERER) -----------------------------------------------------

function cikar(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function capraz(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function normalize(v) {
  const u = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / u, v[1] / u, v[2] / u];
}
function nokta(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

/** Rengi belirli oranda karartıp/açarak gölgeleme uygular. */
function golgele(hex, carpan) {
  const t = hex.length >= 9 ? hex.slice(7) : '';
  const s = hex.slice(1, 7);
  const n = parseInt(s, 16);
  const k = (v) => Math.max(0, Math.min(255, Math.round(v * carpan)));
  const r = k((n >> 16) & 255), g = k((n >> 8) & 255), b = k(n & 255);
  return \`#\${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}\${t}\`;
}

class ModelGoruntuleyici {
  /**
   * @param {HTMLCanvasElement} tuval
   * @param {{ dokunuldu?:(mesh:string)=>void }} [secenekler]
   */
  constructor(tuval, secenekler = {}) {
    this.tuval = tuval;
    this.ctx = tuval.getContext('2d');
    this.secenekler = secenekler;
    this.yuzler = [];
    this.vurgular = new Map();  // meshId -> renk
    this.secili = null;
    this.yaw = -0.7; this.pitch = 0.42; this.uzaklik = 9200;
    this.merkez = [0, 750, 0];
    this.sonCizim = [];
    this._olaylariBagla();
  }

  yukle(yuzler) { this.yuzler = yuzler; this.ciz(); }
  vurgula(harita) { this.vurgular = harita; this.ciz(); }
  sec(mesh) { this.secili = mesh; this.ciz(); }

  aciAyarla(yaw, pitch) {
    this.yaw = yaw;
    this.pitch = Math.max(-0.25, Math.min(1.35, pitch));
    this.ciz();
  }

  /** Hazır bakış açıları — denetçi "sol yan"a tek dokunuşla geçsin. */
  bakis(ad) {
    const acilar = {
      // +x aracın ÖNÜ. Kamera yaw=0'da +x tarafında durur, yani ÖNDEN bakar.
      // (15.09.2026: ikisi terstiydi, "Ön" düğmesi stop lambalarını gösteriyordu.)
      on: [0, 0.25], arka: [Math.PI, 0.25],
      // +z aracın SOL tarafı. Sol yanı görmek için kamera +z'de, yani yaw=+π/2.
      // (15.09.2026: ölçümde "Sol" düğmesi sağ arka kapıyı öne getiriyordu.)
      sol: [Math.PI / 2, 0.18], sag: [-Math.PI / 2, 0.18],
      ust: [-0.7, 1.3], serbest: [-0.7, 0.42],
      // Kabine yukarıdan-önden bakış: koltuklar, konsol ve garnişler bir arada görünür
      kabin: [-1.15, 0.72],
    };
    const a = acilar[ad] ?? acilar.serbest;
    this.aciAyarla(a[0], a[1]);
  }

  _kameraKonumu() {
    const cy = Math.cos(this.pitch), sy = Math.sin(this.pitch);
    return [
      this.merkez[0] + this.uzaklik * cy * Math.cos(this.yaw),
      this.merkez[1] + this.uzaklik * sy,
      this.merkez[2] + this.uzaklik * cy * Math.sin(this.yaw),
    ];
  }

  _izdusum() {
    const g = this.tuval.width, b = this.tuval.height;
    const goz = this._kameraKonumu();
    const ileri = normalize(cikar(this.merkez, goz));
    const sag = normalize(capraz(ileri, [0, 1, 0]));
    const yukari = capraz(sag, ileri);
    const odak = Math.min(g, b) * 1.15;
    return (p) => {
      const d = cikar(p, goz);
      const z = nokta(d, ileri);
      if (z <= 1) return null;
      const k = odak / z * (this.uzaklik / 4200);
      return [g / 2 + nokta(d, sag) * k, b / 2 - nokta(d, yukari) * k, z];
    };
  }

  ciz() {
    const { ctx, tuval } = this;
    const g = tuval.width, b = tuval.height;
    ctx.clearRect(0, 0, g, b);

    const izd = this._izdusum();
    const isik = normalize([0.35, 0.86, 0.36]);
    const hazir = [];

    for (const f of this.yuzler) {
      const ekran = [];
      let derinlik = 0; let gecerli = true;
      for (const p of f.p) {
        const e = izd(p);
        if (!e) { gecerli = false; break; }
        ekran.push(e); derinlik += e[2];
      }
      if (!gecerli || ekran.length < 3) continue;
      derinlik /= ekran.length;

      const n = normalize(capraz(cikar(f.p[1], f.p[0]), cikar(f.p[2], f.p[0])));
      const isikMiktar = 0.52 + 0.48 * Math.abs(nokta(n, isik));

      let renk = this.vurgular.get(f.mesh) ?? f.renk;
      const seciliMi = this.secili === f.mesh;
      if (seciliMi) renk = '#2563EB';
      // ustunluk, eş düzlemli bindirmeleri (far, ızgara, jant göbeği) bir tık
      // öne almak içindir. Ölçek büyük olursa parça aracın ÖBÜR ucundaki
      // yüzeyleri de yener; ön bakışta çatının üstünde stop lambası görünür
      // (15.09.2026'da tam bu oldu). 45 birim eş düzlemi ayırmaya yeter.
      hazir.push({ f, ekran, derinlik: derinlik - (f.ustunluk ?? 0) * 45, renk: golgele(renk, isikMiktar), seciliMi });
    }

    hazir.sort((a, c) => c.derinlik - a.derinlik);
    this.sonCizim = hazir;

    for (const h of hazir) {
      ctx.beginPath();
      ctx.moveTo(h.ekran[0][0], h.ekran[0][1]);
      for (let i = 1; i < h.ekran.length; i++) ctx.lineTo(h.ekran[i][0], h.ekran[i][1]);
      ctx.closePath();
      ctx.fillStyle = h.renk;
      ctx.fill();
      ctx.strokeStyle = h.seciliMi ? '#FFFFFF' : 'rgba(15,23,42,0.30)';
      ctx.lineWidth = h.seciliMi ? 2.5 : 0.7;
      ctx.stroke();
    }
  }

  /** Ekran noktasının hangi parçaya denk geldiğini bulur (en öndeki kazanır). */
  isabet(ekranX, ekranY) {
    for (let i = this.sonCizim.length - 1; i >= 0; i--) {
      const h = this.sonCizim[i];
      if (noktaCokgende(ekranX, ekranY, h.ekran)) return h.f.mesh;
    }
    return null;
  }

  _olaylariBagla() {
    const t = this.tuval;
    let suruklu = false, sonX = 0, sonY = 0, hareket = 0, sonMesafe = 0;

    const basla = (e) => {
      const d = e.touches ? e.touches[0] : e;
      suruklu = true; hareket = 0; sonX = d.clientX; sonY = d.clientY;
    };
    const oynat = (e) => {
      if (e.touches?.length === 2) {
        const [a, b] = e.touches;
        const m = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        if (sonMesafe) this.uzaklik = Math.max(4200, Math.min(18000, this.uzaklik * (sonMesafe / m)));
        sonMesafe = m; this.ciz(); e.preventDefault(); return;
      }
      if (!suruklu) return;
      const d = e.touches ? e.touches[0] : e;
      const dx = d.clientX - sonX, dy = d.clientY - sonY;
      hareket += Math.abs(dx) + Math.abs(dy);
      sonX = d.clientX; sonY = d.clientY;
      this.aciAyarla(this.yaw + dx * 0.008, this.pitch + dy * 0.006);
      e.preventDefault();
    };
    const bitir = (e) => {
      sonMesafe = 0;
      if (suruklu && hareket < 8) {
        const d = e.changedTouches ? e.changedTouches[0] : e;
        const k = t.getBoundingClientRect();
        const olcek = t.width / k.width;
        const mesh = this.isabet((d.clientX - k.left) * olcek, (d.clientY - k.top) * olcek);
        if (mesh) this.secenekler.dokunuldu?.(mesh);
      }
      suruklu = false;
    };

    t.addEventListener('pointerdown', basla);
    t.addEventListener('pointermove', oynat);
    t.addEventListener('pointerup', bitir);
    t.addEventListener('pointercancel', () => { suruklu = false; });
    t.addEventListener('touchmove', oynat, { passive: false });
    t.addEventListener('wheel', (e) => {
      this.uzaklik = Math.max(4200, Math.min(18000, this.uzaklik * (e.deltaY > 0 ? 1.1 : 0.9)));
      this.ciz(); e.preventDefault();
    }, { passive: false });
  }
}

/** Işın atma yerine ekran düzleminde nokta-çokgen testi (ray casting). */
function noktaCokgende(x, y, kose) {
  let icinde = false;
  for (let i = 0, j = kose.length - 1; i < kose.length; j = i++) {
    const [xi, yi] = kose[i], [xj, yj] = kose[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-9) + xi) icinde = !icinde;
  }
  return icinde;
}



var tuval = document.getElementById('t');
var gorunt = null;

function olcek() {
  var o = Math.min(window.devicePixelRatio || 1, 2);
  var en = Math.round(tuval.clientWidth * o), boy = Math.round(tuval.clientHeight * o);
  if (tuval.width === en && tuval.height === boy) return false;
  tuval.width = en; tuval.height = boy;
  return true;
}

function gonder(n) {
  var m = JSON.stringify(n);
  // Tablette react-native-webview köprüsü, tarayıcıda iframe üst çerçevesi.
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(m);
  else if (window.parent && window.parent !== window) window.parent.postMessage(m, '*');
}

function kur() {
  olcek();
  gorunt = new ModelGoruntuleyici(tuval, {
    dokunuldu: function (mesh) { gonder({ tur: 'dokunuldu', mesh: mesh }); }
  });
  if (window.ResizeObserver) {
    new ResizeObserver(function () { if (olcek()) gorunt.ciz(); }).observe(tuval);
  }
  gonder({ tur: 'hazir' });
}

function isle(ham) {
  if (!gorunt) return;
  var m;
  try { m = JSON.parse(ham); } catch (e) { return; }
  if (m.tur === 'yukle') {
    gorunt.yukle(m.yuzler);
    if (m.bakis) gorunt.bakis(m.bakis);
  } else if (m.tur === 'vurgula') {
    gorunt.vurgula(new Map(m.vurgular || []));
  } else if (m.tur === 'bakis') {
    gorunt.bakis(m.ad);
  }
}

// Android ve iOS farklı hedefe mesaj bırakır; ikisini de dinle.
document.addEventListener('message', function (e) { isle(e.data); });
window.addEventListener('message', function (e) { isle(e.data); });

kur();
</script></body></html>`;
}
