import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { differenceInCalendarDays, differenceInDays, differenceInMonths } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { formatDate, formatMoney } from '@/utils/format';

type CalcTab = 'aaut' | 'interest' | 'fee' | 'smm' | 'severance';

function parseAmount(v: string): number {
  const n = Number(v.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export default function CalculatorsScreen() {
  const __t = useTheme();
  const styles = makeStyles(__t.colors);

  const t = useT();
  const [tab, setTab] = useState<CalcTab>('aaut');

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('calc.title')} showBack />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <SegmentedControl
            options={[
              { value: 'aaut', label: t('calc.tabAaut') },
              { value: 'interest', label: t('calc.tabInterest') },
              { value: 'fee', label: t('calc.tabFee') },
              { value: 'smm', label: t('calc.tabSmm') },
              { value: 'severance', label: t('calc.tabSeverance') },
            ]}
            value={tab}
            onChange={setTab}
          />
          <View style={styles.spacer} />
          {tab === 'aaut' && <AautCalc />}
          {tab === 'interest' && <InterestCalc />}
          {tab === 'fee' && <CourtFeeCalc />}
          {tab === 'smm' && <SmmCalc />}
          {tab === 'severance' && <SeveranceCalc />}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function ResultRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const __t = useTheme();
  const styles = makeStyles(__t.colors);
  return (
    <View style={styles.resultRow}>
      <Text style={[styles.resultRowLabel, strong && styles.resultRowStrong]}>{label}</Text>
      <Text style={[styles.resultRowValue, strong && styles.resultRowStrong]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function Disclaimer({ text }: { text: string }) {
  const __t = useTheme();
  const styles = makeStyles(__t.colors);
  return <Text style={styles.disclaimer}>{text}</Text>;
}

/* ---------------- Vekalet Ücreti (AAÜT) ---------------- */

// AAÜT konusu para olan davalarda kademeli nispi tarife dilimleri.
// Oranlar tarifenin standart yüzdeleridir; dilim tutarları her yıl
// güncellenen tarifeye göre ayarlanabilir olsun diye burada tutulur.
const AAUT_BRACKETS: Array<{ upTo: number; rate: number }> = [
  { upTo: 400_000, rate: 0.16 },
  { upTo: 800_000, rate: 0.15 },
  { upTo: 1_600_000, rate: 0.14 },
  { upTo: 2_800_000, rate: 0.11 },
  { upTo: 4_400_000, rate: 0.08 },
  { upTo: 6_400_000, rate: 0.05 },
  { upTo: 8_800_000, rate: 0.03 },
  { upTo: 11_600_000, rate: 0.02 },
  { upTo: Infinity, rate: 0.01 },
];

function AautCalc() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);
  const t = useT();

  const [amountText, setAmountText] = useState('');
  const [minFeeText, setMinFeeText] = useState('30000');

  const amount = parseAmount(amountText);
  const minFee = parseAmount(minFeeText);

  const result = useMemo(() => {
    if (amount <= 0) return null;
    let remaining = amount;
    let prevCap = 0;
    let fee = 0;
    const rows: Array<{ label: string; portion: number; rate: number; fee: number }> = [];
    for (const b of AAUT_BRACKETS) {
      const bandSize = b.upTo - prevCap;
      const portion = Math.min(remaining, bandSize);
      if (portion <= 0) break;
      const bandFee = portion * b.rate;
      fee += bandFee;
      rows.push({
        label: b.upTo === Infinity ? '+' : formatMoney(b.upTo),
        portion,
        rate: b.rate,
        fee: bandFee,
      });
      remaining -= portion;
      prevCap = b.upTo;
    }
    const applied = Math.max(fee, minFee);
    return { fee, applied, usedMinimum: minFee > fee, rows };
  }, [amount, minFee]);

  return (
    <Card>
      <Text style={styles.calcTitle}>{t('calc.aaut.title')}</Text>
      <Text style={styles.calcDesc}>{t('calc.aaut.desc')}</Text>

      <Input
        label={t('calc.aaut.amount')}
        icon="cash-outline"
        keyboardType="numeric"
        placeholder="500.000"
        value={amountText}
        onChangeText={setAmountText}
      />
      <Input
        label={t('calc.aaut.minFee')}
        icon="shield-outline"
        keyboardType="numeric"
        value={minFeeText}
        onChangeText={setMinFeeText}
      />

      {result && (
        <View style={styles.resultCard}>
          {result.rows.map((r, i) => (
            <ResultRow
              key={i}
              label={`%${Math.round(r.rate * 100)} · ${formatMoney(r.portion)}`}
              value={formatMoney(r.fee)}
            />
          ))}
          <ResultRow label={t('calc.aaut.computed')} value={formatMoney(result.fee)} />
          <ResultRow label={t('calc.aaut.result')} value={formatMoney(result.applied)} strong />
          {result.usedMinimum && <Text style={styles.calcDesc}>{t('calc.aaut.minApplied')}</Text>}
        </View>
      )}

      <Disclaimer text={t('calc.aaut.disclaimer')} />
    </Card>
  );
}

/* ---------------- Faiz ---------------- */

function InterestCalc() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);
  const t = useT();

  const [principal, setPrincipal] = useState('');
  const [rate, setRate] = useState('24');
  const [start, setStart] = useState(() => new Date(Date.now() - 365 * 24 * 60 * 60 * 1000));
  const [end, setEnd] = useState(new Date());
  const [picker, setPicker] = useState<'start' | 'end' | null>(null);

  const p = parseAmount(principal);
  const r = parseAmount(rate);
  const days = Math.max(0, differenceInCalendarDays(end, start));
  const interest = (p * (r / 100) * days) / 365;

  return (
    <View>
      <Input label={t('calc.principal')} placeholder="100000" value={principal} onChangeText={setPrincipal} keyboardType="decimal-pad" icon="cash-outline" />
      <Input label={t('calc.rate')} placeholder="24" value={rate} onChangeText={setRate} keyboardType="decimal-pad" icon="trending-up-outline" />
      <View style={styles.presetRow}>
        {['9', '24', '48'].map((v) => (
          <Pressable key={v} style={[styles.presetChip, rate === v && styles.presetChipActive]} onPress={() => setRate(v)}>
            <Text style={[styles.presetChipText, rate === v && styles.presetChipTextActive]}>%{v}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.dateRow}>
        <View style={styles.dateCol}>
          <Text style={styles.label}>{t('calc.startDate')}</Text>
          <Pressable style={styles.dateButton} onPress={() => setPicker('start')}>
            <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
            <Text style={styles.dateButtonText}>{formatDate(start.toISOString())}</Text>
          </Pressable>
        </View>
        <View style={styles.dateCol}>
          <Text style={styles.label}>{t('calc.endDate')}</Text>
          <Pressable style={styles.dateButton} onPress={() => setPicker('end')}>
            <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
            <Text style={styles.dateButtonText}>{formatDate(end.toISOString())}</Text>
          </Pressable>
        </View>
      </View>
      {picker && (
        <DateTimePicker locale="tr-TR"
          value={picker === 'start' ? start : end}
          mode="date"
          onChange={(_e, date) => {
            const which = picker;
            if (Platform.OS === 'android') setPicker(null);
            if (date && which === 'start') setStart(date);
            if (date && which === 'end') setEnd(date);
          }}
        />
      )}
      {Platform.OS === 'ios' && picker && (
        <Button label={t('common.done')} size="sm" variant="secondary" onPress={() => setPicker(null)} style={styles.pickerDone} />
      )}

      {p > 0 && r > 0 && (
        <Card style={styles.resultCard}>
          <ResultRow label={t('calc.days')} value={String(days)} />
          <ResultRow label={t('calc.interestAmount')} value={formatMoney(interest)} />
          <View style={styles.resultDivider} />
          <ResultRow label={t('calc.total')} value={formatMoney(p + interest)} strong />
          <Disclaimer text={t('calc.interestDisclaimer')} />
        </Card>
      )}
    </View>
  );
}

/* ---------------- Harç ---------------- */

function CourtFeeCalc() {
  const t = useT();
  const [value, setValue] = useState('');
  const v = parseAmount(value);
  const kararHarci = v * 0.06831; // binde 68,31 nispi karar ve ilam harcı
  const pesin = kararHarci / 4;

  return (
    <View>
      <Input label={t('calc.claimValue')} placeholder="250000" value={value} onChangeText={setValue} keyboardType="decimal-pad" icon="scale-outline" />
      {v > 0 && (
        <Card>
          <ResultRow label={t('calc.decisionFee')} value={formatMoney(kararHarci)} />
          <ResultRow label={t('calc.advanceFee')} value={formatMoney(pesin)} strong />
          <Disclaimer text={t('calc.feeDisclaimer')} />
        </Card>
      )}
    </View>
  );
}

/* ---------------- SMM Makbuzu ---------------- */

function SmmCalc() {
  const __t = useTheme();
  const styles = makeStyles(__t.colors);
  const t = useT();
  const [mode, setMode] = useState<'gross' | 'net' | 'collect'>('net');
  const [amount, setAmount] = useState('');
  const [kdvRate, setKdvRate] = useState<'0.20' | '0.10'>('0.20');
  // Stopaj yalnızca vergi mükellefi (kurumsal) müvekkilden tahsilatta kesilir;
  // bireysel müvekkilde stopaj yoktur.
  const [stopajOn, setStopajOn] = useState(true);

  const a = parseAmount(amount);
  const k = Number(kdvRate);
  const s = stopajOn ? 0.2 : 0;
  const gross = mode === 'gross' ? a : mode === 'net' ? a / (1 - s) : a / (1 + k - s);
  const stopaj = gross * s;
  const net = gross - stopaj;
  const kdv = gross * k;
  const collect = net + kdv;

  return (
    <View>
      <SegmentedControl
        scrollable={false}
        options={[
          { value: 'net', label: t('calc.fromNet') },
          { value: 'gross', label: t('calc.fromGross') },
          { value: 'collect', label: t('calc.fromCollect') },
        ]}
        value={mode}
        onChange={setMode}
      />
      <View style={{ height: spacing.md }} />
      <Input
        label={mode === 'net' ? t('calc.netAmount') : mode === 'gross' ? t('calc.grossAmount') : t('calc.collectAmount')}
        placeholder="20000"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        icon="receipt-outline"
      />
      <Text style={styles.label}>{t('calc.kdvRate')}</Text>
      <SegmentedControl
        scrollable={false}
        options={[
          { value: '0.20', label: '%20' },
          { value: '0.10', label: '%10' },
        ]}
        value={kdvRate}
        onChange={setKdvRate}
      />
      <View style={{ height: spacing.md }} />
      <Text style={styles.label}>{t('calc.stopajLabel')}</Text>
      <SegmentedControl
        scrollable={false}
        options={[
          { value: 'on', label: t('calc.stopajOn') },
          { value: 'off', label: t('calc.stopajOff') },
        ]}
        value={stopajOn ? 'on' : 'off'}
        onChange={(v) => setStopajOn(v === 'on')}
      />
      <View style={{ height: spacing.md }} />
      {a > 0 && (
        <Card>
          <ResultRow label={t('calc.gross')} value={formatMoney(gross)} />
          {stopajOn && <ResultRow label={t('calc.withholding')} value={`− ${formatMoney(stopaj)}`} />}
          <ResultRow label={t('calc.net')} value={formatMoney(net)} />
          <ResultRow label={`${t('calc.vat')} (%${Math.round(k * 100)})`} value={`+ ${formatMoney(kdv)}`} />
          <ResultRow label={t('calc.collect')} value={formatMoney(collect)} strong />
          <Disclaimer text={t('calc.smmDisclaimer')} />
        </Card>
      )}
    </View>
  );
}

/* ---------------- Kıdem / İhbar ---------------- */

function SeveranceCalc() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);
  const t = useT();

  const [salary, setSalary] = useState('');
  const [start, setStart] = useState(() => new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000));
  const [end, setEnd] = useState(new Date());
  const [picker, setPicker] = useState<'start' | 'end' | null>(null);

  const s = parseAmount(salary);
  const totalDays = Math.max(0, differenceInDays(end, start));
  const years = totalDays / 365;
  const months = Math.max(0, differenceInMonths(end, start));

  const kidemGross = s * years;
  const damga = kidemGross * 0.00759;
  const kidemNet = kidemGross - damga;

  const noticeWeeks = months < 6 ? 2 : months < 18 ? 4 : months < 36 ? 6 : 8;
  const ihbarGross = (s / 30) * 7 * noticeWeeks;

  const serviceLabel = useMemo(() => {
    const y = Math.floor(totalDays / 365);
    const remDays = totalDays - y * 365;
    const m = Math.floor(remDays / 30);
    const d = remDays - m * 30;
    return t('calc.serviceValue', { y, m, d });
  }, [totalDays, t]);

  return (
    <View>
      <Input label={t('calc.salary')} placeholder="45000" value={salary} onChangeText={setSalary} keyboardType="decimal-pad" icon="wallet-outline" />
      <View style={styles.dateRow}>
        <View style={styles.dateCol}>
          <Text style={styles.label}>{t('calc.hireDate')}</Text>
          <Pressable style={styles.dateButton} onPress={() => setPicker('start')}>
            <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
            <Text style={styles.dateButtonText}>{formatDate(start.toISOString())}</Text>
          </Pressable>
        </View>
        <View style={styles.dateCol}>
          <Text style={styles.label}>{t('calc.terminationDate')}</Text>
          <Pressable style={styles.dateButton} onPress={() => setPicker('end')}>
            <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
            <Text style={styles.dateButtonText}>{formatDate(end.toISOString())}</Text>
          </Pressable>
        </View>
      </View>
      {picker && (
        <DateTimePicker locale="tr-TR"
          value={picker === 'start' ? start : end}
          mode="date"
          onChange={(_e, date) => {
            const which = picker;
            if (Platform.OS === 'android') setPicker(null);
            if (date && which === 'start') setStart(date);
            if (date && which === 'end') setEnd(date);
          }}
        />
      )}
      {Platform.OS === 'ios' && picker && (
        <Button label={t('common.done')} size="sm" variant="secondary" onPress={() => setPicker(null)} style={styles.pickerDone} />
      )}

      {s > 0 && totalDays > 0 && (
        <Card style={styles.resultCard}>
          <ResultRow label={t('calc.service')} value={serviceLabel} />
          <View style={styles.resultDivider} />
          <ResultRow label={t('calc.severanceGross')} value={formatMoney(kidemGross)} />
          <ResultRow label={t('calc.stampTax')} value={`− ${formatMoney(damga)}`} />
          <ResultRow label={t('calc.severanceNet')} value={formatMoney(kidemNet)} strong />
          <View style={styles.resultDivider} />
          <ResultRow label={t('calc.noticePeriod')} value={t('calc.nWeeks', { n: noticeWeeks })} />
          <ResultRow label={t('calc.noticeGross')} value={formatMoney(ihbarGross)} strong />
          <Disclaimer text={t('calc.severanceDisclaimer')} />
        </Card>
      )}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  calcTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  calcDesc: {
    ...typography.small,
    color: colors.textSecondary,
    lineHeight: 16,
    marginBottom: spacing.sm,
  },
  spacer: {
    height: spacing.md,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  presetRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
    marginTop: -4,
  },
  presetChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  presetChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  presetChipText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  presetChipTextActive: {
    color: '#FFFFFF',
  },
  dateRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  dateCol: {
    flex: 1,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
  },
  dateButtonText: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  pickerDone: {
    marginTop: spacing.xs,
    alignSelf: 'flex-end',
  },
  resultCard: {
    marginTop: spacing.xs,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
    gap: spacing.sm,
  },
  resultRowLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  resultRowValue: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  resultRowStrong: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  resultDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    marginVertical: spacing.xs,
  },
  disclaimer: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.sm,
    lineHeight: 15,
  },
});
