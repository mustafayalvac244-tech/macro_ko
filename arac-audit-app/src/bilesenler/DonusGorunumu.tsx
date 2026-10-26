// DÖNDÜRÜLEBİLİR ARAÇ (360°) — standart bakışlar arasında döndürme, parçaya dokunma.
//
// Ürün sahibi, 26.10.2026: "Hyundai sitelerinde aracı döndürebiliyoruz; araç
// üstünden parça seçmek için ekleyebilir miyiz?" ve "sol ön garnişe
// tıklayınca o parça seçilsin." Parmak yana kaydıkça (ya da ◀ ▶ ile) sıradaki
// bakış gelir; "Üstten" ayrı düğme. Bakışın parça haritası varsa dokunulan
// PARÇANIN hata ızgarası açılır, çokgen dışına dokunuş yalnız "Bir parçaya
// dokunun" der — tahmin yok. Haritası yoksa dokunulan YÜZÜN bölgesi açılır,
// parça listeden seçilir. Hesap cekirdek/donusGorunumu.ts'te; görseller
// telefonda (veri/aracGorselleri.ts).
//
// KATMAN: görselin üstünde, görselle aynı dikdörtgende bir SVG — kaydı olan
// parçalar hafif boyanır, dokunulan parça kısa bir an vurgulanır. Görsel
// `contain` ile gösterilir; kap ile görselin oranı farklıysa kenar boşlukları
// hesaba katılır (goruntuNoktasi).
//
// ERİŞİLEBİLİRLİK: görüntü ekran okuyucuya kapalı; ◀ ▶ ve "Üstten" adlıdır,
// sistem listesi her zaman altında durur — parçaya o yoldan da gidilir.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image, LayoutChangeEvent, PanResponder, Pressable, StyleSheet, Text, View,
} from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

import { S } from '@/bilesenler/simgeler';
import { Secenek } from '@/bilesenler/temel';
import {
  AracOlcusu, cizimRolu, CizimRolu, dokunusSonucu, gorunumHaritasi, goruntuKutusu, goruntuNoktasi, halka, HalkaGirdisi,
  kaydirmaIndeksi, kaynakHaritasi, sar, yuvaAdi,
} from '@/cekirdek/donusGorunumu';
import { cokgenAlani, GorunumHaritasi, GorunumId } from '@/cekirdek/gorunumParcalari';
import { parcaTamAdi } from '@/cekirdek/katalog';
import { ARAC_INDEKS } from '@/cekirdek/model3d';
import { Bolge } from '@/cekirdek/tipler';
import { bosluk, DOKUNMA, kose, Renkler, tipografi, useTema } from '@/tema';
import { useAracGorselleri, yuvaAdresi } from '@/veri/aracGorselleri';
import { useDil } from '@/veri/dilDeposu';

/** Sahne oranı: ürün sahibinin görselleri 2:1. Farklı orandaki görsel ortalanır. */
const SAHNE_ORANI = 2;
/** Dokunulan parçanın vurgusu görünsün diye geçişten önceki bekleme. */
const VURGU_MS = 220;

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
  const [vurgu, setVurgu] = useState<string | null>(null);
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
        setVurgu(sonuc.parcaId);
        if (zamanlayici.current) clearTimeout(zamanlayici.current);
        zamanlayici.current = setTimeout(() => { setVurgu(null); c.onParcaSec(sonuc.parcaId); }, VURGU_MS);
      } else if (sonuc.tur === 'bolge') {
        if (c.bolgeKimlikleri.has(sonuc.bolgeId)) c.onBolgeSec(sonuc.bolgeId);
      } else if (c.harita) {
        setVurgu(null);
        setIpucu(true);
        if (zamanlayici.current) clearTimeout(zamanlayici.current);
        zamanlayici.current = setTimeout(() => setIpucu(false), 2000);
      }
    },
  }), []);

  if (!gorunum || !kaynak || (cizim ? !harita : !yuvaGorseli)) return null;

  const dondur = (yon: 1 | -1) => {
    setVurgu(null); setIpucu(false);
    // Üst görselden çıkış; üst görseli sonradan temizlenmişse kalan bayrak düşer, halka döner.
    if (ustte) { setUstte(false); if (ustVar) return; }
    setIndeks((i) => sar(i + yon, halkaListesi.length));
  };
  const ad = 'ust' in gorunum ? yuvaAdi('ust', dil) : yuvaAdi(gorunum.girdi.yuva, dil);
  // Dokunulan parça (kısa an), sonra seçili parça; ikisi de yoksa yönerge.
  const isaretli = vurgu ?? seciliParcaId ?? null;
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
            <AracCizimi harita={harita} en={kutu.en} boy={kutu.boy} x={kutu.x} y={kutu.y} renkler={renkler} />
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
                return (
                  <Polygon
                    key={`${a.parcaId}-${i}`}
                    points={a.nokta.map(([x, y]) => `${x * kutu.en},${y * kutu.boy}`).join(' ')}
                    fill={secili ? renkler.birincil : renkler.tehlike}
                    fillOpacity={secili ? 0.45 : 0.22}
                    stroke={secili ? renkler.birincil : renkler.tehlike}
                    strokeWidth={secili ? 2 : 1}
                  />
                );
              })}
            </Svg>
          ) : null}
        </View>
      </View>

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
          onPress={() => { setVurgu(null); setIpucu(false); setUstte(!ustte); }}
          style={{ alignSelf: 'center' }}
        />
      ) : null}
    </View>
  );
}

/**
 * Görseli olmayan bakışın ÇİZİMİ (26.10.2026): parça haritasının çokgenleri,
 * rolüne göre temadan boyanır. Büyük çokgen önce, küçük üstte — dokunuşta da
 * küçük kazanır, yani görülen ile dokunulan aynı. Renkler temadan (iki tema).
 */
function AracCizimi({ harita, en, boy, x, y, renkler }: {
  harita: GorunumHaritasi; en: number; boy: number; x: number; y: number; renkler: Renkler;
}) {
  const sirali = useMemo(
    () => [...harita.alanlar].sort((a, b) => cokgenAlani(b.nokta) - cokgenAlani(a.nokta)),
    [harita],
  );
  const dolgu: Record<CizimRolu, string> = {
    govde: renkler.yuzeyVurgu, cam: renkler.tersYuzey, lastik: renkler.ters, siyah: renkler.tersCizgi,
    gumus: renkler.cizgiGuclu, lamba: renkler.tersMetinSolgun, stop: renkler.uyari, plaka: renkler.yuzey,
  };
  return (
    <Svg width={en} height={boy} style={{ position: 'absolute', left: x, top: y }}>
      {sirali.map((a, i) => (
        <Polygon
          key={`${a.parcaId}-${i}`}
          points={a.nokta.map(([px, py]) => `${px * en},${py * boy}`).join(' ')}
          fill={dolgu[cizimRolu(a.parcaId)]}
          stroke={renkler.cizgiGuclu}
          strokeWidth={0.8}
          strokeLinejoin="round"
        />
      ))}
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
});
