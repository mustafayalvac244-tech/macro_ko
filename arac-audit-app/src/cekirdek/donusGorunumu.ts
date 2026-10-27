// DÖNDÜRÜLEBİLİR ARAÇ (360°) — saf hesap: görünüm yuvaları, halka, ayna,
// dokunuş → parça ya da yüz.
//
// Ürün sahibi, 26.10.2026: "Hyundai sitelerinde aracı döndürebiliyoruz; araç
// üstünden parça seçmek için ekleyebilir miyiz?" Elindeki görseller sitedeki
// gibi 24–36 karelik bir dizi DEĞİL, standart bakışlar (önden, sol önden,
// soldan …, üstten). Bu yüzden her araç için dokuz ADLI YUVA var; her yuvanın
// açısı sabit. Sonra: "sol ön garnişe tıklayınca o parça seçilsin" — bir
// yuvanın parça haritası varsa (gorunumParcalari.ts) dokunuş PARÇAYI açar;
// yoksa YÜZÜ (bölgeyi) açar, parça listeden seçilir.
//
// GÖRSELLER DEPOYA GİRMEZ. Depo da APK bağlantısı da herkese açık; görseller
// telefona uygulamanın içinden aktarılır ve yalnız orada durur
// (veri/aracGorselleri.ts). Burada yalnız hesap var.
//
// AÇI. Araç ekseni: x ileri (ön), y aracın SOLUNA. Açı, kameranın önden
// itibaren aracın soluna doğru konumu: 0 önden, 45 sol önden, 90 soldan,
// 180 arkadan, 270 sağdan. Ekranın sağı araçta (−sin a, cos a) yönüdür:
// soldan bakarken aracın önü ekranın SOLUNDA kalır (ürün sahibinin
// görselleriyle karşılaştırıldı, 26.10.2026).
//
// AYNA. Eksik bir yan yuva karşı yanın yatay aynasıyla doldurulur (sağ yan =
// sol yanın aynası). Yalnız sol/sağ çiftleri arasında; ön, arka ve üst
// uydurulmaz. Araç tam simetrik değil (şarj kapağı vb.); ekranda yazar.
//
// YÜZ (haritası olmayan yuva). Aracı en/boy ölçüsünden bir kutu sayıp kameranın
// gördüğü yüzleri yatay eksene dik izdüşümle yerleştiriyoruz; görselde araç
// enine kenardan kenara oturuyor sayılır. YAKLAŞIK: köşe bakışlarında gerçek
// görselin ön/yan sınırı kutudan farklı düşer (ürün sahibinin sol ön
// görselinde ön, enin ~%43'ü; kutu %30 diyor). Yanlış bölge açılırsa geri
// dönülür; isabet için parça haritası gerekir. Üst görünüm: tamamı tavan.

import {
  aynalaHarita, cokgenAlani, cokgenIcinde, GorunumHaritasi, GorunumId, noktadakiParca, PARCA_HARITALARI,
} from './gorunumParcalari';

export type AracYuzu = 'on' | 'arka' | 'sol' | 'sag';

/** Halkadaki yuvalar, açı sırasıyla; 'ust' halkada değil, ayrı düğmeyle açılır. */
export const HALKA_YUVALARI: readonly { yuva: Exclude<GorunumId, 'ust'>; aci: number }[] = [
  { yuva: 'on', aci: 0 }, { yuva: 'sol_on', aci: 45 }, { yuva: 'sol', aci: 90 }, { yuva: 'sol_arka', aci: 135 },
  { yuva: 'arka', aci: 180 }, { yuva: 'sag_arka', aci: 225 }, { yuva: 'sag', aci: 270 }, { yuva: 'sag_on', aci: 315 },
];

/** Bütün yuvalar, Ayarlar'daki sırayla. */
export const YUVALAR: readonly GorunumId[] = [...HALKA_YUVALARI.map((x) => x.yuva), 'ust'];

const YUVA_ADI: Record<GorunumId, [string, string]> = {
  on: ['Ön', 'Front'], sol_on: ['Sol ön', 'Front LH'], sol: ['Sol yan', 'LH side'], sol_arka: ['Sol arka', 'Rear LH'],
  arka: ['Arka', 'Rear'], sag_arka: ['Sağ arka', 'Rear RH'], sag: ['Sağ yan', 'RH side'], sag_on: ['Sağ ön', 'Front RH'],
  ust: ['Üstten', 'Top'],
};

export function yuvaAdi(y: GorunumId, dil: 'tr' | 'en' = 'tr'): string {
  return YUVA_ADI[y][dil === 'en' ? 1 : 0];
}

/** Sol/sağ eşi — eksik yan yuva bunun aynasıyla doldurulur. */
export const AYNA_ESI: Partial<Record<GorunumId, GorunumId>> = {
  sol_on: 'sag_on', sag_on: 'sol_on', sol: 'sag', sag: 'sol', sol_arka: 'sag_arka', sag_arka: 'sol_arka',
};

/** Yüzün dış bölge kimliği (katalog.ts → BOLGELER). */
export const YUZ_BOLGESI: Record<AracYuzu, string> = {
  on: 'dis_on', arka: 'dis_arka', sol: 'dis_sol', sag: 'dis_sag',
};
export const UST_BOLGESI = 'dis_ust';

export interface HalkaGirdisi {
  yuva: Exclude<GorunumId, 'ust'>;
  aci: number;
  /** Gösterilecek görselin (ya da çizimin) yuvası: kendisi ya da aynalanan eşi. */
  kaynak: GorunumId;
  ayna: boolean;
  /** Görsel yok: bakış parça haritasından ÇİZİLİR (26.10.2026). */
  cizim: boolean;
}

/**
 * Dolu (ya da aynayla doldurulabilen) halka yuvaları, açı sırasıyla.
 *
 * ÇİZİM (26.10.2026). Ürün sahibi: "360 seçim ekranında olmalı." Görseller
 * uygulamaya gömülemiyor (depo ve APK herkese açık); ama parça haritası aracın
 * çizimidir. Görseli olmayan yuva, haritası varsa çizimle gösterilir — kurulum
 * gerekmez. Sıra: kendi görseli → eşinin görseli (ayna) → kendi haritası →
 * eşinin haritası (ayna). Görsel her zaman çizimden önce gelir.
 */
export function halka(dolu: (y: GorunumId) => boolean, haritali: (y: GorunumId) => boolean = () => false): HalkaGirdisi[] {
  const sonuc: HalkaGirdisi[] = [];
  for (const { yuva, aci } of HALKA_YUVALARI) {
    const es = AYNA_ESI[yuva];
    if (dolu(yuva)) sonuc.push({ yuva, aci, kaynak: yuva, ayna: false, cizim: false });
    else if (es && dolu(es)) sonuc.push({ yuva, aci, kaynak: es, ayna: true, cizim: false });
    else if (haritali(yuva)) sonuc.push({ yuva, aci, kaynak: yuva, ayna: false, cizim: true });
    else if (es && haritali(es)) sonuc.push({ yuva, aci, kaynak: es, ayna: true, cizim: true });
  }
  return sonuc;
}

/** Dizini halkanın içine sarar (−1 → son). */
export function sar(i: number, n: number): number {
  if (n <= 0) return 0;
  return ((Math.round(i) % n) + n) % n;
}

/**
 * Sürükleme: parmak sağa giderse araç parmağın altında sağa döner — soldan
 * bakarken ön (solda) bize gelir, açı küçülür, halkada geri gidilir. Enin
 * dörtte biri bir yuva.
 */
export function kaydirmaIndeksi(baslangic: number, dxOran: number, n: number): number {
  return sar(baslangic - Math.round(dxOran * 4), n);
}

export const aciSadelestir = (a: number): number => ((a % 360) + 360) % 360;

export interface AracOlcusu {
  /** mm — model3d.ts'teki araç ölçüleri. */
  uzunluk: number;
  genislik: number;
}

/**
 * Bu açıdan görünen yüzler ve görselin enindeki aralıkları (0–1, soldan
 * sağa). Aracın silueti enin tamamını kaplar sayılır.
 */
export function gorunenYuzler(aci: number, olcu: AracOlcusu): { yuz: AracYuzu; bas: number; son: number }[] {
  const r = (aciSadelestir(aci) * Math.PI) / 180;
  const sin = Math.sin(r);
  const cos = Math.cos(r);
  const L = olcu.uzunluk / 2;
  const W = olcu.genislik / 2;
  const yari = L * Math.abs(sin) + W * Math.abs(cos);
  const oran = (s: number) => 0.5 + s / (2 * yari);
  const esik = 1e-6;
  const yuzler: { yuz: AracYuzu; merkez: number; yarim: number }[] = [];
  if (cos > esik) yuzler.push({ yuz: 'on', merkez: -L * sin, yarim: W * cos });
  if (cos < -esik) yuzler.push({ yuz: 'arka', merkez: L * sin, yarim: -W * cos });
  if (sin > esik) yuzler.push({ yuz: 'sol', merkez: W * cos, yarim: L * sin });
  if (sin < -esik) yuzler.push({ yuz: 'sag', merkez: -W * cos, yarim: -L * sin });
  return yuzler
    .map((y) => ({ yuz: y.yuz, bas: oran(y.merkez - y.yarim), son: oran(y.merkez + y.yarim) }))
    .sort((a, b) => a.bas - b.bas);
}

/** Haritası olmayan bir halka görselinde dokunulan yüz; `xOran` görselde 0–1. */
export function dokunulanYuz(aci: number, xOran: number, olcu: AracOlcusu): AracYuzu | null {
  if (!(xOran >= 0 && xOran <= 1)) return null;
  for (const y of gorunenYuzler(aci, olcu)) if (xOran <= y.son) return y.yuz;
  return null;
}

/**
 * `resizeMode="contain"` ile gösterilen görselin kap içindeki dikdörtgeni:
 * oranlar farklıysa görsel ortalanır, kenarlarda boşluk kalır.
 */
export function goruntuKutusu(kapEn: number, kapBoy: number, oran: number): { x: number; y: number; en: number; boy: number } {
  if (kapEn <= 0 || kapBoy <= 0 || !(oran > 0)) return { x: 0, y: 0, en: kapEn, boy: kapBoy };
  if (kapEn / kapBoy > oran) {
    const en = kapBoy * oran;
    return { x: (kapEn - en) / 2, y: 0, en, boy: kapBoy };
  }
  const boy = kapEn / oran;
  return { x: 0, y: (kapBoy - boy) / 2, en: kapEn, boy };
}

export type GoruntuKutusu = { x: number; y: number; en: number; boy: number };

/** Haritadaki bütün çokgenlerin sınır kutusu (0–1), kenarında `pay` kadar boşlukla; harita boşsa tüm görsel. */
export function haritaOdagi(harita: GorunumHaritasi | null, pay = 0.03): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = 1; let y0 = 1; let x1 = 0; let y1 = 0;
  for (const a of harita?.alanlar ?? []) {
    for (const [x, y] of a.nokta) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  }
  if (!(x1 > x0) || !(y1 > y0)) return { x0: 0, y0: 0, x1: 1, y1: 1 };
  return { x0: Math.max(0, x0 - pay), y0: Math.max(0, y0 - pay), x1: Math.min(1, x1 + pay), y1: Math.min(1, y1 + pay) };
}

/**
 * BÜYÜK GÖRÜNÜM (26.10.2026, ürün sahibi: "aracı seçtiğinde büyüsün"): görselin
 * `odak` bölgesi (aracın sınır kutusu) kabı dolduracak şekilde büyütülür;
 * görselin kalanı kabın dışına taşar (kap `overflow: hidden`). Dönen kutu
 * görselin TAMAMININ kaptaki yeri — çizim, görsel ve dokunuş hesabı hep bu
 * kutuya göre, yani goruntuKutusu ile aynı sözleşme.
 */
export function odakKutusu(
  kapEn: number, kapBoy: number, oran: number, odak: { x0: number; y0: number; x1: number; y1: number },
): GoruntuKutusu {
  if (kapEn <= 0 || kapBoy <= 0 || !(oran > 0)) return { x: 0, y: 0, en: kapEn, boy: kapBoy };
  const gen = Math.max(1e-6, odak.x1 - odak.x0);
  const yuk = Math.max(1e-6, odak.y1 - odak.y0);
  // Görsel birimi: en = oran, boy = 1. Odak bölgesi kaba "contain" sığar.
  const olcek = Math.min(kapEn / (gen * oran), kapBoy / yuk);
  const en = oran * olcek;
  const boy = olcek;
  const x = (kapEn - gen * en) / 2 - odak.x0 * en;
  const y = (kapBoy - yuk * boy) / 2 - odak.y0 * boy;
  return { x, y, en, boy };
}

/** Kaptaki dokunuş → verilen görsel kutusuna göre 0–1 koordinat (görselin dışındaysa null). */
export function kutudakiNokta(dx: number, dy: number, k: GoruntuKutusu): { x: number; y: number } | null {
  if (!(k.en > 0) || !(k.boy > 0)) return null;
  const x = (dx - k.x) / k.en;
  const y = (dy - k.y) / k.boy;
  return x >= 0 && x <= 1 && y >= 0 && y <= 1 ? { x, y } : null;
}

/** Kaptaki dokunuş → görsele göre 0–1 koordinat (görselin dışındaysa null). */
export function goruntuNoktasi(
  dx: number, dy: number, kapEn: number, kapBoy: number, oran: number,
): { x: number; y: number } | null {
  return kutudakiNokta(dx, dy, goruntuKutusu(kapEn, kapBoy, oran));
}

/** Görselin oranı haritanınkiyle %2 içinde mi (sınır dahil; kayan nokta payı). */
export const oranUyar = (gorselOrani: number, haritaOrani: number): boolean =>
  gorselOrani > 0 && haritaOrani > 0 && Math.abs(gorselOrani - haritaOrani) / haritaOrani <= 0.02 + 1e-9;

/**
 * Sınav için derleme anında verilen harita (EXPO_PUBLIC_GORUNUM_HARITASI_SINAV,
 * JSON). Yalnız uçtan uca sınavın web derlemesinde tanımlı; APK ve OTA
 * derlemesinde tanımsız, kod hiçbir şey yapmaz.
 */
function sinavHaritalari(): Record<string, Partial<Record<GorunumId, GorunumHaritasi>>> {
  try {
    const ham = process.env.EXPO_PUBLIC_GORUNUM_HARITASI_SINAV;
    return ham ? JSON.parse(ham) : {};
  } catch {
    return {};
  }
}
const SINAV_HARITALARI = sinavHaritalari();

/** Yuvanın ham parça haritası (oran denetimi ve ayna yok); Ayarlar da buradan okur. */
export function kaynakHaritasi(aracId: string, yuva: GorunumId): GorunumHaritasi | undefined {
  return (SINAV_HARITALARI[aracId] ?? PARCA_HARITALARI[aracId])?.[yuva];
}

/** Aracın en az bir bakışının KENDİ parça haritası var mı (varsa görsel olmadan da çizilir). */
export function aracHaritasiVar(aracId: string): boolean {
  return YUVALAR.some((y) => !!kaynakHaritasi(aracId, y));
}

/**
 * GENEL ÇİZİM (27.10.2026). Altı modelin yalnız IONIQ 3'ün kendi parça haritası
 * var; öteki beşi görselsiz denetimde kutu şeması gösteriyordu. İkinci tur
 * estetik değerlendirmesi bunu "ürünün vitrininde kutu diyagramı" diye en
 * çirkin ekran saydı. Kendi haritası olmayan modelde IONIQ 3'ün çizimi GENEL
 * çizim olarak kullanılır ve ekranda öyle yazar (model çizimi diye sunulmaz).
 * Haritadaki 64 parçanın hepsi benzinli kataloğunda da var (birim testi).
 * YALNIZ ÇİZİMDE: o modele yüklenmiş gerçek fotoğrafa bu çokgenler
 * uygulanmaz — başka aracın parça sınırları fotoğrafla örtüşmez.
 */
export const GENEL_CIZIM_KAYNAGI = 'ioniq3';

export function genelCizimMi(aracId: string): boolean {
  return !aracHaritasiVar(aracId) && aracHaritasiVar(GENEL_CIZIM_KAYNAGI);
}

/** Görselsiz bakışta ÇİZİLECEK harita: aracın kendisi, yoksa genel çizim. */
export function cizimHaritasi(aracId: string, yuva: GorunumId): GorunumHaritasi | undefined {
  return kaynakHaritasi(aracId, yuva) ?? (genelCizimMi(aracId) ? kaynakHaritasi(GENEL_CIZIM_KAYNAGI, yuva) : undefined);
}

/** Araç görselsiz de döndürülebilir mi (kendi ya da genel çizimle). */
export function cizimVar(aracId: string): boolean {
  return YUVALAR.some((y) => !!cizimHaritasi(aracId, y));
}

export type CizimRolu = 'govde' | 'cam' | 'lastik' | 'siyah' | 'gumus' | 'far' | 'drl' | 'stop' | 'plaka';

/** Çizimde parçanın rengi için rolü (taraf öneki atılarak). Bilinmeyen → gövde. */
export function cizimRolu(parcaId: string): CizimRolu {
  const id = parcaId.replace(/^(sol|sag)_/, '');
  if (/(^|_)cam$|^cam_tavan$/.test(id)) return 'cam';
  if (/jant$/.test(id)) return 'lastik';
  if (id === 'stop' || id === 'ucuncu_stop') return 'stop';
  if (id === 'drl') return 'drl';
  if (id === 'far' || id === 'sis_far') return 'far';
  if (/plaka$/.test(id)) return 'plaka';
  // Aktif hava klapesi gerçekte gövdeden açık bir panel (27.10.2026 görsel ölçümü): gümüş-gri.
  if (/tampon_alt_garnis$/.test(id) || id === 'alt_panjur') return 'gumus';
  if (/garnis$|diregi$|^marspiyel$|^difuzor$|^on_izgara$|^spoyler$|^tavan_cita$|^anten$|^on_silecek$/.test(id)) return 'siyah';
  return 'govde';
}

/** Çizimde bu açıdan sivri kalan köşe (derece, kenar yönünün dönüşü). */
export const YUMUSAK_KOSE = 55;

/**
 * Çizimde çokgenin YUMUŞAK SVG yolu (26.10.2026, ürün sahibi: "araba silueti
 * neden boktan"). Haritalar dokunuş için çizildi; çamurluk kemeri, tavan,
 * tampon gibi kavisler 9 köşelik düz çizgiye düşüyordu. Kenar yönünün döndüğü
 * açı `kose` dereceden küçükse köşe kübik eğriye girer (Catmull-Rom teğeti,
 * komşu kenarın %40'ıyla sınırlı, taşmasın); büyükse sivri kalır (kapı,
 * plaka). Eğri her köşeden geçer; dokunuş yine düz çokgene bakar, fark
 * kenar boyunca bir pikselin altında.
 */
export function yumusakYol(
  nokta: readonly (readonly [number, number])[], en: number, boy: number, kose = YUMUSAK_KOSE,
): string {
  const P = nokta.map(([x, y]) => [x * en, y * boy] as const);
  const n = P.length;
  if (n < 3) return '';
  const tegetler = P.map((p, i) => {
    const a = P[(i - 1 + n) % n]!;
    const b = P[(i + 1) % n]!;
    const l1 = Math.hypot(p[0] - a[0], p[1] - a[1]);
    const l2 = Math.hypot(b[0] - p[0], b[1] - p[1]);
    if (!l1 || !l2) return null;
    const cos = ((p[0] - a[0]) * (b[0] - p[0]) + (p[1] - a[1]) * (b[1] - p[1])) / (l1 * l2);
    if ((Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI > kose) return null;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const ld = Math.hypot(dx, dy);
    if (!ld) return null;
    return { x: dx / ld, y: dy / ld, once: Math.min(ld / 6, l1 * 0.4), sonra: Math.min(ld / 6, l2 * 0.4) };
  });
  const f = (v: number) => (Math.round(v * 10) / 10).toString();
  let yol = `M${f(P[0]![0])},${f(P[0]![1])}`;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const p = P[i]!;
    const q = P[j]!;
    const ti = tegetler[i];
    const tj = tegetler[j];
    const c1 = ti ? [p[0] + ti.x * ti.sonra, p[1] + ti.y * ti.sonra] : p;
    const c2 = tj ? [q[0] - tj.x * tj.once, q[1] - tj.y * tj.once] : q;
    yol += `C${f(c1[0]!)},${f(c1[1]!)} ${f(c2[0]!)},${f(c2[1]!)} ${f(q[0])},${f(q[1])}`;
  }
  return `${yol}Z`;
}

/**
 * Bir görünümün kullanılacak parça haritası: kaynağın haritası (aynalanmışsa
 * aynası), görselin oranı uyuyorsa. `parcaVar` katalogda (ve bu araçta)
 * olmayan parçaları eler — küçük, bilinmeyen bir çokgen büyük bir parçayı
 * gölgelemesin.
 */
export function gorunumHaritasi(
  aracId: string, kaynak: GorunumId, ayna: boolean, gorselOrani: number, parcaVar: (id: string) => boolean,
  /** Görsel değil çizim: aracın kendi haritası yoksa genel çizimin haritası. */
  cizimIcin = false,
): GorunumHaritasi | null {
  const h = cizimIcin ? cizimHaritasi(aracId, kaynak) : kaynakHaritasi(aracId, kaynak);
  if (!h || !oranUyar(gorselOrani, h.oran)) return null;
  const kullanilan = ayna ? aynalaHarita(h) : h;
  const alanlar = kullanilan.alanlar.filter((a) => parcaVar(a.parcaId));
  return alanlar.length ? { oran: kullanilan.oran, alanlar } : null;
}

export type DokunusSonucu =
  | { tur: 'parca'; parcaId: string }
  | { tur: 'bolge'; bolgeId: string }
  | { tur: 'bos' };

/**
 * Görseldeki noktaya dokunuş: haritası olan görünümde parça (çokgen dışı →
 * boş, tahmin yok); haritasız halka görünümünde yüzün bölgesi; haritasız üst
 * görünümde tavan bölgesi.
 */
export function dokunusSonucu(
  nokta: { x: number; y: number }, gorunum: { aci: number | null }, harita: GorunumHaritasi | null, olcu: AracOlcusu,
): DokunusSonucu {
  if (harita) {
    const p = noktadakiParca(harita, nokta.x, nokta.y);
    return p ? { tur: 'parca', parcaId: p } : { tur: 'bos' };
  }
  if (gorunum.aci === null) return { tur: 'bolge', bolgeId: UST_BOLGESI };
  const yuz = dokunulanYuz(gorunum.aci, nokta.x, olcu);
  return yuz ? { tur: 'bolge', bolgeId: YUZ_BOLGESI[yuz] } : { tur: 'bos' };
}

/**
 * Parça → üzerindeki kayıtların EN YÜKSEK demerit'i (26.10.2026). Araç
 * görünümünde kayıtlı parça bu dereceyle boyanır; eskiden üç derece de aynı
 * kırmızıydı (dış değerlendirme). İki parça arası kayıt (boşluk, kademe) iki
 * parçayı da işaretler. Kabul edilmiş kayıt 0 sayılır.
 */
export function parcaDemeritleri(
  hatalar: readonly { parcaId: string; ikinciParcaId?: string; derece: string; kabulEdilebilir: boolean }[],
): Map<string, number> {
  const m = new Map<string, number>();
  for (const h of hatalar) {
    const d = h.kabulEdilebilir ? 0 : (Number.isFinite(Number(h.derece)) ? Number(h.derece) : 0);
    for (const p of [h.parcaId, h.ikinciParcaId]) {
      if (p) m.set(p, Math.max(d, m.get(p) ?? -1));
    }
  }
  return m;
}

/**
 * Parça → üzerindeki kayıt sayısı (numaralı işaretin rakamı, 27.10.2026). İki
 * parça arası kayıt (boşluk/kademe) ikisinde de sayılır — boya da ikisini boyar.
 */
export function parcaKayitSayilari(
  hatalar: readonly { parcaId: string; ikinciParcaId?: string }[],
): Map<string, number> {
  const m = new Map<string, number>();
  for (const h of hatalar) {
    for (const p of [h.parcaId, h.ikinciParcaId]) if (p) m.set(p, (m.get(p) ?? 0) + 1);
  }
  return m;
}

/**
 * YAKINLAŞTIRMA (26.10.2026). Yan yatırma kalkınca dikey telefonda büyük
 * görünüm karttan büyük değildi (ölçüm, web: sahne 366×173, kart 342×171);
 * ekranın eni aracı sınırlıyor. Küçük parçalara (delta garnişi, kapı kolu)
 * isabet için büyük görünümde yakınlaştırılır, yakınken sürükleyerek gezilir.
 */
export const YAKINLIKLAR = [1, 1.6, 2.4] as const;

/** Yakınlaştırılmış kutu: kabın ortası sabit kalır, üstüne kayma (px) eklenir. */
export function yakinKutu(
  k: GoruntuKutusu, kapEn: number, kapBoy: number, yakin: number, kayma: { x: number; y: number },
): GoruntuKutusu {
  if (!(yakin > 1)) return k;
  const cx = kapEn / 2;
  const cy = kapBoy / 2;
  return { x: cx - (cx - k.x) * yakin + kayma.x, y: cy - (cy - k.y) * yakin + kayma.y, en: k.en * yakin, boy: k.boy * yakin };
}

/**
 * Kaymayı sınırla: araç (odak kutusu) kabdan büyükse kenarları kabın dışında
 * kalır, içeride boşluk açılmaz; kabdan küçükse o eksende ortalanır.
 */
export function kaymaSinirla(
  k: GoruntuKutusu, kapEn: number, kapBoy: number, yakin: number,
  odak: { x0: number; y0: number; x1: number; y1: number } | null, kayma: { x: number; y: number },
): { x: number; y: number } {
  if (!(yakin > 1)) return { x: 0, y: 0 };
  const z = yakinKutu(k, kapEn, kapBoy, yakin, { x: 0, y: 0 });
  const o = odak ?? { x0: 0, y0: 0, x1: 1, y1: 1 };
  const eksen = (a0: number, a1: number, uzunluk: number, v: number) => (
    a1 - a0 <= uzunluk ? (uzunluk - a0 - a1) / 2 : Math.min(-a0, Math.max(uzunluk - a1, v))
  );
  return {
    x: eksen(z.x + o.x0 * z.en, z.x + o.x1 * z.en, kapEn, kayma.x),
    y: eksen(z.y + o.y0 * z.boy, z.y + o.y1 * z.boy, kapBoy, kayma.y),
  };
}

/**
 * YOĞUNLUK BOYASI (26.10.2026, Analiz'deki araç haritası). Parçadaki kayıt
 * sayısı en çok kayıtlı parçaya göre üç kademeye ayrılır (≤ ⅓ az, ≤ ⅔ orta,
 * üstü çok); kademe demerit renkleriyle çizilir (1 hardal, 2 turuncu, 3
 * kırmızı) — uygulamada tek renk dili. Sayı ≤ 0 ise boyanmaz (null).
 */
export function yogunlukKademesi(sayi: number, enCok: number): '1' | '2' | '3' | null {
  if (!(sayi > 0)) return null;
  const oran = sayi / Math.max(1, enCok);
  return oran <= 1 / 3 ? '1' : oran <= 2 / 3 ? '2' : '3';
}


// --- NUMARALI İŞARET (27.10.2026) --------------------------------------------
// İkinci tur değerlendirmede iki tasarımcı da aynı şeyi söyledi: parçanın
// tamamı %55 demerit rengine boyanınca gri gövdede "çamur/pas" gibi okunuyor;
// renk yalnız küçük dolu işarette kalsın, parça ince dolgu + kalın kenar olsun.
// İşaret parçanın İÇİNDE durmalı: içbükey parçada (tampon, çamurluk) ağırlık
// merkezi dışarı düşebilir; o zaman kenarlara en uzak iç nokta aranır.

type Nokta = readonly [number, number];

function kenaraUzaklik(nokta: readonly Nokta[], x: number, y: number): number {
  let en = Infinity;
  for (let i = 0, j = nokta.length - 1; i < nokta.length; j = i++) {
    const [x1, y1] = nokta[j]!;
    const [x2, y2] = nokta[i]!;
    const dx = x2 - x1, dy = y2 - y1;
    const u = dx || dy ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy))) : 0;
    en = Math.min(en, Math.hypot(x - (x1 + u * dx), y - (y1 + u * dy)));
  }
  return en;
}

/**
 * İşaretin yeri: alan ağırlıklı merkez çokgenin içindeyse o; değilse sınır
 * kutusunda 16×16 ızgaradan kenara en uzak iç nokta. `oran` en/boy oranı
 * (koordinatlar 0–1 ama kutu kare değil; uzaklık gerçek oranla ölçülür).
 */
export function cokgenMerkezi(nokta: readonly Nokta[], oran = 1): [number, number] {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < nokta.length; i++) {
    const [x1, y1] = nokta[i]!;
    const [x2, y2] = nokta[(i + 1) % nokta.length]!;
    const k = x1 * y2 - x2 * y1;
    a += k; cx += (x1 + x2) * k; cy += (y1 + y2) * k;
  }
  if (Math.abs(a) > 1e-12) {
    const m: [number, number] = [cx / (3 * a), cy / (3 * a)];
    if (cokgenIcinde(nokta, m[0], m[1])) return m;
  }
  const xs = nokta.map((p) => p[0]), ys = nokta.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const olcekli = nokta.map(([x, y]) => [x * oran, y] as const);
  let en: [number, number] | null = null, enUzak = -1;
  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 16; j++) {
      const x = x0 + ((i + 0.5) / 16) * (x1 - x0), y = y0 + ((j + 0.5) / 16) * (y1 - y0);
      if (!cokgenIcinde(nokta, x, y)) continue;
      const d = kenaraUzaklik(olcekli, x * oran, y);
      if (d > enUzak) { enUzak = d; en = [x, y]; }
    }
  }
  return en ?? [nokta.reduce((t, p) => t + p[0], 0) / nokta.length, nokta.reduce((t, p) => t + p[1], 0) / nokta.length];
}

/**
 * Bu bakışta işaret konacak parçalar ve yerleri: her parça için BİR işaret,
 * parçanın bu bakıştaki en büyük alanında. Sıra: alanın büyüğünden küçüğüne
 * (küçük parçanın işareti üstte kalsın diye çizimde sona gelir).
 */
export function isaretYerleri(
  alanlar: readonly { parcaId: string; nokta: readonly Nokta[] }[],
  isaretlenecek: (parcaId: string) => boolean,
  oran = 1,
): { parcaId: string; x: number; y: number }[] {
  const enBuyuk = new Map<string, { nokta: readonly Nokta[]; alan: number }>();
  for (const a of alanlar) {
    if (!isaretlenecek(a.parcaId)) continue;
    const alan = cokgenAlani(a.nokta);
    if (alan > (enBuyuk.get(a.parcaId)?.alan ?? -1)) enBuyuk.set(a.parcaId, { nokta: a.nokta, alan });
  }
  return [...enBuyuk.entries()]
    .sort((p, q) => q[1].alan - p[1].alan)
    .map(([parcaId, x]) => { const [mx, my] = cokgenMerkezi(x.nokta, oran); return { parcaId, x: mx, y: my }; });
}
