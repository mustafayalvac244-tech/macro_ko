import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import { Dugme, Girdi, HataKutusu, SiddetRozeti } from '@/bilesenler/temel';
import { fotografKucult } from '@/cekirdek/goruntu';
import { HATA_GRUPLARI, PARCA_INDEKS, parcaHataTipleri, SIDDETLER } from '@/cekirdek/katalog';
import { Hata, HataGrubuId, HataTipi, SiddetKodu } from '@/cekirdek/tipler';
import { bosluk, DOKUNMA, kose, Renkler, tipografi, useTema } from '@/tema';
import { fotografKaydet, FotografKaydi, fotografSil } from '@/veri/depo';
import { useKatalog } from '@/veri/katalogDeposu';

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
 *
 * ARAMA VE "YENİ TİP" NEDEN BURADA: bir dış panelde 37 hata tipi listeleniyor;
 * kaydırarak aramak üç dokunuş sözünü bozar. Arama kutusu listeyi tek yazışta
 * daraltır. Eşleşme çıkmazsa aynı kutu "bu adla yeni tip ekle" düğmesine
 * dönüşür — denetçi gördüğü hatayı yazar, kaydeder, devam eder. Kod
 * değişikliği beklemek zorunda kalmaz.
 */
export function HataSayfasi({
  denetimId, denetci, taslak, fotograflar, onKapat, onKaydet, onSil,
}: {
  denetimId: string;
  denetci?: string;
  taslak: HataTaslagi | null;
  fotograflar: FotografKaydi[];
  onKapat: () => void;
  onKaydet: (h: HataTaslagi, yeniFotoIdleri: string[]) => void;
  onSil?: (hataId: string) => void;
}) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const ozelTipler = useKatalog((d) => d.ozelTipler);
  const tipEkle = useKatalog((d) => d.ekle);

  const [hataTipiId, setHataTipiId] = useState<string | null>(null);
  const [siddet, setSiddet] = useState<SiddetKodu>('C');
  const [adet, setAdet] = useState('1');
  const [konum, setKonum] = useState('');
  const [aciklama, setAciklama] = useState('');
  const [fotoIdleri, setFotoIdleri] = useState<string[]>([]);
  const [fotoHatasi, setFotoHatasi] = useState<string | null>(null);
  const [fotoYukleniyor, setFotoYukleniyor] = useState(false);
  const [acilanTaslak, setAcilanTaslak] = useState<HataTaslagi | null>(null);
  const [arama, setArama] = useState('');
  const [yeniAcik, setYeniAcik] = useState(false);

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
    setArama('');
    setYeniAcik(false);
  }

  const parca = taslak ? PARCA_INDEKS[taslak.parcaId] : undefined;
  // ozelTipler bağımlılıkta: yeni tip eklendiğinde liste anında tazelensin.
  const tipler = useMemo(
    () => (taslak ? parcaHataTipleri(taslak.parcaId) : []),
    [taslak, ozelTipler],
  );

  const q = arama.trim().toLocaleLowerCase('tr');
  const suzulmus = useMemo(
    () => (q ? tipler.filter((t) => `${t.ad} ${t.en}`.toLocaleLowerCase('tr').includes(q)) : tipler),
    [q, tipler],
  );
  const gruplar = useMemo(() => [...new Set(suzulmus.map((t) => t.grup))], [suzulmus]);
  const duzenleme = !!taslak?.id;

  const tipSec = useCallback((t: HataTipi) => {
    setHataTipiId(t.id);
    if (!duzenleme) setSiddet(t.siddet);
  }, [duzenleme]);

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
          <Text style={s.parcaAd} numberOfLines={1}>{parca?.ad ?? taslak.parcaId}</Text>
          <Text style={s.parcaYol} numberOfLines={1}>{parca?.bolgeAd} · {parca?.en}</Text>
        </View>
        {hataTipiId ? <SiddetRozeti siddet={siddet} buyuk /> : null}
      </View>

      <ScrollView style={s.kaydir} contentContainerStyle={s.kaydirIc} keyboardShouldPersistTaps="handled">
        <Text style={s.bolumBaslik}>HATA TİPİ</Text>

        <TextInput
          value={arama}
          onChangeText={setArama}
          placeholder="Hata ara — gıcırtı, göçük, boşluk…"
          placeholderTextColor={renkler.metinSolgun}
          accessibilityLabel="Hata tipi ara"
          style={s.arama}
          autoCorrect={false}
        />

        {yeniAcik ? (
          <YeniTipFormu
            baslangicAd={arama.trim()}
            izinliGruplar={parca?.gruplar ?? []}
            onVazgec={() => setYeniAcik(false)}
            onEkle={async (girdi) => {
              const t = await tipEkle({ ...girdi, ekleyen: denetci?.trim() ?? '' });
              setYeniAcik(false);
              setArama('');
              tipSec(t);
            }}
          />
        ) : null}

        {!yeniAcik && gruplar.map((g) => (
          <View key={g} style={{ gap: bosluk.xxs }}>
            <Text style={s.grupBaslik}>{HATA_GRUPLARI[g]?.ad ?? g}</Text>
            <View style={s.izgara}>
              {suzulmus.filter((t) => t.grup === g).map((t) => {
                const secili = hataTipiId === t.id;
                return (
                  <Pressable
                    key={t.id}
                    accessibilityRole="radio"
                    aria-checked={secili}
                    accessibilityLabel={`${t.ad}${t.en ? ` (${t.en})` : ''}`}
                    onPress={() => tipSec(t)}
                    style={[s.secenek, secili && s.secenekSecili]}
                  >
                    <View style={s.secenekSatir}>
                      <Text style={[s.secenekAd, secili && { color: renkler.birincil }]} numberOfLines={2}>
                        {t.ad}
                      </Text>
                      {/* Ekip eklemesi olduğu hem işaretle hem metinle belli
                          olsun: yalnız renkle ayırmak erişilebilir değil. */}
                      {t.ozel ? <Text style={s.ozelIsaret}>EKİP</Text> : null}
                    </View>
                    {t.en ? <Text style={s.secenekEn}>{t.en}</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}

        {!yeniAcik && suzulmus.length === 0 ? (
          <Text style={s.bos}>
            {q ? `"${arama.trim()}" listede yok.` : 'Bu parça için tanımlı hata tipi yok.'}
          </Text>
        ) : null}

        {!yeniAcik ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={q ? `"${arama.trim()}" adıyla yeni hata tipi ekle` : 'Yeni hata tipi ekle'}
            onPress={() => setYeniAcik(true)}
            style={[s.yeniDugme, suzulmus.length === 0 && { borderColor: renkler.birincil }]}
          >
            <Text style={s.yeniDugmeMetin}>
              {q ? `+ "${arama.trim()}" adıyla yeni hata tipi ekle` : '+ Yeni hata tipi ekle'}
            </Text>
          </Pressable>
        ) : null}

        <Text style={s.bolumBaslik}>ŞİDDET</Text>
        <View style={s.izgara}>
          {SIDDETLER.map((sd) => {
            const secili = siddet === sd.id;
            return (
              <Pressable
                key={sd.id}
                accessibilityRole="radio"
                aria-checked={secili}
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

/**
 * Yeni hata tipi formu.
 *
 * Grup seçimi PARÇANIN İZİN VERDİĞİ gruplarla sınırlıdır. Aksi hâlde denetçi
 * "cam" grubuna bir tip ekler, kapı sacında aramaya devam eder ve eklediği
 * şeyi bulamaz — eklediğini sanıp kaydetmeden geçer.
 */
function YeniTipFormu({
  baslangicAd, izinliGruplar, onEkle, onVazgec,
}: {
  baslangicAd: string;
  izinliGruplar: HataGrubuId[];
  onEkle: (g: { grup: HataGrubuId; ad: string; en: string; siddet: SiddetKodu }) => Promise<void>;
  onVazgec: () => void;
}) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const [ad, setAd] = useState(baslangicAd);
  const [en, setEn] = useState('');
  const [grup, setGrup] = useState<HataGrubuId | null>(izinliGruplar[0] ?? null);
  const [siddet, setSiddet] = useState<SiddetKodu>('C');
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const gonder = async () => {
    if (!ad.trim() || !grup) return;
    setKaydediliyor(true);
    setHata(null);
    try {
      await onEkle({ grup, ad: ad.trim(), en: en.trim(), siddet });
    } catch (h) {
      setHata(h instanceof Error ? h.message : String(h));
    } finally {
      setKaydediliyor(false);
    }
  };

  return (
    <View style={s.yeniKart}>
      <Text style={s.yeniBaslik}>Yeni hata tipi</Text>
      <Text style={s.yeniNot}>
        Eklediğiniz tip bu parçada ve aynı gruptaki tüm parçalarda kalıcı olarak listelenir.
      </Text>

      {hata ? <HataKutusu metin={hata} /> : null}

      <Girdi etiket="ADI (TÜRKÇE)" value={ad} onChangeText={setAd} placeholder="Ör. Fitil ucu kalkık" />
      <Girdi etiket="İNGİLİZCESİ (RAPOR İÇİN, İSTEĞE BAĞLI)" value={en} onChangeText={setEn} placeholder="Weatherstrip lifted" />

      <Text style={s.alanEtiketi}>GRUP</Text>
      <View style={s.izgara}>
        {izinliGruplar.map((g) => (
          <Pressable
            key={g}
            accessibilityRole="radio"
            aria-checked={grup === g}
            accessibilityLabel={HATA_GRUPLARI[g]?.ad ?? g}
            onPress={() => setGrup(g)}
            style={[s.secenek, { flexBasis: 120 }, grup === g && s.secenekSecili]}
          >
            <Text style={[s.secenekAd, grup === g && { color: renkler.birincil }]}>
              {HATA_GRUPLARI[g]?.ad ?? g}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.alanEtiketi}>ÖNERİLEN ŞİDDET</Text>
      <View style={s.izgara}>
        {SIDDETLER.map((sd) => (
          <Pressable
            key={sd.id}
            accessibilityRole="radio"
            aria-checked={siddet === sd.id}
            // "Önerilen şiddet" öneki ŞART: ana sayfadaki ŞİDDET seçimi de
            // ekranda duruyor, aynı etiketle iki radyo ekran okuyucuda
            // ayırt edilemez.
            accessibilityLabel={`Önerilen şiddet ${sd.ad} — ${sd.puan} puan`}
            onPress={() => setSiddet(sd.id)}
            style={[s.secenek, { flexBasis: 100 }, siddet === sd.id && s.secenekSecili]}
          >
            <Text style={[s.secenekAd, siddet === sd.id && { color: renkler.birincil }]}>
              {sd.id} · {sd.ad}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={s.yeniEylemler}>
        <Dugme metin="Vazgeç" tur="sessiz" kucuk onPress={onVazgec} style={{ flex: 1 }} />
        <Dugme
          metin="Ekle ve seç"
          tur="birincil"
          kucuk
          yukleniyor={kaydediliyor}
          pasif={!ad.trim() || !grup}
          onPress={gonder}
          style={{ flex: 1 }}
        />
      </View>
    </View>
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

  arama: {
    ...tipografi.body, color: r.metin, minHeight: DOKUNMA,
    paddingHorizontal: bosluk.sm, backgroundColor: r.yuzey,
    borderWidth: 1, borderColor: r.cizgi, borderRadius: kose.md,
  },

  izgara: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  secenek: {
    flexGrow: 1, flexBasis: 148, minHeight: DOKUNMA, justifyContent: 'center',
    paddingHorizontal: bosluk.xs, paddingVertical: 6,
    borderRadius: kose.sm, borderWidth: 1, borderColor: r.cizgi, backgroundColor: r.yuzey,
  },
  secenekSecili: { borderColor: r.birincil, backgroundColor: r.birincilYumusak },
  secenekSatir: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  secenekAd: { ...tipografi.captionOrta, color: r.metin, flexShrink: 1 },
  secenekEn: { ...tipografi.caption, color: r.metinSolgun, fontSize: 11 },
  ozelIsaret: {
    ...tipografi.caption, fontSize: 9, color: r.bilgi,
    borderWidth: 1, borderColor: r.bilgi, borderRadius: kose.sm,
    paddingHorizontal: 4, overflow: 'hidden',
  },

  bos: { ...tipografi.body, color: r.metinSolgun, paddingVertical: bosluk.xs },

  yeniDugme: {
    minHeight: DOKUNMA, alignItems: 'center', justifyContent: 'center',
    borderRadius: kose.md, borderWidth: 1, borderStyle: 'dashed',
    borderColor: r.cizgiGuclu, backgroundColor: r.yuzey, paddingHorizontal: bosluk.sm,
  },
  yeniDugmeMetin: { ...tipografi.bodyOrta, color: r.birincil, textAlign: 'center' },

  yeniKart: {
    gap: bosluk.xs, padding: bosluk.sm, borderRadius: kose.md,
    borderWidth: 1, borderColor: r.birincil, backgroundColor: r.birincilYumusak,
  },
  yeniBaslik: { ...tipografi.h3, color: r.metin },
  yeniNot: { ...tipografi.caption, color: r.metinIkincil },
  yeniEylemler: { flexDirection: 'row', gap: bosluk.xs, marginTop: bosluk.xxs },

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
