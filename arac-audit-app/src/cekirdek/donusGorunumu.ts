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
  aynalaHarita, GorunumHaritasi, GorunumId, noktadakiParca, PARCA_HARITALARI,
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
  /** Gösterilecek görselin yuvası: kendisi ya da aynalanan eşi. */
  kaynak: GorunumId;
  ayna: boolean;
}

/** Dolu (ya da aynayla doldurulabilen) halka yuvaları, açı sırasıyla. */
export function halka(dolu: (y: GorunumId) => boolean): HalkaGirdisi[] {
  const sonuc: HalkaGirdisi[] = [];
  for (const { yuva, aci } of HALKA_YUVALARI) {
    if (dolu(yuva)) { sonuc.push({ yuva, aci, kaynak: yuva, ayna: false }); continue; }
    const es = AYNA_ESI[yuva];
    if (es && dolu(es)) sonuc.push({ yuva, aci, kaynak: es, ayna: true });
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

/** Kaptaki dokunuş → görsele göre 0–1 koordinat (görselin dışındaysa null). */
export function goruntuNoktasi(
  dx: number, dy: number, kapEn: number, kapBoy: number, oran: number,
): { x: number; y: number } | null {
  const k = goruntuKutusu(kapEn, kapBoy, oran);
  const x = (dx - k.x) / k.en;
  const y = (dy - k.y) / k.boy;
  return x >= 0 && x <= 1 && y >= 0 && y <= 1 ? { x, y } : null;
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

/**
 * Bir görünümün kullanılacak parça haritası: kaynağın haritası (aynalanmışsa
 * aynası), görselin oranı uyuyorsa. `parcaVar` katalogda (ve bu araçta)
 * olmayan parçaları eler — küçük, bilinmeyen bir çokgen büyük bir parçayı
 * gölgelemesin.
 */
export function gorunumHaritasi(
  aracId: string, kaynak: GorunumId, ayna: boolean, gorselOrani: number, parcaVar: (id: string) => boolean,
): GorunumHaritasi | null {
  const h = kaynakHaritasi(aracId, kaynak);
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
