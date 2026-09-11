import { Platform, Share } from 'react-native';
import { dosyaAdiUret } from '@/utils/dosyaAdi';

/**
 * ÜRETİLEN METNİ DIŞARI ÇIKARMA (kopyala / indir / paylaş).
 *
 * BULUNAN KUSUR — ölçüm, 2026-09-11:
 * Yapay zekâ çıktılarının (dilekçe, belge incelemesi, mütalaa) tek dışarı
 * çıkarma yolu `Share.share()` idi. react-native-web'in Share karşılığı
 * (node_modules/react-native-web/src/exports/Share/index.js) şunu yapıyor:
 *
 *     if (window.navigator.share !== undefined) { ... }
 *     else { return Promise.reject(new Error('Share is not supported in this browser')); }
 *
 * Çağrı yerlerinin HEPSİ `.catch(() => {})` ile yazılmıştı. Yani Web Share
 * desteklemeyen bir tarayıcıda (masaüstü Linux Chrome/Firefox'ta yok) avukat
 * paylaş düğmesine basıyor ve HİÇBİR ŞEY OLMUYOR — hata mesajı bile yok.
 * Ürettiği dilekçeyi dışarı alamıyor.
 *
 * Web'de doğru eylem zaten paylaşmak değil: KOPYALA (Word'e yapıştırmak için)
 * ve İNDİR (.txt). Bu modül platforma göre doğru olanı yapar ve BAŞARISIZLIĞI
 * SESSİZCE YUTMAZ — sonucu döndürür, arayüz kullanıcıya söyler.
 */

export type CiktiSonuc = 'kopyalandi' | 'indirildi' | 'paylasildi' | 'desteklenmiyor' | 'hata';

const webMi = Platform.OS === 'web';

/** Tarayıcıda pano yazma desteği var mı? (HTTPS veya localhost şart.) */
export function kopyalanabilirMi(): boolean {
  if (!webMi) return false;
  return typeof navigator !== 'undefined' && !!navigator.clipboard?.writeText;
}

/** Tarayıcıda dosya indirme yapılabilir mi? */
export function indirilebilirMi(): boolean {
  return webMi && typeof document !== 'undefined';
}

/** Web Share API var mı? (Masaüstü Linux/Firefox'ta genelde YOK.) */
export function paylasilabilirMi(): boolean {
  if (!webMi) return true; // natifte her zaman var
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/** Metni panoya kopyalar. */
export async function metniKopyala(metin: string): Promise<CiktiSonuc> {
  if (!kopyalanabilirMi()) return 'desteklenmiyor';
  try {
    await navigator.clipboard.writeText(metin);
    return 'kopyalandi';
  } catch {
    // Pano izni reddedilmiş olabilir (kullanıcı etkileşimi dışında çağrı vb.)
    return 'hata';
  }
}

/**
 * Metni .txt olarak indirir (yalnız web).
 *
 * BOM (﻿) bilerek eklendi: Windows'ta Not Defteri ve Word, BOM'suz UTF-8
 * dosyayı ANSI sanıp Türkçe harfleri bozuyor ("ÅŸ", "Ä±"). Avukat dosyayı
 * Word'de açacak; bozuk açılan bir dilekçe işe yaramaz.
 */
export function metniIndir(metin: string, baslik: string): CiktiSonuc {
  return dosyaIndir(metin, dosyaAdiUret(baslik, 'txt'), 'text/plain');
}

/**
 * Hazır bir dosya adıyla metin dosyası indirir (yalnız web).
 * CSV dışa aktarımı da buradan geçer — bkz. src/utils/exportCsv.ts.
 */
export function dosyaIndir(icerik: string, dosyaAdi: string, mime: string): CiktiSonuc {
  if (!indirilebilirMi()) return 'desteklenmiyor';
  try {
    const blob = new Blob([`﻿${icerik}`], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = dosyaAdi;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Bellekte kalmasın; tarayıcının indirmeyi başlatmasına zaman bırak.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return 'indirildi';
  } catch {
    return 'hata';
  }
}

/**
 * Paylaşır. Natifte OS paylaşım sayfası; web'de Web Share API varsa o, YOKSA
 * sessizce başarısız olmak yerine PANOYA KOPYALAR — kullanıcı her hâlükârda
 * metne sahip olur.
 */
export async function metniPaylas(metin: string, baslik?: string): Promise<CiktiSonuc> {
  if (!webMi) {
    try {
      await Share.share({ message: metin, title: baslik });
      return 'paylasildi';
    } catch {
      return 'hata';
    }
  }
  if (paylasilabilirMi()) {
    try {
      await navigator.share({ title: baslik, text: metin });
      return 'paylasildi';
    } catch (e) {
      // Kullanıcı paylaşım sayfasını kapattıysa bu bir hata değil.
      if ((e as { name?: string })?.name === 'AbortError') return 'paylasildi';
      return metniKopyala(metin);
    }
  }
  return metniKopyala(metin);
}
