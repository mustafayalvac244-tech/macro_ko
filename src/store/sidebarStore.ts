import { create } from 'zustand';

interface SidebarState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  /**
   * Menü şu anda KALICI olarak mı çiziliyor (masaüstü web, bkz. (app)/_layout)?
   *
   * NEDEN STORE'DA: ScreenHeader hem (app) altındaki sekme ekranlarında hem de
   * kök seviyedeki ekranlarda (Kanunlar, Ayarlar...) kullanılıyor. Kalıcı menü
   * yalnız (app) düzeninde var; ScreenHeader bunu kendi başına bilemez. Ekran
   * genişliğine bakmak YANLIŞ olurdu: geniş ekranda kök seviyedeki bir ekranda
   * kalıcı menü YOK, orada hamburger hâlâ gerekli.
   */
  kalici: boolean;
  setKalici: (v: boolean) => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  kalici: false,
  setKalici: (v) => set({ kalici: v }),
}));
