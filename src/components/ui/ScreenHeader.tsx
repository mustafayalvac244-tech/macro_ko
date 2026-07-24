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
          // Geri oku solda, tek başına — baş parmağın doğal yeri. Ana sayfa
          // kısayolu ise KARŞI köşeye (sağ üst) alındı; ikisi yan yana durup
          // birbirine karışmıyor, her biri kendi köşesinde amaçlı görünüyor.
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </Pressable>
        ) : (
          showMenu && (
            <Pressable onPress={openSidebar} hitSlop={10} style={styles.menuButton}>
              <Ionicons name="menu" size={24} color={colors.textPrimary} />
            </Pressable>
          )
        )}
        <View style={styles.titleWrap}>
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

      {/* Sağ köşe: ana sayfa kısayolu (derin ekranlarda) + ekrana özel eylem. */}
      <View style={styles.right}>
        {deep && !hideHome && (
          <Pressable onPress={goHome} hitSlop={10} style={styles.homeButton}>
            <Ionicons name="home-outline" size={20} color={colors.textPrimary} />
          </Pressable>
        )}
        {rightIcon && onRightPress && (
          <Pressable onPress={onRightPress} hitSlop={10} style={styles.rightButton}>
            <Ionicons name={rightIcon} size={22} color={colors.textPrimary} />
          </Pressable>
        )}
      </View>
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
    flex: 1,
  },
  titleWrap: {
    flexShrink: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginLeft: spacing.sm,
  },
  backButton: {
    marginRight: spacing.xs,
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
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
