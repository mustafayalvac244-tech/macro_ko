import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Belir, girisOynadi, useHareketAzalt } from '@/components/ui/Belir';
import { perdeyiBekle } from '@/lib/acilisPerdesi';
import { haftaYuku, type HaftaGunu } from '@/lib/haftaYuku';
import { useT } from '@/i18n';
import { fonts, kose, spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

/** Çubuk alanının yüksekliği (px). Tasarım seçimi. */
const YUKSEKLIK = 96;
const GUN_ANAHTARI = ['wk.mon', 'wk.tue', 'wk.wed', 'wk.thu', 'wk.fri', 'wk.sat', 'wk.sun'] as const;

/**
 * BU HAFTA KARTI (06.10.2026; tasarim/ilham/fernly-ozellikler.md kare 01/10).
 *
 * Pazartesiden pazara her gün için duruşma + süre sayısı, üst üste çubuk.
 * Bugün vurgulu. Bir güne dokununca (web'de üstüne gelince) alttaki satır o
 * günün dökümünü yazar — videodaki grafik ipucunun karşılığı; renk tek başına
 * bilgi taşımaz, döküm metinle de yazılır.
 * Veri ana ekranın zaten yüklediği listelerden gelir; ek istek YOK.
 */
export function BuHaftaKarti({
  durusmalar,
  sureler,
  cerceve,
  sira,
}: {
  durusmalar: readonly { scheduled_at: string }[] | undefined;
  sureler: readonly { due_at: string }[] | undefined;
  cerceve?: StyleProp<ViewStyle>;
  sira: number;
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const t = useT();
  const gunler = useMemo(() => haftaYuku(durusmalar ?? [], sureler ?? []), [durusmalar, sureler]);
  const enCok = Math.max(1, ...gunler.map((g) => g.durusma + g.sure));
  const bugunSira = gunler.find((g) => g.bugun)?.sira ?? 0;
  const [secili, setSecili] = useState(bugunSira);
  const toplam = gunler.reduce((n, g) => n + g.durusma + g.sure, 0);

  // Çubuklar sıfırdan büyür (perde kalktıktan sonra, açılışta bir kez).
  const azalt = useHareketAzalt();
  const [oynat] = useState(() => !girisOynadi());
  const buyu = useRef(new Animated.Value(oynat ? 0 : 1)).current;
  useEffect(() => {
    if (!oynat || azalt === null) return;
    if (azalt) {
      buyu.setValue(1);
      return;
    }
    const anim = Animated.timing(buyu, {
      toValue: 1,
      duration: 600,
      delay: 200 + sira * 60,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // yükseklik yerel sürücüde canlandırılamaz
    });
    const iptal = perdeyiBekle(() => anim.start());
    return () => {
      iptal();
      anim.stop();
      buyu.setValue(1);
    };
  }, [oynat, azalt, sira, buyu]);

  const s = gunler[secili] ?? gunler[0];
  const dokum = (g: HaftaGunu) =>
    g.durusma + g.sure === 0
      ? t('wk.bos')
      : [g.durusma ? t('wk.durusma', { n: String(g.durusma) }) : '', g.sure ? t('wk.sure', { n: String(g.sure) }) : '']
          .filter(Boolean)
          .join(' · ');

  return (
    <Belir sira={sira} style={cerceve}>
      <View style={styles.baslikSatir}>
        <View style={styles.baslikSol}>
          <Ionicons name="bar-chart-outline" size={15} color={colors.primary} />
          <Text allowFontScaling={false} style={styles.baslik}>{t('wk.title')}</Text>
        </View>
        <Pressable
          style={styles.baslikSag}
          onPress={() => router.push('/(app)/calendar' as Parameters<typeof router.push>[0])}
          hitSlop={10}
          accessibilityRole="link"
        >
          <Text allowFontScaling={false} style={styles.bag}>{t('wk.takvim')}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.izgara}>
        {gunler.map((g) => {
          const d = (g.durusma / enCok) * YUKSEKLIK;
          const su = (g.sure / enCok) * YUKSEKLIK;
          const aktif = g.sira === secili;
          return (
            <Pressable
              key={g.tarih}
              style={styles.sutun}
              onPress={() => setSecili(g.sira)}
              {...(Platform.OS === 'web' ? { onHoverIn: () => setSecili(g.sira) } : null)}
              accessibilityRole="button"
              accessibilityState={{ selected: aktif }}
              accessibilityLabel={`${t(GUN_ANAHTARI[g.sira])}: ${dokum(g)}`}
            >
              <Text allowFontScaling={false} style={[styles.adet, aktif && styles.adetAktif]}>
                {g.durusma + g.sure || ''}
              </Text>
              <View style={[styles.kuyu, aktif && styles.kuyuAktif]}>
                <Animated.View style={{ height: buyu.interpolate({ inputRange: [0, 1], outputRange: [0, su] }) }}>
                  <View style={[styles.parca, { backgroundColor: colors.warning }]} />
                </Animated.View>
                <Animated.View style={{ height: buyu.interpolate({ inputRange: [0, 1], outputRange: [0, d] }) }}>
                  <View style={[styles.parca, { backgroundColor: colors.info }]} />
                </Animated.View>
              </View>
              <Text allowFontScaling={false} style={[styles.gun, g.bugun && styles.gunBugun]}>
                {t(GUN_ANAHTARI[g.sira])}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.altSatir}>
        <Text style={styles.dokum} numberOfLines={1}>
          <Text style={styles.dokumGun}>{s.bugun ? t('wk.bugun') : t(GUN_ANAHTARI[s.sira])}: </Text>
          {dokum(s)}
        </Text>
        <View style={styles.anahtar}>
          <View style={[styles.nokta, { backgroundColor: colors.info }]} />
          <Text allowFontScaling={false} style={styles.anahtarYazi}>{t('wk.anahtarDurusma')}</Text>
          <View style={[styles.nokta, { backgroundColor: colors.warning }]} />
          <Text allowFontScaling={false} style={styles.anahtarYazi}>{t('wk.anahtarSure')}</Text>
        </View>
      </View>
      {toplam === 0 && <Text style={styles.bosHafta}>{t('wk.bosHafta')}</Text>}
    </Belir>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    baslikSatir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
    baslikSol: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    baslik: { fontFamily: fonts.extrabold, fontWeight: '800', fontSize: 16.5, color: colors.textPrimary, letterSpacing: -0.3 },
    baslikSag: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32 },
    bag: { fontFamily: fonts.semibold, fontWeight: '600', fontSize: 13, color: colors.primary },
    izgara: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs },
    sutun: { flex: 1, alignItems: 'center', gap: spacing.xxs, minHeight: 44 },
    adet: { ...typography.small, color: colors.textMuted, fontWeight: '700', minHeight: 14 },
    adetAktif: { color: colors.textPrimary },
    kuyu: {
      width: '100%',
      maxWidth: 28,
      height: YUKSEKLIK,
      borderRadius: kose(8),
      backgroundColor: colors.surfaceAlt,
      overflow: 'hidden',
      justifyContent: 'flex-end',
    },
    kuyuAktif: { borderWidth: 1, borderColor: colors.primary },
    parca: { flex: 1 },
    gun: { ...typography.small, color: colors.textSecondary, fontWeight: '600' },
    gunBugun: { color: colors.primary, fontWeight: '800' },
    altSatir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
    dokum: { ...typography.caption, color: colors.textSecondary, flexShrink: 1 },
    dokumGun: { color: colors.textPrimary, fontWeight: '700' },
    anahtar: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    nokta: { width: 8, height: 8, borderRadius: kose(4), marginLeft: 4 },
    anahtarYazi: { ...typography.small, color: colors.textMuted },
    bosHafta: { ...typography.small, color: colors.textMuted, marginTop: spacing.xxs },
  });
}
