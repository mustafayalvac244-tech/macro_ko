// YEREL DEPO — IndexedDB.
//
// Neden sunucu değil: denetim sahada, çoğu zaman kapsama alanı zayıf bir
// üretim hattında yapılır. Her kayıt önce CİHAZA yazılır; internet olmasa da
// denetim kesintisiz sürer, Excel yine üretilir. Sunucuya gönderme (varsa)
// sonradan eklenebilecek ayrı bir katmandır — veri kaybı riski buraya taşınmaz.

const VERITABANI = 'aracAudit';
const SURUM = 1;
const DENETIMLER = 'denetimler';
const FOTOGRAFLAR = 'fotograflar';
const AYARLAR = 'ayarlar';
const SAYACLAR = 'sayaclar';

let _db = null;

export function db() {
  if (_db) return _db;
  _db = new Promise((coz, redi) => {
    const istek = indexedDB.open(VERITABANI, SURUM);
    istek.onupgradeneeded = () => {
      const d = istek.result;
      if (!d.objectStoreNames.contains(DENETIMLER)) {
        const s = d.createObjectStore(DENETIMLER, { keyPath: 'id' });
        s.createIndex('baslangic', 'baslangic');
        s.createIndex('vin', 'vin');
      }
      if (!d.objectStoreNames.contains(FOTOGRAFLAR)) {
        const s = d.createObjectStore(FOTOGRAFLAR, { keyPath: 'id' });
        s.createIndex('denetimId', 'denetimId');
      }
      if (!d.objectStoreNames.contains(AYARLAR)) d.createObjectStore(AYARLAR, { keyPath: 'anahtar' });
      if (!d.objectStoreNames.contains(SAYACLAR)) d.createObjectStore(SAYACLAR, { keyPath: 'kalip' });
    };
    istek.onsuccess = () => coz(istek.result);
    istek.onerror = () => redi(istek.error);
  });
  return _db;
}

function islem(depoAdlari, mod, isGovdesi) {
  return db().then((d) => new Promise((coz, redi) => {
    const t = d.transaction(depoAdlari, mod);
    let sonuc;
    t.oncomplete = () => coz(sonuc);
    t.onerror = () => redi(t.error);
    t.onabort = () => redi(t.error);
    sonuc = isGovdesi(t);
    if (sonuc instanceof Promise) sonuc.then((v) => { sonuc = v; });
  }));
}

const istekSoz = (istek) => new Promise((coz, redi) => {
  istek.onsuccess = () => coz(istek.result);
  istek.onerror = () => redi(istek.error);
});

export function kimlikUret(onEk = 'd') {
  return `${onEk}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// --- DENETİMLER ------------------------------------------------------------

export async function denetimKaydet(denetim) {
  const d = await db();
  const t = d.transaction(DENETIMLER, 'readwrite');
  t.objectStore(DENETIMLER).put(denetim);
  await new Promise((c, r) => { t.oncomplete = c; t.onerror = () => r(t.error); });
  return denetim;
}

export async function denetimGetir(id) {
  const d = await db();
  return istekSoz(d.transaction(DENETIMLER).objectStore(DENETIMLER).get(id));
}

/** En yeni denetimler önce. */
export async function denetimListele(enFazla = 100) {
  const d = await db();
  const hepsi = await istekSoz(d.transaction(DENETIMLER).objectStore(DENETIMLER).getAll());
  return hepsi.sort((a, b) => String(b.baslangic).localeCompare(String(a.baslangic))).slice(0, enFazla);
}

export async function denetimSil(id) {
  const fotolar = await fotograflariGetir(id);
  const d = await db();
  const t = d.transaction([DENETIMLER, FOTOGRAFLAR], 'readwrite');
  t.objectStore(DENETIMLER).delete(id);
  for (const f of fotolar) t.objectStore(FOTOGRAFLAR).delete(f.id);
  return new Promise((c, r) => { t.oncomplete = () => c(true); t.onerror = () => r(t.error); });
}

// --- FOTOĞRAFLAR -----------------------------------------------------------

/**
 * @param {string} denetimId
 * @param {Blob} blob küçültülmüş JPEG
 * @param {{en:number, boy:number, hataId?:string}} bilgi
 */
export async function fotografKaydet(denetimId, blob, bilgi = {}) {
  const kayit = {
    id: kimlikUret('f'), denetimId, blob,
    en: bilgi.en ?? 0, boy: bilgi.boy ?? 0,
    hataId: bilgi.hataId ?? null, zaman: new Date().toISOString(),
  };
  const d = await db();
  const t = d.transaction(FOTOGRAFLAR, 'readwrite');
  t.objectStore(FOTOGRAFLAR).put(kayit);
  await new Promise((c, r) => { t.oncomplete = c; t.onerror = () => r(t.error); });
  return kayit;
}

export async function fotografGetir(id) {
  const d = await db();
  return istekSoz(d.transaction(FOTOGRAFLAR).objectStore(FOTOGRAFLAR).get(id));
}

export async function fotograflariGetir(denetimId) {
  const d = await db();
  return istekSoz(d.transaction(FOTOGRAFLAR).objectStore(FOTOGRAFLAR).index('denetimId').getAll(denetimId));
}

export async function fotografSil(id) {
  const d = await db();
  const t = d.transaction(FOTOGRAFLAR, 'readwrite');
  t.objectStore(FOTOGRAFLAR).delete(id);
  return new Promise((c, r) => { t.oncomplete = () => c(true); t.onerror = () => r(t.error); });
}

/** Excel üretimi için: fotoId -> { bayt } haritası. */
export async function fotografBaytlari(denetimId) {
  const kayitlar = await fotograflariGetir(denetimId);
  const harita = new Map();
  for (const k of kayitlar) {
    harita.set(k.id, { bayt: new Uint8Array(await k.blob.arrayBuffer()), en: k.en, boy: k.boy });
  }
  return harita;
}

// --- AYARLAR ---------------------------------------------------------------

export async function ayarOku(anahtar, varsayilan = null) {
  const d = await db();
  const k = await istekSoz(d.transaction(AYARLAR).objectStore(AYARLAR).get(anahtar));
  return k ? k.deger : varsayilan;
}

export async function ayarYaz(anahtar, deger) {
  const d = await db();
  const t = d.transaction(AYARLAR, 'readwrite');
  t.objectStore(AYARLAR).put({ anahtar, deger });
  return new Promise((c, r) => { t.oncomplete = () => c(deger); t.onerror = () => r(t.error); });
}

// --- KULLANIM SAYACI -------------------------------------------------------
// "Hatalar genelde benzer" — uygulama bunu ÖĞRENİR. Her kaydedilen parça+hata
// ikilisi sayılır; hızlı seçim çubuğu bu sayaca göre yeniden sıralanır.

export async function kalipSay(parcaId, hataTipiId) {
  const kalip = `${parcaId}.${hataTipiId}`;
  const d = await db();
  const t = d.transaction(SAYACLAR, 'readwrite');
  const s = t.objectStore(SAYACLAR);
  const mevcut = await istekSoz(s.get(kalip));
  s.put({ kalip, sayi: (mevcut?.sayi ?? 0) + 1, son: new Date().toISOString() });
  return new Promise((c, r) => { t.oncomplete = () => c(true); t.onerror = () => r(t.error); });
}

export async function sikKullanilanlar(enFazla = 12) {
  const d = await db();
  const hepsi = await istekSoz(d.transaction(SAYACLAR).objectStore(SAYACLAR).getAll());
  return hepsi
    .sort((a, b) => b.sayi - a.sayi || String(b.son).localeCompare(String(a.son)))
    .slice(0, enFazla)
    .map((k) => ({ ...k, parcaId: k.kalip.slice(0, k.kalip.lastIndexOf('.')), hataTipiId: k.kalip.slice(k.kalip.lastIndexOf('.') + 1) }));
}

// --- YEDEK -----------------------------------------------------------------

/** Tüm denetimleri (fotoğraflar base64 olarak) tek JSON'a alır. */
export async function yedekAl() {
  const denetimler = await denetimListele(10000);
  const fotograflar = [];
  for (const d of denetimler) {
    for (const f of await fotograflariGetir(d.id)) {
      fotograflar.push({
        id: f.id, denetimId: f.denetimId, hataId: f.hataId, en: f.en, boy: f.boy, zaman: f.zaman,
        veri: await blobBase64(f.blob),
      });
    }
  }
  return { surum: 1, alindi: new Date().toISOString(), denetimler, fotograflar };
}

export async function yedekYukle(yedek) {
  if (!yedek?.denetimler) throw new Error('Yedek dosyası tanınmadı.');
  for (const d of yedek.denetimler) await denetimKaydet(d);
  const dbh = await db();
  for (const f of yedek.fotograflar ?? []) {
    const blob = base64Blob(f.veri);
    const t = dbh.transaction(FOTOGRAFLAR, 'readwrite');
    t.objectStore(FOTOGRAFLAR).put({ ...f, blob, veri: undefined });
    await new Promise((c, r) => { t.oncomplete = c; t.onerror = () => r(t.error); });
  }
  return { denetim: yedek.denetimler.length, fotograf: (yedek.fotograflar ?? []).length };
}

function blobBase64(blob) {
  return new Promise((coz, redi) => {
    const o = new FileReader();
    o.onload = () => coz(o.result);
    o.onerror = () => redi(o.error);
    o.readAsDataURL(blob);
  });
}

function base64Blob(veriUrl) {
  const [bas, govde] = String(veriUrl).split(',');
  const tur = /:(.*?);/.exec(bas)?.[1] ?? 'image/jpeg';
  const ham = atob(govde);
  const bayt = new Uint8Array(ham.length);
  for (let i = 0; i < ham.length; i++) bayt[i] = ham.charCodeAt(i);
  return new Blob([bayt], { type: tur });
}

/** Depolama kotası — "yer doldu" hatasını sahada değil, önceden görelim. */
export async function depoDurumu() {
  if (!navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { kullanilan: usage, kota: quota, oran: quota ? usage / quota : 0 };
}
