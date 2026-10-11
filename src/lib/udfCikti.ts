// UDF DIŞA AKTARMA — üretilen dilekçeyi UYAP formatında kullanıcıya verir.
// ---------------------------------------------------------------------------
// Biçimi src/lib/udf.ts üretiyor; burası yalnız "dosyayı kullanıcıya nasıl
// ulaştırırız" sorusunu çözüyor. İki yol, çünkü platformlar farklı:
//
//   WEB     → doğrudan indirme (ikili, BOM'suz — bkz. cikti.ts > baytIndir).
//   iOS     → önbelleğe yaz, OS paylaşım sayfasını aç. Avukat oradan
//             "Dosyalar"a kaydeder ya da kendine e-postayla yollar.
//   ANDROID → klasör seçtirip dosyayı oraya yaz. Paylaşım sayfası KULLANILAMAZ:
//             react-native'in Share.share'i Android'de `url`'yi YOK SAYAR
//             (node_modules/react-native/Libraries/Share/Share.js: Android'e
//             yalnız title + message geçer). Eskiden Android'de UDF düğmesi
//             boş bir paylaşım açıyor ve "paylaşıldı" sayıyordu (09.10.2026).
//             Dosya bir klasöre yazılınca avukat onu Dosyalar'dan açıp
//             e-postayla gönderebilir ya da UYAP'a yükleyebilir.
//             CİHAZDA DENENMEDİ (bu ortamda Android yok); hata olursa kullanıcı
//             "Olmadı" görür, sessiz başarısızlık yok.
//
// exportCsv.ts'te kurulan düzenin aynısı ve aynı sebeple: YERLİ MODÜL
// EKLEMİYORUZ. expo-file-system zaten kurulu; yeni bir natif paket OTA ile
// inmez, mağaza derlemesi gerektirirdi.
import { Platform, Share } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
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
  if (Platform.OS === 'android') return androidKaydet(baytlar, ad);

  try {
    const dosya = new File(Paths.cache, ad);
    dosya.create({ overwrite: true });
    dosya.write(baytlar);
    const r = await Share.share({ url: dosya.uri, title: ad });
    return r?.action === Share.dismissedAction ? 'iptal' : 'paylasildi';
  } catch {
    // METNE DÜŞMÜYORUZ. CSV'de metne düşmek doğruydu (muhasebeci veriyi yine
    // alır); burada düşülse avukat UDF sandığı bir metin alır ve UYAP'a
    // yükleyemez. Sessiz yanlış sonuç yerine görünür hata.
    return 'hata';
  }
}

/**
 * Android: kullanıcıya klasör seçtirir (sistem seçicisi), UDF'yi oraya yazar.
 * MIME `application/octet-stream` ve ad `.udf` ile bitiyor: uzantı sistemde
 * tanınmadığı için ad olduğu gibi kalır (TAHMİN: Android'in belge sağlayıcıları
 * bilinmeyen uzantıda octet-stream ile eşleşen adı değiştirmez; cihazda
 * doğrulanmadı).
 */
async function androidKaydet(baytlar: Uint8Array, ad: string): Promise<CiktiSonuc> {
  try {
    const klasor = await Directory.pickDirectoryAsync();
    const dosya = klasor.createFile(ad, UDF_MIME);
    dosya.write(baytlar);
    return 'indirildi';
  } catch (e) {
    // Seçici kapatıldı: hata değil (expo-file-system PickerCancelledException,
    // "The file picker was cancelled by the user").
    const e2 = e as { message?: string; code?: string } | null;
    return /cancel/i.test(`${e2?.code ?? ''} ${e2?.message ?? ''}`) ? 'iptal' : 'hata';
  }
}
