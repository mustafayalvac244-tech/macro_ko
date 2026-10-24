// TAM YEDEK — bütün tablolar + fotoğraflar, tek zip.
//
// NEDEN (24.10.2026): kayıtlar yalnız cihazda (merkezi sunucu yok). Telefon
// kaybolursa, sıfırlanırsa ya da uygulama kaldırılırsa her denetim gider.
// Benzer uygulamalar (SafetyCulture, Infor) veriyi sunucuda tutar; bizde
// onun yerine geçen tek şey elle alınan yedek. Zip "store" (sıkıştırmasız;
// zip.ts) — fotoğraflar zaten JPEG, metin küçük.
//
// GERİ YÜKLEME YOK (henüz): yedeği okuyup veritabanının üstüne yazmak,
// yanlış dosyayla bütün kayıtları silebilir; o özellik ayrıca tasarlanmalı.
// Bugün yedek, dosyayı Drive/mail'e koyup saklamak içindir; veri.json düz
// metin, fotoğraflar klasörde — bir geliştirici elle geri koyabilir.

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { zipOlustur, ZipGirdisi } from '@/cekirdek/zip';
import { yedekVerisi } from '@/veri/depo';

export interface YedekSonucu {
  uri: string;
  dosyaAdi: string;
  denetim: number;
  hata: number;
  foto: number;
  /** Kaydı var ama dosyası okunamayan fotoğraf (cihaz temizliği). */
  eksikFoto: number;
  bayt: number;
  paylasildi: boolean;
}

export const YEDEK_BICIM_SURUMU = 1;

export async function yedekOlustur(simdi: Date = new Date()): Promise<YedekSonucu> {
  const tablolar = await yedekVerisi();
  const dosyalar: ZipGirdisi[] = [{
    ad: 'veri.json',
    veri: JSON.stringify({ uygulama: 'arac-audit', bicim: YEDEK_BICIM_SURUMU, tarih: simdi.toISOString(), tablolar }, null, 1),
  }];

  let eksikFoto = 0;
  for (const f of tablolar.fotograflar as { id: string; uri: string }[]) {
    try {
      dosyalar.push({ ad: `fotograflar/${f.id}.jpg`, veri: await new File(f.uri).bytes() });
    } catch {
      eksikFoto += 1;
    }
  }

  const zip = zipOlustur(dosyalar, simdi);
  const iki = (n: number) => String(n).padStart(2, '0');
  const dosyaAdi = `arac-audit-yedek_${simdi.getFullYear()}${iki(simdi.getMonth() + 1)}${iki(simdi.getDate())}_${iki(simdi.getHours())}${iki(simdi.getMinutes())}.zip`;
  const dosya = new File(Paths.cache, dosyaAdi);
  if (dosya.exists) dosya.delete();
  dosya.create();
  dosya.write(zip);

  let paylasildi = false;
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(dosya.uri, { mimeType: 'application/zip', dialogTitle: 'Yedeği kaydet / paylaş' });
    paylasildi = true;
  }

  return {
    uri: dosya.uri,
    dosyaAdi,
    denetim: tablolar.denetimler.length,
    hata: tablolar.hatalar.length,
    foto: dosyalar.length - 1,
    eksikFoto,
    bayt: zip.byteLength,
    paylasildi,
  };
}
