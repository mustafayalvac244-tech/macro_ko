import { differenceInCalendarDays } from 'date-fns/differenceInCalendarDays';

/**
 * ANA EKRAN (PANO) HESAPLARI — saf ve sınanabilir (09.10.2026 denetimi).
 *
 * NEDEN AYRI DOSYA. Bu hesaplar ekranın içindeydi ve dört hata taşıyordu:
 *
 * 1) KALAN GÜN SAAT FARKIYLA SAYILIYORDU: `Math.ceil((son − şimdi) / 24 sa)`.
 *    Süreler 23:59'da dolduğu için bugün dolan süre "1 gün", yarın dolan
 *    "2 gün", DÜN dolmuş süre ise "Bugün" görünüyordu. Doğrusu yerel TAKVİM
 *    GÜNÜ farkı (gunFarki).
 * 2) SÜRESİ GEÇMİŞ SÜRE ANA EKRANDA HİÇ YOKTU. Telefon panosu yalnız bugünü ve
 *    sıradaki duruşmayı gösteriyordu; geniş panodaki liste 24 saatten eskiyi
 *    süzüyordu (gecikenSureler).
 * 3) SAAT, HESABIN İÇİNDE OKUNUYORDU. useMemo içindeki `new Date()` yalnız
 *    veri değişince yeniden okunduğundan uygulama açık kalınca gece yarısından
 *    sonra "BUGÜN" dünün işlerini gösteriyordu. Artık "şimdi" parametre;
 *    ekran onu useSimdi'den verir.
 * 4) YÜKLENİYOR / HATA "BOŞ" GİBİ GÖRÜNÜYORDU. Sorgu düşünce `data ?? []`
 *    boş liste veriyor, ekran "Planlı duruşma yok" yazıyordu (veriDurumu).
 *
 * Testler Türkiye saatinde koşar: tests/panoHesap.test.ts.
 */

export interface PanoSuresi {
  id: string;
  title: string;
  due_at: string;
  is_completed: boolean;
}

export interface PanoDurusmasi {
  id: string;
  title: string;
  scheduled_at: string;
  is_completed: boolean;
}

/**
 * Tarih okur. Salt tarih ("2026-10-09") YEREL gün olarak okunur:
 * `new Date('2026-10-09')` UTC gece yarısıdır ve UTC'nin batısında bir önceki
 * güne düşer.
 */
function tarihOku(iso: string): Date | null {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function zaman(iso: string): number {
  return tarihOku(iso)?.getTime() ?? 0;
}

/** Yerel takvim günü farkı: bugün 0, yarın 1, dün −1. Okunamayan tarih → null. */
export function gunFarki(iso: string, simdi: Date): number | null {
  const d = tarihOku(iso);
  return d ? differenceInCalendarDays(d, simdi) : null;
}

export interface YaklasanSure<T> {
  kayit: T;
  /** 0 = bugün, 1 = yarın … (asla negatif değil; geçmişler gecikenSureler'de). */
  kalanGun: number;
}

/** Bugün ve sonrasında dolacak, tamamlanmamış süreler; en yakın önce. */
export function yaklasanSureler<T extends PanoSuresi>(sureler: T[], simdi: Date, adet = 6): YaklasanSure<T>[] {
  const sonuc: YaklasanSure<T>[] = [];
  for (const kayit of sureler) {
    if (kayit.is_completed) continue;
    const kalanGun = gunFarki(kayit.due_at, simdi);
    if (kalanGun === null || kalanGun < 0) continue;
    sonuc.push({ kayit, kalanGun });
  }
  return sonuc.sort((a, b) => zaman(a.kayit.due_at) - zaman(b.kayit.due_at)).slice(0, adet);
}

export interface GecikenSure<T> {
  kayit: T;
  /** Son günün üstünden geçen takvim günü (≥ 1). */
  gecenGun: number;
}

/**
 * Son günü DÜN ya da daha önce olan, tamamlanmamış süreler; en yeni gecikme
 * önce. Bugün dolan (saati geçmiş olsa bile) süre burada değil, BUGÜN
 * listesindedir — takvimdeki "Geciken işler" ile aynı ölçü.
 */
export function gecikenSureler<T extends PanoSuresi>(sureler: T[], simdi: Date): GecikenSure<T>[] {
  const sonuc: GecikenSure<T>[] = [];
  for (const kayit of sureler) {
    if (kayit.is_completed) continue;
    const fark = gunFarki(kayit.due_at, simdi);
    if (fark === null || fark >= 0) continue;
    sonuc.push({ kayit, gecenGun: -fark });
  }
  return sonuc.sort((a, b) => zaman(b.kayit.due_at) - zaman(a.kayit.due_at));
}

export interface BugunKaydi {
  /** Ekrandaki anahtar: duruşma 'h' + id, süre 'd' + id. */
  id: string;
  at: string;
  title: string;
  isEvent: boolean;
}

/** BUGÜN listesi: yerel bugüne düşen tamamlanmamış duruşma/toplantı ve süreler, saate göre. */
export function bugunKayitlari(durusmalar: PanoDurusmasi[], sureler: PanoSuresi[], simdi: Date): BugunKaydi[] {
  const hs = durusmalar
    .filter((h) => !h.is_completed && gunFarki(h.scheduled_at, simdi) === 0)
    .map((h) => ({ id: 'h' + h.id, at: h.scheduled_at, title: h.title, isEvent: true }));
  const ds = sureler
    .filter((d) => !d.is_completed && gunFarki(d.due_at, simdi) === 0)
    .map((d) => ({ id: 'd' + d.id, at: d.due_at, title: d.title, isEvent: false }));
  return [...hs, ...ds].sort((a, b) => zaman(a.at) - zaman(b.at));
}

export type VeriDurumu = 'hazir' | 'yukleniyor' | 'hata';

/**
 * Bir ya da birkaç sorgunun ekranda ne gösterileceği.
 *
 * Elde veri varsa (önbellekten bile) HAZIR: yenileme hatası eldeki listeyi
 * silmez. Veri yokken hata → HATA; yoksa YÜKLENİYOR. Hiçbiri "boş liste"
 * demek değildir — boş durumu yalnız HAZIR + boş veri söyler.
 */
export function veriDurumu(...sorgular: Array<{ data?: unknown; isError: boolean }>): VeriDurumu {
  if (sorgular.some((s) => s.data === undefined && s.isError)) return 'hata';
  if (sorgular.some((s) => s.data === undefined)) return 'yukleniyor';
  return 'hazir';
}
