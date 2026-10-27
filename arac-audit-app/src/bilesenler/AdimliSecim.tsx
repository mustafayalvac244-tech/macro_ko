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
import { aramaYakinEslesir, esnekSuz } from '@/cekirdek/arama';
import { cizimVar } from '@/cekirdek/donusGorunumu';
import { parcaAdMetni, parcaAramaMetni, parcaBolgeAdi, parcaTamAdi } from '@/cekirdek/katalog';
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
  bolgeler, konum, setKonum, arama, setArama, parcaId, parcaSayilari, parcaDemeritleri, parcaKayitSayilari, sonParcalar, onSec, tablet,
  kapsam, onKapsam, onBitir, aracId, onBuyut, ikinciParcaId,
}: {
  bolgeler: Bolge[];
  konum: Konum;
  setKonum: (k: Konum) => void;
  arama: string;
  setArama: (q: string) => void;
  parcaId: string | null;
  /** Açık kaydın ikinci parçası (boşluk/kademe); döndürülebilir kart ikisini de gösterir. */
  ikinciParcaId?: string | null;
  parcaSayilari: Map<string, number>;
  /** Parça → en yüksek demerit; araç görünümü bununla boyar. */
  parcaDemeritleri: ReadonlyMap<string, number>;
  /** Parça → kayıt sayısı (iki parça arası ikisinde de); işaretin rakamı. */
  parcaKayitSayilari?: ReadonlyMap<string, number>;
  sonParcalar: string[];
  /** Parça seçildi; döndürülebilir görünümde ikinci parça da seçilmişse (boşluk/kademe) onunla. */
  onSec: (parcaId: string, ikinciParcaId?: string) => void;
  tablet: boolean;
  /** Kontrol edildi işaretli sistemler. */
  kapsam: ReadonlySet<string>;
  onKapsam: (sistem: BolgeGrubu, isaretli: boolean) => void;
  /** Verilirse sistem listesinin sonunda "Denetimi bitir" çıkar (devam eden denetim). */
  onBitir?: () => void;
  /**
   * Aracın görselleri aktarılmışsa YA DA parça haritası varsa (IONIQ 3) şematik
   * harita yerine döndürülebilir görünüm çıkar (26.10.2026: "360 seçim ekranında
   * olmalı" — görsel yüklemeden de).
   */
  aracId?: string;
  /** Verilirse döndürülebilir görünüm kart kipindedir: araca dokunuş büyük görünümü açar (26.10.2026). */
  onBuyut?: () => void;
}) {
  const { renkler } = useTema();
  const { dil, t } = useDil();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const gorselleriVar = useAracGorselleri((d) => !!aracId && gorselVar(d.gorseller[aracId]));
  const donusVar = gorselleriVar || (!!aracId && cizimVar(aracId));

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
    // Esnek: sonuç yoksa "LH", "PNL", "AREA" gibi Excel ekleri atlanarak (arama.ts).
    () => (q ? esnekSuz(bolgeler.flatMap((b) => b.parcalar), (p) => parcaAramaMetni(p.id), q, (p) => parcaAdMetni(p.id)) : []),
    [bolgeler, q],
  );
  // Tam eşleşme yoksa yazım hatasına dayanıklı arama (arama.ts) — ayrı başlıkla.
  const yakinSonuclar = useMemo(
    () => (q && !sonuclar.length
      ? bolgeler.flatMap((b) => b.parcalar.filter((p) => aramaYakinEslesir(parcaAramaMetni(p.id), q))).slice(0, 24)
      : []),
    [bolgeler, q, sonuclar.length],
  );

  // Görünmez dolgu: son satırdaki tek parça karosu bütün satıra yayılmasın
  // (26.10.2026, ikinci tasarım incelemesi; denetim ekranındaki hata ızgarasıyla aynı).
  const dolgu = [0, 1, 2].map((i) => (
    <View key={`dolgu${i}`} style={s.dolgu} aria-hidden importantForAccessibility="no-hide-descendants" />
  ));

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
                    hitSlop={4}
                    style={({ pressed }) => [s.kirinti, pressed && s.basili]}
                  >
                    {i === 0 ? <S.geri size={16} color={renkler.birincil} strokeWidth={2.25} /> : null}
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
            {sonuclar.length || !yakinSonuclar.length ? (
              <>
                <BolumBasligi metin={t(`Arama — ${sonuclar.length} parça`, `Search — ${enSayi(sonuclar.length, 'part')}`)} simge={S.ara} />
                <View style={s.izgara}>{sonuclar.map((p) => parcaKutusu(p.id, parcaBolgeAdi(p.id, dil)))}{dolgu}</View>
                {!sonuclar.length ? <Text style={s.bos}>{t(`“${q}” ile eşleşen parça yok.`, `No part matches “${q}”.`)}</Text> : null}
              </>
            ) : (
              <>
                <BolumBasligi metin={t(`“${q}” yok — yakın yazılışlar (${yakinSonuclar.length})`, `No “${q}” — close spellings (${yakinSonuclar.length})`)} simge={S.ara} />
                <View style={s.izgara} testID="arama-yakin">{yakinSonuclar.map((p) => parcaKutusu(p.id, parcaBolgeAdi(p.id, dil)))}{dolgu}</View>
              </>
            )}
          </>
        ) : (
          <>
            {adim === 1 && sonParcalar.length ? (
              <View style={{ gap: bosluk.xs }}>
                <BolumBasligi metin={t('Son dokunulanlar', 'Recent parts')} simge={S.son} />
                <View style={s.izgara}>{sonParcalar.map((pid) => parcaKutusu(pid, parcaBolgeAdi(pid, dil)))}{dolgu}</View>
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
                {/* Aracın parça haritası (IONIQ 3) ya da aktarılmış görseli
                    varsa şematik haritanın yerine döndürülebilir araç
                    (26.10.2026): görsel yoksa harita çizilir, dokunulan parça
                    doğrudan açılır. */}
                {donusVar && aracId ? (
                  <DonusGorunumu
                    key={aracId}
                    aracId={aracId}
                    bolgeler={bolgeler}
                    kayitliParcalar={parcaDemeritleri}
                    kayitSayilari={parcaKayitSayilari}
                    seciliParcaId={parcaId}
                    seciliIkinciParcaId={ikinciParcaId}
                    onBolgeSec={(bolgeId) => setKonum({ sistem: 'dis', bolgeId })}
                    onParcaSec={onSec}
                    onBuyut={onBuyut}
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
                  // İşareti yalnız denetçi koyar (26.10.2026). Hatasız sistemde kutunun
                  // adı "Uygun", hatalı sistemde "Kontrol edildi" (bakıldı, bitti).
                  const kutuAdi = n ? t('Kontrol edildi', 'Checked') : t('Uygun', 'OK');
                  // Tek satır (26.10.2026, dış değerlendirme: "her sistem kartında iki büyük
                  // düğme, ekranda 10 eşit ağırlıkta düğme"). Satıra dokunmak sistemi açar
                  // (eski "Hata gir"in işi); sağdaki hücre durumu taşır: hata varsa kırmızı
                  // sayı, yoksa "Uygun" onay kutusu.
                  return (
                    <View key={x.id} style={s.sistemSatir}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t(
                          `Sistem ${ad}${n ? `, ${n} kayıt` : ''}${isaretli ? ', kontrol edildi' : ''}`,
                          `System ${ad}${n ? `, ${enSayi(n, 'record')}` : ''}${isaretli ? ', checked' : ''}`,
                        )}
                        onPress={() => sistemSec(x.id)}
                        style={({ pressed }) => [s.sistemAc, pressed && s.basili]}
                      >
                        <View style={s.simgeYuva}>{Ikon ? <Ikon size={22} color={renkler.birincil} strokeWidth={2} /> : null}</View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          {/* Hata pulu adın yanında: alt satırı ("6 bölge · 86 madde")
                              telefonda kesmesin (26.10.2026 ekran görüntüsü). */}
                          <View style={s.adSatiri}>
                            <Text style={[s.buyukAd, { flexShrink: 1 }]} numberOfLines={1}>{ad}</Text>
                            {n > 0 ? (
                              <View style={s.hataPulu} accessibilityLabel={t(`${ad}: ${n} hata`, `${ad}: ${enSayi(n, 'defect')}`)}>
                                <Text style={s.hataPuluMetin}>{t(`${n} hata`, enSayi(n, 'defect'))}</Text>
                              </View>
                            ) : null}
                          </View>
                          {/* Türkçe kipte İngilizce alt yazı yok (dış değerlendirme: tek dil);
                              birim hep "madde". */}
                          <Text style={s.alt} numberOfLines={1}>
                            {x.bolgeler.length > 1
                              ? t(`${x.bolgeler.length} bölge · ${parcaSayisi} madde`, `${enSayi(x.bolgeler.length, 'area')} · ${enSayi(parcaSayisi, 'item')}`)
                              : t(`${parcaSayisi} madde`, enSayi(parcaSayisi, 'item'))}
                          </Text>
                        </View>
                        <S.ileri size={20} color={renkler.metinSolgun} strokeWidth={2} />
                      </Pressable>
                      <Pressable
                        accessibilityRole="checkbox"
                        aria-checked={isaretli}
                        accessibilityState={{ checked: isaretli }}
                        accessibilityLabel={n ? t(`${ad} kontrol edildi`, `${ad} checked`) : t(`${ad} uygun`, `${ad} OK`)}
                        onPress={() => onKapsam(x.id, !isaretli)}
                        style={({ pressed }) => [s.durumHucre, isaretli && s.durumUygun, pressed && s.basili]}
                      >
                        <View style={[s.onayKutu, isaretli && s.onayKutuDolu]}>
                          {isaretli ? <S.tik size={16} color={renkler.metinTers} strokeWidth={3} /> : null}
                        </View>
                        <Text style={[s.durumMetin, { color: isaretli ? renkler.basari : renkler.metinIkincil, textAlign: 'center' }]}>{kutuAdi}</Text>
                      </Pressable>
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
                        <Text style={s.alt} numberOfLines={1}>{t(`${b.parcalar.length} madde`, enSayi(b.parcalar.length, 'item'))}</Text>
                      </View>
                      {n ? <View style={s.pul}><Text style={s.pulMetin}>{n}</Text></View> : null}
                      <S.ileri size={20} color={renkler.metinSolgun} strokeWidth={2} />
                    </Pressable>
                  );
                })}
              </View>
            ) : bolge ? (
              <View style={s.izgara}>{bolge.parcalar.map((p) => parcaKutusu(p.id))}{dolgu}</View>
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
  // Kırıntılar eldivenle basılacak düğme (26.10.2026 dış değerlendirme: 59×22 ve
  // 19×22 px ölçülmüştü, altı çizili web bağlantısı gibiydi). 40 px + 4 px pay = 48.
  kirintiSatir: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, minHeight: 40 },
  kirinti: {
    flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 40, minWidth: 56,
    paddingHorizontal: bosluk.sm, borderRadius: kose.md, backgroundColor: r.birincilYumusak, justifyContent: 'center',
  },
  kirintiGeri: { ...tipografi.bodyOrta, fontSize: 14, color: r.birincil },
  kirintiSon: { ...tipografi.bodyOrta, fontSize: 14, color: r.metin, paddingHorizontal: 4 },
  govde: { paddingHorizontal: bosluk.md, paddingBottom: 140, gap: bosluk.sm },
  adimBaslik: { flexDirection: 'row', alignItems: 'center', gap: bosluk.xs, marginTop: bosluk.xxs },
  adimNo: {
    width: 22, height: 22, borderRadius: kose.pill, backgroundColor: r.birincilDolgu,
    alignItems: 'center', justifyContent: 'center',
  },
  adimNoMetin: { ...tipografi.captionOrta, color: r.birincilDolguMetin, fontVariant: ['tabular-nums'] },
  adimMetin: { ...tipografi.h3, fontSize: 16, lineHeight: 22, color: r.metin },
  adimSayi: { ...tipografi.captionOrta, color: r.metinIkincil, marginLeft: 'auto', fontVariant: ['tabular-nums'] },
  izgara: { flexDirection: 'row', flexWrap: 'wrap', gap: bosluk.xs },
  // Çerçevesiz ton dolgu; seçili: seçili-durum dili (temel.tsx Secenek).
  kutu: {
    flexDirection: 'row', alignItems: 'center', gap: bosluk.sm,
    borderRadius: kose.md, borderWidth: 2, borderColor: r.yuzeyAlt, backgroundColor: r.yuzeyAlt,
    paddingHorizontal: bosluk.sm,
  },
  kutuSecili: { borderColor: r.birincil, backgroundColor: r.birincilYumusak },
  buyukKutu: { flexGrow: 1, flexBasis: '100%', minHeight: 64, paddingVertical: bosluk.xs },
  parcaKutu: { flexGrow: 1, flexBasis: 150, minHeight: Math.max(DOKUNMA, 56), paddingVertical: 6 },
  dolgu: { flexGrow: 1, flexBasis: 150, height: 0 },
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
  // Sistem satırı: çerçevesiz ton dolgu; solda açılan alan, sağda durum hücresi.
  sistemSatir: {
    flexBasis: '100%', flexDirection: 'row', alignItems: 'stretch',
    borderRadius: kose.lg, backgroundColor: r.yuzeyAlt, overflow: 'hidden', minHeight: 64,
  },
  sistemAc: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: bosluk.sm, paddingHorizontal: bosluk.sm, paddingVertical: bosluk.xs },
  durumHucre: {
    width: 92, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: bosluk.xs,
    borderLeftWidth: 1, borderLeftColor: r.bgYukseltilmis,
  },
  durumUygun: { backgroundColor: r.basariYumusak },
  adSatiri: { flexDirection: 'row', alignItems: 'center', gap: bosluk.xs },
  hataPulu: { paddingHorizontal: bosluk.xs, paddingVertical: 3, borderRadius: kose.pill, backgroundColor: r.tehlikeYumusak },
  hataPuluMetin: { ...tipografi.captionOrta, color: r.tehlike, fontVariant: ['tabular-nums'] },
  durumMetin: { ...tipografi.captionOrta },
  onayKutu: {
    width: 24, height: 24, borderRadius: kose.sm, borderWidth: 2, borderColor: r.cizgiGuclu,
    alignItems: 'center', justifyContent: 'center',
  },
  onayKutuDolu: { backgroundColor: r.basari, borderColor: r.basari },
  bos: { ...tipografi.body, color: r.metinSolgun, textAlign: 'center', paddingVertical: bosluk.lg },
});
