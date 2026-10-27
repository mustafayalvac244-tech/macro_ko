// SIK HATALAR (27.10.2026) — ürün sahibi: "Programı daha kullanışlı hızlı hata
// ekleyebilir hale nasıl getiririz".
//
// Bugün bir hata en az 3 dokunuş + demerit (sistem → bölge → parça → demerit →
// tip; ölçüldü: 5/5/3+yazma/3 dokunuş). Aynı modelde aynı parça + tip ikilisi
// tekrar tekrar çıkıyor; bu telefonun KENDİ geçmişinden en sık ikililer denetim
// ekranının başında çip olur: çipe dokun → demerit seç → kaydedildi (2 dokunuş).
//
// Kaynak yalnız bu telefonun kayıtları: uydurulmuş "sık hata" listesi yok. En az
// iki kez görülmemiş ikili "sık" sayılmaz; yeni telefonda şerit boş kalır ve
// hiç gösterilmez.

export interface GecmisKayit {
  parcaId: string;
  ikinciParcaId?: string | null;
  hataTipiId: string;
  /** ISO 8601 — eşit sayıda yeni olan önce. */
  zaman: string;
}

export interface SikHata {
  parcaId: string;
  ikinciParcaId?: string;
  hataTipiId: string;
  sayi: number;
}

interface Secenekler {
  enFazla?: number;
  /** Bu kadardan az görülen ikili "sık" değildir. */
  enAz?: number;
  /** Bu araçta seçilemeyen parça, kaldırılmış tip… dışarıda kalır. */
  gecerli?: (o: SikHata) => boolean;
}

/** Parça + (varsa) ikinci parça + tip; ikinci parça sırasız (A↔B = B↔A). */
function sirala(kayitlar: readonly GecmisKayit[], anahtar: (k: GecmisKayit) => string | null) {
  const m = new Map<string, { o: SikHata; son: string }>();
  for (const k of kayitlar) {
    const a = anahtar(k);
    if (a === null) continue;
    const v = m.get(a);
    if (v) {
      v.o.sayi += 1;
      if (k.zaman > v.son) v.son = k.zaman;
    } else {
      const ikinci = k.ikinciParcaId || undefined;
      m.set(a, { o: { parcaId: k.parcaId, ...(ikinci ? { ikinciParcaId: ikinci } : {}), hataTipiId: k.hataTipiId, sayi: 1 }, son: k.zaman });
    }
  }
  return [...m.values()].sort((a, b) => b.o.sayi - a.o.sayi || b.son.localeCompare(a.son)).map((v) => v.o);
}

const ciftli = (k: Pick<GecmisKayit, 'parcaId' | 'ikinciParcaId'>) => {
  const b = k.ikinciParcaId || '';
  return b && b < k.parcaId ? `${b}+${k.parcaId}` : `${k.parcaId}+${b}`;
};

/** Denetim ekranının başındaki çipler: en sık parça + tip ikilileri. */
export function sikHataOnerileri(kayitlar: readonly GecmisKayit[], { enFazla = 8, enAz = 2, gecerli }: Secenekler = {}): SikHata[] {
  return sirala(kayitlar, (k) => `${ciftli(k)}|${k.hataTipiId}`)
    .filter((o) => o.sayi >= enAz && (!gecerli || gecerli(o)))
    .slice(0, enFazla);
}

/** Açık parçanın (ve varsa ikinci parçasının) en sık tipleri — hata ızgarasının başında. */
export function parcaninSikTipleri(
  kayitlar: readonly GecmisKayit[], parcaId: string, ikinciParcaId: string | null | undefined,
  { enFazla = 4, enAz = 2, gecerli }: Secenekler = {},
): SikHata[] {
  const hedef = ciftli({ parcaId, ikinciParcaId });
  return sirala(kayitlar, (k) => (ciftli(k) === hedef ? k.hataTipiId : null))
    .filter((o) => o.sayi >= enAz && (!gecerli || gecerli(o)))
    .slice(0, enFazla);
}
