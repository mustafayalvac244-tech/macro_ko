import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { supabase } from '@/lib/supabase';
import { useCreateCase } from '@/hooks/useCases';
import { useCreateHearing } from '@/hooks/useHearings';
import { useT } from '@/i18n';
import { fonts, spacing, shadow } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

/** AI'nın belgeden çıkardığı dosya bilgileri. */
interface Extracted {
  title: string;
  court_name: string;
  case_number: string;
  case_type: string;
  opposing_party: string;
  hearing_date: string; // YYYY-MM-DD veya boş
}

const EMPTY: Extracted = {
  title: '',
  court_name: '',
  case_number: '',
  case_type: '',
  opposing_party: '',
  hearing_date: '',
};

/**
 * BELGEDEN DOSYA AKTARMA — UYAP entegrasyonunun pratik köprüsü.
 * Avukat UYAP'tan dosyasını UDF/PDF olarak indirir, buraya yükler; uygulama
 * metni çıkarır, AI ile mahkeme/esas no/taraflar/duruşma tarihini okur ve
 * dosya kaydını hazır getirir. Resmi entegrasyon izni gerekmez.
 */
export default function DosyaAktarScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const t = useT();

  const createCase = useCreateCase();
  const createHearing = useCreateHearing();

  const [step, setStep] = useState<'pick' | 'review'>('pick');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [form, setForm] = useState<Extracted>(EMPTY);
  const [rawLen, setRawLen] = useState(0);

  const parseJson = (raw: string): Partial<Extracted> | null => {
    const c = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    const s = c.indexOf('{');
    const e = c.lastIndexOf('}');
    if (s < 0 || e <= s) return null;
    try {
      return JSON.parse(c.slice(s, e + 1)) as Partial<Extracted>;
    } catch {
      return null;
    }
  };

  const pickAndRead = async () => {
    setBusy(true);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      const name = (asset.name || '').toLowerCase();

      // 1) Metni çıkar
      setStage(t('imp.stageExtract'));
      let text = '';
      if (name.endsWith('.txt')) {
        text = await new File(asset.uri).text();
      } else {
        const base64 = await new File(asset.uri).base64();
        const { data, error } = await supabase.functions.invoke('doc-extract', { body: { filename: name, base64 } });
        if (error) {
          Alert.alert(t('imp.title'), t('docrev.fileErr'));
          return;
        }
        text = (data as { text?: string } | null)?.text ?? '';
      }
      if (!text.trim()) {
        Alert.alert(t('imp.title'), t('docrev.fileEmpty'));
        return;
      }
      setRawLen(text.length);

      // 2) AI ile dosya bilgilerini oku
      setStage(t('imp.stageRead'));
      const prompt =
        'Aşağıdaki hukuki belgeden dosya künyesini çıkar. SADECE şu JSON şemasında yanıt ver, ' +
        'başka hiçbir açıklama yazma. Bilgi yoksa o alanı boş string bırak, UYDURMA:\n' +
        '{"title":"kısa dosya başlığı","court_name":"mahkeme adı","case_number":"esas no",' +
        '"case_type":"dava türü","opposing_party":"karşı taraf","hearing_date":"YYYY-MM-DD"}\n\n' +
        '--- BELGE ---\n' +
        text.slice(0, 9000);
      const { data: aiData, error: aiErr } = await supabase.functions.invoke('ai-chat', {
        body: { messages: [{ role: 'user', text: prompt }] },
      });
      if (aiErr) {
        Alert.alert(t('imp.title'), t('ai.errGeneric'));
        return;
      }
      const parsed = parseJson((aiData as { text?: string } | null)?.text ?? '');
      setForm({
        title: parsed?.title?.trim() || '',
        court_name: parsed?.court_name?.trim() || '',
        case_number: parsed?.case_number?.trim() || '',
        case_type: parsed?.case_type?.trim() || '',
        opposing_party: parsed?.opposing_party?.trim() || '',
        hearing_date: /^\d{4}-\d{2}-\d{2}$/.test(parsed?.hearing_date ?? '') ? parsed!.hearing_date! : '',
      });
      setStep('review');
    } catch {
      Alert.alert(t('imp.title'), t('docrev.fileErr'));
    } finally {
      setBusy(false);
      setStage('');
    }
  };

  const save = async () => {
    if (!form.title.trim()) {
      Alert.alert(t('imp.title'), t('imp.needTitle'));
      return;
    }
    setBusy(true);
    try {
      const created = await createCase.mutateAsync({
        title: form.title.trim(),
        court_name: form.court_name.trim() || null,
        case_number: form.case_number.trim() || null,
        case_type: form.case_type.trim() || null,
        opposing_party: form.opposing_party.trim() || null,
      });
      // Duruşma tarihi okunduysa takvime de yaz.
      if (form.hearing_date && created?.id) {
        try {
          await createHearing.mutateAsync({
            case_id: created.id,
            title: form.case_type.trim() || t('imp.hearingTitle'),
            type: 'hearing',
            location: form.court_name.trim() || null,
            scheduled_at: new Date(`${form.hearing_date}T10:00:00`).toISOString(),
            reminder_minutes_before: 1440,
            notes: null,
            caseTitle: form.title.trim(),
          });
        } catch {
          // duruşma yazılamazsa dosya yine oluşmuş olur
        }
      }
      Alert.alert(t('imp.title'), t('imp.saved'), [
        { text: t('common.done'), onPress: () => router.replace('/(app)/cases') },
      ]);
    } catch {
      Alert.alert(t('imp.title'), t('imp.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const Field = ({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
      />
    </View>
  );

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('imp.title')} showBack />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {step === 'pick' ? (
            <>
              <Text style={styles.lead}>{t('imp.lead')}</Text>
              <View style={styles.steps}>
                <StepRow n="1" text={t('imp.step1')} />
                <StepRow n="2" text={t('imp.step2')} />
                <StepRow n="3" text={t('imp.step3')} />
              </View>
              <Pressable onPress={pickAndRead} disabled={busy} style={({ pressed }) => [styles.cta, busy && styles.ctaOff, pressed && { opacity: 0.85 }]}>
                {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />}
                <Text style={styles.ctaText}>{busy ? stage || t('imp.working') : t('imp.pick')}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.okBox}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={styles.okText}>{t('imp.readOk', { n: rawLen })}</Text>
              </View>
              <Text style={styles.lead}>{t('imp.reviewLead')}</Text>

              <Field label={t('imp.fTitle')} value={form.title} onChange={(v) => setForm((f) => ({ ...f, title: v }))} placeholder={t('imp.fTitlePh')} />
              <Field label={t('imp.fCourt')} value={form.court_name} onChange={(v) => setForm((f) => ({ ...f, court_name: v }))} />
              <Field label={t('imp.fNumber')} value={form.case_number} onChange={(v) => setForm((f) => ({ ...f, case_number: v }))} />
              <Field label={t('imp.fType')} value={form.case_type} onChange={(v) => setForm((f) => ({ ...f, case_type: v }))} />
              <Field label={t('imp.fOpposing')} value={form.opposing_party} onChange={(v) => setForm((f) => ({ ...f, opposing_party: v }))} />
              <Field label={t('imp.fHearing')} value={form.hearing_date} onChange={(v) => setForm((f) => ({ ...f, hearing_date: v }))} placeholder="2026-09-15" />
              {!!form.hearing_date && (
                <View style={styles.noteBox}>
                  <Ionicons name="calendar-outline" size={15} color={colors.primary} />
                  <Text style={styles.noteText}>{t('imp.willAddHearing')}</Text>
                </View>
              )}

              <Pressable onPress={save} disabled={busy} style={({ pressed }) => [styles.cta, busy && styles.ctaOff, pressed && { opacity: 0.85 }]}>
                {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="save-outline" size={18} color="#FFFFFF" />}
                <Text style={styles.ctaText}>{t('imp.save')}</Text>
              </Pressable>
              <Pressable onPress={() => { setStep('pick'); setForm(EMPTY); }} style={styles.again}>
                <Text style={styles.againText}>{t('imp.again')}</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function StepRow({ n, text }: { n: string; text: string }) {
  const __t = useTheme();
  const styles = makeStyles(__t.colors);
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepNum}><Text style={styles.stepNumText}>{n}</Text></View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  lead: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.textSecondary, marginBottom: spacing.md },
  steps: { gap: spacing.sm, marginBottom: spacing.lg },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontFamily: fonts.extrabold, fontWeight: '800', fontSize: 12, color: colors.primary },
  stepText: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textPrimary, flex: 1, lineHeight: 19 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 15, marginTop: spacing.md },
  ctaOff: { opacity: 0.5 },
  ctaText: { fontFamily: fonts.extrabold, fontWeight: '800', fontSize: 15, color: '#FFFFFF' },
  okBox: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.successSoft, borderRadius: 12, padding: spacing.sm, marginBottom: spacing.md },
  okText: { fontFamily: fonts.semibold, fontWeight: '600', fontSize: 12.5, color: colors.success, flex: 1 },
  field: { marginBottom: spacing.sm },
  label: { fontFamily: fonts.semibold, fontWeight: '600', fontSize: 12, color: colors.textSecondary, marginBottom: 5 },
  input: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.borderSubtle, paddingHorizontal: spacing.md, paddingVertical: 12, fontFamily: fonts.regular, fontSize: 14, color: colors.textPrimary },
  noteBox: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.primarySoft, borderRadius: 12, padding: spacing.sm, marginTop: 2 },
  noteText: { fontFamily: fonts.medium, fontSize: 12, color: colors.textPrimary, flex: 1, lineHeight: 17 },
  again: { alignItems: 'center', paddingVertical: spacing.md },
  againText: { fontFamily: fonts.semibold, fontWeight: '600', fontSize: 13, color: colors.primary },
  ...({} as Record<string, never>),
});
