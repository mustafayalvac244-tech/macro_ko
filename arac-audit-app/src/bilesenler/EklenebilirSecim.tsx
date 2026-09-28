// EKLENEBİLİR SEÇİM — hazır listeden tek dokunuşla seç, yoksa ekle.
//
// Denetçi ve faz için (ürün sahibi, 28.09.2026). Liste cihazda `ayarlar`
// tablosunda durur; eklenen her ad kalıcıdır. Mantık (tekrar önleme, sadeleştirme)
// `cekirdek/listeler.ts`te — burada yalnız ekran var.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { S } from '@/bilesenler/simgeler';
import { Dugme, Secenek } from '@/bilesenler/temel';
import { listedenCikar, listeyeEkle } from '@/cekirdek/listeler';
import { bosluk, DOKUNMA, kose, Renkler, tipografi, useTema } from '@/tema';
import { ayarOku, ayarYaz } from '@/veri/depo';

/**
 * Cihazdaki listeyi okur ve yazar. Hiç kaydedilmemişse hazır liste kullanılır.
 * `yuklendi` gelmeden liste çizilmez: önce hazır listeyi gösterip sonra
 * kaydedilene geçmek, silinmiş bir seçeneğin bir an görünüp kaybolması demek.
 */
export function useSecimListesi(anahtar: string, hazir: readonly string[]) {
  const [liste, setListe] = useState<string[]>([...hazir]);
  const [yuklendi, setYuklendi] = useState(false);

  useEffect(() => {
    let iptal = false;
    ayarOku<string[] | null>(anahtar, null)
      .then((k) => { if (!iptal && Array.isArray(k)) setListe(k); })
      .catch(() => { /* okunamazsa hazır listeyle devam */ })
      .finally(() => { if (!iptal) setYuklendi(true); });
    return () => { iptal = true; };
  }, [anahtar]);

  const kaydet = useCallback((yeni: string[]) => {
    setListe(yeni);
    ayarYaz(anahtar, yeni).catch(() => { /* bu oturumda çalışır, kalıcı olmaz */ });
  }, [anahtar]);

  /** Eklenen (ya da zaten var olan) yazılışı döndürür; boşsa ''. */
  const ekle = useCallback((ham: string): string => {
    const { liste: yeni, secilen } = listeyeEkle(liste, ham);
    if (yeni.length !== liste.length) kaydet(yeni);
    return secilen;
  }, [liste, kaydet]);

  const cikar = useCallback((ad: string) => kaydet(listedenCikar(liste, ad)), [liste, kaydet]);

  return { liste, yuklendi, ekle, cikar };
}

type Liste = ReturnType<typeof useSecimListesi>;

/**
 * Formdaki seçim: hazır seçenekler + "Ekle". Seçili olana yeniden dokunmak
 * seçimi kaldırır.
 */
export function EklenebilirSecim({
  baslik, ad, liste, deger, degistir, yerTutucu, buyukHarf = false,
}: {
  /** Görünen başlık, büyük harfle: "DENETÇİ". */
  baslik: string;
  /** Ekran okuyucu için ad: "Denetçi". Seçenekler "Denetçi: Ali Veli" diye okunur. */
  ad: string;
  liste: Liste;
  deger: string;
  degistir: (d: string) => void;
  yerTutucu: string;
  buyukHarf?: boolean;
}) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const [acik, setAcik] = useState(false);
  const [yeni, setYeni] = useState('');

  const gonder = () => {
    const secilen = liste.ekle(yeni);
    if (!secilen) return;
    degistir(secilen);
    setYeni('');
    setAcik(false);
  };

  return (
    <View style={s.govde}>
      <Text style={s.baslik}>{baslik}</Text>
      {liste.yuklendi ? (
        <View style={s.satir}>
          {liste.liste.map((x) => (
            <Secenek
              key={x}
              metin={x}
              erisimEtiketi={`${ad}: ${x}`}
              secili={deger === x}
              onPress={() => degistir(deger === x ? '' : x)}
              style={s.secenek}
            />
          ))}
          {!acik ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${ad} ekle`}
              onPress={() => setAcik(true)}
              style={({ pressed }) => [s.ekle, pressed && { opacity: 0.72 }]}
            >
              <S.ekle size={17} color={renkler.birincil} strokeWidth={2.25} />
              <Text style={s.ekleMetin}>Ekle</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {acik ? (
        <View style={s.ekleSatir}>
          <ListeGirdisi
            otomatikOdak
            deger={yeni}
            degistir={setYeni}
            gonder={gonder}
            yerTutucu={yerTutucu}
            erisimEtiketi={`Yeni ${ad.toLocaleLowerCase('tr')}`}
            buyukHarf={buyukHarf}
          />
          <Dugme metin="Ekle" tur="birincil" kucuk pasif={!yeni.trim()} onPress={gonder} erisimEtiketi={`${ad} listesine ekle`} />
          <Dugme metin="Vazgeç" tur="sessiz" kucuk onPress={() => { setAcik(false); setYeni(''); }} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * Listeye ad yazma kutusu. Kenar yalnız ODAKTAYKEN vurgulu: hep vurgulu
 * çizildiğinde (ilk sürüm, 28.09.2026 ekran görüntüsü) ayarlar ekranında
 * dokunulmamış kutular da seçiliymiş gibi görünüyordu.
 */
function ListeGirdisi({
  deger, degistir, gonder, yerTutucu, erisimEtiketi, buyukHarf, otomatikOdak = false,
}: {
  deger: string;
  degistir: (t: string) => void;
  gonder: () => void;
  yerTutucu: string;
  erisimEtiketi: string;
  buyukHarf: boolean;
  otomatikOdak?: boolean;
}) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const [odak, setOdak] = useState(otomatikOdak);
  return (
    <TextInput
      autoFocus={otomatikOdak}
      value={deger}
      onChangeText={degistir}
      onSubmitEditing={gonder}
      onFocus={() => setOdak(true)}
      onBlur={() => setOdak(false)}
      placeholder={yerTutucu}
      placeholderTextColor={renkler.metinSolgun}
      accessibilityLabel={erisimEtiketi}
      autoCapitalize={buyukHarf ? 'characters' : 'words'}
      autoCorrect={false}
      returnKeyType="done"
      style={[s.girdi, odak && s.girdiOdak, Platform.OS === 'web' && { outlineWidth: 0 }]}
    />
  );
}

/** Ayarlar ekranı için: listedeki adları kaldır, yenisini ekle. */
export function ListeDuzenle({
  ad, liste, yerTutucu, buyukHarf = false,
}: { ad: string; liste: Liste; yerTutucu: string; buyukHarf?: boolean }) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const [yeni, setYeni] = useState('');

  const gonder = () => {
    if (liste.ekle(yeni)) setYeni('');
  };

  return (
    <View style={s.govde}>
      {liste.yuklendi && liste.liste.length === 0 ? (
        <Text style={s.bos}>Liste boş.</Text>
      ) : null}
      <View style={s.satir}>
        {liste.liste.map((x) => (
          <View key={x} style={s.etiket}>
            <Text style={s.etiketMetin} numberOfLines={1}>{x}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${x}: ${ad.toLocaleLowerCase('tr')} listesinden kaldır`}
              onPress={() => liste.cikar(x)}
              style={({ pressed }) => [s.etiketSil, pressed && { opacity: 0.72 }]}
            >
              <S.kapat size={16} color={renkler.metinIkincil} strokeWidth={2.25} />
            </Pressable>
          </View>
        ))}
      </View>
      <View style={s.ekleSatir}>
        <ListeGirdisi
          deger={yeni}
          degistir={setYeni}
          gonder={gonder}
          yerTutucu={yerTutucu}
          erisimEtiketi={`Yeni ${ad.toLocaleLowerCase('tr')}`}
          buyukHarf={buyukHarf}
        />
        <Dugme metin="Ekle" simge={S.ekle} kucuk pasif={!yeni.trim()} onPress={gonder} erisimEtiketi={`${ad} listesine ekle`} />
      </View>
    </View>
  );
}

const stiller = (r: Renkler) => StyleSheet.create({
  govde: { gap: bosluk.xs },
  baslik: { ...tipografi.etiket, color: r.metinSolgun, marginTop: bosluk.xxs },
  satir: { flexDirection: 'row', flexWrap: 'wrap', gap: bosluk.xs },
  secenek: { minWidth: 64 },
  ekle: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    minHeight: DOKUNMA, paddingHorizontal: bosluk.sm, borderRadius: kose.md,
    borderWidth: 1, borderStyle: 'dashed', borderColor: r.birincil,
  },
  ekleMetin: { ...tipografi.bodyOrta, color: r.birincil },
  ekleSatir: { flexDirection: 'row', alignItems: 'center', gap: bosluk.xs },
  girdi: {
    ...tipografi.body, color: r.metin, flex: 1, minWidth: 0, minHeight: DOKUNMA,
    paddingHorizontal: bosluk.sm, borderRadius: kose.md,
    borderWidth: 1, borderColor: r.cizgi, backgroundColor: r.yuzey,
  },
  // Odakta kenar 2 px olur; dolgu 1 px azalır ki yazı yerinden oynamasın.
  girdiOdak: { borderWidth: 2, borderColor: r.birincil, paddingHorizontal: bosluk.sm - 1 },
  bos: { ...tipografi.caption, color: r.metinSolgun },
  etiket: {
    flexDirection: 'row', alignItems: 'center', maxWidth: '100%',
    minHeight: DOKUNMA, paddingLeft: bosluk.sm, borderRadius: kose.md,
    borderWidth: 1, borderColor: r.cizgi, backgroundColor: r.yuzey,
  },
  etiketMetin: { ...tipografi.bodyOrta, color: r.metin, flexShrink: 1 },
  etiketSil: { width: DOKUNMA - 4, height: DOKUNMA - 2, alignItems: 'center', justifyContent: 'center' },
});
