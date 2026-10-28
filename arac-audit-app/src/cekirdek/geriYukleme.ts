// YEDEKTEN GERİ YÜKLEME — saf hesap (26.10.2026).
//
// Dış değerlendirmede saha denetçisi ve kalite müdürü: "yedek var ama geri
// yükleme yok; telefon giderse vardiyanın kaydı gider". Yedek (veri/yedek.ts)
// bir zip: veri.json (bütün tablolar) + fotograflar/<id>.jpg.
//
// KURAL: geri yükleme EKLER, DEĞİŞTİRMEZ. Aynı kimlikli kayıt telefonda varsa
// telefondaki kalır (INSERT OR IGNORE). Böylece yanlış dosyayla geri yükleme
// mevcut veriyi bozamaz; aynı yedeği iki kez yüklemek bir şey değiştirmez.
// Yedekte olup bugünkü tabloda olmayan sütun atlanır; yedekte olmayan sütun
// tablonun varsayılanını alır (eski sürümün yedeği de yüklenir).

import { KullaniciHatasi } from './hataMetni';

export const YEDEK_UYGULAMA = 'arac-audit';

/** Sıra yabancı anahtarlara göre: önce denetim, sonra ona bağlı satırlar. */
export const GERI_YUKLEME_SIRASI = [
  'denetimler', 'hatalar', 'fotograflar', 'denetim_kapsam',
  'ozel_hata_tipleri', 'kalip_sayaci', 'ayarlar', 'degisiklik_gunlugu',
] as const;

export type Satir = Record<string, unknown>;

export interface YedekIcerigi { tarih: string; tablolar: Record<string, Satir[]> }

/** veri.json'u doğrular. Başka uygulamanın ya da bozuk dosyanın açıklayıcı hatası olur. */
export function yedekIceriginiCoz(json: unknown): YedekIcerigi {
  if (!json || typeof json !== 'object') throw new KullaniciHatasi('Yedek dosyası okunamadı (veri.json boş).', 'The backup file could not be read (veri.json is empty).');
  const o = json as { uygulama?: unknown; bicim?: unknown; tarih?: unknown; tablolar?: unknown };
  if (o.uygulama !== YEDEK_UYGULAMA) throw new KullaniciHatasi('Bu dosya Araç Audit yedeği değil.', 'This file is not an Araç Audit backup.');
  if (typeof o.bicim !== 'number' || o.bicim > 1) {
    throw new KullaniciHatasi(`Yedek biçimi tanınmıyor (${String(o.bicim)}); uygulamayı güncelleyin.`, `Backup format not recognised (${String(o.bicim)}); update the app.`);
  }
  if (!o.tablolar || typeof o.tablolar !== 'object') throw new KullaniciHatasi('Yedekte tablo yok.', 'The backup contains no tables.');
  const tablolar: Record<string, Satir[]> = {};
  for (const [ad, satirlar] of Object.entries(o.tablolar as Record<string, unknown>)) {
    if (Array.isArray(satirlar)) tablolar[ad] = satirlar.filter((x): x is Satir => !!x && typeof x === 'object');
  }
  return { tarih: typeof o.tarih === 'string' ? o.tarih : '', tablolar };
}

export interface EklemeKomutu { tablo: string; sql: string; degerler: (string | number | null)[] }

/**
 * Yedekteki satırları INSERT OR IGNORE komutlarına çevirir.
 * `sutunlar`: telefondaki tabloların sütunları (PRAGMA table_info); listede
 * olmayan tablo atlanır. `fotoAdresi`: fotoğraf kimliği → yedekten çıkarılıp
 * yazılan dosyanın yeni adresi (yoksa '' — kayıt kalır, dosyası eksik görünür).
 */
export function eklemeKomutlari(
  icerik: YedekIcerigi,
  sutunlar: Record<string, readonly string[]>,
  fotoAdresi: (fotoId: string) => string | null,
): EklemeKomutu[] {
  const komutlar: EklemeKomutu[] = [];
  for (const tablo of GERI_YUKLEME_SIRASI) {
    const izinli = sutunlar[tablo];
    const satirlar = icerik.tablolar[tablo];
    if (!izinli || !satirlar) continue;
    for (const ham of satirlar) {
      const satir: Satir = { ...ham };
      if (tablo === 'fotograflar') satir.uri = fotoAdresi(String(satir.id ?? '')) ?? '';
      // DEĞİŞİKLİK GÜNLÜĞÜ (26.10.2026, 2. dış değerlendirme): `id` her telefonda
      // 1'den sayan AUTOINCREMENT; başka telefonun yedeği yüklenince aynı numaralı
      // satırlar INSERT OR IGNORE ile sessizce düşüyordu (2 satırın 2'si). Kimlik
      // yazılmaz, telefon yenisini verir; aynı olay (zaman, kayıt, tür, denetim)
      // zaten varsa eklenmez — aynı yedeği ikinci kez yüklemek çoğaltmaz.
      const gunluk = tablo === 'degisiklik_gunlugu';
      const anahtarlar = Object.keys(satir).filter((k) => izinli.includes(k) && !(gunluk && k === 'id'));
      if (!anahtarlar.length) continue;
      const deger = (k: string) => {
        const v = satir[k];
        if (v === null || v === undefined) return null;
        if (typeof v === 'number' || typeof v === 'string') return v;
        if (typeof v === 'boolean') return v ? 1 : 0;
        return JSON.stringify(v);
      };
      if (gunluk) {
        const olay = ['zaman', 'kayit_id', 'tur', 'denetim_id'];
        komutlar.push({
          tablo,
          sql: `INSERT INTO ${tablo} (${anahtarlar.join(', ')}) SELECT ${anahtarlar.map(() => '?').join(', ')}`
            + ` WHERE NOT EXISTS (SELECT 1 FROM ${tablo} WHERE ${olay.map((k) => `${k} IS ?`).join(' AND ')})`,
          degerler: [...anahtarlar.map(deger), ...olay.map(deger)],
        });
        continue;
      }
      komutlar.push({
        tablo,
        sql: `INSERT OR IGNORE INTO ${tablo} (${anahtarlar.join(', ')}) VALUES (${anahtarlar.map(() => '?').join(', ')})`,
        degerler: anahtarlar.map(deger),
      });
    }
  }
  return komutlar;
}
