// İSTATİSTİK — Pareto, tekrarlayan hata, sisteme göre DPU, haftalık eğilim,
// denetim süresi. Hepsi saf hesap; veri depo.ts'ten gelir, çizim
// app/istatistik.tsx'te.
//
// NEDEN (24.10.2026, benzer uygulamaların incelenmesi): son kontrol
// panolarında ortak olan üç şey — hata tiplerinin sıklığa göre sıralanması
// (Pareto), aynı hatanın birden çok araçta görülmesi (tekrarlayan hata) ve
// DPU'nun zamana göre eğilimi. Kaynaklar README'de ("Dünyadaki benzerler").
//
// KAPSAM: yalnız bu cihazın kayıtları (merkezi sunucu yok). "Düzeltilecek"
// = kabul edilebilir işaretlenmemiş hata; Pareto ve DPU onu sayar, çünkü iş
// emri doğuran odur. Hata adedi (kabul edilebilir dahil) ayrıca verilir.

import { donemBaslangiclari, dpu, Sayi, SayacGirdisi } from './sayac';
import { BolgeGrubu } from './tipler';

export interface HataKaydi {
  denetimId: string;
  aracId: string;
  parcaId: string;
  hataTipiId: string;
  derece: string;
  kabulEdilebilir: boolean;
  /** Hatanın değil DENETİMİN başlangıcı — dönem süzgeci denetime göre. */
  denetimBaslangici: string;
}

export interface ParetoSatiri {
  parcaId: string;
  hataTipiId: string;
  /** Düzeltilecek hata adedi. */
  adet: number;
  /** Kaç ayrı denetimde (araçta) görüldü. */
  aracSayisi: number;
  /** Toplam düzeltilecek içindeki payı, 0–1. */
  pay: number;
  /** Bu satıra kadar birikimli pay, 0–1 (Pareto eğrisi). */
  birikimli: number;
}

const duzeltilecekler = (kayitlar: readonly HataKaydi[]) => kayitlar.filter((k) => !k.kabulEdilebilir);

/**
 * Parça + hata tipi çiftleri, düzeltilecek adede göre çoktan aza. Eşitlikte
 * daha çok araçta görülen önce; o da eşitse kimlik sırası (deterministik).
 */
export function pareto(kayitlar: readonly HataKaydi[], enFazla = 10): ParetoSatiri[] {
  const m = new Map<string, { parcaId: string; hataTipiId: string; adet: number; araclar: Set<string> }>();
  for (const k of duzeltilecekler(kayitlar)) {
    const anahtar = `${k.parcaId}|${k.hataTipiId}`;
    let s = m.get(anahtar);
    if (!s) { s = { parcaId: k.parcaId, hataTipiId: k.hataTipiId, adet: 0, araclar: new Set() }; m.set(anahtar, s); }
    s.adet += 1;
    s.araclar.add(k.denetimId);
  }
  const toplam = [...m.values()].reduce((t, s) => t + s.adet, 0);
  const sirali = [...m.values()].sort((a, b) =>
    b.adet - a.adet || b.araclar.size - a.araclar.size || `${a.parcaId}|${a.hataTipiId}`.localeCompare(`${b.parcaId}|${b.hataTipiId}`));
  let birikimli = 0;
  return sirali.slice(0, enFazla).map((s) => {
    const pay = toplam ? s.adet / toplam : 0;
    birikimli += pay;
    return { parcaId: s.parcaId, hataTipiId: s.hataTipiId, adet: s.adet, aracSayisi: s.araclar.size, pay, birikimli: Math.min(1, birikimli) };
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

export interface SistemSatiri { sistem: BolgeGrubu; hata: number; duzeltilecek: number; dpu: number | null }

/** Sisteme göre hata ve DPU; `aracSayisi` dönemde denetlenen araç (hatasızlar dahil). */
export function sistemeGore(
  kayitlar: readonly HataKaydi[],
  parcaSistemi: (parcaId: string) => BolgeGrubu | null,
  aracSayisi: number,
  sira: readonly BolgeGrubu[],
): SistemSatiri[] {
  const m = new Map<BolgeGrubu, { hata: number; duzeltilecek: number }>();
  for (const k of kayitlar) {
    const s = parcaSistemi(k.parcaId);
    if (!s) continue;
    const x = m.get(s) ?? { hata: 0, duzeltilecek: 0 };
    x.hata += 1;
    if (!k.kabulEdilebilir) x.duzeltilecek += 1;
    m.set(s, x);
  }
  return sira
    .filter((s) => m.has(s))
    .map((sistem) => {
      const x = m.get(sistem)!;
      const sayi: Sayi = { arac: aracSayisi, hata: x.hata, duzeltilecek: x.duzeltilecek };
      return { sistem, hata: x.hata, duzeltilecek: x.duzeltilecek, dpu: dpu(sayi) };
    });
}

export interface HaftaSatiri { baslangic: Date; arac: number; duzeltilecek: number; dpu: number | null }

/**
 * Son N haftanın DPU'su, eskiden yeniye. Hafta pazartesi başlar (sayac.ts ile
 * aynı). İçinde bulunulan hafta son satırdır ve henüz bitmemiştir — ekran
 * bunu söylemeli.
 */
export function haftalikDpu(girdiler: readonly SayacGirdisi[], simdi: Date, haftaSayisi = 8): HaftaSatiri[] {
  const buHafta = donemBaslangiclari(simdi).buHafta;
  const haftalar: HaftaSatiri[] = [];
  for (let i = haftaSayisi - 1; i >= 0; i--) {
    const b = new Date(buHafta.getFullYear(), buHafta.getMonth(), buHafta.getDate() - 7 * i);
    haftalar.push({ baslangic: b, arac: 0, duzeltilecek: 0, dpu: null });
  }
  const ilk = haftalar[0]!.baslangic;
  for (const g of girdiler) {
    const an = new Date(g.baslangic);
    if (Number.isNaN(an.getTime()) || an < ilk || an > simdi) continue;
    // Haftanın indeksi: başlangıçtan bu yana geçen tam hafta sayısı. Yaz
    // saati geçişinde gün 23/25 saat olur; gün sayısı yuvarlanarak alınır.
    const gun = Math.round((new Date(an.getFullYear(), an.getMonth(), an.getDate()).getTime() - ilk.getTime()) / 86_400_000);
    const h = haftalar[Math.floor(gun / 7)];
    if (!h) continue;
    h.arac += 1;
    h.duzeltilecek += g.duzeltilecekAdedi;
  }
  for (const h of haftalar) h.dpu = dpu({ arac: h.arac, hata: 0, duzeltilecek: h.duzeltilecek });
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
