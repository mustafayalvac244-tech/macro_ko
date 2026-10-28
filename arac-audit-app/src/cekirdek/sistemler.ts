// SİSTEMLER VE KAPSAM — Excel formundaki "System" karşılığı ve denetimin
// hangi sistemlerin kontrol edildiğini bilmesi.
//
// KAPSAM NEDEN VAR (24.10.2026, benzer uygulamaların incelenmesi): saha
// denetim uygulamaları (SafetyCulture/iAuditor kontrol listeleri, ATS Inspect
// "build-option checklists") denetimi "hangi maddeler bakıldı" diye tutar;
// bizde yalnız "hangi hatalar bulundu" vardı. Hatasız bir sistem ile hiç
// bakılmamış bir sistem raporda aynı görünüyordu. Şimdi her sistemin
// "kontrol edildi" işareti var: hata kaydedilince kendiliğinden, hatasızsa
// elle konur; Bitir'de eksik sistemler söylenir, raporda "Kontrol edilen
// sistemler" yazar.

import { BOLGELER, PARCA_INDEKS } from './katalog';
import { Bolge, BolgeGrubu, Dil } from './tipler';

/** "Dış · Sol yan" → "Sol yan": sistem adı zaten bir üst adımda yazıyor. */
export const kisaBolgeAdi = (ad: string): string => ad.split(' · ').slice(1).join(' · ') || ad;

/** Sıra: denetçinin araç etrafında dolaşma sırası. */
export const SISTEMLER: readonly { id: BolgeGrubu; ad: string; en: string }[] = [
  { id: 'dis', ad: 'Dış', en: 'Exterior' },
  { id: 'ic', ad: 'İç', en: 'Interior' },
  { id: 'motor', ad: 'Motor bölmesi', en: 'Engine room' },
  { id: 'fonksiyon', ad: 'Fonksiyon', en: 'Function' },
  { id: 'surus', ad: 'Yol testi', en: 'Road test' },
];

const SISTEM_INDEKS: Record<string, { ad: string; en: string }> = Object.fromEntries(
  SISTEMLER.map((s) => [s.id, { ad: s.ad, en: s.en }]),
);

export function sistemAdi(id: string, dil: Dil = 'tr'): string {
  const s = SISTEM_INDEKS[id];
  if (!s) return id;
  return dil === 'en' ? s.en : s.ad;
}

const BOLGE_SISTEMI: Record<string, BolgeGrubu> = Object.fromEntries(BOLGELER.map((b) => [b.id, b.grup]));

/** Parçanın bağlı olduğu sistem; bilinmeyen parça için null. */
export function parcaSistemi(parcaId: string): BolgeGrubu | null {
  const p = PARCA_INDEKS[parcaId];
  return p ? BOLGE_SISTEMI[p.bolgeId] ?? null : null;
}

/** Bu araçta var olan sistemler, SISTEMLER sırasıyla. */
export function mevcutSistemler(bolgeler: readonly Bolge[]): BolgeGrubu[] {
  const var_ = new Set(bolgeler.map((b) => b.grup));
  return SISTEMLER.map((s) => s.id).filter((id) => var_.has(id));
}

/** Kontrol edilmemiş sistemler, SISTEMLER sırasıyla. */
export function eksikSistemler(kapsam: readonly string[], mevcut: readonly BolgeGrubu[]): BolgeGrubu[] {
  const k = new Set(kapsam);
  return mevcut.filter((id) => !k.has(id));
}

/**
 * Bitmiş denetimin kapsamı (28.10.2026, kalite müdürü değerlendirmesi: eksik
 * sistemle bitirilen denetim listede düz "Tamamlandı" görünüyordu). "kismi"
 * yalnız liste KULLANILIP yarım kaldıysa: hiç işaret yoksa ("Problem yok" ya da
 * listeyi hiç kullanmayan ekip) kapsam bilinmiyor sayılır — her denetimi
 * "Kısmi" diye boyamak uyarıyı anlamsızlaştırırdı.
 */
export function kapsamDurumu(isaretli: number, toplam: number): 'tam' | 'kismi' | 'isaretsiz' {
  if (isaretli <= 0) return 'isaretsiz';
  return isaretli >= toplam ? 'tam' : 'kismi';
}

/**
 * Rapor künyesi için: "Dış, İç (2/5)". Hiçbiri işaretli değilse "— (0/5)":
 * boş bırakmak "bilgi yok" gibi okunurdu; "0/5" bir ölçümdür.
 */
export function kapsamMetni(kapsam: readonly string[], mevcut: readonly BolgeGrubu[], dil: Dil = 'tr'): string {
  const k = new Set(kapsam);
  const isaretli = mevcut.filter((id) => k.has(id));
  const liste = isaretli.map((id) => sistemAdi(id, dil)).join(', ') || '—';
  return `${liste} (${isaretli.length}/${mevcut.length})`;
}
