import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useClients } from '@/hooks/useClients';
import {
  isExpired,
  isUsable,
  SPECIAL_AUTHORITIES,
  useCreatePoa,
  useDeletePoa,
  usePowersOfAttorney,
  type PoaKind,
  type PowerOfAttorney,
  type SpecialAuthority,
} from '@/hooks/usePowersOfAttorney';
import { useT } from '@/i18n';
import { fonts, spacing, shadow } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { formatDate } from '@/utils/format';

const KINDS: PoaKind[] = ['genel', 'ozel', 'bosanma', 'tanima_tenfiz'];

/**
 * VEKALET YÖNETİMİ — rakip büro yazılımlarının tamamında var, bizde yoktu.
 * Kritik değeri: HMK m.74'e göre sulh, feragat, kabul, ahzu kabz gibi işlemler
 * ancak vekaletnamede AÇIKÇA yetki verilmişse yapılabilir. Ekran bu yetkileri
 * tek tek gösterir; avukat "bu vekaletnamede ahzu kabz yok" diye görebilir.
 */
export default function VekaletScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const t = useT();

  const list = usePowersOfAttorney();
  const clients = useClients();
  const createPoa = useCreatePoa();
  const deletePoa = useDeletePoa();

  const [formOpen, setFormOpen] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [kind, setKind] = useState<PoaKind>('genel');
  const [notary, setNotary] = useState('');
  const [notaryNo, setNotaryNo] = useState('');
  const [issued, setIssued] = useState('');
  const [auths, setAuths] = useState<Record<string, boolean>>({});

  const rows = list.data ?? [];
  const stats = useMemo(
    () => ({
      total: rows.length,
      usable: rows.filter(isUsable).length,
      problem: rows.filter((r) => !isUsable(r)).length,
    }),
    [rows]
  );

  const resetForm = () => {
    setClientId(null);
    setKind('genel');
    setNotary('');
    setNotaryNo('');
    setIssued('');
    setAuths({});
  };

  const save = async () => {
    if (!clientId) {
      Alert.alert(t('poa.title'), t('poa.pickClientFirst'));
      return;
    }
    try {
      await createPoa.mutateAsync({
        client_id: clientId,
        kind,
        notary_name: notary.trim() || null,
        notary_no: notaryNo.trim() || null,
        issued_date: /^\d{4}-\d{2}-\d{2}$/.test(issued.trim()) ? issued.trim() : null,
        valid_until: null,
        status: 'aktif',
        status_date: null,
        document_path: null,
        notes: null,
        auth_sulh: !!auths.auth_sulh,
        auth_feragat: !!auths.auth_feragat,
        auth_kabul: !!auths.auth_kabul,
        auth_ahzu_kabz: !!auths.auth_ahzu_kabz,
        auth_temyiz: !!auths.auth_temyiz,
        auth_tahkim: !!auths.auth_tahkim,
        auth_isticvap: !!auths.auth_isticvap,
      });
      setFormOpen(false);
      resetForm();
    } catch {
      Alert.alert(t('poa.title'), t('poa.saveFailed'));
    }
  };

  const confirmDelete = (p: PowerOfAttorney) => {
    Alert.alert(t('poa.deleteTitle'), t('poa.deleteMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deletePoa.mutate(p.id) },
    ]);
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('poa.title')} showBack rightIcon="add" onRightPress={() => setFormOpen(true)} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.lead}>{t('poa.lead')}</Text>

        {rows.length > 0 && (
          <View style={styles.statRow}>
            <Stat label={t('poa.statTotal')} value={stats.total} color={colors.textPrimary} />
            <Stat label={t('poa.statUsable')} value={stats.usable} color={colors.success} />
            <Stat label={t('poa.statProblem')} value={stats.problem} color={stats.problem ? colors.danger : colors.textMuted} />
          </View>
        )}

        {list.isLoading ? (
          <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />
        ) : rows.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="ribbon-outline" size={30} color={colors.textMuted} />
            <Text style={styles.emptyText}>{t('poa.empty')}</Text>
            <Pressable onPress={() => setFormOpen(true)} style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}>
              <Ionicons name="add" size={17} color="#FFFFFF" />
              <Text style={styles.addBtnText}>{t('poa.add')}</Text>
            </Pressable>
          </View>
        ) : (
          rows.map((p) => {
            const expired = isExpired(p);
            const bad = !isUsable(p);
            const granted = SPECIAL_AUTHORITIES.filter((k) => p[k as SpecialAuthority]);
            const missing = SPECIAL_AUTHORITIES.filter((k) => !p[k as SpecialAuthority]);
            return (
              <View key={p.id} style={[styles.card, bad && styles.cardBad]}>
                <View style={styles.cardHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>{p.client?.full_name ?? t('poa.noClient')}</Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {t(`poa.kind.${p.kind}` as const)}
                      {p.notary_name ? ` · ${p.notary_name}` : ''}
                      {p.notary_no ? ` · ${p.notary_no}` : ''}
                      {p.issued_date ? ` · ${formatDate(p.issued_date)}` : ''}
                    </Text>
                  </View>
                  <Pressable onPress={() => confirmDelete(p)} hitSlop={8} style={styles.del}>
                    <Ionicons name="trash-outline" size={17} color={colors.textMuted} />
                  </Pressable>
                </View>

                <View style={[styles.badge, bad ? styles.badgeBad : styles.badgeOk]}>
                  <Ionicons
                    name={bad ? 'alert-circle' : 'checkmark-circle'}
                    size={12}
                    color={bad ? colors.danger : colors.success}
                  />
                  <Text style={[styles.badgeText, { color: bad ? colors.danger : colors.success }]}>
                    {expired ? t('poa.status.suresi_doldu') : t(`poa.status.${p.status}` as const)}
                  </Text>
                </View>

                {granted.length > 0 && (
                  <View style={styles.authWrap}>
                    {granted.map((k) => (
                      <View key={k} style={styles.authOk}>
                        <Ionicons name="checkmark" size={11} color={colors.success} />
                        <Text style={styles.authOkText}>{t(`poa.auth.${k}` as const)}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {missing.length > 0 && (
                  <View style={styles.warnBox}>
                    <Ionicons name="warning-outline" size={14} color={colors.warning} />
                    <Text style={styles.warnText}>
                      {t('poa.missingWarn', { list: missing.map((k) => t(`poa.auth.${k}` as const)).join(', ') })}
                    </Text>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ── Ekleme formu ── */}
      <Modal visible={formOpen} animationType="slide" transparent onRequestClose={() => setFormOpen(false)}>
        <View style={styles.mBack}>
          <Pressable style={styles.mDismiss} onPress={() => setFormOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{t('poa.add')}</Text>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={styles.label}>{t('poa.client')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  {(clients.data ?? []).slice(0, 30).map((c) => (
                    <Pressable
                      key={c.id}
                      onPress={() => setClientId(c.id)}
                      style={[styles.chip, clientId === c.id && styles.chipOn]}
                    >
                      <Text style={[styles.chipText, clientId === c.id && styles.chipTextOn]} numberOfLines={1}>
                        {c.full_name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <Text style={styles.label}>{t('poa.kindLabel')}</Text>
                <View style={styles.chipsWrap}>
                  {KINDS.map((k) => (
                    <Pressable key={k} onPress={() => setKind(k)} style={[styles.chip, kind === k && styles.chipOn]}>
                      <Text style={[styles.chipText, kind === k && styles.chipTextOn]}>{t(`poa.kind.${k}` as const)}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.label}>{t('poa.notary')}</Text>
                <TextInput style={styles.input} value={notary} onChangeText={setNotary} placeholder={t('poa.notaryPh')} placeholderTextColor={colors.textMuted} />
                <Text style={styles.label}>{t('poa.notaryNo')}</Text>
                <TextInput style={styles.input} value={notaryNo} onChangeText={setNotaryNo} placeholder={t('poa.notaryNoPh')} placeholderTextColor={colors.textMuted} />
                <Text style={styles.label}>{t('poa.issued')}</Text>
                <TextInput style={styles.input} value={issued} onChangeText={setIssued} placeholder="2026-01-15" placeholderTextColor={colors.textMuted} />

                <Text style={styles.label}>{t('poa.authsLabel')}</Text>
                <Text style={styles.hint}>{t('poa.authsHint')}</Text>
                <View style={styles.chipsWrap}>
                  {SPECIAL_AUTHORITIES.map((k) => (
                    <Pressable
                      key={k}
                      onPress={() => setAuths((a) => ({ ...a, [k]: !a[k] }))}
                      style={[styles.chip, auths[k] && styles.chipOn]}
                    >
                      {auths[k] && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                      <Text style={[styles.chipText, auths[k] && styles.chipTextOn]}>{t(`poa.auth.${k}` as const)}</Text>
                    </Pressable>
                  ))}
                </View>

                <Pressable onPress={save} disabled={createPoa.isPending} style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]}>
                  {createPoa.isPending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveText}>{t('common.save')}</Text>
                  )}
                </Pressable>
                <View style={{ height: spacing.xl }} />
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  const __t = useTheme();
  const styles = makeStyles(__t.colors);
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  lead: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.textSecondary, marginBottom: spacing.md },
  statRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: 16, paddingVertical: spacing.md, alignItems: 'center', ...shadow.card },
  statValue: { fontFamily: fonts.extrabold, fontWeight: '800', fontSize: 20, letterSpacing: -0.5 },
  statLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  emptyText: { fontFamily: fonts.regular, fontSize: 13.5, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: spacing.lg, lineHeight: 19 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 11, paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  addBtnText: { fontFamily: fonts.bold, fontWeight: '700', fontSize: 14, color: '#FFFFFF' },
  card: { backgroundColor: colors.surface, borderRadius: 18, padding: spacing.md, marginBottom: spacing.sm, ...shadow.card },
  cardBad: { borderWidth: 1, borderColor: colors.danger },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  name: { fontFamily: fonts.bold, fontWeight: '700', fontSize: 15, letterSpacing: -0.2, color: colors.textPrimary },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  del: { padding: 4 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, marginTop: spacing.sm },
  badgeOk: { backgroundColor: colors.successSoft },
  badgeBad: { backgroundColor: colors.dangerSoft },
  badgeText: { fontFamily: fonts.bold, fontWeight: '700', fontSize: 11 },
  authWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: spacing.sm },
  authOk: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.successSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  authOkText: { fontFamily: fonts.semibold, fontWeight: '600', fontSize: 11, color: colors.success },
  warnBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: colors.warningSoft, borderRadius: 10, padding: spacing.sm, marginTop: spacing.sm },
  warnText: { fontFamily: fonts.medium, fontSize: 11.5, lineHeight: 16, color: colors.textPrimary, flex: 1 },
  // form
  mBack: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  mDismiss: { flex: 1 },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, maxHeight: '88%' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginTop: spacing.sm },
  sheetTitle: { fontFamily: fonts.extrabold, fontWeight: '800', fontSize: 18, letterSpacing: -0.3, color: colors.textPrimary, marginVertical: spacing.sm },
  label: { fontFamily: fonts.semibold, fontWeight: '600', fontSize: 12, color: colors.textSecondary, marginTop: spacing.md, marginBottom: 6 },
  hint: { fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 16, color: colors.textMuted, marginBottom: 6 },
  chips: { gap: 6, paddingRight: 4 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 210, backgroundColor: colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  chipOn: { backgroundColor: colors.primary },
  chipText: { fontFamily: fonts.semibold, fontWeight: '600', fontSize: 12.5, color: colors.textSecondary },
  chipTextOn: { color: '#FFFFFF' },
  input: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.borderSubtle, paddingHorizontal: spacing.md, paddingVertical: 12, fontFamily: fonts.regular, fontSize: 14, color: colors.textPrimary },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: spacing.lg },
  saveText: { fontFamily: fonts.extrabold, fontWeight: '800', fontSize: 15, color: '#FFFFFF' },
});
