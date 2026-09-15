// ALAN MODELİ — tüm çekirdek modüllerin paylaştığı tipler.
//
// Web sürümü saf JavaScript'ti; burada tip veriyoruz çünkü bu kod artık
// senkron, veritabanı ve çok kullanıcılı bir akışın içinden geçecek. Bir
// alanın adını yanlış yazmak orada sessiz veri kaybı demek.

/** Hata kritikliği. A durdurur, B müşteri görür, C kozmetiktir. */
export type SiddetKodu = 'A' | 'B' | 'C';

export interface Siddet {
  id: SiddetKodu;
  ad: string;
  en: string;
  /** Ceza puanı (demerit) ağırlığı — ayarlanabilir başlangıç değeri. */
  puan: number;
  renk: string;
  aciklama: string;
}

export type HataGrubuId =
  | 'yuzey' | 'montaj' | 'ses' | 'fonksiyon'
  | 'doseme' | 'cam' | 'sizdirmazlik' | 'temizlik';

export interface HataGrubu { ad: string; en: string }

export interface HataTipi {
  id: string;
  grup: HataGrubuId;
  ad: string;
  en: string;
  /** Önerilen başlangıç şiddeti; denetçi değiştirebilir. */
  siddet: SiddetKodu;
}

export type Taraf = 'sol' | 'sag';

export interface Parca {
  id: string;
  ad: string;
  en: string;
  /** Bu parçada anlamlı olan hata grupları. */
  gruplar: HataGrubuId[];
  /** 3B modeldeki tıklanabilir yüzeyin kimliği (varsa). */
  mesh?: string;
  taraf?: Taraf;
  cift?: boolean;
  sadeceEv?: boolean;
  sadeceIce?: boolean;
}

/** PARCA_INDEKS'in değeri — parça, ait olduğu bölge bilgisiyle birlikte. */
export interface ParcaKayit extends Parca {
  bolgeId: string;
  bolgeAd: string;
  bolgeEn: string;
}

export type BolgeGrubu = 'dis' | 'ic' | 'motor' | 'fonksiyon' | 'surus';

export interface Bolge {
  id: string;
  ad: string;
  en: string;
  grup: BolgeGrubu;
  simge?: string;
  taraf?: Taraf;
  parcalar: Parca[];
}

// --- ARAÇ VE GEOMETRİ -----------------------------------------------------

export type AracTipi = 'ev' | 'ice';

/** Silüetin bir noktası. `parca` alanı, O NOKTADA BİTEN dilimi adlandırır. */
export interface HatNoktasi {
  x: number;
  y: number;
  parca: string;
  /** Yarı genişlik oranı (tam genişliğe göre). */
  z: number;
}

export interface Arac {
  id: string;
  ad: string;
  tam: string;
  tip: AracTipi;
  /** 3B modeldeki gövde rengi. Şiddet vurguları (A kırmızı) gövdenin ÜSTÜNE
   *  çizildiği için burası nötr kalır — kırmızı gövdede kırmızı vurgu okunmaz. */
  renk: string;
  /** Araç kartındaki silüet ikonunun rengi. Vurgu çizilmeyen tek yer burası
   *  olduğu için gerçek lansman rengi kullanılabilir. Yoksa `renk`e düşer. */
  ikonRenk?: string;
  /** false ise arayüz "ölçü doğrulanmadı" uyarısı gösterir. */
  olcuDogrulandi: boolean;
  not: string;
  uzunluk: number;
  genislik: number;
  yukseklik: number;
  dingil: number;
  tekerR: number;
  onSarkma: number;
  arkaSarkma: number;
  ustHat: HatNoktasi[];
  belY: number;
  esikY: number;
  kapiX: { onBas: number; orta: number; arkaSon: number };
}

export type Nokta3 = [number, number, number];

/** Çizilecek tek yüzey. */
export interface Yuzey {
  mesh: string;
  p: Nokta3[];
  renk: string;
  /** Eş düzlemli bindirmeyi bir tık öne alır (far, ızgara). */
  ustunluk: number;
}

export type ModelKipi = 'dis' | 'ic';

// --- DENETİM --------------------------------------------------------------

export type HataDurumu = 'acik' | 'atandi' | 'giderildi' | 'kapali';

export interface Hata {
  id: string;
  parcaId: string;
  hataTipiId: string;
  siddet: SiddetKodu;
  adet: number;
  konum: string;
  aciklama: string;
  /** ISO 8601. */
  zaman: string;
  /** Yerel fotoğraf kayıt kimlikleri. */
  fotograflar: string[];
  durum: HataDurumu;
  /** Takip döngüsü — ikinci aşamada dolacak alanlar. */
  atananKisi?: string | null;
  gideren?: string | null;
  giderilmeZamani?: string | null;
  dogrulayan?: string | null;
  dogrulamaZamani?: string | null;
}

export type DenetimDurumu = 'devam' | 'tamam';

export interface Denetim {
  id: string;
  aracId: string;
  vin: string;
  plaka: string;
  raporNo: string;
  denetci: string;
  hat: string;
  vardiya: string;
  denetimTipi: string;
  /** ISO 8601. */
  baslangic: string;
  bitis: string | null;
  durum: DenetimDurumu;
  hatalar: Hata[];
  /** Sunucuya gönderildi mi — çevrimdışı senkron için. */
  senkronZamani?: string | null;
}

// --- PUANLAMA -------------------------------------------------------------

export interface Esikler {
  /** Tek bir A sınıfı hata aracı reddetsin mi. */
  kritikVarsaRed: boolean;
  sartliPuan: number;
  redPuan: number;
}

export type SonucKodu = 'KABUL' | 'SARTLI' | 'RED';

export interface Sonuc {
  kod: SonucKodu;
  ad: string;
  en: string;
  gerekce: string;
}

export interface Dagilim {
  id: string;
  ad: string;
  bolgeAd?: string;
  adet: number;
  puan: number;
  aracSayisi?: number;
}

export interface Ozet {
  toplamHata: number;
  toplamAdet: number;
  toplamPuan: number;
  fotografliHata: number;
  fotografsizHata: number;
  siddetDagilimi: Record<SiddetKodu, { adet: number; puan: number }>;
  bolgeDagilimi: Dagilim[];
  parcaDagilimi: Dagilim[];
  grupDagilimi: Dagilim[];
  sonuc: Sonuc;
}

// --- RAPOR ----------------------------------------------------------------

export type Dil = 'tr' | 'en';

export interface RaporAyarlari {
  dil?: Dil;
  esikler?: Esikler;
  yazar?: string;
}

/** Excel'e gömülecek fotoğrafın baytları. */
export interface FotografBaytlari {
  bayt: Uint8Array;
  en?: number;
  boy?: number;
}
