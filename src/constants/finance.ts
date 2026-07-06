import type { Ionicons } from '@expo/vector-icons';
import type { FinanceCategory } from '@/types/database';

export const EXPENSE_CATEGORIES: FinanceCategory[] = [
  'rent',
  'salary',
  'office',
  'utilities',
  'transport',
  'courtFee',
  'tax',
  'other',
];

export const INCOME_CATEGORIES: FinanceCategory[] = ['fee', 'consultation', 'retainer', 'other'];

export const FINANCE_CATEGORY_ICONS: Record<FinanceCategory, keyof typeof Ionicons.glyphMap> = {
  rent: 'home-outline',
  salary: 'people-outline',
  office: 'briefcase-outline',
  utilities: 'flash-outline',
  transport: 'car-outline',
  courtFee: 'document-text-outline',
  tax: 'receipt-outline',
  fee: 'cash-outline',
  consultation: 'chatbubbles-outline',
  retainer: 'repeat-outline',
  other: 'ellipsis-horizontal-circle-outline',
};
