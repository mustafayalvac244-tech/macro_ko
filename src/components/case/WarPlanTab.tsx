import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { isMissingBriefTable, useBrief, useSaveBrief, type BriefSections } from '@/hooks/useBriefs';
import {
  CHECKLIST_ITEMS,
  generateAiBrief,
  generateTemplateBrief,
  getOpenAiKey,
  setOpenAiKey,
  type ChecklistItem,
} from '@/utils/briefEngine';
import { useT } from '@/i18n';
import { fonts, spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { formatTime } from '@/utils/format';
import type { CaseWithClient, Hearing } from '@/types/database';

const EMPTY_BRIEF: BriefSections = { acilis: '', dayanaklar: '', tanik: '', karsi: '', sonrasi: '' };

const SECTION_KEYS: Array<{ key: keyof BriefSections; label: string }> = [
  { key: 'acilis', label: 'plan.secAcilis' },
  { key: 'dayanaklar', label: 'plan.secDayanak' },
  { key: 'tanik', label: 'plan.secTanik' },
  { key: 'karsi', label: 'plan.secKarsi' },
  { key: 'sonrasi', label: 'plan.secSonrasi' },
];

const DEBRIEF_TASKS = ['gorevTanik', 'gorevDelil', 'gorevDilekce', 'gorevMuvekkil', 'gorevCelse'] as const;

interface Props {
  caseItem: CaseWithClient;
  hearings: Hearing[] | undefined;
}

export function WarPlanTab({ caseItem, hearings }: Props) {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const t = useT();

  const brief = useBrief(caseItem.id);
  const saveBrief = useSaveBrief();

  const [sections, setSections] = useState<BriefSections>(EMPTY_BRIEF);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Array<{ at: string; text: string }>>([]);
  const [debriefGood, setDebriefGood] = useState('');
  const [debriefBad, setDebriefBad] = useState('');
  const [source, setSource] = useState<string | undefined>(undefined);
  const [generating, setGenerating] = useState(false);
  const [loadedFromDb, setLoadedFromDb] = useState(false);

  // AI anahtarı (opsiyonel)
  const [showAiKey, setShowAiKey] = useState(false);
  const [aiKey, setAiKeyState] = useState('');
  const [hasAiKey, setHasAiKey] = useState(false);
  useEffect(() => {
    getOpenAiKey().then((k) => setHasAiKey(!!k));
  }, []);

  // DB'deki kayıt gelince yerel duruma bir kez yükle
  useEffect(() => {
    if (loadedFromDb || !brief.data) return;
    const c = brief.data.content ?? {};
    setSections({ ...EMPTY_BRIEF, ...(c.brief ?? {}) });
    setChecklist(c.checklist ?? {});
    setNotes(c.notes ?? []);
    setDebriefGood(c.debrief?.good ?? '');
    setDebriefBad(c.debrief?.bad ?? '');
    setSource(c.source);
    setLoadedFromDb(true);
  }, [brief.data, loadedFromDb]);

  // ── Son 24 saat modu ─────────────────────────────────────────────────────
  const nextHearing = useMemo(() => {
    const now = Date.now();
    return (hearings ?? [])
      .filter((h) => !h.is_completed && new Date(h.scheduled_at).getTime() > now)
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0];
  }, [hearings]);
  const within24h = nextHearing
    ? new Date(nextHearing.scheduled_at).getTime() - Date.now() < 24 * 60 * 60 * 1000
    : false;

  const elevator = useMemo(() => {
    const taraf = caseItem.client?.full_name ?? '—';
    const karsi = caseItem.opposing_party || '—';
    return t('plan.elevatorText', {
      title: caseItem.title,
      no: caseItem.case_number || '—',
      client: taraf,
      opposing: karsi,
      court: caseItem.court_name || '—',
      type: caseItem.case_type || '—',
    });
  }, [caseItem, t]);

  // ── Duruşma modu: kronometre + sessiz notlar ─────────────────────────────
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [quickNote, setQuickNote] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [running]);
  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;

  const handleGenerate = async () => {
    setGenerating(true);
    let result: BriefSections | null = null;
    let usedSource = 'template';
    if (hasAiKey) {
      result = await generateAiBrief({ caseItem });
      if (result) usedSource = 'ai';
    }
    if (!result) result = generateTemplateBrief({ caseItem });
    setSections(result);
    setSource(usedSource);
    setGenerating(false);
    if (hasAiKey && usedSource === 'template') {
      Alert.alert(t('plan.title'), t('plan.aiFailed'));
    }
  };

  const handleSave = () => {
    saveBrief.mutate(
      {
        caseId: caseItem.id,
        content: {
          brief: sections,
          checklist,
          notes,
          debrief: { good: debriefGood, bad: debriefBad },
          source,
        },
      },
      {
        onSuccess: () => Alert.alert(t('plan.title'), t('plan.saved')),
        onError: (e) =>
          Alert.alert(t('plan.title'), isMissingBriefTable(e) ? t('plan.setupRequired') : t('financeForm.saveFailed')),
      }
    );
  };

  const handleShare = () => {
    const body = SECTION_KEYS.map(({ key, label }) => `■ ${t(label as never)}\n\n${sections[key] || '—'}`).join('\n\n');
    Share.share({
      message: `DURUŞMA BRIEF — ${caseItem.title}${caseItem.case_number ? ` (${caseItem.case_number})` : ''}\n\n${body}\n\n— Vekil Pro`,
    }).catch(() => {});
  };

  const addQuickNote = () => {
    if (!quickNote.trim()) return;
    setNotes((n) => [...n, { at: `${mmss}`, text: quickNote.trim() }]);
    setQuickNote('');
  };

  const hasBrief = Object.values(sections).some((s) => s.trim().length > 0);

  return (
    <View>
      {/* Son 24 saat bandı */}
      {within24h && nextHearing && (
        <Card style={styles.h24Card}>
          <View style={styles.h24Head}>
            <Ionicons name="flash" size={16} color={colors.warning} />
            <Text style={styles.h24Title}>{t('plan.h24Title')}</Text>
            <Text style={styles.h24Time}>{formatTime(nextHearing.scheduled_at)}</Text>
          </View>
          <Text style={styles.elevator}>{elevator}</Text>
        </Card>
      )}

      {brief.error && isMissingBriefTable(brief.error) && (
        <Card style={styles.warnCard}>
          <Text style={styles.warnText}>{t('plan.setupRequired')}</Text>
        </Card>
      )}

      {/* Brief */}
      <Card style={styles.card}>
        <View style={styles.cardHead}>
          <Ionicons name="document-text-outline" size={17} color={colors.primary} />
          <Text style={styles.cardTitle}>{t('plan.briefTitle')}</Text>
          {source && <Text style={styles.sourceBadge}>{source === 'ai' ? 'AI' : t('plan.template')}</Text>}
        </View>
        <Button
          label={hasBrief ? t('plan.regen') : t('plan.generate')}
          icon="sparkles-outline"
          loading={generating}
          onPress={handleGenerate}
          fullWidth
        />
        <Pressable style={styles.aiKeyRow} onPress={() => setShowAiKey((v) => !v)}>
          <Ionicons name={hasAiKey ? 'key' : 'key-outline'} size={13} color={colors.textMuted} />
          <Text style={styles.aiKeyText}>{hasAiKey ? t('plan.aiOn') : t('plan.aiOff')}</Text>
          <Ionicons name={showAiKey ? 'chevron-up' : 'chevron-down'} size={13} color={colors.textMuted} />
        </Pressable>
        {showAiKey && (
          <View style={styles.aiKeyBox}>
            <Input
              placeholder="sk-..."
              value={aiKey}
              onChangeText={setAiKeyState}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Button
              label={t('common.save')}
              size="sm"
              variant="secondary"
              onPress={async () => {
                await setOpenAiKey(aiKey);
                setHasAiKey(!!aiKey.trim());
                setShowAiKey(false);
                setAiKeyState('');
              }}
            />
            <Text style={styles.aiKeyHint}>{t('plan.aiHint')}</Text>
          </View>
        )}

        {hasBrief &&
          SECTION_KEYS.map(({ key, label }) => (
            <View key={key} style={styles.section}>
              <Text style={styles.sectionLabel}>{t(label as never)}</Text>
              <Input
                value={sections[key]}
                onChangeText={(v) => setSections((s) => ({ ...s, [key]: v }))}
                multiline
                numberOfLines={6}
                style={styles.sectionInput}
              />
            </View>
          ))}

        {hasBrief && (
          <View style={styles.rowButtons}>
            <Button label={t('plan.save')} icon="save-outline" onPress={handleSave} loading={saveBrief.isPending} style={styles.flex1} />
            <Button label={t('plan.share')} icon="share-outline" variant="secondary" onPress={handleShare} style={styles.flex1} />
          </View>
        )}
      </Card>

      {/* Kontrol listesi */}
      <Card style={styles.card}>
        <View style={styles.cardHead}>
          <Ionicons name="checkbox-outline" size={17} color={colors.primary} />
          <Text style={styles.cardTitle}>{t('plan.checkTitle')}</Text>
          <Text style={styles.checkCount}>
            {CHECKLIST_ITEMS.filter((i) => checklist[i]).length}/{CHECKLIST_ITEMS.length}
          </Text>
        </View>
        {CHECKLIST_ITEMS.map((item: ChecklistItem) => (
          <Pressable
            key={item}
            style={styles.checkRow}
            onPress={() => setChecklist((c) => ({ ...c, [item]: !c[item] }))}
          >
            <Ionicons
              name={checklist[item] ? 'checkmark-circle' : 'ellipse-outline'}
              size={22}
              color={checklist[item] ? colors.success : colors.textMuted}
            />
            <Text style={[styles.checkLabel, checklist[item] && styles.checkDone]}>
              {t(`plan.chk.${item}` as never)}
            </Text>
          </Pressable>
        ))}
      </Card>

      {/* Duruşma modu */}
      <Card style={styles.card}>
        <View style={styles.cardHead}>
          <Ionicons name="timer-outline" size={17} color={colors.primary} />
          <Text style={styles.cardTitle}>{t('plan.modeTitle')}</Text>
        </View>
        <View style={styles.timerRow}>
          <Text style={styles.timerText}>{mmss}</Text>
          <Button
            label={running ? t('plan.pause') : elapsed > 0 ? t('plan.resume') : t('plan.start')}
            size="sm"
            variant={running ? 'secondary' : 'primary'}
            onPress={() => setRunning((r) => !r)}
          />
          {elapsed > 0 && !running && (
            <Button label={t('plan.reset')} size="sm" variant="secondary" onPress={() => setElapsed(0)} />
          )}
        </View>
        <View style={styles.noteRow}>
          <View style={styles.flex1}>
            <Input placeholder={t('plan.notePh')} value={quickNote} onChangeText={setQuickNote} />
          </View>
          <Button label={t('plan.noteAdd')} size="sm" variant="secondary" onPress={addQuickNote} />
        </View>
        {notes.map((n, i) => (
          <View key={i} style={styles.noteItem}>
            <Text style={styles.noteTime}>{n.at}</Text>
            <Text style={styles.noteText}>{n.text}</Text>
            <Ionicons
              name="close-circle"
              size={16}
              color={colors.textMuted}
              suppressHighlighting
              onPress={() => setNotes((list) => list.filter((_, j) => j !== i))}
            />
          </View>
        ))}
        <Text style={styles.legalNote}>{t('plan.legalNote')}</Text>
      </Card>

      {/* Debrief */}
      <Card style={styles.card}>
        <View style={styles.cardHead}>
          <Ionicons name="analytics-outline" size={17} color={colors.primary} />
          <Text style={styles.cardTitle}>{t('plan.debriefTitle')}</Text>
        </View>
        <Text style={styles.sectionLabel}>{t('plan.debriefGood')}</Text>
        <Input value={debriefGood} onChangeText={setDebriefGood} multiline numberOfLines={3} style={styles.debriefInput} />
        <Text style={styles.sectionLabel}>{t('plan.debriefBad')}</Text>
        <Input value={debriefBad} onChangeText={setDebriefBad} multiline numberOfLines={3} style={styles.debriefInput} />
        <Text style={styles.sectionLabel}>{t('plan.debriefTasks')}</Text>
        <View style={styles.taskChips}>
          {DEBRIEF_TASKS.map((task) => (
            <Pressable
              key={task}
              style={styles.taskChip}
              onPress={() =>
                router.push(
                  `/deadline-form?caseId=${caseItem.id}&title=${encodeURIComponent(t(`plan.${task}` as never))}` as Parameters<typeof router.push>[0]
                )
              }
            >
              <Ionicons name="add" size={13} color={colors.primary} />
              <Text style={styles.taskChipText}>{t(`plan.${task}` as never)}</Text>
            </Pressable>
          ))}
        </View>
        <Button
          label={t('plan.save')}
          icon="save-outline"
          variant="secondary"
          onPress={handleSave}
          loading={saveBrief.isPending}
          fullWidth
          style={styles.debriefSave}
        />
      </Card>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  cardTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    flex: 1,
  },
  sourceBadge: {
    ...typography.small,
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  h24Card: {
    marginBottom: spacing.md,
    borderColor: colors.warning,
    borderWidth: 1,
  },
  h24Head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.xs,
  },
  h24Title: {
    ...typography.bodyMedium,
    color: colors.warning,
    flex: 1,
  },
  h24Time: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  elevator: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  warnCard: {
    marginBottom: spacing.md,
    borderColor: colors.warning,
    borderWidth: 1,
  },
  warnText: {
    ...typography.caption,
    color: colors.warning,
    lineHeight: 18,
  },
  aiKeyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  aiKeyText: {
    ...typography.small,
    color: colors.textMuted,
  },
  aiKeyBox: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  aiKeyHint: {
    ...typography.small,
    color: colors.textMuted,
    lineHeight: 15,
  },
  section: {
    marginTop: spacing.sm,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 6,
    fontFamily: fonts.semibold,
  },
  sectionInput: {
    minHeight: 110,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  rowButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  flex1: {
    flex: 1,
  },
  checkCount: {
    ...typography.caption,
    color: colors.textMuted,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 8,
  },
  checkLabel: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  checkDone: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  timerText: {
    fontSize: 34,
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    color: colors.textPrimary,
    flex: 1,
    fontVariant: ['tabular-nums'],
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  noteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  noteTime: {
    ...typography.small,
    color: colors.primary,
    width: 44,
  },
  noteText: {
    ...typography.caption,
    color: colors.textPrimary,
    flex: 1,
  },
  legalNote: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.sm,
    lineHeight: 15,
  },
  debriefInput: {
    minHeight: 70,
    textAlignVertical: 'top',
    paddingTop: 10,
    marginBottom: spacing.xs,
  },
  taskChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  taskChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primarySoft,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  taskChipText: {
    ...typography.caption,
    color: colors.primary,
  },
  debriefSave: {
    marginTop: spacing.md,
  },
});
