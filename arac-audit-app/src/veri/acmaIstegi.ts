// Rapor ekranından çalışma ekranına "şunu aç" isteği (28.09.2026).
//
// Kullanılabilirlik sınamasında ekip lideri raporda gördüğü bir hatanın
// derecesini düzeltip başka birini silmek için 9 dokunuş yaptı (Geri →
// Kayıtlar → satır → … → Rapor). Artık rapordaki satıra dokununca çalışma
// ekranı o kaydı, künyedeki "Düzenle"ye dokununca denetim bilgilerini açıyor.
//
// Neden rota parametresi değil: geri dönülen (zaten açık) ekrana parametre
// taşımak expo-router'da sürümden sürüme değişen bir davranış; barkod
// ekranındaki gerekçenin aynısı (tarama.ts). İstek bir kez okunur ve silinir.

import { create } from 'zustand';

export type AcmaIstegi =
  | { denetimId: string; tur: 'hata'; hataId: string }
  | { denetimId: string; tur: 'bilgiler' };

interface AcmaIstegiDurumu {
  istek: AcmaIstegi | null;
  iste: (istek: AcmaIstegi | null) => void;
}

export const useAcmaIstegi = create<AcmaIstegiDurumu>((set) => ({
  istek: null,
  iste: (istek) => set({ istek }),
}));
