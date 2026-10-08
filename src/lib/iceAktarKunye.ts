// BELGEDEN DOSYA AÇ — künyeyi önce YAPAY ZEKÂSIZ oku (08.10.2026).
// ---------------------------------------------------------------------------
// NEDEN. Ürün sahibi: "yapay zekâ hakkı biten adam ... dosya yükleyemiyorum
// diyor". Ölçüldü (08.10): ekran künyeyi HER dosyada yapay zekâya
// okutuyordu ve bu bir deneme hakkı harcıyordu. 10 hakkını bitiren avukat
// (canlıda 1 hesap, 03.10'da 10/10) artık hiç dosya açamıyordu: belge
// okunuyor, sonra "Deneme haklarınızı kullandınız" duvarı. Aynı gün Claude
// Console hesabı da askıya alındı; yapay zekâya bağlı her adım kırılgan.
//
// Oysa "Esas No: 2023/145", "ANKARA 3. ASLİYE HUKUK MAHKEMESİ", "DAVALI:"
// belgede düz yazıyla duruyor. Chrome eklentisi bunları zaten düzenli
// ifadeyle çıkarıyor (extension/lib/cikar.js, tests/eklentiCikar.test.ts).
// Aynı çıkarıcı burada da kullanılıyor: anında, bedava, hak harcamaz.
// Yapay zekâ yalnız yazıdan esas no + mahkeme çıkmazsa devreye girer.
//
// KARŞI TARAF TAHMİN EDİLMEZ. Yerel çıkarıcı davalıyı "karşı taraf" sayıyor
// (eklentide öyle); bu ekranın kuralı ise avukatın seçmesi — belge kimin
// vekili olduğumuzu söylemez. Bu yüzden yerel sonuçta karşı taraf boş gelir,
// davacı/davalı seçenek olarak sunulur.

import { kunyeCikarYerel } from '../../extension/lib/cikar.js';
import type { TKey } from '@/i18n';

export interface KunyeFormu {
  title: string;
  court_name: string;
  case_number: string;
  case_type: string;
  opposing_party: string;
  hearing_date: string; // YYYY-MM-DD veya boş
}

export interface YerelKunye {
  form: KunyeFormu;
  taraflar: { davaci: string; davali: string };
  /** Esas no ve mahkeme ikisi de bulunduysa yapay zekâya gerek yok. */
  yeterli: boolean;
  /** Hiçbir alan bulunamadıysa false — yapay zekâ da olmazsa gösterilecek bir şey yok. */
  bosDegil: boolean;
}

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export function yerelKunye(metin: string): YerelKunye {
  const k = kunyeCikarYerel(metin) as Record<string, string | null>;
  const form: KunyeFormu = {
    title: s(k.title),
    court_name: s(k.court_name),
    case_number: s(k.case_number),
    case_type: s(k.case_type),
    opposing_party: '',
    hearing_date: /^\d{4}-\d{2}-\d{2}$/.test(s(k.hearing_date)) ? s(k.hearing_date) : '',
  };
  const taraflar = { davaci: s(k.davaci), davali: s(k.davali) };
  const bosDegil = [form.title, form.court_name, form.case_number, form.case_type, form.hearing_date, taraflar.davaci, taraflar.davali].some(Boolean);
  return { form, taraflar, yeterli: !!form.case_number && !!form.court_name, bosDegil };
}

/**
 * doc-extract hata kodu → kullanıcıya GERÇEK sebep.
 *
 * Eskiden her hata "Dosya okunamadı. Düz metin (.txt) dosyası seçin"
 * diyordu: taranmış PDF, 8 MB sınırı ve eski .doc aynı cümleye düşüyor,
 * avukata yanlış çözüm (.txt) öneriliyordu.
 */
export function belgeOkumaHatasi(kod: string): TKey {
  if (kod === 'pdf_no_text') return 'imp.hataTaranmis';
  if (kod === 'too_large') return 'ek.hata.buyuk';
  if (kod === 'doc_legacy') return 'ek.hata.eskiDoc';
  if (kod === 'empty') return 'docrev.fileEmpty';
  return 'ek.hata.okunamadi';
}
