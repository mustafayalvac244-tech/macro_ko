import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useAdminBildirimGonder, useAdminBildirimOzet } from '@/hooks/useAdmin';
import { useT } from '@/i18n';
import { uyar } from '@/lib/uyari';
import { spacing, typography, kose } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

type Hedef = 'son' | 'herkes';

/**
 * YÖNETİCİ → KULLANICI BİLDİRİMİ (30.09.2026, bkz. 0161_push_bildirim).
 *
 * Yalnız bildirim adresi kayıtlı cihazlara gider: uygulamanın bu sürümünü
 * açıp bildirime izin vermiş kullanıcılar. "Kaç kişiye ulaşılabilir" sayısı
 * bu yüzden gönderimden önce gösteriliyor — boşa gönderim sanılmasın.
 */
export function BildirimGonder() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const t = useT();
  const ozet = useAdminBildirimOzet();
  const gonder = useAdminBildirimGonder();

  const [hedef, setHedef] = useState<Hedef>('son');
  const [kacKisi, setKacKisi] = useState('3');
  const [baslik, setBaslik] = useState('');
  const [metin, setMetin] = useState('');

  const sayi = Number.parseInt(kacKisi, 10);
  const sayiGecerli = Number.isInteger(sayi) && sayi >= 1 && sayi <= 1000;
  const hazir = baslik.trim().length > 0 && metin.trim().length > 0 && (hedef === 'herkes' || sayiGecerli);

  const gonderOnayli = () => {
    gonder.mutate(
      { baslik: baslik.trim(), metin: metin.trim(), sonKayit: hedef === 'herkes' ? null : sayi },
      {
        onSuccess: (sonuc) => {
          if (sonuc.hedef_cihaz === 0) {
            uyar(t('admin.pushTitle'), t('admin.pushNone'));
            return;
          }
          uyar(t('admin.pushTitle'), t('admin.pushSent', { kisi: String(sonuc.hedef_kisi), cihaz: String(sonuc.hedef_cihaz) }));
          setBaslik('');
          setMetin('');
        },
        onError: (e) => uyar(t('admin.pushTitle'), t('admin.pushError', { hata: (e as Error).message })),
      }
    );
  };

  const onGonder = () => {
    const kime = hedef === 'herkes' ? t('admin.pushTargetAll') : t('admin.pushTargetRecentN', { n: String(sayi) });
    uyar(t('admin.pushConfirmTitle'), `${kime}\n\n${baslik.trim()}\n${metin.trim()}`, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('admin.pushSend'), onPress: gonderOnayli },
    ]);
  };

  return (
    <View style={styles.kutu}>
      <View style={styles.baslikSatiri}>
        <Ionicons name="notifications" size={15} color={colors.primary} />
        <Text style={styles.kutuBaslik}>{t('admin.pushTitle')}</Text>
      </View>
      {ozet.data && (
        <Text style={styles.not}>
          {t('admin.pushReach', { cihaz: String(ozet.data.cihaz), kisi: String(ozet.data.kisi) })}
        </Text>
      )}

      <SegmentedControl<Hedef>
        options={[
          { label: t('admin.pushTargetRecent'), value: 'son' },
          { label: t('admin.pushTargetAll'), value: 'herkes' },
        ]}
        value={hedef}
        onChange={setHedef}
      />
      {hedef === 'son' && (
        <Input
          label={t('admin.pushCount')}
          value={kacKisi}
          onChangeText={setKacKisi}
          keyboardType="number-pad"
          maxLength={4}
          error={kacKisi.length > 0 && !sayiGecerli ? t('admin.pushCountInvalid') : null}
        />
      )}
      <Input label={t('admin.pushHeading')} value={baslik} onChangeText={setBaslik} maxLength={100} />
      <Input label={t('admin.pushBody')} value={metin} onChangeText={setMetin} maxLength={500} multiline />
      <Text style={styles.not}>{t('admin.pushWarn')}</Text>
      <Button
        label={t('admin.pushSend')}
        icon="send"
        onPress={onGonder}
        loading={gonder.isPending}
        disabled={!hazir || gonder.isPending}
      />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    kutu: {
      marginTop: spacing.sm,
      padding: spacing.md,
      borderRadius: kose(12),
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      gap: spacing.sm,
    },
    baslikSatiri: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    kutuBaslik: { ...typography.caption, color: colors.textPrimary },
    not: { ...typography.caption, color: colors.textSecondary },
  });
