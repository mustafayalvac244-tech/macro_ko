/**
 * AI ÇIKTISI NE KADAR DÜZELTİLDİ — ucuz ölçü.
 *
 * NEDEN TAM DÜZENLEME MESAFESİ (Levenshtein) DEĞİL. Levenshtein O(n·m)'dir;
 * ölçülmüş dilekçe uzunluğu ~6.000 karakter, yani 36 milyon hücre. Bunu bir
 * telefonda, kullanıcı kaydete bastığı anda hesaplamak arayüzü dondururdu.
 * Ölçüm uğruna ürünü yavaşlatmak kötü bir takas: kimse ölçülmek için
 * beklemez, özelliği kullanmayı bırakır.
 *
 * BUNUN YERİNE: ortak önek ve ortak sonek kırpılır, kalan "değişmiş bölge"nin
 * oranı döner. O(n) ve tek geçiş.
 *
 * NEYİ ÖLÇER, NEYİ ÖLÇMEZ — açıkça:
 *   • Baştan/sondan/ortadan TEK bir bölgeyi düzenlemeyi doğru ölçer.
 *   • DAĞINIK düzeltmeleri (ilk ve son cümleyi ayrı ayrı değiştirmek)
 *     OLDUĞUNDAN BÜYÜK gösterir — ortak önek/sonek kısalır, arada kalan
 *     değişmemiş metin de "değişmiş" sayılır.
 *   • Yani bu bir ÜST SINIRDIR. "Şu kadar değişti" demez, "en fazla bu kadar
 *     değişmiş olabilir" der.
 *
 * Bu kısıt bilerek kabul edildi: amaç mutlak bir yüzde değil, MODLARI VE
 * MODELLERİ BİRBİRİYLE KIYASLAMAK. Aynı hata payı hepsinde olduğu için
 * sıralama bozulmaz — Haiku çıktıları Sonnet'inkilerden ağır düzeltiliyorsa
 * bu ölçü onu gösterir.
 */
export function duzeltmeOrani(asil: string, son: string): number {
  if (asil === son) return 0;
  if (asil.length === 0) return son.length === 0 ? 0 : 1;
  if (son.length === 0) return 1;

  const enKisa = Math.min(asil.length, son.length);

  let onek = 0;
  while (onek < enKisa && asil[onek] === son[onek]) onek++;

  // Sonek sayarken önek bölgesine taşmıyoruz: "aaa" → "aa" gibi durumlarda
  // aynı karakterler iki kez sayılır ve oran negatife düşerdi.
  let sonek = 0;
  while (
    sonek < enKisa - onek &&
    asil[asil.length - 1 - sonek] === son[son.length - 1 - sonek]
  ) {
    sonek++;
  }

  const degisen = Math.max(asil.length, son.length) - onek - sonek;
  const oran = degisen / Math.max(asil.length, son.length);
  // numeric(4,3) sütununa yazılıyor; üç haneye burada yuvarlanır ki
  // veritabanının yuvarlaması ile istemcinin gösterdiği sayı ayrışmasın.
  return Math.min(1, Math.max(0, Math.round(oran * 1000) / 1000));
}
