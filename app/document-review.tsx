import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ComingSoon } from '@/components/ComingSoon';
import { AI_ENABLED } from '@/config/features';
import { supabase } from '@/lib/supabase';
import { aiHataGovdesi, aiHataMetni } from '@/lib/aiHata';
import type { AiKullanim } from '@/hooks/useAiKontor';
import { useT } from '@/i18n';
import { fonts, spacing, shadow } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

/** İnceleme odağı — AI'ya "neye bakayım" talimatını belirler. */
type DocKind = 'sozlesme' | 'dilekce' | 'ihtarname' | 'karar' | 'diger';

const KINDS: DocKind[] = ['sozlesme', 'dilekce', 'ihtarname', 'karar', 'diger'];

/** Bağlam taşmasın diye üst sınır; aşarsa baştan kırpılır ve kullanıcı uyarılır. */
const MAX_CHARS = 12000;

export default function DocumentReviewScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const t = useT();

  const [kind, setKind] = useState<DocKind>('sozlesme');
  const [text, setText] = useState('');
  const [result, setResult] = useState('');
  // İncelemede geçip BELGEDE OLMAYAN tarihler sunucuda ayıklanıyor. Avukat
  // bunu bilmeli: belgeyi zaten okuduğunu varsayar ve incelemedeki bir tarihi
  // ajandasına yazabilir. Kaç tanesinin ayıklandığı, kalanları da denetlemesi
  // gerektiğinin işaretidir.
  const [ayiklanan, setAyiklanan] = useState(0);
  // Kullanım ve iade — sunucu üç modda da destekliyor.
  const [kullanim, setKullanim] = useState<AiKullanim | null>(null);
  const [istekId, setIstekId] = useState<string | null>(null);
  const [iadeEdildi, setIadeEdildi] = useState(false);
  const [hakDusulmedi, setHakDusulmedi] = useState(false);
  const [busy, setBusy] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!AI_ENABLED) {
    return <ComingSoon headerTitle={t('docrev.title')} title={t('soon.docrev')} desc={t('soon.desc')} icon="scan" />;
  }

  /**
   * Dosyadan metin al: PDF / DOCX / UDF (UYAP) / TXT. Bu formatlardan metin
   * çıkarımı sunucudaki doc-extract fonksiyonunda yapılır (telefonda native
   * kütüphane gerekirdi). Alıcı isteği: "pdf, doc ve UDF ekleyemeyecek miyiz?"
   */
  const pickFile = async () => {
    setExtracting(true);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
          'application/msword', // .doc
          'text/plain',
          '*/*', // .udf gibi bilinmeyen MIME'ler için
        ],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      const name = (asset.name || '').toLowerCase();

      // Düz metin dosyasını doğrudan oku (sunucuya gitmeye gerek yok).
      if (name.endsWith('.txt')) {
        const content = await new File(asset.uri).text();
        if (!content.trim()) {
          Alert.alert(t('docrev.title'), t('docrev.fileEmpty'));
          return;
        }
        setText(content.slice(0, MAX_CHARS));
        return;
      }

      const base64 = await new File(asset.uri).base64();
      const { data, error: fnErr } = await supabase.functions.invoke('doc-extract', {
        body: { filename: name, base64 },
      });
      if (fnErr) {
        // Gövde okuma ortak yardımcıdan; kod eşlemesi doc-extract'e özgü.
        const govde = await aiHataGovdesi(fnErr);
        const code = govde.error ?? '';
        Alert.alert(
          t('docrev.title'),
          code === 'pdf_no_text'
            ? t('docrev.errScanned')
            : code === 'doc_legacy'
              ? t('docrev.errDocLegacy')
              : code === 'too_large'
                ? t('docrev.errTooLarge')
                : t('docrev.fileErr')
        );
        return;
      }
      const extracted = (data as { text?: string } | null)?.text ?? '';
      if (!extracted.trim()) {
        Alert.alert(t('docrev.title'), t('docrev.fileEmpty'));
        return;
      }
      setText(extracted.slice(0, MAX_CHARS));
    } catch {
      Alert.alert(t('docrev.title'), t('docrev.fileErr'));
    } finally {
      setExtracting(false);
    }
  };

  const analyze = async () => {
    const body = text.trim();
    if (body.length < 80 || busy) return;
    setBusy(true);
    setError(null);
    setResult('');
    setIstekId(null);
    setIadeEdildi(false);
    setHakDusulmedi(false);
    try {
      // İNCELEME İSTEMİ SUNUCUDA. Burada kurulduğu sürece iki şey mümkün
      // değildi: incelemeyi ölçmek (ölçüm aracı istemi taklit etmek zorunda
      // kalırdı, yani kullanıcının gördüğü çıktı ölçülmezdi) ve istemi
      // uygulama güncellemesi olmadan iyileştirmek. Sunucu ayrıca belge
      // türüne göre mevzuat besliyor ve incelemede geçen ama BELGEDE OLMAYAN
      // tarihleri ayıklıyor.
      const { data, error: fnErr } = await supabase.functions.invoke('ai-chat', {
        body: { mode: 'belge', docKind: kind, question: body },
      });
      if (fnErr) {
        // Hata çevirisi ORTAK: aynı mantık üç ekranda ayrı yazılınca biri
        // güncellenip diğerleri geride kalıyordu (bkz. src/lib/aiHata.ts).
        const govde = await aiHataGovdesi(fnErr);
        const code = govde.error ?? '';
        setError(aiHataMetni(govde, t));
        return;
      }
      const yanit = data as { text?: string; ayiklananTarih?: number; kullanim?: AiKullanim; istekId?: string | null; hakDusulmedi?: boolean } | null;
      const reply = yanit?.text?.trim();
      if (!reply) {
        setError(t('ai.errGeneric'));
        return;
      }
      setResult(reply);
      setAyiklanan(Number(yanit?.ayiklananTarih ?? 0));
      setKullanim(yanit?.kullanim ?? null);
      setIstekId(yanit?.istekId ?? null);
      setIadeEdildi(false);
      setHakDusulmedi(!!yanit?.hakDusulmedi);
    } catch {
      setError(t('ai.errGeneric'));
    } finally {
      setBusy(false);
    }
  };

  const iadeIste = async () => {
    if (!istekId || iadeEdildi) return;
    try {
      await supabase.functions.invoke('ai-chat', { body: { mode: 'iade', istekId, sebep: 'belge' } });
      setIadeEdildi(true);
    } catch {
      // Sessiz: iade edilemediyse kullanıcı tekrar deneyebilir.
    }
  };

  const tooShort = text.trim().length < 80;

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('docrev.title')} showBack />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.lead}>{t('docrev.lead')}</Text>

          <View style={styles.chips}>
            {KINDS.map((k) => (
              <Pressable key={k} onPress={() => setKind(k)} style={[styles.chip, kind === k && styles.chipActive]}>
                <Text style={[styles.chipText, kind === k && styles.chipTextActive]}>{t(`docrev.kind.${k}` as const)}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={pickFile}
            disabled={extracting}
            style={({ pressed }) => [styles.fileBtn, pressed && { opacity: 0.85 }, extracting && { opacity: 0.6 }]}
          >
            {extracting ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="document-attach-outline" size={18} color={colors.primary} />
            )}
            <Text style={styles.fileBtnText}>{extracting ? t('docrev.extracting') : t('docrev.pickFile')}</Text>
          </Pressable>

          <TextInput
            style={styles.area}
            value={text}
            onChangeText={(v) => setText(v.slice(0, MAX_CHARS))}
            placeholder={t('docrev.placeholder')}
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
          />
          <View style={styles.metaRow}>
            <Text style={styles.meta}>{t('docrev.chars', { n: text.trim().length })}</Text>
            {text.length >= MAX_CHARS && <Text style={styles.metaWarn}>{t('docrev.truncated')}</Text>}
          </View>

          <Pressable
            onPress={analyze}
            disabled={tooShort || busy}
            style={({ pressed }) => [styles.cta, (tooShort || busy) && styles.ctaOff, pressed && { opacity: 0.85 }]}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="sparkles" size={17} color="#FFFFFF" />
            )}
            <Text style={styles.ctaText}>{busy ? t('docrev.analyzing') : t('docrev.analyze')}</Text>
          </Pressable>

          {!!error && (
            <View style={styles.errBox}>
              <Ionicons name="alert-circle-outline" size={17} color={colors.danger} />
              <Text style={styles.errText}>{error}</Text>
            </View>
          )}

          {!!result && (
            <View style={styles.resultCard}>
              <View style={styles.resultHead}>
                <Text style={styles.resultTitle}>{t('docrev.resultTitle')}</Text>
                <Pressable onPress={() => Share.share({ message: result }).catch(() => {})} hitSlop={8}>
                  <Ionicons name="share-outline" size={19} color={colors.primary} />
                </Pressable>
              </View>
              {/* selectable: avukat bulguları kopyalayıp dilekçeye taşıyabilsin */}
              <Text selectable style={styles.resultText}>{result}</Text>
              <Text style={styles.disclaimer}>{t('docrev.disclaimer')}</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1 },
  usage: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  refundBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingVertical: 4,
  },
  refundText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.textMuted,
  },
  warn: {
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.warning,
    marginTop: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  lead: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  chip: {
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
  chipText: {
    fontFamily: fonts.semibold,
    fontWeight: '600',
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  fileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: spacing.sm,
  },
  fileBtnText: {
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 13.5,
    color: colors.primary,
  },
  area: {
    minHeight: 190,
    maxHeight: 320,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: spacing.md,
  },
  meta: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: colors.textMuted,
  },
  metaWarn: {
    fontFamily: fonts.semibold,
    fontWeight: '600',
    fontSize: 11.5,
    color: colors.warning,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
  },
  ctaOff: {
    opacity: 0.45,
  },
  ctaText: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 15,
    color: '#FFFFFF',
  },
  errBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.dangerSoft,
    borderRadius: 12,
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  errText: {
    fontFamily: fonts.medium,
    fontSize: 12.5,
    color: colors.danger,
    flex: 1,
    lineHeight: 18,
  },
  resultCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.lg,
    marginTop: spacing.lg,
    ...shadow.card,
  },
  resultHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  resultTitle: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: -0.3,
    color: colors.textPrimary,
  },
  resultText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textPrimary,
  },
  disclaimer: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
});
