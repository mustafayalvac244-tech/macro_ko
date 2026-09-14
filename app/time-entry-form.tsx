import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { isMissingTimeTable, useCreateTimeEntry } from '@/hooks/useTimeEntries';
import { useAuthStore } from '@/store/authStore';
import { useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { formatDate, formatMoney } from '@/utils/format';
import { HIZLI_SURELER, dakikaBicimle, sureAyristir, tutarHesapla } from '@/utils/zamanKaydi';

/**
 * ZAMAN KAYDI FORMU.
 *
 * TASARIMIN TEK KRİTİK NOKTASI: SÜRE KUTUSU SESSİZ KALMAZ.
 * Avukat "1,5" yazdığında bunun 90 dakika mı 1 dakika mı sayıldığını tahmin
 * etmek zorunda kalmamalı — kutunun hemen altında okunan değer ("1 sa 30 dk")
 * ve hesaplanan tutar yazıyor. Yanlış yorumlanan bir süre doğrudan faturaya
 * gider; sessiz yanlış, görünür yanlıştan pahalıdır.
 */
export default function TimeEntryFormScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const t = useT();

  const params = useLocalSearchParams<{
    caseId?: string;
    caseTitle?: string;
    /** Sayaç durdurulduğunda ön-doldurulur. */
    minutes?: string;
  }>();

  const profile = useAuthStore((s) => s.profile);
  const create = useCreateTimeEntry();

  const [sure, setSure] = useState(params.minutes ?? '');
  const [description, setDescription] = useState('');
  const [workedAt, setWorkedAt] = useState(new Date());
  const [billable, setBillable] = useState(true);
  const [rate, setRate] = useState(
    profile?.hourly_rate != null ? String(profile.hourly_rate) : ''
  );
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dakika = useMemo(() => sureAyristir(sure), [sure]);
  const parsedRate = useMemo(() => {
    const n = Number(rate.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [rate]);

  const onizlemeTutar =
    dakika != null ? tutarHesapla({ minutes: dakika, billable, hourly_rate: parsedRate }) : 0;

  const kaydedilebilir = dakika != null && description.trim().length > 0;

  const handleSubmit = async () => {
    setError(null);
    if (dakika == null) {
      setError(t('time.durationInvalid'));
      return;
    }
    if (!description.trim()) {
      setError(t('time.descriptionRequired'));
      return;
    }
    try {
      await create.mutateAsync({
        case_id: params.caseId ?? null,
        description: description.trim(),
        minutes: dakika,
        worked_at: workedAt.toISOString(),
        billable,
        hourly_rate: billable ? parsedRate : null,
      });
      router.back();
    } catch (e) {
      setError(isMissingTimeTable(e) ? t('time.setupRequired') : t('time.saveFailed'));
    }
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} genislik="form">
      <ScreenHeader
        title={t('time.newTitle')}
        subtitle={params.caseTitle ?? t('time.noCase')}
        showBack
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Input
            label={t('time.duration')}
            placeholder={t('time.durationPlaceholder')}
            value={sure}
            onChangeText={setSure}
            icon="time-outline"
            autoFocus={!params.minutes}
          />

          {/* SÜRENİN NASIL OKUNDUĞU HER ZAMAN GÖRÜNÜR. Boş kutuda kuralı
              anlatır, dolu kutuda sonucu gösterir. */}
          <View style={styles.yorumKutu}>
            <Ionicons
              name={dakika == null ? 'information-circle-outline' : 'checkmark-circle'}
              size={16}
              color={dakika == null ? colors.textMuted : colors.success}
            />
            <Text style={[styles.yorumText, dakika != null && styles.yorumOk]}>
              {sure.trim().length === 0
                ? t('time.durationHint')
                : dakika == null
                  ? t('time.durationUnreadable')
                  : t('time.durationRead', { sure: dakikaBicimle(dakika) })}
            </Text>
          </View>

          <View style={styles.hizliSatir}>
            {HIZLI_SURELER.map((m) => (
              <Pressable
                key={m}
                style={[styles.hizli, dakika === m && styles.hizliSecili]}
                onPress={() => setSure(String(m))}
              >
                <Text style={[styles.hizliText, dakika === m && styles.hizliTextSecili]}>
                  {dakikaBicimle(m)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Input
            label={t('time.description')}
            placeholder={t('time.descriptionPlaceholder')}
            value={description}
            onChangeText={setDescription}
            icon="create-outline"
            multiline
            numberOfLines={2}
            style={styles.textArea}
          />

          <Text style={styles.label}>{t('time.workedAt')}</Text>
          <Pressable style={styles.dateButton} onPress={() => setShowPicker(true)}>
            <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
            <Text style={styles.dateButtonText}>{formatDate(workedAt.toISOString())}</Text>
          </Pressable>
          {showPicker && (
            <DateTimePicker
              locale="tr-TR"
              value={workedAt}
              mode="date"
              maximumDate={new Date()}
              onChange={(_e, date) => {
                if (Platform.OS === 'android') setShowPicker(false);
                if (date) setWorkedAt(date);
              }}
            />
          )}
          {Platform.OS === 'ios' && showPicker && (
            <Button
              label={t('common.done')}
              size="sm"
              variant="secondary"
              onPress={() => setShowPicker(false)}
              style={styles.pickerDone}
            />
          )}

          <View style={styles.switchRow}>
            <View style={styles.switchTexts}>
              <Text style={styles.switchLabel}>{t('time.billable')}</Text>
              <Text style={styles.switchHint}>{t('time.billableHint')}</Text>
            </View>
            <Switch
              value={billable}
              onValueChange={setBillable}
              trackColor={{ false: colors.border, true: colors.primaryMuted }}
              thumbColor={billable ? colors.primary : undefined}
            />
          </View>

          {billable && (
            <>
              <Input
                label={t('time.hourlyRate')}
                placeholder={t('time.hourlyRatePlaceholder')}
                value={rate}
                onChangeText={setRate}
                keyboardType="decimal-pad"
                icon="cash-outline"
              />
              {/* ÜCRETİ BOŞ BIRAKMAK YASAK DEĞİL ama sonucunu söylüyoruz:
                  o kayıt toplam tutarda görünmez. Sessizce 0 yazmak, eksik
                  fatura kesilmesinin en kolay yoludur. */}
              <View style={styles.tutarKutu}>
                <Text style={styles.tutarLabel}>
                  {parsedRate == null ? t('time.noRateWarn') : t('time.previewAmount')}
                </Text>
                {parsedRate != null && (
                  <Text style={styles.tutarDeger}>{formatMoney(onizlemeTutar)}</Text>
                )}
              </View>
            </>
          )}

          <Button
            label={t('time.save')}
            onPress={handleSubmit}
            loading={create.isPending}
            disabled={!kaydedilebilir}
            fullWidth
            size="lg"
            style={styles.submit}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
    errorBox: {
      flexDirection: 'row',
      gap: spacing.xs,
      backgroundColor: colors.dangerSoft,
      borderWidth: 1,
      borderColor: colors.danger,
      borderRadius: 12,
      padding: spacing.sm,
      marginBottom: spacing.md,
    },
    errorText: { ...typography.caption, color: colors.danger, flex: 1, lineHeight: 18 },
    yorumKutu: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: -spacing.xs,
      marginBottom: spacing.md,
      paddingHorizontal: spacing.xxs,
    },
    yorumText: { ...typography.caption, color: colors.textSecondary, flex: 1, lineHeight: 18 },
    yorumOk: { ...typography.bodyMedium, color: colors.textPrimary },
    hizliSatir: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    hizli: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    hizliSecili: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    hizliText: { ...typography.caption, color: colors.textSecondary },
    hizliTextSecili: { color: colors.primary },
    label: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs },
    textArea: { minHeight: 68, textAlignVertical: 'top' },
    dateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginBottom: spacing.lg,
    },
    dateButtonText: { ...typography.body, color: colors.textPrimary },
    pickerDone: { alignSelf: 'flex-end', marginBottom: spacing.md },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    switchTexts: { flex: 1 },
    switchLabel: { ...typography.bodyMedium, color: colors.textPrimary },
    switchHint: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
    tutarKutu: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 12,
      padding: spacing.sm,
      marginTop: -spacing.xs,
    },
    tutarLabel: { ...typography.caption, color: colors.textSecondary, flex: 1 },
    tutarDeger: { ...typography.h3, color: colors.textPrimary },
    submit: { marginTop: spacing.xl },
  });
