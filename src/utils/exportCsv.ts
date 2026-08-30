import { Platform, Share } from 'react-native';
import { File, Paths } from 'expo-file-system';

/**
 * CSV dışa aktarma — muhasebeciye/vergi için veriyi uygulamadan çıkarır.
 *
 * Yerli modül eklemeden çalışır (OTA güvenli): dosyayı expo-file-system ile
 * önbelleğe yazar, iOS'ta dosyayı paylaşır. Dosya paylaşımı desteklenmezse
 * (Android'de Share yalnız metin alır) CSV metni olarak paylaşır — böylece
 * kullanıcı her koşulda verisine ulaşır.
 */

/** Bir hücreyi CSV için güvenli hale getirir (tırnak/virgül/satır sonu). */
function cell(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Satırlardan CSV metni üretir.
 * Ayırıcı olarak NOKTALI VİRGÜL kullanılır: Türkçe Excel'de ondalık ayırıcı
 * virgül olduğu için virgüllü CSV sütunlara doğru bölünmez.
 */
export function toCsv(header: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const lines = [header.map(cell).join(';'), ...rows.map((r) => r.map(cell).join(';'))];
  // BOM: Excel'in UTF-8'i (Türkçe karakterler) doğru okuması için gerekli.
  return '﻿' + lines.join('\r\n');
}

/** Dosya adında kullanılamayacak karakterleri temizler. */
function safeName(name: string): string {
  return name.replace(/[^\w.-]+/g, '_').slice(0, 60) || 'disa-aktarim';
}

/**
 * CSV'yi paylaş. Başarılıysa true döner.
 * @param fileName uzantısız dosya adı (örn. "gelir-gider-2026-08")
 */
export async function shareCsv(fileName: string, csv: string, title: string): Promise<boolean> {
  const name = `${safeName(fileName)}.csv`;
  // Önce dosya olarak paylaşmayı dene (iOS): muhasebeci Excel'de açabilsin.
  if (Platform.OS === 'ios') {
    try {
      const file = new File(Paths.cache, name);
      file.create({ overwrite: true });
      file.write(csv);
      await Share.share({ url: file.uri, title });
      return true;
    } catch {
      // dosya yolu başarısızsa metne düş
    }
  }
  try {
    await Share.share({ message: csv, title });
    return true;
  } catch {
    return false;
  }
}
