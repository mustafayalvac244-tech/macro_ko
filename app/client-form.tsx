import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useClient, useClients, useCreateClient, useUpdateClient } from '@/hooks/useClients';
import { useCases } from '@/hooks/useCases';
import { useT } from '@/i18n';
import { spacing, typography, kose } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ClientType } from '@/types/database';
import {
  BOS_MUVEKKIL_FORMU,
  formuDoldur,
  kaydetmeEngeli,
  kayitYuku,
  tcSorunu,
  type MuvekkilFormu,
} from '@/utils/muvekkilFormu';
import { menfaatTara } from '@/utils/menfaatCatismasi';
import { MenfaatUyarisi } from '@/components/MenfaatUyarisi';
import { geriDon } from '@/lib/geriDon';

export default function ClientFormScreen() {
  const { colors } = useTheme();
  const styles = makeStyles();
  const t = useT();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;
  const { data: existingClient } = useClient(id);
  const { data: cases } = useCases();
  // Mükerrer T.C. ve aynı adlı müvekkil taraması için tüm müvekkiller.
  const { data: tumMuvekkiller } = useClients();
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();

  // Tek nesne: kayıttan doldurma ve kaydetme src/utils/muvekkilFormu.ts'te,
  // testli. T.C. no dava dilekçesinin zorunlu unsuru; kayıtta olmadığı için
  // her dilekçede "[Davacı TCKN]" boşluğu kalıyor ve avukat elle dolduruyordu.
  // Şirket alanının kutusu yok ama kayıttan yüklenip olduğu gibi geri yazılır.
  const [form, setForm] = useState<MuvekkilFormu>(BOS_MUVEKKIL_FORMU);
  const alan =
    <K extends keyof MuvekkilFormu>(k: K) =>
    (v: MuvekkilFormu[K]) =>
      setForm((f) => ({ ...f, [k]: v }));
  const { fullName, company, title, clientType, email, phone, address, tcNo, notes } = form;
  // Kısa T.C. no yazarken değil, kaydet denendikten sonra hata sayılır.
  const [kaydetDenendi, setKaydetDenendi] = useState(false);

  useEffect(() => {
    if (existingClient) setForm(formuDoldur(existingClient));
  }, [existingClient]);

  const tcDurumu = tcSorunu(form);
  const tcHataMetni =
    tcDurumu === 'tcGecersiz'
      ? t('clientForm.tcNoInvalid')
      : tcDurumu === 'tcEksik' && kaydetDenendi
        ? t('clientForm.tcNoShort')
        : undefined;

  const isSubmitting = createClient.isPending || updateClient.isPending;

  /**
   * ÇIKAR ÇATIŞMASI TARAMASI — kapsamlı.
   *
   * Eskiden yalnız ilk eşleşen dosya bulunuyor, şirket adı ve T.C. numarası
   * hiç taranmıyordu. Artık ad + şirket + T.C. birlikte taranıyor ve bütün
   * bulgular gösteriliyor (bkz. utils/menfaatCatismasi.ts).
   */
  const bulgular = useMemo(
    () =>
      menfaatTara(
        { ad: fullName, sirket: company, tcNo, hariçTutulanId: id ?? null },
        { muvekkiller: tumMuvekkiller ?? [], davalar: cases ?? [] }
      ),
    [cases, tumMuvekkiller, fullName, company, tcNo, id]
  );

  const handleSubmit = async () => {
    // Geçersiz/eksik T.C. no kaydedilmez; sebep kutunun altında yazar.
    if (kaydetmeEngeli(form)) {
      setKaydetDenendi(true);
      return;
    }
    const payload = kayitYuku(form);

    // Hata durumunda kanca zaten uyarı gösteriyor; burada sadece formda kalıp
    // girilen bilgileri koruyoruz (kapatma/yönlendirme yapmıyoruz).
    try {
      if (isEdit && id) {
        await updateClient.mutateAsync({ id, ...payload });
      } else {
        await createClient.mutateAsync(payload);
      }
      geriDon();
    } catch {
      // uyarı notifySaveError ile gösterildi
    }
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} genislik="form">
      <ScreenHeader title={isEdit ? t('clientForm.editTitle') : t('clientForm.newTitle')} showBack />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.typeLabel, { color: colors.textSecondary }]}>{t('clientForm.type')}</Text>
          <SegmentedControl
            scrollable={false}
            options={[
              { value: 'gercek', label: t('clientForm.person') },
              { value: 'tuzel', label: t('clientForm.entity') },
            ]}
            value={clientType}
            onChange={(v) => alan('clientType')(v as ClientType)}
          />
          <View style={{ height: spacing.md }} />
          <Input
            label={clientType === 'tuzel' ? t('clientForm.entityName') : t('clientForm.fullName')}
            placeholder={clientType === 'tuzel' ? t('clientForm.entityNamePh') : t('clientForm.fullNamePlaceholder')}
            value={fullName}
            onChangeText={alan('fullName')}
          />
          <MenfaatUyarisi bulgular={bulgular} />
          {clientType === 'gercek' && (
            <Input label={t('clientForm.title')} placeholder={t('clientForm.titlePlaceholder')} value={title} onChangeText={alan('title')} />
          )}
          <Input
            label={t('clientForm.email')}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder={t('clientForm.emailPlaceholder')}
            value={email}
            onChangeText={alan('email')}
          />
          <Input label={t('clientForm.phone')} keyboardType="phone-pad" placeholder={t('clientForm.phonePlaceholder')} value={phone} onChangeText={alan('phone')} />
          <Input label={t('clientForm.address')} placeholder={t('clientForm.addressPlaceholder')} value={address} onChangeText={alan('address')} />
          {clientType === 'gercek' && (
            <Input
              label={t('clientForm.tcNo')}
              placeholder={t('clientForm.tcNoPlaceholder')}
              keyboardType="number-pad"
              maxLength={11}
              value={tcNo}
              onChangeText={(v) => alan('tcNo')(v.replace(/[^0-9]/g, ''))}
              error={tcHataMetni}
            />
          )}
          <Input
            label={t('clientForm.notes')}
            placeholder={t('clientForm.notesPlaceholder')}
            value={notes}
            onChangeText={alan('notes')}
            multiline
            numberOfLines={3}
            style={styles.textArea}
          />

          <Button
            label={isEdit ? t('common.save') : t('clientForm.add')}
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={!fullName.trim()}
            fullWidth
            size="lg"
            style={styles.submit}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

// STİLLER RENDER ANINDA ÜRETİLİYOR — modül düzeyinde DEĞİL.
// Sebep (15.09.2026): yazı tipi/boyut/köşe artık temaya bağlı
// (bkz. src/theme/tokens.ts). Modül düzeyinde `StyleSheet.create` bir kez
// çalışıp DONAR: uygulama Klasik temayla açılıp Terminal'e geçilince bu dosya
// eski Manrope boyutlarında kalır ve ekranın geri kalanıyla uyumsuz görünür.
// Ölçüldü: 94 dosya zaten fabrika kullanıyordu, donuk kalan 3 dosyadan biri
// burasıydı.
const makeStyles = () => StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  typeLabel: {
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 13,
  },
  submit: {
    marginTop: spacing.lg,
  },
  warnBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: kose(12),
    padding: spacing.sm,
    marginBottom: spacing.md,
    marginTop: -4,
  },
  warnText: {
    ...typography.caption,
    flex: 1,
    lineHeight: 18,
  },
});
