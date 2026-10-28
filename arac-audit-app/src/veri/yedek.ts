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

import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { aktarilacaklar, AktarimSecimi, VARSAYILAN_AKTARIM } from '@/cekirdek/aktarim';
import { ElleEsleme, GonderimIzi, GonderimKaydi } from '@/cekirdek/ekipExceli';
import { Denetim } from '@/cekirdek/tipler';
import { nasSayfalari } from '@/cekirdek/nas';
import { xlsxOlustur } from '@/cekirdek/xlsx';
import { eklemeKomutlari, GERI_YUKLEME_SIRASI, yedekIceriginiCoz } from '@/cekirdek/geriYukleme';
import { zipOku, zipOlustur, ZipGirdisi } from '@/cekirdek/zip';
import { ayarOku, ayarYaz, tabloSutunlari, tumDenetimler, yedektenEkle, yedekVerisi } from '@/veri/depo';

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

export interface NasSonucu {
  uri: string; denetim: number; problem: number; paylasildi: boolean;
  /** Seçilen dönemde olup bitmediği için aktarılmayan denetim. */
  disaridaDevam: number;
}

/**
 * EXCEL'E AKTAR (26.10.2026): bütün denetimler ekibin Excel'indeki iki liste
 * sayfasının sütunlarıyla (nas.ts → nasSayfalari). Fotoğraf dosyaya GÖMÜLMEZ
 * — yüzlerce fotoğraf dosyayı paylaşılamayacak kadar büyütür; PHOTO LINK
 * sütunu tam yedekteki dosya adlarını yazar.
 */
export async function nasExcelOlustur(
  simdi: Date = new Date(), secim: AktarimSecimi = VARSAYILAN_AKTARIM,
): Promise<NasSonucu> {
  const { secilen: denetimler, disaridaDevam } = aktarilacaklar(await tumDenetimler(), secim, simdi);
  // Boş dosya paylaşılmaz: "aktarıldı" sanılıp ekibe boş tablo gitmesin.
  if (!denetimler.length) return { uri: '', denetim: 0, problem: 0, paylasildi: false, disaridaDevam };
  const kitap = xlsxOlustur(nasSayfalari(denetimler), { baslik: 'NAS — Araç Audit', tarih: simdi });
  const iki = (n: number) => String(n).padStart(2, '0');
  const dosya = new File(Paths.cache, `NAS_arac-audit_${simdi.getFullYear()}${iki(simdi.getMonth() + 1)}${iki(simdi.getDate())}_${iki(simdi.getHours())}${iki(simdi.getMinutes())}.xlsx`);
  if (dosya.exists) dosya.delete();
  dosya.create();
  dosya.write(kitap);

  let paylasildi = false;
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(dosya.uri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Excel dosyasını paylaş',
    });
    paylasildi = true;
  }
  return {
    uri: dosya.uri,
    denetim: denetimler.length,
    problem: denetimler.reduce((t, d) => t + (d.hatalar?.length ?? 0), 0),
    paylasildi,
    disaridaDevam,
  };
}

export interface GeriYuklemeSonucu {
  /** Kullanıcı dosya seçmeden kapattı. */
  iptal: boolean;
  yedekTarihi: string;
  denetim: number; hata: number; foto: number;
  /** Yedekte olup telefonda zaten olduğu için dokunulmayan denetim. */
  zatenVarDenetim: number;
}

/**
 * Yedekten geri yükleme (26.10.2026). Zip seçilir; fotoğraflar belge
 * klasörüne yazılır, kayıtlar EKLENİR — aynı kimlikli kayıt telefonda varsa
 * telefondaki kalır (cekirdek/geriYukleme.ts). Hepsi tek veritabanı işleminde.
 */
export async function yedekGeriYukle(): Promise<GeriYuklemeSonucu> {
  const secim = await File.pickFileAsync({ mimeTypes: ['application/zip', 'application/octet-stream'] });
  const dosya = secim.canceled ? null : secim.result;
  if (!dosya) return { iptal: true, yedekTarihi: '', denetim: 0, hata: 0, foto: 0, zatenVarDenetim: 0 };

  const girdiler = zipOku(await dosya.bytes());
  const veri = girdiler.find((g) => g.ad === 'veri.json');
  if (!veri) throw new Error('Bu zip bir Araç Audit yedeği değil (veri.json yok).');
  const icerik = yedekIceriginiCoz(JSON.parse(new TextDecoder().decode(veri.veri)));

  // Fotoğraflar: belge klasörüne; aynı adlı dosya varsa üstüne yazılmaz.
  const klasor = new Directory(Paths.document, 'fotograflar');
  klasor.create({ intermediates: true, idempotent: true });
  const adresler = new Map<string, string>();
  for (const g of girdiler) {
    const m = /^fotograflar\/(.+)\.jpg$/.exec(g.ad);
    if (!m) continue;
    const hedef = new File(klasor, `${m[1]}.jpg`);
    if (!hedef.exists) { hedef.create(); hedef.write(g.veri); }
    adresler.set(m[1]!, hedef.uri);
  }

  const sutunlar = await tabloSutunlari(GERI_YUKLEME_SIRASI);
  const eklenen = await yedektenEkle(eklemeKomutlari(icerik, sutunlar, (id) => adresler.get(id) ?? null));
  const yedektekiDenetim = icerik.tablolar.denetimler?.length ?? 0;
  return {
    iptal: false,
    yedekTarihi: icerik.tarih,
    denetim: eklenen.denetimler ?? 0,
    hata: eklenen.hatalar ?? 0,
    foto: eklenen.fotograflar ?? 0,
    zatenVarDenetim: yedektekiDenetim - (eklenen.denetimler ?? 0),
  };
}

// --- EKİBİN EXCEL'İNE EKLE (27.10.2026) ---------------------------------------
// Doldurmanın kendisi saf işlev: cekirdek/ekipExceli.ts. Burada yalnız dosya
// seçme, paylaşma ve kullanıcının düzelttiği eşlemelerin saklanması.

export interface SecilenDosya { ad: string; bayt: Uint8Array }

interface WebDosyaGirdisi {
  type: string; accept: string; files: ArrayLike<{ name: string; arrayBuffer(): Promise<ArrayBuffer> }> | null;
  onchange: (() => void) | null; oncancel: (() => void) | null; click(): void;
}
interface WebBelge {
  createElement(ad: 'input'): WebDosyaGirdisi;
  createElement(ad: 'a'): { href: string; download: string; click(): void };
}
const webBelgesi = () => (globalThis as { document?: WebBelge }).document;

/**
 * Ekibin Excel dosyasını seçtirir; vazgeçilirse null. Telefonda sistemin dosya
 * seçicisi (.xlsm'in türü sağlayıcıya göre değiştiği için tür süzülmez — yanlış
 * dosya doldurmada açık hatayla reddedilir). Web'de tarayıcının dosya penceresi:
 * expo-file-system'in web'de seçicisi yok.
 */
export async function ekipDosyasiSec(): Promise<SecilenDosya | null> {
  const belge = webBelgesi();
  if (Platform.OS === 'web' && belge) {
    return new Promise((coz, reddet) => {
      const girdi = belge.createElement('input');
      girdi.type = 'file';
      girdi.accept = '.xlsm,.xlsx,application/vnd.ms-excel.sheet.macroEnabled.12,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      girdi.onchange = () => {
        const f = girdi.files?.[0];
        if (!f) { coz(null); return; }
        f.arrayBuffer().then((b) => coz({ ad: f.name, bayt: new Uint8Array(b) }), reddet);
      };
      girdi.oncancel = () => coz(null);
      girdi.click();
    });
  }
  const secim = await File.pickFileAsync({ mimeTypes: ['*/*'] });
  const dosya = secim.canceled ? null : secim.result;
  if (!dosya) return null;
  return { ad: dosya.name, bayt: await dosya.bytes() };
}

/** Doldurulacak denetimler — "Excel'e aktar" ile aynı seçim (dönem, devam edenler). */
export async function ekipDenetimleri(secim: AktarimSecimi, simdi: Date = new Date()): Promise<{ secilen: Denetim[]; disaridaDevam: number }> {
  return aktarilacaklar(await tumDenetimler(), secim, simdi);
}

const ESLEME_AYARI = 'ekip_excel_esleme';

/** Kullanıcının düzelttiği parça/tip eşlemeleri — bu telefonda saklanır, sonraki doldurmalarda da geçerli. */
export const elleEslemeOku = (): Promise<ElleEsleme> => ayarOku<ElleEsleme>(ESLEME_AYARI, {});
export const elleEslemeYaz = (e: ElleEsleme): Promise<void> => ayarYaz(ESLEME_AYARI, e);

const GONDERIM_AYARI = 'ekip_excel_gonderim';

/**
 * Ekibe gönderilmiş hataların izi (28.10.2026, ekipExceli.ts → GonderimIzi):
 * eşleme ya da kayıt sonradan değişse de aynı hata ikinci kez eklenmesin,
 * değişen "elle düzeltin" diye gösterilsin. Yalnız dosya PAYLAŞILINCA yazılır:
 * doldurup vazgeçmek gönderim sayılmaz.
 */
export const gonderimKaydiOku = (): Promise<GonderimKaydi> => ayarOku<GonderimKaydi>(GONDERIM_AYARI, {});
export async function gonderimKaydiEkle(yeni: Readonly<Record<string, GonderimIzi>>): Promise<void> {
  if (!Object.keys(yeni).length) return;
  await ayarYaz(GONDERIM_AYARI, { ...(await gonderimKaydiOku()), ...yeni });
}

/**
 * Doldurulmuş dosyayı SEÇİLEN ADLA paylaşır: NAS'taki dosyanın yerine
 * konabilsin. Web'de indirme olarak verilir.
 */
export async function ekipDosyasiniPaylas(ad: string, bayt: Uint8Array): Promise<{ uri: string; paylasildi: boolean }> {
  const makrolu = /\.xlsm$/i.test(ad);
  const tur = makrolu ? 'application/vnd.ms-excel.sheet.macroEnabled.12' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const belge = webBelgesi();
  if (Platform.OS === 'web' && belge) {
    const url = URL.createObjectURL(new Blob([bayt as Uint8Array<ArrayBuffer>], { type: tur }));
    const a = belge.createElement('a');
    a.href = url; a.download = ad; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return { uri: url, paylasildi: true };
  }
  const klasor = new Directory(Paths.cache, 'ekip-excel');
  klasor.create({ intermediates: true, idempotent: true });
  const dosya = new File(klasor, ad.replace(/[\\/:*?"<>|]/g, '_') || 'NAS.xlsm');
  if (dosya.exists) dosya.delete();
  dosya.create();
  dosya.write(bayt);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(dosya.uri, { mimeType: tur, dialogTitle: 'Doldurulmuş Excel dosyasını kaydet / paylaş' });
    return { uri: dosya.uri, paylasildi: true };
  }
  return { uri: dosya.uri, paylasildi: false };
}
