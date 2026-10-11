/**
 * DOSYA DİZİNİ (app/(app)/cases/index.tsx) — arama, sıralama ve boş durum.
 * react-native'e BAĞIMSIZ; tests/davaDizini.test.ts kilitler.
 *
 * ARAMA (09.10.2026 denetimi). Arama sunucuda `ilike('title', '%' + arama +
 * '%')` ile yapılıyordu: yalnız başlıkta, boşluk kırpılmadan, Türkçe katlama
 * olmadan ve her tuş vuruşunda yeni bir sorguyla. Avukat dosyayı çoğu zaman
 * esas numarasıyla, mahkemesiyle ya da müvekkilin adıyla arar; bunların hiçbiri
 * bulunmuyordu. Artık liste bir kez çekilir, arama cihazda yapılır:
 *  - ekranda görünen ya da avukatın dosyayı tanıdığı alanların hepsi aranır,
 *  - `aramaNormalize` (utils/arama) İ/ı/I/i ve ş/ç/ğ/ö/ü farkını affeder,
 *  - sorgu kelimelere bölünür, her kelime bir alanda geçmelidir
 *    ("şahin 2024/157" → müvekkil + esas no).
 */
import { aramaNormalize } from './arama';

type Muvekkil = { full_name?: string | null; company?: string | null } | null | undefined;

export interface DavaAramaAlanlari {
  title: string;
  case_number?: string | null;
  court_name?: string | null;
  case_type?: string | null;
  opposing_party?: string | null;
  opposing_counsel?: string | null;
  client?: Muvekkil;
}

export interface IcraAramaAlanlari {
  debtor_name: string;
  file_number?: string | null;
  office_name?: string | null;
  client?: Muvekkil;
}

// Alanlar arası ayraç. Sorgu normalize edilince satır sonu içeremez; böylece
// bir alanın sonu ile ötekinin başı birleşip sahte eşleşme üretmez.
const AYRAC = '\n';

function aramaMetni(alanlar: Array<string | null | undefined>): string {
  return alanlar.map(aramaNormalize).filter(Boolean).join(AYRAC);
}

/** Davanın aranacak metni — liste her değiştiğinde bir kez hesaplanır. */
export function davaAramaMetni(d: DavaAramaAlanlari): string {
  return aramaMetni([
    d.title,
    d.case_number,
    d.court_name,
    d.case_type,
    d.opposing_party,
    d.opposing_counsel,
    d.client?.full_name,
    d.client?.company,
  ]);
}

/** İcra dosyasının aranacak metni (dizinde davalarla aynı listede durur). */
export function icraAramaMetni(e: IcraAramaAlanlari): string {
  return aramaMetni([e.debtor_name, e.file_number, e.office_name, e.client?.full_name, e.client?.company]);
}

/** `aramaMetni` (davaAramaMetni/icraAramaMetni çıktısı) sorgunun her kelimesini içeriyor mu. */
export function aramaKarsilar(aramaMetni: string, sorgu: string | null | undefined): boolean {
  const q = aramaNormalize(sorgu);
  if (!q) return true; // boş sorgu süzgeç kapalı demektir
  return q.split(' ').every((kelime) => aramaMetni.includes(kelime));
}

export interface DizinSirasi {
  /** Dava: açılış günü; icra: takip günü (yoksa created_at). */
  date: string;
  item: { id: string; created_at: string };
}

/**
 * Yeni → eski. Eskiden `(a, b) => (a.date < b.date ? 1 : -1)` idi: eşit tarihte
 * 0 yerine -1 döndürüyordu, karşılaştırıcı tutarsızdı ve aynı gün açılan
 * dosyaların sunucudan gelen sırası (son eklenen önce) TERS dönüyordu.
 * Önce gün (ilk 10 karakter: yalnız gün olan tarih ile zaman damgası aynı
 * ölçekte kıyaslansın), sonra eklenme anı, en son kimlik — eşitte 0.
 */
export function dizinKarsilastir(a: DizinSirasi, b: DizinSirasi): number {
  const ga = a.date.slice(0, 10);
  const gb = b.date.slice(0, 10);
  if (ga !== gb) return ga < gb ? 1 : -1;
  if (a.item.created_at !== b.item.created_at) return a.item.created_at < b.item.created_at ? 1 : -1;
  if (a.item.id === b.item.id) return 0;
  return a.item.id < b.item.id ? -1 : 1;
}

export type DizinBosDurumu = 'yukleniyor' | 'hata' | 'eslesmeYok' | 'bos';

/**
 * Liste boşken NE gösterileceği. Eskiden yükleme bitince her zaman "Henüz dava
 * yok — ilk davanızı oluşturun" çıkıyordu: sorgu hata verdiğinde de (çevrimdışı,
 * sunucu hatası) ve arama/süzgeç hiçbir dosyayla eşleşmediğinde de. Davaları
 * olan avukata "hiç davan yok" demek, verisinin silindiğini düşündürür.
 */
export function dizinBosDurumu(p: {
  yukleniyor: boolean;
  hata: boolean;
  aramaVar: boolean;
  suzgecVar: boolean;
}): DizinBosDurumu {
  if (p.yukleniyor) return 'yukleniyor';
  if (p.hata) return 'hata';
  if (p.aramaVar || p.suzgecVar) return 'eslesmeYok';
  return 'bos';
}
