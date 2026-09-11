// UDF DIŞA AKTARMA — üretilen dilekçeyi UYAP formatında kullanıcıya verir.
// ---------------------------------------------------------------------------
// Biçimi src/lib/udf.ts üretiyor; burası yalnız "dosyayı kullanıcıya nasıl
// ulaştırırız" sorusunu çözüyor. İki yol, çünkü platformlar farklı:
//
//   WEB     → doğrudan indirme (ikili, BOM'suz — bkz. cikti.ts > baytIndir).
//   NATİF   → önbelleğe yaz, OS paylaşım sayfasını aç. Avukat oradan
//             "Dosyalar"a kaydeder ya da kendine e-postayla yollar.
//
// exportCsv.ts'te kurulan düzenin aynısı ve aynı sebeple: YERLİ MODÜL
// EKLEMİYORUZ. expo-file-system zaten kurulu; yeni bir natif paket OTA ile
// inmez, mağaza derlemesi gerektirirdi.
import { Platform, Share } from 'react-native';
import { File, Paths } from 'expo-file-system';
import { baytIndir, type CiktiSonuc } from '@/lib/cikti';
import { udfDosyaAdi, udfUret } from '@/lib/udf';

/** UYAP'ın kendi MIME türü yok; ikili akış olarak veriliyor. */
const UDF_MIME = 'application/octet-stream';

/**
 * Metni UDF'ye çevirip kullanıcıya verir.
 *
 * @param metin  dilekçe metni
 * @param baslik dosya adında kullanılacak başlık
 */
export async function udfDisaAktar(metin: string, baslik: string): Promise<CiktiSonuc> {
  let baytlar: Uint8Array;
  try {
    baytlar = udfUret(metin);
  } catch {
    return 'hata';
  }
  const ad = udfDosyaAdi(baslik);

  if (Platform.OS === 'web') return baytIndir(baytlar, ad, UDF_MIME);

  try {
    const dosya = new File(Paths.cache, ad);
    dosya.create({ overwrite: true });
    dosya.write(baytlar);
    await Share.share({ url: dosya.uri, title: ad });
    return 'paylasildi';
  } catch {
    // METNE DÜŞMÜYORUZ. CSV'de metne düşmek doğruydu (muhasebeci veriyi yine
    // alır); burada düşülse avukat UDF sandığı bir metin alır ve UYAP'a
    // yükleyemez. Sessiz yanlış sonuç yerine görünür hata.
    return 'hata';
  }
}
