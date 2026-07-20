import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { CaseStatusBadge, PriorityBadge } from '@/components/ui/StatusBadge';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { HearingListItem } from '@/components/calendar/HearingListItem';
import { DeadlineListItem } from '@/components/calendar/DeadlineListItem';
import { Input } from '@/components/ui/Input';
import { useCase, useDeleteCase, useUpdateCase } from '@/hooks/useCases';
import { useHearingsForCase } from '@/hooks/useHearings';
import { useCreateDeadline, useDeadlinesForCase, useUpdateDeadline } from '@/hooks/useDeadlines';
import { useCaseExpenses, useCreateCaseExpense, useCreateInstallment, useCreatePayment, useDeleteCaseExpense, useDeleteInstallment, useDeletePayment, useInstallments, usePaymentsForCase, useToggleInstallment } from '@/hooks/usePayments';
import { useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { formatDate, formatMoney } from '@/utils/format';
import { computeLegalDue } from '@/utils/legalDates';
import { Ionicons } from '@expo/vector-icons';
import { WarPlanTab } from '@/components/case/WarPlanTab';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { FirstInstancePhase, InstanceStage, ClosedResult } from '@/types/database';

type Tab = 'overview' | 'hearings' | 'deadlines' | 'finance' | 'plan';

export default function CaseDetailScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);

  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('overview');

  const { data: caseItem, isLoading } = useCase(id);
  const hearings = useHearingsForCase(id);
  const deadlines = useDeadlinesForCase(id);
  const payments = usePaymentsForCase(id);
  const createPayment = useCreatePayment();
  const deletePayment = useDeletePayment();
  const updateDeadline = useUpdateDeadline();
  const deleteCase = useDeleteCase();
  const updateCase = useUpdateCase();
  const createDeadline = useCreateDeadline();
  const [decisionNo, setDecisionNo] = useState('');
  const [stageNote, setStageNote] = useState('');
  const [datePicker, setDatePicker] = useState<null | 'decision' | 'served' | 'installment'>(null);
  const [instDue, setInstDue] = useState<Date | null>(null);

  useEffect(() => {
    setDecisionNo(caseItem?.decision_number ?? '');
  }, [caseItem?.decision_number]);

  useEffect(() => {
    setStageNote(caseItem?.stage_note ?? '');
  }, [caseItem?.stage_note]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const expenses = useCaseExpenses(id);
  const createExpense = useCreateCaseExpense();
  const deleteExpense = useDeleteCaseExpense();
  const [advanceText, setAdvanceText] = useState('');
  const installments = useInstallments(id);
  const createInstallment = useCreateInstallment();
  const toggleInstallment = useToggleInstallment();
  const deleteInstallment = useDeleteInstallment();
  const [instAmount, setInstAmount] = useState('');
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');

  useEffect(() => {
    setAdvanceText(caseItem?.advance_amount != null ? String(caseItem.advance_amount) : '');
  }, [caseItem?.advance_amount]);

  if (isLoading || !caseItem) {
    return (
      <Screen>
        <ScreenHeader title={t('case.title')} showBack />
      </Screen>
    );
  }

  const saveCase = (patch: Parameters<typeof updateCase.mutate>[0] extends infer _ ? Record<string, unknown> : never) => {
    updateCase.mutate({ id: caseItem.id, ...(patch as object) } as never);
  };

  // Gerekçeli karar tebliğ tarihi girilince istinaf son günü takvime otomatik
  // görev olarak eklenir. Süre mahkeme türüne göre belirlenir (hukuk: 2 hafta
  // HMK 345; ceza: 7 gün CMK 273; idare: 30 gün İYUK 45) ve adli tatil ile
  // hafta sonu/resmî tatil uzatmaları uygulanır.
  const handleServedDate = async (picked: Date) => {
    saveCase({ decision_served_date: picked.toISOString().slice(0, 10) });
    const already = (deadlines.data ?? []).some((x) => x.title.startsWith(t('case.istinafDeadline')));
    if (already) return;
    const cfg =
      caseItem.court_category === 'ceza'
        ? { amount: 7, unit: 'day' as const, basis: 'CMK 273', rule: 'criminal' as const }
        : caseItem.court_category === 'idare'
          ? { amount: 30, unit: 'day' as const, basis: 'İYUK 45', rule: 'civil' as const }
          : { amount: 2, unit: 'week' as const, basis: 'HMK 345', rule: 'civil' as const };
    const res = computeLegalDue(picked, cfg.amount, cfg.unit, cfg.rule);
    const due = new Date(res.due);
    due.setHours(17, 0, 0, 0);
    try {
      await createDeadline.mutateAsync({
        caseTitle: caseItem.title,
        case_id: caseItem.id,
        title: t('case.istinafDeadline'),
        description: `${t('case.istinafDesc')} (${cfg.basis})`,
        due_at: due.toISOString(),
        priority: 'high',
        reminder_minutes_before: 24 * 60,
      });
      Alert.alert(t('case.stageTitle'), t('case.istinafAdded'));
    } catch {
      // takvim görevi eklenemese de tarih kaydedildi
    }
  };

  const handleDelete = () => {
    Alert.alert(t('case.delete'), t('case.deleteConfirm', { title: caseItem.title }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteCase.mutateAsync(caseItem.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <Screen>
      <ScreenHeader
        title={caseItem.title}
        subtitle={caseItem.case_number ? `#${caseItem.case_number}` : undefined}
        showBack
        rightIcon="create-outline"
        onRightPress={() => router.push(`/case-form?id=${caseItem.id}`)}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.summaryCard}>
          <View style={styles.badgeRow}>
            <CaseStatusBadge status={caseItem.status} />
            <PriorityBadge priority={caseItem.priority} />
          </View>

          {caseItem.client && (
            <InfoRow
              label={t('case.client')}
              value={caseItem.client.full_name}
              onPress={() => router.push(`/(app)/clients/${caseItem.client!.id}`)}
            />
          )}
          {caseItem.court_name && <InfoRow label={t('case.court')} value={caseItem.court_name} />}
          {caseItem.case_type && <InfoRow label={t('case.caseType')} value={caseItem.case_type} />}
          {caseItem.opposing_party && <InfoRow label={t('case.opposingParty')} value={caseItem.opposing_party} />}
          {caseItem.opposing_counsel && <InfoRow label={t('case.opposingCounsel')} value={caseItem.opposing_counsel} />}
          <InfoRow label={t('case.opened')} value={formatDate(caseItem.opened_date)} />
          {caseItem.closed_date && <InfoRow label={t('case.closed')} value={formatDate(caseItem.closed_date)} />}
        </Card>

        {/* ---------- Dava Durumu ve Aşama (alıcı geri bildirimi) ---------- */}
        <Card style={styles.stageCard}>
          <Text style={styles.sectionLabel}>{t('case.stageTitle')}</Text>

          {caseItem.status !== 'closed' && caseItem.status !== 'won' && caseItem.status !== 'lost' ? (
            <>
              <Text style={styles.stageLabel}>{t('case.instance')}</Text>
              <SegmentedControl
                scrollable={false}
                options={[
                  { value: 'ilk_derece', label: t('inst.ilk_derece') },
                  { value: 'istinaf', label: t('inst.istinaf') },
                  { value: 'temyiz', label: t('inst.temyiz') },
                ]}
                value={caseItem.instance_stage ?? 'ilk_derece'}
                onChange={(v) => saveCase({ instance_stage: v as InstanceStage })}
              />
              {(caseItem.instance_stage ?? 'ilk_derece') === 'ilk_derece' && (
                <>
                  <Text style={styles.stageLabel}>{t('case.phase')}</Text>
                  <SegmentedControl
                    options={[
                      { value: 'dilekceler', label: t('phase.dilekceler') },
                      { value: 'on_inceleme', label: t('phase.on_inceleme') },
                      { value: 'tahkikat', label: t('phase.tahkikat') },
                      { value: 'bilirkisi_kesif', label: t('phase.bilirkisi_kesif') },
                      { value: 'karar', label: t('phase.karar') },
                    ]}
                    value={caseItem.case_stage ?? 'dilekceler'}
                    onChange={(v) => saveCase({ case_stage: v as FirstInstancePhase })}
                  />
                </>
              )}
            </>
          ) : (
            <>
              <Text style={styles.stageLabel}>{t('case.result')}</Text>
              <SegmentedControl
                scrollable={false}
                options={[
                  { value: 'kabul', label: t('result.kabul') },
                  { value: 'ret', label: t('result.ret') },
                  { value: 'kismen_kabul', label: t('result.kismen_kabul') },
                  { value: 'diger', label: t('result.diger') },
                ]}
                value={caseItem.closed_result ?? 'kabul'}
                onChange={(v) => saveCase({ closed_result: v as ClosedResult })}
              />
              <Input
                label={t('case.decisionNo')}
                placeholder="2026/123 K."
                value={decisionNo}
                onChangeText={setDecisionNo}
                onEndEditing={() => saveCase({ decision_number: decisionNo.trim() || null })}
              />
              {(!caseItem.decision_number || !caseItem.decision_date) && (
                <View style={styles.advWarn}>
                  <Ionicons name="alert-circle" size={16} color={colors.danger} />
                  <Text style={styles.advWarnText}>{t('case.decisionRequired')}</Text>
                </View>
              )}
            </>
          )}

          <View style={styles.stageDates}>
            <Pressable style={styles.stageDateBtn} onPress={() => setDatePicker('decision')}>
              <Ionicons name="calendar-outline" size={15} color={colors.textMuted} />
              <Text style={styles.stageDateText}>
                {t('case.decisionDate')}: {caseItem.decision_date ? formatDate(caseItem.decision_date) : '—'}
              </Text>
            </Pressable>
            <Pressable style={styles.stageDateBtn} onPress={() => setDatePicker('served')}>
              <Ionicons name="calendar-outline" size={15} color={colors.gold} />
              <Text style={styles.stageDateText}>
                {t('case.servedDate')}: {caseItem.decision_served_date ? formatDate(caseItem.decision_served_date) : '—'}
              </Text>
            </Pressable>
          </View>
          <Text style={styles.stageHint}>{t('case.servedHint')}</Text>
          {datePicker && (
            <DateTimePicker
              value={new Date()}
              mode="date"
              onChange={(_e, picked) => {
                const which = datePicker;
                setDatePicker(null);
                if (!picked) return;
                if (which === 'decision') saveCase({ decision_date: picked.toISOString().slice(0, 10) });
                else if (which === 'served') handleServedDate(picked);
              }}
            />
          )}

          {/* Aşama açıklaması (kısa yardım) */}
          <Text style={styles.stageDesc}>{t('case.stageHelp')}</Text>

          {/* Serbest durum açıklaması */}
          <Input
            label={t('case.stageNote')}
            placeholder={t('case.stageNotePh')}
            value={stageNote}
            onChangeText={setStageNote}
            onEndEditing={() => saveCase({ stage_note: stageNote.trim() || null })}
            multiline
            numberOfLines={3}
            style={styles.stageNoteInput}
          />

          <Button
            label={t('case.araKarar')}
            icon="alarm-outline"
            variant="secondary"
            onPress={() =>
              router.push(
                `/deadline-form?caseId=${caseItem.id}&title=${encodeURIComponent(t('case.araKararPrefix'))}` as Parameters<typeof router.push>[0]
              )
            }
            fullWidth
            style={styles.stageAra}
          />
        </Card>

        <View style={styles.tabsWrap}>
          <SegmentedControl
            options={[
              { label: t('case.tabOverview'), value: 'overview' },
              { label: t('case.tabHearings'), value: 'hearings' },
              { label: t('case.tabDeadlines'), value: 'deadlines' },
              { label: t('case.tabFinance'), value: 'finance' },
              { label: t('case.tabPlan'), value: 'plan' },
            ]}
            value={tab}
            onChange={(v) => setTab(v as Tab)}
          />
        </View>

        {tab === 'overview' && (
          <Card>
            <Text style={styles.sectionLabel}>{t('case.description')}</Text>
            <Text style={styles.description}>{caseItem.description || t('case.noDescription')}</Text>
          </Card>
        )}

        {tab === 'hearings' && (
          <View>
            <SectionHeader title={t('case.tabHearings')} actionLabel={t('case.add')} onAction={() => router.push(`/hearing-form?caseId=${caseItem.id}`)} />
            <Card>
              {hearings.data && hearings.data.length > 0 ? (
                hearings.data.map((hearing, index) => (
                  <View key={hearing.id} style={index > 0 ? styles.divider : undefined}>
                    <HearingListItem
                      hearing={hearing}
                      showCase={false}
                      onPress={() => router.push(`/hearing-form?caseId=${caseItem.id}&id=${hearing.id}`)}
                    />
                  </View>
                ))
              ) : (
                <EmptyState icon="hammer-outline" title={t('case.noHearings')} />
              )}
            </Card>
          </View>
        )}

        {tab === 'deadlines' && (
          <View>
            <SectionHeader title={t('case.tabDeadlines')} actionLabel={t('case.add')} onAction={() => router.push(`/deadline-form?caseId=${caseItem.id}`)} />
            <Card>
              {deadlines.data && deadlines.data.length > 0 ? (
                deadlines.data.map((deadline, index) => (
                  <View key={deadline.id} style={index > 0 ? styles.divider : undefined}>
                    <DeadlineListItem
                      deadline={deadline}
                      showCase={false}
                      onPress={() => router.push(`/deadline-form?caseId=${caseItem.id}&id=${deadline.id}`)}
                      onToggleComplete={() =>
                        updateDeadline.mutate({
                          id: deadline.id,
                          is_completed: !deadline.is_completed,
                          caseTitle: caseItem.title,
                        })
                      }
                    />
                  </View>
                ))
              ) : (
                <EmptyState icon="alert-circle-outline" title={t('case.noDeadlines')} />
              )}
            </Card>
          </View>
        )}

        {tab === 'plan' && <WarPlanTab caseItem={caseItem} hearings={hearings.data} />}

        {tab === 'finance' && (
          <View>
            {/* Vekalet ücreti — tipe göre */}
            {(() => {
              // Tahsil edilen = tek tek eklenen ödemeler + "ödendi" işaretlenmiş
              // taksitler. (Eskiden sadece ödemeler sayılıyor, ödenen taksitler
              // Kalan'ı düşürmüyordu.)
              const paymentsSum = (payments.data ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
              const paidInstallments = (installments.data ?? [])
                .filter((i) => i.is_paid)
                .reduce((sum, i) => sum + Number(i.amount), 0);
              const collected = paymentsSum + paidInstallments;
              const feeType = caseItem.fee_type ?? 'fixed';
              const feeLabel =
                feeType === 'percentage'
                  ? `%${caseItem.fee_percent ?? 0}`
                  : feeType === 'advance_percentage'
                    ? `${formatMoney(Number(caseItem.fee_advance ?? 0))} + %${caseItem.fee_percent ?? 0}`
                    : caseItem.fee_amount != null
                      ? formatMoney(caseItem.fee_amount)
                      : t('finance.noFee');
              const remaining = caseItem.fee_amount != null ? Math.max(0, Number(caseItem.fee_amount) - collected) : null;
              return (
                <Card style={styles.financeSummary}>
                  <View style={styles.feeTypeRow}>
                    <Ionicons name="briefcase-outline" size={15} color={colors.gold} />
                    <Text style={styles.feeTypeText}>
                      {t(`fee.${feeType === 'advance_percentage' ? 'advPercentage' : feeType}` as const)}: {feeLabel}
                    </Text>
                  </View>
                  <View style={styles.financeRow}>
                    <FinanceStat label={t('finance.collected')} value={formatMoney(collected)} color={colors.success} />
                    <FinanceStat
                      label={t('fee.toCollect')}
                      value={remaining != null ? formatMoney(remaining) : '—'}
                      color={colors.warning}
                    />
                  </View>

                  {/* Sabit ücrette taksit (vade) planı */}
                  {feeType === 'fixed' && (
                    <View style={styles.instWrap}>
                      <Text style={styles.instTitle}>{t('fee.installments')}</Text>
                      {(installments.data ?? []).map((it) => (
                        <Pressable
                          key={it.id}
                          style={styles.instRow}
                          onPress={() => toggleInstallment.mutate({ id: it.id, is_paid: !it.is_paid })}
                        >
                          <Ionicons
                            name={it.is_paid ? 'checkmark-circle' : 'ellipse-outline'}
                            size={20}
                            color={it.is_paid ? colors.success : colors.textMuted}
                          />
                          <Text style={[styles.instText, it.is_paid && styles.instPaid]}>
                            {t('fee.installmentN', { n: it.seq })}: {formatMoney(Number(it.amount))}
                            {it.due_date ? ` · ${formatDate(it.due_date)}` : ''}
                          </Text>
                          <Ionicons
                            name="trash-outline"
                            size={16}
                            color={colors.textMuted}
                            suppressHighlighting
                            onPress={() =>
                              Alert.alert(t('fee.deleteInstallmentTitle'), formatMoney(Number(it.amount)), [
                                { text: t('common.cancel'), style: 'cancel' },
                                { text: t('common.delete'), style: 'destructive', onPress: () => deleteInstallment.mutate(it.id) },
                              ])
                            }
                          />
                        </Pressable>
                      ))}
                      {/* Vade tarihi: girilirse taksit takvimde de görünür. */}
                      <Pressable style={styles.instDateBtn} onPress={() => setDatePicker('installment')}>
                        <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
                        <Text style={styles.instDateText}>
                          {t('fee.dueDate')}: {instDue ? formatDate(instDue.toISOString()) : t('fee.noDueDate')}
                        </Text>
                        {instDue && (
                          <Ionicons name="close-circle" size={16} color={colors.textMuted} onPress={() => setInstDue(null)} suppressHighlighting />
                        )}
                      </Pressable>
                      <View style={styles.instAddRow}>
                        <View style={{ flex: 1 }}>
                          <Input
                            label={t('fee.installmentAmount')}
                            placeholder="10000"
                            keyboardType="numeric"
                            value={instAmount}
                            onChangeText={setInstAmount}
                          />
                        </View>
                        <Button
                          label={t('fee.addInstallment')}
                          variant="secondary"
                          disabled={!(Number(instAmount.replace(',', '.')) > 0)}
                          onPress={async () => {
                            await createInstallment.mutateAsync({
                              case_id: caseItem.id,
                              seq: (installments.data?.length ?? 0) + 1,
                              amount: Number(instAmount.replace(',', '.')),
                              due_date: instDue ? instDue.toISOString().slice(0, 10) : null,
                            });
                            setInstAmount('');
                            setInstDue(null);
                          }}
                          style={styles.instAddBtn}
                        />
                      </View>
                    </View>
                  )}
                </Card>
              );
            })()}

            {datePicker === 'installment' && (
              <DateTimePicker
                value={instDue ?? new Date()}
                mode="date"
                onChange={(_e, picked) => {
                  setDatePicker(null);
                  if (picked) setInstDue(picked);
                }}
              />
            )}

            <Card style={styles.paymentForm}>
              <Input
                label={t('finance.amount')}
                placeholder={t('finance.amountPlaceholder')}
                keyboardType="numeric"
                value={paymentAmount}
                onChangeText={setPaymentAmount}
              />
              <Input
                label={t('finance.note')}
                placeholder={t('finance.notePlaceholder')}
                value={paymentNote}
                onChangeText={setPaymentNote}
              />
              <Button
                label={t('finance.addPayment')}
                icon="cash-outline"
                loading={createPayment.isPending}
                disabled={!paymentAmount.trim() || !(Number(paymentAmount.replace(',', '.')) > 0)}
                onPress={async () => {
                  await createPayment.mutateAsync({
                    case_id: caseItem.id,
                    amount: Number(paymentAmount.replace(',', '.')),
                    note: paymentNote.trim() || null,
                  });
                  setPaymentAmount('');
                  setPaymentNote('');
                }}
                fullWidth
              />
            </Card>

            {/* ---------- Masraf Avansı (alıcı geri bildirimi) ---------- */}
            {(() => {
              const spent = (expenses.data ?? []).reduce((s, e) => s + Number(e.amount), 0);
              const advance = Number(caseItem.advance_amount ?? 0);
              const remaining = advance - spent;
              return (
                <>
                  <SectionHeader title={t('adv.title')} />
                  <Card>
                    <View style={styles.financeRow}>
                      <FinanceStat label={t('adv.advance')} value={formatMoney(advance)} color={colors.textPrimary} />
                      <FinanceStat label={t('adv.spent')} value={formatMoney(spent)} color={colors.warning} />
                      <FinanceStat
                        label={t('adv.remaining')}
                        value={formatMoney(remaining)}
                        color={remaining < 0 ? colors.danger : colors.success}
                      />
                    </View>
                    {remaining < 0 && (
                      <View style={styles.advWarn}>
                        <Ionicons name="warning" size={16} color={colors.danger} />
                        <Text style={styles.advWarnText}>{t('adv.negative')}</Text>
                      </View>
                    )}
                    <Input
                      label={t('adv.advance')}
                      placeholder="10000"
                      keyboardType="numeric"
                      value={advanceText}
                      onChangeText={setAdvanceText}
                      onEndEditing={() => {
                        const n = Number(advanceText.replace(',', '.'));
                        saveCase({ advance_amount: Number.isFinite(n) && n > 0 ? n : null });
                      }}
                    />
                    <View style={styles.advFormRow}>
                      <View style={styles.advFormCol}>
                        <Input
                          label={t('adv.addTitle')}
                          placeholder={t('adv.addTitlePh')}
                          value={expenseTitle}
                          onChangeText={setExpenseTitle}
                        />
                      </View>
                      <View style={styles.advFormColSm}>
                        <Input
                          label={t('finance.amount')}
                          placeholder="500"
                          keyboardType="numeric"
                          value={expenseAmount}
                          onChangeText={setExpenseAmount}
                        />
                      </View>
                    </View>
                    <Button
                      label={t('adv.add')}
                      icon="remove-circle-outline"
                      variant="secondary"
                      loading={createExpense.isPending}
                      disabled={!expenseTitle.trim() || !(Number(expenseAmount.replace(',', '.')) > 0)}
                      onPress={async () => {
                        await createExpense.mutateAsync({
                          case_id: caseItem.id,
                          title: expenseTitle.trim(),
                          amount: Number(expenseAmount.replace(',', '.')),
                        });
                        setExpenseTitle('');
                        setExpenseAmount('');
                      }}
                      fullWidth
                    />
                    {(expenses.data ?? []).map((e) => (
                      <View key={e.id} style={styles.divider}>
                        <View style={styles.paymentRow}>
                          <View style={[styles.paymentIcon, { backgroundColor: colors.warningSoft }]}>
                            <Ionicons name="remove-outline" size={16} color={colors.warning} />
                          </View>
                          <View style={styles.paymentBody}>
                            <Text style={styles.paymentAmount}>{e.title}</Text>
                            <Text style={styles.paymentMeta}>
                              {formatMoney(Number(e.amount))} · {formatDate(e.spent_at)}
                            </Text>
                          </View>
                          <Ionicons
                            name="trash-outline"
                            size={18}
                            color={colors.textMuted}
                            suppressHighlighting
                            onPress={() =>
                              Alert.alert(t('finance.deleteTitle'), t('finance.deleteConfirm'), [
                                { text: t('common.cancel'), style: 'cancel' },
                                { text: t('common.delete'), style: 'destructive', onPress: () => deleteExpense.mutate(e.id) },
                              ])
                            }
                          />
                        </View>
                      </View>
                    ))}
                  </Card>
                </>
              );
            })()}

            <SectionHeader title={t('finance.payments')} />
            <Card>
              {payments.data && payments.data.length > 0 ? (
                payments.data.map((payment, index) => (
                  <View key={payment.id} style={index > 0 ? styles.divider : undefined}>
                    <View style={styles.paymentRow}>
                      <View style={styles.paymentIcon}>
                        <Ionicons name="cash-outline" size={16} color={colors.success} />
                      </View>
                      <View style={styles.paymentBody}>
                        <Text style={styles.paymentAmount}>{formatMoney(Number(payment.amount))}</Text>
                        <Text style={styles.paymentMeta}>
                          {formatDate(payment.paid_at)}
                          {payment.note ? ` · ${payment.note}` : ''}
                        </Text>
                      </View>
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color={colors.textMuted}
                        suppressHighlighting
                        onPress={() =>
                          Alert.alert(t('finance.deleteTitle'), t('finance.deleteConfirm'), [
                            { text: t('common.cancel'), style: 'cancel' },
                            { text: t('common.delete'), style: 'destructive', onPress: () => deletePayment.mutate(payment.id) },
                          ])
                        }
                      />
                    </View>
                  </View>
                ))
              ) : (
                <EmptyState icon="cash-outline" title={t('finance.noPayments')} />
              )}
            </Card>
          </View>
        )}

        <Button label={t('case.delete')} variant="danger" onPress={handleDelete} style={styles.deleteButton} />
      </ScrollView>
    </Screen>
  );
}

function FinanceStat({ label, value, color }: { label: string; value: string; color: string }) {
  const __t = useTheme();
  const styles = makeStyles(__t.colors);

  return (
    <View style={styles.financeStat}>
      <Text style={styles.financeStatLabel}>{label}</Text>
      <Text style={[styles.financeStatValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function InfoRow({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) {
  const __t = useTheme();
  const styles = makeStyles(__t.colors);

  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, onPress && styles.infoValueLink]} onPress={onPress} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  summaryCard: {
    marginBottom: spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  infoLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  infoValue: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    maxWidth: '60%',
    textAlign: 'right',
  },
  infoValueLink: {
    color: colors.primary,
  },
  stageCard: {
    marginTop: spacing.md,
  },
  stageLabel: {
    ...typography.small,
    color: colors.textSecondary,
    fontWeight: '700',
    marginTop: spacing.sm,
    marginBottom: 6,
  },
  stageDates: {
    marginTop: spacing.sm,
    gap: 8,
  },
  stageDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
  },
  stageDateText: {
    ...typography.caption,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  stageHint: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: 6,
    lineHeight: 15,
  },
  stageDesc: {
    ...typography.small,
    color: colors.textMuted,
    lineHeight: 16,
    marginTop: spacing.sm,
  },
  stageNoteInput: {
    height: 78,
    textAlignVertical: 'top',
    paddingTop: 12,
    marginTop: spacing.sm,
  },
  stageAra: {
    marginTop: spacing.sm,
  },
  feeTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  feeTypeText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  instWrap: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: spacing.sm,
  },
  instTitle: {
    ...typography.small,
    color: colors.textSecondary,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  instRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
  },
  instText: {
    ...typography.caption,
    color: colors.textPrimary,
    flex: 1,
  },
  instPaid: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  instAddRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  instAddBtn: {
    marginBottom: 2,
  },
  instDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xs,
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
  },
  instDateText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  advWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.dangerSoft,
    borderRadius: 10,
    padding: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  advWarnText: {
    ...typography.small,
    color: colors.danger,
    flex: 1,
    lineHeight: 16,
  },
  advFormRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  advFormCol: {
    flex: 1.6,
  },
  advFormColSm: {
    flex: 1,
  },
  tabsWrap: {
    marginBottom: spacing.md,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  description: {
    ...typography.body,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  deleteButton: {
    marginTop: spacing.xl,
  },
  folderGroup: {
    marginBottom: spacing.md,
  },
  folderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
    paddingHorizontal: 2,
  },
  folderTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    flex: 1,
  },
  folderCount: {
    ...typography.small,
    color: colors.textMuted,
    backgroundColor: colors.surfaceHover,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  financeSummary: {
    marginBottom: spacing.md,
  },
  financeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  financeStat: {
    flex: 1,
    alignItems: 'center',
  },
  financeStatLabel: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: 4,
    textAlign: 'center',
  },
  financeStatValue: {
    ...typography.h3,
  },
  paymentForm: {
    marginBottom: spacing.md,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  paymentIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  paymentBody: {
    flex: 1,
  },
  paymentAmount: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  paymentMeta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
  },
});
