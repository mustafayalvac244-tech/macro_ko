// VIN (şasi numarası) ve plaka doğrulama.
// VIN her zaman 17 karakterdir (ISO 3779). I, O, Q harfleri hiç kullanılmaz —
// 1, 0 ile karışmasın diye. Barkod okuyucu ya da elle giriş, ikisi de buradan
// geçer; böylece "yanlış okundu" hatası kaydın en başında yakalanır.

export interface VinBilgisi {
  wmi?: string;
  uretici?: string | null;
  govde?: string;
  yilKodu?: string;
  modelYili?: number | null;
  fabrikaKodu?: string;
  seriNo?: string;
  kontrolHanesi?: string;
  beklenenKontrolHanesi?: string | null;
  kontrolHanesiUyuyor?: boolean;
}

export interface VinSonucu {
  gecerli: boolean;
  vin: string;
  hatalar: string[];
  uyarilar: string[];
  bilgi: VinBilgisi;
}

export interface PlakaSonucu {
  gecerli: boolean;
  plaka: string;
  bicimli: string;
  il?: string;
  uyarilar: string[];
}

export const VIN_UZUNLUK = 17;

/** VIN'de yasak harfler: I, O, Q. */
const YASAK = /[IOQ]/g;

/** Harf -> sayı çevrimi (ISO 3779 kontrol hanesi hesabı). */
const HARF_DEGER: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};

/** Hane ağırlıkları; 9. hane (kontrol hanesi) 0 ağırlıklıdır. */
const AGIRLIK = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

/** Model yılı kodları — I, O, Q, U, Z ve 0 kullanılmaz. 30 yılda bir tekrarlar. */
const YIL_KODLARI = 'ABCDEFGHJKLMNPRSTVWXY123456789'.split('');

/**
 * Okunan metni VIN'e çevirir: boşluk/tire atılır, büyütülür ve barkodun
 * sıkça karıştırdığı karakterler düzeltilir (VIN'de I/O/Q olamayacağı için
 * bu düzeltme güvenlidir, tahmin değildir).
 */
export function vinNormalize(ham: unknown): string {
  return String(ham ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/I/g, '1')
    .replace(/O/g, '0')
    .replace(/Q/g, '0');
}

/** ISO 3779 kontrol hanesini hesaplar; 10 sonucu 'X' ile gösterilir. */
export function kontrolHanesi(vin: string): string | null {
  let toplam = 0;
  for (let i = 0; i < VIN_UZUNLUK; i++) {
    const k = vin[i];
    const deger = k >= '0' && k <= '9' ? Number(k) : HARF_DEGER[k];
    if (deger === undefined) return null;
    toplam += deger * AGIRLIK[i];
  }
  const kalan = toplam % 11;
  return kalan === 10 ? 'X' : String(kalan);
}

/**
 * VIN'in 10. hanesinden model yılı. 30 yıllık döngü olduğu için hangi
 * döngüde olduğumuzu içinde bulunulan yıla göre seçeriz.
 * @param {string} kod tek karakter
 * @param {number} buYil
 */
export function modelYili(kod: string, buYil: number = new Date().getFullYear()): number | null {
  const i = YIL_KODLARI.indexOf(String(kod).toUpperCase());
  if (i === -1) return null;
  let yil = 1980 + i;
  while (yil + 30 <= buYil + 1) yil += 30;
  return yil;
}

/**
 * Üretici ön eki (WMI) için okunabilir ad.
 * DİKKAT: bu tablo bilgi amaçlıdır, resmî SAE/ISO kaydından doğrulanmamıştır.
 * Ayarlar ekranından düzenlenebilir; hiçbir kararı tek başına bağlamaz.
 */
export const WMI_IPUCU: Record<string, string> = {
  NLH: 'Hyundai Assan — Türkiye (doğrulayın)',
  TMA: 'Hyundai — Çekya (doğrulayın)',
  KMH: 'Hyundai — Kore (doğrulayın)',
  NMT: 'Toyota — Türkiye (doğrulayın)',
  VF1: 'Renault — Fransa (doğrulayın)',
};

/**
 * VIN'i doğrular.
 * @returns {{gecerli:boolean, vin:string, hatalar:string[], uyarilar:string[], bilgi:object}}
 */
export function vinDogrula(ham: unknown): VinSonucu {
  const vin = vinNormalize(ham);
  const hatalar = [];
  const uyarilar = [];

  if (vin.length === 0) {
    hatalar.push('Şasi numarası boş.');
  } else if (vin.length !== VIN_UZUNLUK) {
    hatalar.push(`Şasi numarası ${VIN_UZUNLUK} karakter olmalı — ${vin.length} karakter okundu.`);
  }
  if (YASAK.test(vin)) {
    YASAK.lastIndex = 0;
    hatalar.push('VIN içinde I, O veya Q harfi bulunamaz.');
  }

  const bilgi: VinBilgisi = {};
  if (hatalar.length === 0) {
    bilgi.wmi = vin.slice(0, 3);
    bilgi.uretici = WMI_IPUCU[bilgi.wmi] ?? null;
    bilgi.govde = vin.slice(3, 9);
    bilgi.yilKodu = vin[9];
    bilgi.modelYili = modelYili(vin[9]);
    bilgi.fabrikaKodu = vin[10];
    bilgi.seriNo = vin.slice(11);

    const beklenen = kontrolHanesi(vin);
    bilgi.kontrolHanesi = vin[8];
    bilgi.beklenenKontrolHanesi = beklenen;
    bilgi.kontrolHanesiUyuyor = beklenen !== null && beklenen === vin[8];
    // Avrupa'da üretilen bazı araçlarda 9. hane kontrol hanesi DEĞİLDİR.
    // Bu yüzden uyuşmazlık kaydı engellemez, yalnız uyarır.
    if (!bilgi.kontrolHanesiUyuyor) {
      uyarilar.push(`Kontrol hanesi uyuşmuyor (okunan "${vin[8]}", hesaplanan "${beklenen}"). Avrupa üretimi araçlarda bu hane kontrol hanesi olmayabilir; yine de barkodu bir kez daha okutun.`);
    }
    if (bilgi.modelYili === null) {
      uyarilar.push('10. hane geçerli bir model yılı kodu değil.');
    }
  }

  return { gecerli: hatalar.length === 0, vin, hatalar, uyarilar, bilgi };
}

// --- PLAKA ---------------------------------------------------------------
// Fabrika denetiminde araçların çoğunda plaka olmaz; bu alan zorunlu değildir.
// Türk plakası girilirse biçim kontrol edilir, uymayan giriş ENGELLENMEZ,
// yalnızca uyarı verilir (ihracat/geçici plaka olabilir).

const PLAKA_DESEN = /^(0[1-9]|[1-7]\d|8[01])([A-Z]{1,3})(\d{2,5})$/;

export function plakaNormalize(ham: unknown): string {
  return String(ham ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
    .replace(/İ/g, 'I').replace(/Ş/g, 'S').replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U').replace(/Ö/g, 'O').replace(/Ç/g, 'C');
}

/**
 * Türk plakasını biçimlendirir ve doğrular.
 * Kural: 1 harf -> 4-5 rakam, 2 harf -> 3-4 rakam, 3 harf -> 2 rakam.
 */
export function plakaDogrula(ham: unknown): PlakaSonucu {
  const p = plakaNormalize(ham);
  if (!p) return { gecerli: true, plaka: '', bicimli: '', uyarilar: [] };

  const m = PLAKA_DESEN.exec(p);
  if (!m) {
    return { gecerli: false, plaka: p, bicimli: p, uyarilar: ['Türk plaka biçimine uymuyor (örn. 41 ABC 12). Geçici veya ihracat plakasıysa olduğu gibi bırakabilirsiniz.'] };
  }
  const [, il, harf, rakam] = m;
  // Kural: 1 harf -> 4-5 rakam, 2 harf -> 3-4, 3 harf -> 2. Desen zaten
  // 1-3 harf dayattığı için buraya başka bir uzunluk gelemez, ama tip
  // sistemine bunu kanıtlamak gerekiyor.
  const izinliler: Record<number, [number, number]> = { 1: [4, 5], 2: [3, 4], 3: [2, 2] };
  const izinli = izinliler[harf.length] ?? [1, 5];
  const uyarilar = [];
  if (rakam.length < izinli[0] || rakam.length > izinli[1]) {
    uyarilar.push(`${harf.length} harfli plakada ${izinli[0]}${izinli[0] === izinli[1] ? '' : '-' + izinli[1]} rakam beklenir.`);
  }
  return { gecerli: uyarilar.length === 0, plaka: p, bicimli: `${il} ${harf} ${rakam}`, il, uyarilar };
}
