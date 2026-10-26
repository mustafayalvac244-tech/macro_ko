// İSTATİSTİK — Pareto, tekrarlayan hata, sisteme göre skor, haftalık eğilim,
// denetim süresi. Hepsi saf hesap; veri depo.ts'ten gelir, çizim
// app/(sekmeler)/istatistik.tsx'te.
//
// NEDEN (24.10.2026, benzer uygulamaların incelenmesi): son kontrol
// panolarında ortak olan üç şey — hata tiplerinin sıklığa göre sıralanması
// (Pareto), aynı hatanın birden çok araçta görülmesi (tekrarlayan hata) ve
// skorun zamana göre eğilimi. Kaynaklar README'de ("Dünyadaki benzerler").
//
// 26.10.2026: ölçü DPU'dan ekibin Excel'indeki Audit Skoru'na geçti
// (sayac.ts başındaki not). Pareto artık BÜTÜN problemleri sayar: Excel'de
// her satır bir problemdir, demerit'i 0 olanlar da (Excel'de çoğunluk onlar).
// Sistem, Excel'in SYSTEM alanı (nas.ts).
//
// KAPSAM: yalnız bu cihazın kayıtları (merkezi sunucu yok). Kaynak süzgeci
// (yalnız AUDIT) ekranda uygulanır.

import { auditSkoru, NAS_SISTEMLERI, skoraGirerMi } from './nas';
import { donemBaslangiclari, SayacGirdisi } from './sayac';

export interface HataKaydi {
  denetimId: string;
  aracId: string;
  parcaId: string;
  hataTipiId: string;
  /** Kaydın adedi ("x2"); eski kayıtlarda 1. */
  adet: number;
  /** Tek bir oluşun DEMERIT'i (nas.ts → demeritDegeri). */
  demerit: number;
  /** Excel SYSTEM; kayıtta yoksa parçadan türetilmiş olarak gelir. */
  sistem: string;
  /** Denetimin PROBLEM SOURCE'u. */
  kaynak: string;
  /** Denetimin durumu ('devam' | 'tamam'); skora giren süzgeç için (sayac.ts → skoraGirenDenetim). */
  durum?: string;
  /** Hatanın değil DENETİMİN başlangıcı — dönem süzgeci denetime göre. */
  denetimBaslangici: string;
}

export interface ParetoSatiri {
  parcaId: string;
  hataTipiId: string;
  /** Problem adedi. */
  adet: number;
  /** Σ demerit × adet. */
  demerit: number;
  /** Kaç ayrı denetimde (araçta) görüldü. */
  aracSayisi: number;
  /** Toplam problem içindeki payı, 0–1. */
  pay: number;
  /** Bu satıra kadar birikimli pay, 0–1 (Pareto eğrisi). */
  birikimli: number;
}

/**
 * Parça + hata tipi çiftleri, problem adedine göre çoktan aza. Eşitlikte
 * daha çok demerit, sonra daha çok araç; o da eşitse kimlik sırası
 * (deterministik).
 */
export function pareto(kayitlar: readonly HataKaydi[], enFazla = 10): ParetoSatiri[] {
  const m = new Map<string, { parcaId: string; hataTipiId: string; adet: number; demerit: number; araclar: Set<string> }>();
  for (const k of kayitlar) {
    const anahtar = `${k.parcaId}|${k.hataTipiId}`;
    let s = m.get(anahtar);
    if (!s) { s = { parcaId: k.parcaId, hataTipiId: k.hataTipiId, adet: 0, demerit: 0, araclar: new Set() }; m.set(anahtar, s); }
    s.adet += k.adet;
    s.demerit += k.demerit * k.adet;
    s.araclar.add(k.denetimId);
  }
  const toplam = [...m.values()].reduce((t, s) => t + s.adet, 0);
  const sirali = [...m.values()].sort((a, b) =>
    b.adet - a.adet || b.demerit - a.demerit || b.araclar.size - a.araclar.size
    || `${a.parcaId}|${a.hataTipiId}`.localeCompare(`${b.parcaId}|${b.hataTipiId}`));
  let birikimli = 0;
  return sirali.slice(0, enFazla).map((s) => {
    const pay = toplam ? s.adet / toplam : 0;
    birikimli += pay;
    return {
      parcaId: s.parcaId, hataTipiId: s.hataTipiId, adet: s.adet, demerit: s.demerit,
      aracSayisi: s.araclar.size, pay, birikimli: Math.min(1, birikimli),
    };
  });
}

/**
 * Tekrarlayan hata: aynı parça + tip en az `enAz` ayrı araçta. Önce en çok
 * araçta görülen. Tek araçta üç kez görülen hata tekrarlayan DEĞİLDİR —
 * o aracın sorunudur, sürecin değil.
 */
export function tekrarlayanlar(kayitlar: readonly HataKaydi[], enAz = 2, enFazla = 10): ParetoSatiri[] {
  return pareto(kayitlar, Number.MAX_SAFE_INTEGER)
    .filter((s) => s.aracSayisi >= enAz)
    .sort((a, b) => b.aracSayisi - a.aracSayisi || b.adet - a.adet)
    .slice(0, enFazla);
}

export interface SistemSatiri { sistem: string; hata: number; demerit: number; skor: number | null }

/**
 * Excel SYSTEM'e göre problem, demerit ve skor; `aracSayisi` dönemde
 * denetlenen araç (hatasızlar dahil). Sıra Excel'in listesi; listede olmayan
 * bir sistem (eski ya da elle yazılmış) sona eklenir, düşmez.
 */
export function sistemeGore(
  kayitlar: readonly HataKaydi[],
  aracSayisi: number,
  sira: readonly string[] = NAS_SISTEMLERI,
): SistemSatiri[] {
  const m = new Map<string, { hata: number; demerit: number }>();
  for (const k of kayitlar) {
    const x = m.get(k.sistem) ?? { hata: 0, demerit: 0 };
    x.hata += k.adet;
    x.demerit += k.demerit * k.adet;
    m.set(k.sistem, x);
  }
  const kimlikler = [...sira.filter((s) => m.has(s)), ...[...m.keys()].filter((s) => !sira.includes(s))];
  return kimlikler.map((sistem) => {
    const x = m.get(sistem)!;
    return { sistem, hata: x.hata, demerit: x.demerit, skor: auditSkoru(x.demerit, aracSayisi) };
  });
}

export interface HaftaSatiri { baslangic: Date; arac: number; demerit: number; skor: number | null }

/**
 * Son N haftanın Audit Skoru, eskiden yeniye; yalnız AUDIT kaynağı (sayaçla
 * aynı). Hafta pazartesi başlar. İçinde bulunulan hafta son satırdır ve henüz
 * bitmemiştir — ekran bunu söylemeli.
 */
export function haftalikSkor(girdiler: readonly SayacGirdisi[], simdi: Date, haftaSayisi = 8): HaftaSatiri[] {
  const buHafta = donemBaslangiclari(simdi).buHafta;
  const haftalar: HaftaSatiri[] = [];
  for (let i = haftaSayisi - 1; i >= 0; i--) {
    const b = new Date(buHafta.getFullYear(), buHafta.getMonth(), buHafta.getDate() - 7 * i);
    haftalar.push({ baslangic: b, arac: 0, demerit: 0, skor: null });
  }
  const ilk = haftalar[0]!.baslangic;
  for (const g of girdiler) {
    if (!skoraGirerMi(g.kaynak)) continue;
    const an = new Date(g.baslangic);
    if (Number.isNaN(an.getTime()) || an < ilk || an > simdi) continue;
    // Haftanın indeksi: başlangıçtan bu yana geçen tam hafta sayısı. Yaz
    // saati geçişinde gün 23/25 saat olur; gün sayısı yuvarlanarak alınır.
    const gun = Math.round((new Date(an.getFullYear(), an.getMonth(), an.getDate()).getTime() - ilk.getTime()) / 86_400_000);
    const h = haftalar[Math.floor(gun / 7)];
    if (!h) continue;
    h.arac += 1;
    h.demerit += g.demerit;
  }
  for (const h of haftalar) h.skor = auditSkoru(h.demerit, h.arac);
  return haftalar;
}

/** Denetim süresi, tam dakika. Bitmemiş, bozuk ya da geri giden zamanda null. */
export function sureDakika(baslangic: string, bitis: string | null | undefined): number | null {
  if (!bitis) return null;
  const b = new Date(baslangic).getTime();
  const s = new Date(bitis).getTime();
  if (Number.isNaN(b) || Number.isNaN(s) || s < b) return null;
  return Math.floor((s - b) / 60_000);
}

/** "12 dk", "1 sa 05 dk", "< 1 dk"; İngilizce "12 min", "1 h 05 min". */
export function sureMetni(dakika: number | null, dil: 'tr' | 'en' = 'tr'): string {
  if (dakika === null) return '';
  if (dakika < 1) return dil === 'en' ? '< 1 min' : '< 1 dk';
  const sa = Math.floor(dakika / 60);
  const dk = dakika % 60;
  if (!sa) return dil === 'en' ? `${dk} min` : `${dk} dk`;
  const dkMetin = String(dk).padStart(2, '0');
  return dil === 'en' ? `${sa} h ${dkMetin} min` : `${sa} sa ${dkMetin} dk`;
}
