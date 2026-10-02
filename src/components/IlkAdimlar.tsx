import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useClients } from '@/hooks/useClients';
import { useT } from '@/i18n';
import { spacing, typography, kose } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

/**
 * İLK ADIMLAR — 03.10.2026, satış planı.
 *
 * NEDEN. Ölçülen akış: yeni kullanıcı kayıt oluyor, yapay zekâya bir soru
 * soruyor, müvekkil ya da dosya EKLEMİYOR ve bir daha gelmiyor. Kayıttan sonra
 * boş ana ekrana düşüyordu ("Bugün için planlanmış bir işlem yok"); ne
 * yapacağını söyleyen hiçbir şey yoktu.
 *
 * Üç adım, her biri tek dokunuş. Müvekkil adımı gerçek veriden işaretlenir
 * (müvekkili var mı); arama ve yapay zekâ adımları dokunulunca. Üçü bitince ya
 * da "Gizle" denince bir daha görünmez (cihazda saklanır — sunucuya bir şey
 * yazılmaz).
 */
const ANAHTAR = 'ilkAdimlar.v1';

type Durum = { arama?: boolean; ai?: boolean; kapali?: boolean };

export function IlkAdimlar({ aiAcik }: { aiAcik: boolean }) {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const t = useT();
  const muvekkiller = useClients();
  const [durum, setDurum] = useState<Durum | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ANAHTAR)
      .then((v) => setDurum(v ? (JSON.parse(v) as Durum) : {}))
      .catch(() => setDurum({}));
  }, []);

  const kaydet = (yeni: Durum) => {
    setDurum(yeni);
    AsyncStorage.setItem(ANAHTAR, JSON.stringify(yeni)).catch(() => {});
  };

  if (!durum || durum.kapali || muvekkiller.isLoading) return null;

  const muvekkilVar = (muvekkiller.data?.length ?? 0) > 0;
  const adimlar = [
    { id: 'muvekkil', ikon: 'person-add-outline' as const, baslik: t('ilk.client'), alt: t('ilk.clientSub'), bitti: muvekkilVar, git: '/client-form' },
    { id: 'arama', ikon: 'search-outline' as const, baslik: t('ilk.search'), alt: t('ilk.searchSub'), bitti: !!durum.arama, git: '/ictihat' },
    ...(aiAcik
      ? [{ id: 'ai', ikon: 'sparkles-outline' as const, baslik: t('ilk.ai'), alt: t('ilk.aiSub'), bitti: !!durum.ai, git: '/ai-chat' }]
      : []),
  ];
  if (adimlar.every((a) => a.bitti)) return null;
  const biten = adimlar.filter((a) => a.bitti).length;

  return (
    <View style={styles.kutu}>
      <View style={styles.ust}>
        <View style={{ flex: 1 }}>
          <Text style={styles.baslik}>{t('ilk.title')}</Text>
          <Text style={styles.altBaslik}>{t('ilk.progress', { biten: String(biten), toplam: String(adimlar.length) })}</Text>
        </View>
        <Pressable onPress={() => kaydet({ ...durum, kapali: true })} hitSlop={12} accessibilityLabel={t('ilk.hide')}>
          <Text style={styles.gizle}>{t('ilk.hide')}</Text>
        </Pressable>
      </View>
      {adimlar.map((a) => (
        <Pressable
          key={a.id}
          accessibilityLabel={a.baslik}
          style={({ pressed }) => [styles.satir, pressed && { opacity: 0.8 }]}
          onPress={() => {
            if (a.id === 'arama' || a.id === 'ai') kaydet({ ...durum, [a.id]: true });
            router.push(a.git as Parameters<typeof router.push>[0]);
          }}
        >
          <View style={[styles.ikon, a.bitti && styles.ikonBitti]}>
            <Ionicons name={a.bitti ? 'checkmark' : a.ikon} size={18} color={a.bitti ? colors.textInverse : colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.satirBaslik, a.bitti && styles.ustuCizili]}>{a.baslik}</Text>
            <Text style={styles.satirAlt}>{a.alt}</Text>
          </View>
          {!a.bitti && <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
        </Pressable>
      ))}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    kutu: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: kose(16),
      padding: spacing.md,
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    ust: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
    baslik: { ...typography.h3, color: colors.textPrimary },
    altBaslik: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
    gizle: { ...typography.caption, color: colors.textMuted },
    satir: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs, minHeight: 44 },
    ikon: {
      width: 36,
      height: 36,
      borderRadius: kose(10),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primarySoft,
    },
    ikonBitti: { backgroundColor: colors.success },
    satirBaslik: { ...typography.body, color: colors.textPrimary },
    ustuCizili: { textDecorationLine: 'line-through', color: colors.textMuted },
    satirAlt: { ...typography.caption, color: colors.textSecondary },
  });
