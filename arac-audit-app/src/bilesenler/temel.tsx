// TEMEL ARAYÜZ BİLEŞENLERİ.
//
// Yeni bir ekran yazmadan önce buraya bak; burada olanı yeniden yazma.
// Hepsi temadan renk alır, hiçbiri çıplak hex kullanmaz.

import * as Haptics from 'expo-haptics';
import React, { useMemo } from 'react';
import {
  ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet,
  Text, TextInput, TextInputProps, View, ViewStyle,
} from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';

import { bosluk, DOKUNMA, HITSLOP, kose, Renkler, dereceRenkleri, tipografi, useTema } from '@/tema';

// --- ALT SAYFA ------------------------------------------------------------

/**
 * Alttan açılan tek sayfa kabuğu.
 *
 * UYGULAMADA AYNI ANDA YALNIZ BİR TANE OLMALI. İki Modal üst üste açıldığında
 * react-native-web kapanan modalı CSS animasyon bitiş olayına kadar DOM'da
 * tutuyor; olay gelmezse üstte asılı kalıyor ve alttaki sayfaya hiç
 * dokunulamıyor (15.09.2026 tarayıcı sınavında ölçüldü). Bu yüzden içerik
 * değişir, kabuk değişmez.
 */
export function AltSayfa({
  gorunur, onKapat, children, tamYukseklik = false,
}: {
  gorunur: boolean;
  onKapat: () => void;
  children: React.ReactNode;
  tamYukseklik?: boolean;
}) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  return (
    <Modal visible={gorunur} animationType="slide" transparent onRequestClose={onKapat}>
      <View style={s.perde}>
        <View style={[s.altSayfa, tamYukseklik && { height: '88%' }]}>
          <View style={s.tutamak} />
          {children}
        </View>
      </View>
    </Modal>
  );
}

// --- EKRAN ----------------------------------------------------------------

export function Ekran({
  children, kenarlar = ['top', 'bottom'], kaydir = false, style,
}: {
  children: React.ReactNode;
  kenarlar?: Edge[];
  kaydir?: boolean;
  style?: ViewStyle;
}) {
  const { renkler } = useTema();
  const ic = kaydir ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[{ padding: bosluk.md, gap: bosluk.md, paddingBottom: bosluk.xxxl }, style]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, style]}>{children}</View>
  );

  return (
    <SafeAreaView edges={kenarlar} style={{ flex: 1, backgroundColor: renkler.bg }}>
      {ic}
    </SafeAreaView>
  );
}

// --- BAŞLIK ---------------------------------------------------------------

export function Baslik({
  baslik, altBaslik, sol, sag,
}: {
  baslik: string;
  altBaslik?: string;
  sol?: React.ReactNode;
  sag?: React.ReactNode;
}) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  return (
    <View style={s.baslikSatiri}>
      {sol}
      <View style={s.baslikOrta}>
        <Text style={s.baslikMetin} numberOfLines={1}>{baslik}</Text>
        {altBaslik ? <Text style={s.altBaslikMetin} numberOfLines={1}>{altBaslik}</Text> : null}
      </View>
      {sag}
    </View>
  );
}

// --- KART -----------------------------------------------------------------

export function Kart({
  children, style, vurgulu = false,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  vurgulu?: boolean;
}) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  return <View style={[s.kart, vurgulu && s.kartVurgulu, style]}>{children}</View>;
}

export function BolumBasligi({ metin, sag }: { metin: string; sag?: React.ReactNode }) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  return (
    <View style={s.bolumSatiri}>
      <Text style={s.bolumMetin}>{metin}</Text>
      {sag}
    </View>
  );
}

// --- DÜĞME ----------------------------------------------------------------

type DugmeTuru = 'birincil' | 'ikincil' | 'sessiz' | 'tehlike';

export function Dugme({
  metin, onPress, tur = 'ikincil', kucuk = false, pasif = false, yukleniyor = false, style, erisimEtiketi,
}: {
  metin: string;
  onPress: () => void;
  tur?: DugmeTuru;
  kucuk?: boolean;
  pasif?: boolean;
  yukleniyor?: boolean;
  style?: ViewStyle;
  erisimEtiketi?: string;
}) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const kapali = pasif || yukleniyor;

  const zemin = {
    birincil: renkler.birincil,
    tehlike: renkler.tehlike,
    ikincil: renkler.yuzey,
    sessiz: renkler.seffaf,
  }[tur];
  const yaziRengi = tur === 'birincil' || tur === 'tehlike' ? renkler.metinTers : renkler.metin;
  const cizgiRengi = tur === 'birincil' ? renkler.birincil
    : tur === 'tehlike' ? renkler.tehlike
    : tur === 'sessiz' ? renkler.seffaf
    : renkler.cizgi;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={erisimEtiketi ?? metin}
      accessibilityState={{ disabled: kapali }}
      disabled={kapali}
      onPress={() => {
        if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        s.dugme,
        kucuk && s.dugmeKucuk,
        { backgroundColor: zemin, borderColor: cizgiRengi },
        pressed && !kapali && s.dugmeBasili,
        kapali && s.dugmePasif,
        style,
      ]}
    >
      {yukleniyor
        ? <ActivityIndicator color={yaziRengi} />
        : <Text style={[kucuk ? s.dugmeMetinKucuk : s.dugmeMetin, { color: yaziRengi }]} numberOfLines={1}>{metin}</Text>}
    </Pressable>
  );
}

// --- GİRDİ ----------------------------------------------------------------

export function Girdi({
  etiket, ipucu, hata, mono = false, style, ...rest
}: TextInputProps & { etiket?: string; ipucu?: string; hata?: string; mono?: boolean }) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  return (
    <View style={{ gap: bosluk.xxs }}>
      {etiket ? <Text style={s.alanEtiketi}>{etiket}</Text> : null}
      <TextInput
        placeholderTextColor={renkler.metinSolgun}
        // Etiket ayrı bir Text olduğu için ekran okuyucu alanı adsız okur.
        // Çağıran kendi etiketini verdiyse ona dokunma.
        accessibilityLabel={rest.accessibilityLabel ?? etiket}
        style={[s.girdi, mono && s.girdiMono, !!hata && s.girdiHatali, style]}
        {...rest}
      />
      {hata ? <Text style={s.hataMetni}>{hata}</Text> : ipucu ? <Text style={s.ipucuMetni}>{ipucu}</Text> : null}
    </View>
  );
}

// --- ROZET ----------------------------------------------------------------

export function Rozet({
  metin, renk, zemin,
}: { metin: string; renk?: string; zemin?: string }) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  return (
    <View style={[s.rozet, { backgroundColor: zemin ?? renkler.yuzeyAlt }]}>
      <Text style={[s.rozetMetin, { color: renk ?? renkler.metinIkincil }]}>{metin}</Text>
    </View>
  );
}

/**
 * Şiddet rozeti. Bilgiyi YALNIZ renkle aktarmaz — harf de taşır, böylece
 * renk körlüğünde ve siyah-beyaz çıktıda da okunur.
 */
/**
 * Derece rozeti: `3` ya da `(3)`.
 *
 * Kabul edilebilir bulgu PARANTEZLE yazılır ve dolgusuz çizilir. Asıl ayrım
 * parantezdedir, renk yardımcıdır — renk körlüğünde ve siyah-beyaz çıktıda da
 * "düzeltilecek" ile "kabul edildi" karışmasın.
 */
export function DereceRozeti({
  derece, kabul = false, buyuk = false,
}: { derece: string; kabul?: boolean; buyuk?: boolean }) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const { on, arka } = dereceRenkleri(renkler, derece);
  return (
    <View
      accessibilityLabel={kabul ? `Derece ${derece}, kabul edilebilir` : `Derece ${derece}`}
      style={[
        s.siddetPul, buyuk && s.siddetPulBuyuk,
        kabul
          ? { backgroundColor: 'transparent', borderColor: renkler.cizgiGuclu, borderStyle: 'dashed' }
          : { backgroundColor: arka, borderColor: on },
        kabul && { minWidth: buyuk ? 56 : 40 },
      ]}
    >
      <Text style={[s.siddetHarf, buyuk && s.siddetHarfBuyuk, { color: kabul ? renkler.metinIkincil : on }]}>
        {kabul ? `(${derece})` : derece}
      </Text>
    </View>
  );
}

// --- ÖLÇÜ KUTUSU ----------------------------------------------------------

export function Olcu({
  deger, etiket, renk, genis = false,
}: { deger: string | number; etiket: string; renk?: string; genis?: boolean }) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  return (
    <View style={[s.olcu, genis && { flex: 1 }]}>
      <Text style={[s.olcuDeger, renk ? { color: renk } : null]}>{deger}</Text>
      <Text style={s.olcuEtiket}>{etiket}</Text>
    </View>
  );
}

// --- DURUMLAR -------------------------------------------------------------

export function Yukleniyor({ metin }: { metin?: string }) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  return (
    <View style={s.ortala}>
      <ActivityIndicator color={renkler.birincil} size="large" />
      {metin ? <Text style={s.durumMetni}>{metin}</Text> : null}
    </View>
  );
}

export function BosDurum({
  baslik, aciklama, eylem,
}: { baslik: string; aciklama?: string; eylem?: React.ReactNode }) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  return (
    <View style={s.ortala}>
      <Text style={s.bosBaslik}>{baslik}</Text>
      {aciklama ? <Text style={s.durumMetni}>{aciklama}</Text> : null}
      {eylem}
    </View>
  );
}

export function HataKutusu({ metin }: { metin: string }) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  return (
    <View style={s.hataKutusu}>
      <Text style={s.hataKutusuMetni}>{metin}</Text>
    </View>
  );
}

export function BilgiKutusu({ metin, tur = 'bilgi' }: { metin: string; tur?: 'bilgi' | 'uyari' }) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const arka = tur === 'uyari' ? renkler.uyariYumusak : renkler.bilgiYumusak;
  const cizgi = tur === 'uyari' ? renkler.uyari : renkler.bilgi;
  return (
    <View style={[s.bilgiKutusu, { backgroundColor: arka, borderLeftColor: cizgi }]}>
      <Text style={[s.bilgiKutusuMetni, { color: cizgi }]}>{metin}</Text>
    </View>
  );
}

/** Küçük ikon/metin düğmesi — başlık çubuğu için. */
export function BaslikDugmesi({
  metin, onPress, erisimEtiketi,
}: { metin: string; onPress: () => void; erisimEtiketi: string }) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={erisimEtiketi}
      hitSlop={HITSLOP}
      onPress={onPress}
      style={({ pressed }) => [s.baslikDugmesi, pressed && s.dugmeBasili]}
    >
      <Text style={s.baslikDugmesiMetni}>{metin}</Text>
    </Pressable>
  );
}

// --- STİLLER --------------------------------------------------------------

const stiller = (r: Renkler) => StyleSheet.create({
  baslikSatiri: {
    flexDirection: 'row', alignItems: 'center', gap: bosluk.sm,
    paddingHorizontal: bosluk.md, paddingVertical: bosluk.sm,
    backgroundColor: r.bgYukseltilmis, borderBottomWidth: 1, borderBottomColor: r.cizgiSolgun,
  },
  baslikOrta: { flex: 1, minWidth: 0 },
  baslikMetin: { ...tipografi.h2, color: r.metin },
  altBaslikMetin: { ...tipografi.caption, color: r.metinSolgun, marginTop: 1 },

  baslikDugmesi: {
    minHeight: DOKUNMA, minWidth: DOKUNMA, alignItems: 'center', justifyContent: 'center',
    borderRadius: kose.md, borderWidth: 1, borderColor: r.cizgi, backgroundColor: r.yuzey,
    paddingHorizontal: bosluk.sm,
  },
  baslikDugmesiMetni: { ...tipografi.bodyOrta, color: r.metin },

  kart: {
    backgroundColor: r.yuzey, borderRadius: kose.lg, borderWidth: 1,
    borderColor: r.cizgiSolgun, padding: bosluk.md, gap: bosluk.sm,
  },
  kartVurgulu: { borderColor: r.birincil, backgroundColor: r.birincilYumusak },

  bolumSatiri: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: bosluk.sm },
  bolumMetin: { ...tipografi.etiket, color: r.metinSolgun },

  dugme: {
    minHeight: DOKUNMA, borderRadius: kose.md, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: bosluk.md, paddingVertical: bosluk.sm,
  },
  dugmeKucuk: { minHeight: 38, paddingHorizontal: bosluk.sm, paddingVertical: bosluk.xs },
  dugmeBasili: { opacity: 0.7 },
  dugmePasif: { opacity: 0.4 },
  dugmeMetin: { ...tipografi.bodyOrta },
  dugmeMetinKucuk: { ...tipografi.captionOrta },

  alanEtiketi: { ...tipografi.etiket, color: r.metinSolgun },
  girdi: {
    ...tipografi.body, color: r.metin, backgroundColor: r.yuzey,
    borderWidth: 1, borderColor: r.cizgi, borderRadius: kose.md,
    paddingHorizontal: bosluk.sm, minHeight: DOKUNMA,
  },
  girdiMono: { ...tipografi.monoBuyuk, color: r.metin, textAlign: 'center' },
  girdiHatali: { borderColor: r.tehlike },
  hataMetni: { ...tipografi.caption, color: r.tehlike },
  ipucuMetni: { ...tipografi.caption, color: r.metinSolgun },

  rozet: { paddingHorizontal: bosluk.xs, paddingVertical: 3, borderRadius: kose.pill, alignSelf: 'flex-start' },
  rozetMetin: { ...tipografi.etiket },

  siddetPul: {
    width: 32, height: 32, borderRadius: kose.sm, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  siddetPulBuyuk: { width: 44, height: 44, borderRadius: kose.md },
  siddetHarf: { ...tipografi.h3 },
  siddetHarfBuyuk: { ...tipografi.h2 },

  olcu: {
    backgroundColor: r.yuzey, borderRadius: kose.md, borderWidth: 1, borderColor: r.cizgiSolgun,
    paddingHorizontal: bosluk.sm, paddingVertical: bosluk.xs, minWidth: 92,
  },
  olcuDeger: { ...tipografi.sayiBuyuk, color: r.metin },
  olcuEtiket: { ...tipografi.caption, color: r.metinSolgun, marginTop: -2 },

  ortala: { alignItems: 'center', justifyContent: 'center', padding: bosluk.xl, gap: bosluk.sm },
  bosBaslik: { ...tipografi.h3, color: r.metin, textAlign: 'center' },
  durumMetni: { ...tipografi.body, color: r.metinSolgun, textAlign: 'center' },

  hataKutusu: {
    backgroundColor: r.tehlikeYumusak, borderLeftWidth: 3, borderLeftColor: r.tehlike,
    borderRadius: kose.sm, padding: bosluk.sm,
  },
  hataKutusuMetni: { ...tipografi.caption, color: r.tehlike },

  bilgiKutusu: { borderLeftWidth: 3, borderRadius: kose.sm, padding: bosluk.sm },
  bilgiKutusuMetni: { ...tipografi.caption },

  perde: { flex: 1, backgroundColor: r.perde, justifyContent: 'flex-end' },
  altSayfa: {
    backgroundColor: r.bgYukseltilmis,
    borderTopLeftRadius: kose.xl, borderTopRightRadius: kose.xl,
    maxHeight: '92%', paddingTop: bosluk.xs, gap: bosluk.xs,
  },
  tutamak: { width: 42, height: 4, borderRadius: kose.pill, backgroundColor: r.cizgi, alignSelf: 'center' },
});
