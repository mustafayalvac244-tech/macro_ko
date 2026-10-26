// DÖNDÜRÜLEBİLİR ARAÇ (360°) — standart bakışlar arasında döndürme, parçaya dokunma.
//
// Ürün sahibi, 26.10.2026: "Hyundai sitelerinde aracı döndürebiliyoruz; araç
// üstünden parça seçmek için ekleyebilir miyiz?" ve "sol ön garnişe
// tıklayınca o parça seçilsin." Parmak yana kaydıkça (ya da ◀ ▶ ile) sıradaki
// bakış gelir; "Üstten" ayrı düğme. Bakışın parça haritası varsa dokunulan
// PARÇA işaretlenir, adıyla "Onayla" çıkar; hata ızgarası onaylayınca açılır
// (26.10.2026: "hemen girmesin, onaylatsın; yanlış tıklama olabilir").
// Çokgen dışına dokunuş yalnız "Bir parçaya dokunun" der — tahmin yok.
// Haritası yoksa dokunulan YÜZÜN bölgesi açılır, parça listeden seçilir.
// Görseli olmayan bakış haritadan çizilir (AracCizimi). Hesap
// cekirdek/donusGorunumu.ts'te; görseller telefonda (veri/aracGorselleri.ts).
//
// İKİ KİP (26.10.2026, "aracı seçtiğinde büyüsün … içinde parçaları seçsinler"):
// KART kipi denetim ekranında küçük durur, dokunuş BÜYÜK görünümü açar.
// BÜYÜK kip ekranı kaplar, araç sınır kutusuna kırpılıp büyütülür; parça
// seçimi, isteğe bağlı İKİNCİ parça (boşluk/kademe: "Kaput ↔ Sol ön
// çamurluk") ve Onayla orada.
//
// KATMAN: görselin üstünde, görselle aynı dikdörtgende bir SVG — kaydı olan
// parçalar kırmızıyla boyanır, onay bekleyen ya da açık parça vurgulanır. Görsel
// `contain` ile gösterilir; kap ile görselin oranı farklıysa kenar boşlukları
// hesaba katılır (goruntuNoktasi).
//
// ERİŞİLEBİLİRLİK: görüntü ekran okuyucuya kapalı; ◀ ▶ ve "Üstten" adlıdır,
// sistem listesi her zaman altında durur — parçaya o yoldan da gidilir.

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Image, LayoutChangeEvent, PanResponder, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import Svg, { Defs, Ellipse, Line, LinearGradient, Path, Polygon, RadialGradient, Stop } from 'react-native-svg';

import { S } from '@/bilesenler/simgeler';
import { Dugme, Secenek } from '@/bilesenler/temel';
import {
  AracOlcusu, cizimRolu, CizimRolu, dokunusSonucu, gorunumHaritasi, goruntuKutusu, halka, HalkaGirdisi,
  haritaOdagi, kaydirmaIndeksi, kaymaSinirla, kaynakHaritasi, kutudakiNokta, odakKutusu, sar, YAKINLIKLAR, yakinKutu, yumusakYol, yuvaAdi,
} from '@/cekirdek/donusGorunumu';
import { cokgenAlani, GorunumHaritasi, GorunumId } from '@/cekirdek/gorunumParcalari';
import { parcaCiftiAdi, parcaTamAdi } from '@/cekirdek/katalog';
import { ARAC_INDEKS } from '@/cekirdek/model3d';
import { Bolge } from '@/cekirdek/tipler';
import { ARAC_BOYASI, bosluk, dereceRenkleri, DOKUNMA, kose, PALETLER, Renkler, tipografi, useTema } from '@/tema';
import { useAracGorselleri, yuvaAdresi } from '@/veri/aracGorselleri';
import { useDil } from '@/veri/dilDeposu';

/** Sahne oranı: ürün sahibinin görselleri 2:1. Farklı orandaki görsel ortalanır. */
const SAHNE_ORANI = 2;

type Gorunum = { girdi: HalkaGirdisi } | { ust: true };

/**
 * Araç başına son bakış (oturum boyu, bellekte). Telefonda parça açılınca bu
 * görünüm kapanır; listeye dönülünce denetçi aynı bakıştan devam etsin, sol
 * önden yeniden döndürmesin.
 */
const SON_BAKIS = new Map<string, { yuva: GorunumId | null; ustte: boolean }>();
/**
 * Tablette kart ve büyük görünüm aynı anda bağlıdır: büyük görünümde döndürünce
 * kart da o bakışa gelsin (26.10.2026 sentetik sınavda yakalandı: kart "Sol
 * ön"de kaldı). Yazan herkes haber verir; kart kipindekiler SON_BAKIS'ı okur.
 */
const SON_BAKIS_DINLEYICI = new Set<() => void>();

export function DonusGorunumu({
  aracId, bolgeler, kayitliParcalar, seciliParcaId, seciliIkinciParcaId, onBolgeSec, onParcaSec, buyuk = false, onBuyut, onKapat,
}: {
  aracId: string;
  /** Bu aracın bölgeleri — yalnız bunlara ve bunların parçalarına gidilir. */
  bolgeler: readonly Bolge[];
  /** Parça → üzerindeki kayıtların en yüksek demerit'i (`parcaDemeritleri`); kayıtlı parça bu renkle boyanır. */
  kayitliParcalar: ReadonlyMap<string, number>;
  /** Hata ızgarası açık olan parça (tablette görünüm yanında durur): vurgulanır, adı yazılır. */
  seciliParcaId?: string | null;
  /** Açık kaydın ikinci parçası (boşluk/kademe): tablette kart ikisini de vurgular ve "A ↔ B" yazar. */
  seciliIkinciParcaId?: string | null;
  onBolgeSec: (bolgeId: string) => void;
  /** Onaylanan parça; ikinci parça seçildiyse (boşluk/kademe) onunla birlikte. */
  onParcaSec: (parcaId: string, ikinciParcaId?: string) => void;
  /**
   * BÜYÜK GÖRÜNÜM (26.10.2026, ürün sahibi: "aracı seçtiğinde büyüsün; 360
   * view olsun, içinde parçaları seçebilsinler"): kabı doldurur, araç sınır
   * kutusuna kırpılıp büyütülür, parça seçimi ve onay BURADA. Kart kipinde
   * (`buyuk` değil, `onBuyut` verilmiş) araca dokunuş yalnız büyük görünümü
   * açar; parça seçilmez.
   */
  buyuk?: boolean;
  onBuyut?: () => void;
  onKapat?: () => void;
}) {
  const { renkler } = useTema();
  const { dil, t } = useDil();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const gorsel = useAracGorselleri((d) => d.gorseller[aracId]);
  const yuvalar = useMemo(() => gorsel?.yuvalar ?? {}, [gorsel]);
  // Görseli olmayan yuva, haritası varsa ÇİZİLİR (26.10.2026): kurulum gerekmez.
  const haritali = useCallback((y: GorunumId) => !!kaynakHaritasi(aracId, y), [aracId]);
  const halkaListesi = useMemo(() => halka((y) => !!yuvalar[y], haritali), [yuvalar, haritali]);
  const ustGorseli = !!yuvalar.ust;
  const ustVar = ustGorseli || haritali('ust');

  const bolgeKimlikleri = useMemo(() => new Set(bolgeler.map((b) => b.id)), [bolgeler]);
  const parcaKimlikleri = useMemo(() => new Set(bolgeler.flatMap((b) => b.parcalar.map((p) => p.id))), [bolgeler]);
  const arac = ARAC_INDEKS[aracId];
  const olcu: AracOlcusu = { uzunluk: arac?.uzunluk ?? 4200, genislik: arac?.genislik ?? 1800 };

  // Son bakıştan, yoksa sol önden açılır (Hyundai sitelerindeki gibi en çok
  // yüzü gösteren bakış).
  const [indeksHam, setIndeks] = useState(() => {
    const son = SON_BAKIS.get(aracId)?.yuva;
    const i = son ? halkaListesi.findIndex((x) => x.yuva === son) : -1;
    return i >= 0 ? i : Math.max(0, halkaListesi.findIndex((x) => x.yuva === 'sol_on'));
  });
  const indeks = sar(indeksHam, halkaListesi.length);
  const [ustte, setUstte] = useState(() => !!SON_BAKIS.get(aracId)?.ustte || (!halkaListesi.length && ustVar));
  const yuvaSimdi = halkaListesi[indeks]?.yuva ?? null;
  useEffect(() => {
    SON_BAKIS.set(aracId, { yuva: yuvaSimdi, ustte });
    SON_BAKIS_DINLEYICI.forEach((d) => d());
  }, [aracId, yuvaSimdi, ustte]);
  useEffect(() => {
    if (buyuk) return undefined;
    const dinle = () => {
      const son = SON_BAKIS.get(aracId);
      if (!son) return;
      const i = son.yuva ? halkaListesi.findIndex((x) => x.yuva === son.yuva) : -1;
      if (i >= 0) setIndeks(i);
      setUstte(son.ustte);
    };
    SON_BAKIS_DINLEYICI.add(dinle);
    return () => { SON_BAKIS_DINLEYICI.delete(dinle); };
  }, [buyuk, aracId, halkaListesi]);
  const gorunum: Gorunum | null = ustte && ustVar ? { ust: true }
    : halkaListesi.length ? { girdi: halkaListesi[indeks]! } : ustVar ? { ust: true } : null;

  const kaynak: GorunumId | null = !gorunum ? null : 'ust' in gorunum ? 'ust' : gorunum.girdi.kaynak;
  const ayna = !!gorunum && 'girdi' in gorunum && gorunum.girdi.ayna;
  const cizim = !!gorunum && ('ust' in gorunum ? !ustGorseli : gorunum.girdi.cizim);
  const yuvaGorseli = kaynak && !cizim ? yuvalar[kaynak] : undefined;
  const oran = yuvaGorseli ? yuvaGorseli.en / Math.max(1, yuvaGorseli.boy) : SAHNE_ORANI;
  const harita: GorunumHaritasi | null = useMemo(
    () => (kaynak ? gorunumHaritasi(aracId, kaynak, ayna, oran, (id) => parcaKimlikleri.has(id)) : null),
    [aracId, kaynak, ayna, oran, parcaKimlikleri],
  );

  const [kap, setKap] = useState({ en: 0, boy: 0 });
  // Büyük görünümde görsel aracın sınır kutusuna kırpılıp büyütülür (kenar
  // boşlukları kabın dışına taşar); kartta görsel kaba sığdırılır.
  // YAN YATIRMA KALKTI (26.10.2026): dikey telefonda araç 90° çevriliyordu;
  // dört dış değerlendiricinin üçü "devrilmiş gibi" buldu. Araç hep yatay;
  // büyütmek için yakınlaştırma (aşağıda) ve yatay telefonda yan yana düzen.
  const odak = useMemo(() => (buyuk && harita ? haritaOdagi(harita) : null), [buyuk, harita]);
  const pencere = useWindowDimensions();
  const dikey = pencere.height > pencere.width;
  // Yatay telefon (alçak ekran): kontroller alt alta dizilince sahneye ~190 px
  // kalıyordu, onay çubuğu açılınca daha da az. Kontroller sağ sütuna geçer,
  // araç solda tam yükseklikte. Tablette (yükseklik ≥ 500) alt alta düzen kalır.
  const yanYana = buyuk && !dikey && pencere.height < 500;
  // Dikey telefonda sahne aracın oranından biraz yüksek (en fazla 1,5): 1×'te
  // araç ortada, yakınlaşınca yükseklik de kullanılır.
  const odakOrani = odak ? Math.min(1.5, Math.max(1.2, ((odak.x1 - odak.x0) * oran) / Math.max(0.01, odak.y1 - odak.y0))) : SAHNE_ORANI;
  const temelKutu = useMemo(
    () => (odak ? odakKutusu(kap.en, kap.boy, oran, odak) : goruntuKutusu(kap.en, kap.boy, oran)),
    [odak, kap.en, kap.boy, oran],
  );
  // YAKINLAŞTIRMA (26.10.2026, yalnız büyük görünüm): + / − ile; yakınken
  // sürüklemek aracı gezdirir, döndürme oklarla. Bakış değişince kayma sıfırlanır.
  const [yakinSira, setYakinSira] = useState(0);
  const yakin = buyuk ? YAKINLIKLAR[yakinSira] ?? 1 : 1;
  const [kaymaHam, setKayma] = useState({ x: 0, y: 0 });
  useEffect(() => { setKayma({ x: 0, y: 0 }); }, [yuvaSimdi, ustte, yakinSira]);
  const kayma = kaymaSinirla(temelKutu, kap.en, kap.boy, yakin, odak, kaymaHam);
  const kutu = yakinKutu(temelKutu, kap.en, kap.boy, yakin, kayma);
  // ONAY (26.10.2026, ürün sahibi: "parçayı seçince hemen girmesin, onaylatsın;
  // yanlış tıklama olabilir"): dokunuş parçayı yalnız İŞARETLER; hata ızgarası
  // "Onayla" ile açılır. Başka parçaya dokunmak seçimi değiştirir.
  const [bekleyen, setBekleyen] = useState<string | null>(null);
  // İKİNCİ PARÇA (26.10.2026, "iki parça seçebilsek, arasında boşluk vs.
  // yazabilmek için"): "+ 2. parça" açıkken sonraki dokunuş ikinci parçayı seçer.
  const [ikinci, setIkinci] = useState<string | null>(null);
  const [ikinciModu, setIkinciModu] = useState(false);
  const secimiTemizle = useCallback(() => { setBekleyen(null); setIkinci(null); setIkinciModu(false); }, []);
  // Tablette sahne açık kalır: listeden başka parça seçilince bekleyen seçim düşer.
  useEffect(() => { secimiTemizle(); }, [seciliParcaId, secimiTemizle]);
  const [ipucu, setIpucu] = useState(false);
  const zamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (zamanlayici.current) clearTimeout(zamanlayici.current); }, []);

  // PanResponder bir kez kurulur; güncel değerler bu kutudan okunur.
  const guncel = useRef({
    indeks, n: halkaListesi.length, gorunum, harita, kap, kutu, olcu, bolgeKimlikleri, onBolgeSec, onBuyut, onKapat,
    buyuk, bekleyen, ikinci, ikinciModu,
  });
  guncel.current = {
    indeks, n: halkaListesi.length, gorunum, harita, kap, kutu, olcu, bolgeKimlikleri, onBolgeSec, onBuyut, onKapat,
    buyuk, bekleyen, ikinci, ikinciModu,
  };
  const yakinlik = useRef({ yakin, kayma, temelKutu, odak });
  yakinlik.current = { yakin, kayma, temelKutu, odak };
  const baslangicKayma = useRef({ x: 0, y: 0 });
  const baslangic = useRef(0);
  const surukleniyor = useRef(false);

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    // Yakınken her yöne sürükleme aracı gezdirir; 1×'te yatay sürükleme döndürür.
    onMoveShouldSetPanResponder: (_, g) => (yakinlik.current.yakin > 1
      ? Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6
      : Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy)),
    onPanResponderGrant: () => {
      baslangic.current = guncel.current.indeks;
      baslangicKayma.current = yakinlik.current.kayma;
      surukleniyor.current = false;
    },
    onPanResponderMove: (_, g) => {
      const z = yakinlik.current;
      if (z.yakin > 1) {
        if (Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6) surukleniyor.current = true;
        if (surukleniyor.current) {
          const k = guncel.current.kap;
          setKayma(kaymaSinirla(z.temelKutu, k.en, k.boy, z.yakin, z.odak, {
            x: baslangicKayma.current.x + g.dx, y: baslangicKayma.current.y + g.dy,
          }));
        }
        return;
      }
      const c = guncel.current;
      if (!c.gorunum || 'ust' in c.gorunum || c.n < 2) return;
      if (Math.abs(g.dx) > 6) surukleniyor.current = true;
      if (surukleniyor.current) setIndeks(kaydirmaIndeksi(baslangic.current, g.dx / Math.max(1, c.kap.en), c.n));
    },
    // Dikey kaydırma (sayfa) isterse bırak; yatay sürüklerken bırakma.
    onPanResponderTerminationRequest: () => !surukleniyor.current,
    onPanResponderRelease: (e, g) => {
      if (surukleniyor.current || Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6) return;
      const c = guncel.current;
      if (!c.gorunum) return;
      // Kartta dokunuş büyük görünümü açar; seçim orada.
      if (!c.buyuk && c.onBuyut) { c.onBuyut(); return; }
      const nokta = kutudakiNokta(e.nativeEvent.locationX, e.nativeEvent.locationY, c.kutu);
      if (!nokta) return;
      const sonuc = dokunusSonucu(nokta, { aci: 'ust' in c.gorunum ? null : c.gorunum.girdi.aci }, c.harita, c.olcu);
      if (sonuc.tur === 'parca') {
        setIpucu(false);
        if (c.ikinciModu && c.bekleyen && sonuc.parcaId !== c.bekleyen) {
          setIkinci(sonuc.parcaId);
          setIkinciModu(false);
        } else {
          setBekleyen(sonuc.parcaId);
          if (sonuc.parcaId === c.ikinci) setIkinci(null);
        }
      } else if (sonuc.tur === 'bolge') {
        if (c.bolgeKimlikleri.has(sonuc.bolgeId)) { c.onKapat?.(); c.onBolgeSec(sonuc.bolgeId); }
      } else if (c.harita) {
        setBekleyen(null); setIkinci(null); setIkinciModu(false);
        setIpucu(true);
        if (zamanlayici.current) clearTimeout(zamanlayici.current);
        zamanlayici.current = setTimeout(() => setIpucu(false), 2000);
      }
    },
  }), []);

  if (!gorunum || !kaynak || (cizim ? !harita : !yuvaGorseli)) return null;

  const dondur = (yon: 1 | -1) => {
    secimiTemizle(); setIpucu(false);
    // Üst görselden çıkış; üst görseli sonradan temizlenmişse kalan bayrak düşer, halka döner.
    if (ustte) { setUstte(false); if (ustVar) return; }
    setIndeks((i) => sar(i + yon, halkaListesi.length));
  };
  const ad = 'ust' in gorunum ? yuvaAdi('ust', dil) : yuvaAdi(gorunum.girdi.yuva, dil);
  // Onay bekleyen parça(lar), yoksa ızgarası açık parça; ikisi de yoksa yönerge.
  const isaretli = new Set<string>(
    [bekleyen, ikinci, ...(bekleyen ? [] : [seciliParcaId ?? null, seciliIkinciParcaId ?? null])].filter((x): x is string => !!x),
  );
  // Jant yalnız yan ve çapraz bakışta görünür; önden/arkadan/üstten lastiğin sırtı görünür.
  const jantli = 'girdi' in gorunum && gorunum.girdi.aci % 180 !== 0;
  const govdeProfili: GovdeProfili = 'girdi' in gorunum ? (jantli ? 'yan' : 'onArka') : 'parca';
  const onayla = () => {
    if (!bekleyen) return;
    const p = bekleyen;
    const i = ikinci ?? undefined;
    secimiTemizle();
    onParcaSec(p, i);
  };
  const secimAdi = bekleyen ? parcaCiftiAdi({ parcaId: bekleyen, ikinciParcaId: ikinci }, dil) : null;
  const altYazi = ikinciModu ? t('İkinci parçaya dokunun (boşluk, kademe)', 'Tap the second part (gap, flush)')
    : secimAdi ?? (seciliParcaId ? parcaCiftiAdi({ parcaId: seciliParcaId, ikinciParcaId: seciliIkinciParcaId }, dil)
      : ipucu ? t('Bir parçaya dokunun', 'Tap a part')
        : yakin > 1 ? t('Sürükleyerek gezdirin · döndürmek için oklar', 'Drag to move · arrows to rotate')
        : !buyuk && onBuyut ? t('Dokunarak büyütün, parçayı orada seçin', 'Tap to enlarge and pick a part there')
          : harita ? t('Kaydırarak döndürün, parçaya dokunun', 'Swipe to rotate, tap a part')
            : t('Kaydırarak döndürün, bölgeye dokunun', 'Swipe to rotate, tap an area'));

  // Parçalar ayrı değişkenlerde: yatay telefonda kontroller sağ sütuna geçer
  // (26.10.2026), öteki düzenlerde alt alta. Sıra ve içerik ikisinde de aynı.
  const ustOgesi = buyuk ? (
        <View style={s.ustSatir}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.buyukBaslik} numberOfLines={1}>{arac?.ad ?? aracId}</Text>
            {dikey ? (
              <Text style={s.ustNot} numberOfLines={2} testID="donus-yan-cevir">
                {t('+ ile yakınlaştırın; telefonu yan çevirince de büyür', '+ to zoom in; turning the phone sideways also enlarges it')}
              </Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Büyük görünümü kapat', 'Close enlarged view')}
            onPress={() => { secimiTemizle(); onKapat?.(); }}
            style={({ pressed }) => [s.ok, pressed && s.basili]}
          >
            <S.kapat size={20} color={renkler.metin} strokeWidth={2} />
          </Pressable>
        </View>
      ) : null;
  const sahneOgesi = (
        <View
          {...pan.panHandlers}
          onLayout={(e: LayoutChangeEvent) => setKap({ en: e.nativeEvent.layout.width, boy: e.nativeEvent.layout.height })}
          style={buyuk ? (dikey ? [s.sahneBuyukDikey, { aspectRatio: odakOrani }] : s.sahneBuyuk) : s.sahne}
          importantForAccessibility="no-hide-descendants"
          aria-hidden
          testID={buyuk ? 'donus-sahne-buyuk' : 'donus-sahne'}
        >
          {/* Dokunuş sahneye gitsin: konum sahnenin içine göre okunuyor. */}
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {cizim && harita && kap.en > 0 ? (
              <AracCizimi harita={harita} en={kutu.en} boy={kutu.boy} x={kutu.x} y={kutu.y} jantli={jantli} profil={govdeProfili} />
            ) : null}
            {yuvaGorseli && kap.en > 0 ? (
              <Image
                source={{ uri: yuvaAdresi(aracId, yuvaGorseli) }}
                resizeMode="stretch"
                style={[
                  { position: 'absolute', left: kutu.x, top: kutu.y, width: kutu.en, height: kutu.boy },
                  ayna && { transform: [{ scaleX: -1 }] },
                ]}
              />
            ) : null}
            {harita && kap.en > 0 ? (
              <Svg
                width={kutu.en}
                height={kutu.boy}
                style={{ position: 'absolute', left: kutu.x, top: kutu.y }}
              >
                {harita.alanlar.map((a, i) => {
                  const secili = isaretli.has(a.parcaId);
                  const demerit = kayitliParcalar.get(a.parcaId);
                  const kayitli = demerit !== undefined;
                  if (!secili && !kayitli) return null;
                  // Kayıtlı parça DEMERİT RENGİYLE (26.10.2026; eskiden üç derece de aynı
                  // kırmızıydı). Renkler açık temadan, iki temada aynı: çizim içerik,
                  // arayüz değil (koyu temada somon pembesine dönüyordu). Dolgu 0.22
                  // iken teal gövdede renk griye dönüyordu; 0.55'te kalır.
                  const renk = secili ? PALETLER.acik.birincil : dereceRenkleri(PALETLER.acik, String(demerit)).on;
                  const boya = {
                    fill: renk,
                    fillOpacity: secili ? 0.45 : 0.55,
                    stroke: renk,
                    strokeWidth: secili ? 2 : 1.5,
                  };
                  // Çizimde vurgu da çizimin yumuşak kenarını izler; görselde düz çokgen.
                  return cizim ? (
                    <Path key={`${a.parcaId}-${i}`} d={yumusakYol(a.nokta, kutu.en, kutu.boy)} {...boya} />
                  ) : (
                    <Polygon
                      key={`${a.parcaId}-${i}`}
                      points={a.nokta.map(([x, y]) => `${x * kutu.en},${y * kutu.boy}`).join(' ')}
                      {...boya}
                    />
                  );
                })}
              </Svg>
            ) : null}
          </View>
        </View>
  );
  const onayOgesi = bekleyen && secimAdi ? (
        <View style={s.onay} testID="donus-onay">
          <View style={s.onaySatir}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.onayEtiket}>{ikinci ? t('Seçilen parçalar', 'Selected parts') : t('Seçilen parça', 'Selected part')}</Text>
              <Text style={s.onayAd} numberOfLines={2}>{secimAdi}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('Seçimden vazgeç', 'Cancel selection')}
              onPress={secimiTemizle}
              style={({ pressed }) => [s.ok, pressed && s.basili]}
            >
              <S.kapat size={18} color={renkler.metinIkincil} strokeWidth={2} />
            </Pressable>
          </View>
          <View style={s.onaySatir}>
            {/* Boşluk/kademe iki panelin arasındadır: ikinci parça isteğe bağlı. */}
            <Secenek
              kucuk
              simge={ikinci ? S.kapat : S.ekle}
              metin={ikinci ? t('2. parçayı kaldır', 'Remove 2nd part') : t('2. parça', '2nd part')}
              secili={ikinciModu}
              erisimEtiketi={ikinci
                ? t(`İkinci parçayı kaldır: ${parcaTamAdi(ikinci)}`, `Remove second part: ${parcaTamAdi(ikinci, 'en')}`)
                : t('İkinci parça seç (boşluk, kademe için)', 'Pick a second part (for gap, flush)')}
              onPress={() => { if (ikinci) setIkinci(null); else setIkinciModu((m) => !m); }}
            />
            <View style={{ flex: 1 }} />
            <Dugme
              metin={t('Onayla', 'Confirm')}
              tur="birincil"
              simge={S.ileri}
              onPress={onayla}
              erisimEtiketi={t(
                `${parcaCiftiAdi({ parcaId: bekleyen, ikinciParcaId: ikinci }, 'tr')}: onayla, hata listesini aç`,
                `${parcaCiftiAdi({ parcaId: bekleyen, ikinciParcaId: ikinci }, 'en')}: confirm, open defect list`,
              )}
            />
          </View>
        </View>
      ) : null;
  const altOgesi = (
        <View style={s.alt}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Aracı döndür: önceki bakış', 'Rotate vehicle: previous view')}
            onPress={() => dondur(-1)}
            style={({ pressed }) => [s.ok, pressed && s.basili]}
          >
            <S.geri size={20} color={renkler.metin} strokeWidth={2} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            {/* Ayna notu YALNIZ GERÇEK GÖRSELDE (26.10.2026): çizim simetrik, aynada fark
                yok; dış değerlendirme "kullanıcıya 'aynalanmış görünüm' yazıyor" dedi.
                Görselde yazılar/kapak ters görüneceği için orada kalır. İşaret
                (donus-ayna) sınavlar için her iki kipte de var. */}
            <Text style={s.baslik} numberOfLines={2} testID="donus-bakis">
              {ad}{ayna && yuvaGorseli ? <Text style={s.aynaNot}>{t(' · aynalanmış görsel', ' · mirrored image')}</Text> : null}
            </Text>
            {ayna ? <View testID="donus-ayna" /> : null}
            <Text style={[s.not, (isaretli.size > 0 || ipucu || ikinciModu) && s.notVurgu]} numberOfLines={2} accessibilityLiveRegion="polite" testID="donus-yazi">
              {altYazi}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Aracı döndür: sonraki bakış', 'Rotate vehicle: next view')}
            onPress={() => dondur(1)}
            style={({ pressed }) => [s.ok, pressed && s.basili]}
          >
            <S.ileri size={20} color={renkler.metin} strokeWidth={2} />
          </Pressable>
        </View>
  );
  const seceneklerOgesi = (
        <View style={s.altSecenekler}>
          {ustVar && halkaListesi.length ? (
            <Secenek
              kucuk
              metin={yuvaAdi('ust', dil)}
              erisimEtiketi={t('Üstten görünüm', 'Top view')}
              secili={!!ustte}
              onPress={() => { secimiTemizle(); setIpucu(false); setUstte(!ustte); }}
            />
          ) : null}
          {buyuk ? (
            <View style={s.yakinSatir}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('Uzaklaştır', 'Zoom out')}
                accessibilityState={{ disabled: yakinSira === 0 }}
                disabled={yakinSira === 0}
                onPress={() => setYakinSira((x) => Math.max(0, x - 1))}
                style={({ pressed }) => [s.ok, yakinSira === 0 && s.pasif, pressed && s.basili]}
              >
                <S.azalt size={20} color={renkler.metin} strokeWidth={2} />
              </Pressable>
              <Text style={s.yakinMetin} testID="donus-yakinlik">
                {`${String(yakin).replace('.', dil === 'en' ? '.' : ',')}×`}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('Yakınlaştır', 'Zoom in')}
                accessibilityState={{ disabled: yakinSira === YAKINLIKLAR.length - 1 }}
                disabled={yakinSira === YAKINLIKLAR.length - 1}
                onPress={() => setYakinSira((x) => Math.min(YAKINLIKLAR.length - 1, x + 1))}
                style={({ pressed }) => [s.ok, yakinSira === YAKINLIKLAR.length - 1 && s.pasif, pressed && s.basili]}
              >
                <S.ekle size={20} color={renkler.metin} strokeWidth={2} />
              </Pressable>
            </View>
          ) : null}
          {!buyuk && onBuyut ? (
            <Secenek
              kucuk
              simge={S.buyut}
              metin={t('Büyüt', 'Enlarge')}
              erisimEtiketi={t('Aracı büyüt: tam ekran 360° görünüm', 'Enlarge vehicle: full-screen 360° view')}
              secili={false}
              onPress={onBuyut}
            />
          ) : null}
        </View>
  );

  if (yanYana) {
    return (
      <View style={s.kapBuyukYan} testID="donus-yan-yana">
        <View style={s.yanSahne}>{sahneOgesi}</View>
        <ScrollView style={s.yanPanel} contentContainerStyle={s.yanPanelIc}>
          {ustOgesi}
          {onayOgesi}
          {altOgesi}
          {seceneklerOgesi}
        </ScrollView>
      </View>
    );
  }
  return (
    <View style={buyuk ? s.kapBuyuk : s.kap}>
      {ustOgesi}
      {sahneOgesi}
      {onayOgesi}
      {altOgesi}
      {seceneklerOgesi}
    </View>
  );
}

/**
 * Görseli olmayan bakışın ÇİZİMİ (26.10.2026): parça haritasının çokgenleri,
 * rolüne göre ARACIN GERÇEK RENKLERİYLE boyanır (ARAC_BOYASI). Büyük çokgen
 * önce, küçük üstte — dokunuşta da küçük kazanır, yani görülen ile dokunulan
 * aynı. Yan/çapraz bakışta tekerleğe jant çizilir (yalnız görüntü; dokunuş
 * lastik çokgenine gider).
 *
 * SİLUET (ürün sahibi: "araba silueti neden boktan"): kenarlar yumusakYol ile
 * kavislenir (kapı, plaka gibi sivri köşeler kalır); gövde parça parça değil
 * aracın boyunca TEK geçişle boyanır (omuz çizgisinde parlama, ölçülü
 * profil); altında yumuşak gölge. Önce düz çokgenler koyu "ek yeri" rengiyle
 * çizilir: yumuşak kenarların arasında kalan boşluk panel aralığı gibi
 * görünür, haritanın kendi küçük boşlukları da kapanır. Üstten bakışta gövde
 * eskisi gibi parça başına geçiş (dikey ışık profili orada anlamsız).
 */
const GRADYAN: Record<CizimRolu, readonly [string, string, string]> = {
  govde: ARAC_BOYASI.govde, siyah: ARAC_BOYASI.siyah, cam: ARAC_BOYASI.cam, lastik: ARAC_BOYASI.lastik,
  far: ARAC_BOYASI.far, drl: ARAC_BOYASI.drl, stop: ARAC_BOYASI.stop, gumus: ARAC_BOYASI.gumus, plaka: ARAC_BOYASI.plaka,
};

/** Gövdenin boyanışı: yan/çapraz ve ön/arka bakışta aracın boyunca tek geçiş, üstten parça başına. */
type GovdeProfili = 'yan' | 'onArka' | 'parca';

function AracCizimi({ harita, en, boy, x, y, jantli, profil }: {
  harita: GorunumHaritasi; en: number; boy: number; x: number; y: number; jantli: boolean; profil: GovdeProfili;
}) {
  const sirali = useMemo(
    () => [...harita.alanlar].sort((a, b) => cokgenAlani(b.nokta) - cokgenAlani(a.nokta)),
    [harita],
  );
  const yollar = useMemo(() => sirali.map((a) => yumusakYol(a.nokta, en, boy)), [sirali, en, boy]);
  // Aracın sınırı (gövde geçişi ve gölge buna göre).
  const sinir = useMemo(() => {
    let ust = Infinity; let alt = -Infinity; let sol = Infinity; let sag = -Infinity;
    for (const a of harita.alanlar) {
      for (const [px, py] of a.nokta) {
        ust = Math.min(ust, py * boy); alt = Math.max(alt, py * boy);
        sol = Math.min(sol, px * en); sag = Math.max(sag, px * en);
      }
    }
    return { ust, alt, sol, sag };
  }, [harita, en, boy]);
  // Jant: lastik çokgeninin kutusu tekerleğin yüzü gibi duruyorsa (en/boy 0,55–1,35).
  const jantlar = useMemo(() => {
    if (!jantli) return [];
    return harita.alanlar.filter((a) => cizimRolu(a.parcaId) === 'lastik').flatMap((a) => {
      const xs = a.nokta.map((p) => p[0] * en);
      const ys = a.nokta.map((p) => p[1] * boy);
      const w = Math.max(...xs) - Math.min(...xs);
      const h = Math.max(...ys) - Math.min(...ys);
      if (!(h > 0) || w / h < 0.55 || w / h > 1.35) return [];
      return [{ cx: (Math.max(...xs) + Math.min(...xs)) / 2, cy: (Math.max(...ys) + Math.min(...ys)) / 2, w, h }];
    });
  }, [harita, en, boy, jantli]);
  // Gövde tek geçişse ve cam çapraz ise ayrı tanımlanır; öteki roller kendi içinde dikey.
  const roller = (Object.keys(GRADYAN) as CizimRolu[]).filter((r) => r !== 'cam' && (r !== 'govde' || profil === 'parca'));
  // Gradyan kimliği çizim başına: web'de iki çizim aynı sayfada kalırsa (biri gizli
  // ekranda) url(#…) gizli olanınkine gidip boyayı kaybetmesin.
  const kimlik = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const yukseklik = sinir.alt - sinir.ust;
  return (
    <Svg width={en} height={boy} style={{ position: 'absolute', left: x, top: y }}>
      <Defs>
        {roller.map((r) => (
          <LinearGradient key={r} id={`boya-${kimlik}-${r}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={GRADYAN[r][0]} />
            <Stop offset="0.55" stopColor={GRADYAN[r][1]} />
            <Stop offset="1" stopColor={GRADYAN[r][2]} />
          </LinearGradient>
        ))}
        {profil !== 'parca' ? (
          <LinearGradient
            id={`boya-${kimlik}-govde`}
            gradientUnits="userSpaceOnUse"
            x1="0" y1={sinir.ust} x2="0" y2={sinir.alt}
          >
            {(profil === 'yan' ? ARAC_BOYASI.govdeYan : ARAC_BOYASI.govdeOnArka).map(([o, r]) => (
              <Stop key={o} offset={String(o)} stopColor={r} />
            ))}
          </LinearGradient>
        ) : null}
        <LinearGradient id={`boya-${kimlik}-cam`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={ARAC_BOYASI.cam[0]} />
          <Stop offset="0.45" stopColor={ARAC_BOYASI.cam[1]} />
          <Stop offset="1" stopColor={ARAC_BOYASI.cam[2]} />
        </LinearGradient>
        <RadialGradient id={`golge-${kimlik}`}>
          <Stop offset="0" stopColor={ARAC_BOYASI.golge} stopOpacity={0.32} />
          <Stop offset="0.7" stopColor={ARAC_BOYASI.golge} stopOpacity={0.12} />
          <Stop offset="1" stopColor={ARAC_BOYASI.golge} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {profil !== 'parca' && yukseklik > 0 ? (
        <Ellipse
          cx={(sinir.sol + sinir.sag) / 2}
          cy={sinir.alt - yukseklik * 0.02}
          rx={(sinir.sag - sinir.sol) * 0.53}
          ry={yukseklik * 0.075}
          fill={`url(#golge-${kimlik})`}
        />
      ) : null}
      {sirali.map((a, i) => (
        <Polygon
          key={`ek-${a.parcaId}-${i}`}
          points={a.nokta.map(([px, py]) => `${px * en},${py * boy}`).join(' ')}
          fill={ARAC_BOYASI.ekYeri}
          stroke={ARAC_BOYASI.ekYeri}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
      ))}
      {sirali.map((a, i) => (
        <Path
          key={`${a.parcaId}-${i}`}
          d={yollar[i]}
          fill={`url(#boya-${kimlik}-${cizimRolu(a.parcaId)})`}
          stroke={ARAC_BOYASI.kontur}
          strokeOpacity={0.35}
          strokeWidth={0.6}
        />
      ))}
      {jantlar.map((j, i) => {
        const rx = j.w * 0.31;
        const ry = j.h * 0.31;
        const kalinlik = Math.max(1.2, Math.min(j.w, j.h) * 0.06);
        return (
          <React.Fragment key={`jant-${i}`}>
            <Ellipse cx={j.cx} cy={j.cy} rx={rx * 1.06} ry={ry * 1.06} fill={ARAC_BOYASI.jant} stroke={ARAC_BOYASI.jantKolu} strokeOpacity={0.5} strokeWidth={1} />
            {[0, 1, 2, 3, 4].map((k) => {
              const aci = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
              return (
                <Line
                  key={k}
                  x1={j.cx} y1={j.cy}
                  x2={j.cx + rx * Math.cos(aci)} y2={j.cy + ry * Math.sin(aci)}
                  stroke={ARAC_BOYASI.jantKolu}
                  strokeWidth={kalinlik}
                  strokeLinecap="round"
                />
              );
            })}
            <Ellipse cx={j.cx} cy={j.cy} rx={rx * 0.24} ry={ry * 0.24} fill={ARAC_BOYASI.jantGobek} />
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

const stiller = (r: Renkler) => StyleSheet.create({
  // Çerçevesiz ton dolgu (26.10.2026): sistem satırlarıyla aynı yüzey dili.
  kap: {
    width: '100%', gap: bosluk.xs, padding: bosluk.xs,
    borderRadius: kose.lg, backgroundColor: r.yuzeyAlt,
  },
  sahne: { width: '100%', aspectRatio: SAHNE_ORANI, borderRadius: kose.md, overflow: 'hidden', backgroundColor: r.yuzey },
  // Büyük görünüm: kabı doldurur; sahne kalan bütün yüksekliği alır.
  kapBuyuk: { flex: 1, gap: bosluk.xs, padding: bosluk.sm, backgroundColor: r.bg },
  sahneBuyuk: { flex: 1, width: '100%', borderRadius: kose.md, overflow: 'hidden', backgroundColor: r.yuzey },
  // Yatay telefon: solda sahne, sağda kontroller (yanYana).
  kapBuyukYan: { flex: 1, flexDirection: 'row', gap: bosluk.sm, padding: bosluk.sm, backgroundColor: r.bg },
  yanSahne: { flex: 1, minWidth: 0 },
  yanPanel: { width: 268, flexGrow: 0 },
  yanPanelIc: { gap: bosluk.xs, paddingBottom: bosluk.sm },
  // Dikey telefonda sahne aracın oranında (yükseklik boş kalmasın); altında kontroller.
  sahneBuyukDikey: { width: '100%', borderRadius: kose.md, overflow: 'hidden', backgroundColor: r.yuzey },
  ustSatir: { flexDirection: 'row', alignItems: 'center', gap: bosluk.xs },
  buyukBaslik: { ...tipografi.h2, color: r.metin },
  ustNot: { ...tipografi.caption, color: r.metinSolgun },
  alt: { flexDirection: 'row', alignItems: 'center', gap: bosluk.xs },
  altSecenekler: { flexDirection: 'row', justifyContent: 'center', gap: bosluk.xs, flexWrap: 'wrap' },
  ok: {
    width: DOKUNMA, height: DOKUNMA, alignItems: 'center', justifyContent: 'center',
    borderRadius: kose.md, backgroundColor: r.yuzey,
  },
  basili: { opacity: 0.72 },
  pasif: { opacity: 0.4 },
  yakinSatir: { flexDirection: 'row', alignItems: 'center', gap: bosluk.xs },
  yakinMetin: { ...tipografi.sayi, color: r.metinIkincil, minWidth: 40, textAlign: 'center' },
  baslik: { ...tipografi.bodyOrta, color: r.metin, textAlign: 'center' },
  not: { ...tipografi.caption, color: r.metinSolgun, textAlign: 'center' },
  notVurgu: { ...tipografi.captionOrta, color: r.birincil },
  aynaNot: { ...tipografi.caption, color: r.metinSolgun },
  onay: {
    gap: bosluk.xs, padding: bosluk.xs,
    borderRadius: kose.md, borderWidth: 1, borderColor: r.birincil, backgroundColor: r.birincilYumusak,
  },
  onaySatir: { flexDirection: 'row', alignItems: 'center', gap: bosluk.xs },
  onayEtiket: { ...tipografi.caption, color: r.metinSolgun },
  onayAd: { ...tipografi.bodyOrta, color: r.metin },
});
