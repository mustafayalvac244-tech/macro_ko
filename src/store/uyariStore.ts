import { create } from 'zustand';

/**
 * WEB'DE UYARI/ONAY PENCERESİ.
 *
 * BULUNAN KUSUR (ölçüm, 2026-09-11): react-native-web'in Alert karşılığı
 * BOŞ BİR FONKSİYON (node_modules/react-native-web/src/exports/Alert/index.js):
 *
 *     class Alert { static alert() {} }
 *
 * Uygulamada 24 dosyada 87 `Alert.alert(...)` çağrısı var. Bunların 53'ü
 * "cancel"/"destructive" düğmeli ONAY penceresi — yani SİLME, ÇIKIŞ YAPMA,
 * ÖDEME İŞARETLEME gibi işlemler onaydan geçiyor. Web'de o pencere hiç
 * açılmadığı için onPress ASLA çalışmıyordu: kullanıcı "Sil" diyor, hiçbir
 * şey olmuyor; "Çıkış yap" diyor, oturum kapanmıyor. Tek satır hata bile yok.
 *
 * Bu store, web'de aynı işi yapan uygulama içi pencerenin durumunu tutar.
 * Natifte kullanılmaz (Alert.alert yerli pencereyi açar).
 */

export interface UyariDugmesi {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface Uyari {
  baslik: string;
  mesaj?: string;
  dugmeler: UyariDugmesi[];
}

interface UyariState {
  aktif: Uyari | null;
  goster: (u: Uyari) => void;
  kapat: () => void;
}

export const useUyariStore = create<UyariState>((set) => ({
  aktif: null,
  goster: (u) => set({ aktif: u }),
  kapat: () => set({ aktif: null }),
}));
