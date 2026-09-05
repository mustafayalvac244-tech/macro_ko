import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useAuthStore } from '@/store/authStore';
import { useAdminOverview, useAdminUsers, useSetPremium, type AdminUser } from '@/hooks/useAdmin';
import { useAiSaglik } from '@/hooks/useAiSaglik';
import { useT } from '@/i18n';
import { fonts, spacing } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

/**
 * Yönetici Paneli — yalnız is_admin. Büyüme ve satış takibi için: kullanıcı ve
 * premium sayıları, dönemsel yeni kayıt/aktiflik, kullanım (dava/müvekkil/
 * duruşma) ve son kayıtlar listesi. Her kullanıcıya tek dokunuşla premium
 * verilip alınabilir.
 */
export default function AdminScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const t = useT();
  const isAdmin = useAuthStore((s) => s.profile?.is_admin);

  const overview = useAdminOverview();
  const users = useAdminUsers();
  const setPremium = useSetPremium();
  const saglik = useAiSaglik(!!isAdmin);

  if (!isAdmin) {
    return (
      <Screen edges={['top', 'left', 'right', 'bottom']}>
        <ScreenHeader title={t('admin.title')} showBack />
        <View style={styles.denied}>
          <Ionicons name="lock-closed-outline" size={28} color={colors.textMuted} />
          <Text allowFontScaling={false} style={styles.deniedText}>{t('admin.noAccess')}</Text>
        </View>
      </Screen>
    );
  }

  const o = overview.data;
  const refreshing = overview.isFetching || users.isFetching;

  const onRefresh = () => {
    overview.refetch();
    users.refetch();
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('admin.title')} showBack />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl tintColor={colors.textSecondary} refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {overview.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.gold} />
          </View>
        ) : overview.isError ? (
          <View style={styles.center}>
            <Text allowFontScaling={false} style={styles.deniedText}>{t('admin.error')}</Text>
          </View>
        ) : o ? (
          <>
            {/* Kullanıcılar */}
            <Text allowFontScaling={false} style={styles.sectionLabel}>{t('admin.usersSection')}</Text>
            <View style={styles.statGrid}>
              <StatCard icon="people" label={t('admin.totalUsers')} value={o.total_users} colors={colors} accent />
              <StatCard
                icon="star"
                label={t('admin.premiumUsers')}
                value={o.premium_users}
                sub={o.total_users > 0 ? `%${Math.round((o.premium_users / o.total_users) * 100)}` : undefined}
                colors={colors}
                gold
              />
              <StatCard icon="pulse" label={t('admin.activeWeek')} value={o.active_week} colors={colors} />
            </View>

            {/* Büyüme */}
            <Text allowFontScaling={false} style={styles.sectionLabel}>{t('admin.growthSection')}</Text>
            <View style={styles.statGrid}>
              <StatCard icon="today" label={t('admin.newToday')} value={o.new_today} colors={colors} />
              <StatCard icon="calendar" label={t('admin.newWeek')} value={o.new_week} colors={colors} />
              <StatCard icon="trending-up" label={t('admin.newMonth')} value={o.new_month} colors={colors} />
            </View>

            {/* Kullanım */}
            <Text allowFontScaling={false} style={styles.sectionLabel}>{t('admin.usageSection')}</Text>
            <View style={styles.statGrid}>
              <StatCard icon="briefcase" label={t('admin.cases')} value={o.total_cases} colors={colors} />
              <StatCard icon="person" label={t('admin.clients')} value={o.total_clients} colors={colors} />
              <StatCard icon="calendar-number" label={t('admin.hearings')} value={o.total_hearings} colors={colors} />
            </View>

            {/* AI harcaması */}
            <Text allowFontScaling={false} style={styles.sectionLabel}>{t('admin.aiSection')}</Text>
            <View style={styles.statGrid}>
              <StatCard icon="sparkles" label={t('admin.aiCostMonth')} value={Math.round(o.ai_cost_month)} unit="₺" colors={colors} gold sub={t('admin.aiCostHint')} />
              <View style={{ flex: 2 }} />
            </View>

            {/* Sağlayıcı sağlığı. "Yapay zekâ çalışmıyor" bilgisini müşteriden
                öğrenmemek için: yedeksiz kaldığımızda burada görünür. */}
            {saglik.data && (
              <View style={styles.healthBox}>
                <View style={styles.healthHead}>
                  <Ionicons
                    name={saglik.data.yedekli ? 'shield-checkmark' : 'warning'}
                    size={15}
                    color={saglik.data.yedekli ? colors.success : colors.warning}
                  />
                  <Text allowFontScaling={false} style={styles.healthTitle}>
                    {saglik.data.yedekli ? t('admin.aiRedundant') : t('admin.aiNoBackup')}
                  </Text>
                </View>
                {saglik.data.saglayicilar.map((p) => (
                  <Text allowFontScaling={false} key={p.saglayici} style={styles.healthRow}>
                    {p.calisiyor && !p.gercekSonSonuc?.match(/quota|limit|upstream/) ? '● ' : '○ '}
                    {p.saglayici}
                    {p.calisiyor ? ` — ${p.ms ?? 0} ms` : ` — ${p.neden ?? t('admin.aiDown')}`}
                    {/* Yoklama geçse bile son gerçek çağrı kotaya takıldıysa
                        sağlayıcı hizmet veremiyor demektir; iki bilgi ayrı
                        gösterilir, biri diğerini gizlemez. */}
                    {p.gercekSonSonuc && p.gercekSonSonuc !== 'ok'
                      ? `  ·  son gerçek istek: ${p.gercekSonSonuc}`
                      : ''}
                  </Text>
                ))}
              </View>
            )}

            {/* Kullanıcı listesi */}
            <Text allowFontScaling={false} style={styles.sectionLabel}>{t('admin.recentUsers')}</Text>
            {users.isLoading ? (
              <View style={styles.center}><ActivityIndicator color={colors.gold} /></View>
            ) : (
              (users.data ?? []).map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  colors={colors}
                  busy={setPremium.isPending && setPremium.variables?.userId === u.id}
                  onToggle={() => setPremium.mutate({ userId: u.id, value: !u.is_premium })}
                  premiumLabel={t('admin.premium')}
                  grantLabel={t('admin.grant')}
                  revokeLabel={t('admin.revoke')}
                />
              ))
            )}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function tierLabel(tier: string): string {
  const map: Record<string, string> = { free: 'Ücretsiz', baslangic: 'Başlangıç', pro: 'Pro', elit: 'Elit' };
  return map[tier] ?? tier;
}

function StatCard({
  icon,
  label,
  value,
  sub,
  unit,
  colors,
  accent,
  gold,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  sub?: string;
  unit?: string;
  colors: ThemeColors;
  accent?: boolean;
  gold?: boolean;
}) {
  const styles = makeStyles(colors);
  const tint = gold ? colors.gold : accent ? colors.primary : colors.textSecondary;
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: tint + '1E' }]}>
        <Ionicons name={icon} size={16} color={tint} />
      </View>
      <Text allowFontScaling={false} style={styles.statValue}>
        {unit === '₺' ? '₺' : ''}{value.toLocaleString('tr-TR')}{unit && unit !== '₺' ? ` ${unit}` : ''}
      </Text>
      <Text allowFontScaling={false} style={styles.statLabel} numberOfLines={1}>{label}</Text>
      {!!sub && <Text allowFontScaling={false} style={[styles.statSub, { color: tint }]}>{sub}</Text>}
    </View>
  );
}

function UserRow({
  user,
  colors,
  busy,
  onToggle,
  premiumLabel,
  grantLabel,
  revokeLabel,
}: {
  user: AdminUser;
  colors: ThemeColors;
  busy: boolean;
  onToggle: () => void;
  premiumLabel: string;
  grantLabel: string;
  revokeLabel: string;
}) {
  const styles = makeStyles(colors);
  const joined = (() => {
    const d = new Date(user.created_at);
    return isNaN(d.getTime()) ? '' : format(d, 'dd.MM.yyyy');
  })();
  return (
    <View style={styles.userRow}>
      <View style={styles.userAvatar}>
        <Text allowFontScaling={false} style={styles.userAvatarText}>
          {(user.full_name || user.email || '?').trim().charAt(0).toLocaleUpperCase('tr')}
        </Text>
      </View>
      <View style={styles.userBody}>
        <View style={styles.userNameRow}>
          <Text allowFontScaling={false} style={styles.userName} numberOfLines={1}>
            {user.full_name || user.email}
          </Text>
          {user.is_premium && (
            <View style={styles.premiumBadge}>
              <Ionicons name="star" size={9} color={colors.gold} />
              <Text allowFontScaling={false} style={styles.premiumBadgeText}>{premiumLabel}</Text>
            </View>
          )}
        </View>
        <Text allowFontScaling={false} style={styles.userMeta} numberOfLines={1}>
          {user.email}{joined ? `  ·  ${joined}` : ''}
        </Text>
        <View style={styles.userAiRow}>
          <View style={styles.tierChip}>
            <Text allowFontScaling={false} style={styles.tierChipText}>{tierLabel(user.ai_tier)}</Text>
          </View>
          <Ionicons name="sparkles-outline" size={11} color={colors.textMuted} />
          <Text allowFontScaling={false} style={styles.userAiCost}>
            ₺{Math.round(Number(user.ai_cost_try) || 0).toLocaleString('tr-TR')} / ay
          </Text>
        </View>
      </View>
      <Pressable
        onPress={onToggle}
        disabled={busy}
        style={({ pressed }) => [
          styles.toggleBtn,
          user.is_premium ? styles.toggleRevoke : styles.toggleGrant,
          pressed && { opacity: 0.75 },
        ]}
      >
        {busy ? (
          <ActivityIndicator size="small" color={user.is_premium ? colors.danger : colors.textInverse} />
        ) : (
          <Text
            allowFontScaling={false}
            style={[styles.toggleText, { color: user.is_premium ? colors.danger : colors.textInverse }]}
          >
            {user.is_premium ? revokeLabel : grantLabel}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  center: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  denied: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  deniedText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  sectionLabel: {
    fontFamily: fonts.semibold,
    fontWeight: '600',
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  statGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  healthBox: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: 4,
  },
  healthHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  healthTitle: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textPrimary },
  healthRow: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.sm,
  },
  statIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 22,
    color: colors.textPrimary,
  },
  statLabel: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statSub: {
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 11,
    marginTop: 3,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 16,
    color: colors.primary,
  },
  userBody: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userName: {
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 13.5,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.goldSoft,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  premiumBadgeText: {
    fontFamily: fonts.semibold,
    fontWeight: '600',
    fontSize: 9,
    color: colors.gold,
  },
  userMeta: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  userAiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  tierChip: {
    backgroundColor: colors.primarySoft,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  tierChipText: {
    fontFamily: fonts.semibold,
    fontWeight: '700',
    fontSize: 9.5,
    color: colors.primary,
  },
  userAiCost: {
    fontFamily: fonts.medium,
    fontSize: 10.5,
    color: colors.textMuted,
  },
  toggleBtn: {
    minWidth: 66,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderWidth: 1,
  },
  toggleGrant: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  toggleRevoke: {
    backgroundColor: colors.transparent,
    borderColor: colors.danger,
  },
  toggleText: {
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 12,
  },
});
