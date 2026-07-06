export function normalizeName(v: string): string {
  return v.toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').trim();
}

/**
 * Fuzzy-ish conflict test between two party names: exact match after
 * normalization, or one containing the other (min 5 chars to avoid noise).
 */
export function namesConflict(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na.length < 3 || nb.length < 3) return false;
  if (na === nb) return true;
  return (na.length >= 5 && nb.includes(na)) || (nb.length >= 5 && na.includes(nb));
}
