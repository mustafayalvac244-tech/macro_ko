// Çevrimdışı MEVZUAT araması — İçtihat aramasının yanında kanun maddesi
// sonuçları getirir (rakibin "Mevzuat" kolonunun karşılığı, ama tamamen
// cihazda/anlık, ağ gerektirmez). Kaynak: uygulamaya gömülü temel kanunlar
// (LAW_INDEX).

import { LAW_INDEX, ensureLaw, lawReady, loadLaw, type LawArticle } from './loader';
import { mulgaMi } from './mulga';
import { aramaKatla } from '../../utils/arama';

export interface MevzuatHit {
  kod: string;
  kanun: string;
  slug: string;
  no: string;
  title?: string;
  text: string;
  snippet: string;
  score: number;
  /** Madde yürürlükten kalkmış mı (bkz. mulga.ts) — arayüz rozet gösterir. */
  mulga: boolean;
}

/**
 * Türkçe sadeleştirme — UZUNLUK KORUNUR (snippet indeksleri metinle hizalı kalır).
 * İ/I/ı → i, ş/ç/ğ/ö/ü → ASCII, şapkalı harfler → düz (hâkim = hakim).
 * Ayrıntı ve gerekçe: utils/arama.ts → aramaKatla.
 */
function fold(s: string): string {
  return aramaKatla(s);
}

const STOP = new Set(['ve', 'ile', 'veya', 'bir', 'bu', 'için', 'icin', 'olan', 'the']);

interface FlatArticle {
  kod: string;
  kanun: string;
  slug: string;
  art: LawArticle;
  hay: string; // fold(text)
}

/** TAM indeks: yalnız bütün kanunlar hazırken kurulur ve kalıcıdır. */
let FLAT: FlatArticle[] | null = null;
/**
 * EKSİK indeks (web'de bazı kanunlar henüz inmemişken): yalnız aynı hazır
 * kanun kümesi için tekrar kullanılır; küme büyüyünce yeniden kurulur.
 * Asla FLAT'e yazılmaz — yoksa eksik indeks kalıcılaşır (aşağıya bakın).
 */
let KISMI: { anahtar: string; out: FlatArticle[] } | null = null;
let warming: Promise<boolean> | null = null;

/** Tek bir kanunu düzleştirip indekse ekler. */
function addLaw(out: FlatArticle[], slug: string): void {
  const law = loadLaw(slug);
  if (!law) return;
  for (const art of law.articles) {
    out.push({ kod: law.short, kanun: law.name, slug, art, hay: fold(art.text) });
  }
}

/**
 * ARKA PLANDA indeks kurulumu — arayüzü dondurmadan.
 *
 * Neden: indeks kanunların tüm maddelerini (MB'larca metin) JSON'dan çözüp
 * her birine Türkçe sadeleştirme uyguluyor. Bu iş tek seferde yapılınca
 * masaüstünde bile yüzlerce ms sürüyor; telefonda (Hermes) saniyelik DONMA
 * demek. Kullanıcı arama kutusuna yazarken uygulama kilitleniyordu.
 *
 * Çözüm: her kanundan önce olay döngüsüne dönülür (setTimeout 0). Böylece iş
 * kanun sayısı kadar parçaya bölünür, hiçbir kare bloklanmaz.
 *
 * DÖNÜŞ: indeks TAM kurulduysa true. Web'de bir kanun inemezse (ağ hatası) o
 * kanun atlanır, kalan kanunlarda arama çalışır ve sonuç false olur; indeks
 * KALICI SAKLANMAZ, bir sonraki çağrıda inemeyen kanunlar yeniden denenir.
 * (Eskiden eksik indeks `FLAT`e yazılıyordu: bir kez ağ kesilince kullanıcı o
 * kanunları uygulama kapanana kadar HİÇ bulamıyordu ve hata da görünmüyordu.)
 */
export async function warmMevzuatIndex(): Promise<boolean> {
  if (FLAT) return true;
  if (warming) return warming;
  warming = (async () => {
    const out: FlatArticle[] = [];
    let tam = true;
    for (const idx of LAW_INDEX) {
      // Kareyi serbest bırak: sonraki kanun bir sonraki tik'te işlenir.
      await new Promise<void>((r) => setTimeout(r, 0));
      // Web'de kanun metni ağdan gelir (bkz. loader.web.ts); natifte bu
      // çağrı hiçbir şey yapmaz.
      try {
        await ensureLaw(idx.slug);
      } catch {
        // ağ hatası: bu kanun bu seferlik aranamaz
      }
      if (!lawReady(idx.slug)) {
        tam = false;
        continue;
      }
      addLaw(out, idx.slug);
    }
    if (tam) FLAT = out;
    return tam;
  })();
  try {
    return await warming;
  } finally {
    warming = null;
  }
}

/**
 * İndeksi döndürür.
 *
 * Arka plan kurulumu bitmediyse SENKRON kurmayı dener — ama yalnız metni
 * ZATEN hazır olan kanunlarla. Natifte hepsi pakette olduğu için bu, tam
 * indekstir. Web'de indirilmemiş kanunlar dışarıda kalır; bu durumda sonuç
 * EKSİK olduğu için FLAT'e YAZILMAZ (KISMI'de tutulur).
 */
function flat(): FlatArticle[] {
  if (FLAT) return FLAT;
  const hazirlar = LAW_INDEX.filter((idx) => lawReady(idx.slug));
  const tam = hazirlar.length === LAW_INDEX.length;
  const anahtar = hazirlar.map((idx) => idx.slug).join('|');
  if (!tam && KISMI && KISMI.anahtar === anahtar) return KISMI.out;
  const out: FlatArticle[] = [];
  for (const idx of hazirlar) addLaw(out, idx.slug);
  if (tam) {
    FLAT = out;
    KISMI = null;
  } else {
    KISMI = { anahtar, out };
  }
  return out;
}

/** İndeks tam mı? Arayüz "mevzuat hazırlanıyor" diyebilsin diye. */
export function mevzuatIndeksiHazir(): boolean {
  return FLAT !== null;
}

function snippetAround(text: string, foldedText: string, foldedWord: string): string {
  const i = foldedText.indexOf(foldedWord);
  if (i < 0) return text.slice(0, 160).trim();
  const start = Math.max(0, i - 60);
  const end = Math.min(text.length, i + foldedWord.length + 110);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}

/** Künye kısaltmaları: LAW_INDEX'ten türetilir, elle liste TUTULMAZ. */
let KISALTMA: { harita: Map<string, string>; desen: RegExp } | null = null;
function kisaltmalar(): { harita: Map<string, string>; desen: RegExp } {
  if (KISALTMA) return KISALTMA;
  const harita = new Map<string, string>();
  for (const e of LAW_INDEX) harita.set(fold(e.short).replace(/\s+/g, ''), e.short);
  // Önce uzun kısaltmalar: "iyuk" "iik"ten, "tkhk" "tk"den önce denenmeli.
  const anahtarlar = [...harita.keys()].sort((a, b) => b.length - a.length);
  const desen = new RegExp(`(?:^|[^a-z0-9])(${anahtarlar.join('|')})(?![a-z0-9])`);
  KISALTMA = { harita, desen };
  return KISALTMA;
}

export interface Kunye {
  kod?: string;
  no?: string;
  /** Harfli alt madde ("217/A" → "a"), katlanmış. */
  harf?: string;
}

/**
 * "TCK 125" / "İİK 72" / "tck 217/a" / "madde 6" gibi doğrudan madde çağrısını yakalar.
 *
 * ÖNCEKİ KUSURLAR (23. denetim ajanı, 10.10.2026):
 *  - Kısaltma listesi elle 7 kanundu; "İİK 72" tanınmayıp HER kanunun m.72'si
 *    +20 puan alıyordu (TCK 72 en üste çıkıyordu). Artık 16 kanunun hepsi.
 *  - "217/A" yalnız "217" olarak okunuyordu; harfli alt madde (TCK 217/A,
 *    HMK 183/A, İİK 169/a) hiç eşleşmiyordu.
 */
export function parseCitation(q: string): Kunye {
  const { harita, desen } = kisaltmalar();
  const f = fold(q).replace(/\bis\s+k\b/g, 'isk'); // "iş k" → "isk"
  const kodM = desen.exec(f);
  const kod = kodM ? harita.get(kodM[1]) : undefined;
  // Önce açık "m." / "madde" işareti; yoksa ilk sayı.
  const noM =
    /\b(?:m\.?|madde)\s*(\d{1,4})(?:\s*\/\s*([a-z])(?![a-z]))?(?![0-9])/.exec(f) ??
    /(?:^|[^a-z0-9])(\d{1,4})(?:\s*\/\s*([a-z])(?![a-z]))?(?![0-9])/.exec(f);
  return { kod, no: noM?.[1], harf: noM?.[2] };
}

/** Madde numarası künyeyle eşleşiyor mu — büyük/küçük harf ve Türkçe harf farkı gözetilmez. */
function noEslesir(artNo: string, c: Kunye): boolean {
  if (!c.no) return false;
  const a = fold(artNo).replace(/\s+/g, '');
  return a === (c.harf ? `${c.no}/${c.harf}` : c.no);
}

/** Sorguya en uygun kanun maddelerini döndürür (en fazla `limit`). */
export function searchMevzuat(query: string, limit = 6): MevzuatHit[] {
  const q = query.trim();
  if (q.length < 2) return [];
  const cit = parseCitation(q);
  const words = fold(q).split(/\s+/).filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w));

  const rows = flat().map((f) => {
    let score = 0;
    // Doğrudan madde künyesi: "TCK 125" → tam isabet.
    if (cit.no && noEslesir(f.art.no, cit) && (!cit.kod || cit.kod === f.kod)) score += 20;
    const foldedTitle = f.art.title ? fold(f.art.title) : '';
    for (const w of words) {
      if (foldedTitle.includes(w)) score += 4; // kenar başlığı güçlü sinyal
      if (f.hay.includes(w)) score += 1;
    }
    return { f, score };
  });

  const hits = rows
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ f, score }): MevzuatHit => {
      const firstWord = words.find((w) => f.hay.includes(w)) ?? words[0] ?? '';
      return {
        kod: f.kod,
        kanun: f.kanun,
        slug: f.slug,
        no: f.art.no,
        title: f.art.title,
        text: f.art.text,
        snippet: snippetAround(f.art.text, f.hay, firstWord),
        score,
        mulga: mulgaMi(f.art),
      };
    });
  return hits;
}
