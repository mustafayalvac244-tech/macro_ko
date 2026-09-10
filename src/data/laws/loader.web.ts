// Kanun metinlerinin WEB yükleyicisi — natif sürümden TEK farkı, JSON'ları
// pakete gömmek yerine AĞDAN indirmesi.
//
// NEDEN: 16 kanun JSON'u diskte 5,2 MB. Natifte bu kabul edilebilir (bir kez
// kurulur, sonra çevrimdışı çalışır). Web'de ise Metro tree-shaking yapmadığı
// için tamamı TEK entry.js paketine giriyordu: 2026-09-10 ölçümünde 13.446.994
// baytlık paketin ~5,2 MB'ı yalnızca kanun metniydi — kullanıcı Kanunlar
// ekranını hiç açmasa bile her açılışta indiriliyordu.
//
// DÜRÜST SINIR: bu, indirmeyi ORTADAN KALDIRMAZ, ERTELER. Kanunlar ekranını
// açan kullanıcı o kanunu yine indirir (ve tarayıcı önbelleğine alır). Kazanç
// ilk açılışta, kanun ekranına hiç girmeyen kullanıcı içindir.
//
// Dosyalar `public/veri/kanun/<slug>.json` altından servis edilir; oraya
// scripts/web-veri-hazirla.mjs kopyalar (bkz. package.json → export:web).
export interface LawArticle {
  no: string;
  text: string;
  title?: string;
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

// Dizin dosyası 1,7 KB — pakette kalması sorun değil, Kanunlar ekranı anında
// açılsın diye bilerek gömülü tutuluyor.
import indexJson from './index.json';

export const LAW_INDEX = indexJson as LawIndexEntry[];

const GECERLI = new Set(LAW_INDEX.map((e) => e.slug));
const ONBELLEK = new Map<string, LawFile>();
const UCUSTA = new Map<string, Promise<void>>();

function kok(): string {
  // Expo, app.json → experiments.baseUrl değerini derleme sırasında buraya
  // gömer ("/macro_ko/app"). Alt yolda barındırma bunsuz kırılır.
  const b = process.env.EXPO_BASE_URL ?? '';
  return b.endsWith('/') ? b.slice(0, -1) : b;
}

export function lawReady(slug: string): boolean {
  return ONBELLEK.has(slug);
}

export function loadLaw(slug: string): LawFile | null {
  return ONBELLEK.get(slug) ?? null;
}

/**
 * Kanunu indirir ve önbelleğe alır. Aynı kanun için eşzamanlı çağrılar TEK
 * indirmeye bağlanır (UCUSTA). Hata yutulmaz — çağıran ekran "yüklenemedi"
 * diyebilsin diye fırlatılır.
 */
export async function ensureLaw(slug: string): Promise<void> {
  if (ONBELLEK.has(slug)) return;
  if (!GECERLI.has(slug)) return; // bilinmeyen slug: sessizce yok say (loadLaw null döner)
  const mevcut = UCUSTA.get(slug);
  if (mevcut) return mevcut;

  const is = (async () => {
    const res = await fetch(`${kok()}/veri/kanun/${slug}.json`);
    if (!res.ok) throw new Error(`kanun indirilemedi: ${slug} (HTTP ${res.status})`);
    ONBELLEK.set(slug, (await res.json()) as LawFile);
  })();

  UCUSTA.set(slug, is);
  try {
    await is;
  } finally {
    UCUSTA.delete(slug);
  }
}
