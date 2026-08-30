import type { Lang } from '@/i18n';

export const caseTypeSuggestions: Record<Lang, string[]> = {
  tr: [
    'Alacak Davası',
    'Boşanma Davası',
    'İşçilik Davası',
    'Tazminat Davası',
    'Ceza Davası',
    'İcra Takibi',
    'Kira Davası',
    'Miras Davası',
    'Ticari Dava',
    'İdari Dava',
    'Tapu / Gayrimenkul',
    'Velayet / Nafaka',
    'Tüketici Davası',
  ],
  en: [
    'Civil Litigation',
    'Divorce',
    'Employment',
    'Personal Injury',
    'Criminal Defense',
    'Debt Collection',
    'Landlord-Tenant',
    'Probate / Estate',
    'Commercial',
    'Administrative',
    'Real Estate',
    'Custody / Support',
    'Consumer',
  ],
};

export const courtSuggestions: Record<Lang, string[]> = {
  tr: [
    'Asliye Hukuk Mahkemesi',
    'Asliye Ceza Mahkemesi',
    'Sulh Hukuk Mahkemesi',
    'Ağır Ceza Mahkemesi',
    'İş Mahkemesi',
    'Aile Mahkemesi',
    'Asliye Ticaret Mahkemesi',
    'İdare Mahkemesi',
    'Tüketici Mahkemesi',
    'İcra Dairesi',
    'Bölge Adliye Mahkemesi',
  ],
  en: [
    'District Court',
    'Superior Court',
    'Family Court',
    'Criminal Court',
    'Labor Court',
    'Commercial Court',
    'Administrative Court',
    'Court of Appeals',
    'Small Claims Court',
  ],
};

export const meetingTitleSuggestions: Record<Lang, string[]> = {
  tr: [
    'Müvekkil Görüşmesi',
    'Dosya Değerlendirme Toplantısı',
    'Sözleşme Görüşmesi',
    'Arabuluculuk Görüşmesi',
    'Uzlaşma Görüşmesi',
    'Bilgilendirme Toplantısı',
  ],
  en: [
    'Client Meeting',
    'Case Review Meeting',
    'Contract Discussion',
    'Mediation Session',
    'Settlement Meeting',
    'Briefing Meeting',
  ],
};

export const hearingTitleSuggestions: Record<Lang, string[]> = {
  tr: [
    'Ön İnceleme Duruşması',
    'Tahkikat Duruşması',
    'Karar Duruşması',
    'Keşif',
    'Bilirkişi İncelemesi',
    'Uzlaştırma Görüşmesi',
    'İfade / Sorgu',
  ],
  en: [
    'Preliminary Hearing',
    'Trial Hearing',
    'Final Hearing',
    'Site Inspection',
    'Expert Review',
    'Settlement Conference',
    'Deposition',
  ],
};

export const deadlineTitleSuggestions: Record<Lang, string[]> = {
  tr: [
    'Cevap dilekçesi sunumu',
    'Delil listesi sunumu',
    'Bilirkişi raporuna itiraz',
    'İstinaf başvurusu',
    'Temyiz başvurusu',
    'Gerekçeli karara itiraz',
    'Islah dilekçesi',
    'Zamanaşımı takibi',
  ],
  en: [
    'File answer brief',
    'Submit evidence list',
    'Object to expert report',
    'File appeal',
    'File cassation appeal',
    'Objection to judgment',
    'Amendment petition',
    'Statute of limitations check',
  ],
};
