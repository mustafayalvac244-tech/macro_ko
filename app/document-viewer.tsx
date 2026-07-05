import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { supabase, DOCUMENTS_BUCKET } from '@/lib/supabase';
import { useT } from '@/i18n';
import { colors, spacing, typography } from '@/theme/theme';

export default function DocumentViewerScreen() {
  const t = useT();
  const { path, name, mime } = useLocalSearchParams<{ path: string; name: string; mime?: string }>();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrl(path, 60 * 10)
      .then(({ data, error: signErr }) => {
        if (!active) return;
        if (signErr || !data) setError(true);
        else setUrl(data.signedUrl);
      });
    return () => {
      active = false;
    };
  }, [path]);

  const isImage = (mime ?? '').startsWith('image/') || /\.(jpe?g|png|gif|webp|heic)$/i.test(name ?? '');
  const isPdf = (mime ?? '') === 'application/pdf' || /\.pdf$/i.test(name ?? '');

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={name ?? t('viewer.title')} showBack />

      {!url && !error && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      )}

      {error && (
        <View style={styles.center}>
          <Text style={styles.errorText}>{t('viewer.error')}</Text>
        </View>
      )}

      {url && isImage && (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.imageWrap}
          maximumZoomScale={4}
          minimumZoomScale={1}
          centerContent
        >
          <Image source={{ uri: url }} style={styles.image} resizeMode="contain" />
        </ScrollView>
      )}

      {url && isPdf && (
        <WebView
          style={styles.flex}
          source={{ uri: `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}` }}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          )}
        />
      )}

      {url && !isImage && !isPdf && (
        <View style={styles.center}>
          <Text style={styles.fallbackText}>{t('viewer.unsupported')}</Text>
          <Button label={t('viewer.openExternal')} icon="open-outline" onPress={() => Linking.openURL(url)} style={styles.fallbackBtn} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  imageWrap: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
    minHeight: 400,
  },
  errorText: {
    ...typography.body,
    color: colors.danger,
    textAlign: 'center',
  },
  fallbackText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  fallbackBtn: {
    marginTop: spacing.sm,
  },
});
