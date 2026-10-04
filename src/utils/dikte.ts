/**
 * Dikte parçasını mevcut metne ekler: araya tek boşluk (04.10.2026).
 * Saf modül — react-native çeken useSesleYaz test edilemediği için ayrı
 * (tests/dikte.test.ts).
 */
export function dikteEkle(mevcut: string, parca: string): string {
  const p = parca.trim();
  if (!p) return mevcut;
  if (!mevcut.trim()) return p;
  return /\s$/.test(mevcut) ? `${mevcut}${p}` : `${mevcut} ${p}`;
}
