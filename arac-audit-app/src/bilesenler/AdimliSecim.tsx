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
//
// SORU KARTLARI (25.10.2026, ürün sahibi: "Lumiform'dan esinlen"): 1. adım
// bir kontrol listesi gibi okunur. Üstte "2/5 kontrol edildi" ve ilerleme
// çubuğu; her sistem bir soru kartı, altında iki cevap: "Uygun" (hatasız
// kontrol edildi, yeşil) ve "Hata gir" / "n hata" (kırmızı). Hatası olan
// sistem "Uygun" olamaz, o düğme kilitlenir. Listenin sonunda "Denetimi
// bitir" — Lumiform'da formun sonundaki "tamamla" gibi. Önceki yuvarlak
// onay kutusu kartın İÇİNDE ikinci bir düğmeydi; Android'de ekran okuyucu
// içteki düğmeye hiç ulaşamıyordu (kart erişilebilir bir bütün sayılır).
// Cevaplar artık kartın kardeşi, ayrı ayrı odaklanır.

import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AracHaritasi } from '@/bilesenler/AracHaritasi';
import { DonusGorunumu } from '@/bilesenler/DonusGorunumu';
import { BOLGE_SIMGELERI, S } from '@/bilesenler/simgeler';
import { AramaKutusu, BolumBasligi, Dugme, IlerlemeCubugu } from '@/bilesenler/temel';
import { aramaEslesir } from '@/cekirdek/arama';
import { parcaAramaMetni, parcaBolgeAdi, parcaTamAdi } from '@/cekirdek/katalog';
import { kisaBolgeAdi, sistemAdi, SISTEMLER } from '@/cekirdek/sistemler';
import { Bolge, BolgeGrubu } from '@/cekirdek/tipler';
import { bosluk, DOKUNMA, kose, Renkler, tipografi, useTema } from '@/tema';
import { gorselVar, useAracGorselleri } from '@/veri/aracGorselleri';
import { useDil } from '@/veri/dilDeposu';

export interface Konum { sistem: BolgeGrubu | null; bolgeId: string | null }
export const KOK_KONUM: Konum = { sistem: null, bolgeId: null };

/** İngilizce sayılı ad: "1 record", "3 records" (Türkçede sayıdan sonra ad tekil kalır). */
const enSayi = (n: number, ad: string): string => `${n} ${ad}${n === 1 ? '' : 's'}`;

export function AdimliSecim({
  bolgeler, konum, setKonum, arama, setArama, parcaId, parcaSayilari, sonParcalar, onSec, tablet,
  kapsam, onKapsam, onBitir, aracId,
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
  /** Verilirse sistem listesinin sonunda "Denetimi bitir" çıkar (devam eden denetim). */
  onBitir?: () => void;
  /** Aracın görselleri aktarılmışsa harita yerine döndürülebilir görünüm çıkar (26.10.2026). */
  aracId?: string;
}) {
  const { renkler } = useTema();
  const { dil, t } = useDil();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const gorselleriVar = useAracGorselleri((d) => !!aracId && gorselVar(d.gorseller[aracId]));

  const sistemler = useMemo(
    () => SISTEMLER.map((x) => ({ ...x, bolgeler: bolgeler.filter((b) => b.grup === x.id) })).filter((x) => x.bolgeler.length),
    [bolgeler],
  );
  const sistem = sistemler.find((x) => x.id === konum.sistem) ?? null;
  const kontrolSayisi = sistemler.filter((x) => kapsam.has(x.id)).length;
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
        accessibilityLabel={t(
          `${parcaTamAdi(pid)} (${parcaTamAdi(pid, 'en')})${adet ? `, ${adet} kayıt` : ''}`,
          `${parcaTamAdi(pid, 'en')}${adet ? `, ${enSayi(adet, 'record')}` : ''}`,
        )}
        onPress={() => onSec(pid)}
        style={({ pressed }) => [s.kutu, s.parcaKutu, secili && s.kutuSecili, pressed && s.basili]}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.parcaAd, secili && { color: renkler.birincil }]} numberOfLines={2}>{parcaTamAdi(pid, dil)}</Text>
          {altSatir ? <Text style={s.alt} numberOfLines={1}>{altSatir}</Text> : null}
        </View>
        {adet > 0 ? <View style={s.pul}><Text style={s.pulMetin}>{adet}</Text></View> : null}
      </Pressable>
    );
  };

  // --- Ekmek kırıntısı: hangi adımda olunduğu ve geri dönüş -------------
  const kirintilar: { ad: string; git?: () => void }[] = [
    { ad: t('Sistemler', 'Systems'), git: konum.sistem ? () => setKonum(KOK_KONUM) : undefined },
  ];
  if (sistem) {
    const tekBolge = sistem.bolgeler.length === 1;
    kirintilar.push({ ad: sistemAdi(sistem.id, dil), git: bolge && !tekBolge ? () => setKonum({ sistem: sistem.id, bolgeId: null }) : undefined });
    if (bolge && !tekBolge) kirintilar.push({ ad: kisaBolgeAdi(t(bolge.ad, bolge.en)) });
  }
  const adim = !sistem ? 1 : !bolge ? 2 : 3;
  const adimMetni = adim === 1 ? t('Sistem seçin', 'Select system') : adim === 2 ? t('Bölge seçin', 'Select area') : t('Parça seçin', 'Select part');

  return (
    <View style={s.kap}>
      <View style={s.ust}>
        <AramaKutusu
          deger={arama}
          degistir={setArama}
          yerTutucu={t('Parça ara — kaput, A direği, ön kapı…', 'Search part — hood, A pillar, front door…')}
          erisimEtiketi={t('Parça ara', 'Search part')}
        />
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
                    accessibilityLabel={t(`${k.ad} adımına dön`, `Back to ${k.ad}`)}
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
            <BolumBasligi metin={t(`Arama — ${sonuclar.length} parça`, `Search — ${enSayi(sonuclar.length, 'part')}`)} simge={S.ara} />
            <View style={s.izgara}>{sonuclar.map((p) => parcaKutusu(p.id, parcaBolgeAdi(p.id, dil)))}</View>
            {!sonuclar.length ? <Text style={s.bos}>{t(`“${q}” ile eşleşen parça yok.`, `No part matches “${q}”.`)}</Text> : null}
          </>
        ) : (
          <>
            {adim === 1 && sonParcalar.length ? (
              <View style={{ gap: bosluk.xs }}>
                <BolumBasligi metin={t('Son dokunulanlar', 'Recent parts')} simge={S.son} />
                <View style={s.izgara}>{sonParcalar.map((pid) => parcaKutusu(pid, parcaBolgeAdi(pid, dil)))}</View>
              </View>
            ) : null}

            <View style={s.adimBaslik}>
              <View style={s.adimNo}><Text style={s.adimNoMetin}>{adim}</Text></View>
              <Text style={s.adimMetin}>{adimMetni}</Text>
              {adim === 1 ? (
                <Text style={s.adimSayi}>
                  {t(`${kontrolSayisi}/${sistemler.length} kontrol edildi`, `${kontrolSayisi}/${sistemler.length} checked`)}
                </Text>
              ) : null}
            </View>
            {adim === 1 ? (
              <IlerlemeCubugu
                deger={kontrolSayisi}
                toplam={sistemler.length}
                etiket={t(
                  `Kontrol edilen sistemler ${kontrolSayisi}/${sistemler.length}`,
                  `Systems checked ${kontrolSayisi}/${sistemler.length}`,
                )}
              />
            ) : null}

            {adim === 1 ? (
              <View style={s.izgara}>
                {/* Ürün sahibinin aktardığı araç görselleri varsa şematik
                    haritanın yerine döndürülebilir araç (26.10.2026): parça
                    haritası olan bakışta dokunulan parça doğrudan açılır. */}
                {gorselleriVar && aracId ? (
                  <DonusGorunumu
                    key={aracId}
                    aracId={aracId}
                    bolgeler={bolgeler}
                    kayitliParcalar={parcaSayilari}
                    seciliParcaId={parcaId}
                    onBolgeSec={(bolgeId) => setKonum({ sistem: 'dis', bolgeId })}
                    onParcaSec={onSec}
                  />
                ) : (
                  <AracHaritasi
                    bolgeler={disBolgeler}
                    sayilar={bolgeSayilari}
                    onSec={(bolgeId) => setKonum({ sistem: 'dis', bolgeId })}
                  />
                )}
                {sistemler.map((x) => {
                  const Ikon = BOLGE_SIMGELERI[x.id];
                  const ad = sistemAdi(x.id, dil);
                  const n = x.bolgeler.reduce((t, b) => t + kayit(b), 0);
                  const parcaSayisi = x.bolgeler.reduce((t, b) => t + b.parcalar.length, 0);
                  const isaretli = kapsam.has(x.id);
                  // "Uygun" = hatasız kontrol edildi. Hata varsa sistem zaten
                  // kontrol edilmiştir (kayıt işareti kendiliğinden koyar) ama
                  // "uygun" değildir.
                  const uygun = isaretli && !n;
                  return (
                    <View key={x.id} style={s.soru}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t(
                          `Sistem ${ad}${n ? `, ${n} kayıt` : ''}${isaretli ? ', kontrol edildi' : ''}`,
                          `System ${ad}${n ? `, ${enSayi(n, 'record')}` : ''}${isaretli ? ', checked' : ''}`,
                        )}
                        onPress={() => sistemSec(x.id)}
                        style={({ pressed }) => [s.soruUst, pressed && s.basili]}
                      >
                        <View style={s.simgeYuva}>{Ikon ? <Ikon size={24} color={renkler.birincil} strokeWidth={2} /> : null}</View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={s.buyukAd} numberOfLines={1}>{ad}</Text>
                          {/* Türkçede alt satırda sistemin İngilizce adı durur; İngilizcede
                              başlık zaten o ad, alt satırda yalnız sayı kalır. */}
                          <Text style={s.alt} numberOfLines={1}>
                            {t(
                              `${x.en} · ${x.bolgeler.length > 1 ? `${x.bolgeler.length} bölge` : `${parcaSayisi} madde`}`,
                              x.bolgeler.length > 1 ? enSayi(x.bolgeler.length, 'area') : enSayi(parcaSayisi, 'item'),
                            )}
                          </Text>
                        </View>
                        <S.ileri size={20} color={renkler.metinSolgun} strokeWidth={2} />
                      </Pressable>
                      <View style={s.cevaplar}>
                        <Pressable
                          accessibilityRole="checkbox"
                          aria-checked={uygun}
                          accessibilityState={{ checked: uygun, disabled: n > 0 }}
                          accessibilityLabel={t(`${ad} uygun`, `${ad} OK`)}
                          disabled={n > 0}
                          onPress={() => onKapsam(x.id, !isaretli)}
                          style={({ pressed }) => [s.cevap, uygun && s.cevapUygun, n > 0 && s.cevapKilitli, pressed && s.basili]}
                        >
                          <S.tik size={16} color={uygun ? renkler.basari : renkler.metinIkincil} strokeWidth={2.5} />
                          <Text style={[s.cevapMetin, uygun && { color: renkler.basari }]}>{t('Uygun', 'OK')}</Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={n
                            ? t(`${ad}: ${n} hata, aç`, `${ad}: ${enSayi(n, 'defect')}, open`)
                            : t(`${ad}: hata gir`, `${ad}: add defect`)}
                          onPress={() => sistemSec(x.id)}
                          style={({ pressed }) => [s.cevap, n > 0 && s.cevapHata, pressed && s.basili]}
                        >
                          {n
                            ? <S.uyari size={16} color={renkler.tehlike} strokeWidth={2.25} />
                            : <S.ekle size={16} color={renkler.metinIkincil} strokeWidth={2.25} />}
                          <Text style={[s.cevapMetin, n > 0 && { color: renkler.tehlike }]}>
                            {n ? t(`${n} hata`, enSayi(n, 'defect')) : t('Hata gir', 'Add defect')}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
                {onBitir ? (
                  <Dugme
                    metin={t('Denetimi bitir', 'Finish audit')}
                    tur="birincil"
                    simge={S.tamam}
                    onPress={onBitir}
                    erisimEtiketi={t('Denetimi bitir: özeti gör ve onayla', 'Finish audit: review summary and confirm')}
                    style={{ flexBasis: '100%', marginTop: bosluk.xs }}
                  />
                ) : null}
              </View>
            ) : adim === 2 && sistem ? (
              <View style={s.izgara}>
                {sistem.bolgeler.map((b) => {
                  const n = kayit(b);
                  const ad = kisaBolgeAdi(t(b.ad, b.en));
                  return (
                    <Pressable
                      key={b.id}
                      accessibilityRole="button"
                      accessibilityLabel={t(`Bölge ${ad}${n ? `, ${n} kayıt` : ''}`, `Area ${ad}${n ? `, ${enSayi(n, 'record')}` : ''}`)}
                      onPress={() => setKonum({ sistem: sistem.id, bolgeId: b.id })}
                      style={({ pressed }) => [s.kutu, s.buyukKutu, pressed && s.basili]}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.buyukAd} numberOfLines={1}>{ad}</Text>
                        <Text style={s.alt} numberOfLines={1}>{t(`${b.parcalar.length} parça`, enSayi(b.parcalar.length, 'part'))}</Text>
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
  adimSayi: { ...tipografi.captionOrta, color: r.metinIkincil, marginLeft: 'auto', fontVariant: ['tabular-nums'] },
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
  // Soru kartı: üstte sistem (dokununca açılır), altta iki cevap.
  soru: {
    flexBasis: '100%', gap: bosluk.xs, padding: bosluk.sm,
    borderRadius: kose.lg, borderWidth: 1, borderColor: r.cizgi, backgroundColor: r.yuzey,
  },
  soruUst: { flexDirection: 'row', alignItems: 'center', gap: bosluk.sm, minHeight: DOKUNMA },
  cevaplar: { flexDirection: 'row', gap: bosluk.xs },
  cevap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    minHeight: DOKUNMA, borderRadius: kose.md, borderWidth: 1, borderColor: r.cizgi, backgroundColor: r.yuzey,
  },
  cevapUygun: { borderColor: r.basari, backgroundColor: r.basariYumusak },
  cevapHata: { borderColor: r.tehlike, backgroundColor: r.tehlikeYumusak },
  cevapKilitli: { opacity: 0.4 },
  cevapMetin: { ...tipografi.bodyOrta, fontSize: 14, color: r.metin },
  bos: { ...tipografi.body, color: r.metinSolgun, textAlign: 'center', paddingVertical: bosluk.lg },
});
