import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { useSidebarStore } from '@/store/sidebarStore';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  /** Show a hamburger button that opens the left navigation panel. */
  showMenu?: boolean;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightPress?: () => void;
  /** Derin ekranlarda geri okunun yanındaki "ana sayfa" kısayolunu gizler. */
  hideHome?: boolean;
}

/** Derin gezinme yığınını temizleyip doğrudan ana sayfaya döner. */
function goHome() {
  try {
    // Üstteki modal/formları kapat, sonra ana sekmeye geçmişi sararak dön.
    const r = router as unknown as { canDismiss?: () => boolean; dismissAll?: () => void };
    if (r.canDismiss?.()) r.dismissAll?.();
  } catch {
    // yoksay
  }
  router.navigate('/(app)' as Parameters<typeof router.navigate>[0]);
}

export function ScreenHeader({ title, subtitle, showBack, showMenu, rightIcon, onRightPress, hideHome }: ScreenHeaderProps) {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);
  const openSidebar = useSidebarStore((s) => s.open);
  // Bir önceki ekran varsa geri okunu göster (alt sekmeden açılan Takvim,
  // Dosyalar, Müvekkiller gibi ekranlarda da menünün yanında görünür).
  const canGoBack = router.canGoBack();
  const deep = showBack || canGoBack;

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        {deep ? (
          // İçeri girilen ekranda geri oku + ana sayfa kısayolu tek bir bütünleşik
          // kontrolde toplanır: [ ‹ | 🏠 ]. Böylece iki ayrı buton yan yana dağınık
          // durmaz; hem geri gitmek hem derin yığından doğrudan ana sayfaya dönmek
          // tek, kasıtlı görünen bir "pill" üzerinden yapılır.
          <View style={styles.navGroup}>
            <Pressable onPress={() => router.back()} hitSlop={8} style={styles.navBtn}>
              <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
            </Pressable>
            {!hideHome && (
              <>
                <View style={styles.navDivider} />
                <Pressable onPress={goHome} hitSlop={8} style={styles.navBtn}>
                  <Ionicons name="home-outline" size={19} color={colors.textPrimary} />
                </Pressable>
              </>
            )}
          </View>
        ) : (
          showMenu && (
            <Pressable onPress={openSidebar} hitSlop={10} style={styles.menuButton}>
              <Ionicons name="menu" size={24} color={colors.textPrimary} />
            </Pressable>
          )
        )}
        <View>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>
      {rightIcon && onRightPress && (
        <Pressable onPress={onRightPress} hitSlop={10} style={styles.rightButton}>
          <Ionicons name={rightIcon} size={22} color={colors.textPrimary} />
        </Pressable>
      )}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  navGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    marginRight: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
  },
  navBtn: {
    width: 42,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navDivider: {
    width: 1,
    height: 20,
    backgroundColor: colors.borderSubtle,
  },
  menuButton: {
    marginRight: spacing.sm,
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rightButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
