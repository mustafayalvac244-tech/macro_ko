import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuthStore } from '@/store/authStore';
import { useT } from '@/i18n';

/**
 * EŞLEŞMEYEN ADRES (404) — AJAN 28, 10.10.2026.
 *
 * Bu dosya yoktu: expo-router'ın varsayılan "Unmatched Route" ekranı çıkıyordu
 * (İngilizce, uygulamanın temasından bağımsız, geri dönüş yolu belirsiz).
 * Yer imi / eski bağlantı / yanlış yazılmış adres burada biter; tek düğme
 * kullanıcıyı oturumuna göre ana sayfaya ya da giriş ekranına götürür.
 * Metinler i18n'den (tr + en), renkler temadan (EmptyState/Screen üzerinden).
 */
export default function NotFoundScreen() {
  const t = useT();
  const oturumVar = useAuthStore((s) => !!s.session);

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} genislik="dar">
      <View style={styles.ortala}>
        <EmptyState
          icon="compass-outline"
          title={t('notFound.title')}
          description={t('notFound.body')}
          actionLabel={oturumVar ? t('notFound.home') : t('notFound.login')}
          onAction={() => router.replace(oturumVar ? '/(app)' : '/(auth)/login')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ortala: { flex: 1, justifyContent: 'center' },
});
