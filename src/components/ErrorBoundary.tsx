import React from 'react';
import { kose } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import { useT } from '@/i18n';
import type { ThemeColors } from '@/theme/palettes';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { hataKaydet } from '@/lib/hataKaydi';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * App-wide safety net. Without this, any error thrown while rendering a screen
 * unmounts the whole tree and the user sees a blank white screen. Here we catch
 * it, show a friendly recoverable card, and surface the message so the problem
 * is reportable instead of invisible.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Keep a breadcrumb in the JS console / crash logs.
    console.error('Uncaught UI error:', error);
    // 16.09.2026'DA EKLENDİ. Yukarıdaki satır tek başına yeterli sanılıyordu;
    // gerçek bir cihazda `console.error` HİÇBİR YERE gitmiyor. Bir iPhone
    // çökmesi araştırılırken elimizde tek satır kayıt olmadığı görüldü ve
    // teşhis tahmine kaldı. Artık kayıt veritabanına da düşüyor.
    hataKaydet(error, 'render');
  }

  private reset = () => {
    this.setState({ error: null });
  };

  private goHome = () => {
    this.reset();
    try {
      router.replace('/(app)');
    } catch {
      // navigation may not be ready; resetting state already re-renders children
    }
  };

  private goBack = () => {
    this.reset();
    try {
      if (router.canGoBack()) router.back();
      else router.replace('/(app)');
    } catch {
      // ignore
    }
  };

  render() {
    if (!this.state.error) return this.props.children;

    return <HataEkrani hata={this.state.error} onBack={this.goBack} onHome={this.goHome} />;
  }
}

/**
 * Hata ekranı: renk ve metin temadan/dilden gelir (10.10.2026). Eskiden sabit
 * açık palet ve sabit Türkçe metinle çiziliyordu: koyu temada (varsayılan Gece)
 * çökme anında bile ekran bir anda bembeyaz parlıyordu ve İngilizce kullanıcı
 * Türkçe okuyordu. Tema ve dil ZUSTAND mağazasından okunur (sağlayıcı
 * gerektirmez), bu yüzden bileşen ağacı çökmüş olsa da çalışır.
 */
function HataEkrani({ hata, onBack, onHome }: { hata: Error; onBack: () => void; onHome: () => void }) {
  const { colors } = useTheme();
  const t = useT();
  const styles = makeStyles(colors);

  return (
    <View style={styles.root}>
      <View style={styles.iconWrap}>
        <Ionicons name="alert-circle-outline" size={44} color={colors.warning} />
      </View>
      <Text style={styles.title}>{t('err.boundaryTitle')}</Text>
      <Text style={styles.desc}>{t('err.boundaryDesc')}</Text>

      <View style={styles.buttons}>
        <Pressable style={[styles.button, styles.primary]} onPress={onBack} accessibilityRole="button">
          <Ionicons name="arrow-back" size={18} color={colors.textInverse} />
          <Text style={styles.primaryText}>{t('err.boundaryBack')}</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.secondary]} onPress={onHome} accessibilityRole="button">
          <Ionicons name="home-outline" size={18} color={colors.primary} />
          <Text style={styles.secondaryText}>{t('err.boundaryHome')}</Text>
        </Pressable>
      </View>

      <Text style={styles.errLabel}>{t('err.boundaryDetail')}</Text>
      <Text style={styles.errText} selectable numberOfLines={4}>
        {hata.message || String(hata)}
      </Text>
    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    backgroundColor: c.bg,
  },
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: kose(26),
    backgroundColor: c.warningSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: c.textPrimary,
    textAlign: 'center',
  },
  desc: {
    fontSize: 14,
    color: c.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 8,
    paddingHorizontal: 8,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: kose(14),
  },
  primary: {
    backgroundColor: c.primary,
  },
  primaryText: {
    color: c.textInverse,
    fontWeight: '700',
    fontSize: 15,
  },
  secondary: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  secondaryText: {
    color: c.primary,
    fontWeight: '700',
    fontSize: 15,
  },
  errLabel: {
    fontSize: 11,
    color: c.textMuted,
    marginTop: 32,
    fontWeight: '700',
  },
  errText: {
    fontSize: 12,
    color: c.textMuted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17,
  },
});
