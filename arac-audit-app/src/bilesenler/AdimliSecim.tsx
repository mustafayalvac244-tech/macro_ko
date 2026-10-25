// ADIM ADIM PARÇA SEÇİMİ — Sistem → Bölge → Parça.
//
// Ürün sahibi, 24.10.2026: "Profesyonel bir şey olsun. Hata gir diye ekran
// olsun, seçe seçe ilerlesinler, en dıştan, hızlı hızlı girebilmek için."
// Şirketteki Excel formu da System (EXTERIOR) → parça → problem sırasıyla
// ilerliyor. Önceki ekran 169 parçalık tek uzun listeydi; aramayı bilmeyen
// denetçi kaydırarak arıyordu.
//
// HIZ: konum (sistem + bölge) ÜST BİLEŞENDE tutulur ve kayıttan sonra
// silinmez — kayıt bitince ekran aynı bölgenin parçalarına döner; aynı
// bölgede ikinci hata parça + hata = iki dokunuş. Tek bölgeli sistemde
// (Motor, Fonksiyon, Yol testi) bölge adımı atlanır. Arama kutusu her adımda
// durur: parçayı bilen yazıp doğrudan seçer.
//
// KAPSAM VE HARİTA (24.10.2026, benzer uygulamaların incelenmesi): her
// sistem kartında "kontrol edildi" işareti (sistemler.ts'teki not); 1. adımda
// dış bölgelere dokunulan şematik araç haritası (AracHaritasi.tsx).

import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AracHaritasi } from '@/bilesenler/AracHaritasi';
import { BOLGE_SIMGELERI, S } from '@/bilesenler/simgeler';
import { AramaKutusu, BolumBasligi } from '@/bilesenler/temel';
import { aramaEslesir } from '@/cekirdek/arama';
import { PARCA_INDEKS, parcaAramaMetni, parcaTamAdi } from '@/cekirdek/katalog';
import { kisaBolgeAdi, SISTEMLER } from '@/cekirdek/sistemler';
import { Bolge, BolgeGrubu } from '@/cekirdek/tipler';
import { bosluk, DOKUNMA, kose, Renkler, tipografi, useTema } from '@/tema';

export interface Konum { sistem: BolgeGrubu | null; bolgeId: string | null }
export const KOK_KONUM: Konum = { sistem: null, bolgeId: null };

export function AdimliSecim({
  bolgeler, konum, setKonum, arama, setArama, parcaId, parcaSayilari, sonParcalar, onSec, tablet,
  kapsam, onKapsam,
}: {
  bolgeler: Bolge[];
  konum: Konum;
  setKonum: (k: Konum) => void;
  arama: string;
  setArama: (q: string) => void;
  parcaId: string | null;
  parcaSayilari: Map<string, number>;
  sonParcalar: string[];
  onSec: (parcaId: string) => void;
  tablet: boolean;
  /** Kontrol edildi işaretli sistemler. */
  kapsam: ReadonlySet<string>;
  onKapsam: (sistem: BolgeGrubu, isaretli: boolean) => void;
}) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);

  const sistemler = useMemo(
    () => SISTEMLER.map((x) => ({ ...x, bolgeler: bolgeler.filter((b) => b.grup === x.id) })).filter((x) => x.bolgeler.length),
    [bolgeler],
  );
  const sistem = sistemler.find((x) => x.id === konum.sistem) ?? null;
  // Araç değişince bölge yeni araçta olmayabilir: o zaman sistem adımına düşülür.
  const bolge = sistem?.bolgeler.find((b) => b.id === konum.bolgeId) ?? null;
  const kayit = (b: Bolge) => b.parcalar.reduce((t, p) => t + (parcaSayilari.get(p.id) ?? 0), 0);
  const disBolgeler = useMemo(() => bolgeler.filter((b) => b.grup === 'dis'), [bolgeler]);
  const bolgeSayilari = useMemo(
    () => new Map(disBolgeler.map((b) => [b.id, kayit(b)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disBolgeler, parcaSayilari],
  );

  const sistemSec = (id: BolgeGrubu) => {
    const tek = sistemler.find((x) => x.id === id)?.bolgeler;
    setKonum({ sistem: id, bolgeId: tek?.length === 1 ? tek[0]!.id : null });
  };

  const q = arama.trim();
  const sonuclar = useMemo(
    () => (q ? bolgeler.flatMap((b) => b.parcalar.filter((p) => aramaEslesir(parcaAramaMetni(p.id), q))) : []),
    [bolgeler, q],
  );

  const parcaKutusu = (pid: string, altSatir?: string) => {
    const adet = parcaSayilari.get(pid) ?? 0;
    const secili = tablet && pid === parcaId;
    return (
      <Pressable
        key={pid}
        accessibilityRole={tablet ? 'radio' : 'button'}
        aria-checked={tablet ? secili : undefined}
        accessibilityLabel={`${parcaTamAdi(pid)} (${parcaTamAdi(pid, 'en')})${adet ? `, ${adet} kayıt` : ''}`}
        onPress={() => onSec(pid)}
        style={({ pressed }) => [s.kutu, s.parcaKutu, secili && s.kutuSecili, pressed && s.basili]}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.parcaAd, secili && { color: renkler.birincil }]} numberOfLines={2}>{parcaTamAdi(pid)}</Text>
          {altSatir ? <Text style={s.alt} numberOfLines={1}>{altSatir}</Text> : null}
        </View>
        {adet > 0 ? <View style={s.pul}><Text style={s.pulMetin}>{adet}</Text></View> : null}
      </Pressable>
    );
  };

  // --- Ekmek kırıntısı: hangi adımda olunduğu ve geri dönüş -------------
  const kirintilar: { ad: string; git?: () => void }[] = [
    { ad: 'Sistemler', git: konum.sistem ? () => setKonum(KOK_KONUM) : undefined },
  ];
  if (sistem) {
    const tekBolge = sistem.bolgeler.length === 1;
    kirintilar.push({ ad: sistem.ad, git: bolge && !tekBolge ? () => setKonum({ sistem: sistem.id, bolgeId: null }) : undefined });
    if (bolge && !tekBolge) kirintilar.push({ ad: kisaBolgeAdi(bolge.ad) });
  }
  const adim = !sistem ? 1 : !bolge ? 2 : 3;
  const adimMetni = adim === 1 ? 'Sistem seçin' : adim === 2 ? 'Bölge seçin' : 'Parça seçin';

  return (
    <View style={s.kap}>
      <View style={s.ust}>
        <AramaKutusu deger={arama} degistir={setArama} yerTutucu="Parça ara — kaput, A direği, ön kapı…" erisimEtiketi="Parça ara" />
        {/* Kök adımda tek kırıntı ("Sistemler") başlığı tekrar ediyordu; yalnız
            içeri girince gösterilir (25.10.2026 ekran incelemesi). */}
        {!q && kirintilar.length > 1 ? (
          <View style={s.kirintiSatir} accessibilityRole="header">
            {kirintilar.map((k, i) => (
              <React.Fragment key={k.ad}>
                {i > 0 ? <S.ileri size={14} color={renkler.metinSolgun} strokeWidth={2} /> : null}
                {k.git ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${k.ad} adımına dön`}
                    onPress={k.git}
                    hitSlop={8}
                    style={({ pressed }) => [s.kirinti, pressed && s.basili]}
                  >
                    <Text style={s.kirintiGeri} numberOfLines={1}>{k.ad}</Text>
                  </Pressable>
                ) : (
                  <Text style={s.kirintiSon} numberOfLines={1}>{k.ad}</Text>
                )}
              </React.Fragment>
            ))}
          </View>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={s.govde} keyboardShouldPersistTaps="handled">
        {q ? (
          <>
            <BolumBasligi metin={`Arama — ${sonuclar.length} parça`} simge={S.ara} />
            <View style={s.izgara}>{sonuclar.map((p) => parcaKutusu(p.id, PARCA_INDEKS[p.id]?.bolgeAd))}</View>
            {!sonuclar.length ? <Text style={s.bos}>“{q}” ile eşleşen parça yok.</Text> : null}
          </>
        ) : (
          <>
            {adim === 1 && sonParcalar.length ? (
              <View style={{ gap: bosluk.xs }}>
                <BolumBasligi metin="Son dokunulanlar" simge={S.son} />
                <View style={s.izgara}>{sonParcalar.map((pid) => parcaKutusu(pid, PARCA_INDEKS[pid]?.bolgeAd))}</View>
              </View>
            ) : null}

            <View style={s.adimBaslik}>
              <View style={s.adimNo}><Text style={s.adimNoMetin}>{adim}</Text></View>
              <Text style={s.adimMetin}>{adimMetni}</Text>
            </View>

            {adim === 1 ? (
              <View style={s.izgara}>
                <AracHaritasi
                  bolgeler={disBolgeler}
                  sayilar={bolgeSayilari}
                  onSec={(bolgeId) => setKonum({ sistem: 'dis', bolgeId })}
                />
                {sistemler.map((x) => {
                  const Ikon = BOLGE_SIMGELERI[x.id];
                  const n = x.bolgeler.reduce((t, b) => t + kayit(b), 0);
                  const parcaSayisi = x.bolgeler.reduce((t, b) => t + b.parcalar.length, 0);
                  const isaretli = kapsam.has(x.id);
                  return (
                    <Pressable
                      key={x.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Sistem ${x.ad}${n ? `, ${n} kayıt` : ''}${isaretli ? ', kontrol edildi' : ''}`}
                      onPress={() => sistemSec(x.id)}
                      style={({ pressed }) => [s.kutu, s.buyukKutu, pressed && s.basili]}
                    >
                      <View style={s.simgeYuva}>{Ikon ? <Ikon size={24} color={renkler.birincil} strokeWidth={2} /> : null}</View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.buyukAd} numberOfLines={1}>{x.ad}</Text>
                        <Text style={[s.alt, isaretli && { color: renkler.basari }]} numberOfLines={1}>
                          {isaretli
                            ? 'Kontrol edildi'
                            : `${x.en} · ${x.bolgeler.length > 1 ? `${x.bolgeler.length} bölge` : `${parcaSayisi} madde`}`}
                        </Text>
                      </View>
                      {n ? <View style={s.pul}><Text style={s.pulMetin}>{n}</Text></View> : null}
                      {/* Kontrol edildi işareti: hatasız sistemi "bakıldı" diye
                          kaydetmenin tek yolu. Hata kaydedilince kendiliğinden konur. */}
                      <Pressable
                        accessibilityRole="checkbox"
                        aria-checked={isaretli}
                        accessibilityLabel={`${x.ad} kontrol edildi`}
                        onPress={() => onKapsam(x.id, !isaretli)}
                        hitSlop={6}
                        style={({ pressed }) => [s.isaret, isaretli && s.isaretli, pressed && s.basili]}
                      >
                        <S.tik size={18} color={isaretli ? renkler.metinTers : renkler.metinSolgun} strokeWidth={2.5} />
                      </Pressable>
                      <S.ileri size={20} color={renkler.metinSolgun} strokeWidth={2} />
                    </Pressable>
                  );
                })}
              </View>
            ) : adim === 2 && sistem ? (
              <View style={s.izgara}>
                {sistem.bolgeler.map((b) => {
                  const n = kayit(b);
                  return (
                    <Pressable
                      key={b.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Bölge ${kisaBolgeAdi(b.ad)}${n ? `, ${n} kayıt` : ''}`}
                      onPress={() => setKonum({ sistem: sistem.id, bolgeId: b.id })}
                      style={({ pressed }) => [s.kutu, s.buyukKutu, pressed && s.basili]}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.buyukAd} numberOfLines={1}>{kisaBolgeAdi(b.ad)}</Text>
                        <Text style={s.alt} numberOfLines={1}>{b.parcalar.length} parça</Text>
                      </View>
                      {n ? <View style={s.pul}><Text style={s.pulMetin}>{n}</Text></View> : null}
                      <S.ileri size={20} color={renkler.metinSolgun} strokeWidth={2} />
                    </Pressable>
                  );
                })}
              </View>
            ) : bolge ? (
              <View style={s.izgara}>{bolge.parcalar.map((p) => parcaKutusu(p.id))}</View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const stiller = (r: Renkler) => StyleSheet.create({
  basili: { opacity: 0.72 },
  kap: { flex: 1, backgroundColor: r.bgYukseltilmis },
  ust: { gap: bosluk.xs, paddingHorizontal: bosluk.md, paddingTop: bosluk.sm, paddingBottom: bosluk.xs },
  kirintiSatir: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, minHeight: 28 },
  kirinti: { paddingVertical: 2 },
  kirintiGeri: { ...tipografi.captionOrta, color: r.birincil, textDecorationLine: 'underline' },
  kirintiSon: { ...tipografi.captionOrta, color: r.metin },
  govde: { paddingHorizontal: bosluk.md, paddingBottom: 140, gap: bosluk.sm },
  adimBaslik: { flexDirection: 'row', alignItems: 'center', gap: bosluk.xs, marginTop: bosluk.xxs },
  adimNo: {
    width: 22, height: 22, borderRadius: kose.pill, backgroundColor: r.birincil,
    alignItems: 'center', justifyContent: 'center',
  },
  adimNoMetin: { ...tipografi.captionOrta, color: r.metinTers, fontVariant: ['tabular-nums'] },
  adimMetin: { ...tipografi.h3, fontSize: 16, lineHeight: 22, color: r.metin },
  izgara: { flexDirection: 'row', flexWrap: 'wrap', gap: bosluk.xs },
  kutu: {
    flexDirection: 'row', alignItems: 'center', gap: bosluk.sm,
    borderRadius: kose.md, borderWidth: 1, borderColor: r.cizgi, backgroundColor: r.yuzey,
    paddingHorizontal: bosluk.sm,
  },
  kutuSecili: { borderColor: r.birincil, backgroundColor: r.birincilYumusak },
  buyukKutu: { flexGrow: 1, flexBasis: '100%', minHeight: 64, paddingVertical: bosluk.xs },
  parcaKutu: { flexGrow: 1, flexBasis: 150, minHeight: Math.max(DOKUNMA, 56), paddingVertical: 6 },
  simgeYuva: {
    width: 40, height: 40, borderRadius: kose.md, backgroundColor: r.birincilYumusak,
    alignItems: 'center', justifyContent: 'center',
  },
  buyukAd: { ...tipografi.h3, color: r.metin },
  parcaAd: { ...tipografi.bodyOrta, color: r.metin },
  alt: { ...tipografi.caption, color: r.metinSolgun },
  pul: {
    minWidth: 26, height: 24, paddingHorizontal: 7, borderRadius: kose.pill,
    alignItems: 'center', justifyContent: 'center', backgroundColor: r.yuzeyVurgu,
  },
  pulMetin: { ...tipografi.captionOrta, color: r.metin, fontVariant: ['tabular-nums'] },
  isaret: {
    width: 36, height: 36, borderRadius: kose.pill, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: r.cizgiGuclu, backgroundColor: r.yuzey,
  },
  isaretli: { backgroundColor: r.basari, borderColor: r.basari },
  bos: { ...tipografi.body, color: r.metinSolgun, textAlign: 'center', paddingVertical: bosluk.lg },
});
