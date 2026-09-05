// Offline law texts. Each JSON is bundled into the app so search works with no
// network. Source: Turkish legislation dataset; the authoritative text is always
// mevzuat.gov.tr — surfaced as a disclaimer in the UI.
export interface LawArticle {
  no: string;
  text: string;
  /** Maddenin resmî kenar başlığı (ör. "Aşırı ifa güçlüğü"). Temel kanunlarda mevcut. */
  title?: string;
  /** Kanun sistematiğindeki bölüm yolu (ör. "Kira Sözleşmesi › Genel Hükümler"). */
  section?: string;
}
export interface LawFile {
  short: string;
  name: string;
  source: string;
  articles: LawArticle[];
}
export interface LawIndexEntry {
  short: string;
  name: string;
  slug: string;
  count: number;
}

import indexJson from './index.json';

// Static require map (Metro can't do dynamic require paths).
const FILES: Record<string, () => LawFile> = {
  'turk-ceza': () => require('./turk-ceza.json') as LawFile,
  'turk-medeni': () => require('./turk-medeni.json') as LawFile,
  'turk-borclar': () => require('./turk-borclar.json') as LawFile,
  'hmk': () => require('./hmk.json') as LawFile,
  'cmk': () => require('./cmk.json') as LawFile,
  'ttk': () => require('./ttk.json') as LawFile,
  'is-kanunu': () => require('./is-kanunu.json') as LawFile,
  'iik': () => require('./iik.json') as LawFile,
  'iyuk': () => require('./iyuk.json') as LawFile,
  'tuketici': () => require('./tuketici.json') as LawFile,
  'is-mahkemeleri': () => require('./is-mahkemeleri.json') as LawFile,
  'avukatlik': () => require('./avukatlik.json') as LawFile,
  'sgk': () => require('./sgk.json') as LawFile,
  'kamulastirma': () => require('./kamulastirma.json') as LawFile,
  'amme': () => require('./amme.json') as LawFile,
  'aym': () => require('./aym.json') as LawFile,
};

export const LAW_INDEX = indexJson as LawIndexEntry[];

export function loadLaw(slug: string): LawFile | null {
  const f = FILES[slug];
  return f ? f() : null;
}
