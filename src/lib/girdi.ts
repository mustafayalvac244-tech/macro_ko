import { Platform } from 'react-native';
import { File } from 'expo-file-system';
// Saf parçalar ayrı modülde: react-native çeken bu dosya test edilemiyor
// (aynı sebeple csvMetni.ts ve planlar.ts de ayrılmıştı).
import { base64OnEkiniKirp, baytlariBase64 } from '@/utils/base64Metni';

/**
 * SEÇİLEN DOSYAYI OKUMA — platformdan bağımsız.
 *
 * BULUNAN KUSUR (13.09.2026, kullanıcı bildirdi: "bir şey açmıyor gibi").
 * Dosya okuyan dört yer de `new File(asset.uri)` çağırıyordu. Bu sınıf
 * `expo-file-system`ten geliyor ve WEB'DE GERÇEK BİR UYGULAMASI YOK:
 * node_modules/expo-file-system/src/ExpoFileSystem.web.ts içinde yalnız
 *
 *     class FileSystemFile { constructor() { console.warn('expo-file-system
 *       is not supported on web'); } }
 *
 * duruyor — yani `.text()`, `.base64()`, `.arrayBuffer()` metotları HİÇ YOK.
 * Tarayıcıda dosya seçici açılıyor, kullanıcı dosyasını seçiyor, sonra çağrı
 * `TypeError` ile düşüyor ve ekran "dosya okunamadı" diyor. Etkilenen yerler:
 * belge inceleme, belgeden dosya açma, belge yükleme, profil fotoğrafı.
 *
 * Bu, bugün TEK kullanılabilir platformun (mağazalarda uygulama yok) dosyayla
 * ilgili her işini kapatıyordu.
 *
 * WEB'DE DOĞRU YOL ZATEN ELDE. `expo-document-picker`ın web karşılığı
 * (ExpoDocumentPicker.web.ts) seçilen dosyayı bir `blob:` adresi olarak verir
 * ve DOM'un kendi `File` nesnesini `asset.file` alanında da döndürür. İkisi de
 * tarayıcının standart API'leriyle okunur; yeni bir paket gerekmez.
 *
 * NEDEN AYRI MODÜL. Aynı üç satırın dört ekranda tekrarlanması bu arızanın
 * sebebiydi: `new File(...)` dört yere ayrı ayrı yazılmıştı ve hiçbirinde
 * platform sorulmuyordu. Tek sahip olunca, bir sonraki platform farkı bir
 * kez çözülür. tests/girdiOkuma.test.ts saf kısımları sınıyor.
 */

/** `expo-document-picker`ın döndürdüğü varlıktan ihtiyacımız olan alanlar. */
export interface SecilenDosya {
  uri: string;
  name?: string | null;
  mimeType?: string | null;
  /** Yalnız web: tarayıcının kendi File nesnesi (Blob). */
  file?: unknown;
}

const webMi = Platform.OS === 'web';

/**
 * Web'de seçilen varlığı bir Blob'a çevirir.
 *
 * İki yol var ve ikisi de gerekli: `asset.file` doğrudan Blob'dur (hızlı yol),
 * ama picker'ın bazı çağrılarında bu alan gelmez — o zaman `blob:` adresi
 * `fetch` ile okunur. Tek yola güvenmek, farkı ancak kullanıcıda görmek olur.
 */
async function webBlob(asset: SecilenDosya): Promise<Blob> {
  const dosya = asset.file;
  if (dosya && typeof Blob !== 'undefined' && dosya instanceof Blob) return dosya;
  const yanit = await fetch(asset.uri);
  return await yanit.blob();
}

/** Dosyanın METNİ (düz metin dosyaları için). */
export async function dosyaMetni(asset: SecilenDosya): Promise<string> {
  if (!webMi) return await new File(asset.uri).text();
  return await (await webBlob(asset)).text();
}

/**
 * Dosyanın HAM base64'ü — `data:` ön eki OLMADAN.
 *
 * Ön ek meselesi sessiz bir tuzak: natifte `File.base64()` ham base64 verir ve
 * uç işlevi (doc-extract) de ham base64 bekler. Tarayıcının `FileReader`ı ise
 * "data:application/pdf;base64,JVBERi0..." verir. Ön ek kırpılmazsa sunucu
 * çözemez ve `bad_base64` döner — kullanıcıya "dosya bozuk" gibi görünür,
 * oysa dosya sağlamdır.
 */
export async function dosyaBase64(asset: SecilenDosya): Promise<string> {
  // Kırpma İKİ YOLDA DA uygulanıyor. Bugün natif yol ham base64 veriyor, yani
  // kırpma orada bir şey yapmıyor. Bilerek böyle: bu işlevin sözü "her zaman
  // ham base64" ve o söz, altındaki kitaplığın davranışına bırakılmamalı —
  // kitaplık bir gün ön ekli döndürürse arıza sunucuda "dosya bozuk" diye
  // görünür ve sebebi burada aranmaz.
  if (!webMi) return base64OnEkiniKirp(await new File(asset.uri).base64());
  const blob = await webBlob(asset);
  const tampon = await blob.arrayBuffer();
  return base64OnEkiniKirp(baytlariBase64(new Uint8Array(tampon)));
}

/** Dosyanın ham baytları (depolamaya yükleme için). */
export async function dosyaBaytlari(asset: SecilenDosya): Promise<ArrayBuffer> {
  if (!webMi) return await new File(asset.uri).arrayBuffer();
  return await (await webBlob(asset)).arrayBuffer();
}

// Çağrı yerleri tek yerden alsın diye buradan da dışa veriliyor.
export { base64OnEkiniKirp, baytlariBase64 };
