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
function flat(): FlatArticle[] {
  if (FLAT) return FLAT;
  const out: FlatArticle[] = [];
  for (const idx of LAW_INDEX) {
    const law = loadLaw(idx.slug);
    if (!law) continue;
    for (const art of law.articles) {
      out.push({ kod: law.short, kanun: law.name, slug: idx.slug, art, hay: fold(art.text) });
    }
  }
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
