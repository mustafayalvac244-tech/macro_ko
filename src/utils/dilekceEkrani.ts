import type { KararDenetimiVerisi } from '@/components/ui/AtifDenetimi';
import type { AiKullanim } from '@/hooks/useAiKontor';

/**
 * DİLEKÇE EKRANININ SAF MANTIĞI (09.10.2026 denetimi, ajan 20).
 *
 * Ekran bileşeni testlenemez (RN çalışma zamanı yok); denetimde bulunan dört
 * hata burada, sayıyla sınanabilir biçimde çözüldü:
 *   • dosya seçici ilk 12 dosyada kesiyordu,
 *   • "Düzelt" sonrası ilk taslağın uyarıları (ve istek bilgisi) bayat kalıyordu,
 *   • "Geri al" uyarıları geri getirmiyordu,
 *   • dışa giden belgede atıf uyarısı yoktu.
 */

export interface EkUyari {
  pdfdenMetne?: string[];
  okunamayan?: string[];
  taranmis?: boolean;
}

/** Ekranda GÖSTERİLEN taslağa ait her uyarı ve istek bilgisi — tek parça, böylece anlık görüntüsü alınabilir. */
export interface DilekceUyarilari {
  // — yalnız ÜRETİMDE sunucunun denetlediği yapı uyarıları —
  eksikBolum: string[];
  talepEksik: string[];
  cakisanDayanak: string[];
  /** Bu üç uyarı ilk taslak içindi ve "Düzelt"ten sonra yeniden denetlenmedi. */
  yapiDenetimiEski: boolean;
  // — sunucunun her yanıtta metne bakarak yeniden hesapladıkları —
  uydurmaMadde: string[];
  uydurmaTutar: number[];
  kararDenetimi: KararDenetimiVerisi | null;
  ayiklanan: number;
  // — girdiyle (eklerle) ilgili: düzeltmeyle değişmez —
  ekUyari: EkUyari | null;
  // — son isteğe ait —
  kullanim: AiKullanim | null;
  hakDusulmedi: boolean;
  yedekModel: boolean;
  /** Son isteğin kimliği: hak iadesi ve düzeltme ölçümü buna bağlanır. */
  istekId: string | null;
}

export const BOS_UYARI: DilekceUyarilari = {
  eksikBolum: [],
  talepEksik: [],
  cakisanDayanak: [],
  yapiDenetimiEski: false,
  uydurmaMadde: [],
  uydurmaTutar: [],
  kararDenetimi: null,
  ayiklanan: 0,
  ekUyari: null,
  kullanim: null,
  hakDusulmedi: false,
  yedekModel: false,
  istekId: null,
};

export interface DuzeltmeYaniti {
  uydurmaMadde?: string[];
  uydurmaTutar?: number[];
  kararDenetimi?: KararDenetimiVerisi;
  ayiklananTarih?: number;
  kullanim?: AiKullanim;
  hakDusulmedi?: boolean;
  yedekModel?: boolean;
  istekId?: string | null;
}

export interface UretimYaniti extends DuzeltmeYaniti {
  eksikBolum?: string[];
  talepEksik?: string[];
  cakisanDayanak?: string[];
  ekUyari?: EkUyari;
}

/** İlk üretimin yanıtından ekrandaki uyarılar. */
export function uretimUyarilari(y: UretimYaniti): DilekceUyarilari {
  return {
    eksikBolum: y.eksikBolum ?? [],
    talepEksik: y.talepEksik ?? [],
    cakisanDayanak: y.cakisanDayanak ?? [],
    yapiDenetimiEski: false,
    uydurmaMadde: y.uydurmaMadde ?? [],
    uydurmaTutar: y.uydurmaTutar ?? [],
    kararDenetimi: y.kararDenetimi ?? null,
    ayiklanan: Number(y.ayiklananTarih ?? 0),
    ekUyari: y.ekUyari ?? null,
    kullanim: y.kullanim ?? null,
    hakDusulmedi: !!y.hakDusulmedi,
    yedekModel: !!y.yedekModel,
    istekId: y.istekId ?? null,
  };
}

/**
 * "Düzelt" yanıtından yeni uyarılar.
 *
 * Sunucu düzeltmede madde/tutar/karar atfını YENİDEN denetler ama eksik bölüm,
 * talep ve çakışan dayanak denetimini YAPMAZ (yalnız üretimde var). Eskiden bu
 * üç uyarı ilk taslaktan kalıyordu ve düzeltilmiş metin için hâlâ geçerliymiş
 * gibi duruyordu. Sessizce silmek de yanlış: hâlâ doğru olabilirler. O yüzden
 * KORUNUR ve "ilk taslak içindi" diye işaretlenir.
 */
export function duzeltmeUyarilari(onceki: DilekceUyarilari, y: DuzeltmeYaniti): DilekceUyarilari {
  return {
    ...onceki,
    yapiDenetimiEski: true,
    uydurmaMadde: y.uydurmaMadde ?? [],
    uydurmaTutar: y.uydurmaTutar ?? [],
    kararDenetimi: y.kararDenetimi ?? null,
    ayiklanan: Number(y.ayiklananTarih ?? 0),
    kullanim: y.kullanim ?? null,
    hakDusulmedi: !!y.hakDusulmedi,
    yedekModel: !!y.yedekModel,
    istekId: y.istekId ?? null,
  };
}

// ─── Dosya seçici ──────────────────────────────────────────────────────────

/** Seçicide başta gösterilen dosya sayısı. */
export const DOSYA_SINIRI = 12;

/**
 * Seçicide gösterilecek dosyalar. Eskiden `slice(0, 12)` idi: dosya listesi
 * açılış tarihine göre YENİDEN ESKİYE sıralı olduğundan 13. ve sonraki
 * (genellikle en eski, üzerinde istinaf/temyiz yazılan) dosyalara ERİŞİLEMİYORDU.
 * Şimdi: sınırın ötesi "tümünü göster" ile açılır; seçili dosya sınırın
 * ötesindeyse kapalıyken de listede kalır.
 */
export function dosyaSecenekleri<T extends { id: string }>(
  davalar: T[],
  secili: string | null,
  tumu: boolean,
  sinir: number = DOSYA_SINIRI,
): { liste: T[]; gizli: number } {
  if (tumu || davalar.length <= sinir) return { liste: davalar, gizli: 0 };
  const liste = davalar.slice(0, sinir);
  if (secili && !liste.some((d) => d.id === secili)) {
    const s = davalar.find((d) => d.id === secili);
    if (s) liste.push(s);
  }
  return { liste, gizli: davalar.length - liste.length };
}

/**
 * Seçili dosya kimliği hâlâ geçerli mi? Taslaktan geri yüklenen ya da arada
 * kapatılan dosya listede görünmez ama kimliği sunucuya giderdi (görünmez seçim).
 * Liste henüz yüklenmediyse dokunulmaz.
 */
export function gecerliDosyaId(davalar: Array<{ id: string }> | undefined, caseId: string | null): string | null {
  if (!caseId) return null;
  if (!davalar) return caseId;
  return davalar.some((d) => d.id === caseId) ? caseId : null;
}

// ─── Dışa aktarmadan önce teyit ────────────────────────────────────────────

/** Dışa giden metinde TEYİT EDİLMEMİŞ ögelerin sayısı. */
export function teyitsizOgeSayilari(
  u: Pick<DilekceUyarilari, 'uydurmaMadde' | 'uydurmaTutar' | 'kararDenetimi'>,
): { madde: number; tutar: number; kunye: number } {
  const k = u.kararDenetimi;
  return {
    madde: u.uydurmaMadde.length,
    tutar: u.uydurmaTutar.length,
    // havuzdaYok ve canlidaYok ayrık kümelerdir (ai-chat: canlidaYokSet süzgeci).
    // Çıkarılanların yerinde boşluk kalır, onu da avukatın doldurması gerekir.
    kunye: k ? k.havuzdaYok.length + (k.canlidaYok?.length ?? 0) + k.olanaksiz.length : 0,
  };
}

type OnayAnahtari = 'cikti.onayMetni' | 'cikti.onayMadde' | 'cikti.onayTutar' | 'cikti.onayKunye';

/**
 * Dışa aktarma onay penceresinin metni; teyitsiz öge yoksa null (onay sorulmaz).
 * UDF'nin KENDİSİNE uyarı eklenmez (UYAP'a giden belge temiz kalmalı) — uyarı
 * dosya oluşmadan ÖNCE ekranda gösterilir.
 */
export function disaAktarOnayMetni(
  u: Pick<DilekceUyarilari, 'uydurmaMadde' | 'uydurmaTutar' | 'kararDenetimi'>,
  t: (anahtar: OnayAnahtari, params?: Record<string, string | number>) => string,
): string | null {
  const s = teyitsizOgeSayilari(u);
  const parcalar: string[] = [];
  if (s.madde) parcalar.push(t('cikti.onayMadde', { n: s.madde }));
  if (s.tutar) parcalar.push(t('cikti.onayTutar', { n: s.tutar }));
  if (s.kunye) parcalar.push(t('cikti.onayKunye', { n: s.kunye }));
  if (!parcalar.length) return null;
  return t('cikti.onayMetni', { ozet: parcalar.join(' · ') });
}
