import { Platform, Share } from 'react-native';
import { File, Paths } from 'expo-file-system';
import { toCsv } from '@/utils/csvMetni';

// CSV metni üretimi saf modüle taşındı (test edilebilsin diye); çağrı
// yerleri değişmesin diye buradan da dışa veriliyor.
export { toCsv };

/**
 * CSV dışa aktarma — muhasebeciye/vergi için veriyi uygulamadan çıkarır.
 *
 * Yerli modül eklemeden çalışır (OTA güvenli): dosyayı expo-file-system ile
 * önbelleğe yazar, iOS'ta dosyayı paylaşır. Dosya paylaşımı desteklenmezse
 * (Android'de Share yalnız metin alır) CSV metni olarak paylaşır — böylece
 * kullanıcı her koşulda verisine ulaşır.
 */

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
