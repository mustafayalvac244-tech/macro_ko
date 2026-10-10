import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { metniPaylas } from '@/lib/cikti';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { HukukiUyari } from '@/components/ui/HukukiUyari';
import { useAuthStore } from '@/store/authStore';
import { useClients } from '@/hooks/useClients';
import { buildContract, type ContractType, type FeeModel, type Taksit } from '@/utils/contractTemplate';
import { oranOku, tutarOku } from '@/utils/tutar';
import { useT } from '@/i18n';
import { fonts, spacing, kose } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

/**
 * Sözleşme Hazırla — avukatlık ücret / sürekli danışmanlık sözleşmesini
 * şablondan üretir (cihazda, AI'sız). Müvekkil listeden seçilince ad/adres
 * önden dolar; avukat bilgisi profilden gelir. Çıktı uygulama içinde görünür
 * ve Paylaş ile WhatsApp/e-posta/Word'e aktarılır. Hukukî kontrol uyarıları
 * (Av.K. m.163-164, 174) altında listelenir.
 */
// Kendi gruplamamız — objektif hukuk dalları, ama kendi sıralama/adlandırmamızla.
const HUKUK_ALANLARI = [
  'Aile ve Şahıs', 'İş ve Sosyal Güvenlik', 'Tazminat ve Trafik', 'Gayrimenkul ve Kira',
  'İcra ve İflas', 'Borçlar ve Sözleşmeler', 'Ticaret ve Şirketler', 'Tüketici',
  'Ceza', 'İdare ve Vergi', 'Fikri ve Sınai Haklar', 'Diğer',
];
const SIFATLAR = ['Davacı', 'Davalı', 'Alacaklı', 'Borçlu', 'Katılan/Şikayetçi', 'Sanık/Şüpheli', 'Başvurucu', 'İlgili'];

export default function ContractScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const t = useT();
  const profile = useAuthStore((s) => s.profile);
  const clients = useClients();

  const [tur, setTur] = useState<ContractType>('vekalet');
  // Avukat (profilden ön dolu)
  const [avukatAd, setAvukatAd] = useState((profile?.full_name ?? '').replace(/^av\.?\s+/i, ''));
  const [sicil, setSicil] = useState(profile?.bar_number ?? '');
  const [buro, setBuro] = useState(profile?.firm_name ?? '');
  // Müvekkil
  const [muvekkilAd, setMuvekkilAd] = useState('');
  const [muvekkilTc, setMuvekkilTc] = useState('');
  const [muvekkilAdres, setMuvekkilAdres] = useState('');
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  // İş
  const [hukukAlani, setHukukAlani] = useState('');
  const [uyusmazlik, setUyusmazlik] = useState('');
  const [mahkeme, setMahkeme] = useState('');
  const [sifat, setSifat] = useState('');
  const [imzaYeri, setImzaYeri] = useState('');
  // Ücret
  const [feeModel, setFeeModel] = useState<FeeModel>('maktu');
  const [maktuTutar, setMaktuTutar] = useState('');
  const [nispiOran, setNispiOran] = useState('');
  const [davaDegeri, setDavaDegeri] = useState('');
  const [aylik, setAylik] = useState('');
  const [kdvDahil, setKdvDahil] = useState(false);
  const [taksitli, setTaksitli] = useState(false);
  const [taksitSayisi, setTaksitSayisi] = useState('3');

  const [preview, setPreview] = useState<{ body: string; warnings: string[] } | null>(null);

  const effectiveFeeModel: FeeModel = tur === 'danismanlik' ? 'danismanlik' : feeModel;

  // Eskiden her rakam dışı karakter siliniyordu: "1.250,50" → 125050,
  // "%12,5" → 125 (oran %25 uyarısı da yanlış tetiklenirdi). Ortak ayrıştırıcı.
  const num = (s: string) => {
    const n = tutarOku(s);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  const oran = (s: string) => {
    const n = oranOku(s);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };

  /**
   * Taksit tabanı YALNIZ seçili ücret modelinden alınır (eskiden gizli kalmış
   * maktu alanı nispi modelde de taksite giriyordu). Karmada peşin maktu kısım
   * taksitlenir. Tutarlar tam TL'dir (sözleşme tutarı tam TL yazar); artan
   * son taksite eklenir, böylece "Toplam" satırı ücret maddesiyle aynı çıkar
   * (eskiden 10.000 / 3 → "Toplam: 9.999 TL").
   */
  const taksitTabani = (): number | undefined => {
    switch (effectiveFeeModel) {
      case 'danismanlik':
        return num(aylik);
      case 'nispi': {
        const d = num(davaDegeri);
        const o = oran(nispiOran);
        return d && o ? (d * o) / 100 : undefined;
      }
      default:
        return num(maktuTutar);
    }
  };

  const buildTaksitler = (): Taksit[] | undefined => {
    if (!taksitli) return undefined;
    const adet = Math.max(1, Math.min(24, Number(taksitSayisi) || 1));
    const tabani = taksitTabani();
    if (!tabani) return undefined;
    const toplam = Math.round(tabani);
    const her = Math.floor(toplam / adet);
    return Array.from({ length: adet }, (_, i) => ({
      seq: i + 1,
      amount: i === adet - 1 ? toplam - her * (adet - 1) : her,
    }));
  };

  const onGenerate = () => {
    const taksitler = buildTaksitler();
    const res = buildContract({
      tur,
      avukatAd: avukatAd.trim(),
      sicil: sicil.trim() || undefined,
      buro: buro.trim() || undefined,
      muvekkilAd: muvekkilAd.trim(),
      muvekkilTc: muvekkilTc.trim() || undefined,
      muvekkilAdres: muvekkilAdres.trim() || undefined,
      hukukAlani: hukukAlani || undefined,
      uyusmazlik: uyusmazlik.trim() || undefined,
      mahkeme: mahkeme.trim() || undefined,
      sifat: sifat || undefined,
      imzaYeri: imzaYeri.trim() || undefined,
      feeModel: effectiveFeeModel,
      maktuTutar: num(maktuTutar),
      nispiOran: oran(nispiOran),
      davaDegeri: num(davaDegeri),
      aylikDanismanlik: num(aylik),
      kdvDahil,
      taksitler,
    });
    // Taksit açık ama tutar hesaplanamadıysa metin sessizce "peşin ödenir" diyordu.
    const uyarilar = taksitli && !taksitler ? [...res.warnings, t('contract.taksitHesaplanamadi')] : res.warnings;
    setPreview({ body: res.body, warnings: uyarilar });
  };

  const onShare = () => {
    if (preview) metniPaylas(preview.body, t('contract.title'));
  };

  const clientList = clients.data ?? [];

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('contract.title')} showBack />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>{t('contract.intro')}</Text>

        {/* Tür */}
        <SegLabel colors={colors}>{t('contract.type')}</SegLabel>
        <View style={styles.segRow}>
          <Seg colors={colors} active={tur === 'vekalet'} onPress={() => setTur('vekalet')} label={t('contract.typeVekalet')} />
          <Seg colors={colors} active={tur === 'danismanlik'} onPress={() => setTur('danismanlik')} label={t('contract.typeDanisma')} />
        </View>

        {/* Avukat */}
        <SectionTitle colors={colors} icon="person-circle-outline">{t('contract.lawyer')}</SectionTitle>
        <Field colors={colors} label={t('contract.name')} value={avukatAd} onChangeText={setAvukatAd} placeholder={t('contract.namePh')} />
        <Field colors={colors} label={t('contract.sicil')} value={sicil} onChangeText={setSicil} placeholder={t('contract.sicilPh')} />
        <Field colors={colors} label={t('contract.firm')} value={buro} onChangeText={setBuro} placeholder={t('contract.firmPh')} />

        {/* Müvekkil */}
        <SectionTitle colors={colors} icon="people-outline">{t('contract.client')}</SectionTitle>
        <Pressable style={styles.pickerBtn} onPress={() => setClientPickerOpen(true)}>
          <Ionicons name="list-outline" size={16} color={colors.gold} />
          <Text style={styles.pickerBtnText}>{t('contract.pickClient')}</Text>
        </Pressable>
        <Field colors={colors} label={t('contract.name')} value={muvekkilAd} onChangeText={setMuvekkilAd} placeholder={t('contract.clientNamePh')} />
        <Field colors={colors} label={t('clientForm.tcNo')} value={muvekkilTc} onChangeText={setMuvekkilTc} placeholder={t('contract.optionalPh')} keyboardType="number-pad" />
        <Field colors={colors} label={t('contract.address')} value={muvekkilAdres} onChangeText={setMuvekkilAdres} placeholder={t('contract.optionalPh')} multiline />

        {/* İş */}
        {tur === 'vekalet' && (
          <>
            <SectionTitle colors={colors} icon="briefcase-outline">{t('contract.matter')}</SectionTitle>
            <ChipPicker colors={colors} label={t('contract.lawArea')} options={HUKUK_ALANLARI} value={hukukAlani} onChange={setHukukAlani} />
            <Field colors={colors} label={t('contract.subject')} value={uyusmazlik} onChangeText={setUyusmazlik} placeholder={t('contract.subjectPh')} />
            <Field colors={colors} label={t('contract.court')} value={mahkeme} onChangeText={setMahkeme} placeholder={t('contract.courtPh')} />
            <ChipPicker colors={colors} label={t('contract.role')} options={SIFATLAR} value={sifat} onChange={setSifat} />
          </>
        )}
        {tur === 'danismanlik' && (
          <>
            <SectionTitle colors={colors} icon="briefcase-outline">{t('contract.matter')}</SectionTitle>
            <ChipPicker colors={colors} label={t('contract.lawArea')} options={HUKUK_ALANLARI} value={hukukAlani} onChange={setHukukAlani} />
          </>
        )}
        <Field colors={colors} label={t('contract.signPlace')} value={imzaYeri} onChangeText={setImzaYeri} placeholder={t('contract.signPlacePh')} />

        {/* Ücret */}
        <SectionTitle colors={colors} icon="cash-outline">{t('contract.fee')}</SectionTitle>
        {tur === 'vekalet' ? (
          <>
            <View style={styles.segRow}>
              <Seg colors={colors} active={feeModel === 'maktu'} onPress={() => setFeeModel('maktu')} label={t('contract.maktu')} />
              <Seg colors={colors} active={feeModel === 'nispi'} onPress={() => setFeeModel('nispi')} label={t('contract.nispi')} />
              <Seg colors={colors} active={feeModel === 'karma'} onPress={() => setFeeModel('karma')} label={t('contract.karma')} />
            </View>
            {(feeModel === 'maktu' || feeModel === 'karma') && (
              <Field colors={colors} label={t('contract.amount')} value={maktuTutar} onChangeText={setMaktuTutar} placeholder="0" keyboardType="number-pad" />
            )}
            {(feeModel === 'nispi' || feeModel === 'karma') && (
              <>
                <Field colors={colors} label={t('contract.rate')} value={nispiOran} onChangeText={setNispiOran} placeholder={t('contract.ratePh')} keyboardType="number-pad" />
                <Field colors={colors} label={t('contract.caseValue')} value={davaDegeri} onChangeText={setDavaDegeri} placeholder={t('contract.caseValuePh')} keyboardType="number-pad" />
              </>
            )}
          </>
        ) : (
          <Field colors={colors} label={t('contract.monthly')} value={aylik} onChangeText={setAylik} placeholder={t('contract.monthlyPh')} keyboardType="number-pad" />
        )}

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t('contract.kdv')}</Text>
          <Switch value={kdvDahil} onValueChange={setKdvDahil} trackColor={{ true: colors.gold }} />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t('contract.installment')}</Text>
          <Switch value={taksitli} onValueChange={setTaksitli} trackColor={{ true: colors.gold }} />
        </View>
        {taksitli && (
          <Field colors={colors} label={t('contract.installmentCount')} value={taksitSayisi} onChangeText={setTaksitSayisi} placeholder="3" keyboardType="number-pad" />
        )}

        <Pressable style={({ pressed }) => [styles.generateBtn, pressed && { opacity: 0.85 }]} onPress={onGenerate}>
          <Ionicons name="document-text" size={18} color={colors.textInverse} />
          <Text style={styles.generateBtnText}>{t('contract.generate')}</Text>
        </Pressable>
      </ScrollView>

      {/* Müvekkil seçici */}
      <Modal visible={clientPickerOpen} transparent animationType="slide" onRequestClose={() => setClientPickerOpen(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>{t('contract.pickClient')}</Text>
              <Pressable onPress={() => setClientPickerOpen(false)} hitSlop={8}><Ionicons name="close" size={20} color={colors.textSecondary} /></Pressable>
            </View>
            <ScrollView style={{ maxHeight: 380 }}>
              {clientList.length === 0 ? (
                <Text style={styles.emptyText}>{t('contract.noClients')}</Text>
              ) : (
                clientList.map((c) => (
                  <Pressable
                    key={c.id}
                    style={styles.clientItem}
                    onPress={() => {
                      setMuvekkilAd(c.full_name ?? '');
                      setMuvekkilAdres(c.address ?? '');
                      setClientPickerOpen(false);
                    }}
                  >
                    <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
                    <Text style={styles.clientItemText} numberOfLines={1}>{c.full_name}</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Önizleme */}
      <Modal visible={!!preview} transparent animationType="slide" onRequestClose={() => setPreview(null)}>
        <View style={styles.modalWrap}>
          <View style={[styles.modalCard, { maxHeight: '90%' }]}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>{t('contract.preview')}</Text>
              <Pressable onPress={() => setPreview(null)} hitSlop={8}><Ionicons name="close" size={20} color={colors.textSecondary} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: spacing.md }} showsVerticalScrollIndicator={false}>
              {preview?.warnings.map((w, i) => (
                <View key={i} style={styles.warnRow}>
                  <Ionicons name="alert-circle-outline" size={15} color={colors.warning} />
                  <Text style={styles.warnText}>{w}</Text>
                </View>
              ))}
              <Text selectable style={styles.docText}>{preview?.body}</Text>
              <HukukiUyari tur="sablon" kucuk />
            </ScrollView>
            <Pressable style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.85 }]} onPress={onShare}>
              <Ionicons name="share-social" size={17} color={colors.textInverse} />
              <Text style={styles.shareBtnText}>{t('contract.share')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function SegLabel({ children, colors }: { children: React.ReactNode; colors: ThemeColors }) {
  const styles = makeStyles(colors);
  return <Text style={styles.segLabel}>{children}</Text>;
}
function Seg({ active, onPress, label, colors }: { active: boolean; onPress: () => void; label: string; colors: ThemeColors }) {
  const styles = makeStyles(colors);
  return (
    <Pressable onPress={onPress} style={[styles.seg, active && styles.segActive]}>
      <Text style={[styles.segText, active && styles.segTextActive]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}
function SectionTitle({ children, icon, colors }: { children: React.ReactNode; icon: keyof typeof Ionicons.glyphMap; colors: ThemeColors }) {
  const styles = makeStyles(colors);
  return (
    <View style={styles.sectionTitleRow}>
      <Ionicons name={icon} size={16} color={colors.gold} />
      <Text style={styles.sectionTitle}>{children}</Text>
    </View>
  );
}
function Field({
  label, value, onChangeText, placeholder, keyboardType, multiline, colors,
}: {
  label: string; value: string; onChangeText: (s: string) => void; placeholder?: string;
  keyboardType?: 'default' | 'number-pad'; multiline?: boolean; colors: ThemeColors;
}) {
  const styles = makeStyles(colors);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType ?? 'default'}
        multiline={multiline}
        style={[styles.input, multiline && { height: 64, textAlignVertical: 'top' }]}
      />
    </View>
  );
}
function ChipPicker({ label, options, value, onChange, colors }: { label: string; options: string[]; value: string; onChange: (s: string) => void; colors: ThemeColors }) {
  const styles = makeStyles(colors);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
        {options.map((o) => {
          const active = value === o;
          return (
            <Pressable key={o} onPress={() => onChange(active ? '' : o)} style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{o}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl * 2 },
  intro: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.textSecondary, marginBottom: spacing.md },
  segLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textMuted, marginBottom: 6 },
  segRow: { flexDirection: 'row', gap: 6, marginBottom: spacing.sm },
  seg: { flex: 1, paddingVertical: 10, borderRadius: kose(11), borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center' },
  segActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  segText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.textSecondary },
  segTextActive: { color: colors.textInverse },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md, marginBottom: spacing.sm },
  sectionTitle: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 15.5, color: colors.textPrimary },
  field: { marginBottom: spacing.sm },
  fieldLabel: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary, marginBottom: 4 },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: kose(11), paddingHorizontal: 12, paddingVertical: 10, fontFamily: fonts.regular, fontSize: 14, color: colors.textPrimary },
  pickerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: colors.gold, borderRadius: kose(11), paddingVertical: 10, marginBottom: spacing.sm },
  pickerBtnText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.gold },
  chip: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
  chipTextActive: { color: colors.textInverse },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  switchLabel: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textPrimary },
  generateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: kose(14), paddingVertical: 14, marginTop: spacing.md },
  generateBtnText: { fontFamily: fonts.extrabold, fontWeight: '800', fontSize: 15, color: colors.textInverse },
  modalWrap: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.bgElevated, borderTopLeftRadius: kose(22), borderTopRightRadius: kose(22), padding: spacing.lg },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  modalTitle: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 18, color: colors.textPrimary },
  emptyText: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.lg },
  clientItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  clientItemText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary, flex: 1 },
  warnRow: { flexDirection: 'row', gap: 6, backgroundColor: colors.warningSoft, borderRadius: kose(9), padding: 8, marginBottom: 6 },
  warnText: { flex: 1, fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 16, color: colors.textPrimary },
  docText: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 19, color: colors.textPrimary, marginTop: spacing.sm },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: kose(13), paddingVertical: 13, marginTop: spacing.sm },
  shareBtnText: { fontFamily: fonts.extrabold, fontWeight: '800', fontSize: 14.5, color: colors.textInverse },
});
