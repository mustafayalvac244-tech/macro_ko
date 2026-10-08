import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { supabase, DOCUMENTS_BUCKET } from '@/lib/supabase';
import { udfMi } from '@/lib/belgeTurleri';
import { baytlariBase64 } from '@/utils/base64Metni';
import { useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

export default function DocumentViewerScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);

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
  // UDF UYGULAMADA OKUNUR (04.10.2026). Kasaya UDF yüklenebilir oldu; ama UDF
  // bir ZIP paketi, ne tarayıcı ne telefon onu gösterir. "Harici uygulamada
  // aç" yalnız UYAP Editör kurulu bilgisayarda işe yarar. Metni, belge
  // incelemenin kullandığı aynı sunucu ucu (doc-extract) çıkarır; dosya
  // saklanmaz, yalnız metin döner.
  const isUdf = udfMi(name);
  const [udfMetni, setUdfMetni] = useState<string | null>(null);
  const [udfHata, setUdfHata] = useState(false);

  useEffect(() => {
    if (!url || !isUdf) return;
    let active = true;
    (async () => {
      try {
        const yanit = await fetch(url);
        if (!yanit.ok) throw new Error(String(yanit.status));
        const base64 = baytlariBase64(new Uint8Array(await yanit.arrayBuffer()));
        const { data, error: fnErr } = await supabase.functions.invoke('doc-extract', {
          body: { filename: name ?? 'belge.udf', base64 },
        });
        const metin = (data as { text?: string } | null)?.text ?? '';
        if (!active) return;
        if (fnErr || !metin.trim()) setUdfHata(true);
        else setUdfMetni(metin);
      } catch {
        if (active) setUdfHata(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [url, isUdf, name]);

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

      {/* PDF ÖNİZLEME GOOGLE'A GİTMİYOR (08.10.2026). Eskiden imzalı dosya
          bağlantısı docs.google.com/gview'e veriliyordu: müvekkil belgesi
          Google sunucusuna indiriliyordu, oysa aydınlatma metni belgelerin
          üçüncü tarafa gitmediğini söylüyor. iOS'un WebView'i PDF'i kendisi
          gösterir. Android WebView PDF gösteremez, web'de WebView yok: ikisinde
          belge cihazın kendi PDF görüntüleyicisinde / yeni sekmede açılır. */}
      {url && isPdf && Platform.OS !== 'ios' && (
        <View style={styles.center}>
          <Text style={styles.fallbackText}>{t('viewer.pdfDisarida')}</Text>
          <Button label={t('viewer.openExternal')} icon="open-outline" onPress={() => Linking.openURL(url)} style={styles.fallbackBtn} />
        </View>
      )}

      {url && isPdf && Platform.OS === 'ios' && (
        <WebView
          style={styles.flex}
          source={{ uri: url }}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          )}
        />
      )}

      {url && isUdf && !udfMetni && !udfHata && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.udfBekle}>{t('viewer.udfReading')}</Text>
        </View>
      )}

      {url && isUdf && !!udfMetni && (
        <ScrollView style={styles.flex} contentContainerStyle={styles.udfWrap}>
          <Text style={styles.udfNot}>{t('viewer.udfNote')}</Text>
          <Text selectable style={styles.udfMetin}>
            {udfMetni}
          </Text>
          <Button
            label={t('viewer.openExternal')}
            icon="open-outline"
            variant="secondary"
            onPress={() => Linking.openURL(url)}
            style={styles.fallbackBtn}
          />
        </ScrollView>
      )}

      {url && !isImage && !isPdf && (!isUdf || udfHata) && (
        <View style={styles.center}>
          <Text style={styles.fallbackText}>{t('viewer.unsupported')}</Text>
          <Button label={t('viewer.openExternal')} icon="open-outline" onPress={() => Linking.openURL(url)} style={styles.fallbackBtn} />
        </View>
      )}
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
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
  udfWrap: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  udfBekle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  udfNot: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  udfMetin: {
    ...typography.body,
    color: colors.textPrimary,
    lineHeight: 22,
  },
});
