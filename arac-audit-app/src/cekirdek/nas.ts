// EKİBİN EXCEL'İ ("NAS — New Audit System") — alanlar, listeler, skor, dışa aktarma.
//
// Ürün sahibi, 26.10.2026: "İçeriği buna göre yap, Excel'de her şey var; biz
// kullanış ve arayüz sunacağız." Bu dosya Excel'in İÇERİĞİNİ tek yerde tutar:
// CLASS, DEMERIT, SYSTEM, RESPONSIBLE, PROBLEM SOURCE listeleri; Audit Skoru;
// Excel'in iki liste sayfasıyla (AUDIT_CARS_LIST, PROBLEMS_LIST) aynı sütunlu
// dışa aktarma.
//
// Excel'in kendisinden ölçülenler (sayılar şirket verisi, depoya yazılmadı):
//  - Audit Skoru = round(100 × Σ DEMERIT / denetlenen araç). Makroyu okuyup
//    sayfadaki sayıları verilerden yeniden üreterek doğrulandı.
//  - Makronun "Bu Ay"ı YILA BAKMIYOR (bütün yılların aynı ayı toplanıyor) ve
//    BJ satırına toplam yazılıyor. Burada ikisi de doğru hesaplanır; skorlar
//    bu yüzden Excel'dekiyle aynı ÇIKMAYABİLİR — fark Excel'in hatasıdır.
//  - Tarih Excel'de metin olarak yazılıyor; burada gerçek tarih hücresi.

import { BOLGELER, PARCA_INDEKS, parcaCiftiAdi, HATA_TIPI_INDEKS } from './katalog';
import { ARAC_INDEKS } from './model3d';
import { Denetim, Hata, SinifKodu } from './tipler';
import { STIL, Hucre, Sayfa } from './xlsx';

export const SINIFLAR: readonly SinifKodu[] = ['MINOR', 'MAJOR', 'MAIN'];
export const VARSAYILAN_SINIF: SinifKodu = 'MINOR';

/** Excel'deki SYSTEM listesi — Excel kayıtlarındaki sıklık sırasıyla. */
export const NAS_SISTEMLERI = ['EXTERIOR', 'INTERIOR', 'BODY', 'PAINT', 'CHASSIS', 'DRIVE', 'ELECTRIC', 'MOVING'] as const;

/** Excel'deki RESPONSIBLE listesi — sıklık sırasıyla. Ekip yenisini ekleyebilir. */
export const HAZIR_SORUMLULAR: readonly string[] = ['QC-PART', 'ASSEMBLY', 'BODY', 'PAINT', 'PD', 'PRESS'];

/** Excel'deki PROBLEM SOURCE listesi, Excel'deki sırayla. */
export const PROBLEM_KAYNAKLARI: readonly string[] = ['AUDIT', '3M - DEALER CLAIM', 'LONG TERM', 'NCBS', 'DURABILITY'];

/** Audit Skoru'na yalnız bu kaynak girer (Excel makrosu da öyle sayıyor). */
export const SKOR_KAYNAGI = 'AUDIT';

/**
 * Kaynağın Excel'deki yazılışı. Uygulamanın eski sürümleri "HMC Audit" ve
 * "Durability" yazıyordu (24.10–26.10.2026); boş kaynak en eski kayıtlardır,
 * o zaman her denetim audit'ti. Büyük harf İngilizce kuralıyla: Türkçe
 * kuralla "Durability" → "DURABİLİTY" olurdu.
 */
export function kaynakKodu(k: string | null | undefined): string {
  const t = (k ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
  if (!t || t === 'HMC AUDIT') return SKOR_KAYNAGI;
  return t;
}

export const skoraGirerMi = (k: string | null | undefined): boolean => kaynakKodu(k) === SKOR_KAYNAGI;

/**
 * Hatanın DEMERIT değeri. Eski kayıtlardaki "kabul edilebilir" bayrağı 0
 * sayılır (puana girmez); derece metni sayıya çevrilir.
 */
export function demeritDegeri(h: Pick<Hata, 'derece' | 'kabulEdilebilir'>): number {
  if (h.kabulEdilebilir) return 0;
  const n = Number(h.derece);
  return Number.isFinite(n) ? n : 0;
}

export function sinifDegeri(h: Pick<Hata, 'sinif'>): SinifKodu {
  return h.sinif && (SINIFLAR as readonly string[]).includes(h.sinif) ? h.sinif : VARSAYILAN_SINIF;
}

/** Boya ve mastik tipleri — Excel'de dış kayıtlarda PAINT altında toplanıyor. */
const BOYA_TIPLERI = new Set(['toz_kir', 'akinti', 'portakal', 'krater', 'renk_farki', 'boyasiz', 'mastik']);

const BOLGE_GRUBU = new Map(BOLGELER.map((b) => [b.id, b.grup] as const));

/**
 * Excel SYSTEM'in VARSAYILANI — denetçi değiştirebilir. Excel'deki dağılımdan
 * türetildi: motor bölmesi ve şase altı CHASSIS'te, fonksiyon kontrolleri
 * ELECTRIC'te, yol testi DRIVE'da; dışta mastik/boya PAINT'te, kalanı
 * EXTERIOR'da. BODY ve MOVING hiçbir zaman varsayılan değil (Excel'de de az
 * ve parçadan ayırt edilemiyor).
 */
export function varsayilanSistem(parcaId: string, hataTipiId: string): string {
  const p = PARCA_INDEKS[parcaId];
  const grup = p ? BOLGE_GRUBU.get(p.bolgeId) : undefined;
  if (grup === 'surus') return 'DRIVE';
  if (grup === 'fonksiyon') return 'ELECTRIC';
  if (grup === 'motor' || p?.bolgeId === 'dis_alt') return 'CHASSIS';
  if (grup === 'ic') return 'INTERIOR';
  if (BOYA_TIPLERI.has(hataTipiId)) return 'PAINT';
  return 'EXTERIOR';
}

export function sistemDegeri(h: Pick<Hata, 'sistem' | 'parcaId' | 'hataTipiId'>): string {
  return h.sistem || varsayilanSistem(h.parcaId, h.hataTipiId);
}

/**
 * VBA'nın Round'u: tam yarıda ÇİFTE yuvarlar (12,5 → 12; 13,5 → 14).
 * JavaScript'in Math.round'u yukarı yuvarlar; Excel'le aynı sayıyı vermek
 * için makronun davranışı taklit edilir.
 */
export function vbaYuvarla(x: number): number {
  const t = Math.floor(x);
  const kesir = x - t;
  if (kesir > 0.5) return t + 1;
  if (kesir < 0.5) return t;
  return t % 2 === 0 ? t : t + 1;
}

/**
 * Audit Skoru: 100 araçta düşen demerit. Araç yoksa null ("—"). İşlem
 * sırası da makronunki (önce bölme, sonra ×100): kayan noktada aynı ara
 * değer, aynı yuvarlama.
 */
export function auditSkoru(demeritToplami: number, aracSayisi: number): number | null {
  return aracSayisi > 0 ? vbaYuvarla((demeritToplami / aracSayisi) * 100) : null;
}

/** Bir denetimin toplam demerit'i — her kaydın demerit'i × adedi. */
export function denetimDemeriti(d: { hatalar?: Hata[] }): number {
  return (d.hatalar ?? []).reduce((t, h) => t + demeritDegeri(h) * (h.adet ?? 1), 0);
}

/** Excel'in model kodu; tanınmayan araç kimliği olduğu gibi. */
export function modelKodu(aracId: string): string {
  return ARAC_INDEKS[aracId]?.kod ?? aracId;
}

// --- DIŞA AKTARMA: Excel'in iki liste sayfası ---------------------------------

/** Excel tarih seri numarası (yerel saat) — hücre gerçek tarih olsun, metin değil. */
export function excelTarihi(iso: string): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return (d.getTime() - d.getTimezoneOffset() * 60000) / 86400000 + 25569;
}

export const ARAC_SUTUNLARI = ['NO', 'DATE', 'PROBLEM SOURCE', 'MODEL', 'BODY', 'PROBLEM QTY', 'Auditor', 'UNICODECAR'] as const;
export const PROBLEM_SUTUNLARI = [
  'NO', 'DATE', 'PROBLEM SOURCE', 'MODEL', 'BODY', 'CLASS', 'DEMERIT', 'SYSTEM', 'Problem Part', 'Problem Type',
  'EXTRA DETAIL', 'PHOTO LINK', 'RESPONSIBLE', 'AUDITOR', 'PROGRESS', 'COUNTERMEASURE', 'CM APPLICATION DATE',
  'VERIFICATION BODY NO', 'UNICODE', 'Countermeasure Link',
] as const;

/**
 * PROGRESS hücresi (26.10.2026). Ekibin dosyasında bu sütunda ölçülen TEK değer
 * "SHARED" (273 satır); başka etiket uydurulmadı. Açık kayıt boş kalır;
 * paylaşılmış, önlemi uygulanmış ya da doğrulanmış kayıt "SHARED" yazar —
 * ayrıntı COUNTERMEASURE, CM APPLICATION DATE ve VERIFICATION BODY NO'da.
 */
export function ilerlemeKodu(h: Pick<Hata, 'durum'>): string {
  return h.durum && h.durum !== 'acik' ? 'SHARED' : '';
}

/** Body yoksa şasinin son 6 hanesi — Excel aracı body ile tanıyor. */
function govdeNo(d: Denetim): string {
  return d.bodyNo || (d.vin ? d.vin.slice(-6) : '');
}

/** Fotoğrafın tam yedekteki (yedek.ts) yolu — PHOTO LINK bunu yazar. */
export const yedektekiFotograf = (fotoId: string): string => `fotograflar/${fotoId}.jpg`;

/**
 * Excel'in AUDIT_CARS_LIST ve PROBLEMS_LIST sayfaları — aynı sütunlar, aynı
 * sıra; ekip satırları kendi çalışma kitabına doğrudan yapıştırabilsin.
 * Farklar bilerek: tarih gerçek tarih; PROBLEM QTY gerçek problem sayısı
 * (Excel'de bayrak gibi kullanılıyordu); PHOTO LINK fotoğrafların tam
 * yedekteki dosya adları (Excel'de hep aynı klasör yolu yazıyordu);
 * VERIFICATION BODY NO boş (Excel'de hücrelerin çoğunda bir form etiketinin
 * adı, "Label17", yazıyor); PROBLEM SOURCE Excel'in yazımıyla (kaynakKodu).
 */
export function nasSayfalari(
  denetimler: readonly Denetim[],
  fotografAdi: (fotoId: string) => string = yedektekiFotograf,
): Sayfa[] {
  const baslik = (adlar: readonly string[]): Hucre[] => adlar.map((a) => ({ v: a, stil: STIL.BASLIK }));
  const tarih = (iso: string): Hucre => {
    const s = excelTarihi(iso);
    return s === null ? { v: '', stil: STIL.GOVDE_ORTA } : { v: s, stil: STIL.TARIH };
  };
  const metin = (v: string): Hucre => ({ v, stil: STIL.GOVDE });
  const tarihVeyaBos = (iso: string | null | undefined): Hucre => (iso ? tarih(iso) : { v: '', stil: STIL.GOVDE_ORTA });
  const orta = (v: string | number): Hucre => ({ v, stil: STIL.GOVDE_ORTA });

  const sirali = [...denetimler].sort((a, b) => a.baslangic.localeCompare(b.baslangic));
  const araclar: Hucre[][] = [baslik(ARAC_SUTUNLARI)];
  const problemler: Hucre[][] = [baslik(PROBLEM_SUTUNLARI)];

  for (const d of sirali) {
    const kaynak = kaynakKodu(d.denetimTipi);
    const model = modelKodu(d.aracId);
    const govde = govdeNo(d);
    const adet = (d.hatalar ?? []).reduce((t, h) => t + (h.adet ?? 1), 0);
    araclar.push([
      orta(araclar.length), tarih(d.baslangic), orta(kaynak), orta(model), orta(govde), orta(adet),
      metin(d.denetci), metin(`${kaynak}${model}${govde}`),
    ]);
    for (const h of [...(d.hatalar ?? [])].sort((a, b) => a.zaman.localeCompare(b.zaman))) {
      const parca = parcaCiftiAdi(h, 'en');
      const tip = HATA_TIPI_INDEKS[h.hataTipiId]?.en ?? h.hataTipiId;
      problemler.push([
        orta(problemler.length), tarih(h.zaman), orta(kaynak), orta(model), orta(govde),
        orta(sinifDegeri(h)), orta(demeritDegeri(h)), orta(sistemDegeri(h)), metin(parca), metin(tip),
        metin([h.konum, h.aciklama].filter(Boolean).join(', ')), metin((h.fotograflar ?? []).map(fotografAdi).join(', ')),
        orta(h.sorumlu ?? ''), metin(d.denetci), orta(ilerlemeKodu(h)), metin(h.onlem ?? ''),
        h.durum === 'giderildi' || h.durum === 'kapali' ? tarihVeyaBos(h.giderilmeZamani) : orta(''),
        orta(h.durum === 'kapali' ? h.dogrulamaBody ?? '' : ''),
        metin(`${kaynak}${model}${govde}${parca}${tip}`), metin(''),
      ]);
    }
  }

  const genislik = (n: number, ozel: Record<number, number>) => Array.from({ length: n }, (_, i) => ozel[i] ?? 14);
  return [
    {
      ad: 'AUDIT_CARS_LIST', satirlar: araclar, dondur: { satir: 1 },
      sutunGenislikleri: genislik(ARAC_SUTUNLARI.length, { 0: 7, 1: 17, 6: 22, 7: 24 }),
    },
    {
      ad: 'PROBLEMS_LIST', satirlar: problemler, dondur: { satir: 1 },
      sutunGenislikleri: genislik(PROBLEM_SUTUNLARI.length, { 0: 7, 1: 17, 8: 30, 9: 22, 10: 28, 11: 24, 13: 20, 18: 36 }),
    },
  ];
}
