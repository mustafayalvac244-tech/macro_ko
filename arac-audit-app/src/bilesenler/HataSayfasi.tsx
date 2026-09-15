import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import { Dugme, Girdi, HataKutusu, SiddetRozeti } from '@/bilesenler/temel';
import { fotografKucult } from '@/cekirdek/goruntu';
import { HATA_GRUPLARI, HATA_TIPI_INDEKS, PARCA_INDEKS, parcaHataTipleri, SIDDETLER } from '@/cekirdek/katalog';
import { Hata, SiddetKodu } from '@/cekirdek/tipler';
import { bosluk, DOKUNMA, kose, Renkler, tipografi, useTema } from '@/tema';
import { fotografKaydet, FotografKaydi, fotografSil } from '@/veri/depo';

export interface HataTaslagi extends Omit<Hata, 'id' | 'zaman'> {
  id?: string;
  zaman?: string;
}

/**
 * Hata kaydı sayfası.
 *
 * TASARIM SÖZÜ: bir hatayı kaydetmek en fazla üç dokunuş — parçaya dokun,
 * hata tipini seç, Kaydet. Şiddet hata tipinden ön seçilir; adet, konum,
 * açıklama ve fotoğraf isteğe bağlıdır.
 */
export function HataSayfasi({
  denetimId, taslak, fotograflar, onKapat, onKaydet, onSil,
}: {
  denetimId: string;
  taslak: HataTaslagi | null;
  fotograflar: FotografKaydi[];
  onKapat: () => void;
  onKaydet: (h: HataTaslagi, yeniFotoIdleri: string[]) => void;
  onSil?: (hataId: string) => void;
}) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);

  const [hataTipiId, setHataTipiId] = useState<string | null>(null);
  const [siddet, setSiddet] = useState<SiddetKodu>('C');
  const [adet, setAdet] = useState('1');
  const [konum, setKonum] = useState('');
  const [aciklama, setAciklama] = useState('');
  const [fotoIdleri, setFotoIdleri] = useState<string[]>([]);
  const [fotoHatasi, setFotoHatasi] = useState<string | null>(null);
  const [fotoYukleniyor, setFotoYukleniyor] = useState(false);
  const [acilanTaslak, setAcilanTaslak] = useState<HataTaslagi | null>(null);

  // Sayfa her açılışta taslaktan doldurulur. useEffect yerine render sırasında
  // karşılaştırma: taslak değiştiği anda alanlar doğru değerle çizilsin.
  if (taslak && taslak !== acilanTaslak) {
    setAcilanTaslak(taslak);
    setHataTipiId(taslak.hataTipiId || null);
    setSiddet(taslak.siddet || 'C');
    setAdet(String(taslak.adet || 1));
    setKonum(taslak.konum ?? '');
    setAciklama(taslak.aciklama ?? '');
    setFotoIdleri(taslak.fotograflar ?? []);
    setFotoHatasi(null);
  }

  const parca = taslak ? PARCA_INDEKS[taslak.parcaId] : undefined;
  const tipler = useMemo(() => (taslak ? parcaHataTipleri(taslak.parcaId) : []), [taslak]);
  const gruplar = useMemo(() => [...new Set(tipler.map((t) => t.grup))], [tipler]);
  const duzenleme = !!taslak?.id;

  const fotografEkle = useCallback(async (kameradan: boolean) => {
    setFotoHatasi(null);
    setFotoYukleniyor(true);
    try {
      const izin = kameradan
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!izin.granted) {
        setFotoHatasi(kameradan
          ? 'Kamera izni verilmedi. Ayarlar → Uygulamalar üzerinden açabilirsiniz.'
          : 'Galeri izni verilmedi.');
        return;
      }
      const sonuc = kameradan
        ? await ImagePicker.launchCameraAsync({ quality: 1, exif: false })
        : await ImagePicker.launchImageLibraryAsync({ quality: 1, allowsMultipleSelection: true });
      if (sonuc.canceled) return;

      const yeniler: string[] = [];
      for (const varlik of sonuc.assets) {
        const kucuk = await fotografKucult(varlik.uri);
        const kayit = await fotografKaydet(denetimId, taslak?.id ?? null, kucuk.uri, kucuk.en, kucuk.boy);
        yeniler.push(kayit.id);
      }
      setFotoIdleri((o) => [...o, ...yeniler]);
    } catch (h) {
      setFotoHatasi(h instanceof Error ? h.message : String(h));
    } finally {
      setFotoYukleniyor(false);
    }
  }, [denetimId, taslak?.id]);

  const fotografiKaldir = useCallback(async (id: string) => {
    setFotoIdleri((o) => o.filter((x) => x !== id));
    await fotografSil(id).catch(() => { /* kayıt zaten yok */ });
  }, []);

  const kaydet = useCallback(() => {
    if (!taslak || !hataTipiId) return;
    onKaydet({
      ...taslak,
      hataTipiId,
      siddet,
      adet: Math.max(1, Math.min(99, Number(adet) || 1)),
      konum: konum.trim(),
      aciklama: aciklama.trim(),
      fotograflar: fotoIdleri,
    }, fotoIdleri);
  }, [aciklama, adet, fotoIdleri, hataTipiId, konum, onKaydet, siddet, taslak]);

  const fotoHaritasi = useMemo(
    () => new Map(fotograflar.map((f) => [f.id, f])),
    [fotograflar],
  );

  if (!taslak) return null;

  return (
    <>
      <View style={s.baslikSatiri}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.parcaAd} numberOfLines={1}>{parca?.ad ?? taslak?.parcaId ?? ''}</Text>
          <Text style={s.parcaYol} numberOfLines={1}>{parca?.bolgeAd} · {parca?.en}</Text>
        </View>
        {hataTipiId ? <SiddetRozeti siddet={siddet} buyuk /> : null}
      </View>

      <ScrollView style={s.kaydir} contentContainerStyle={s.kaydirIc} keyboardShouldPersistTaps="handled">
        <Text style={s.bolumBaslik}>HATA TİPİ</Text>
        {gruplar.map((g) => (
          <View key={g} style={{ gap: bosluk.xxs }}>
            <Text style={s.grupBaslik}>{HATA_GRUPLARI[g]?.ad ?? g}</Text>
            <View style={s.izgara}>
              {tipler.filter((t) => t.grup === g).map((t) => {
            const secili = hataTipiId === t.id;
            return (
            <Pressable
            key={t.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: secili }}
            accessibilityLabel={`${t.ad} (${t.en})`}
            onPress={() => {
            setHataTipiId(t.id);
            if (!duzenleme) setSiddet(t.siddet);
                    }}
            style={[s.secenek, secili && s.secenekSecili]}
                  >
            <Text style={[s.secenekAd, secili && { color: renkler.birincil }]}>{t.ad}</Text>
            <Text style={s.secenekEn}>{t.en}</Text>
            </Pressable>
                );
              })}
            </View>
          </View>
        ))}

        <Text style={s.bolumBaslik}>ŞİDDET</Text>
        <View style={s.izgara}>
          {SIDDETLER.map((sd) => {
            const secili = siddet === sd.id;
            return (
              <Pressable
            key={sd.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: secili }}
            accessibilityLabel={`${sd.ad} — ${sd.puan} puan`}
            onPress={() => setSiddet(sd.id)}
            style={[s.secenek, { flexBasis: 100 }, secili && s.secenekSecili]}
              >
            <Text style={[s.secenekAd, secili && { color: renkler.birincil }]}>{sd.id} · {sd.ad}</Text>
            <Text style={s.secenekEn}>{sd.puan} puan</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={s.ikiliSatir}>
          <View style={{ flex: 1, gap: bosluk.xxs }}>
            <Text style={s.alanEtiketi}>ADET</Text>
            <View style={s.adetKutu}>
            <Pressable
            accessibilityRole="button" accessibilityLabel="Adedi azalt"
            onPress={() => setAdet(String(Math.max(1, (Number(adet) || 1) - 1)))}
            style={s.adetDugme}
                  >
            <Text style={s.adetDugmeMetin}>−</Text>
            </Pressable>
            <TextInput
            value={adet}
            onChangeText={setAdet}
            keyboardType="number-pad"
            accessibilityLabel="Adet"
            style={s.adetGirdi}
            />
            <Pressable
            accessibilityRole="button" accessibilityLabel="Adedi artır"
            onPress={() => setAdet(String(Math.min(99, (Number(adet) || 1) + 1)))}
            style={s.adetDugme}
                  >
            <Text style={s.adetDugmeMetin}>+</Text>
            </Pressable>
            </View>
          </View>
          <View style={{ flex: 2 }}>
            <Girdi etiket="KONUM" value={konum} onChangeText={setKonum} placeholder="üst köşe, kol dayama hizası" />
          </View>
        </View>

        <Girdi etiket="AÇIKLAMA" value={aciklama} onChangeText={setAciklama} placeholder="İsteğe bağlı" multiline />

        <Text style={s.bolumBaslik}>FOTOĞRAF — EXCEL’E OTOMATİK GÖMÜLÜR</Text>
        {fotoHatasi ? <HataKutusu metin={fotoHatasi} /> : null}
        <View style={s.fotoSerit}>
          {fotoIdleri.map((id) => {
            const f = fotoHaritasi.get(id);
            return (
            <View key={id} style={s.fotoKutu}>
            {f ? <Image source={{ uri: f.uri }} style={s.fotoGorsel} /> : null}
            <Pressable
            accessibilityRole="button" accessibilityLabel="Fotoğrafı sil"
            onPress={() => fotografiKaldir(id)}
            style={s.fotoSil}
                    >
            <Text style={s.fotoSilMetin}>×</Text>
            </Pressable>
            </View>
                );
              })}
          <Pressable
            accessibilityRole="button" accessibilityLabel="Fotoğraf çek"
            onPress={() => fotografEkle(true)}
            disabled={fotoYukleniyor}
            style={s.fotoEkle}
              >
            <Text style={s.fotoEkleMetin}>{fotoYukleniyor ? '…' : '📷\nÇek'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button" accessibilityLabel="Galeriden seç"
            onPress={() => fotografEkle(false)}
            disabled={fotoYukleniyor}
            style={s.fotoEkle}
              >
            <Text style={s.fotoEkleMetin}>🖼{'\n'}Galeri</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={s.eylemler}>
        {duzenleme && onSil ? (
      <Dugme metin="Sil" tur="tehlike" onPress={() => taslak.id && onSil(taslak.id)} />
        ) : null}
        <Dugme metin="Vazgeç" tur="sessiz" onPress={onKapat} style={{ flex: 1 }} />
        <Dugme metin="Kaydet" tur="birincil" pasif={!hataTipiId} onPress={kaydet} style={{ flex: 1 }} />
      </View>
    </>
  );
}

const stiller = (r: Renkler) => StyleSheet.create({
  baslikSatiri: {
    flexDirection: 'row', alignItems: 'center', gap: bosluk.sm,
    paddingHorizontal: bosluk.md, paddingVertical: bosluk.xs,
  },
  parcaAd: { ...tipografi.h2, color: r.metin },
  parcaYol: { ...tipografi.caption, color: r.metinSolgun },

  kaydir: { flexGrow: 0 },
  kaydirIc: { paddingHorizontal: bosluk.md, paddingBottom: bosluk.md, gap: bosluk.sm },

  bolumBaslik: { ...tipografi.etiket, color: r.metinSolgun, marginTop: bosluk.xs },
  grupBaslik: { ...tipografi.captionOrta, color: r.metinIkincil },

  izgara: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  secenek: {
    flexGrow: 1, flexBasis: 148, minHeight: DOKUNMA, justifyContent: 'center',
    paddingHorizontal: bosluk.xs, paddingVertical: 6,
    borderRadius: kose.sm, borderWidth: 1, borderColor: r.cizgi, backgroundColor: r.yuzey,
  },
  secenekSecili: { borderColor: r.birincil, backgroundColor: r.birincilYumusak },
  secenekAd: { ...tipografi.captionOrta, color: r.metin },
  secenekEn: { ...tipografi.caption, color: r.metinSolgun, fontSize: 11 },

  ikiliSatir: { flexDirection: 'row', gap: bosluk.xs, alignItems: 'flex-end' },
  alanEtiketi: { ...tipografi.etiket, color: r.metinSolgun },
  adetKutu: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  adetDugme: {
    width: DOKUNMA, height: DOKUNMA, alignItems: 'center', justifyContent: 'center',
    borderRadius: kose.sm, borderWidth: 1, borderColor: r.cizgi, backgroundColor: r.yuzey,
  },
  adetDugmeMetin: { ...tipografi.h2, color: r.metin },
  adetGirdi: {
    flex: 1, textAlign: 'center', ...tipografi.sayiBuyuk, color: r.metin,
    borderWidth: 1, borderColor: r.cizgi, borderRadius: kose.sm,
    backgroundColor: r.yuzey, minHeight: DOKUNMA,
  },

  fotoSerit: { flexDirection: 'row', flexWrap: 'wrap', gap: bosluk.xs },
  fotoKutu: {
    width: 84, height: 84, borderRadius: kose.sm, overflow: 'hidden',
    borderWidth: 1, borderColor: r.cizgi,
  },
  fotoGorsel: { width: '100%', height: '100%' },
  fotoSil: {
    position: 'absolute', top: 2, right: 2, width: 26, height: 26,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: kose.sm, backgroundColor: r.perde,
  },
  fotoSilMetin: { ...tipografi.bodyOrta, color: '#FFFFFF' },
  fotoEkle: {
    width: 84, height: 84, alignItems: 'center', justifyContent: 'center',
    borderRadius: kose.sm, borderWidth: 1, borderStyle: 'dashed',
    borderColor: r.cizgiGuclu, backgroundColor: r.yuzey,
  },
  fotoEkleMetin: { ...tipografi.caption, color: r.metinIkincil, textAlign: 'center' },

  eylemler: {
    flexDirection: 'row', gap: bosluk.xs, padding: bosluk.md,
    borderTopWidth: 1, borderTopColor: r.cizgiSolgun, backgroundColor: r.bgYukseltilmis,
  },
});
