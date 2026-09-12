// KVKK AYDINLATMA METNİ — okunabilir sayfa hâli (`/kvkk`).
// ---------------------------------------------------------------------------
// METNİN KENDİSİ BURADA DEĞİL. Gövde src/components/KvkkMetin.tsx'te duruyor,
// çünkü aynı metin kayıt ekranındaki İMZA penceresinde de gösteriliyor.
// İmzalanan metinle yayımlanan metin ayrışırsa rıza sakatlanır; tek kaynak
// bunu imkânsız kılar.
//
// Bu sayfa, metne kayıt olmadan da (ve kayıttan sonra Ayarlar'dan da)
// ulaşılabilsin diye var.
import { ScrollView, StyleSheet } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { KvkkGovde } from '@/components/KvkkMetin';
import { KvkkRizaKarti } from '@/components/KvkkRizaKarti';
import { useLangStore } from '@/i18n';
import { spacing } from '@/theme/theme';

export default function KvkkScreen() {
  const lang = useLangStore((s) => s.lang);
  const tr = lang === 'tr';

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={tr ? 'KVKK Aydınlatma Metni' : 'KVKK Privacy Notice'} showBack />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Rızanın DURUMU ve geri alma düğmesi en üstte: metin bunu "Ayarlar"
            altında vaat ediyor, aranacak bir yerde olmamalı. Oturum yoksa
            (kayıt öncesi) kart kendini hiç çizmez. */}
        <KvkkRizaKarti tr={tr} />
        <KvkkGovde tr={tr} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
});
