/**
 * Açılış perdesi (LaunchIntro) kalktı mı? Ana ekranın bento girişi
 * (src/components/ui/Belir.tsx) perdenin ALTINDA oynayıp kimseye
 * görünmeden bitmesin diye perdeyi bekler.
 *
 * GÜVENLİK AĞI: perde hiç monte olmazsa ya da bitiş haber vermezse
 * kartlar görünmez kalmasın — bekleyen taraf en geç `AZAMI_MS` sonra
 * kendiliğinden başlar (perdenin kendi güvenlik ağı 3.200 ms).
 */
const AZAMI_MS = 3500;
let kalkti = false;
const bekleyenler = new Set<() => void>();

export function perdeKalkti(): void {
  kalkti = true;
  for (const f of bekleyenler) f();
  bekleyenler.clear();
}

/** Perde kalkınca (ya da en geç AZAMI_MS sonra) `f` bir kez çağrılır. Dönen işlev iptal eder. */
export function perdeyiBekle(f: () => void): () => void {
  if (kalkti) {
    f();
    return () => {};
  }
  let bitti = false;
  const bir = () => {
    if (bitti) return;
    bitti = true;
    clearTimeout(zaman);
    bekleyenler.delete(bir);
    f();
  };
  const zaman = setTimeout(bir, AZAMI_MS);
  bekleyenler.add(bir);
  return () => {
    bitti = true;
    clearTimeout(zaman);
    bekleyenler.delete(bir);
  };
}
