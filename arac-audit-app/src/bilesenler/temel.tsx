// TEMEL ARAYÜZ BİLEŞENLERİ.
//
// Yeni bir ekran yazmadan önce buraya bak; burada olanı yeniden yazma.
// Hepsi temadan renk alır, hiçbiri çıplak hex kullanmaz.
//
// GÖRSEL DİL (25.10.2026): Vekil Pro'nun dili — başlık sayfa zemininde (koyu
// çubuk yok), beyaz kartlar yumuşak gölgeyle, köşeler 12–16, etiketler normal
// yazımla. Önceki iki yenilemeyi (koyu çubuk, düz keskin kartlar, büyük harfli
// etiketler) ürün sahibi beğenmedi; Vekil Pro onun onayladığı tek örnek.
// Simgeler `simgeler.ts`ten gelir. Emoji ve "‹ ⤓ ✓" gibi yazı işaretleri
// kullanılmaz: emoji cihazın yazı tipiyle çizilir ve üreticiden üreticiye
// değişir; simge her yerde aynı SVG'dir.
//
// GÜVENLİ ALAN: üst boşluğu `Baslik`, alt boşluğu `AltCubuk` ve `AltSayfa`
// kendisi alır. Eskiden üç ekran (yeni denetim, rapor, ayarlar) güvenli alanı
// hiç almıyordu; çentikli cihazda başlık durum çubuğunun altında kalırdı.

import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet,
  Text, TextInput, TextInputProps, useWindowDimensions, View, ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { S, Simge } from '@/bilesenler/simgeler';
import {
  bosluk, DOKUNMA, dereceRenkleri, HITSLOP, kose, Renkler, TABLET_GENISLIK, TABLET_KISA_KENAR,
  tipografi, useTema, yazi,
} from '@/tema';
import { useDil } from '@/veri/dilDeposu';

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
  baslik, altBaslik, sol, sag, mono = false, cipler, ciplerSar = false, icerikGenisligi,
}: {
  baslik: string;
  altBaslik?: string;
  sol?: React.ReactNode;
  sag?: React.ReactNode;
  /** Başlık bir şasi numarasıysa: harf aralığı açık kimlik yazısı. */
  mono?: boolean;
  /** Başlığın altında bağlam çipleri (araç, faz, plaka…) — `BaslikCipi`. */
  cipler?: React.ReactNode;
  /**
   * Telefonda da çipler alt satıra sarsın (rapor: altında hata ızgarası yok,
   * yana kayan satırda son çip "Devan…" diye kesiliyordu — 26.10.2026).
   */
  ciplerSar?: boolean;
  /**
   * Sayfa içeriğinin en büyük genişliği (içerik ortalanıyorsa). Verilirse
   * başlık da aynı sütuna hizalanır: tablette başlık 16 px'ten, içerik 76 px'ten
   * başlıyordu (27.10.2026, ikinci tur estetik değerlendirmesi). İçeriğin kendi
   * yatay iç boşluğu 16 px varsayılır.
   */
  icerikGenisligi?: number;
}) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const kenar = useSafeAreaInsets();
  const { tablet } = useDuzen();
  const sutun = icerikGenisligi ? { width: '100%' as const, maxWidth: icerikGenisligi - 2 * bosluk.md, alignSelf: 'center' as const, gap: bosluk.xs } : null;
  return (
    <View
      style={[s.cubuk, {
        paddingTop: kenar.top + bosluk.xs,
        paddingLeft: bosluk.md + kenar.left,
        paddingRight: bosluk.md + kenar.right,
      }]}
    >
      <View style={sutun ?? s.sutunYok}>
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
      {/* Telefonda çipler TEK SATIR, yana kayar: sarınca başlık ~132 px'e çıkıp
          hata kutularını aşağı itiyordu (sınama, 28.09.2026). */}
      {cipler && (tablet || ciplerSar) ? <View style={s.cubukCipler}>{cipler}</View> : null}
      {cipler && !tablet && !ciplerSar ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.cubukCiplerTek}>
          {cipler}
        </ScrollView>
      ) : null}
      </View>
    </View>
  );
}

/** Uygulama çubuğundaki bağlam çipi — yalnız bilgi, dokunulmaz. */
export function BaslikCipi({ metin, simge: Ikon, mono = false }: { metin: string; simge?: Simge; mono?: boolean }) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  return (
    <View style={s.cubukCip}>
      {Ikon ? <Ikon size={14} color={renkler.metinSolgun} strokeWidth={2} /> : null}
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
  simge: Ikon, metin, erisimEtiketi, onPress, birincil = false, sayac, yukleniyor = false,
}: {
  simge?: Simge;
  metin?: string;
  erisimEtiketi: string;
  onPress: () => void;
  birincil?: boolean;
  /** Düğmenin yanında sayı (ör. kaydedilen hata adedi) — dar ekranda da görünür. */
  sayac?: number;
  /** Simge yerine dönen gösterge; düğme bu sırada basılmaz. */
  yukleniyor?: boolean;
}) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const { en } = useDuzen();
  const metniGoster = !!metin && (!Ikon || en >= 600);
  const renk = birincil ? renkler.birincilDolguMetin : renkler.metin;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={erisimEtiketi}
      accessibilityState={{ busy: yukleniyor, disabled: yukleniyor }}
      disabled={yukleniyor}
      onPress={onPress}
      style={({ pressed }) => [
        s.cubukDugme,
        birincil && s.cubukDugmeBirincil,
        !metniGoster && sayac === undefined && s.cubukDugmeKare,
        pressed && s.basili,
      ]}
    >
      {yukleniyor ? <ActivityIndicator color={renk} /> : Ikon ? <Ikon size={20} color={renk} strokeWidth={2} /> : null}
      {metniGoster ? <Text style={[s.cubukDugmeMetin, { color: renk }]} numberOfLines={1}>{metin}</Text> : null}
      {sayac !== undefined ? (
        <View style={[s.sayac, birincil && { backgroundColor: renkler.birincilDolguMetin }]}>
          <Text style={[s.sayacMetin, birincil && { color: renkler.birincilDolgu }]}>{sayac}</Text>
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
  const { t } = useDil();
  return (
    <BaslikDugmesi
      simge={S.geri}
      erisimEtiketi={t('Geri', 'Back')}
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

/**
 * Bölüm başlığı. `bilgi` verilirse sağda (i) düğmesi çıkar, açıklama ona
 * dokununca açılır (26.10.2026 dış değerlendirme: formüller ve dipnot
 * paragrafları her kartın altında duruyor, kompozisyonu boğuyordu).
 */
export function BolumBasligi({
  metin, sag, simge: Ikon, bilgi,
}: { metin: string; sag?: React.ReactNode; simge?: Simge; bilgi?: string }) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const { t } = useDil();
  const [acik, setAcik] = useState(false);
  const satir = (
    <View style={s.bolumSatiri}>
      <View style={s.bolumSol}>
        {Ikon ? <Ikon size={16} color={renkler.metinSolgun} strokeWidth={2} /> : null}
        <Text style={s.bolumMetin} accessibilityRole="header">{metin}</Text>
      </View>
      {sag}
      {bilgi ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(`${metin} — açıklama`, `${metin} — explanation`)}
          aria-expanded={acik}
          hitSlop={HITSLOP}
          onPress={() => setAcik((x) => !x)}
          style={({ pressed }) => [s.bilgiDugme, acik && s.bilgiDugmeAcik, pressed && s.basili]}
        >
          <S.bilgi size={18} color={acik ? renkler.birincil : renkler.metinSolgun} strokeWidth={2} />
        </Pressable>
      ) : null}
    </View>
  );
  if (!bilgi) return satir;
  return (
    <View style={{ gap: bosluk.xs }}>
      {satir}
      {acik ? <Text style={s.bilgiMetin}>{bilgi}</Text> : null}
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
    birincil: renkler.birincilDolgu,
    tehlike: renkler.tehlike,
    ikincil: renkler.yuzeyVurgu,
    sessiz: renkler.seffaf,
  }[tur];
  const yaziRengi = tur === 'birincil' ? renkler.birincilDolguMetin
    : tur === 'tehlike' ? renkler.metinTers
    : tur === 'sessiz' ? renkler.metinIkincil
    : renkler.metin;
  const cizgiRengi = tur === 'birincil' ? renkler.birincilDolgu
    : tur === 'tehlike' ? renkler.tehlike
    : tur === 'sessiz' ? renkler.seffaf
    : renkler.yuzeyVurgu;
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
  metin, secili, onPress, erisimEtiketi, simge: Ikon, style, kucuk = false,
}: {
  metin: string;
  secili: boolean;
  onPress: () => void;
  erisimEtiketi?: string;
  simge?: Simge;
  style?: ViewStyle;
  /** Süzgeç çipi: 40 px, hap biçimli, küçük yazı (liste süzgeçleri için). */
  kucuk?: boolean;
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
      style={({ pressed }) => [s.secenek, kucuk && s.secenekKucuk, secili && s.secenekSecili, pressed && s.basili, style]}
    >
      {Ikon ? <Ikon size={kucuk ? 15 : 17} color={renk} strokeWidth={2} /> : null}
      <Text style={[kucuk ? s.secenekMetinKucuk : s.secenekMetin, { color: renk }]} numberOfLines={1}>{metin}</Text>
      {secili ? <S.tik size={kucuk ? 14 : 16} color={renkler.birincil} strokeWidth={2.5} /> : null}
    </Pressable>
  );
}

// --- SEGMENT SEÇİCİ (27.10.2026) -------------------------------------------
// İkinci tur değerlendirmede iki tasarımcı da aynı şeyi söyledi: düğme, tek
// seçim, süzgeç, silinebilir etiket hep aynı soluk hap; "ekran form üreteciyle
// yapılmış gibi". 2–4 seçenekli tek seçim artık bitişik segment: tek zemin,
// seçili parça beyaz yüzey + gölge + birincil yazı. Rol ve etiketler Secenek'le
// aynı (radio, aria-checked) — ekran okuyucu ve sınavlar için değişen bir şey yok.

export function SegmentSecici<T extends string>({
  secenekler, deger, onSec, erisimEtiketi, bosaltilabilir = false, style,
}: {
  secenekler: readonly { id: T; metin: string; erisimEtiketi?: string; simge?: Simge }[];
  deger: T | null;
  onSec: (id: T | null) => void;
  /** Grubun adı (radiogroup). */
  erisimEtiketi?: string;
  /** Seçiliye yeniden dokununca seçim kalkar (ör. spec isteğe bağlı). */
  bosaltilabilir?: boolean;
  style?: ViewStyle;
}) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  return (
    <View style={[s.segment, style]} accessibilityRole="radiogroup" accessibilityLabel={erisimEtiketi}>
      {secenekler.map((x) => {
        const secili = x.id === deger;
        const Ikon = x.simge;
        return (
          <Pressable
            key={x.id}
            accessibilityRole="radio"
            aria-checked={secili}
            accessibilityState={{ checked: secili }}
            accessibilityLabel={x.erisimEtiketi ?? x.metin}
            onPress={() => onSec(secili && bosaltilabilir ? null : x.id)}
            style={({ pressed }) => [s.segmentParca, secili && s.segmentSecili, pressed && s.basili]}
          >
            {Ikon ? <Ikon size={16} color={secili ? renkler.birincil : renkler.metinIkincil} strokeWidth={2} /> : null}
            <Text style={[s.segmentMetin, { color: secili ? renkler.birincil : renkler.metinIkincil }, secili && s.segmentMetinSecili]} numberOfLines={1}>
              {x.metin}
            </Text>
            {secili ? <S.tik size={14} color={renkler.birincil} strokeWidth={2.75} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Onay kutusu satırı (aç/kapa seçenek): radyo değil, checkbox. */
export function OnayKutusu({ metin, secili, onPress, erisimEtiketi }: {
  metin: string; secili: boolean; onPress: () => void; erisimEtiketi?: string;
}) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  return (
    <Pressable
      accessibilityRole="checkbox"
      aria-checked={secili}
      accessibilityState={{ checked: secili }}
      accessibilityLabel={erisimEtiketi ?? metin}
      onPress={onPress}
      style={({ pressed }) => [s.onaySatiri, pressed && s.basili]}
    >
      <View style={[s.onayKutusu, secili && { backgroundColor: renkler.birincilDolgu, borderColor: renkler.birincilDolgu }]}>
        {secili ? <S.tik size={15} color={renkler.birincilDolguMetin} strokeWidth={3} /> : null}
      </View>
      <Text style={s.onayMetni}>{metin}</Text>
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
          // Boş şasi kutusunda yer tutucu ("17 hane") 20 px kalın yazıyla girilmiş
          // bir değer gibi duruyordu (26.10.2026 dış değerlendirme): boşken düz yazı.
          s.girdi, mono && (rest.value ? s.girdiMono : s.girdiMonoBos), odak && s.girdiOdak, !!hata && s.girdiHatali,
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
  const { t } = useDil();
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
          accessibilityLabel={t('Aramayı temizle', 'Clear search')}
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
   * unuttu ve kabul edilmiş bulgu orada düz 3 göründü (26.09.2026). Artık her
   * kullanan yer kaydın bayrağını açıkça vermek zorunda — derleyici zorluyor.
   * 26.10.2026'dan beri bayraklı eski kayıt rozette demerit 0 görünür.
   */
  kabul: boolean;
  buyuk?: boolean;
}) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const deger = kabul ? '0' : derece;
  const { on, arka } = dereceRenkleri(renkler, deger);
  return (
    <View
      accessibilityLabel={`Demerit ${deger}`}
      style={[s.derecePul, buyuk && s.derecePulBuyuk, { backgroundColor: arka, borderColor: on }]}
    >
      <Text style={[s.dereceHarf, buyuk && s.dereceHarfBuyuk, { color: on }]}>{deger}</Text>
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

// --- İLERLEME ÇUBUĞU -------------------------------------------------------

/**
 * İnce ilerleme çubuğu — Lumiform'daki form ilerlemesi gibi (25.10.2026).
 * Hepsi bitince yeşile döner. Bilgi yalnız çubukta değil: yanında her zaman
 * "2/5" yazısı durur, çubuk onu görselleştirir. Ekran okuyucu değeri okur.
 */
export function IlerlemeCubugu({ deger, toplam, etiket }: { deger: number; toplam: number; etiket: string }) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const sinirli = Math.max(0, Math.min(deger, toplam));
  const oran = toplam > 0 ? sinirli / toplam : 0;
  const tam = toplam > 0 && sinirli >= toplam;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={etiket}
      // aria-value*: react-native-web eski `accessibilityValue`yu aktarmıyor
      // (uçtan uca sınavda değer boş geldi, 25.10.2026); RN de bunları okur.
      aria-valuemin={0}
      aria-valuemax={toplam}
      aria-valuenow={sinirli}
      style={s.ilerlemeIz}
    >
      <View style={[s.ilerlemeDolu, { width: `${oran * 100}%`, backgroundColor: tam ? renkler.basari : renkler.birincil }]} />
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

  // Başlık — sayfa zemininde, çizgisiz (Vekil Pro ScreenHeader). Düğmeler
  // beyaz yüzey + ince kenar; birincil olan lacivert dolgulu.
  cubuk: { backgroundColor: r.bg, paddingBottom: bosluk.xs, gap: bosluk.xs },
  cubukSatir: { flexDirection: 'row', alignItems: 'center', gap: bosluk.sm, minHeight: DOKUNMA },
  sutunYok: { gap: bosluk.xs },
  cubukOrta: { flex: 1, minWidth: 0 },
  cubukBaslik: { ...tipografi.h1, color: r.metin },
  cubukBaslikMono: { ...tipografi.kimlikBuyuk, color: r.metin },
  cubukAlt: { ...tipografi.caption, color: r.metinSolgun },
  cubukSag: { flexDirection: 'row', alignItems: 'center', gap: bosluk.xs },
  cubukCipler: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingBottom: 2 },
  cubukCiplerTek: { flexDirection: 'row', gap: 6, paddingBottom: 2 },
  cubukCip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 320,
    paddingHorizontal: bosluk.sm, paddingVertical: 4, borderRadius: kose.pill,
    backgroundColor: r.yuzey,
  },
  cubukCipMetin: { ...tipografi.captionOrta, color: r.metinIkincil, flexShrink: 1 },
  cubukCipMono: { ...tipografi.kimlik, fontSize: 13, lineHeight: 18, color: r.metin },

  // Çerçeve yok (26.10.2026, dış değerlendirme: "her şey çerçeveli kutu"):
  // sayfa zemininde beyaz yüzey kendini ayırıyor. Kenar kalınlığı kalır ki
  // birincil düğmeyle boyu aynı olsun.
  // ZEMİNSİZ (27.10.2026, ikinci tur estetik: "başlıkta dört tane kare kutu,
  // kiosk hissi"). Dokunma alanı 48 px kalır (eldiven); yalnız birincil dolu.
  cubukDugme: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: bosluk.xs,
    minHeight: DOKUNMA, minWidth: DOKUNMA, paddingHorizontal: bosluk.sm,
    borderRadius: kose.md, borderWidth: 1, borderColor: r.seffaf, backgroundColor: r.seffaf,
  },
  cubukDugmeBirincil: { backgroundColor: r.birincilDolgu, borderColor: r.birincilDolgu },
  cubukDugmeKare: { paddingHorizontal: 0, width: DOKUNMA },
  cubukDugmeMetin: { ...tipografi.bodyOrta },
  sayac: {
    minWidth: 24, height: 22, paddingHorizontal: 6, borderRadius: kose.pill,
    alignItems: 'center', justifyContent: 'center', backgroundColor: r.birincilDolgu,
  },
  sayacMetin: { ...tipografi.captionOrta, fontVariant: ['tabular-nums'], color: r.birincilDolguMetin },

  // Kart: beyaz, yumuşak gölge — ÇERÇEVE YOK (26.10.2026). Dış değerlendirme
  // "ya gölge ya çerçeve, ikisi birden değil" dedi; kart içinde kart kalabalık
  // görünüyordu. Vurgulu kart seçili-durum dilini kullanır (ton + 2 px kenar).
  kart: {
    backgroundColor: r.yuzey, borderRadius: kose.lg,
    padding: bosluk.md, gap: bosluk.sm,
    boxShadow: `0 4px 12px ${r.golge}`,
  },
  kartVurgulu: { borderWidth: 2, borderColor: r.birincil, backgroundColor: r.birincilYumusak },

  bolumSatiri: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: bosluk.sm },
  bolumSol: { flexDirection: 'row', alignItems: 'center', gap: bosluk.xs, flexShrink: 1 },
  bolumMetin: { ...tipografi.h3, fontSize: 16, lineHeight: 22, color: r.metin },
  bilgiDugme: { width: 32, height: 32, borderRadius: kose.pill, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },
  bilgiDugmeAcik: { backgroundColor: r.birincilYumusak },
  bilgiMetin: { ...tipografi.caption, color: r.metinIkincil, backgroundColor: r.yuzeyAlt, borderRadius: kose.md, padding: bosluk.sm },

  dugme: {
    flexDirection: 'row', gap: bosluk.xs,
    minHeight: DOKUNMA, borderRadius: kose.md, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: bosluk.md, paddingVertical: bosluk.sm,
  },
  // 40 → 48 (28.10.2026, erişilebilirlik değerlendirmesi): eldivenle küçük düğmeler ıskalanıyordu.
  dugmeKucuk: { minHeight: DOKUNMA, paddingHorizontal: bosluk.sm, paddingVertical: bosluk.xs, gap: 6, borderRadius: kose.sm + 2 },
  dugmePasif: { opacity: 0.4 },
  dugmeMetin: { ...tipografi.bodyOrta },
  dugmeMetinKucuk: { ...tipografi.captionOrta },

  // SEÇİLİ-DURUM DİLİ — uygulamada TEK (26.10.2026). Seçili: anlam renginin
  // yumuşak tonu + aynı renkte 2 px kenar + tik. Seçili değil: çerçevesiz ton
  // dolgu. Demerit seçicisi aynı dili kendi derece rengiyle kullanır
  // (HataSayfasi.tsx DereceSecici). Kenar hep 2 px: seçince boy oynamaz.
  secenek: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    minHeight: DOKUNMA, paddingHorizontal: bosluk.sm, borderRadius: kose.md,
    borderWidth: 2, borderColor: r.yuzeyVurgu, backgroundColor: r.yuzeyVurgu,
  },
  secenekKucuk: { minHeight: DOKUNMA, paddingHorizontal: bosluk.sm, borderRadius: kose.md },
  secenekSecili: { borderColor: r.birincil, backgroundColor: r.birincilYumusak },
  secenekMetin: { ...tipografi.bodyOrta, flexShrink: 1 },
  secenekMetinKucuk: { ...tipografi.captionOrta, flexShrink: 1 },

  // Segment: tek zemin, 2 px iç boşluk; seçili parça kart gibi yükselir.
  segment: {
    flexDirection: 'row', padding: 2, gap: 2, borderRadius: kose.md, backgroundColor: r.yuzeyVurgu,
  },
  // 28.10.2026 (beş ajanlı değerlendirme, iki ajanın ortak bulgusu): seçiliyi
  // yalnız zemin tonu ayırıyordu (iz ile 1,20:1; koyu temada seçili parça izden
  // KOYU, çukur görünüyordu). Seçenek'in dili: yumuşak ton + 2 px birincil
  // kenar + tik. Yükseklik 44 → 48 (eldiven).
  segmentParca: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    minHeight: DOKUNMA, paddingHorizontal: bosluk.xs, borderRadius: kose.md - 2,
    borderWidth: 2, borderColor: 'transparent',
  },
  segmentSecili: { backgroundColor: r.birincilYumusak, borderColor: r.birincil },
  segmentMetin: { ...tipografi.captionOrta, fontSize: 14, flexShrink: 1 },
  segmentMetinSecili: { fontFamily: yazi.kalin },
  onaySatiri: { flexDirection: 'row', alignItems: 'center', gap: bosluk.sm, minHeight: DOKUNMA, alignSelf: 'flex-start' },
  onayKutusu: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: r.cizgiGuclu,
    alignItems: 'center', justifyContent: 'center',
  },
  onayMetni: { ...tipografi.body, color: r.metin, flexShrink: 1 },

  alanEtiketi: { ...tipografi.caption, color: r.metinIkincil },
  girdi: {
    ...tipografi.body, color: r.metin, backgroundColor: r.yuzeyAlt,
    borderWidth: 1, borderColor: r.cizgi, borderRadius: kose.md,
    paddingHorizontal: bosluk.sm, minHeight: DOKUNMA,
  },
  // Odakta kenar 2 px olur; dolgu 1 px azalır ki yazı yerinden oynamasın.
  girdiOdak: { borderColor: r.birincil, borderWidth: 2, paddingHorizontal: bosluk.sm - 1, backgroundColor: r.yuzey },
  girdiMono: { ...tipografi.kimlikBuyuk, color: r.metin, textAlign: 'center' },
  girdiMonoBos: { ...tipografi.body, textAlign: 'center' },
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
    backgroundColor: r.yuzey, borderRadius: kose.lg,
    paddingHorizontal: bosluk.sm, paddingVertical: bosluk.sm, minWidth: 140,
    boxShadow: `0 4px 12px ${r.golge}`,
  },
  olcuSimge: { width: 40, height: 40, borderRadius: kose.md, alignItems: 'center', justifyContent: 'center' },
  olcuMetinler: { minWidth: 0, flexShrink: 1 },
  olcuDeger: { ...tipografi.sayiBuyuk, color: r.metin },
  olcuEtiket: { ...tipografi.caption, color: r.metinSolgun, marginTop: -2 },

  ilerlemeIz: { height: 6, borderRadius: kose.pill, backgroundColor: r.yuzeyVurgu, overflow: 'hidden' },
  ilerlemeDolu: { height: 6, borderRadius: kose.pill },

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
