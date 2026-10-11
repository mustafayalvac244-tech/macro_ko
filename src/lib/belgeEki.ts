import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '@/lib/supabase';
import { aiHataGovdesi } from '@/lib/aiHata';
import { dosyaBase64, dosyaBaytlari } from '@/lib/girdi';
import { belgeSeciciTurleri } from '@/lib/belgeTurleri';
import { EK_DOSYA_TAVANI_BAYT, PDF_SAYFA_TAVANI, ekHatasi, sunucudaOkunur, type EkHatasi } from '@/lib/belgeEkiKurallari';
import { metinDosyasiCoz } from '@/utils/metinKodlama';

/**
 * YAPAY ZEKÂYA BELGE EKLEME — seç, oku, gönderilecek hâle getir (04.10.2026).
 *
 * Sunucudaki karşılığı ve gerekçe: supabase/functions/_shared/belgeEki.ts.
 * Kısaca: PDF yapay zekâya GÖRÜNTÜSÜYLE gider (taranmış sayfa, tablo, mühür
 * okunur); UDF/Word/TXT metin olarak gider. PDF'in metni yine çıkarılır ama
 * yalnız sunucudaki uydurma tarih/tutar denetimi için.
 *
 * TARANMIŞ PDF ARTIK REDDEDİLMİYOR. doc-extract metin bulamayınca
 * 'pdf_no_text' döner; eskiden ekran "taranmış belge okunamıyor" diyordu.
 * Şimdi sayfa tavanı içindeyse görüntüsüyle gönderilir.
 */

export interface BelgeEki {
  ad: string;
  /** Çıkarılmış metin. Taranmış PDF'te boş olabilir. */
  metin: string;
  /** Ham base64 PDF — görüntüsüyle okunacaksa dolu. */
  pdf?: string;
  sayfa?: number;
  /** Metni çıkmayan (taranmış) sayfa sayısı. */
  taranmis?: number;
}

export type { EkHatasi };

/** Dosya seçtirir ve okur. Vazgeçilirse null. */
export async function belgeSecVeOku(): Promise<{ ek: BelgeEki } | { hata: EkHatasi } | null> {
  const secim = await DocumentPicker.getDocumentAsync({
    type: belgeSeciciTurleri(Platform.OS),
    copyToCacheDirectory: true,
  });
  if (secim.canceled || !secim.assets?.[0]) return null;
  const varlik = secim.assets[0];
  const ad = varlik.name || 'belge';
  const kucuk = ad.toLowerCase();
  // Boyut bilinmiyorsa (0) son sözü sunucu söyler.
  if (varlik.size && varlik.size > EK_DOSYA_TAVANI_BAYT) return { hata: 'buyuk' };

  try {
    // DÜZ METİN CİHAZDA OKUNUR (09.10.2026). Eskiden yalnız .txt burada ve
    // hep UTF-8 okunuyordu (Windows-1254 dilekçe bozuk çıkıyordu); başka
    // uzantılı her dosya — fotoğraf, Excel — sunucuda UTF-8 sanılıp çöp metin
    // olarak yapay zekâya gidiyordu. Artık kodlama çözülür, ikili dosya
    // "bu tür okunamıyor" diye reddedilir. Bkz. metinDosyasiCoz.
    if (!sunucudaOkunur(kucuk)) {
      const metin = metinDosyasiCoz(await dosyaBaytlari(varlik));
      if (metin === null) return { hata: 'desteklenmiyor' };
      return metin.trim() ? { ek: { ad, metin } } : { hata: 'bos' };
    }
    const base64 = await dosyaBase64(varlik);
    // Sıfır baytlık dosya: sunucu 'bad_request' döner, "okunamadı" denirdi.
    if (!base64) return { hata: 'bos' };
    const pdfMi = kucuk.endsWith('.pdf');
    const { data, error } = await supabase.functions.invoke('doc-extract', { body: { filename: kucuk, base64 } });
    if (error) {
      const govde = await aiHataGovdesi(error);
      const kod = govde.error ?? '';
      if (pdfMi && kod === 'pdf_no_text') {
        const sayfa = Number(govde.sayfa ?? 0);
        // Metni hiç yok: görüntüsüyle gönderilemiyorsa okunacak bir şey kalmaz.
        if (sayfa > 0 && sayfa <= PDF_SAYFA_TAVANI) return { ek: { ad, metin: '', pdf: base64, sayfa, taranmis: sayfa } };
        return { hata: 'taranmisUzun' };
      }
      // Eşleme saf ve testli: src/lib/belgeEkiKurallari.ts > ekHatasi.
      return { hata: ekHatasi(kod) };
    }
    const cikan = (data ?? {}) as { text?: string; sayfa?: number; okunamayanSayfa?: number[] };
    const metin = cikan.text ?? '';
    if (pdfMi) {
      return { ek: { ad, metin, pdf: base64, sayfa: cikan.sayfa, taranmis: cikan.okunamayanSayfa?.length ?? 0 } };
    }
    return metin.trim() ? { ek: { ad, metin } } : { hata: 'bos' };
  } catch {
    return { hata: 'okunamadi' };
  }
}
