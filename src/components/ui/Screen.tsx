import React from 'react';
import { StyleSheet, useWindowDimensions, View, ViewStyle } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/useTheme';
import { ortalaStili, type SutunTuru } from '@/theme/duzen';
import type { ThemeColors } from '@/theme/palettes';

interface ScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
  edges?: Edge[];
  /**
   * Geniş ekranda içerik sütununun genişliği:
   *   'genis' (varsayılan) liste/pano, 'dar' okuma metni, 'form' tek sütunlu form.
   * Bkz. src/theme/duzen.ts — SUTUN_GENISLIKLERI.
   */
  genislik?: SutunTuru;
}

export function Screen({ children, style, edges = ['top', 'left', 'right'], genislik = 'genis' }: ScreenProps) {
  const __t = useTheme();
  const styles = makeStyles(__t.colors);
  const { width } = useWindowDimensions();
  // Web'de masaüstü genişliğinde içerik ORTALANIR (bkz. src/theme/duzen.ts).
  // Natifte ve dar tarayıcıda null döner, yani hiçbir şey değişmez.
  const ortala = ortalaStili(width, genislik);

  return (
    <SafeAreaView edges={edges} style={[styles.container, style]}>
      {ortala ? <View style={[styles.sutun, ortala]}>{children}</View> : children}
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  sutun: {
    flex: 1,
  },
});
