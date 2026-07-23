import { useMemo, useState } from 'react';
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
import { AI_ENABLED } from '@/config/features';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import {
  useIctihat,
  useIctihatAnalyze,
  useIctihatDocument,
  useIctihatKunye,
  useIctihatSummary,
  type IctihatHit,
  type IctihatError,
  type IctihatCourt,
} from '@/hooks/useIctihat';
import { ICTIHAT_DIGESTS, matchDigests, type IctihatDigest } from '@/data/ictihatDigest';
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
  const kunye = useIctihatKunye();

  const [mode, setMode] = useState<'analyze' | 'search' | 'kunye'>(AI_ENABLED ? 'analyze' : 'search');
  const [draft, setDraft] = useState('');
  const [court, setCourt] = useState<IctihatCourt>('yargitay');
  const [olay, setOlay] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openHit, setOpenHit] = useState<IctihatHit | null>(null);
  const [openDigest, setOpenDigest] = useState<IctihatDigest | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const runSearch = (q: string, c: IctihatCourt = court) => {
    setSelected(new Set());
    search(q, c);
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
    doc.load(hit.id, hit.src);
  };

  const runSummary = () => {
    setSummaryOpen(true);
    sum.summarize(query, Array.from(selected));
  };

  // Aramayla eşleşen hazır özetlerimiz — sonuçların en üstünde "özetli" gösterilir.
  const matchedDigests = useMemo(() => (mode === 'search' ? matchDigests(query) : []), [mode, query]);

  const errText =
    error === 'rate_limit' ? t('ictihat.errRate') : error === 'source' ? t('ictihat.errSource') : t('ictihat.errGeneric');

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('ictihat.title')} showBack />

      {/* Mod seçimi: Olay Analizi / Kelime Arama / Künye ile Bul */}
      <View style={styles.modePills}>
        {(
          [
            { id: 'analyze', icon: 'sparkles', label: t('ictihat.modeAnalyze') },
            { id: 'search', icon: 'search', label: t('ictihat.modeSearch') },
            { id: 'kunye', icon: 'pricetags', label: t('ictihat.modeKunye') },
          ] as const
        ).map((m) => (
          <Pressable
            key={m.id}
            onPress={() => setMode(m.id)}
            style={[styles.modePill, mode === m.id && styles.modePillActive]}
          >
            <Ionicons name={m.icon} size={15} color={mode === m.id ? colors.textInverse : colors.textSecondary} />
            <Text style={[styles.modePillText, mode === m.id && styles.modePillTextActive]} numberOfLines={1}>
              {m.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        {mode === 'kunye' ? (
          <KunyePanel state={kunye} onOpen={openDoc} />
        ) : mode === 'analyze' ? (
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

        {/* Mahkeme süzgeci — Yargıtay en üst mahkeme, varsayılan odur. */}
        <View style={styles.courtRow}>
          {(
            [
              { id: 'yargitay', label: t('ictihat.courtYargitay') },
              { id: 'emsal', label: t('ictihat.courtEmsal') },
              { id: 'danistay', label: t('ictihat.courtDanistay') },
            ] as const
          ).map((c) => (
            <Pressable
              key={c.id}
              onPress={() => {
                setCourt(c.id);
                if (searched && draft.trim()) runSearch(draft, c.id);
              }}
              style={[styles.courtChip, court === c.id && styles.courtChipActive]}
            >
              <Text style={[styles.courtChipText, court === c.id && styles.courtChipTextActive]}>{c.label}</Text>
            </Pressable>
          ))}
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {!searched && (
            <Welcome
              onPick={(q) => { setDraft(q); runSearch(q); }}
              onOpenDigest={(d) => setOpenDigest(d)}
            />
          )}

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

          {/* Bu konudaki HAZIR ÖZETLERİMİZ — en üstte, "özetli" olarak */}
          {!searching && matchedDigests.length > 0 && (
            <View style={styles.digestMatchWrap}>
              <View style={styles.digestMatchHead}>
                <Ionicons name="sparkles" size={14} color={colors.gold} />
                <Text style={styles.digestMatchHeadText}>{t('ictihat.digestMatch')}</Text>
              </View>
              {matchedDigests.map((d) => (
                <DigestCard key={d.slug} digest={d} onPress={() => setOpenDigest(d)} />
              ))}
            </View>
          )}

          {!searching && hits.length > 0 && (
            <>
              <View style={styles.resultHead}>
                <Text style={styles.resultCount}>
                  {t('ictihat.resultCount', { count: total.toLocaleString('tr-TR') })}
                </Text>
                {AI_ENABLED && <Text style={styles.selectHint}>{t('ictihat.selectHint')}</Text>}
              </View>
              {hits.map((hit) => (
                <HitCard
                  key={hit.id}
                  hit={hit}
                  query={query}
                  selected={selected.has(hit.id)}
                  onToggle={() => toggle(hit.id)}
                  onOpen={() => openDoc(hit)}
                  hideCheckbox={!AI_ENABLED}
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
                <Text style={styles.sourceText}>
                  {t(court === 'emsal' ? 'ictihat.source' : 'ictihat.sourceAdalet')}
                </Text>
              </View>
            </>
          )}
        </ScrollView>

        {/* AI özet çubuğu */}
        {AI_ENABLED && selected.size > 0 && (
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

      {/* Konu özeti (elle hazırlanmış yerleşik içtihat) */}
      <DigestModal
        digest={openDigest}
        onClose={() => setOpenDigest(null)}
        onOpenFull={(d) => {
          setOpenDigest(null);
          openDoc({
            id: d.id,
            daire: d.daire,
            esasNo: d.esas,
            kararNo: d.karar,
            kararTarihi: d.tarih,
            durum: '',
            src: 'yargitay',
          });
        }}
      />
    </Screen>
  );
}

function DigestCard({ digest, onPress }: { digest: IctihatDigest; onPress: () => void }) {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.digestCard, pressed && styles.samplePressed]}>
      <View style={styles.digestCardTop}>
        <View style={styles.digestCatChip}>
          <Text style={styles.digestCatText}>{digest.category}</Text>
        </View>
        <View style={styles.digestBadge}>
          <Ionicons name="sparkles" size={10} color={colors.gold} />
          <Text style={styles.digestBadgeText}>ÖZETLİ</Text>
        </View>
      </View>
      <Text style={styles.digestTitle} numberOfLines={2}>{digest.title}</Text>
      <Text style={styles.digestIlke} numberOfLines={3}>{digest.ilke}</Text>
      <View style={styles.digestKunyeRow}>
        <Text style={styles.digestKunye} numberOfLines={1}>
          {digest.daire} · E.{digest.esas} K.{digest.karar}
        </Text>
        <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

function Welcome({ onPick, onOpenDigest }: { onPick: (q: string) => void; onOpenDigest: (d: IctihatDigest) => void }) {
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

      {/* VİTRİN: hazır konu özetleri — kullanıcı, özet hizmetinin ne olduğunu baştan görsün */}
      <View style={styles.digestHead}>
        <Ionicons name="sparkles" size={16} color={colors.gold} />
        <Text style={styles.digestHeadText}>{t('ictihat.digestsTitle')}</Text>
      </View>
      <Text style={styles.digestDesc}>{t('ictihat.digestsDesc')}</Text>
      {ICTIHAT_DIGESTS.map((d) => (
        <DigestCard key={d.slug} digest={d} onPress={() => onOpenDigest(d)} />
      ))}

      {/* Örnek aramalar en altta */}
      <Text style={styles.samplesLabel}>{t('ictihat.samplesLabel')}</Text>
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

function DigestModal({
  digest,
  onClose,
  onOpenFull,
}: {
  digest: IctihatDigest | null;
  onClose: () => void;
  onOpenFull: (d: IctihatDigest) => void;
}) {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const t = useT();

  return (
    <Modal visible={!!digest} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <Screen edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.modalHeader}>
          <View style={styles.flex}>
            <Text style={styles.modalTitle} numberOfLines={2}>
              {digest?.title}
            </Text>
            {digest && (
              <Text style={styles.modalSub} numberOfLines={1}>
                {digest.daire} · E.{digest.esas} K.{digest.karar} · {digest.tarih}
              </Text>
            )}
          </View>
          <Pressable onPress={onClose} hitSlop={8} style={styles.modalClose}>
            <Ionicons name="close" size={22} color={colors.textPrimary} />
          </Pressable>
        </View>
        {digest && (
          <ScrollView contentContainerStyle={styles.docContent} showsVerticalScrollIndicator={false}>
            <View style={styles.digestIlkeBox}>
              <Text style={styles.digestIlkeLabel}>{t('ictihat.digestIlke')}</Text>
              <Text style={styles.digestIlkeBody}>{digest.ilke}</Text>
            </View>

            {!!digest.dayanak && (
              <View style={styles.digestDayanakRow}>
                <Ionicons name="reader-outline" size={13} color={colors.textMuted} />
                <Text style={styles.digestDayanakText}>{digest.dayanak}</Text>
              </View>
            )}

            <Text style={styles.digestSectionLabel}>{t('ictihat.digestUyusmazlik')}</Text>
            <Text style={styles.docText}>{digest.uyusmazlik}</Text>

            <Text style={styles.digestSectionLabel}>{t('ictihat.digestDegerlendirme')}</Text>
            <Text style={styles.docText}>{digest.degerlendirme}</Text>

            <View style={styles.digestSonucRow}>
              <Text style={styles.digestSectionLabel}>{t('ictihat.digestSonuc')}</Text>
              <View style={[styles.outcomeBadge, { backgroundColor: outcomeColor(digest.outcome, colors).soft, marginTop: 0 }]}>
                <Ionicons name={outcomeColor(digest.outcome, colors).icon} size={11} color={outcomeColor(digest.outcome, colors).fg} />
                <Text style={[styles.outcomeText, { color: outcomeColor(digest.outcome, colors).fg }]}>{digest.outcome}</Text>
              </View>
            </View>
            <Text style={styles.docText}>{digest.sonuc}</Text>

            <Pressable style={styles.digestOpenBtn} onPress={() => onOpenFull(digest)}>
              <Ionicons name="document-text-outline" size={16} color={colors.textInverse} />
              <Text style={styles.digestOpenText}>{t('ictihat.digestOpenFull')}</Text>
            </Pressable>
            <Text style={styles.disclaimer}>{t('ictihat.disclaimer')}</Text>
          </ScrollView>
        )}
      </Screen>
    </Modal>
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

  // AI henüz canlı değil: "Çok Yakında" göster, arka uca istek atma.
  if (!AI_ENABLED) {
    return (
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, styles.analyzeSoonWrap]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.soonIcon}>
          <Ionicons name="sparkles" size={30} color={colors.gold} />
        </View>
        <View style={styles.soonBadge}>
          <Text style={styles.soonBadgeText}>{t('ai.comingSoonBadge')}</Text>
        </View>
        <Text style={styles.soonTitle}>{t('ictihat.analyzeSoon')}</Text>
        <Text style={styles.soonDesc}>{t('ictihat.analyzeSoonDesc')}</Text>
      </ScrollView>
    );
  }

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

/** "E.2019/3641" gibi serbest girdiden "2019/3641" biçimini çıkarır. */
function extractKunyeNo(raw: string): string {
  const m = (raw ?? '').match(/(\d{4})\s*[/\-.]\s*(\d{1,6})/);
  return m ? `${m[1]}/${m[2]}` : '';
}

/**
 * KÜNYE İLE KARAR BULMA — karşı tarafın atıf yaptığı kararın gerçekten var olup
 * olmadığını doğrulamak ya da sadece künyesi bilinen kararın tam metnine ulaşmak.
 */
function KunyePanel({
  state,
  onOpen,
}: {
  state: ReturnType<typeof useIctihatKunye>;
  onOpen: (hit: IctihatHit) => void;
}) {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const t = useT();

  const [esas, setEsas] = useState('');
  const [karar, setKarar] = useState('');
  const [daire, setDaire] = useState('');

  const valid = !!extractKunyeNo(esas) || !!extractKunyeNo(karar);
  // Önizlemede işaretlenecek ifade: girilen esas (yoksa karar) numarası.
  const hq = extractKunyeNo(esas) || extractKunyeNo(karar);

  const errText =
    state.error === 'rate_limit'
      ? t('ictihat.errRate')
      : state.error === 'source'
        ? t('ictihat.errSource')
        : t('ictihat.errGeneric');

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.kunyeCard}>
        <View style={styles.kunyeHead}>
          <Ionicons name="pricetags" size={18} color={colors.gold} />
          <Text style={styles.kunyeTitle}>{t('ictihat.kunyeTitle')}</Text>
        </View>
        <Text style={styles.kunyeDesc}>{t('ictihat.kunyeDesc')}</Text>

        <View style={styles.kunyeRow}>
          <View style={styles.kunyeField}>
            <Text style={styles.kunyeLabel}>{t('ictihat.kunyeEsas')}</Text>
            <TextInput
              style={styles.kunyeInput}
              value={esas}
              onChangeText={setEsas}
              placeholder="2019/3641"
              placeholderTextColor={colors.textMuted}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>
          <View style={styles.kunyeField}>
            <Text style={styles.kunyeLabel}>{t('ictihat.kunyeKarar')}</Text>
            <TextInput
              style={styles.kunyeInput}
              value={karar}
              onChangeText={setKarar}
              placeholder="2022/1689"
              placeholderTextColor={colors.textMuted}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>
        </View>

        <Text style={styles.kunyeLabel}>{t('ictihat.kunyeDaire')}</Text>
        <TextInput
          style={styles.kunyeInput}
          value={daire}
          onChangeText={setDaire}
          placeholder={t('ictihat.kunyeDairePh')}
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
        />

        <Pressable
          disabled={!valid || state.loading}
          onPress={() => state.lookup(esas, karar, daire)}
          style={[styles.kunyeBtn, (!valid || state.loading) && styles.kunyeBtnDisabled]}
        >
          {state.loading ? (
            <ActivityIndicator color={colors.textInverse} size="small" />
          ) : (
            <>
              <Ionicons name="locate" size={16} color={colors.textInverse} />
              <Text style={styles.kunyeBtnText}>{t('ictihat.kunyeBtn')}</Text>
            </>
          )}
        </Pressable>
        {!valid && <Text style={styles.kunyeHint}>{t('ictihat.kunyeHint')}</Text>}
      </View>

      {state.loading && (
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.centerText}>{t('ictihat.kunyeSearching')}</Text>
        </View>
      )}

      {!state.loading && state.error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
          <Text style={styles.errorText}>{errText}</Text>
        </View>
      )}

      {!state.loading && !state.error && state.searched && (
        state.exact.length > 0 ? (
          <>
            <View style={styles.kunyeFound}>
              <Ionicons name="shield-checkmark" size={16} color={colors.success} />
              <Text style={styles.kunyeFoundText}>{t('ictihat.kunyeFound')}</Text>
            </View>
            {state.exact.map((h) => (
              <HitCard
                key={`${h.src ?? 'e'}-${h.id}`}
                hit={h}
                query={hq}
                selected={false}
                onToggle={() => {}}
                onOpen={() => onOpen(h)}
                hideCheckbox
              />
            ))}
          </>
        ) : (
          <View style={styles.kunyeMissing}>
            <Ionicons name="alert-circle" size={20} color={colors.danger} />
            <View style={styles.flex}>
              <Text style={styles.kunyeMissingTitle}>{t('ictihat.kunyeNotFound')}</Text>
              <Text style={styles.kunyeMissingDesc}>{t('ictihat.kunyeNotFoundDesc')}</Text>
            </View>
          </View>
        )
      )}

      {!state.loading && !state.error && state.citing.length > 0 && (
        <>
          <Text style={styles.kunyeCitingHead}>{t('ictihat.kunyeCiting')}</Text>
          {state.citing.map((h) => (
            <HitCard
              key={`${h.src ?? 'e'}-${h.id}`}
              hit={h}
              query={hq}
              selected={false}
              onToggle={() => {}}
              onOpen={() => onOpen(h)}
              hideCheckbox
            />
          ))}
        </>
      )}

      {!state.loading && state.searched && (
        <View style={styles.sourceRow}>
          <Ionicons name="shield-checkmark-outline" size={13} color={colors.textMuted} />
          <Text style={styles.sourceText}>{t('ictihat.source')}</Text>
        </View>
      )}
    </ScrollView>
  );
}

/** Karar sonucuna göre renk/ikon: bozma-kaldırma=kırmızı, onama-kabul=yeşil. */
function outcomeColor(outcome: string, colors: ThemeColors): { fg: string; soft: string; icon: keyof typeof Ionicons.glyphMap } {
  const o = outcome.toLocaleLowerCase('tr');
  if (o.includes('boz') || o.includes('kaldır'))
    return { fg: colors.danger, soft: colors.dangerSoft, icon: 'close-circle' };
  if (o.includes('onama') || o.includes('kabul'))
    return { fg: colors.success, soft: colors.successSoft, icon: 'checkmark-circle' };
  return { fg: colors.gold, soft: colors.goldSoft, icon: 'ellipse' };
}

/** Önizleme metninde aranan kelimeleri sarı ile işaretleyen inline parçalar üretir. */
function highlightSnippet(text: string, query: string, markStyle: object): React.ReactNode {
  const q = (query ?? '').trim();
  if (!text) return null;
  const terms = [q, ...q.split(/\s+/).filter((w) => w.length >= 3)]
    .map((tm) => tm.toLocaleLowerCase('tr-TR'))
    .filter(Boolean);
  const lower = text.toLocaleLowerCase('tr-TR');
  const ranges: Array<[number, number]> = [];
  for (const term of terms) {
    let from = 0;
    for (;;) {
      const i = lower.indexOf(term, from);
      if (i < 0) break;
      ranges.push([i, i + term.length]);
      from = i + term.length;
    }
  }
  if (ranges.length === 0) return text;
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  const parts: React.ReactNode[] = [];
  let cur = 0;
  merged.forEach(([s, e], idx) => {
    if (s > cur) parts.push(text.slice(cur, s));
    parts.push(
      <Text key={`m${idx}`} style={markStyle}>
        {text.slice(s, e)}
      </Text>,
    );
    cur = e;
  });
  if (cur < text.length) parts.push(text.slice(cur));
  return parts;
}

function HitCard({
  hit,
  selected,
  onToggle,
  onOpen,
  hideCheckbox,
  query,
}: {
  hit: IctihatHit;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
  hideCheckbox?: boolean;
  query?: string;
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
        {!!hit.snippet && (
          <Text style={styles.snippet} numberOfLines={4}>
            {highlightSnippet(hit.snippet, query ?? '', styles.snippetMark)}
          </Text>
        )}
        {hit.matched === false && !!query && (
          <View style={styles.notMatchedRow}>
            <Ionicons name="information-circle-outline" size={12} color={colors.textMuted} />
            <Text style={styles.notMatchedText}>
              “{query}” bu kararda birebir geçmiyor — ilgili/yakın sonuç
            </Text>
          </View>
        )}

        {/* Künye detayı: incelenen mahkeme + hüküm/sonuç alıntısı */}
        {!!hit.incelenen && (
          <View style={styles.detailRow}>
            <Ionicons name="git-branch-outline" size={12} color={colors.textMuted} />
            <Text style={styles.detailText} numberOfLines={1}>
              İncelenen: {hit.incelenen}
            </Text>
          </View>
        )}
        {!!hit.sonuc && (
          <View style={styles.sonucBox}>
            <Text style={styles.sonucLabel}>HÜKÜM / SONUÇ</Text>
            <Text style={styles.sonucText} numberOfLines={5}>
              {hit.sonuc}
            </Text>
          </View>
        )}

        <View style={styles.badgeRow}>
          {!!hit.outcome && (
            <View style={[styles.outcomeBadge, { backgroundColor: outcomeColor(hit.outcome, colors).soft }]}>
              <Ionicons name={outcomeColor(hit.outcome, colors).icon} size={11} color={outcomeColor(hit.outcome, colors).fg} />
              <Text style={[styles.outcomeText, { color: outcomeColor(hit.outcome, colors).fg }]}>{hit.outcome}</Text>
            </View>
          )}
          {!!hit.durum && (
            <View style={styles.durumBadge}>
              <Text style={styles.durumText}>{hit.durum}</Text>
            </View>
          )}
          {hit.src === 'yargitay' && (
            <View style={styles.srcBadge}>
              <Text style={styles.srcBadgeText}>Yargıtay</Text>
            </View>
          )}
        </View>
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
  courtRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  courtChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  courtChipActive: {
    backgroundColor: colors.goldSoft,
    borderColor: colors.gold,
  },
  courtChipText: {
    ...typography.small,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  courtChipTextActive: {
    color: colors.gold,
  },
  // ---- Konu özetleri (digest) ----
  digestHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: spacing.xl,
    alignSelf: 'stretch',
  },
  digestHeadText: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  digestDesc: {
    ...typography.small,
    color: colors.textSecondary,
    alignSelf: 'stretch',
    marginTop: 4,
    marginBottom: spacing.sm,
    lineHeight: 17,
  },
  digestMatchWrap: {
    marginBottom: spacing.md,
  },
  digestMatchHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  digestMatchHeadText: {
    ...typography.caption,
    color: colors.gold,
    fontWeight: '800',
  },
  digestCard: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.gold,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  digestCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  digestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.goldSoft,
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  digestBadgeText: {
    ...typography.small,
    color: colors.gold,
    fontWeight: '800',
    fontSize: 9.5,
    letterSpacing: 0.5,
  },
  digestKunyeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  samplesLabel: {
    ...typography.small,
    color: colors.textSecondary,
    fontWeight: '700',
    alignSelf: 'stretch',
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  digestCatChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  digestCatText: {
    ...typography.small,
    color: colors.textSecondary,
    fontWeight: '800',
    fontSize: 10,
  },
  digestTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  digestIlke: {
    ...typography.small,
    color: colors.textSecondary,
    lineHeight: 17,
    marginTop: 4,
  },
  digestKunye: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: 6,
    fontSize: 11,
  },
  digestIlkeBox: {
    backgroundColor: colors.goldSoft,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  digestIlkeLabel: {
    ...typography.small,
    color: colors.gold,
    fontWeight: '800',
    fontSize: 10,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  digestIlkeBody: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
    lineHeight: 21,
  },
  digestOzetLabel: {
    ...typography.small,
    color: colors.textSecondary,
    fontWeight: '800',
    fontSize: 10,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  digestDayanakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    marginBottom: spacing.md,
  },
  digestDayanakText: {
    ...typography.small,
    color: colors.textSecondary,
    fontWeight: '700',
    flex: 1,
  },
  digestSectionLabel: {
    ...typography.small,
    color: colors.gold,
    fontWeight: '800',
    fontSize: 10.5,
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: 6,
  },
  digestSonucRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: 6,
  },
  digestOpenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: spacing.lg,
  },
  digestOpenText: {
    ...typography.bodyMedium,
    color: colors.textInverse,
    fontWeight: '700',
  },
  // Olay analizi — Çok Yakında
  analyzeSoonWrap: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soonIcon: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  soonBadge: {
    backgroundColor: colors.gold,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: spacing.sm,
  },
  soonBadgeText: {
    ...typography.small,
    color: colors.textInverse,
    fontWeight: '800',
    letterSpacing: 1,
    fontSize: 11,
  },
  soonTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  soonDesc: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 22,
    paddingHorizontal: spacing.sm,
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
  snippet: {
    ...typography.small,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: 8,
  },
  snippetMark: {
    backgroundColor: colors.warningSoft,
    color: colors.textPrimary,
    fontWeight: '800',
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
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  outcomeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
  },
  outcomeText: {
    ...typography.small,
    fontWeight: '800',
    fontSize: 10.5,
  },
  notMatchedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  notMatchedText: {
    ...typography.small,
    color: colors.textMuted,
    fontStyle: 'italic',
    flex: 1,
    fontSize: 11,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
  },
  detailText: {
    ...typography.small,
    color: colors.textSecondary,
    flex: 1,
  },
  sonucBox: {
    marginTop: 8,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  sonucLabel: {
    ...typography.small,
    color: colors.gold,
    fontWeight: '800',
    fontSize: 9.5,
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  sonucText: {
    ...typography.small,
    color: colors.textPrimary,
    lineHeight: 17,
  },
  srcBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.goldSoft,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 6,
  },
  srcBadgeText: {
    ...typography.small,
    color: colors.gold,
    fontWeight: '700',
    fontSize: 10.5,
  },
  // ---- Künye ile karar bulma ----
  kunyeCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  kunyeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  kunyeTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  kunyeDesc: {
    ...typography.small,
    color: colors.textSecondary,
    lineHeight: 17,
    marginBottom: spacing.sm,
  },
  kunyeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  kunyeField: {
    flex: 1,
  },
  kunyeLabel: {
    ...typography.small,
    color: colors.textSecondary,
    fontWeight: '700',
    marginBottom: 4,
    marginTop: spacing.xs,
  },
  kunyeInput: {
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
  },
  kunyeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: spacing.md,
  },
  kunyeBtnDisabled: {
    opacity: 0.5,
  },
  kunyeBtnText: {
    ...typography.bodyMedium,
    color: colors.textInverse,
    fontWeight: '700',
  },
  kunyeHint: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
  },
  kunyeFound: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.successSoft,
    borderRadius: 12,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  kunyeFoundText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '800',
    flex: 1,
  },
  kunyeMissing: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.dangerSoft,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  kunyeMissingTitle: {
    ...typography.bodyMedium,
    color: colors.danger,
    fontWeight: '800',
  },
  kunyeMissingDesc: {
    ...typography.small,
    color: colors.textSecondary,
    lineHeight: 17,
    marginTop: 3,
  },
  kunyeCitingHead: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
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
