import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Calendar, DateData, LocaleConfig } from 'react-native-calendars';
import { router } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { addDays, format, isToday, isTomorrow, startOfWeek } from 'date-fns';
import { enUS, tr as trLocale } from 'date-fns/locale';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAllHearings, useUpdateHearing } from '@/hooks/useHearings';
import { useAllDeadlines, useUpdateDeadline } from '@/hooks/useDeadlines';
import { useAllPromises } from '@/hooks/usePaymentPromises';
import { useAllInstallments } from '@/hooks/usePayments';
import { useLangStore, useT } from '@/i18n';
import { fonts, spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { formatDate, formatMoney } from '@/utils/format';
import type { DeadlineWithCase, HearingType, HearingWithCase } from '@/types/database';

LocaleConfig.locales.tr = {
  monthNames: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
  monthNamesShort: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'],
  dayNames: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'],
  dayNamesShort: ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'],
  today: 'Bugün',
};

type ViewMode = 'agenda' | 'week' | 'month';
type ItemKind = 'hearing' | 'deadline' | 'promise' | 'installment';

interface AgendaItem {
  key: string;
  kind: ItemKind;
  dateKey: string; // yyyy-MM-dd
  time: string | null; // HH:mm — null for date-only records
  sortTs: number;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  done: boolean;
  deadline?: DeadlineWithCase;
  hearing?: HearingWithCase;
}

const HEARING_ICONS: Record<HearingType, keyof typeof Ionicons.glyphMap> = {
  hearing: 'hammer-outline',
  trial: 'hammer-outline',
  mediation: 'people-outline',
  deposition: 'search-outline',
  filing: 'document-attach-outline',
  meeting: 'videocam-outline',
  other: 'calendar-outline',
};

/** Tarih-saatli ISO → yerel gün anahtarı; salt tarih (yyyy-MM-dd) olduğu gibi kalır. */
function toDateKey(iso: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return format(d, 'yyyy-MM-dd');
}

function toTime(iso: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return format(d, 'HH:mm');
}

function toSortTs(iso: string): number {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return new Date(`${iso}T23:59:00`).getTime();
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export default function CalendarScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);

  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const dfLocale = lang === 'tr' ? trLocale : enUS;

  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const [view, setView] = useState<ViewMode>('agenda');
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [visibleMonth, setVisibleMonth] = useState(todayKey.slice(0, 7));
  const [calKey, setCalKey] = useState(0);

  const hearings = useAllHearings();
  const deadlines = useAllDeadlines();
  const promises = useAllPromises();
  const installments = useAllInstallments();
  const updateDeadline = useUpdateDeadline();
  const updateHearing = useUpdateHearing();

  // İş üzerinde hızlı aksiyon (tamamla / ertele) için seçilen öğe.
  const [actionItem, setActionItem] = useState<AgendaItem | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [postponePicker, setPostponePicker] = useState(false);

  useMemo(() => {
    LocaleConfig.defaultLocale = lang === 'tr' ? 'tr' : '';
  }, [lang]);

  const kindColor: Record<ItemKind, { main: string; soft: string }> = {
    hearing: { main: colors.info, soft: colors.infoSoft },
    deadline: { main: colors.warning, soft: colors.warningSoft },
    promise: { main: colors.success, soft: colors.successSoft },
    installment: { main: colors.success, soft: colors.successSoft },
  };

  // ── Tüm planlı işlemler tek modelde ──────────────────────────────────────
  const items = useMemo<AgendaItem[]>(() => {
    const out: AgendaItem[] = [];

    hearings.data?.forEach((h) => {
      const dateKey = toDateKey(h.scheduled_at);
      if (!dateKey) return;
      out.push({
        key: `h-${h.id}`,
        kind: 'hearing',
        dateKey,
        time: toTime(h.scheduled_at),
        sortTs: toSortTs(h.scheduled_at),
        title: h.title,
        subtitle: [h.case?.title, t(`hearingType.${h.type}` as const)].filter(Boolean).join(' · '),
        icon: HEARING_ICONS[h.type] ?? 'calendar-outline',
        // Satıra dokununca kaydın kendisi (düzenleme formu) açılır — dosyalı/dosyasız fark etmez.
        route: `/hearing-form?id=${h.id}${h.case_id ? `&caseId=${h.case_id}` : ''}`,
        done: h.is_completed,
        hearing: h,
      });
    });

    deadlines.data?.forEach((d) => {
      const dateKey = toDateKey(d.due_at);
      if (!dateKey) return;
      out.push({
        key: `d-${d.id}`,
        kind: 'deadline',
        dateKey,
        time: toTime(d.due_at),
        sortTs: toSortTs(d.due_at),
        title: d.title,
        subtitle: [d.case?.title, t(`priority.${d.priority}` as const)].filter(Boolean).join(' · '),
        icon: d.priority === 'critical' ? 'alert-circle-outline' : 'checkbox-outline',
        route: `/deadline-form?id=${d.id}${d.case_id ? `&caseId=${d.case_id}` : ''}`,
        done: d.is_completed,
        deadline: d,
      });
    });

    promises.data?.forEach((p) => {
      const dateKey = toDateKey(p.due_date);
      if (!dateKey) return;
      out.push({
        key: `p-${p.id}`,
        kind: 'promise',
        dateKey,
        time: toTime(p.due_date),
        sortTs: toSortTs(p.due_date),
        title:
          p.seq && p.total_count
            ? t('cal.promiseInstTitle', { seq: p.seq, total: p.total_count, amount: formatMoney(Number(p.amount)) })
            : t('cal.promiseTitle', { amount: formatMoney(Number(p.amount)) }),
        subtitle: p.client?.full_name ?? '',
        icon: 'cash-outline',
        route: p.client ? `/(app)/clients/${p.client.id}` : '/(app)/clients',
        done: p.is_paid,
      });
    });

    installments.data?.forEach((i) => {
      if (!i.due_date) return;
      const dateKey = toDateKey(i.due_date);
      if (!dateKey) return;
      out.push({
        key: `i-${i.id}`,
        kind: 'installment',
        dateKey,
        time: toTime(i.due_date),
        sortTs: toSortTs(i.due_date),
        title: t('cal.installmentTitle', { seq: i.seq, amount: formatMoney(Number(i.amount)) }),
        subtitle: i.case?.title ?? '',
        icon: 'card-outline',
        route: `/(app)/cases/${i.case_id}`,
        done: i.is_paid,
      });
    });

    return out.sort((a, b) => a.sortTs - b.sortTs);
  }, [hearings.data, deadlines.data, promises.data, installments.data, t]);

  // ── Ay/hafta görünümleri için gün işaretleri ─────────────────────────────
  const dotsByDay = useMemo(() => {
    const map: Record<string, string[]> = {};
    items.forEach((it) => {
      if (it.done) return;
      const color = kindColor[it.kind].main;
      if (!map[it.dateKey]) map[it.dateKey] = [];
      if (!map[it.dateKey].includes(color)) map[it.dateKey].push(color);
    });
    return map;
  }, [items, colors]);

  const markedDates = useMemo(() => {
    const marks: Record<string, { dots: { key: string; color: string }[]; selected?: boolean; selectedColor?: string }> = {};
    Object.entries(dotsByDay).forEach(([day, dayColors]) => {
      marks[day] = { dots: dayColors.slice(0, 3).map((c, i) => ({ key: `${day}-${i}`, color: c })) };
    });
    if (!marks[selectedDate]) marks[selectedDate] = { dots: [] };
    marks[selectedDate] = { ...marks[selectedDate], selected: true, selectedColor: colors.primarySoft };
    return marks;
  }, [dotsByDay, selectedDate, colors]);

  const monthCount = useMemo(
    () => items.filter((it) => !it.done && it.dateKey.startsWith(visibleMonth)).length,
    [items, visibleMonth]
  );

  // ── Seçili gün / ajanda listeleri ────────────────────────────────────────
  const dayItems = useMemo(() => items.filter((it) => it.dateKey === selectedDate), [items, selectedDate]);

  const overdueItems = useMemo(
    () => items.filter((it) => !it.done && it.dateKey < todayKey && it.kind !== 'hearing'),
    [items, todayKey]
  );

  const upcomingGroups = useMemo(() => {
    const horizon = format(addDays(new Date(), 90), 'yyyy-MM-dd');
    const upcoming = items.filter((it) => !it.done && it.dateKey >= todayKey && it.dateKey <= horizon);
    const groups: { dateKey: string; items: AgendaItem[] }[] = [];
    upcoming.forEach((it) => {
      const last = groups[groups.length - 1];
      if (last && last.dateKey === it.dateKey) last.items.push(it);
      else groups.push({ dateKey: it.dateKey, items: [it] });
    });
    return groups;
  }, [items, todayKey]);

  const dayLabel = (dateKey: string) => {
    const d = new Date(`${dateKey}T12:00:00`);
    const base = format(d, lang === 'tr' ? 'd MMMM' : 'MMMM d', { locale: dfLocale });
    const weekday = format(d, 'EEEE', { locale: dfLocale });
    if (isToday(d)) return `${t('cal.today')} · ${base}`;
    if (isTomorrow(d)) return `${t('cal.tomorrow')} · ${base}`;
    return `${base} · ${weekday}`;
  };

  // ── İş üzerinde hızlı aksiyonlar (takvimden tek dokunuş) ─────────────────
  const isActionable = (item: AgendaItem) => item.kind === 'hearing' || item.kind === 'deadline';

  const completeItem = (item: AgendaItem, done = true) => {
    if (item.deadline) {
      updateDeadline.mutate({
        id: item.deadline.id,
        is_completed: done,
        caseTitle: item.deadline.case?.title ?? '',
      });
    } else if (item.hearing) {
      updateHearing.mutate({
        id: item.hearing.id,
        is_completed: done,
        caseTitle: item.hearing.case?.title ?? '',
      });
    }
  };

  /** İşi ileri bir tarihe erteler; saat bileşenini korur (görevlerde 23:59). */
  const postponeItem = (item: AgendaItem, target: Date) => {
    if (item.deadline) {
      const next = new Date(target);
      next.setHours(23, 59, 0, 0);
      updateDeadline.mutate({
        id: item.deadline.id,
        due_at: next.toISOString(),
        is_completed: false,
        caseTitle: item.deadline.case?.title ?? '',
      });
    } else if (item.hearing) {
      const prev = new Date(item.hearing.scheduled_at);
      const next = new Date(target);
      next.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
      updateHearing.mutate({
        id: item.hearing.id,
        scheduled_at: next.toISOString(),
        is_completed: false,
        caseTitle: item.hearing.case?.title ?? '',
      });
    }
  };

  const postponeBy = (item: AgendaItem, days: number) => {
    const base = new Date(`${item.dateKey}T12:00:00`);
    postponeItem(item, addDays(base, days));
    setActionItem(null);
  };

  const renderItem = (item: AgendaItem, showDate = false) => {
    const kc = kindColor[item.kind];
    return (
      <Pressable
        key={item.key}
        style={styles.itemRow}
        onPress={() => router.push(item.route as Parameters<typeof router.push>[0])}
      >
        <View style={styles.timeCol}>
          <Text style={styles.timeText}>{item.time ?? t('cal.allDay')}</Text>
          {showDate && <Text style={styles.timeSub}>{formatDate(item.dateKey)}</Text>}
        </View>
        <View style={[styles.itemDot, { backgroundColor: kc.main }]} />
        <View style={[styles.itemIcon, { backgroundColor: kc.soft }]}>
          <Ionicons name={item.icon} size={18} color={kc.main} />
        </View>
        <View style={styles.itemBody}>
          <Text style={[styles.itemTitle, item.done && styles.itemDoneText]} numberOfLines={1}>
            {item.title}
          </Text>
          {!!item.subtitle && (
            <Text style={styles.itemSub} numberOfLines={1}>
              {item.subtitle}
            </Text>
          )}
        </View>
        {isActionable(item) ? (
          <View style={styles.trailRow}>
            {item.done ? (
              <Ionicons name="checkmark-circle" size={22} color={colors.success} />
            ) : (
              <Pressable
                hitSlop={8}
                style={styles.actionBtn}
                onPress={() => {
                  setPostponePicker(false);
                  setActionItem(item);
                }}
              >
                <Ionicons name="ellipsis-horizontal" size={18} color={colors.primary} />
              </Pressable>
            )}
          </View>
        ) : (
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        )}
      </Pressable>
    );
  };

  const renderDayList = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeadRow}>
        <Text style={styles.sectionTitle}>
          {selectedDate === todayKey ? t('cal.todayAgenda') : t('cal.agendaOn', { date: formatDate(selectedDate) })}
        </Text>
        <Text style={styles.sectionCount}>{t('cal.records', { n: dayItems.length })}</Text>
      </View>
      <Card padded={false}>
        {dayItems.length > 0 ? (
          dayItems.map((it, i) => (
            <View key={it.key} style={i > 0 ? styles.divider : undefined}>
              {renderItem(it)}
            </View>
          ))
        ) : (
          <EmptyState icon="calendar-clear-outline" title={t('cal.noItemsDay')} />
        )}
      </Card>
    </View>
  );

  const legend = (
    <View style={styles.legend}>
      <LegendDot color={colors.info} label={t('cal.hearing')} />
      <LegendDot color={colors.warning} label={t('cal.deadline')} />
      <LegendDot color={colors.success} label={t('cal.payment')} />
    </View>
  );

  // ── Hafta şeridi ─────────────────────────────────────────────────────────
  const weekDays = useMemo(() => {
    const anchor = new Date(`${selectedDate}T12:00:00`);
    const start = startOfWeek(anchor, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [selectedDate]);

  const shiftWeek = (dir: 1 | -1) => {
    const next = addDays(new Date(`${selectedDate}T12:00:00`), dir * 7);
    setSelectedDate(format(next, 'yyyy-MM-dd'));
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader
        showMenu
        title={t('cal.title')}
        subtitle={`${format(new Date(), lang === 'tr' ? 'd MMMM yyyy' : 'MMMM d, yyyy', { locale: dfLocale })} · ${format(new Date(), 'EEEE', { locale: dfLocale })}`}
        rightIcon="add"
        onRightPress={() => setAddOpen(true)}
      />

      <View style={styles.viewSwitch}>
        <SegmentedControl
          scrollable={false}
          options={[
            { value: 'agenda', label: t('cal.viewAgenda') },
            { value: 'week', label: t('cal.viewWeek') },
            { value: 'month', label: t('cal.viewMonth') },
          ]}
          value={view}
          onChange={(v) => setView(v as ViewMode)}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {view === 'month' && (
          <>
            <Card padded={false} style={styles.calendarCard}>
              <View style={styles.monthInfoRow}>
                <Text style={styles.monthInfoText}>{t('cal.monthCount', { n: monthCount })}</Text>
                <Pressable
                  style={styles.todayBtn}
                  onPress={() => {
                    setSelectedDate(todayKey);
                    setVisibleMonth(todayKey.slice(0, 7));
                    setCalKey((k) => k + 1);
                  }}
                >
                  <Text style={styles.todayBtnText}>{t('cal.today')}</Text>
                  <Ionicons name="calendar-outline" size={14} color={colors.primary} />
                </Pressable>
              </View>
              <Calendar
                key={`${lang}-${calKey}`}
                current={selectedDate}
                markingType="multi-dot"
                markedDates={markedDates}
                onDayPress={(day: DateData) => setSelectedDate(day.dateString)}
                onMonthChange={(m: DateData) => setVisibleMonth(m.dateString.slice(0, 7))}
                theme={{
                  calendarBackground: colors.surface,
                  dayTextColor: colors.textPrimary,
                  monthTextColor: colors.textPrimary,
                  textSectionTitleColor: colors.textMuted,
                  todayTextColor: colors.gold,
                  arrowColor: colors.primary,
                  textDisabledColor: colors.textMuted,
                  selectedDayBackgroundColor: colors.primary,
                  selectedDayTextColor: '#FFFFFF',
                }}
                style={styles.calendar}
              />
            </Card>
            {legend}
            {renderDayList()}
          </>
        )}

        {view === 'week' && (
          <>
            <Card padded={false} style={styles.weekCard}>
              <View style={styles.weekHeadRow}>
                <Pressable hitSlop={8} onPress={() => shiftWeek(-1)}>
                  <Ionicons name="chevron-back" size={18} color={colors.primary} />
                </Pressable>
                <Text style={styles.weekTitle}>
                  {format(weekDays[0]!, 'd MMM', { locale: dfLocale })} – {format(weekDays[6]!, 'd MMM', { locale: dfLocale })}
                </Text>
                <Pressable hitSlop={8} onPress={() => shiftWeek(1)}>
                  <Ionicons name="chevron-forward" size={18} color={colors.primary} />
                </Pressable>
              </View>
              <View style={styles.weekRow}>
                {weekDays.map((d) => {
                  const key = format(d, 'yyyy-MM-dd');
                  const active = key === selectedDate;
                  const today = key === todayKey;
                  const dayDots = dotsByDay[key] ?? [];
                  return (
                    <Pressable key={key} style={[styles.weekDay, active && styles.weekDayActive]} onPress={() => setSelectedDate(key)}>
                      <Text style={[styles.weekDayName, active && styles.weekDayTextActive]}>
                        {format(d, 'EEEEEE', { locale: dfLocale })}
                      </Text>
                      <Text style={[styles.weekDayNum, today && !active && { color: colors.gold }, active && styles.weekDayTextActive]}>
                        {format(d, 'd')}
                      </Text>
                      <View style={styles.weekDots}>
                        {dayDots.slice(0, 3).map((c, i) => (
                          <View key={i} style={[styles.weekDot, { backgroundColor: c }]} />
                        ))}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </Card>
            {legend}
            {renderDayList()}
          </>
        )}

        {view === 'agenda' && (
          <>
            {overdueItems.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeadRow}>
                  <Text style={[styles.sectionTitle, { color: colors.danger }]}>{t('cal.overdueSection')}</Text>
                  <Text style={styles.sectionCount}>{t('cal.records', { n: overdueItems.length })}</Text>
                </View>
                <Card padded={false} style={styles.overdueCard}>
                  {overdueItems.map((it, i) => (
                    <View key={it.key} style={i > 0 ? styles.divider : undefined}>
                      {renderItem(it, true)}
                    </View>
                  ))}
                </Card>
              </View>
            )}

            {upcomingGroups.length === 0 ? (
              <Card>
                <EmptyState icon="calendar-clear-outline" title={t('cal.noUpcoming')} />
              </Card>
            ) : (
              upcomingGroups.map((group) => (
                <View key={group.dateKey} style={styles.section}>
                  <View style={styles.sectionHeadRow}>
                    <Text style={styles.sectionTitle}>{dayLabel(group.dateKey)}</Text>
                    <Text style={styles.sectionCount}>{t('cal.records', { n: group.items.length })}</Text>
                  </View>
                  <Card padded={false}>
                    {group.items.map((it, i) => (
                      <View key={it.key} style={i > 0 ? styles.divider : undefined}>
                        {renderItem(it)}
                      </View>
                    ))}
                  </Card>
                </View>
              ))
            )}
            {legend}
          </>
        )}
      </ScrollView>

      {/* Seçili güne hızlı ekle: duruşma / süre — tarih ön dolu gelir */}
      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => setAddOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setAddOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle} numberOfLines={1}>
              {selectedDate === todayKey ? t('cal.addToday') : t('cal.addOn', { date: formatDate(selectedDate) })}
            </Text>
            <Pressable
              style={[styles.sheetAction, { backgroundColor: colors.primarySoft }]}
              onPress={() => {
                setAddOpen(false);
                router.push(`/hearing-form?date=${selectedDate}` as Parameters<typeof router.push>[0]);
              }}
            >
              <Ionicons name="briefcase-outline" size={20} color={colors.primary} />
              <Text style={[styles.sheetActionText, { color: colors.primary }]}>{t('cal.addHearing')}</Text>
            </Pressable>
            <Pressable
              style={[styles.sheetAction, { backgroundColor: colors.goldSoft }]}
              onPress={() => {
                setAddOpen(false);
                router.push(`/deadline-form?date=${selectedDate}` as Parameters<typeof router.push>[0]);
              }}
            >
              <Ionicons name="alarm-outline" size={20} color={colors.gold} />
              <Text style={[styles.sheetActionText, { color: colors.gold }]}>{t('cal.addDeadline')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* İş üzerinde hızlı aksiyon: tamamla / ertele */}
      <Modal visible={!!actionItem} transparent animationType="fade" onRequestClose={() => setActionItem(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setActionItem(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            {actionItem && (
              <>
                <View style={styles.sheetHandle} />
                <Text style={styles.sheetTitle} numberOfLines={1}>
                  {actionItem.title}
                </Text>
                {!!actionItem.subtitle && (
                  <Text style={styles.sheetSub} numberOfLines={1}>
                    {actionItem.subtitle}
                  </Text>
                )}

                <Pressable
                  style={[styles.sheetAction, { backgroundColor: colors.successSoft }]}
                  onPress={() => {
                    completeItem(actionItem, true);
                    setActionItem(null);
                  }}
                >
                  <Ionicons name="checkmark-circle-outline" size={20} color={colors.success} />
                  <Text style={[styles.sheetActionText, { color: colors.success }]}>{t('cal.actionComplete')}</Text>
                </Pressable>

                <Text style={styles.sheetLabel}>{t('cal.actionPostpone')}</Text>
                <View style={styles.postponeRow}>
                  <Pressable style={styles.postponeBtn} onPress={() => postponeBy(actionItem, 1)}>
                    <Text style={styles.postponeText}>{t('cal.postpone1d')}</Text>
                  </Pressable>
                  <Pressable style={styles.postponeBtn} onPress={() => postponeBy(actionItem, 7)}>
                    <Text style={styles.postponeText}>{t('cal.postpone1w')}</Text>
                  </Pressable>
                  <Pressable style={styles.postponeBtn} onPress={() => setPostponePicker(true)}>
                    <Ionicons name="calendar-outline" size={15} color={colors.primary} />
                    <Text style={styles.postponeText}>{t('cal.postponePick')}</Text>
                  </Pressable>
                </View>

                <Pressable
                  style={styles.sheetSecondary}
                  onPress={() => {
                    const target = actionItem;
                    setActionItem(null);
                    router.push(target.route as Parameters<typeof router.push>[0]);
                  }}
                >
                  <Ionicons name="create-outline" size={18} color={colors.textSecondary} />
                  <Text style={styles.sheetSecondaryText}>{t('cal.actionEdit')}</Text>
                </Pressable>

                {postponePicker && (
                  <DateTimePicker locale="tr-TR"
                    value={new Date(`${actionItem.dateKey}T12:00:00`)}
                    mode="date"
                    onChange={(_e, date) => {
                      setPostponePicker(false);
                      if (!date) return;
                      const target = actionItem;
                      setActionItem(null);
                      postponeItem(target, date);
                    }}
                  />
                )}
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Hızlı ekleme */}
      <View style={styles.quickRow}>
        <Pressable
          style={({ pressed }) => [styles.quickBtn, { backgroundColor: colors.primarySoft }, pressed && { opacity: 0.7 }]}
          onPress={() => router.push('/hearing-form' as Parameters<typeof router.push>[0])}
        >
          <Ionicons name="add" size={15} color={colors.primary} />
          <Text style={[styles.quickBtnText, { color: colors.primary }]}>{t('cal.hearing')}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.quickBtn, { backgroundColor: colors.primarySoft }, pressed && { opacity: 0.7 }]}
          onPress={() => router.push('/hearing-form?type=meeting' as Parameters<typeof router.push>[0])}
        >
          <Ionicons name="people-outline" size={15} color={colors.primary} />
          <Text style={[styles.quickBtnText, { color: colors.primary }]}>{t('cal.addMeeting')}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.quickBtn, { backgroundColor: colors.primarySoft }, pressed && { opacity: 0.7 }]}
          onPress={() => router.push('/deadline-wizard' as Parameters<typeof router.push>[0])}
        >
          <Ionicons name="hourglass-outline" size={15} color={colors.primary} />
          <Text style={[styles.quickBtnText, { color: colors.primary }]}>{t('cal.addDuration')}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.quickBtn, { backgroundColor: colors.primarySoft }, pressed && { opacity: 0.7 }]}
          onPress={() => router.push('/deadline-form' as Parameters<typeof router.push>[0])}
        >
          <Ionicons name="list-outline" size={15} color={colors.primary} />
          <Text style={[styles.quickBtnText, { color: colors.primary }]}>{t('cal.addTask')}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  const __t = useTheme();
  const styles = makeStyles(__t.colors);

  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  viewSwitch: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  calendarCard: {
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  calendar: {
    borderRadius: 16,
  },
  monthInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  monthInfoText: {
    ...typography.small,
    color: colors.textSecondary,
  },
  todayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primarySoft,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  todayBtnText: {
    ...typography.small,
    color: colors.primary,
    fontFamily: fonts.bold,

    fontWeight: '700',
  },
  weekCard: {
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
  },
  weekHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  weekTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xs,
  },
  weekDay: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderRadius: 12,
    marginHorizontal: 1,
  },
  weekDayActive: {
    backgroundColor: colors.primary,
  },
  weekDayName: {
    ...typography.small,
    color: colors.textMuted,
  },
  weekDayNum: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontFamily: fonts.bold,

    fontWeight: '700',
    marginTop: 2,
  },
  weekDayTextActive: {
    color: '#FFFFFF',
  },
  weekDots: {
    flexDirection: 'row',
    gap: 3,
    height: 6,
    marginTop: 3,
  },
  weekDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  legend: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    ...typography.small,
    color: colors.textSecondary,
    textTransform: 'none',
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontFamily: fonts.bold,

    fontWeight: '700',
  },
  sectionCount: {
    ...typography.small,
    color: colors.textMuted,
  },
  overdueCard: {
    borderColor: colors.dangerSoft,
    borderWidth: 1,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
  },
  timeCol: {
    width: 56,
  },
  timeText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textPrimary,
    fontFamily: fonts.bold,

    fontWeight: '700',
  },
  timeSub: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 1,
  },
  itemDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  itemIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBody: {
    flex: 1,
  },
  itemTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  itemDoneText: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  itemSub: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 1,
  },
  trailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  sheetTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  sheetSub: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  sheetAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: spacing.sm,
  },
  sheetActionText: {
    ...typography.bodyMedium,
    fontFamily: fonts.bold,
    fontWeight: '700',
  },
  sheetLabel: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  postponeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  postponeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
  },
  postponeText: {
    ...typography.small,
    color: colors.primary,
    fontFamily: fonts.bold,
    fontWeight: '700',
  },
  sheetSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 14,
    marginTop: spacing.md,
  },
  sheetSecondaryText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  quickRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    backgroundColor: colors.bg,
  },
  quickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 2,
  },
  quickBtnText: {
    fontSize: 12.5,
    fontFamily: fonts.bold,

    fontWeight: '700',
  },
});
