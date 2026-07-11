/**
 * T.C. Kimlik Numarası doğrulaması — resmi algoritma.
 * Bu, numaranın MATEMATİKSEL olarak geçerli olup olmadığını kontrol eder
 * (NVİ'den kişi sorgusu yapmaz; öyle bir ücretsiz servis yoktur). Rastgele
 * uydurma numaraları eler, gerçek bir kimliğin biçimsel geçerliliğini doğrular.
 */
export function isValidTCKN(value: string): boolean {
  const tc = (value ?? '').trim();
  if (!/^[1-9][0-9]{10}$/.test(tc)) return false;

  const d = tc.split('').map(Number);
  const oddSum = d[0]! + d[2]! + d[4]! + d[6]! + d[8]!; // 1,3,5,7,9. hane
  const evenSum = d[1]! + d[3]! + d[5]! + d[7]!; // 2,4,6,8. hane

  const digit10 = ((oddSum * 7) - evenSum) % 10;
  if (((digit10 + 10) % 10) !== d[9]) return false;

  const first10Sum = d.slice(0, 10).reduce((a, b) => a + b, 0);
  if (first10Sum % 10 !== d[10]) return false;

  return true;
}
