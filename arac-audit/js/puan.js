// PUANLAMA VE ÖZET
//
// DÜRÜSTLÜK NOTU: buradaki ceza puanı (demerit) ağırlıkları ve karar eşikleri
// ÖRNEK BAŞLANGIÇ DEĞERLERİDİR — hiçbir üreticinin resmî audit standardından
// ölçülmemiştir. `ayarlar.esikler` ile değiştirilebilir. Kendi standardınızın
// sayılarını girene kadar bu puanı yalnızca kendi denetimlerinizi birbiriyle
// kıyaslamak için kullanın; mutlak bir kalite ölçütü gibi raporlamayın.

import { SIDDETLER, PARCA_INDEKS, HATA_TIPI_INDEKS } from './katalog.js';

export const SIDDET_INDEKS = Object.fromEntries(SIDDETLER.map((s) => [s.id, s]));

/** Varsayılan karar eşikleri — ayarlardan değiştirilebilir. */
export const VARSAYILAN_ESIKLER = {
  kritikVarsaRed: true,   // tek bir A sınıfı hata bile aracı durdurur
  sartliPuan: 15,         // bu puanın üstü "şartlı kabul"
  redPuan: 40,            // bu puanın üstü "red"
};

/** Tek bir hatanın ceza puanı. */
export function hataPuani(hata) {
  const s = SIDDET_INDEKS[hata.siddet];
  return (s?.puan ?? 0) * (hata.adet ?? 1);
}

/** Hatanın makine okunur kodu — Excel'de pivot/filtre için sabit anahtar. */
export function hataKodu(hata) {
  return `${hata.parcaId}.${hata.hataTipiId}`;
}

/** Hatanın insan okunur tam adı: "Dış · Sol yan / Arka kapı / Gıcırtı" */
export function hataAdi(hata, dil = 'tr') {
  const p = PARCA_INDEKS[hata.parcaId];
  const h = HATA_TIPI_INDEKS[hata.hataTipiId];
  if (dil === 'en') {
    return `${p?.bolgeEn ?? '?'} / ${p?.en ?? hata.parcaId} / ${h?.en ?? hata.hataTipiId}`;
  }
  return `${p?.bolgeAd ?? '?'} / ${p?.ad ?? hata.parcaId} / ${h?.ad ?? hata.hataTipiId}`;
}

/**
 * Denetimin tam özeti.
 * @param {{hatalar:any[]}} denetim
 * @param {object} [esikler]
 */
export function denetimOzeti(denetim, esikler = VARSAYILAN_ESIKLER) {
  const hatalar = denetim?.hatalar ?? [];

  const siddetDagilimi = Object.fromEntries(SIDDETLER.map((s) => [s.id, { adet: 0, puan: 0 }]));
  const bolgeler = new Map();
  const parcalar = new Map();
  const gruplar = new Map();

  let toplamAdet = 0, toplamPuan = 0, fotografli = 0;

  for (const h of hatalar) {
    const adet = h.adet ?? 1;
    const puan = hataPuani(h);
    toplamAdet += adet;
    toplamPuan += puan;
    if ((h.fotograflar?.length ?? 0) > 0) fotografli += 1;

    if (siddetDagilimi[h.siddet]) {
      siddetDagilimi[h.siddet].adet += adet;
      siddetDagilimi[h.siddet].puan += puan;
    }

    const p = PARCA_INDEKS[h.parcaId];
    const bKey = p?.bolgeId ?? 'bilinmeyen';
    const b = bolgeler.get(bKey) ?? { id: bKey, ad: p?.bolgeAd ?? 'Bilinmeyen', adet: 0, puan: 0 };
    b.adet += adet; b.puan += puan; bolgeler.set(bKey, b);

    const pKey = h.parcaId;
    const pk = parcalar.get(pKey) ?? { id: pKey, ad: p?.ad ?? pKey, bolgeAd: p?.bolgeAd ?? '', adet: 0, puan: 0 };
    pk.adet += adet; pk.puan += puan; parcalar.set(pKey, pk);

    const grupId = HATA_TIPI_INDEKS[h.hataTipiId]?.grup ?? 'bilinmeyen';
    const gk = gruplar.get(grupId) ?? { id: grupId, adet: 0, puan: 0 };
    gk.adet += adet; gk.puan += puan; gruplar.set(grupId, gk);
  }

  const sirala = (m) => [...m.values()].sort((a, b) => b.puan - a.puan || b.adet - a.adet);

  return {
    toplamHata: hatalar.length,
    toplamAdet,
    toplamPuan,
    fotografliHata: fotografli,
    fotografsizHata: hatalar.length - fotografli,
    siddetDagilimi,
    bolgeDagilimi: sirala(bolgeler),
    parcaDagilimi: sirala(parcalar),
    grupDagilimi: sirala(gruplar),
    sonuc: sonucBelirle({ toplamPuan, siddetDagilimi }, esikler),
  };
}

/**
 * Karar: KABUL / ŞARTLI / RED.
 * Eşikler ayarlanabilir; varsayılanlar örnektir, standart değildir.
 */
export function sonucBelirle({ toplamPuan, siddetDagilimi }, esikler = VARSAYILAN_ESIKLER) {
  const kritik = siddetDagilimi?.A?.adet ?? 0;
  if (esikler.kritikVarsaRed && kritik > 0) {
    return { kod: 'RED', ad: 'RED', en: 'REJECT', gerekce: `${kritik} adet kritik (A) hata bulundu.` };
  }
  if (toplamPuan >= esikler.redPuan) {
    return { kod: 'RED', ad: 'RED', en: 'REJECT', gerekce: `Toplam ceza puanı ${toplamPuan}, red eşiği ${esikler.redPuan}.` };
  }
  if (toplamPuan >= esikler.sartliPuan) {
    return { kod: 'SARTLI', ad: 'ŞARTLI KABUL', en: 'CONDITIONAL', gerekce: `Toplam ceza puanı ${toplamPuan}, şartlı eşiği ${esikler.sartliPuan}.` };
  }
  return { kod: 'KABUL', ad: 'KABUL', en: 'ACCEPT', gerekce: `Toplam ceza puanı ${toplamPuan}, şartlı eşiğin (${esikler.sartliPuan}) altında.` };
}

/** Birden çok denetimin toplu özeti — vardiya/hat raporu için. */
export function topluOzet(denetimler, esikler = VARSAYILAN_ESIKLER) {
  const ozetler = denetimler.map((d) => ({ denetim: d, ozet: denetimOzeti(d, esikler) }));
  const aracSayisi = ozetler.length || 1;
  const toplamAdet = ozetler.reduce((t, o) => t + o.ozet.toplamAdet, 0);
  const toplamPuan = ozetler.reduce((t, o) => t + o.ozet.toplamPuan, 0);

  const parcaTop = new Map();
  for (const { ozet } of ozetler) {
    for (const p of ozet.parcaDagilimi) {
      const k = parcaTop.get(p.id) ?? { ...p, adet: 0, puan: 0, aracSayisi: 0 };
      k.adet += p.adet; k.puan += p.puan; k.aracSayisi += 1;
      parcaTop.set(p.id, k);
    }
  }

  return {
    aracSayisi: ozetler.length,
    toplamAdet,
    toplamPuan,
    // DPU = Defects Per Unit — araç başına düşen hata adedi
    dpu: Math.round((toplamAdet / aracSayisi) * 100) / 100,
    aracBasiPuan: Math.round((toplamPuan / aracSayisi) * 100) / 100,
    sonucDagilimi: ozetler.reduce((a, o) => {
      a[o.ozet.sonuc.kod] = (a[o.ozet.sonuc.kod] ?? 0) + 1; return a;
    }, {}),
    enSikParcalar: [...parcaTop.values()].sort((a, b) => b.adet - a.adet).slice(0, 20),
    ozetler,
  };
}
