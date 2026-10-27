// ALAN MODELİ — tüm çekirdek modüllerin paylaştığı tipler.
//
// Web sürümü saf JavaScript'ti; burada tip veriyoruz çünkü bu kod artık
// senkron, veritabanı ve çok kullanıcılı bir akışın içinden geçecek. Bir
// alanın adını yanlış yazmak orada sessiz veri kaybı demek.

/** Hata kritikliği. A durdurur, B müşteri görür, C kozmetiktir. */
/**
 * DERECE — ekibin kendi sistemi. Ürün sahibinden iki aşamada alındı:
 * 16.09.2026 "3 var, parantez içi 3 var"; 26.09.2026 anlamı: "3 kötü, parantez
 * içi 3 kabul edilebilir demek".
 *
 * Üç derece var: 1, 2, 3. Her derece İKİ DURUMDA yazılabilir:
 *   3    → hata. Düzeltilmesi gerekir.
 *   (3)  → kabul edilebilir. Kayda geçer ama iş emri doğurmaz.
 *
 * Yani toplam altı gösterim: 1 2 3 (1) (2) (3). Parantez bir süs değil,
 * anlamı TERSİNE çeviren işarettir — raporda kaybolursa "düzeltilecek" ile
 * "kabul edildi" birbirine karışır.
 *
 * Eskiden burada A/B/C ve ceza puanı vardı; ikisi de ekipte yoktu, kaldırıldı.
 */
/**
 * Ekibin Excel'indeki DEMERIT (26.10.2026): 0, 1, 2, 3. "0" sonradan eklendi —
 * Excel'de problemlerin çoğu 0 puanla yazılıyor. Eski kayıtlarda yalnız 1-3
 * ve ayrı bir "kabul edilebilir" bayrağı var; o bayrak demerit 0 sayılır
 * (bkz. nas.ts → demeritDegeri).
 */
export type DereceKodu = '0' | '1' | '2' | '3';

/** Excel'deki CLASS. Varsayılan MINOR (Excel formu da öyle açılıyor). */
export type SinifKodu = 'MINOR' | 'MAJOR' | 'MAIN';

/** Ekibin tablosundaki iki değer; ekran görüntüsünde ikisi de geçiyor. */
export type SorunTipi = 'Part' | 'Complex';

export interface Derece {
  id: DereceKodu;
  ad: string;
  en: string;
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
  derece: DereceKodu;
  /** true ise ekipçe uygulama içinden eklenmiştir, koddan gelmiyordur. */
  ozel?: boolean;
  /**
   * Listeden kaldırıldı ama SİLİNMEDİ. Eski hatalar bu kimliğe bağlı; kaydı
   * gerçekten silsek geçmiş raporlarda hata adı yerine ham kimlik görünürdü.
   */
  silindi?: boolean;
  /** Ekleyen denetçi — özel tiplerde kimin eklediği sorulabilsin diye. */
  ekleyen?: string;
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
  /** Grubu uysa da bu parçada anlamsız hata tipleri (ör. HV kabloda kademe). */
  haric?: string[];
  /** Aramada da bulunsun diye sahadaki başka adları (ör. "depo kapağı"). */
  ara?: string;
  /**
   * Arama SIRALAMASINDA adın parçası sayılan, gösterilmeyen kelimeler
   * (27.10.2026). Hyundai dış paneli "PANEL ASSY-HOOD" diye adlandırır;
   * gösterilen ad "Kaput / Hood" kalır (rapor ve Excel değişmesin), ama
   * "HOOD PNL" araması kaputu iç sacdan (Hood inner panel) önce getirir.
   */
  adEk?: string;
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
  /** Excel'deki MODEL kodu (BJ, BC3, CUV, N, AC3, BC4 CUV) — 26.10.2026. */
  kod: string;
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
  /**
   * İKİNCİ PARÇA (26.10.2026, ürün sahibi: "iki parça seçebilsek, arasında
   * boşluk vs. yazabilmek için"). Boşluk/kademe gibi iki panelin ARASINDAKİ
   * hata için: kayıt `parcaId`ye bağlıdır, ikinci parça yanında yazılır
   * ("Kaput ↔ Sol ön çamurluk"). Boş ya da yok: tek parçalı kayıt.
   */
  ikinciParcaId?: string;
  hataTipiId: string;
  derece: DereceKodu;
  /**
   * true ise derece raporda PARANTEZ İÇİNDE yazılır: `(3)`. Anlamı "bu kademede
   * ama kabul edilebilir" — kayda geçer, iş emri doğurmaz. Parantez kaybolursa
   * kabul edilmiş bir bulgu düzeltilecek hata gibi görünür.
   */
  kabulEdilebilir: boolean;
  /** Ekibin tablosunda H sütunu: parçaya bağlı mı, birden çok parçayı mı ilgilendiriyor. */
  sorunTipi: SorunTipi;
  /** Excel CLASS (26.10.2026). Yoksa MINOR sayılır — eski kayıtlarda yok. */
  sinif?: SinifKodu;
  /**
   * Excel SYSTEM (26.10.2026): EXTERIOR, INTERIOR, BODY, PAINT, CHASSIS,
   * DRIVE, ELECTRIC, MOVING. Yoksa parça ve tipten türetilir (nas.ts).
   */
  sistem?: string;
  /**
   * Ekibin tablosunda L sütunu, ör. "HMTR PD (HWASEUNG)". Parçaya göre öğrenilir:
   * bir parça için bir kez yazılınca o parçanın sonraki hatalarına kendiliğinden
   * gelir. Varsayılan boş — bilinmeyen bir sorumlu UYDURULMAZ.
   */
  sorumlu: string;
  adet: number;
  konum: string;
  aciklama: string;
  /** ISO 8601. */
  zaman: string;
  /** Yerel fotoğraf kayıt kimlikleri. */
  fotograflar: string[];
  /**
   * TAKİP (26.10.2026). Ekibin Excel'inde PROGRESS / COUNTERMEASURE / CM
   * APPLICATION DATE / VERIFICATION BODY NO sütunları. Ölçüldü (ekibin dosyası,
   * 3.499 satır): PROGRESS 273 satırda dolu, hepsinde "SHARED"; önlem metni 211,
   * tarih 191 satırda. Eşleme: 'atandi' = paylaşıldı (SHARED), 'giderildi' =
   * önlem uygulandı (tarih `giderilmeZamani`), 'kapali' = doğrulandı (body
   * `dogrulamaBody`). 'acik' varsayılan.
   */
  durum: HataDurumu;
  atananKisi?: string | null;
  gideren?: string | null;
  giderilmeZamani?: string | null;
  dogrulayan?: string | null;
  dogrulamaZamani?: string | null;
  /** Excel COUNTERMEASURE — alınan önlem, serbest metin. Eski kayıtlarda boş. */
  onlem?: string;
  /** Excel VERIFICATION BODY NO — önlemin doğrulandığı aracın body numarası. */
  dogrulamaBody?: string;
}

export type DenetimDurumu = 'devam' | 'tamam';

export interface Denetim {
  id: string;
  aracId: string;
  /** 17 haneli şasi. 24.10.2026'dan beri İSTEĞE BAĞLI: şasi ya da body no'dan biri yeter. */
  vin: string;
  /**
   * Gövde numarası (Excel formundaki "Body", örn. "015253"). 24.10.2026'da
   * eklendi; eski kayıtlarda boş. Metin — baştaki sıfır korunur.
   */
  bodyNo?: string;
  plaka: string;
  raporNo: string;
  denetci: string;
  hat: string;
  vardiya: string;
  /** Tablodaki "Source" sütunu — ör. "HMC Audit". */
  denetimTipi: string;
  /** Üretim/pilot fazı — ör. "LP2". Ekibin tablosunda E sütunu. */
  faz: string;
  /** Denetimi yapan ekip — ör. "QE Team 2". Ekibin tablosunda K sütunu. */
  ekip: string;
  /** "LH" / "RH" (ürün sahibi, 28.09.2026). Boş = girilmedi. Bkz. aracBilgisi.ts. */
  spec: string;
  /** Aracın kilometresi, denetim anında. null = girilmedi (0 değil). */
  km: number | null;
  /** ISO 8601. */
  baslangic: string;
  bitis: string | null;
  durum: DenetimDurumu;
  hatalar: Hata[];
  /**
   * Kontrol edildi işaretli sistemler (BolgeGrubu kimlikleri; sistemler.ts).
   * 24.10.2026'da eklendi; `denetimGetir` doldurur, testlerdeki elle kurulan
   * nesnelerde yoktur — rapor o zaman kapsam satırı basmaz.
   */
  kapsam?: string[];
  /** Sunucuya gönderildi mi — çevrimdışı senkron için. */
  senkronZamani?: string | null;
}

// --- ÖZET -----------------------------------------------------------------
//
// Ceza puanı ve KABUL/ŞARTLI/RED tipleri 26.09.2026'da kaldırıldı (istek 16.09): ekipte
// böyle bir sistem yok, uydurma bir ölçüt raporda gerçekmiş gibi görünüyordu.

export interface Dagilim {
  id: string;
  ad: string;
  bolgeAd?: string;
  adet: number;
  aracSayisi?: number;
}

export interface Ozet {
  toplamHata: number;
  /** Tüm bulgular, kabul edilebilir olanlar DAHİL (adet toplamı). */
  toplamAdet: number;
  /** Σ DEMERIT × adet (eski "kabul edilebilir" kayıtlar 0). */
  demeritToplami: number;
  fotografliHata: number;
  fotografsizHata: number;
  /** Demerit değerine göre problem adedi (eski "kabul edilebilir" → 0). */
  dereceDagilimi: Record<DereceKodu, number>;
  /** CLASS'a göre problem adedi (yoksa MINOR). */
  sinifDagilimi: Record<SinifKodu, number>;
  bolgeDagilimi: Dagilim[];
  parcaDagilimi: Dagilim[];
  grupDagilimi: Dagilim[];
}

// --- RAPOR ----------------------------------------------------------------

export type Dil = 'tr' | 'en';

export interface RaporAyarlari {
  dil?: Dil;
  yazar?: string;
}

/** Excel'e gömülecek fotoğrafın baytları. */
export interface FotografBaytlari {
  bayt: Uint8Array;
  en?: number;
  boy?: number;
}
