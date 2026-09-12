// SINIRLI EŞZAMANLILIK HAVUZU — "aynı anda en fazla N iş".
//
// NEDEN VAR. harvest-tick belgeleri TEK TEK, aralarına 300 ms uyku koyarak
// indiriyordu. Bugün ölçüldü (Bedesten getDocumentContent, gerçek istekler):
//
//     seri + 300 ms uyku ....... 1,01 belge/sn
//     eşzamanlılık 4 ........... 4,24 belge/sn   (16 belge, 0 hata)
//     eşzamanlılık 8 ........... 8,29 belge/sn   (16 belge, 0 hata)
//
// Yani tur başına süre bütçesinin neredeyse tamamı beklemekle geçiyordu.
//
// NEDEN 8 DEĞİL 4. Yukarıdaki 8,29 rakamı 16 belgelik TEK BİR PATLAMADA
// ölçüldü; SÜREKLİ o hızda UYAP'ın ne yapacağı ÖLÇÜLMEDİ. Önceki bir oturumda
// eşzamanlılık 16'da 429 geldiği ölçülmüş. Kaynak bir KAMU hizmeti ve IP
// yasağı ürünü tamamen öldürür. Ölçülmemiş bir tavana yaslanmaktansa ölçülmüş
// ve hatasız çıkan 4'te durmak doğru karar.
//
// NEDEN AYRI DOSYA. Edge çalışma zamanına gömülü kalsaydı yalnız canlıda fark
// edilirdi; hasatta tam olarak bu yüzden aylarca sessiz hata taşındı
// (bkz. _shared/hasatSayfa.ts'teki aynı not). Burası test edilebilir.

/**
 * `isler` listesini en fazla `esZaman` tanesi aynı anda çalışacak şekilde
 * işler. Sonuçlar GİRİŞ SIRASINDA döner — sıra bozulursa hangi belgenin hangi
 * karara ait olduğu karışır.
 *
 * Bir iş hata atarsa TÜM havuz düşmez: o iş için `undefined` döner. Tek bir
 * belge indirilemediğinde turun tamamını çöpe atmak, indirdiğimiz diğer
 * belgeleri de kaybettirirdi.
 */
export async function havuzda<T, R>(
  isler: readonly T[],
  esZaman: number,
  yap: (is: T, sira: number) => Promise<R>
): Promise<(R | undefined)[]> {
  const n = isler.length;
  const sonuc: (R | undefined)[] = new Array(n);
  if (n === 0) return sonuc;

  // En az 1, en fazla iş sayısı kadar. 0 ya da negatif verilirse seri çalışır;
  // sessizce sonsuz eşzamanlılığa düşmek tehlikeli olurdu.
  const sinir = Math.max(1, Math.min(Math.floor(esZaman) || 1, n));

  let sonraki = 0;
  async function isci() {
    for (;;) {
      const i = sonraki++;
      if (i >= n) return;
      try {
        sonuc[i] = await yap(isler[i], i);
      } catch {
        sonuc[i] = undefined;
      }
    }
  }

  await Promise.all(Array.from({ length: sinir }, () => isci()));
  return sonuc;
}
