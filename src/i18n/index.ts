import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tr } from './tr';
import { en } from './en';

export type Lang = 'tr' | 'en';
export type TKey = keyof typeof tr;

const dicts: Record<Lang, Record<TKey, string>> = { tr, en };
const STORAGE_KEY = 'vekil-lang';

interface LangState {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

export const useLangStore = create<LangState>((set) => ({
  lang: 'tr',
  setLang: (lang) => {
    set({ lang });
    AsyncStorage.setItem(STORAGE_KEY, lang).catch(() => {});
  },
}));

export async function hydrateLanguage(): Promise<void> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved === 'tr' || saved === 'en') useLangStore.setState({ lang: saved });
  } catch {
    // keep default
  }
}

export function translate(lang: Lang, key: TKey, vars?: Record<string, string | number>): string {
  let text: string = dicts[lang][key] ?? dicts.tr[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replace(`{${name}}`, String(value));
    }
  }
  return text;
}

export function getLang(): Lang {
  return useLangStore.getState().lang;
}

/** Reactive translation hook — components re-render when the language changes. */
export function useT() {
  const lang = useLangStore((s) => s.lang);
  return (key: TKey, vars?: Record<string, string | number>) => translate(lang, key, vars);
}
