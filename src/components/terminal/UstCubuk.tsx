import React, { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSayacStore } from '@/store/sayacStore';
import { useT } from '@/i18n';
import { kose, spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

/**
 * TERMINAL ÜST ÇUBUĞU — arama · sayaç · yeni.
 *
 * Ürün sahibinin onayladığı maketteki üç kutu. Kendi sözleriyle: "yeni butonu
 * arama butonu güzel duruyor, ek olarak" — yani bu çubuk maketten BEĞENİLEREK
 * istendi, süs değil.
 *
 * ÜÇÜ DE GERÇEK İŞ YAPAR, DEKOR DEĞİL:
 *  • arama → /search (var olan genel arama ekranı)
 *  • sayaç → gerçekten çalışan zamanlayıcıyı gösterir (src/store/sayacStore).
 *    Sayaç kapalıyken 00:00:00 yazar; maketteki gibi. Uydurma bir süre
 *    göstermiyoruz — sayaç başlangıç damgasını sakladığı için uygulama
 *    kapansa bile değer doğrudur.
 *  • + yeni → gerçekten kayıt açan kısa bir menü.
 *
 * KLAVYE YALNIZ WEB'DE. Ctrl+K (ve "/") web'de aramayı açar; maketin tezi
 * "her şey klavyeden" idi. Telefonda fiziksel klavye yok, o yüzden orada
 * dinleyici hiç kurulmuyor — kurulsaydı sessizce ölü kod olurdu.
 */
export function UstCubuk() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const t = useT();
  const [menuAcik, setMenuAcik] = useState(false);

  const startedAt = useSayacStore((s) => s.startedAt);
  const sure = GecenSure(startedAt);

  // Ctrl+K / Cmd+K / "/" → arama. Yalnız web.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const dinle = (e: KeyboardEvent) => {
      const hedef = e.target as HTMLElement | null;
      // Bir yazı alanına yazarken kısayol çalışmamalı: "/" karakterini
      // yutarsa kullanıcı adres ya da tarih yazamaz.
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
        <Text style={styles.aramaSlash}>/</Text>
        <Text style={styles.aramaYazi}>{t('term.ara')}</Text>
        {/* Kısayol ipucu yalnız web'de: telefonda Ctrl tuşu yok, yazması yanıltır. */}
        {Platform.OS === 'web' && <Text style={styles.kisayol}>· ctrl+k</Text>}
      </Pressable>

      <Pressable
        style={styles.kutu}
        onPress={() => router.push('/time-entry-form')}
        accessibilityRole="button"
        accessibilityLabel={t('term.sayac')}
      >
        <Ionicons
          name={startedAt ? 'stopwatch' : 'stopwatch-outline'}
          size={13}
          color={startedAt ? colors.success : colors.textMuted}
        />
        <Text style={[styles.kutuYazi, startedAt ? { color: colors.success } : null]}>{sure}</Text>
      </Pressable>

      <Pressable style={styles.kutu} onPress={() => setMenuAcik(true)} accessibilityRole="button">
        <Ionicons name="add" size={14} color={colors.primary} />
        <Text style={[styles.kutuYazi, { color: colors.primary }]}>{t('term.yeni')}</Text>
      </Pressable>

      <Modal visible={menuAcik} transparent animationType="fade" onRequestClose={() => setMenuAcik(false)}>
        <Pressable style={styles.perde} onPress={() => setMenuAcik(false)}>
          <Pressable style={styles.menu} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.menuBaslik}>{t('file.newChoiceTitle')}</Text>
            {YENI_KAYITLAR.map((k) => (
              <Pressable key={k.yol} style={styles.menuSatir} onPress={() => git(k.yol)}>
                <Ionicons name={k.ikon} size={15} color={colors.textSecondary} />
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
 * Menüdeki her satır VAR OLAN bir forma gidiyor; yolların hepsi app/ altında
 * gerçekten mevcut. Yeni ekran uydurulmadı.
 */
const YENI_KAYITLAR = [
  { yol: '/case-form', ikon: 'briefcase-outline', anahtar: 'term.yeniDava' },
  { yol: '/client-form', ikon: 'person-add-outline', anahtar: 'term.yeniMuvekkil' },
  { yol: '/hearing-form', ikon: 'calendar-outline', anahtar: 'term.yeniDurusma' },
  { yol: '/deadline-form', ikon: 'alarm-outline', anahtar: 'term.yeniSure' },
  { yol: '/time-entry-form', ikon: 'stopwatch-outline', anahtar: 'term.yeniSure2' },
  { yol: '/finance-form', ikon: 'cash-outline', anahtar: 'term.yeniFinans' },
] as const;

/**
 * Sayacın geçen süresi, saniyede bir tazelenir.
 *
 * Saniye GÖSTERİLDİĞİ için saniyede bir tazeleniyor; sayaç kapalıyken hiç
 * zamanlayıcı kurulmuyor — boşta dönen bir aralık pil harcar.
 */
function GecenSure(startedAt: number | null): string {
  const [, tazele] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    const i = setInterval(() => tazele((n) => n + 1), 1000);
    return () => clearInterval(i);
  }, [startedAt]);
  if (!startedAt) return '00:00:00';
  const saniye = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const ikiHane = (n: number) => String(n).padStart(2, '0');
  return `${ikiHane(Math.floor(saniye / 3600))}:${ikiHane(Math.floor((saniye % 3600) / 60))}:${ikiHane(saniye % 60)}`;
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    cubuk: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingBottom: spacing.sm,
    },
    arama: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bg,
      borderRadius: kose(4),
      paddingHorizontal: spacing.xs,
      paddingVertical: 7,
    },
    aramaSlash: {
      ...typography.caption,
      color: colors.textMuted,
    },
    aramaYazi: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    kisayol: {
      ...typography.caption,
      color: colors.textMuted,
    },
    kutu: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bg,
      borderRadius: kose(4),
      paddingHorizontal: spacing.xs,
      paddingVertical: 7,
    },
    kutuYazi: {
      ...typography.caption,
      color: colors.textSecondary,
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
      maxWidth: 320,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: kose(4),
      paddingVertical: spacing.xs,
    },
    menuBaslik: {
      ...typography.small,
      color: colors.textMuted,
      paddingHorizontal: spacing.sm,
      paddingTop: spacing.xxs,
      paddingBottom: spacing.xs,
    },
    menuSatir: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      minHeight: 34,
    },
    menuYazi: {
      ...typography.body,
      color: colors.textPrimary,
    },
  });
