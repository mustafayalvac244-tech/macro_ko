import React, { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useT } from '@/i18n';
import { kose, spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

/**
 * ARAMA + YENİ ÇUBUĞU.
 *
 * Ürün sahibi Terminal maketindeki bu iki kutuyu beğendi ("yeni butonu arama
 * butonu güzel duruyor") ve panoya EKLENMESİNİ istedi — maketin geri kalanını
 * değil. Kendi sözleriyle: "sadece buna arama ve yeni butonu koy".
 *
 * BU YÜZDEN SADECE İKİ KUTU VAR. Maketteki üçüncü kutu (çalışan sayaç)
 * istenmedi; istenmeyen bir kontrolü "zaten yazmıştım" diye bırakmak paneli
 * kalabalıklaştırır. Sayaç istenirse eklenir, kodu zor değil.
 *
 * HER TEMADA GÖRÜNÜR. Tema koşuluna bağlamadım: arama ve yeni kayıt, temadan
 * bağımsız işlevler. Yalnız Terminal'de görünseydi aynı panonun beş temada
 * eksik bir sürümü olurdu.
 *
 * KLAVYE YALNIZ WEB'DE. Ctrl+K (ve "/") web'de aramayı açar. Telefonda
 * fiziksel klavye yok — orada dinleyici hiç kurulmuyor ve "ctrl+k" ipucu da
 * yazılmıyor, yoksa çalışmayan bir kısayol vaat edilmiş olurdu.
 */
export function AramaVeYeni() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const t = useT();
  const [menuAcik, setMenuAcik] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const dinle = (e: KeyboardEvent) => {
      const hedef = e.target as HTMLElement | null;
      // Bir yazı alanına yazarken kısayol çalışmamalı: "/" karakterini
      // yutarsa kullanıcı tarih ya da adres yazamaz.
      const yaziyor =
        hedef?.tagName === 'INPUT' ||
        hedef?.tagName === 'TEXTAREA' ||
        hedef?.isContentEditable === true;
      const k = e.key.toLowerCase();
      if ((k === 'k' && (e.ctrlKey || e.metaKey)) || (k === '/' && !yaziyor && !e.ctrlKey && !e.metaKey)) {
        e.preventDefault();
        router.push('/search');
      }
    };
    document.addEventListener('keydown', dinle);
    return () => document.removeEventListener('keydown', dinle);
  }, []);

  const git = (yol: string) => {
    setMenuAcik(false);
    router.push(yol as Parameters<typeof router.push>[0]);
  };

  return (
    <View style={styles.cubuk}>
      <Pressable
        style={styles.arama}
        onPress={() => router.push('/search')}
        accessibilityRole="button"
        accessibilityLabel={t('search.title')}
      >
        <Ionicons name="search" size={14} color={colors.textMuted} />
        <Text style={styles.aramaYazi}>{t('ust.ara')}</Text>
        {Platform.OS === 'web' && <Text style={styles.kisayol}>ctrl+k</Text>}
      </Pressable>

      <Pressable
        style={styles.yeni}
        onPress={() => setMenuAcik(true)}
        accessibilityRole="button"
        accessibilityLabel={t('ust.yeni')}
      >
        <Ionicons name="add" size={16} color={colors.textInverse} />
        <Text style={styles.yeniYazi}>{t('ust.yeni')}</Text>
      </Pressable>

      <Modal visible={menuAcik} transparent animationType="fade" onRequestClose={() => setMenuAcik(false)}>
        <Pressable style={styles.perde} onPress={() => setMenuAcik(false)}>
          <Pressable style={styles.menu} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.menuBaslik}>{t('ust.neEklensin')}</Text>
            {YENI_KAYITLAR.map((k) => (
              <Pressable key={k.yol} style={styles.menuSatir} onPress={() => git(k.yol)}>
                <Ionicons name={k.ikon} size={17} color={colors.textSecondary} />
                <Text style={styles.menuYazi}>{t(k.anahtar)}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/**
 * Menüdeki her satır VAR OLAN bir forma gidiyor; altı yolun hepsi app/ altında
 * gerçekten mevcut. Yeni ekran uydurulmadı.
 */
const YENI_KAYITLAR = [
  { yol: '/case-form', ikon: 'briefcase-outline', anahtar: 'ust.yeniDava' },
  { yol: '/client-form', ikon: 'person-add-outline', anahtar: 'ust.yeniMuvekkil' },
  { yol: '/hearing-form', ikon: 'calendar-outline', anahtar: 'ust.yeniDurusma' },
  { yol: '/deadline-form', ikon: 'alarm-outline', anahtar: 'ust.yeniSure' },
  { yol: '/time-entry-form', ikon: 'stopwatch-outline', anahtar: 'ust.yeniCalisma' },
  { yol: '/finance-form', ikon: 'cash-outline', anahtar: 'ust.yeniFinans' },
] as const;

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    cubuk: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    arama: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
      borderRadius: kose(10),
      paddingHorizontal: spacing.sm,
      // Dokunma alanı en az 44 px — küçük bir kutu telefonda ıskalanır.
      minHeight: 44,
    },
    aramaYazi: {
      ...typography.body,
      color: colors.textSecondary,
      flex: 1,
    },
    kisayol: {
      ...typography.small,
      color: colors.textMuted,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      borderRadius: kose(6),
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    yeni: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.primary,
      borderRadius: kose(10),
      paddingHorizontal: spacing.md,
      minHeight: 44,
    },
    yeniYazi: {
      ...typography.bodyMedium,
      color: colors.textInverse,
      fontWeight: '700',
    },
    perde: {
      flex: 1,
      backgroundColor: colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    menu: {
      width: '100%',
      maxWidth: 340,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: kose(14),
      paddingVertical: spacing.xs,
    },
    menuBaslik: {
      ...typography.small,
      color: colors.textMuted,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.xs,
      paddingBottom: spacing.xs,
    },
    menuSatir: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      minHeight: 46,
    },
    menuYazi: {
      ...typography.body,
      color: colors.textPrimary,
    },
  });
