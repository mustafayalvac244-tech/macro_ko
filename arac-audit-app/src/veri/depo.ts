// YEREL DEPO — SQLite.
//
// NEDEN SQLITE, ANAHTAR-DEĞER DEĞİL: denetim artık tek cihazda bitmiyor.
// Sunucuya gidecek, geri gelecek, yönetici panosunda toplanacak. Bunun için
// her kaydın kendi satırı, kendi güncelleme damgası ve senkron durumu olmalı.
// Hataları denetimin içine JSON olarak gömmek, iki denetçi aynı aracı
// düzenlediğinde birinin kaydını sessizce silerdi.
//
// SENKRON İLKESİ: yazma her zaman ÖNCE buraya olur. Sunucu erişilemezse
// denetim kesintisiz sürer; `senkron_zamani` boş kalan satırlar bağlantı
// gelince gönderilir.

import * as SQLite from 'expo-sqlite';

import { Denetim, Hata, HataTipi } from '@/cekirdek/tipler';

const VERITABANI = 'arac-audit.db';

let _db: Promise<SQLite.SQLiteDatabase> | null = null;

export function db(): Promise<SQLite.SQLiteDatabase> {
  if (!_db) _db = ac();
  return _db;
}

async function ac(): Promise<SQLite.SQLiteDatabase> {
  const d = await SQLite.openDatabaseAsync(VERITABANI);
  // WAL: yazma sırasında okuma bloklanmasın. Denetim ekranı, arka planda
  // senkron çalışırken de akıcı kalmalı.
  await d.execAsync('PRAGMA journal_mode = WAL;');
  await d.execAsync('PRAGMA foreign_keys = ON;');
  await gocleriUygula(d);
  return d;
}

/**
 * Şema göçleri. Sürüm `user_version` içinde tutulur; her göç YALNIZ BİR KEZ
 * ve sırayla çalışır. Yeni sürüm eklerken diziye EKLE, var olanı DEĞİŞTİRME —
 * değiştirilen bir göç, sahadaki cihazlarda hiç çalışmaz.
 *
 * TOPLU YENİDEN ADLANDIRMA BU DİZİYE DOKUNMAMALI (16.09.2026'da oldu):
 * `siddet` → `derece` geçişinde dosya genelinde yapılan bul-değiştir, göç 1 ve
 * 2'deki sütun adını da değiştirdi. Sonuç: yeni kurulumda göç 1 zaten `derece`
 * yarattı, göç 3'teki `RENAME COLUMN siddet` sütun bulamayıp düştü ve uygulama
 * açılmadı. Eski göçlerdeki `siddet` adı KASITLIDIR — o gün tablo öyleydi.
 */
const GOCLER: string[] = [
  // 1 — ilk şema
  `
  CREATE TABLE IF NOT EXISTS denetimler (
    id            TEXT PRIMARY KEY NOT NULL,
    arac_id       TEXT NOT NULL,
    vin           TEXT NOT NULL,
    plaka         TEXT NOT NULL DEFAULT '',
    rapor_no      TEXT NOT NULL DEFAULT '',
    denetci       TEXT NOT NULL DEFAULT '',
    hat           TEXT NOT NULL DEFAULT '',
    vardiya       TEXT NOT NULL DEFAULT '',
    denetim_tipi  TEXT NOT NULL DEFAULT '',
    baslangic     TEXT NOT NULL,
    bitis         TEXT,
    durum         TEXT NOT NULL DEFAULT 'devam',
    guncelleme    TEXT NOT NULL,
    senkron_zamani TEXT
  );
  CREATE INDEX IF NOT EXISTS ix_denetim_baslangic ON denetimler(baslangic DESC);
  CREATE INDEX IF NOT EXISTS ix_denetim_vin ON denetimler(vin);
  CREATE INDEX IF NOT EXISTS ix_denetim_senkron ON denetimler(senkron_zamani);

  CREATE TABLE IF NOT EXISTS hatalar (
    id            TEXT PRIMARY KEY NOT NULL,
    denetim_id    TEXT NOT NULL REFERENCES denetimler(id) ON DELETE CASCADE,
    parca_id      TEXT NOT NULL,
    hata_tipi_id  TEXT NOT NULL,
    siddet        TEXT NOT NULL,
    adet          INTEGER NOT NULL DEFAULT 1,
    konum         TEXT NOT NULL DEFAULT '',
    aciklama      TEXT NOT NULL DEFAULT '',
    zaman         TEXT NOT NULL,
    durum         TEXT NOT NULL DEFAULT 'acik',
    atanan_kisi   TEXT,
    gideren       TEXT,
    giderilme_zamani TEXT,
    dogrulayan    TEXT,
    dogrulama_zamani TEXT,
    guncelleme    TEXT NOT NULL,
    senkron_zamani TEXT
  );
  CREATE INDEX IF NOT EXISTS ix_hata_denetim ON hatalar(denetim_id);
  CREATE INDEX IF NOT EXISTS ix_hata_senkron ON hatalar(senkron_zamani);

  CREATE TABLE IF NOT EXISTS fotograflar (
    id            TEXT PRIMARY KEY NOT NULL,
    denetim_id    TEXT NOT NULL REFERENCES denetimler(id) ON DELETE CASCADE,
    hata_id       TEXT,
    uri           TEXT NOT NULL,
    en            INTEGER NOT NULL DEFAULT 0,
    boy           INTEGER NOT NULL DEFAULT 0,
    zaman         TEXT NOT NULL,
    senkron_zamani TEXT
  );
  CREATE INDEX IF NOT EXISTS ix_foto_denetim ON fotograflar(denetim_id);
  CREATE INDEX IF NOT EXISTS ix_foto_hata ON fotograflar(hata_id);

  CREATE TABLE IF NOT EXISTS ayarlar (
    anahtar TEXT PRIMARY KEY NOT NULL,
    deger   TEXT NOT NULL
  );

  -- "Hatalar genelde benzer" — uygulama bunu öğrenir ve hızlı seçimi
  -- kullanım sıklığına göre yeniden sıralar.
  CREATE TABLE IF NOT EXISTS kalip_sayaci (
    kalip TEXT PRIMARY KEY NOT NULL,
    sayi  INTEGER NOT NULL DEFAULT 0,
    son   TEXT NOT NULL
  );
  `,

  // 2 — ekibin kendi eklediği hata tipleri.
  //
  // `silindi` var ama satır GERÇEKTEN silinmez: eski hatalar hata_tipi_id ile
  // buraya bağlı. Satırı silsek geçmiş raporlarda hata adı yerine ham kimlik
  // görünürdü. Kaldırılan tip seçim listesinden çıkar, indekste kalır.
  `
  CREATE TABLE IF NOT EXISTS ozel_hata_tipleri (
    id             TEXT PRIMARY KEY NOT NULL,
    grup           TEXT NOT NULL,
    ad             TEXT NOT NULL,
    en             TEXT NOT NULL DEFAULT '',
    siddet         TEXT NOT NULL DEFAULT 'C',
    ekleyen        TEXT NOT NULL DEFAULT '',
    silindi        INTEGER NOT NULL DEFAULT 0,
    zaman          TEXT NOT NULL,
    guncelleme     TEXT NOT NULL,
    senkron_zamani TEXT
  );
  `,

  // 3 — A/B/C + ceza puanı sistemi bırakıldı; ekibin kendi derecesine geçildi.
  //
  // Üç kademe (1/2/3) ve ayrı bir "kabul edilebilir" bayrağı var; bayrak açıkken
  // derece raporda parantezle yazılır: (3). Eski kayıtlar sıralama varsayımına
  // göre eşlendi — A en ağırdı, 3 en ağır kabul edildi.
  `
  ALTER TABLE hatalar RENAME COLUMN siddet TO derece;
  ALTER TABLE hatalar ADD COLUMN kabul_edilebilir INTEGER NOT NULL DEFAULT 0;
  UPDATE hatalar SET derece = CASE derece
    WHEN 'A' THEN '3' WHEN 'B' THEN '2' WHEN 'C' THEN '1' ELSE derece END;

  ALTER TABLE ozel_hata_tipleri RENAME COLUMN siddet TO derece;
  UPDATE ozel_hata_tipleri SET derece = CASE derece
    WHEN 'A' THEN '3' WHEN 'B' THEN '2' WHEN 'C' THEN '1' ELSE derece END;
  `,
];

async function gocleriUygula(d: SQLite.SQLiteDatabase): Promise<void> {
  const satir = await d.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  const mevcut = satir?.user_version ?? 0;
  for (let i = mevcut; i < GOCLER.length; i++) {
    await d.execAsync(GOCLER[i]!);
    await d.execAsync(`PRAGMA user_version = ${i + 1};`);
  }
}

export function kimlikUret(onEk = 'd'): string {
  return `${onEk}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const simdi = () => new Date().toISOString();

// --- DENETİM --------------------------------------------------------------

interface DenetimSatiri {
  id: string; arac_id: string; vin: string; plaka: string; rapor_no: string;
  denetci: string; hat: string; vardiya: string; denetim_tipi: string;
  baslangic: string; bitis: string | null; durum: string; senkron_zamani: string | null;
}

interface HataSatiri {
  id: string; denetim_id: string; parca_id: string; hata_tipi_id: string;
  derece: string; kabul_edilebilir: number; adet: number; konum: string; aciklama: string; zaman: string;
  durum: string; atanan_kisi: string | null; gideren: string | null;
  giderilme_zamani: string | null; dogrulayan: string | null; dogrulama_zamani: string | null;
}

function denetimeCevir(d: DenetimSatiri, hatalar: Hata[]): Denetim {
  return {
    id: d.id, aracId: d.arac_id, vin: d.vin, plaka: d.plaka, raporNo: d.rapor_no,
    denetci: d.denetci, hat: d.hat, vardiya: d.vardiya, denetimTipi: d.denetim_tipi,
    baslangic: d.baslangic, bitis: d.bitis, durum: d.durum as Denetim['durum'],
    senkronZamani: d.senkron_zamani, hatalar,
  };
}

function hataya(h: HataSatiri, fotograflar: string[]): Hata {
  return {
    id: h.id, parcaId: h.parca_id, hataTipiId: h.hata_tipi_id,
    derece: h.derece as Hata['derece'], kabulEdilebilir: h.kabul_edilebilir === 1,
    adet: h.adet, konum: h.konum,
    aciklama: h.aciklama, zaman: h.zaman, durum: h.durum as Hata['durum'],
    atananKisi: h.atanan_kisi, gideren: h.gideren, giderilmeZamani: h.giderilme_zamani,
    dogrulayan: h.dogrulayan, dogrulamaZamani: h.dogrulama_zamani,
    fotograflar,
  };
}

export async function denetimOlustur(
  girdi: Omit<Denetim, 'id' | 'hatalar' | 'bitis' | 'durum' | 'senkronZamani'>,
): Promise<Denetim> {
  const d = await db();
  const id = kimlikUret('d');
  await d.runAsync(
    `INSERT INTO denetimler (id, arac_id, vin, plaka, rapor_no, denetci, hat, vardiya,
       denetim_tipi, baslangic, bitis, durum, guncelleme, senkron_zamani)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'devam', ?, NULL)`,
    id, girdi.aracId, girdi.vin, girdi.plaka, girdi.raporNo, girdi.denetci,
    girdi.hat, girdi.vardiya, girdi.denetimTipi, girdi.baslangic, simdi(),
  );
  return { ...girdi, id, bitis: null, durum: 'devam', senkronZamani: null, hatalar: [] };
}

export async function denetimGetir(id: string): Promise<Denetim | null> {
  const d = await db();
  const satir = await d.getFirstAsync<DenetimSatiri>('SELECT * FROM denetimler WHERE id = ?', id);
  if (!satir) return null;
  return denetimeCevir(satir, await hatalariGetir(id));
}

export async function hatalariGetir(denetimId: string): Promise<Hata[]> {
  const d = await db();
  const satirlar = await d.getAllAsync<HataSatiri>(
    'SELECT * FROM hatalar WHERE denetim_id = ? ORDER BY zaman ASC', denetimId);
  const fotolar = await d.getAllAsync<{ id: string; hata_id: string | null }>(
    'SELECT id, hata_id FROM fotograflar WHERE denetim_id = ?', denetimId);
  return satirlar.map((h) => hataya(h, fotolar.filter((f) => f.hata_id === h.id).map((f) => f.id)));
}

/** Liste ekranı için özet satırlar — hataların tamamını çekmeden. */
export interface DenetimOzetSatiri {
  id: string; aracId: string; vin: string; plaka: string; baslangic: string;
  durum: string; denetci: string; hataAdedi: number;
  /** Kabul edilebilir işaretlenmemiş 3. derece hata adedi. */
  agirAdedi: number;
  senkronlandi: boolean;
}

export async function denetimleriListele(enFazla = 100): Promise<DenetimOzetSatiri[]> {
  const d = await db();
  // Sayım SQL'de yapılır: 200 denetimi belleğe çekip toplamak, liste
  // ekranını açılışta tutuklaştırırdı.
  const satirlar = await d.getAllAsync<{
    id: string; arac_id: string; vin: string; plaka: string; baslangic: string;
    durum: string; denetci: string; senkron_zamani: string | null;
    hata_adedi: number | null; agir: number | null;
  }>(
    `SELECT dn.id, dn.arac_id, dn.vin, dn.plaka, dn.baslangic, dn.durum, dn.denetci, dn.senkron_zamani,
            COALESCE(SUM(h.adet), 0) AS hata_adedi,
            COALESCE(SUM(CASE WHEN h.derece = '3' AND h.kabul_edilebilir = 0 THEN h.adet ELSE 0 END), 0) AS agir
       FROM denetimler dn
       LEFT JOIN hatalar h ON h.denetim_id = dn.id
      GROUP BY dn.id
      ORDER BY dn.baslangic DESC
      LIMIT ?`,
    enFazla,
  );
  return satirlar.map((s) => ({
    id: s.id, aracId: s.arac_id, vin: s.vin, plaka: s.plaka, baslangic: s.baslangic,
    durum: s.durum, denetci: s.denetci, hataAdedi: s.hata_adedi ?? 0,
    agirAdedi: s.agir ?? 0, senkronlandi: !!s.senkron_zamani,
  }));
}

export async function denetimGuncelle(id: string, alanlar: Partial<Denetim>): Promise<void> {
  const d = await db();
  const esleme: Record<string, string> = {
    plaka: 'plaka', raporNo: 'rapor_no', denetci: 'denetci', hat: 'hat',
    vardiya: 'vardiya', denetimTipi: 'denetim_tipi', bitis: 'bitis', durum: 'durum',
  };
  const setler: string[] = [];
  const degerler: SQLite.SQLiteBindValue[] = [];
  for (const [anahtar, sutun] of Object.entries(esleme)) {
    const v = (alanlar as Record<string, unknown>)[anahtar];
    if (v === undefined) continue;
    setler.push(`${sutun} = ?`);
    degerler.push(v as SQLite.SQLiteBindValue);
  }
  if (!setler.length) return;
  // Her değişiklik senkron damgasını düşürür: sunucudaki kopya artık eski.
  setler.push('guncelleme = ?', 'senkron_zamani = NULL');
  degerler.push(simdi(), id);
  await d.runAsync(`UPDATE denetimler SET ${setler.join(', ')} WHERE id = ?`, ...degerler);
}

export async function denetimSil(id: string): Promise<void> {
  const d = await db();
  await d.runAsync('DELETE FROM denetimler WHERE id = ?', id);
}

// --- HATA -----------------------------------------------------------------

export async function hataKaydet(denetimId: string, hata: Hata): Promise<void> {
  const d = await db();
  await d.runAsync(
    `INSERT INTO hatalar (id, denetim_id, parca_id, hata_tipi_id, derece, kabul_edilebilir, adet, konum,
        aciklama, zaman, durum, atanan_kisi, gideren, giderilme_zamani, dogrulayan,
        dogrulama_zamani, guncelleme, senkron_zamani)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
     ON CONFLICT(id) DO UPDATE SET
        parca_id = excluded.parca_id, hata_tipi_id = excluded.hata_tipi_id,
        derece = excluded.derece, kabul_edilebilir = excluded.kabul_edilebilir,
        adet = excluded.adet, konum = excluded.konum,
        aciklama = excluded.aciklama, durum = excluded.durum,
        atanan_kisi = excluded.atanan_kisi, gideren = excluded.gideren,
        giderilme_zamani = excluded.giderilme_zamani, dogrulayan = excluded.dogrulayan,
        dogrulama_zamani = excluded.dogrulama_zamani,
        guncelleme = excluded.guncelleme, senkron_zamani = NULL`,
    hata.id, denetimId, hata.parcaId, hata.hataTipiId, hata.derece,
    hata.kabulEdilebilir ? 1 : 0, hata.adet,
    hata.konum, hata.aciklama, hata.zaman, hata.durum, hata.atananKisi ?? null,
    hata.gideren ?? null, hata.giderilmeZamani ?? null, hata.dogrulayan ?? null,
    hata.dogrulamaZamani ?? null, simdi(),
  );
  await kalipSay(hata.parcaId, hata.hataTipiId);
}

export async function hataSil(hataId: string): Promise<void> {
  const d = await db();
  await d.runAsync('DELETE FROM fotograflar WHERE hata_id = ?', hataId);
  await d.runAsync('DELETE FROM hatalar WHERE id = ?', hataId);
}

// --- FOTOĞRAF -------------------------------------------------------------

export interface FotografKaydi {
  id: string; denetimId: string; hataId: string | null;
  uri: string; en: number; boy: number; zaman: string;
}

export async function fotografKaydet(
  denetimId: string, hataId: string | null, uri: string, en: number, boy: number,
): Promise<FotografKaydi> {
  const d = await db();
  const kayit: FotografKaydi = {
    id: kimlikUret('f'), denetimId, hataId, uri, en, boy, zaman: simdi(),
  };
  await d.runAsync(
    `INSERT INTO fotograflar (id, denetim_id, hata_id, uri, en, boy, zaman, senkron_zamani)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
    kayit.id, denetimId, hataId, uri, en, boy, kayit.zaman,
  );
  return kayit;
}

export async function fotograflariGetir(denetimId: string): Promise<FotografKaydi[]> {
  const d = await db();
  const satirlar = await d.getAllAsync<{
    id: string; denetim_id: string; hata_id: string | null;
    uri: string; en: number; boy: number; zaman: string;
  }>('SELECT * FROM fotograflar WHERE denetim_id = ? ORDER BY zaman ASC', denetimId);
  return satirlar.map((f) => ({
    id: f.id, denetimId: f.denetim_id, hataId: f.hata_id,
    uri: f.uri, en: f.en, boy: f.boy, zaman: f.zaman,
  }));
}

export async function fotografSil(id: string): Promise<void> {
  const d = await db();
  await d.runAsync('DELETE FROM fotograflar WHERE id = ?', id);
}

/** Bir hataya bağlanmayı bekleyen fotoğrafı sonradan bağlar. */
export async function fotografiHataBagla(fotoId: string, hataId: string): Promise<void> {
  const d = await db();
  await d.runAsync('UPDATE fotograflar SET hata_id = ?, senkron_zamani = NULL WHERE id = ?', hataId, fotoId);
}

// --- AYAR VE SAYAÇ --------------------------------------------------------

export async function ayarOku<T>(anahtar: string, varsayilan: T): Promise<T> {
  const d = await db();
  const satir = await d.getFirstAsync<{ deger: string }>(
    'SELECT deger FROM ayarlar WHERE anahtar = ?', anahtar);
  if (!satir) return varsayilan;
  try {
    return JSON.parse(satir.deger) as T;
  } catch {
    // Bozuk kayıt: varsayılana dön, kullanıcıyı engelleme.
    return varsayilan;
  }
}

export async function ayarYaz(anahtar: string, deger: unknown): Promise<void> {
  const d = await db();
  await d.runAsync(
    `INSERT INTO ayarlar (anahtar, deger) VALUES (?, ?)
     ON CONFLICT(anahtar) DO UPDATE SET deger = excluded.deger`,
    anahtar, JSON.stringify(deger),
  );
}

export async function kalipSay(parcaId: string, hataTipiId: string): Promise<void> {
  const d = await db();
  await d.runAsync(
    `INSERT INTO kalip_sayaci (kalip, sayi, son) VALUES (?, 1, ?)
     ON CONFLICT(kalip) DO UPDATE SET sayi = sayi + 1, son = excluded.son`,
    `${parcaId}.${hataTipiId}`, simdi(),
  );
}

export async function sikKullanilanlar(enFazla = 12): Promise<{ parcaId: string; hataTipiId: string; sayi: number }[]> {
  const d = await db();
  const satirlar = await d.getAllAsync<{ kalip: string; sayi: number }>(
    'SELECT kalip, sayi FROM kalip_sayaci ORDER BY sayi DESC, son DESC LIMIT ?', enFazla);
  return satirlar.map((k) => {
    const n = k.kalip.lastIndexOf('.');
    return { parcaId: k.kalip.slice(0, n), hataTipiId: k.kalip.slice(n + 1), sayi: k.sayi };
  });
}

// --- ÖZEL HATA TİPLERİ ----------------------------------------------------

interface OzelTipSatiri {
  id: string; grup: string; ad: string; en: string; derece: string;
  ekleyen: string; silindi: number;
}

/**
 * Kaldırılmışlar DA döner. Çağıran (katalogDeposu) hepsini indekse bağlar ki
 * eski raporlar adı çözebilsin; seçim listesi ayrıca süzer.
 */
export async function ozelHataTipleriOku(): Promise<HataTipi[]> {
  const d = await db();
  const satirlar = await d.getAllAsync<OzelTipSatiri>(
    'SELECT id, grup, ad, en, derece, ekleyen, silindi FROM ozel_hata_tipleri ORDER BY ad COLLATE NOCASE');
  return satirlar.map((t) => ({
    id: t.id,
    grup: t.grup as HataTipi['grup'],
    ad: t.ad,
    en: t.en,
    derece: t.derece as HataTipi['derece'],
    ekleyen: t.ekleyen,
    ozel: true,
    silindi: t.silindi === 1,
  }));
}

export async function ozelHataTipiEkle(
  girdi: { grup: HataTipi['grup']; ad: string; en: string; derece: HataTipi['derece']; ekleyen: string },
): Promise<HataTipi> {
  const d = await db();
  // Kimlik üretilir, addan türetilmez: "Ön cam çiziği" iki kez eklenirse aynı
  // kimliği üretir ve ikincisi birincinin üstüne yazardı.
  const id = kimlikUret('ht');
  const z = simdi();
  await d.runAsync(
    `INSERT INTO ozel_hata_tipleri (id, grup, ad, en, derece, ekleyen, silindi, zaman, guncelleme, senkron_zamani)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, NULL)`,
    id, girdi.grup, girdi.ad, girdi.en, girdi.derece, girdi.ekleyen, z, z,
  );
  return { id, ...girdi, ozel: true, silindi: false };
}

/** Listeden kaldırır; satır durur, eski hatalar adını çözmeye devam eder. */
export async function ozelHataTipiKaldir(id: string): Promise<void> {
  const d = await db();
  await d.runAsync(
    'UPDATE ozel_hata_tipleri SET silindi = 1, guncelleme = ?, senkron_zamani = NULL WHERE id = ?',
    simdi(), id);
}

export async function ozelHataTipiGeriAl(id: string): Promise<void> {
  const d = await db();
  await d.runAsync(
    'UPDATE ozel_hata_tipleri SET silindi = 0, guncelleme = ?, senkron_zamani = NULL WHERE id = ?',
    simdi(), id);
}

/** Bir hata tipinin kaç kayıtta kullanıldığı — kaldırmadan önce uyarmak için. */
export async function hataTipiKullanimi(hataTipiId: string): Promise<number> {
  const d = await db();
  const satir = await d.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM hatalar WHERE hata_tipi_id = ?', hataTipiId);
  return satir?.n ?? 0;
}

/** Sunucuya gönderilmeyi bekleyen kayıt sayısı — senkron rozeti için. */
export async function bekleyenSenkron(): Promise<number> {
  const d = await db();
  const satir = await d.getFirstAsync<{ n: number }>(
    `SELECT (SELECT COUNT(*) FROM denetimler WHERE senkron_zamani IS NULL)
          + (SELECT COUNT(*) FROM hatalar WHERE senkron_zamani IS NULL)
          + (SELECT COUNT(*) FROM fotograflar WHERE senkron_zamani IS NULL) AS n`);
  return satir?.n ?? 0;
}
