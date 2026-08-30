// Çevrimdışı MEVZUAT araması — İçtihat aramasının yanında kanun maddesi
// sonuçları getirir (rakibin "Mevzuat" kolonunun karşılığı, ama tamamen
// cihazda/anlık, ağ gerektirmez). Kaynak: uygulamaya gömülü 8 temel kanun.

import { LAW_INDEX, loadLaw, type LawArticle } from './loader';

export interface MevzuatHit {
  kod: string;
  kanun: string;
  slug: string;
  no: string;
  title?: string;
  text: string;
  snippet: string;
  score: number;
}

/** Türkçe sadeleştirme — uzunluk korunur (snippet indeksleri metinle hizalı kalır). */
function fold(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .replace(/â/g, 'a').replace(/î/g, 'i').replace(/û/g, 'u')
    .replace(/ç/g, 'c').replace(/ş/g, 's').replace(/ğ/g, 'g')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u');
}

const STOP = new Set(['ve', 'ile', 'veya', 'bir', 'bu', 'için', 'icin', 'olan', 'the']);

interface FlatArticle {
  kod: string;
  kanun: string;
  slug: string;
  art: LawArticle;
  hay: string; // fold(text)
}

let FLAT: FlatArticle[] | null = null;
let warming: Promise<void> | null = null;

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
 * Neden: indeks 7 kanunun ~4.500 maddesini (2,2 MB metin) JSON'dan çözüp
 * her birine Türkçe sadeleştirme uyguluyor. Bu iş tek seferde yapılınca
 * ölçümde masaüstünde ~350 ms sürdü; telefonda (Hermes) 1,5-2 saniyelik
 * DONMA demek. Kullanıcı arama kutusuna yazarken uygulama kilitleniyordu.
 *
 * Çözüm: her kanundan önce olay döngüsüne dönülür (setTimeout 0). Böylece iş
 * ~7 parçaya bölünür, hiçbir kare bloklanmaz. Arama ekranı açılır açılmaz
 * çağrılırsa kullanıcı yazmaya başladığında indeks çoktan hazır olur.
 */
export async function warmMevzuatIndex(): Promise<void> {
  if (FLAT) return;
  if (warming) return warming;
  warming = (async () => {
    const out: FlatArticle[] = [];
    for (const idx of LAW_INDEX) {
      // Kareyi serbest bırak: sonraki kanun bir sonraki tik'te işlenir.
      await new Promise<void>((r) => setTimeout(r, 0));
      addLaw(out, idx.slug);
    }
    FLAT = out;
  })();
  try {
    await warming;
  } finally {
    warming = null;
  }
}

/**
 * İndeksi döndürür. Arka plan kurulumu bitmediyse (kullanıcı çok hızlı
 * davrandıysa) senkron kurar — sonuç doğruluğu her hâlükârda korunur.
 */
function flat(): FlatArticle[] {
  if (FLAT) return FLAT;
  const out: FlatArticle[] = [];
  for (const idx of LAW_INDEX) addLaw(out, idx.slug);
  FLAT = out;
  return out;
}

function snippetAround(text: string, foldedText: string, foldedWord: string): string {
  const i = foldedText.indexOf(foldedWord);
  if (i < 0) return text.slice(0, 160).trim();
  const start = Math.max(0, i - 60);
  const end = Math.min(text.length, i + foldedWord.length + 110);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}

/** "TCK 125" / "madde 6" gibi doğrudan madde çağrısını yakalar. */
function parseCitation(q: string): { kod?: string; no?: string } {
  const codeMatch = q.match(/\b(tck|tmk|tbk|hmk|cmk|ttk|isk|iş\s*k)\b/i);
  const noMatch = q.match(/\b(?:m\.?|madde)?\s*(\d{1,4})\b/i);
  const map: Record<string, string> = { tck: 'TCK', tmk: 'TMK', tbk: 'TBK', hmk: 'HMK', cmk: 'CMK', ttk: 'TTK', isk: 'İşK' };
  const kod = codeMatch ? map[fold(codeMatch[1]).replace(/\s/g, '')] : undefined;
  return { kod, no: noMatch ? noMatch[1] : undefined };
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
    if (cit.no && f.art.no === cit.no && (!cit.kod || cit.kod === f.kod)) score += 20;
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
      };
    });
  return hits;
}
