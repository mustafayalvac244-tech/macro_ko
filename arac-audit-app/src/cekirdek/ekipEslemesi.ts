// EKİBİN ETİKETLERİ ↔ UYGULAMANIN PARÇA VE HATA TİPLERİ (27.10.2026).
//
// Ürün sahibi: "excel formati atsam çıktı otomatik doldurur dimi". Ekibin
// dosyasında "Problem Part" / "Problem Type" kendi listelerinden (Part ve
// Problems sayfaları) seçiliyor; uygulamanın İngilizce adları o listelerde
// çoğunlukla YOK (ölçüldü, ekibin dosyası: parça adlarının 5/206'sı, tip
// adlarının 36/66'sı birebir var). Bu dosya her parça/tip için ekibin
// etiketlerinden birini seçer. Listeler DEPOYA YAZILMAZ (şirket verisi):
// eşleme telefonda, seçilen dosyanın içinden kurulur.
//
// Yöntem: her etiket uygulamanın aramasıyla (arama.ts — Hyundai kısaltmaları
// dahil) aranır; ilk sonuç o etiketin adayıdır. Etiketin kelimelerinin
// yarıdan fazlası parçanın KENDİ metninde (ad + eş anlamlılar, bölge adı
// hariç) geçmiyorsa aday sayılmaz (ölçüldü: "H LINING TO A PLR RH" bölgesinin
// adı "Headliner" olan sağ güneşliğe gidiyordu).
//
// Bir parçanın birden çok adayı varsa sıra: (1) adı birebir aynı, (2) daha az
// gevşetmeyle bulunmuş, (3) ekibin listesinde (listede olmayan çoğunlukla bir
// kez elle yazılmış: "SEAT", sürücü koltuğunda "SEAT -LH FRT"in önüne
// geçiyordu), (4) tarafı uyan (sağ/sol parçaya o tarafı söyleyen etiket;
// tarafsız parçaya taraf söylemeyen), (5) kelimeleri adda daha çok geçen,
// (6) ekibin dosyasında daha sık, (7) kısa. Aday yoksa çağıran uygulamanın
// kendi adını yazar ve raporda söyler.

import { adKapsamasi, esnekAra, sorguTarafi } from './arama';

export interface EkipEtiketi {
  /** Dosyadaki yazılışı, aynen (baştaki görünmez boşluk dahil) — yazarken bu kullanılır. */
  ad: string;
  /** Ekibin dosyasında kaç satırda kullanılmış. */
  sayi: number;
  /** Ekibin listesinde (Part / Problems sayfası) var mı. */
  listede: boolean;
}

/** Karşılaştırma anahtarı: görünmez boşluk, fazla boşluk, büyük/küçük harf farkı yok sayılır. */
export const etiketAnahtari = (s: string): string =>
  s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();

/**
 * Listedeki ve kayıtlardaki etiketleri birleştirir. Yazılış listedeki
 * (ekibin makrosu listeden seçip aynen yazıyor); listede yoksa kayıtlarda en
 * sık görülen yazılış.
 */
export function etiketleriTopla(liste: readonly string[], kayitlar: readonly string[]): EkipEtiketi[] {
  const m = new Map<string, { liste?: string; yazilis: Map<string, number>; sayi: number }>();
  const al = (v: string) => {
    const k = etiketAnahtari(v);
    if (!k) return null;
    let e = m.get(k);
    if (!e) { e = { yazilis: new Map(), sayi: 0 }; m.set(k, e); }
    return e;
  };
  for (const v of liste) { const e = al(v); if (e && e.liste === undefined) e.liste = v; }
  for (const v of kayitlar) {
    const e = al(v);
    if (!e) continue;
    e.sayi += 1;
    e.yazilis.set(v, (e.yazilis.get(v) ?? 0) + 1);
  }
  return [...m.values()].map((e) => ({
    ad: e.liste ?? [...e.yazilis].sort((a, b) => b[1] - a[1])[0]![0],
    sayi: e.sayi,
    listede: e.liste !== undefined,
  }));
}

export interface EslemeSecenekleri<T> {
  kimlik: (x: T) => string;
  /** Aranabilir metin (aramaMetni ile kurulmuş). */
  metin: (x: T) => string;
  /** Yalnız ad (aramaMetni ile kurulmuş) — adayları sıralamak için. */
  adMetni: (x: T) => string;
  /**
   * Öğenin kendi metni (ad + eş anlamlılar; bölge adı YOK) — eşik buna bakar.
   * Verilmezse `adMetni`.
   */
  kendiMetni?: (x: T) => string;
  /** Birebir aynı sayılacak adlar (ör. tipin İngilizcesi "Scratch" = "SCRATCH"). */
  tamAdlar?: (x: T) => readonly string[];
  taraf?: (x: T) => 'sol' | 'sag' | undefined;
  /** Aynı parçanın öbür taraftaki kimliği (sol_x ↔ sag_x). */
  ayna?: (kimlik: string) => string | undefined;
  /** "A AND B" / "A TO B" etiketlerini iki parçanın arası (çift) say. */
  ciftler?: boolean;
  /**
   * Yalnız bu öğelerin eşlemesi gerekiyorsa (doldurulan denetimlerdeki
   * parçalar): bunlara hiç benzemeyen etiketler baştan elenir — sonuç aynı,
   * iş az (ölçüldü: gerçek dosyada ~350 ms → bkz. README Aşama 8).
   */
  gerekli?: ReadonlySet<string>;
}

/** İki parçalı kaydın eşleme anahtarı — sırasız. */
export const ciftAnahtari = (a: string, b: string): string => (a < b ? `${a}+${b}` : `${b}+${a}`);

const CIFT_AYRACI = /\s+(?:TO|AND|&|\/|WITH)\s+/;

/** Puanlar soldan sağa önem sırasıyla; büyük olan iyi. */
function dahaIyi(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! > b[i]!;
  return false;
}

/**
 * Her öğeye (ve `ciftler` açıksa her öğe çiftine) ekibin etiketlerinden
 * birini seçer. Döner: kimlik (ya da `ciftAnahtari`) → etiket. Eşlemesi
 * olmayan öğe haritada YOKTUR — çağıran kendi adını yazar.
 */
export function etiketEslemesi<T>(
  etiketler: readonly EkipEtiketi[], ogeler: readonly T[], s: EslemeSecenekleri<T>,
): Map<string, EkipEtiketi> {
  const var_ = new Set(ogeler.map(s.kimlik));
  const tamIndeks = new Map<string, T[]>();
  for (const x of ogeler) {
    for (const ad of s.tamAdlar?.(x) ?? []) {
      const k = etiketAnahtari(ad);
      if (!k) continue;
      const l = tamIndeks.get(k) ?? [];
      if (!l.includes(x)) l.push(x);
      tamIndeks.set(k, l);
    }
  }

  const en = new Map<string, { e: EkipEtiketi; puan: number[] }>();
  const aday = (anahtar: string, e: EkipEtiketi, puan: number[]) => {
    const o = en.get(anahtar);
    if (!o || dahaIyi(puan, o.puan)) en.set(anahtar, { e, puan });
  };
  const aynasi = (id: string) => {
    const a = s.ayna?.(id);
    return a && var_.has(a) ? a : undefined;
  };

  // Etiketin tamamı bir taraf söylüyorsa ("FRT DR AND FENDER-LH") tarafsız
  // yarıya da eklenir. Ama yarı tarafsız bir parçayı da anlatıyor olabilir
  // ("H LINING TO A PLR RH": tavan döşemesi tarafsız; taraf eklenince sağ
  // güneşlik, bölgesinin adı "Headliner" olduğu için, bulunuyordu) — iki
  // deneme yapılır, adında daha çok kelimesi geçen seçilir. Taraf kelimesi
  // atlanan kademede (2) taraflı parça ASLA seçilmez.
  const ara = (q: string, sorgu: string, yalnizTarafsiz: boolean) => {
    const r = esnekAra(ogeler, s.metin, sorgu, s.adMetni, (x, k) => !(yalnizTarafsiz || k === 2) || !s.taraf?.(x));
    const x = r.sonuc[0];
    if (x === undefined) return null;
    if (adKapsamasi(q, (s.kendiMetni ?? s.adMetni)(x)) <= 0.5) return null;
    return { x, id: s.kimlik(x), kademe: r.kademe, kapsama: adKapsamasi(q, s.adMetni(x)) };
  };
  const bul = (q: string, taraf: 'sol' | 'sag' | undefined) => {
    if (!taraf || sorguTarafi(q)) return ara(q, q, false);
    const tarafli = ara(q, `${q} ${taraf === 'sol' ? 'LH' : 'RH'}`, false);
    const tarafsiz = ara(q, q, true);
    if (!tarafsiz) return tarafli;
    if (!tarafli) return tarafsiz;
    return tarafsiz.kapsama > tarafli.kapsama || tarafsiz.kademe < tarafli.kademe ? tarafsiz : tarafli;
  };
  /** 1: etiket parçanın tarafını söylüyor; 0: ikisi de tarafsız ya da etiket tarafsız; -1: tarafsız parçaya taraf. */
  const tarafPuani = (etiket: 'sol' | 'sag' | undefined, oge: 'sol' | 'sag' | undefined) =>
    etiket ? (oge ? 1 : -1) : 0;

  // Ön eleme: etiketin ilk sonucu gerekli bir öğe (ya da aynası) olabilmesi
  // için, o öğenin metniyle herhangi bir gevşetmede eşleşmesi şart.
  const gerekliOgeler = s.gerekli && ogeler.filter((x) => {
    const id = s.kimlik(x);
    const a = s.ayna?.(id);
    return s.gerekli!.has(id) || (a !== undefined && s.gerekli!.has(a));
  });
  const ilgili = (yarilar: readonly string[]) =>
    !gerekliOgeler || yarilar.some((y) => esnekAra(gerekliOgeler, s.metin, y).sonuc.length > 0);

  for (const e of etiketler) {
    const k = etiketAnahtari(e.ad);
    if (!k) continue;
    const taraf = sorguTarafi(k);
    const liste = e.listede ? 1 : 0;
    const son = [e.sayi, -k.length];

    const tam = tamIndeks.get(k);
    if (tam) {
      for (const x of tam) aday(s.kimlik(x), e, [1, 0, liste, 1, 1, ...son]);
      continue;
    }

    const yarilar = s.ciftler ? k.split(CIFT_AYRACI) : [k];
    if (yarilar.length > 2 || !ilgili(yarilar)) continue;
    if (yarilar.length === 2) {
      const a = bul(yarilar[0]!, taraf);
      const b = bul(yarilar[1]!, taraf);
      if (!a || !b || a.id === b.id) continue;
      const tarafli = !!(s.taraf?.(a.x) || s.taraf?.(b.x));
      const puan = [0, -Math.max(a.kademe, b.kademe), liste, tarafPuani(taraf, tarafli ? taraf : undefined), (a.kapsama + b.kapsama) / 2, ...son];
      aday(ciftAnahtari(a.id, b.id), e, puan);
      if (!taraf && tarafli) aday(ciftAnahtari(aynasi(a.id) ?? a.id, aynasi(b.id) ?? b.id), e, puan);
      continue;
    }

    const r = bul(k, undefined);
    if (!r) continue;
    const xTaraf = s.taraf?.(r.x);
    if (taraf && xTaraf && taraf !== xTaraf) continue;
    const puan = [0, -r.kademe, liste, tarafPuani(taraf, xTaraf), r.kapsama, ...son];
    aday(r.id, e, puan);
    if (!taraf && xTaraf) { const m = aynasi(r.id); if (m) aday(m, e, puan); }
  }

  return new Map([...en].map(([k, v]) => [k, v.e]));
}
