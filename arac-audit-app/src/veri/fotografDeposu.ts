// HATA FOTOĞRAFLARI — kalıcı klasör (26.10.2026).
//
// Küçültülen fotoğraf (cekirdek/goruntu.ts → expo-image-manipulator) ÖNBELLEK
// klasörüne yazılıyordu ve veritabanı o adresi tutuyordu. Android önbelleği
// yer darlığında ya da "önbelleği temizle" ile siler: kanıt fotoğrafı sessizce
// kaybolurdu. Dış değerlendirmede kalite müdürü engelleyici saydı; kodda
// doğrulandı (cihazda denenmedi). Artık fotoğraf uygulamanın BELGE klasörüne
// taşınır; eski kayıtlar açılışta bir kez taşınır.
//
// Web'de (yalnız sınav) dosya sistemi yok: adres olduğu gibi kalır.

import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { fotografAdresleri, fotografAdresiGuncelle } from '@/veri/depo';

const web = Platform.OS === 'web';
const KLASOR = 'fotograflar';

/** Önbellekteki (ya da herhangi bir geçici) dosyayı belge klasörüne taşır, yeni adresi döndürür. */
export async function fotografiKaliciyaAl(uri: string, ad: string): Promise<string> {
  if (web) return uri;
  const klasor = new Directory(Paths.document, KLASOR);
  klasor.create({ intermediates: true, idempotent: true });
  const hedef = new File(klasor, `${ad}.jpg`);
  // move() bu sürümde Promise döndürür; beklenmezse adres taşıma bitmeden yazılır.
  await new File(uri).move(hedef);
  return hedef.uri;
}

/** Belge klasöründe olmayan eski fotoğrafları bir kez taşır. Hata olursa sessiz: sonraki açılışta yine dener. */
export async function eskiFotograflariTasi(): Promise<{ tasinan: number; bulunamayan: number }> {
  if (web) return { tasinan: 0, bulunamayan: 0 };
  const belge = Paths.document.uri;
  let tasinan = 0;
  let bulunamayan = 0;
  for (const f of await fotografAdresleri()) {
    if (f.uri.startsWith(belge)) continue;
    try {
      if (!new File(f.uri).exists) { bulunamayan++; continue; }
      const yeni = await fotografiKaliciyaAl(f.uri, f.id);
      await fotografAdresiGuncelle(f.id, yeni);
      tasinan++;
    } catch { /* bir sonraki açılışta yeniden denenir */ }
  }
  return { tasinan, bulunamayan };
}
