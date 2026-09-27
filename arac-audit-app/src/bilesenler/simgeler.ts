// SİMGELER — uygulamanın tek simge kaynağı.
//
// lucide-react-native: react-native-svg üzerine kurulu (zaten bağımlılıktı),
// yani YENİ YEREL MODÜL DEĞİL, yeni derleme gerektirmez. Simge adları
// sürümler arasında değişiyor ("CheckCircle" → "CircleCheck"); var olmayan bir
// ad web'de bileşeni sessizce `undefined` yapıp ekranı çökertir. Bu dosyadaki
// her ad 1.48.0'ın hem tip dosyasında hem derlenmiş paketinde tek tek
// doğrulandı (27.09.2026; sağlama için var olmayan bir ad da arandı ve
// "yok" döndü — arama yönteminin her şeye "var" demediği görüldü).
//
// Ekranlar simgeyi doğrudan lucide'den değil BURADAN alır: bir simgeyi
// değiştirmek tek satır olsun, aynı kavram iki ekranda iki farklı çizimle
// görünmesin.

import {
  AppWindow, Armchair, ArrowRight, Calendar, Camera, CarFront, Check, ChevronLeft, ChevronRight,
  CircleCheck, CircleDashed, ClipboardList, Clock, CloudUpload, Database, Droplets, Factory,
  FileSpreadsheet, FileText, Gauge, Hash, History, Image, Info, Layers, List, LucideIcon, Minus,
  Monitor, Moon, MousePointerClick, Paintbrush, Palette, Pencil, Plus, Ruler, ScanBarcode, Search,
  Settings, Sparkles, Sun, Tag, Trash2, TriangleAlert, Undo2, User, Users, Volume2, Wrench, X, Zap,
} from 'lucide-react-native';

import { BolgeGrubu, HataGrubuId } from '@/cekirdek/tipler';

export type Simge = LucideIcon;

export const S = {
  geri: ChevronLeft,
  ileri: ChevronRight,
  ara: Search,
  kapat: X,
  ayarlar: Settings,
  ekle: Plus,
  barkod: ScanBarcode,
  kamera: Camera,
  galeri: Image,
  tik: Check,
  tamam: CircleCheck,
  geriAl: Undo2,
  liste: List,
  excel: FileSpreadsheet,
  csv: FileText,
  rapor: ClipboardList,
  arac: CarFront,
  uyari: TriangleAlert,
  bilgi: Info,
  sil: Trash2,
  sec: MousePointerClick,
  senkron: CloudUpload,
  tarih: Calendar,
  kisi: User,
  kabul: CircleDashed,
  son: History,
  faz: Layers,
  ekip: Users,
  raporNo: Hash,
  vardiya: Clock,
  hat: Factory,
  acikTema: Sun,
  koyuTema: Moon,
  sistemTema: Monitor,
  veri: Database,
  gorunum: Palette,
  basla: ArrowRight,
  duzenle: Pencil,
  azalt: Minus,
  etiket: Tag,
} satisfies Record<string, Simge>;

/**
 * Hata gruplarının simgeleri — hata ızgarasında grup başlığında durur. Denetçi
 * 37 kutu arasında önce grubu gözle bulur; simge, okumadan tanımayı sağlar.
 */
export const GRUP_SIMGELERI: Record<HataGrubuId, Simge> = {
  // SprayCan idi: 15 px'te sol üstteki sprey noktaları kir lekesi gibi
  // görünüyordu (27.09.2026 ekran görüntüsü). Fırça küçükte de okunuyor.
  yuzey: Paintbrush,
  montaj: Ruler,
  ses: Volume2,
  fonksiyon: Zap,
  doseme: Armchair,
  cam: AppWindow,
  sizdirmazlik: Droplets,
  temizlik: Sparkles,
};

/** Bölge gruplarının simgeleri — parça gezgininde bölge başlığında. */
export const BOLGE_SIMGELERI: Record<BolgeGrubu, Simge> = {
  dis: CarFront,
  ic: Armchair,
  motor: Wrench,
  fonksiyon: Zap,
  surus: Gauge,
};
