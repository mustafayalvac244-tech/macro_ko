// ÖZET — SAYAR, PUANLAMAZ.
//
// Burada bir zamanlar ceza puanı (demerit) ağırlıkları ve KABUL/ŞARTLI/RED
// eşikleri vardı. 16.09.2026'da ürün sahibi kaldırttı: "puan sistemini kaldır,
// bizde öyle bir şey yok." Ekibin gerçek denetim tablosunda da puan sütunu ya
// da karar damgası yok — sınıf (A/B/C…), parça, hata açıklaması ve sorumlu var.
//
// Uydurma bir puan üretip rapora yazmak, olmayan bir ölçütü varmış gibi
// gösterir; ekip onu kendi standardı sanır. O yüzden geri EKLENMEYECEK.
// Gereken tek şey adet: kaç hata, hangi sınıfta, hangi bölgede.

import { Dagilim, Denetim, Dil, Hata, Ozet, Derece } from './tipler';
import { DERECELER, PARCA_INDEKS, HATA_TIPI_INDEKS, HATA_GRUPLARI } from './katalog';

export const DERECE_INDEKS: Record<string, Derece> = Object.fromEntries(DERECELER.map((s) => [s.id, s]));

/**
 * Derecenin yazılı gösterimi: `3` ya da `(3)`.
 *
 * TEK KAYNAK. Parantezi her ekranda elle eklersek bir yerde unutulur ve kabul
 * edilmiş bir bulgu düzeltilecek hata gibi görünür.
 */
export function dereceGosterimi(h: Pick<Hata, 'derece' | 'kabulEdilebilir'>): string {
  return h.kabulEdilebilir ? `(${h.derece})` : h.derece;
}

/** Hatanın makine okunur kodu — Excel'de pivot/filtre için sabit anahtar. */
export function hataKodu(hata: Pick<Hata, 'parcaId' | 'hataTipiId'>): string {
  return `${hata.parcaId}.${hata.hataTipiId}`;
}

/** Hatanın insan okunur tam adı: "Dış · Sol yan / Arka kapı / Gıcırtı" */
export function hataAdi(hata: Pick<Hata, 'parcaId' | 'hataTipiId'>, dil: Dil = 'tr'): string {
  const p = PARCA_INDEKS[hata.parcaId];
  const h = HATA_TIPI_INDEKS[hata.hataTipiId];
  if (dil === 'en') {
    return `${p?.bolgeEn ?? '?'} / ${p?.en ?? hata.parcaId} / ${h?.en ?? hata.hataTipiId}`;
  }
  return `${p?.bolgeAd ?? '?'} / ${p?.ad ?? hata.parcaId} / ${h?.ad ?? hata.hataTipiId}`;
}

/** Denetimin özeti — yalnız adetler. */
export function denetimOzeti(denetim: { hatalar?: Hata[] } | null | undefined): Ozet {
  const hatalar = denetim?.hatalar ?? [];

  const dereceDagilimi = Object.fromEntries(
    DERECELER.map((s) => [s.id, { adet: 0 }]),
  ) as Ozet['dereceDagilimi'];
  const bolgeler = new Map<string, Dagilim>();
  const parcalar = new Map<string, Dagilim>();
  const gruplar = new Map<string, Dagilim>();

  let toplamAdet = 0, fotografli = 0;

  for (const h of hatalar) {
    const adet = h.adet ?? 1;
    toplamAdet += adet;
    if ((h.fotograflar?.length ?? 0) > 0) fotografli += 1;

    if (dereceDagilimi[h.derece]) dereceDagilimi[h.derece].adet += adet;

    const p = PARCA_INDEKS[h.parcaId];
    const bKey = p?.bolgeId ?? 'bilinmeyen';
    const b = bolgeler.get(bKey) ?? { id: bKey, ad: p?.bolgeAd ?? 'Bilinmeyen', adet: 0 };
    b.adet += adet; bolgeler.set(bKey, b);

    const pk = parcalar.get(h.parcaId)
      ?? { id: h.parcaId, ad: p?.ad ?? h.parcaId, bolgeAd: p?.bolgeAd ?? '', adet: 0 };
    pk.adet += adet; parcalar.set(h.parcaId, pk);

    const grupId = HATA_TIPI_INDEKS[h.hataTipiId]?.grup ?? 'bilinmeyen';
    const gk = gruplar.get(grupId) ?? { id: grupId, ad: HATA_GRUPLARI[grupId]?.ad ?? grupId, adet: 0 };
    gk.adet += adet; gruplar.set(grupId, gk);
  }

  const sirala = (m: Map<string, Dagilim>): Dagilim[] =>
    [...m.values()].sort((a, b) => b.adet - a.adet || a.ad.localeCompare(b.ad, 'tr'));

  return {
    toplamHata: hatalar.length,
    toplamAdet,
    fotografliHata: fotografli,
    fotografsizHata: hatalar.length - fotografli,
    dereceDagilimi,
    bolgeDagilimi: sirala(bolgeler),
    parcaDagilimi: sirala(parcalar),
    grupDagilimi: sirala(gruplar),
  };
}

/** Birden çok denetimin toplu özeti — vardiya/hat raporu için. */
export function topluOzet(denetimler: Denetim[]) {
  const ozetler = denetimler.map((d) => ({ denetim: d, ozet: denetimOzeti(d) }));
  const aracSayisi = ozetler.length || 1;
  const toplamAdet = ozetler.reduce((t, o) => t + o.ozet.toplamAdet, 0);

  const parcaTop = new Map<string, Dagilim>();
  for (const { ozet } of ozetler) {
    for (const p of ozet.parcaDagilimi) {
      const k = parcaTop.get(p.id) ?? { ...p, adet: 0, aracSayisi: 0 };
      k.adet += p.adet; k.aracSayisi = (k.aracSayisi ?? 0) + 1;
      parcaTop.set(p.id, k);
    }
  }

  return {
    aracSayisi: ozetler.length,
    toplamAdet,
    // DPU = Defects Per Unit — araç başına düşen hata adedi. Bu bir puan
    // değil, sayım: kaç araçta kaç hata bulundu.
    dpu: Math.round((toplamAdet / aracSayisi) * 100) / 100,
    enSikParcalar: [...parcaTop.values()].sort((a, b) => b.adet - a.adet).slice(0, 20),
    ozetler,
  };
}
