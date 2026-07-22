import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import {
  useIctihat,
  useIctihatAnalyze,
  useIctihatDocument,
  useIctihatSummary,
  type IctihatHit,
  type IctihatError,
} from '@/hooks/useIctihat';
import { useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

const MAX_SELECT = 4;

export default function IctihatScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const t = useT();

  const { query, hits, total, searching, loadingMore, hasMore, error, searched, search, loadMore } = useIctihat();
  const analyze = useIctihatAnalyze();
  const doc = useIctihatDocument();
  const sum = useIctihatSummary();

  const [mode, setMode] = useState<'analyze' | 'search'>('analyze');
  const [draft, setDraft] = useState('');
  const [olay, setOlay] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openHit, setOpenHit] = useState<IctihatHit | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const runSearch = (q: string) => {
    setSelected(new Set());
    search(q);
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_SELECT) next.add(id);
      return next;
    });
  };

  const openDoc = (hit: IctihatHit) => {
    setOpenHit(hit);
    doc.load(hit.id);
  };

  const runSummary = () => {
    setSummaryOpen(true);
    sum.summarize(query, Array.from(selected));
  };

  const errText =
    error === 'rate_limit' ? t('ictihat.errRate') : error === 'source' ? t('ictihat.errSource') : t('ictihat.errGeneric');

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('ictihat.title')} showBack />

      {/* Mod seçimi: Olay Analizi (akıl yürütme) / Kelime Arama */}
      <View style={styles.modePills}>
        <Pressable
          onPress={() => setMode('analyze')}
          style={[styles.modePill, mode === 'analyze' && styles.modePillActive]}
        >
          <Ionicons name="sparkles" size={15} color={mode === 'analyze' ? colors.textInverse : colors.textSecondary} />
          <Text style={[styles.modePillText, mode === 'analyze' && styles.modePillTextActive]}>
            {t('ictihat.modeAnalyze')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode('search')}
          style={[styles.modePill, mode === 'search' && styles.modePillActive]}
        >
          <Ionicons name="search" size={15} color={mode === 'search' ? colors.textInverse : colors.textSecondary} />
          <Text style={[styles.modePillText, mode === 'search' && styles.modePillTextActive]}>
            {t('ictihat.modeSearch')}
          </Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        {mode === 'analyze' ? (
          <AnalyzePanel
            olay={olay}
            setOlay={setOlay}
            state={analyze}
            onOpen={openDoc}
          />
        ) : (
        <>
        {/* Arama kutusu */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={draft}
            onChangeText={setDraft}
            placeholder={t('ictihat.searchPlaceholder')}
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            onSubmitEditing={() => runSearch(draft)}
          />
          {draft.length > 0 && (
            <Pressable onPress={() => setDraft('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {!searched && <Welcome onPick={(q) => { setDraft(q); runSearch(q); }} />}

          {searching && (
            <View style={styles.centerBox}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.centerText}>{t('ictihat.searching')}</Text>
            </View>
          )}

          {!searching && error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
              <Text style={styles.errorText}>{errText}</Text>
            </View>
          )}

          {!searching && !error && searched && hits.length === 0 && (
            <View style={styles.centerBox}>
              <Ionicons name="document-outline" size={30} color={colors.textMuted} />
              <Text style={styles.centerText}>{t('ictihat.empty')}</Text>
            </View>
          )}

          {!searching && hits.length > 0 && (
            <>
              <View style={styles.resultHead}>
                <Text style={styles.resultCount}>
                  {t('ictihat.resultCount', { count: total.toLocaleString('tr-TR') })}
                </Text>
                <Text style={styles.selectHint}>{t('ictihat.selectHint')}</Text>
              </View>
              {hits.map((hit) => (
                <HitCard
                  key={hit.id}
                  hit={hit}
                  selected={selected.has(hit.id)}
                  onToggle={() => toggle(hit.id)}
                  onOpen={() => openDoc(hit)}
                />
              ))}
              {hasMore && (
                <Pressable
                  onPress={loadMore}
                  disabled={loadingMore}
                  style={({ pressed }) => [styles.loadMore, pressed && styles.samplePressed]}
                >
                  {loadingMore ? (
                    <ActivityIndicator color={colors.primary} size="small" />
                  ) : (
                    <>
                      <Ionicons name="chevron-down" size={16} color={colors.primary} />
                      <Text style={styles.loadMoreText}>{t('ictihat.loadMore')}</Text>
                    </>
                  )}
                </Pressable>
              )}
              <View style={styles.sourceRow}>
                <Ionicons name="shield-checkmark-outline" size={13} color={colors.textMuted} />
                <Text style={styles.sourceText}>{t('ictihat.source')}</Text>
              </View>
            </>
          )}
        </ScrollView>

        {/* AI özet çubuğu */}
        {selected.size > 0 && (
          <View style={styles.summaryBar}>
            <Pressable onPress={runSummary} style={styles.summaryBtn}>
              <Ionicons name="sparkles" size={18} color={colors.textInverse} />
              <Text style={styles.summaryBtnText}>{t('ictihat.summarizeBtn', { count: selected.size })}</Text>
            </Pressable>
          </View>
        )}
        </>
        )}
      </KeyboardAvoidingView>

      {/* Karar tam metni */}
      <DocModal
        visible={!!openHit}
        hit={openHit}
        loading={doc.loading}
        text={doc.text}
        error={doc.error}
        onClose={() => setOpenHit(null)}
      />

      {/* AI özet */}
      <SummaryModal
        visible={summaryOpen}
        loading={sum.loading}
        summary={sum.summary}
        error={sum.error}
        onClose={() => {
          setSummaryOpen(false);
          sum.reset();
        }}
      />
    </Screen>
  );
}

function Welcome({ onPick }: { onPick: (q: string) => void }) {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const t = useT();
  const samples = [t('ictihat.sample1'), t('ictihat.sample2'), t('ictihat.sample3')];

  return (
    <View style={styles.welcome}>
      <View style={styles.welcomeIcon}>
        <Ionicons name="library" size={28} color={colors.gold} />
      </View>
      <Text style={styles.welcomeTitle}>{t('ictihat.welcome')}</Text>
      <Text style={styles.welcomeDesc}>{t('ictihat.welcomeDesc')}</Text>
      <View style={styles.samples}>
        {samples.map((s) => (
          <Pressable key={s} onPress={() => onPick(s)} style={({ pressed }) => [styles.sample, pressed && styles.samplePressed]}>
            <Ionicons name="search-outline" size={15} color={colors.primary} />
            <Text style={styles.sampleText}>{s}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function AnalyzePanel({
  olay,
  setOlay,
  state,
  onOpen,
}: {
  olay: string;
  setOlay: (s: string) => void;
  state: ReturnType<typeof useIctihatAnalyze>;
  onOpen: (h: IctihatHit) => void;
}) {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const t = useT();
  const { analysis, hits, loading, error, done, analyze } = state;

  const errText: string =
    error === 'ai_off'
      ? t('ictihat.errAiOff')
      : error === 'rate_limit'
        ? t('ictihat.errRate')
        : error === 'source'
          ? t('ictihat.errSource')
          : t('ictihat.errGeneric');
  const canRun = olay.trim().length >= 15 && !loading;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.analyzeIntro}>
        <Text style={styles.analyzeTitle}>{t('ictihat.analyzeTitle')}</Text>
        <Text style={styles.analyzeDesc}>{t('ictihat.analyzeDesc')}</Text>
      </View>

      <TextInput
        style={styles.analyzeInput}
        value={olay}
        onChangeText={setOlay}
        placeholder={t('ictihat.analyzePlaceholder')}
        placeholderTextColor={colors.textMuted}
        multiline
        textAlignVertical="top"
      />

      <Pressable
        onPress={() => analyze(olay)}
        disabled={!canRun}
        style={[styles.analyzeBtn, !canRun && styles.analyzeBtnDisabled]}
      >
        {loading ? (
          <ActivityIndicator color={colors.textInverse} size="small" />
        ) : (
          <>
            <Ionicons name="sparkles" size={18} color={colors.textInverse} />
            <Text style={styles.analyzeBtnText}>{t('ictihat.analyzeBtn')}</Text>
          </>
        )}
      </Pressable>

      {loading && (
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.centerText}>{t('ictihat.analyzing')}</Text>
        </View>
      )}

      {!loading && error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
          <Text style={styles.errorText}>{errText}</Text>
        </View>
      )}

      {!loading && !error && done && !!analysis && (
        <>
          <View style={styles.analysisCard}>
            <Text style={styles.analysisText}>{analysis}</Text>
          </View>
          {hits.length > 0 && (
            <>
              <Text style={styles.analyzeResultsHead}>{t('ictihat.analyzeRefs')}</Text>
              {hits.map((h) => (
                <HitCard key={h.id} hit={h} selected={false} onToggle={() => {}} onOpen={() => onOpen(h)} hideCheckbox />
              ))}
              <View style={styles.sourceRow}>
                <Ionicons name="shield-checkmark-outline" size={13} color={colors.textMuted} />
                <Text style={styles.sourceText}>{t('ictihat.source')}</Text>
              </View>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

function HitCard({
  hit,
  selected,
  onToggle,
  onOpen,
  hideCheckbox,
}: {
  hit: IctihatHit;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
  hideCheckbox?: boolean;
}) {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);

  return (
    <View style={[styles.card, selected && styles.cardSelected]}>
      {!hideCheckbox && (
        <Pressable onPress={onToggle} hitSlop={6} style={styles.checkbox}>
          <Ionicons
            name={selected ? 'checkbox' : 'square-outline'}
            size={22}
            color={selected ? colors.primary : colors.textMuted}
          />
        </Pressable>
      )}
      <Pressable onPress={onOpen} style={styles.cardBody}>
        <Text style={styles.cardDaire} numberOfLines={2}>
          {hit.daire}
        </Text>
        <View style={styles.cardMeta}>
          <View style={styles.metaChip}>
            <Ionicons name="pricetag-outline" size={12} color={colors.textSecondary} />
            <Text style={styles.metaChipText}>
              E.{hit.esasNo} · K.{hit.kararNo}
            </Text>
          </View>
          <View style={styles.metaChip}>
            <Ionicons name="calendar-outline" size={12} color={colors.textSecondary} />
            <Text style={styles.metaChipText}>{hit.kararTarihi}</Text>
          </View>
        </View>
        {!!hit.durum && (
          <View style={styles.durumBadge}>
            <Text style={styles.durumText}>{hit.durum}</Text>
          </View>
        )}
      </Pressable>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </View>
  );
}

function DocModal({
  visible,
  hit,
  loading,
  text,
  error,
  onClose,
}: {
  visible: boolean;
  hit: IctihatHit | null;
  loading: boolean;
  text: string;
  error: IctihatError | null;
  onClose: () => void;
}) {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const t = useT();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <Screen edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.modalHeader}>
          <View style={styles.flex}>
            <Text style={styles.modalTitle} numberOfLines={1}>
              {t('ictihat.fullText')}
            </Text>
            {hit && (
              <Text style={styles.modalSub} numberOfLines={1}>
                {hit.daire} · E.{hit.esasNo} K.{hit.kararNo}
              </Text>
            )}
          </View>
          <Pressable onPress={onClose} hitSlop={8} style={styles.modalClose}>
            <Ionicons name="close" size={22} color={colors.textPrimary} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.docContent} showsVerticalScrollIndicator={false}>
          {loading && (
            <View style={styles.centerBox}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.centerText}>{t('ictihat.loadingDoc')}</Text>
            </View>
          )}
          {!loading && error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
              <Text style={styles.errorText}>
                {error === 'source' ? t('ictihat.errSource') : t('ictihat.errGeneric')}
              </Text>
            </View>
          )}
          {!loading && !error && !!text && <Text style={styles.docText}>{text}</Text>}
          {!loading && !error && (
            <Text style={styles.disclaimer}>{t('ictihat.disclaimer')}</Text>
          )}
        </ScrollView>
      </Screen>
    </Modal>
  );
}

function SummaryModal({
  visible,
  loading,
  summary,
  error,
  onClose,
}: {
  visible: boolean;
  loading: boolean;
  summary: string;
  error: IctihatError | null;
  onClose: () => void;
}) {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const t = useT();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <Screen edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.modalHeader}>
          <View style={styles.modalTitleRow}>
            <Ionicons name="sparkles" size={18} color={colors.gold} />
            <Text style={styles.modalTitle}>{t('ictihat.summaryTitle')}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={8} style={styles.modalClose}>
            <Ionicons name="close" size={22} color={colors.textPrimary} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.docContent} showsVerticalScrollIndicator={false}>
          {loading && (
            <View style={styles.centerBox}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.centerText}>{t('ictihat.summarizing')}</Text>
            </View>
          )}
          {!loading && error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
              <Text style={styles.errorText}>
                {error === 'rate_limit' ? t('ictihat.errRate') : error === 'source' ? t('ictihat.errSource') : t('ictihat.errGeneric')}
              </Text>
            </View>
          )}
          {!loading && !error && !!summary && <Text style={styles.docText}>{summary}</Text>}
        </ScrollView>
      </Screen>
    </Modal>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1 },
  // Mod seçim pilleri
  modePills: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  modePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modePillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modePillText: {
    ...typography.small,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  modePillTextActive: {
    color: colors.textInverse,
  },
  // Olay analizi
  analyzeIntro: {
    marginBottom: spacing.sm,
  },
  analyzeTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  analyzeDesc: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 2,
  },
  analyzeInput: {
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.md,
    minHeight: 140,
    marginBottom: spacing.sm,
  },
  analyzeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
  },
  analyzeBtnDisabled: {
    opacity: 0.45,
  },
  analyzeBtnText: {
    ...typography.bodyMedium,
    color: colors.textInverse,
    fontWeight: '800',
  },
  analysisCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 14,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  analysisText: {
    ...typography.body,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  analyzeResultsHead: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '800',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    height: 46,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  // Karşılama
  welcome: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.sm,
  },
  welcomeIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  welcomeTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  welcomeDesc: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  samples: {
    alignSelf: 'stretch',
    gap: spacing.sm,
  },
  sample: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  samplePressed: { backgroundColor: colors.surfaceHover },
  sampleText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    flex: 1,
  },
  // Sonuç başlığı
  resultHead: {
    marginBottom: spacing.sm,
  },
  resultCount: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  selectHint: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: 2,
  },
  // Kart
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  checkbox: {
    paddingRight: 2,
  },
  cardBody: {
    flex: 1,
  },
  cardDaire: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  cardMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  metaChipText: {
    ...typography.small,
    color: colors.textSecondary,
  },
  durumBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.successSoft,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 6,
  },
  durumText: {
    ...typography.small,
    color: colors.success,
    fontWeight: '700',
    fontSize: 10.5,
  },
  loadMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 2,
    marginBottom: spacing.xs,
  },
  loadMoreText: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '700',
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: spacing.sm,
  },
  sourceText: {
    ...typography.small,
    color: colors.textMuted,
  },
  // Durum kutuları
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  centerText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.dangerSoft,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  errorText: {
    ...typography.small,
    color: colors.danger,
    flex: 1,
  },
  // AI özet çubuğu
  summaryBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    backgroundColor: colors.bg,
  },
  summaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
  },
  summaryBtnText: {
    ...typography.bodyMedium,
    color: colors.textInverse,
    fontWeight: '800',
  },
  // Modal
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  modalTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  modalSub: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
  modalClose: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  docContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  docText: {
    ...typography.body,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  disclaimer: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.lg,
    fontStyle: 'italic',
  },
});
