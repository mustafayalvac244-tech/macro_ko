/**
 * Yapılandırma bayrakları — BAĞIMLILIKSIZ tutulur.
 *
 * Yalnız process.env okur; Supabase istemcisini ya da react-native modüllerini
 * içeri çekmez. Sebep somut: bu bayrağı authErrors gibi saf birimlerden
 * kullanmak gerekiyor ve oraya supabase.ts'i import etmek, hiçbir React Native
 * bağımlılığı olmayan birim testlerini kırıyor.
 */
export const SUPABASE_YAPILANDIRILDI = Boolean(
  process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);
