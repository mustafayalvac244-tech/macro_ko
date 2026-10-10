// ZIP İÇİNDEN OKUMADA AÇILMIŞ BOYUT TAVANI (10.10.2026, 50 denetçi → ajan 26).
// ---------------------------------------------------------------------------
// SORUN. doc-extract DOCX/UDF'i JSZip ile açıyordu: `async('string')` girdiyi
// TAMAMEN açar. Mevcut tavan (base64 11 MB ≈ 8 MB dosya) yalnız SIKIŞMIŞ
// boyutu sınırlıyor; deflate'in en kötü oranı ≈1000:1 olduğundan 8 MB'lık bir
// ZIP gigabaytlarca XML'e açılıp işlevin belleğini bitirir. (Kullanıcı
// oturumu şart, yani kendi isteğini çökertir; yine de hem kaynak israfı hem
// başkasının isteğiyle aynı çalışma ortamını paylaşma riski var.)
//
// ÇÖZÜM. JSZip'in akışından (internalStream) parça parça oku, toplam tavanı
// geçtiği AN akışı durdur: harcanan iş ≈ tavan kadar. Başlıktaki "açılmış
// boyut" alanına GÜVENİLMEZ (yalan söyleyebilir); sayılan gerçek çıktıdır.
//
// TAVAN NEDEN 20 MB. Ölçüm (belgeMetni, Word benzeri XML): 20 MB XML →
// 2.372.894 karakter metin (XML/metin ≈ 8,4); 1 MB XML ≈ 119 bin karakter.
// Yani tavan yaklaşık iki buçuk milyon karakterlik (binlerce sayfa) bir
// belgeye yeter; gerçek bir dilekçe/sözleşme bunun çok altındadır. Bunun üstü
// kötü niyet ya da bozuk dosyadır.
// ---------------------------------------------------------------------------

/** Tek bir ZIP girdisinin AÇILMIŞ boyutu için tavan (bayt). */
export const ZIP_ACILMIS_TAVAN = 20_000_000;

/**
 * JSZip `StreamHelper` yüzeyinin kullandığımız kısmı (testte sahtesi yazılır).
 * `on('data', (parça: Uint8Array, meta) => …)`, `on('error', (e) => …)`,
 * `on('end', () => …)`.
 */
export interface AkisBenzeri {
  on(olay: 'data' | 'error' | 'end' | string, fn: (...a: unknown[]) => void): unknown;
  pause(): unknown;
  resume(): unknown;
}

/**
 * Akışı toplayıp birleştirir; toplam `tavan` bayttan fazlaysa akışı durdurur
 * ve `Error('zip_too_large')` ile reddeder.
 */
export function sinirliOku(akis: AkisBenzeri, tavan: number): Promise<Uint8Array> {
  return new Promise<Uint8Array>((coz, reddet) => {
    const parcalar: Uint8Array[] = [];
    let toplam = 0;
    let bitti = false;
    akis.on('data', (parca: unknown) => {
      if (bitti) return;
      const p = parca as Uint8Array;
      toplam += p.length;
      if (toplam > tavan) {
        bitti = true;
        akis.pause();
        reddet(new Error('zip_too_large'));
        return;
      }
      parcalar.push(p);
    });
    akis.on('error', (e: unknown) => {
      if (bitti) return;
      bitti = true;
      reddet(e instanceof Error ? e : new Error(String(e)));
    });
    akis.on('end', () => {
      if (bitti) return;
      bitti = true;
      const tum = new Uint8Array(toplam);
      let konum = 0;
      for (const p of parcalar) {
        tum.set(p, konum);
        konum += p.length;
      }
      coz(tum);
    });
    akis.resume();
  });
}
