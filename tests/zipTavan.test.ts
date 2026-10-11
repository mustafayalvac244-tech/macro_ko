import { describe, expect, it } from 'vitest';
import { ZIP_ACILMIS_TAVAN, sinirliOku, type AkisBenzeri } from '../supabase/functions/_shared/zipTavan';

/**
 * SIKIŞTIRMA BOMBASI (10.10.2026, 50 denetçi → ajan 26).
 *
 * doc-extract DOCX/UDF'i JSZip ile açıyordu: `zip.files[ad].async('string')`
 * girdiyi TAMAMEN açar. 8 MB'lık (base64 11 MB) bir ZIP, deflate'in en kötü
 * oranıyla (≈1000:1) gigabaytlarca XML'e açılıp işlevin belleğini bitirir;
 * kullanıcı tavanı yalnız SIKIŞMIŞ boyutu sınırlıyordu.
 *
 * Çözüm: JSZip'in akışından parça parça oku, toplam tavanı geçtiği AN dur.
 * Bu test akışı taklit eder (JSZip bu depoda bağımlılık değil); gerçek JSZip
 * ile doğrulama commit mesajında.
 */
type Dinleyici = (...a: unknown[]) => void;

/**
 * Parçaları resume() sonrası sırayla (tembel üreterek) yayan, pause() edilince
 * duran sahte akış. Parçalar yayılırken üretilir: 1 GB'lık bombayı önceden
 * bellekte kurmak testi kendi bombasına çevirirdi.
 */
function sahteAkis(adet: number, uret: (i: number) => Uint8Array, hataAt = false) {
  const dinleyiciler: Record<string, Dinleyici[]> = {};
  const durum = { yayilan: 0, durdu: false };
  const akis: AkisBenzeri = {
    on(olay, fn) {
      (dinleyiciler[olay] ??= []).push(fn as Dinleyici);
      return akis;
    },
    pause() {
      durum.durdu = true;
      return akis;
    },
    resume() {
      for (let i = 0; i < adet; i++) {
        if (durum.durdu) return akis;
        durum.yayilan += 1;
        const p = uret(i);
        dinleyiciler.data?.forEach((f) => f(p, {}));
      }
      if (durum.durdu) return akis;
      if (hataAt) dinleyiciler.error?.forEach((f) => f(new Error('bozuk_zip')));
      else dinleyiciler.end?.forEach((f) => f());
      return akis;
    },
  };
  return { akis, durum };
}

const parca = (n: number, deger = 65) => new Uint8Array(n).fill(deger);

describe('sinirliOku', () => {
  it('tavanın altındaki akışı olduğu gibi birleştirir', async () => {
    const { akis } = sahteAkis(2, (i) => (i === 0 ? parca(3, 65) : parca(2, 66)));
    const s = await sinirliOku(akis, 10);
    expect(Array.from(s)).toEqual([65, 65, 65, 66, 66]);
  });

  it('tam tavan boyutu kabul edilir, bir bayt fazlası reddedilir', async () => {
    const tam = sahteAkis(1, () => parca(10));
    expect((await sinirliOku(tam.akis, 10)).length).toBe(10);
    const fazla = sahteAkis(1, () => parca(11));
    await expect(sinirliOku(fazla.akis, 10)).rejects.toThrow('zip_too_large');
  });

  it('tavan aşılınca akışı DURDURUR: kalan parçalar açılmaz (bomba)', async () => {
    // 1000 parça × 1 MB = 1 GB "açılmış" veri; tavan 20 MB.
    const { akis, durum } = sahteAkis(1000, () => parca(1_000_000));
    await expect(sinirliOku(akis, ZIP_ACILMIS_TAVAN)).rejects.toThrow('zip_too_large');
    expect(durum.durdu).toBe(true);
    // 20 parçaya kadar kabul, 21.'de durur — 1000'in tamamı yayılmaz.
    expect(durum.yayilan).toBe(21);
  });

  it('akış hatasını (bozuk ZIP) olduğu gibi iletir', async () => {
    const { akis } = sahteAkis(1, () => parca(2), true);
    await expect(sinirliOku(akis, 10)).rejects.toThrow('bozuk_zip');
  });

  it('tavan, gerçekçi belgeler için bol: ölçülen 20 MB XML ≈ 2,4 milyon karakter', () => {
    // Ölçüm (belgeMetni, Word benzeri XML): 20 MB XML → 2.372.894 karakter
    // metin (XML/metin ≈ 8,4); 1 MB XML ≈ 119 bin karakter.
    expect(ZIP_ACILMIS_TAVAN).toBe(20_000_000);
  });
});
