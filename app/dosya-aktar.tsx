import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { uyar } from '@/lib/uyari';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { HukukiUyari } from '@/components/ui/HukukiUyari';
import { ComingSoon } from '@/components/ComingSoon';
import { AI_AKTARMA_ENABLED } from '@/config/features';
import { supabase } from '@/lib/supabase';
// Hata çevirisi ORTAK: aynı mantık ekranlarda ayrı yazılınca biri güncellenip
// diğerleri geride kalıyordu (bkz. src/lib/aiHata.ts).
import { aiHataGovdesi, aiHataMetni } from '@/lib/aiHata';
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

/** Belgeden okunan taraflar — karşı tarafı avukat bunlardan seçer. */
interface Taraflar {
  davaci: string;
  davali: string;
}

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
  // TARAFLARIN İKİSİ DE OKUNUR, SEÇİMİ AVUKAT YAPAR.
  //
  // Ölçülen arıza: yedi senaryonun ikisinde karşı taraf boş kaldı ve model
  // HAKLIYDI — belge kimin vekili olduğumuzu söylemiyor, hangi tarafın karşı
  // taraf olduğu belgeden çıkarılamaz. Modele tahmin ettirmek dosyayı ters
  // kurma riskiydi; avukata boş alan bırakmak da çözüm değildi. İki taraf da
  // gösteriliyor, bir dokunuşla seçiliyor.
  const [taraflar, setTaraflar] = useState<Taraflar>({ davaci: '', davali: '' });
  // Sunucunun belgede bulamadığı için attığı alanlar.
  const [atilan, setAtilan] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (!AI_AKTARMA_ENABLED) {
    return <ComingSoon headerTitle={t('imp.title')} title={t('soon.import')} desc={t('soon.desc')} icon="cloud-upload" />;
  }


  const pickAndRead = async () => {
    setError(null);
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
          uyar(t('imp.title'), t('docrev.fileErr'));
          return;
        }
        text = (data as { text?: string } | null)?.text ?? '';
      }
      if (!text.trim()) {
        uyar(t('imp.title'), t('docrev.fileEmpty'));
        return;
      }
      setRawLen(text.length);

      // 2) Künyeyi SUNUCU çıkarır.
      //
      // İstem eskiden burada kuruluyordu ve bu üç şeyi imkânsız kılıyordu:
      // çıkarımı ÖLÇMEK, istemi uygulama güncellemesi olmadan iyileştirmek ve
      // çıkan künyeyi DENETLEMEK. Üstelik istek genel sohbet moduna gidiyordu.
      // Sunucu artık belgede karşılığı olmayan alanı ATIYOR: uydurma bir esas
      // numarası, boş alandan çok daha tehlikelidir — dolu görünür, kimse bir
      // daha bakmaz.
      setStage(t('imp.stageRead'));
      const { data: aiData, error: aiErr } = await supabase.functions.invoke('ai-chat', {
        body: { mode: 'kunye', question: text.slice(0, 9000) },
      });
      if (aiErr) {
        setError(aiHataMetni(await aiHataGovdesi(aiErr), t));
        return;
      }
      const yanit = aiData as {
        kunye?: Partial<Extracted> & { davaci?: string; davali?: string };
        atilan?: string[];
      } | null;
      const k = yanit?.kunye ?? {};
      setForm({
        title: (k.title ?? '').trim(),
        court_name: (k.court_name ?? '').trim(),
        case_number: (k.case_number ?? '').trim(),
        case_type: (k.case_type ?? '').trim(),
        opposing_party: (k.opposing_party ?? '').trim(),
        hearing_date: /^\d{4}-\d{2}-\d{2}$/.test(k.hearing_date ?? '') ? k.hearing_date! : '',
      });
      setTaraflar({ davaci: (k.davaci ?? '').trim(), davali: (k.davali ?? '').trim() });
      setAtilan(yanit?.atilan ?? []);
      setStep('review');
    } catch {
      uyar(t('imp.title'), t('docrev.fileErr'));
    } finally {
      setBusy(false);
      setStage('');
    }
  };

  const save = async () => {
    if (!form.title.trim()) {
      uyar(t('imp.title'), t('imp.needTitle'));
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
      uyar(t('imp.title'), t('imp.saved'), [
        { text: t('common.done'), onPress: () => router.replace('/(app)/cases') },
      ]);
    } catch {
      uyar(t('imp.title'), t('imp.saveFailed'));
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
          {/* HATA MESAJI EKRANDA. setError çağrılıyordu ama hiçbir yerde
              çizilmiyordu: kota dolduğunda ya da sağlayıcı cevap vermediğinde
              kullanıcı hiçbir şey görmüyor, ekran sessizce eski hâlinde
              kalıyordu. */}
          {!!error && (
            <View style={styles.hataKutu}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
              <Text style={styles.hataMetin}>{error}</Text>
            </View>
          )}
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
              {/* Alanları belgeden YAPAY ZEKÂ çıkardı; esas no ya da mahkeme
                  yanlış okunursa dosya ters kurulur. Uyarı alanların HEMEN
                  ÜSTÜNDE: aşağı inince görünmeyen bir uyarının hükmü olmaz. */}
              <HukukiUyari tur="yapayZeka" kucuk />

              {/* SUNUCUNUN ATTIĞI ALANLAR. Belgede karşılığı bulunamayan alan
                  boşaltılıyor; avukat neyin neden boş olduğunu bilmeli, yoksa
                  "okuyamadı" ile "belgede yoktu" ayırt edilemez. */}
              {atilan.length > 0 && (
                <Text style={styles.uyari}>{t('imp.dropped', { alanlar: atilan.join(', ') })}</Text>
              )}
              <Field label={t('imp.fTitle')} value={form.title} onChange={(v) => setForm((f) => ({ ...f, title: v }))} placeholder={t('imp.fTitlePh')} />
              <Field label={t('imp.fCourt')} value={form.court_name} onChange={(v) => setForm((f) => ({ ...f, court_name: v }))} />
              <Field label={t('imp.fNumber')} value={form.case_number} onChange={(v) => setForm((f) => ({ ...f, case_number: v }))} />
              <Field label={t('imp.fType')} value={form.case_type} onChange={(v) => setForm((f) => ({ ...f, case_type: v }))} />
              <Field label={t('imp.fOpposing')} value={form.opposing_party} onChange={(v) => setForm((f) => ({ ...f, opposing_party: v }))} />
              {/* KARŞI TARAFI AVUKAT SEÇER. Belge kimin vekili olduğumuzu
                  söylemediği için hangi tarafın karşı taraf olduğu belgeden
                  ÇIKARILAMAZ; modele tahmin ettirmek dosyayı ters kurma riskiydi.
                  İki taraf da okunup gösteriliyor: bir dokunuş, sıfır tahmin. */}
              {(!!taraflar.davaci || !!taraflar.davali) && (
                <View style={styles.tarafSec}>
                  <Text style={styles.tarafBaslik}>{t('imp.pickOpposing')}</Text>
                  <View style={styles.tarafSiraSat}>
                    {[
                      { etiket: t('imp.plaintiff'), ad: taraflar.davaci },
                      { etiket: t('imp.defendant'), ad: taraflar.davali },
                    ]
                      .filter((x) => !!x.ad)
                      .map((x) => {
                        const secili = form.opposing_party.trim() === x.ad.trim();
                        return (
                          <Pressable
                            key={x.etiket}
                            onPress={() => setForm((f) => ({ ...f, opposing_party: secili ? '' : x.ad }))}
                            style={[styles.tarafChip, secili && styles.tarafChipAktif]}
                          >
                            <Text style={[styles.tarafChipMetin, secili && styles.tarafChipMetinAktif]}>
                              {x.etiket}: {x.ad}
                            </Text>
                          </Pressable>
                        );
                      })}
                  </View>
                </View>
              )}
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
  uyari: { fontFamily: fonts.semibold, fontSize: 12.5, lineHeight: 18, color: colors.warning, marginBottom: spacing.sm },
  hataKutu: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: spacing.sm,
    borderRadius: 10,
    backgroundColor: colors.danger + '14',
    marginBottom: spacing.md,
  },
  hataMetin: { flex: 1, fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.danger },
  tarafSec: { marginTop: -spacing.xs, marginBottom: spacing.sm },
  tarafBaslik: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.textMuted, marginBottom: 6 },
  tarafSiraSat: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tarafChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  tarafChipAktif: { borderColor: colors.primary, backgroundColor: colors.primary + '18' },
  tarafChipMetin: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  tarafChipMetinAktif: { fontFamily: fonts.semibold, color: colors.primary },
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
