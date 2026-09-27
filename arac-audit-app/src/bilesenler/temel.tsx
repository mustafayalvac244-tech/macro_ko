// TEMEL ARAYÜZ BİLEŞENLERİ.
//
// Yeni bir ekran yazmadan önce buraya bak; burada olanı yeniden yazma.
// Hepsi temadan renk alır, hiçbiri çıplak hex kullanmaz.
//
// GÖRSEL DİL (27.09.2026 yenilemesi): üstte İKİ TEMADA DA KOYU bir uygulama
// çubuğu, altında açık ya da koyu içerik. Simgeler `simgeler.ts`ten gelir.
// Emoji ve "‹ ⤓ ✓" gibi yazı işaretleri kullanılmaz: emoji cihazın yazı
// tipiyle çizilir ve üreticiden üreticiye değişir; simge her yerde aynı SVG'dir.
//
// GÜVENLİ ALAN: üst boşluğu `Baslik`, alt boşluğu `AltCubuk` ve `AltSayfa`
// kendisi alır. Eskiden üç ekran (yeni denetim, rapor, ayarlar) güvenli alanı
// hiç almıyordu; çentikli cihazda başlık durum çubuğunun altında kalırdı.

import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator, Modal, Platform, Pressable, StyleSheet,
  Text, TextInput, TextInputProps, useWindowDimensions, View, ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { S, Simge } from '@/bilesenler/simgeler';
import {
  bosluk, DOKUNMA, dereceRenkleri, HITSLOP, kose, Renkler, TABLET_GENISLIK, TABLET_KISA_KENAR,
  tipografi, useTema,
} from '@/tema';

// --- DÜZEN ----------------------------------------------------------------

/**
 * Ekranın tablet düzeninde olup olmadığı. Eşiklerin gerekçesi `olculer.ts`te.
 * `en` ham genişliktir; eşik dışında bir karar gerekirse (başlık düğmesinde
 * yazı gösterilsin mi) oradan okunur.
 */
export function useDuzen() {
  const { width, height } = useWindowDimensions();
  return {
    tablet: Math.min(width, height) >= TABLET_KISA_KENAR && width >= TABLET_GENISLIK,
    en: width,
  };
}

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
  const kenar = useSafeAreaInsets();
  return (
    <Modal visible={gorunur} animationType="slide" transparent onRequestClose={onKapat}>
      <View style={s.perde}>
        <View style={[s.altSayfa, tamYukseklik && { height: '88%' }, { paddingBottom: kenar.bottom }]}>
          <View style={s.tutamak} />
          {children}
        </View>
      </View>
    </Modal>
  );
}

// --- EKRAN ----------------------------------------------------------------

/** Ekran zemini. Güvenli alanı kendisi ALMAZ — `Baslik` ve `AltCubuk` alır. */
export function Ekran({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { renkler } = useTema();
  return <View style={[{ flex: 1, backgroundColor: renkler.bg }, style]}>{children}</View>;
}

// --- UYGULAMA ÇUBUĞU ------------------------------------------------------

export function Baslik({
  baslik, altBaslik, sol, sag, mono = false, cipler,
}: {
  baslik: string;
  altBaslik?: string;
  sol?: React.ReactNode;
  sag?: React.ReactNode;
  /** Başlık bir şasi numarasıysa: eşit genişlikli yazı, 0/O ve 1/I karışmasın. */
  mono?: boolean;
  /** Başlığın altında bağlam çipleri (araç, faz, plaka…) — `BaslikCipi`. */
  cipler?: React.ReactNode;
}) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const kenar = useSafeAreaInsets();
  return (
    <View
      style={[s.cubuk, {
        paddingTop: kenar.top + bosluk.xs,
        paddingLeft: bosluk.sm + kenar.left,
        paddingRight: bosluk.sm + kenar.right,
      }]}
    >
      <View style={s.cubukSatir}>
        {sol}
        <View style={s.cubukOrta}>
          <Text accessibilityRole="header" style={mono ? s.cubukBaslikMono : s.cubukBaslik} numberOfLines={1}>
            {baslik}
          </Text>
          {altBaslik ? <Text style={s.cubukAlt} numberOfLines={1}>{altBaslik}</Text> : null}
        </View>
        {sag ? <View style={s.cubukSag}>{sag}</View> : null}
      </View>
      {cipler ? <View style={s.cubukCipler}>{cipler}</View> : null}
    </View>
  );
}

/** Uygulama çubuğundaki bağlam çipi — yalnız bilgi, dokunulmaz. */
export function BaslikCipi({ metin, simge: Ikon, mono = false }: { metin: string; simge?: Simge; mono?: boolean }) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  return (
    <View style={s.cubukCip}>
      {Ikon ? <Ikon size={14} color={renkler.cubukMetinSolgun} strokeWidth={2} /> : null}
      <Text style={[s.cubukCipMetin, mono && s.cubukCipMono]} numberOfLines={1}>{metin}</Text>
    </View>
  );
}

/**
 * Uygulama çubuğu düğmesi. Simgeli düğme dar ekranda (telefon) yalnız simge
 * gösterir; etiketi ekran okuyucu için `erisimEtiketi`nde kalır, o yüzden
 * zorunludur.
 */
export function BaslikDugmesi({
  simge: Ikon, metin, erisimEtiketi, onPress, birincil = false, sayac,
}: {
  simge?: Simge;
  metin?: string;
  erisimEtiketi: string;
  onPress: () => void;
  birincil?: boolean;
  /** Düğmenin yanında sayı (ör. kaydedilen hata adedi) — dar ekranda da görünür. */
  sayac?: number;
}) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const { en } = useDuzen();
  const metniGoster = !!metin && (!Ikon || en >= 600);
  const renk = birincil ? renkler.cubukVurguMetin : renkler.cubukMetin;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={erisimEtiketi}
      onPress={onPress}
      style={({ pressed }) => [
        s.cubukDugme,
        birincil && s.cubukDugmeBirincil,
        !metniGoster && sayac === undefined && s.cubukDugmeKare,
        pressed && s.basili,
      ]}
    >
      {Ikon ? <Ikon size={20} color={renk} strokeWidth={2} /> : null}
      {metniGoster ? <Text style={[s.cubukDugmeMetin, { color: renk }]} numberOfLines={1}>{metin}</Text> : null}
      {sayac !== undefined ? (
        <View style={[s.sayac, birincil && { backgroundColor: renkler.cubukVurguMetin }]}>
          <Text style={[s.sayacMetin, birincil && { color: renkler.cubukVurgu }]}>{sayac}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * Geri düğmesi. Geri gidilecek ekran yoksa (web'de sayfa yenilendi, ya da
 * bağlantıyla doğrudan açıldı) ana sayfaya döner; eskiden hiçbir şey yapmıyordu.
 */
export function GeriDugmesi({ onPress }: { onPress?: () => void }) {
  const router = useRouter();
  return (
    <BaslikDugmesi
      simge={S.geri}
      erisimEtiketi="Geri"
      onPress={onPress ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
    />
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

export function BolumBasligi({
  metin, sag, simge: Ikon,
}: { metin: string; sag?: React.ReactNode; simge?: Simge }) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  return (
    <View style={s.bolumSatiri}>
      <View style={s.bolumSol}>
        {Ikon ? <Ikon size={15} color={renkler.metinSolgun} strokeWidth={2} /> : null}
        <Text style={s.bolumMetin} accessibilityRole="header">{metin}</Text>
      </View>
      {sag}
    </View>
  );
}

// --- DÜĞME ----------------------------------------------------------------

type DugmeTuru = 'birincil' | 'ikincil' | 'sessiz' | 'tehlike';

export function Dugme({
  metin, onPress, tur = 'ikincil', kucuk = false, pasif = false, yukleniyor = false, style, erisimEtiketi,
  simge: Ikon, simgeSonda = false,
}: {
  metin: string;
  onPress: () => void;
  tur?: DugmeTuru;
  kucuk?: boolean;
  pasif?: boolean;
  yukleniyor?: boolean;
  style?: ViewStyle;
  erisimEtiketi?: string;
  simge?: Simge;
  /** İleri yönlü eylemlerde ok yazıdan SONRA gelir ("Denetime başla →"). */
  simgeSonda?: boolean;
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
  const yaziRengi = tur === 'birincil' || tur === 'tehlike' ? renkler.metinTers
    : tur === 'sessiz' ? renkler.metinIkincil
    : renkler.metin;
  const cizgiRengi = tur === 'birincil' ? renkler.birincil
    : tur === 'tehlike' ? renkler.tehlike
    : tur === 'sessiz' ? renkler.seffaf
    : renkler.cizgi;
  const simgeOgesi = Ikon ? <Ikon size={kucuk ? 16 : 19} color={yaziRengi} strokeWidth={2} /> : null;

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
        tur === 'ikincil' && s.golgeli,
        pressed && !kapali && s.basili,
        kapali && s.dugmePasif,
        style,
      ]}
    >
      {yukleniyor ? <ActivityIndicator color={yaziRengi} /> : (
        <>
          {simgeSonda ? null : simgeOgesi}
          <Text style={[kucuk ? s.dugmeMetinKucuk : s.dugmeMetin, { color: yaziRengi }]} numberOfLines={1}>{metin}</Text>
          {simgeSonda ? simgeOgesi : null}
        </>
      )}
    </Pressable>
  );
}

/**
 * Tek seçimli seçenek (radyo). Seçili olan YALNIZ RENKLE ayrılmaz, tik
 * simgesi de taşır — renk körlüğünde ve güneş altında da okunur.
 */
export function Secenek({
  metin, secili, onPress, erisimEtiketi, simge: Ikon, style,
}: {
  metin: string;
  secili: boolean;
  onPress: () => void;
  erisimEtiketi?: string;
  simge?: Simge;
  style?: ViewStyle;
}) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const renk = secili ? renkler.birincil : renkler.metin;
  return (
    <Pressable
      accessibilityRole="radio"
      aria-checked={secili}
      accessibilityLabel={erisimEtiketi ?? metin}
      onPress={onPress}
      style={({ pressed }) => [s.secenek, secili && s.secenekSecili, pressed && s.basili, style]}
    >
      {Ikon ? <Ikon size={17} color={renk} strokeWidth={2} /> : null}
      <Text style={[s.secenekMetin, { color: renk }]} numberOfLines={1}>{metin}</Text>
      {secili ? <S.tik size={16} color={renkler.birincil} strokeWidth={2.5} /> : null}
    </Pressable>
  );
}

// --- GİRDİ ----------------------------------------------------------------

export function Girdi({
  etiket, ipucu, hata, mono = false, style, onFocus, onBlur, ...rest
}: TextInputProps & { etiket?: string; ipucu?: string; hata?: string; mono?: boolean }) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const [odak, setOdak] = useState(false);
  return (
    <View style={{ gap: bosluk.xxs }}>
      {etiket ? <Text style={s.alanEtiketi}>{etiket}</Text> : null}
      <TextInput
        placeholderTextColor={renkler.metinSolgun}
        // Etiket ayrı bir Text olduğu için ekran okuyucu alanı adsız okur.
        // Çağıran kendi etiketini verdiyse ona dokunma.
        accessibilityLabel={rest.accessibilityLabel ?? etiket}
        // Odak kenarın rengi ve kalınlığıyla gösterilir; web'de tarayıcının
        // siyah odak çizgisi bunun üstüne ikinci bir çerçeve çiziyordu.
        style={[
          s.girdi, mono && s.girdiMono, odak && s.girdiOdak, !!hata && s.girdiHatali,
          Platform.OS === 'web' && { outlineWidth: 0 }, style,
        ]}
        onFocus={(e) => { setOdak(true); onFocus?.(e); }}
        onBlur={(e) => { setOdak(false); onBlur?.(e); }}
        {...rest}
      />
      {hata ? <Text style={s.hataMetni}>{hata}</Text> : ipucu ? <Text style={s.ipucuMetni}>{ipucu}</Text> : null}
    </View>
  );
}

/** Arama kutusu: büyüteç, yazı, doluyken temizle düğmesi. */
export function AramaKutusu({
  deger, degistir, yerTutucu, erisimEtiketi, style,
}: {
  deger: string;
  degistir: (t: string) => void;
  yerTutucu: string;
  erisimEtiketi: string;
  style?: ViewStyle;
}) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const [odak, setOdak] = useState(false);
  return (
    <View style={[s.arama, odak && s.aramaOdak, style]}>
      <S.ara size={18} color={odak ? renkler.birincil : renkler.metinSolgun} strokeWidth={2} />
      <TextInput
        value={deger}
        onChangeText={degistir}
        placeholder={yerTutucu}
        placeholderTextColor={renkler.metinSolgun}
        accessibilityLabel={erisimEtiketi}
        autoCorrect={false}
        onFocus={() => setOdak(true)}
        onBlur={() => setOdak(false)}
        // Web'de tarayıcının kendi odak çizgisi kutunun İÇİNDE ikinci bir
        // çerçeve çiziyordu; odak zaten kutunun kenarında gösteriliyor.
        style={[s.aramaGirdi, Platform.OS === 'web' && { outlineWidth: 0 }]}
      />
      {deger ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Aramayı temizle"
          hitSlop={HITSLOP}
          onPress={() => degistir('')}
          style={s.aramaTemizle}
        >
          <S.kapat size={18} color={renkler.metinIkincil} strokeWidth={2} />
        </Pressable>
      ) : null}
    </View>
  );
}

// --- ROZET ----------------------------------------------------------------

export function Rozet({
  metin, renk, zemin, simge: Ikon,
}: { metin: string; renk?: string; zemin?: string; simge?: Simge }) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const r = renk ?? renkler.metinIkincil;
  return (
    <View style={[s.rozet, { backgroundColor: zemin ?? renkler.yuzeyAlt }]}>
      {Ikon ? <Ikon size={12} color={r} strokeWidth={2.25} /> : null}
      <Text style={[s.rozetMetin, { color: r }]}>{metin}</Text>
    </View>
  );
}

/**
 * Derece rozeti: `3` ya da `(3)`.
 *
 * Kabul edilebilir bulgu PARANTEZLE yazılır ve dolgusuz çizilir. Asıl ayrım
 * parantezdedir, renk yardımcıdır — renk körlüğünde ve siyah-beyaz çıktıda da
 * "düzeltilecek" ile "kabul edildi" karışmasın.
 */
export function DereceRozeti({
  derece, kabul, buyuk = false,
}: {
  derece: string;
  /**
   * ZORUNLU, varsayılanı yok. İsteğe bağlıyken rapor ekranı onu geçirmeyi
   * unuttu ve (3) orada düz 3 göründü (26.09.2026). Artık her kullanan yer
   * bulgunun kabul durumunu açıkça vermek zorunda — derleyici zorluyor.
   */
  kabul: boolean;
  buyuk?: boolean;
}) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const { on, arka } = dereceRenkleri(renkler, derece);
  return (
    <View
      accessibilityLabel={kabul ? `Derece ${derece}, kabul edilebilir` : `Derece ${derece}`}
      style={[
        s.derecePul, buyuk && s.derecePulBuyuk,
        kabul
          ? { backgroundColor: 'transparent', borderColor: renkler.cizgiGuclu, borderStyle: 'dashed' }
          : { backgroundColor: arka, borderColor: on },
        kabul && { minWidth: buyuk ? 56 : 40 },
      ]}
    >
      <Text style={[s.dereceHarf, buyuk && s.dereceHarfBuyuk, { color: kabul ? renkler.metinIkincil : on }]}>
        {kabul ? `(${derece})` : derece}
      </Text>
    </View>
  );
}

// --- ÖLÇÜ KUTUSU ----------------------------------------------------------

/**
 * Sayı kutusu. `renk` sayıya ve simgeye, `zemin` simgenin yuvasına gider;
 * ikisi birlikte verilir (ör. derece3 + derece3Yumusak).
 */
export function Olcu({
  deger, etiket, renk, zemin, simge: Ikon, genis = false,
}: {
  deger: string | number;
  etiket: string;
  renk?: string;
  zemin?: string;
  simge?: Simge;
  genis?: boolean;
}) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  return (
    <View style={[s.olcu, genis && { flex: 1 }]}>
      {Ikon ? (
        <View style={[s.olcuSimge, { backgroundColor: zemin ?? renkler.yuzeyAlt }]}>
          <Ikon size={18} color={renk ?? renkler.metinIkincil} strokeWidth={2} />
        </View>
      ) : null}
      <View style={s.olcuMetinler}>
        <Text style={[s.olcuDeger, renk ? { color: renk } : null]} numberOfLines={1}>{deger}</Text>
        <Text style={s.olcuEtiket} numberOfLines={1}>{etiket}</Text>
      </View>
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
  baslik, aciklama, eylem, simge: Ikon,
}: { baslik: string; aciklama?: string; eylem?: React.ReactNode; simge?: Simge }) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  return (
    <View style={s.ortala}>
      {Ikon ? (
        <View style={s.bosSimge}>
          <Ikon size={30} color={renkler.birincil} strokeWidth={1.75} />
        </View>
      ) : null}
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
    <View style={[s.kutu, { backgroundColor: renkler.tehlikeYumusak, borderLeftColor: renkler.tehlike }]}>
      <S.uyari size={16} color={renkler.tehlike} strokeWidth={2} />
      <Text style={[s.kutuMetni, { color: renkler.tehlike }]}>{metin}</Text>
    </View>
  );
}

export function BilgiKutusu({
  metin, tur = 'bilgi',
}: { metin: string; tur?: 'bilgi' | 'uyari' | 'basari' }) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const { arka, renk, Ikon } = {
    bilgi: { arka: renkler.bilgiYumusak, renk: renkler.bilgi, Ikon: S.bilgi },
    uyari: { arka: renkler.uyariYumusak, renk: renkler.uyari, Ikon: S.uyari },
    basari: { arka: renkler.basariYumusak, renk: renkler.basari, Ikon: S.tamam },
  }[tur];
  return (
    <View style={[s.kutu, { backgroundColor: arka, borderLeftColor: renk }]}>
      <Ikon size={16} color={renk} strokeWidth={2} />
      <Text style={[s.kutuMetni, { color: renk }]}>{metin}</Text>
    </View>
  );
}

// --- ALT ÇUBUK ------------------------------------------------------------

/** Ekranın altındaki eylem çubuğu. Ev çubuğu (home indicator) payını kendisi alır. */
export function AltCubuk({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const kenar = useSafeAreaInsets();
  return (
    <View
      style={[s.altCubuk, {
        paddingBottom: bosluk.sm + kenar.bottom,
        paddingLeft: bosluk.md + kenar.left,
        paddingRight: bosluk.md + kenar.right,
      }, style]}
    >
      {children}
    </View>
  );
}

// --- STİLLER --------------------------------------------------------------

const stiller = (r: Renkler) => StyleSheet.create({
  basili: { opacity: 0.72 },
  golgeli: { boxShadow: `0 1px 2px ${r.golge}` },

  // Uygulama çubuğu
  // Alt çizgi koyu temada gerekli: çubuk ile koyu içerik zemini birbirine çok
  // yakın, çizgi olmadan tablette sol bölmeyle çubuk birleşiyordu.
  cubuk: {
    backgroundColor: r.cubuk, paddingBottom: bosluk.xs, gap: bosluk.xs,
    borderBottomWidth: 1, borderBottomColor: r.cubukCizgi,
  },
  cubukSatir: { flexDirection: 'row', alignItems: 'center', gap: bosluk.sm, minHeight: DOKUNMA },
  cubukOrta: { flex: 1, minWidth: 0 },
  cubukBaslik: { ...tipografi.h2, color: r.cubukMetin },
  cubukBaslikMono: { ...tipografi.monoBuyuk, fontSize: 19, lineHeight: 26, letterSpacing: 1.2, color: r.cubukMetin },
  cubukAlt: { ...tipografi.caption, color: r.cubukMetinSolgun },
  cubukSag: { flexDirection: 'row', alignItems: 'center', gap: bosluk.xs },
  cubukCipler: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingBottom: 2 },
  cubukCip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 320,
    paddingHorizontal: bosluk.xs, paddingVertical: 4, borderRadius: kose.pill,
    backgroundColor: r.cubukYuzey,
  },
  cubukCipMetin: { ...tipografi.captionOrta, color: r.cubukMetin, flexShrink: 1 },
  cubukCipMono: { fontFamily: tipografi.mono.fontFamily, letterSpacing: 0.6 },

  cubukDugme: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: bosluk.xs,
    minHeight: DOKUNMA, minWidth: DOKUNMA, paddingHorizontal: bosluk.sm,
    borderRadius: kose.md, borderWidth: 1, borderColor: r.cubukCizgi, backgroundColor: r.cubukYuzey,
  },
  cubukDugmeBirincil: { backgroundColor: r.cubukVurgu, borderColor: r.cubukVurgu },
  cubukDugmeKare: { paddingHorizontal: 0, width: DOKUNMA },
  cubukDugmeMetin: { ...tipografi.bodyOrta },
  sayac: {
    minWidth: 24, height: 22, paddingHorizontal: 6, borderRadius: kose.pill,
    alignItems: 'center', justifyContent: 'center', backgroundColor: r.cubukVurgu,
  },
  sayacMetin: { ...tipografi.captionOrta, fontVariant: ['tabular-nums'], color: r.cubukVurguMetin },

  kart: {
    backgroundColor: r.yuzey, borderRadius: kose.lg, borderWidth: 1,
    borderColor: r.cizgiSolgun, padding: bosluk.md, gap: bosluk.sm,
    boxShadow: `0 1px 3px ${r.golge}`,
  },
  kartVurgulu: { borderColor: r.birincil, backgroundColor: r.birincilYumusak },

  bolumSatiri: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: bosluk.sm },
  bolumSol: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bolumMetin: { ...tipografi.etiket, color: r.metinSolgun },

  dugme: {
    flexDirection: 'row', gap: bosluk.xs,
    minHeight: DOKUNMA, borderRadius: kose.md, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: bosluk.md, paddingVertical: bosluk.sm,
  },
  dugmeKucuk: { minHeight: 40, paddingHorizontal: bosluk.sm, paddingVertical: bosluk.xs, gap: 6 },
  dugmePasif: { opacity: 0.4 },
  dugmeMetin: { ...tipografi.bodyOrta },
  dugmeMetinKucuk: { ...tipografi.captionOrta },

  secenek: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    minHeight: DOKUNMA, paddingHorizontal: bosluk.sm, borderRadius: kose.md,
    borderWidth: 1, borderColor: r.cizgi, backgroundColor: r.yuzey,
  },
  secenekSecili: { borderColor: r.birincil, backgroundColor: r.birincilYumusak, borderWidth: 1.5 },
  secenekMetin: { ...tipografi.bodyOrta, flexShrink: 1 },

  alanEtiketi: { ...tipografi.etiket, color: r.metinSolgun },
  girdi: {
    ...tipografi.body, color: r.metin, backgroundColor: r.yuzey,
    borderWidth: 1, borderColor: r.cizgi, borderRadius: kose.md,
    paddingHorizontal: bosluk.sm, minHeight: DOKUNMA,
  },
  // Odakta kenar 2 px olur; dolgu 1 px azalır ki yazı yerinden oynamasın.
  girdiOdak: { borderColor: r.birincil, borderWidth: 2, paddingHorizontal: bosluk.sm - 1 },
  girdiMono: { ...tipografi.monoBuyuk, color: r.metin, textAlign: 'center' },
  girdiHatali: { borderColor: r.tehlike },
  hataMetni: { ...tipografi.caption, color: r.tehlike },
  ipucuMetni: { ...tipografi.caption, color: r.metinSolgun },

  arama: {
    flexDirection: 'row', alignItems: 'center', gap: bosluk.xs,
    minHeight: DOKUNMA, paddingLeft: bosluk.sm, paddingRight: bosluk.xxs,
    backgroundColor: r.yuzey, borderWidth: 1, borderColor: r.cizgi, borderRadius: kose.md,
  },
  aramaOdak: { borderColor: r.birincil, borderWidth: 2, paddingLeft: bosluk.sm - 1, paddingRight: bosluk.xxs - 1 },
  aramaGirdi: { ...tipografi.body, color: r.metin, flex: 1, minWidth: 0, minHeight: DOKUNMA - 2 },
  aramaTemizle: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: kose.sm },

  rozet: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: bosluk.xs, paddingVertical: 3, borderRadius: kose.pill, alignSelf: 'flex-start',
  },
  rozetMetin: { ...tipografi.etiket },

  derecePul: {
    width: 32, height: 32, borderRadius: kose.sm, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  derecePulBuyuk: { width: 44, height: 44, borderRadius: kose.md },
  dereceHarf: { ...tipografi.h3 },
  dereceHarfBuyuk: { ...tipografi.h2 },

  olcu: {
    flexDirection: 'row', alignItems: 'center', gap: bosluk.sm,
    backgroundColor: r.yuzey, borderRadius: kose.lg, borderWidth: 1, borderColor: r.cizgiSolgun,
    paddingHorizontal: bosluk.sm, paddingVertical: bosluk.sm, minWidth: 140,
    boxShadow: `0 1px 3px ${r.golge}`,
  },
  olcuSimge: { width: 40, height: 40, borderRadius: kose.md, alignItems: 'center', justifyContent: 'center' },
  olcuMetinler: { minWidth: 0, flexShrink: 1 },
  olcuDeger: { ...tipografi.sayiBuyuk, color: r.metin },
  olcuEtiket: { ...tipografi.caption, color: r.metinSolgun, marginTop: -2 },

  ortala: { alignItems: 'center', justifyContent: 'center', padding: bosluk.xl, gap: bosluk.sm },
  bosSimge: {
    width: 64, height: 64, borderRadius: kose.pill, alignItems: 'center', justifyContent: 'center',
    backgroundColor: r.birincilYumusak, marginBottom: bosluk.xxs,
  },
  bosBaslik: { ...tipografi.h3, color: r.metin, textAlign: 'center' },
  durumMetni: { ...tipografi.body, color: r.metinSolgun, textAlign: 'center', maxWidth: 460 },

  kutu: {
    flexDirection: 'row', alignItems: 'flex-start', gap: bosluk.xs,
    borderLeftWidth: 3, borderRadius: kose.sm, padding: bosluk.sm,
  },
  kutuMetni: { ...tipografi.caption, flex: 1 },

  altCubuk: {
    flexDirection: 'row', gap: bosluk.xs, paddingTop: bosluk.sm,
    backgroundColor: r.bgYukseltilmis, borderTopWidth: 1, borderTopColor: r.cizgiSolgun,
  },

  perde: { flex: 1, backgroundColor: r.perde, justifyContent: 'flex-end' },
  altSayfa: {
    backgroundColor: r.bgYukseltilmis,
    borderTopLeftRadius: kose.xl, borderTopRightRadius: kose.xl,
    maxHeight: '92%', paddingTop: bosluk.xs, gap: bosluk.xs,
  },
  tutamak: { width: 42, height: 4, borderRadius: kose.pill, backgroundColor: r.cizgi, alignSelf: 'center' },
});
