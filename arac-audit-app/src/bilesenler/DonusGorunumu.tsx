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
// KATMAN: görselin üstünde, görselle aynı dikdörtgende bir SVG — kaydı olan
// parçalar kırmızıyla boyanır, onay bekleyen ya da açık parça vurgulanır. Görsel
// `contain` ile gösterilir; kap ile görselin oranı farklıysa kenar boşlukları
// hesaba katılır (goruntuNoktasi).
//
// ERİŞİLEBİLİRLİK: görüntü ekran okuyucuya kapalı; ◀ ▶ ve "Üstten" adlıdır,
// sistem listesi her zaman altında durur — parçaya o yoldan da gidilir.

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Image, LayoutChangeEvent, PanResponder, Pressable, StyleSheet, Text, View,
} from 'react-native';
import Svg, { Defs, Ellipse, Line, LinearGradient, Path, Polygon, RadialGradient, Stop } from 'react-native-svg';

import { S } from '@/bilesenler/simgeler';
import { Dugme, Secenek } from '@/bilesenler/temel';
import {
  AracOlcusu, cizimRolu, CizimRolu, dokunusSonucu, gorunumHaritasi, goruntuKutusu, goruntuNoktasi, halka, HalkaGirdisi,
  kaydirmaIndeksi, kaynakHaritasi, sar, yumusakYol, yuvaAdi,
} from '@/cekirdek/donusGorunumu';
import { cokgenAlani, GorunumHaritasi, GorunumId } from '@/cekirdek/gorunumParcalari';
import { parcaTamAdi } from '@/cekirdek/katalog';
import { ARAC_INDEKS } from '@/cekirdek/model3d';
import { Bolge } from '@/cekirdek/tipler';
import { ARAC_BOYASI, bosluk, DOKUNMA, kose, Renkler, tipografi, useTema } from '@/tema';
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

export function DonusGorunumu({
  aracId, bolgeler, kayitliParcalar, seciliParcaId, onBolgeSec, onParcaSec,
}: {
  aracId: string;
  /** Bu aracın bölgeleri — yalnız bunlara ve bunların parçalarına gidilir. */
  bolgeler: readonly Bolge[];
  /** Parça → bu denetimdeki kayıt sayısı; kayıtlı parçalar boyanır. */
  kayitliParcalar: ReadonlyMap<string, number>;
  /** Hata ızgarası açık olan parça (tablette görünüm yanında durur): vurgulanır, adı yazılır. */
  seciliParcaId?: string | null;
  onBolgeSec: (bolgeId: string) => void;
  onParcaSec: (parcaId: string) => void;
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
  useEffect(() => { SON_BAKIS.set(aracId, { yuva: yuvaSimdi, ustte }); }, [aracId, yuvaSimdi, ustte]);
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
  const kutu = goruntuKutusu(kap.en, kap.boy, oran);
  // ONAY (26.10.2026, ürün sahibi: "parçayı seçince hemen girmesin, onaylatsın;
  // yanlış tıklama olabilir"): dokunuş parçayı yalnız İŞARETLER; hata ızgarası
  // "Onayla" ile açılır. Başka parçaya dokunmak seçimi değiştirir.
  const [bekleyen, setBekleyen] = useState<string | null>(null);
  // Tablette sahne açık kalır: listeden başka parça seçilince bekleyen seçim düşer.
  useEffect(() => { setBekleyen(null); }, [seciliParcaId]);
  const [ipucu, setIpucu] = useState(false);
  const zamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (zamanlayici.current) clearTimeout(zamanlayici.current); }, []);

  // PanResponder bir kez kurulur; güncel değerler bu kutudan okunur.
  const guncel = useRef({ indeks, n: halkaListesi.length, gorunum, harita, kap, oran, olcu, bolgeKimlikleri, onBolgeSec, onParcaSec });
  guncel.current = { indeks, n: halkaListesi.length, gorunum, harita, kap, oran, olcu, bolgeKimlikleri, onBolgeSec, onParcaSec };
  const baslangic = useRef(0);
  const surukleniyor = useRef(false);

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderGrant: () => { baslangic.current = guncel.current.indeks; surukleniyor.current = false; },
    onPanResponderMove: (_, g) => {
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
      const nokta = goruntuNoktasi(e.nativeEvent.locationX, e.nativeEvent.locationY, c.kap.en, c.kap.boy, c.oran);
      if (!nokta) return;
      const sonuc = dokunusSonucu(nokta, { aci: 'ust' in c.gorunum ? null : c.gorunum.girdi.aci }, c.harita, c.olcu);
      if (sonuc.tur === 'parca') {
        setIpucu(false);
        setBekleyen(sonuc.parcaId);
      } else if (sonuc.tur === 'bolge') {
        if (c.bolgeKimlikleri.has(sonuc.bolgeId)) c.onBolgeSec(sonuc.bolgeId);
      } else if (c.harita) {
        setBekleyen(null);
        setIpucu(true);
        if (zamanlayici.current) clearTimeout(zamanlayici.current);
        zamanlayici.current = setTimeout(() => setIpucu(false), 2000);
      }
    },
  }), []);

  if (!gorunum || !kaynak || (cizim ? !harita : !yuvaGorseli)) return null;

  const dondur = (yon: 1 | -1) => {
    setBekleyen(null); setIpucu(false);
    // Üst görselden çıkış; üst görseli sonradan temizlenmişse kalan bayrak düşer, halka döner.
    if (ustte) { setUstte(false); if (ustVar) return; }
    setIndeks((i) => sar(i + yon, halkaListesi.length));
  };
  const ad = 'ust' in gorunum ? yuvaAdi('ust', dil) : yuvaAdi(gorunum.girdi.yuva, dil);
  // Onay bekleyen parça, yoksa ızgarası açık parça; ikisi de yoksa yönerge.
  const isaretli = bekleyen ?? seciliParcaId ?? null;
  // Jant yalnız yan ve çapraz bakışta görünür; önden/arkadan/üstten lastiğin sırtı görünür.
  const jantli = 'girdi' in gorunum && gorunum.girdi.aci % 180 !== 0;
  const govdeProfili: GovdeProfili = 'girdi' in gorunum ? (jantli ? 'yan' : 'onArka') : 'parca';
  const onayla = () => {
    if (!bekleyen) return;
    const p = bekleyen;
    setBekleyen(null);
    onParcaSec(p);
  };
  const altYazi = isaretli ? parcaTamAdi(isaretli, dil)
    : ipucu ? t('Bir parçaya dokunun', 'Tap a part')
      : harita ? t('Kaydırarak döndürün, parçaya dokunun', 'Swipe to rotate, tap a part')
        : t('Kaydırarak döndürün, bölgeye dokunun', 'Swipe to rotate, tap an area');

  return (
    <View style={s.kap}>
      <View
        {...pan.panHandlers}
        onLayout={(e: LayoutChangeEvent) => setKap({ en: e.nativeEvent.layout.width, boy: e.nativeEvent.layout.height })}
        style={s.sahne}
        importantForAccessibility="no-hide-descendants"
        aria-hidden
        testID="donus-sahne"
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
                const secili = isaretli === a.parcaId;
                const kayitli = (kayitliParcalar.get(a.parcaId) ?? 0) > 0;
                if (!secili && !kayitli) return null;
                // Kayıtlı dolgu 0.22 iken teal gövdede kırmızı griye dönüyordu (#AE2018 %22 + #79A2A9 ≈ 133,133,137).
                const boya = {
                  fill: secili ? renkler.birincil : renkler.tehlike,
                  fillOpacity: secili ? 0.45 : 0.55,
                  stroke: secili ? renkler.birincil : renkler.tehlike,
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

      {bekleyen ? (
        <View style={s.onay} testID="donus-onay">
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.onayEtiket}>{t('Seçilen parça', 'Selected part')}</Text>
            <Text style={s.onayAd} numberOfLines={2}>{parcaTamAdi(bekleyen, dil)}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Seçimden vazgeç', 'Cancel selection')}
            onPress={() => setBekleyen(null)}
            style={({ pressed }) => [s.ok, pressed && s.basili]}
          >
            <S.kapat size={18} color={renkler.metinIkincil} strokeWidth={2} />
          </Pressable>
          <Dugme
            metin={t('Onayla', 'Confirm')}
            tur="birincil"
            simge={S.ileri}
            onPress={onayla}
            erisimEtiketi={t(`${parcaTamAdi(bekleyen, 'tr')}: onayla, hata listesini aç`, `${parcaTamAdi(bekleyen, 'en')}: confirm, open defect list`)}
          />
        </View>
      ) : null}

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
          {/* Dar bölmede (tablet solu) tek satıra sığmayınca ayna notu
              kesiliyordu; not küçük yazıyla, gerekirse ikinci satırda. */}
          <Text style={s.baslik} numberOfLines={2} testID="donus-bakis">
            {ad}{ayna ? <Text style={s.aynaNot}>{t(' · aynalanmış görünüm', ' · mirrored view')}</Text> : null}
          </Text>
          <Text style={[s.not, (isaretli || ipucu) && s.notVurgu]} numberOfLines={2} accessibilityLiveRegion="polite" testID="donus-yazi">
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
      {ustVar && halkaListesi.length ? (
        <Secenek
          kucuk
          metin={yuvaAdi('ust', dil)}
          erisimEtiketi={t('Üstten görünüm', 'Top view')}
          secili={!!ustte}
          onPress={() => { setBekleyen(null); setIpucu(false); setUstte(!ustte); }}
          style={{ alignSelf: 'center' }}
        />
      ) : null}
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
  kap: {
    width: '100%', gap: bosluk.xs, padding: bosluk.xs,
    borderRadius: kose.lg, borderWidth: 1, borderColor: r.cizgiSolgun, backgroundColor: r.yuzey,
  },
  sahne: { width: '100%', aspectRatio: SAHNE_ORANI, borderRadius: kose.md, overflow: 'hidden', backgroundColor: r.yuzey },
  alt: { flexDirection: 'row', alignItems: 'center', gap: bosluk.xs },
  ok: {
    width: DOKUNMA, height: DOKUNMA, alignItems: 'center', justifyContent: 'center',
    borderRadius: kose.md, borderWidth: 1, borderColor: r.cizgi, backgroundColor: r.yuzey,
  },
  basili: { opacity: 0.72 },
  baslik: { ...tipografi.bodyOrta, color: r.metin, textAlign: 'center' },
  not: { ...tipografi.caption, color: r.metinSolgun, textAlign: 'center' },
  notVurgu: { ...tipografi.captionOrta, color: r.birincil },
  aynaNot: { ...tipografi.caption, color: r.metinSolgun },
  onay: {
    flexDirection: 'row', alignItems: 'center', gap: bosluk.xs, padding: bosluk.xs,
    borderRadius: kose.md, borderWidth: 1, borderColor: r.birincil, backgroundColor: r.birincilYumusak,
  },
  onayEtiket: { ...tipografi.caption, color: r.metinSolgun },
  onayAd: { ...tipografi.bodyOrta, color: r.metin },
});
