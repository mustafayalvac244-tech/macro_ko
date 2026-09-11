// ÖLÇÜM KÜNYESİ — bir ölçümün HANGİ MODELE karşı yapıldığını kaydeder.
// ---------------------------------------------------------------------------
// BULUNAN KUSUR (ölçüm, 2026-09-11). Sekiz ölçüm betiğinin HİÇBİRİ sonucun
// hangi modelden geldiğini sonuç dosyasına yazmıyordu. Elimizdeki dosyalar:
//   eval-dilekce-hatalar.json  → { tarih, olculenSenaryolar, kusurlu: [] }
//   eval-mutalaa-hatalar.json  → { tarih, kusurlu: [5 kayıt] }
// Yani "dilekçede 0 kusur çıktı" cümlesinin NEYİN 0 kusur verdiği belli değil.
// Model, sağlayıcı ve fiyat katmanı ölçümün EN BELİRLEYİCİ değişkeniyken
// kayıtta yok; bu haliyle sonuçlar karşılaştırılamaz ve tekrar edilemez.
//
// Bu, ürünün "ücretsiz modelde mütalaa kanun uyduruyordu" gibi ölçümlerini de
// doğrulanamaz hâle getiriyordu: hangi ücretsiz model, hangi tarihte?
//
// Kullanım (her eval betiğinde):
//   const kunye = yeniKunye();
//   kunye.gor(cevap.kullanim);           // her istekten sonra
//   writeFileSync(yol, JSON.stringify(kunye.ozet({ kusurlu }), null, 2));
//   console.log(kunye.satir());

/** Yeni bir ölçüm künyesi başlatır. */
export function yeniKunye() {
  const modeller = new Map(); // model → { istek, girdi, cikti, maliyet }
  let baslangic = Date.now();

  return {
    /**
     * Bir isteğin kullanım bilgisini kaydeder.
     * @param k sunucudan dönen { model, girdiToken, ciktiToken, maliyetTL }
     */
    gor(k) {
      if (!k || typeof k !== 'object') return;
      const ad = k.model || '(bilinmiyor)';
      const m = modeller.get(ad) ?? { istek: 0, girdi: 0, cikti: 0, maliyet: 0 };
      m.istek += 1;
      m.girdi += Number(k.girdiToken) || 0;
      m.cikti += Number(k.ciktiToken) || 0;
      m.maliyet += Number(k.maliyetTL) || 0;
      modeller.set(ad, m);
    },

    /** Sonuç dosyasına yazılacak künye + verilen alanlar. */
    ozet(ek = {}) {
      return {
        tarih: new Date().toISOString(),
        sureSn: Math.round((Date.now() - baslangic) / 1000),
        // DİKKAT: birden çok model çıkarsa ölçüm KARIŞIKTIR; sonuç tek bir
        // modele atfedilemez. Dizi olarak bırakılıyor ki bu görünsün.
        modeller: [...modeller.entries()].map(([model, m]) => ({
          model,
          istek: m.istek,
          girdiToken: m.girdi,
          ciktiToken: m.cikti,
          maliyetTL: Math.round(m.maliyet * 100) / 100,
        })),
        karisikModel: modeller.size > 1,
        ...ek,
      };
    },

    /** Konsol özeti. */
    satir() {
      if (modeller.size === 0) return 'Model bilgisi gelmedi (sunucu kullanım döndürmedi).';
      const parcalar = [...modeller.entries()].map(
        ([model, m]) => `${model} ×${m.istek} (₺${(Math.round(m.maliyet * 100) / 100).toFixed(2)})`
      );
      const uyari = modeller.size > 1 ? '  ⚠ KARIŞIK MODEL — sonuç tek modele atfedilemez' : '';
      return `Ölçülen model: ${parcalar.join(' + ')}${uyari}`;
    },
  };
}
