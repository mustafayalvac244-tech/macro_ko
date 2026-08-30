export type LegalDeadlineGroup = 'hukuk' | 'ceza' | 'icra' | 'idare' | 'is';
export type LegalDurationUnit = 'day' | 'week' | 'month' | 'year';

export interface LegalDeadlineDef {
  id: string;
  tr: string;
  en: string;
  /** Statute reference shown to the user, e.g. "HMK 345" */
  basis: string;
  amount: number;
  unit: LegalDurationUnit;
  group: LegalDeadlineGroup;
}

export const LEGAL_DEADLINE_GROUPS: LegalDeadlineGroup[] = ['hukuk', 'ceza', 'icra', 'idare', 'is'];

/**
 * Common Turkish procedural deadlines. Durations follow the statutes in force
 * as of 2025 (CMK periods reflect Law No. 7445, effective 1 June 2024).
 * Informational only — the app shows a "verify against current law" disclaimer.
 */
export const LEGAL_DEADLINES: LegalDeadlineDef[] = [
  // Hukuk yargılaması (HMK)
  { id: 'cevap', tr: 'Cevap dilekçesi', en: 'Answer to complaint', basis: 'HMK 127', amount: 2, unit: 'week', group: 'hukuk' },
  { id: 'ikinci-dilekce', tr: 'Cevaba cevap / ikinci cevap', en: 'Reply / rejoinder', basis: 'HMK 136', amount: 2, unit: 'week', group: 'hukuk' },
  { id: 'istinaf-hukuk', tr: 'İstinaf başvurusu (hukuk)', en: 'Appeal — civil', basis: 'HMK 345', amount: 2, unit: 'week', group: 'hukuk' },
  { id: 'istinaf-cevap', tr: 'İstinaf dilekçesine cevap', en: 'Answer to appeal', basis: 'HMK 347', amount: 2, unit: 'week', group: 'hukuk' },
  { id: 'temyiz-hukuk', tr: 'Temyiz başvurusu (hukuk)', en: 'Cassation — civil', basis: 'HMK 361', amount: 2, unit: 'week', group: 'hukuk' },
  { id: 'bilirkisi-itiraz', tr: 'Bilirkişi raporuna itiraz', en: 'Objection to expert report', basis: 'HMK 281', amount: 2, unit: 'week', group: 'hukuk' },
  { id: 'tedbir-itiraz', tr: 'İhtiyati tedbire itiraz', en: 'Objection to interim injunction', basis: 'HMK 394', amount: 1, unit: 'week', group: 'hukuk' },

  // Ceza yargılaması (CMK — 7445 sayılı Kanun sonrası)
  { id: 'istinaf-ceza', tr: 'İstinaf başvurusu (ceza)', en: 'Appeal — criminal', basis: 'CMK 273', amount: 2, unit: 'week', group: 'ceza' },
  { id: 'temyiz-ceza', tr: 'Temyiz başvurusu (ceza)', en: 'Cassation — criminal', basis: 'CMK 291', amount: 2, unit: 'week', group: 'ceza' },
  { id: 'cmk-itiraz', tr: 'Karara itiraz (ceza)', en: 'Objection — criminal', basis: 'CMK 268', amount: 2, unit: 'week', group: 'ceza' },
  { id: 'kyok-itiraz', tr: 'Takipsizlik (KYOK) kararına itiraz', en: 'Objection to non-prosecution', basis: 'CMK 173', amount: 2, unit: 'week', group: 'ceza' },

  // İcra ve iflas (İİK)
  { id: 'odeme-emri-itiraz', tr: 'Ödeme emrine itiraz (genel haciz)', en: 'Objection to payment order', basis: 'İİK 62', amount: 7, unit: 'day', group: 'icra' },
  { id: 'kambiyo-itiraz', tr: 'Kambiyo takibinde borca itiraz', en: 'Objection — negotiable instrument', basis: 'İİK 168', amount: 5, unit: 'day', group: 'icra' },
  { id: 'icra-sikayet', tr: 'İcra memuru işlemini şikayet', en: 'Complaint against enforcement act', basis: 'İİK 16', amount: 7, unit: 'day', group: 'icra' },
  { id: 'ihale-feshi', tr: 'İhalenin feshi talebi', en: 'Annulment of auction', basis: 'İİK 134', amount: 7, unit: 'day', group: 'icra' },
  { id: 'itirazin-iptali', tr: 'İtirazın iptali davası', en: 'Action to annul objection', basis: 'İİK 67', amount: 1, unit: 'year', group: 'icra' },

  // İdari yargı (İYUK) + AYM
  { id: 'idari-dava', tr: 'İptal / tam yargı davası (idare mah.)', en: 'Administrative action', basis: 'İYUK 7', amount: 60, unit: 'day', group: 'idare' },
  { id: 'vergi-dava', tr: 'Vergi mahkemesinde dava açma', en: 'Tax court action', basis: 'İYUK 7', amount: 30, unit: 'day', group: 'idare' },
  { id: 'idari-istinaf', tr: 'İstinaf (idari yargı)', en: 'Appeal — administrative', basis: 'İYUK 45', amount: 30, unit: 'day', group: 'idare' },
  { id: 'idari-temyiz', tr: 'Temyiz (Danıştay)', en: 'Cassation — Council of State', basis: 'İYUK 46', amount: 30, unit: 'day', group: 'idare' },
  { id: 'aym-basvuru', tr: 'AYM bireysel başvuru', en: 'Constitutional Court application', basis: '6216 s.K. 47', amount: 30, unit: 'day', group: 'idare' },

  // İş hukuku
  { id: 'ise-iade', tr: 'İşe iade — arabulucuya başvuru', en: 'Reinstatement — mediation application', basis: 'İş K. 20', amount: 1, unit: 'month', group: 'is' },
  { id: 'arabuluculuk-dava', tr: 'İşe iade — son tutanak sonrası dava', en: 'Reinstatement — action after mediation', basis: 'İş K. 20', amount: 2, unit: 'week', group: 'is' },
];
