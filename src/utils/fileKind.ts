import type { DocumentCategory } from '@/types/database';

export type FileKind = 'image' | 'pdf' | 'word' | 'other';

/** Detect the broad kind of a file from its MIME type / filename. */
export function detectFileKind(mime: string | null, name: string): FileKind {
  const m = (mime ?? '').toLowerCase();
  const n = name.toLowerCase();
  if (m.startsWith('image/') || /\.(jpe?g|png|gif|webp|heic|bmp)$/.test(n)) return 'image';
  if (m === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
  if (m.includes('word') || /\.(docx?|odt|rtf)$/.test(n)) return 'word';
  return 'other';
}

/**
 * What a category is *expected* to contain. Categories not listed accept
 * anything (evidence, invoices, correspondence, etc. can be photos or docs).
 */
const EXPECTED: Partial<Record<DocumentCategory, 'photo' | 'document'>> = {
  client_photo: 'photo',
  identification: 'photo',
  pleading: 'document',
  contract: 'document',
  court_order: 'document',
};

export type Mismatch = { expected: 'photo' | 'document' } | null;

/** Returns a mismatch descriptor if the file kind clearly conflicts with the category. */
export function categoryMismatch(category: DocumentCategory, kind: FileKind): Mismatch {
  const expected = EXPECTED[category];
  if (!expected) return null;
  if (expected === 'photo' && kind !== 'image') return { expected: 'photo' };
  if (expected === 'document' && kind === 'image') return { expected: 'document' };
  return null;
}
