import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { radius, spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string | null;
  icon?: keyof typeof Ionicons.glyphMap;
  containerStyle?: object;
  /**
   * Göz düğmesini kapatmak için. Varsayılan AÇIK: secureTextEntry verilen her
   * kutuda göster/gizle düğmesi çıkar. Yalnız kutunun içeriği ekrana hiç
   * yansımamalıysa (ör. omuz üstünden okunma riskinin kabul edilmediği bir
   * alan) kapatılır.
   */
  gozDugmesi?: boolean;
}

/**
 * ŞİFRE GÖZ DÜĞMESİ — neden eklendi.
 *
 * Kullanıcı "üyelikte zorluk varsa kolaylaştır, başka uygulamalardan kopyala"
 * dedi. Şifre kutusunda göster/gizle düğmesi bugün istisnasız her uygulamada
 * var ve sebebi şu: telefon klavyesinde 8+ karakterlik bir şifre KÖR yazılıyor.
 * Yanlış yazıldığında dönen cevap "E-posta veya şifre hatalı" oluyor ve
 * kullanıcı şifresini yanlış hatırladığını sanıp şifre sıfırlamaya gidiyor —
 * oysa yalnız bir harfi kaçırmış. Bizim şifre sıfırlama akışımızın bu kadar
 * yıpratıcı olmasının bir sebebi de buraya hiç bakmamış olmamız.
 */
export function Input({
  label,
  error,
  icon,
  containerStyle,
  style,
  gozDugmesi = true,
  ...rest
}: InputProps) {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);

  const [focused, setFocused] = useState(false);
  const [acik, setAcik] = useState(false);

  const sifreKutusu = Boolean(rest.secureTextEntry);
  const gozVar = sifreKutusu && gozDugmesi;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputWrapper,
          focused && styles.inputWrapperFocused,
          error && styles.inputWrapperError,
        ]}
      >
        {icon && <Ionicons name={icon} size={18} color={colors.textMuted} style={styles.icon} />}
        <TextInput
          placeholderTextColor={colors.textMuted}
          style={[styles.input, style]}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          {...rest}
          // SIRALAMA ÖNEMLİ: bu iki satır rest'ten SONRA geliyor.
          // secureTextEntry'yi göz düğmesi yönetir; otomatik düzeltme şifre ve
          // e-posta kutularında kelime düzeltip girişi bozar.
          secureTextEntry={sifreKutusu && !(gozVar && acik)}
          autoCorrect={rest.autoCorrect ?? (sifreKutusu ? false : undefined)}
          spellCheck={rest.spellCheck ?? (sifreKutusu ? false : undefined)}
        />
        {gozVar && (
          <Pressable
            onPress={() => setAcik((v) => !v)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={acik ? 'Şifreyi gizle' : 'Şifreyi göster'}
            style={styles.goz}
          >
            <Ionicons name={acik ? 'eye-off-outline' : 'eye-outline'} size={19} color={colors.textMuted} />
          </Pressable>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  inputWrapperFocused: {
    borderColor: colors.primary,
  },
  inputWrapperError: {
    borderColor: colors.danger,
  },
  icon: {
    marginRight: spacing.xs,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    paddingVertical: 13,
    fontSize: 15,
  },
  goz: {
    paddingLeft: spacing.xs,
    paddingVertical: spacing.xs,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.xxs,
  },
});
