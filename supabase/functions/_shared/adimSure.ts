// İSTEK ADIM SÜRELERİ — 04.10.2026.
// ---------------------------------------------------------------------------
// Avukat eleştirisi: "yapay zekâ yavaş". Ölçüldü (04.10, olcum-paralel):
// sohbet 22–23 sn; model değiştirmek süreyi kısaltmadı, yani zamanın büyük
// kısmı modelin DIŞINDA — ama NEREDE olduğu bilinmiyordu, çünkü yalnız toplam
// süre ölçülebiliyordu. Bu modül her istekte üç sayı tutar ve ai_istek'e
// yazılır (0169): toplam, modele kadar geçen (arama/hazırlık), modelde geçen.
// Kalan (toplam − modele kadar − model) = denetim + kayıt. Böylece teşhis
// para harcayan test çağrısıyla değil, GERÇEK kullanımın kendisiyle yapılır.
//
// Neden AsyncLocalStorage: aynı işlem eşzamanlı istekleri birlikte işler;
// modül düzeyinde tek bir değişken istekleri birbirine karıştırırdı. Süre
// bağlamı her isteğe ayrı açılır, parametre olarak taşımak gerekmez.
import { AsyncLocalStorage } from 'node:async_hooks';

interface Baglam {
  t0: number;
  modelBas: number | null;
  modelMs: number;
  /** Adım adına toplam ms (05.10.2026 — 20 sn'nin hangi adımda gittiği). */
  adimlar: Record<string, number>;
  /** İstek başına yedek hat kapısı (bkz. yedekKapisiKur); kurulmamışsa kapı yoktur. */
  yedekKapi?: () => Promise<boolean>;
}

const depo = new AsyncLocalStorage<Baglam>();

/**
 * Bu isteğin yedek hat kapısını kurar (10.10.2026, bkz. yedekKapisi.ts).
 * Bağlam burada çünkü isteğe özel veri (kullanıcı) derin çağrı zincirine
 * parametre olarak taşınmak zorunda kalmasın; süre bağlamıyla aynı sebep.
 */
export function yedekKapisiKur(kapi: () => Promise<boolean>): void {
  const b = depo.getStore();
  if (b) b.yedekKapi = kapi;
}

/** Yedek hatta GEÇMEDEN önce sorulur: true = geçilebilir (kapı yoksa da true). */
export async function yedekIzniVarMi(): Promise<boolean> {
  const kapi = depo.getStore()?.yedekKapi;
  return kapi ? kapi() : true;
}

/** İsteği bir süre bağlamı içinde koşturur. */
export function sureIzle<T>(fn: () => T): T {
  return depo.run({ t0: Date.now(), modelBas: null, modelMs: 0, adimlar: {} }, fn);
}

/** Model çağrısını sarar: ilk başlangıç anını ve toplam model süresini tutar. */
export async function modelSuresi<T>(fn: () => Promise<T>): Promise<T> {
  const b = depo.getStore();
  const bas = Date.now();
  if (b && b.modelBas === null) b.modelBas = bas - b.t0;
  try {
    return await fn();
  } finally {
    if (b) b.modelMs += Date.now() - bas;
  }
}

/**
 * Adlandırılmış bir adımın süresini toplar (aynı ad birden çok kez koşarsa
 * süreler TOPLANIR; paralel koşan adımların toplamı duvar saatini aşabilir —
 * bu bir hata değil, "bu adım toplam ne kadar iş yaptı" ölçüsüdür).
 */
export async function adim<T>(ad: string, fn: () => Promise<T>): Promise<T> {
  const b = depo.getStore();
  const bas = Date.now();
  try {
    return await fn();
  } finally {
    if (b) b.adimlar[ad] = (b.adimlar[ad] ?? 0) + (Date.now() - bas);
  }
}

/** ai_istek sütunları. Bağlam yoksa (ör. test) boş döner. */
export function sureOzeti(): {
  sure_ms?: number;
  model_bas_ms?: number | null;
  model_ms?: number;
  adimlar?: Record<string, number>;
} {
  const b = depo.getStore();
  if (!b) return {};
  return { sure_ms: Date.now() - b.t0, model_bas_ms: b.modelBas, model_ms: b.modelMs, adimlar: { ...b.adimlar } };
}
