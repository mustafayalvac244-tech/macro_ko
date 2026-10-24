// ANALİZ — Pareto, tekrarlayan hata, sisteme göre DPU, haftalık eğilim.
//
// NEDEN (24.10.2026, benzer uygulamaların incelenmesi): son kontrol kalite
// panolarının ortak çekirdeği — hata tiplerini sıklığa göre sıralamak
// (Pareto), aynı hatanın birden çok araçta görülmesini ayrı göstermek
// (tekrarlayan hata; "aracın sorunu değil sürecin sorunu") ve DPU'yu zamana
// göre izlemek. Kaynaklar README'de. Hesaplar istatistik.ts'te (testli);
// burada yalnız süzgeç ve çizim.
//
// KAPSAM: yalnız bu cihazın kayıtları. Dönem süzgeci DENETİMİN başlangıcına
// göre (sayaçla aynı tanım). Haftalık eğilim dönemden bağımsız, hep son 8
// hafta; içinde bulunulan hafta bitmemiştir ve öyle etiketlenir.

import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

import { S } from '@/bilesenler/simgeler';
import {
  Baslik, BolumBasligi, BosDurum, Ekran, GeriDugmesi, HataKutusu, Kart, Secenek, useDuzen, Yukleniyor,
} from '@/bilesenler/temel';
import {
  haftalikDpu, HataKaydi, pareto, ParetoSatiri, sistemeGore, tekrarlayanlar,
} from '@/cekirdek/istatistik';
import { HATA_TIPI_INDEKS, parcaTamAdi } from '@/cekirdek/katalog';
import { ARAC_INDEKS, ARACLAR } from '@/cekirdek/model3d';
import { Donem, donemBaslangiclari, dpu, SayacGirdisi } from '@/cekirdek/sayac';
import { parcaSistemi, SISTEMLER, sistemAdi } from '@/cekirdek/sistemler';
import { bosluk, kose, Renkler, tipografi, useTema, yazi } from '@/tema';
import { istatistikVerisi, sayacVerisi } from '@/veri/depo';
import { useKatalog } from '@/veri/katalogDeposu';

const DONEMLER: { id: Donem; ad: string }[] = [
  { id: 'buHafta', ad: 'Bu hafta' }, { id: 'buAy', ad: 'Bu ay' }, { id: 'buYil', ad: 'Bu yıl' },
];

const dpuMetni = (v: number | null) => (v === null ? '—' : v.toFixed(2).replace('.', ','));
const yuzde = (v: number) => `${Math.round(v * 100)}%`;

export default function Analiz() {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const { tablet } = useDuzen();
  // Ekibin eklediği tipler indekse katalogDeposu yüklenince girer; burada
  // yalnız yeniden çizim için okunuyor.
  useKatalog((d) => d.ozelTipler);

  const [donem, setDonem] = useState<Donem>('buAy');
  const [aracId, setAracId] = useState<string>('hepsi');
  const [veri, setVeri] = useState<{ girdiler: SayacGirdisi[]; kayitlar: HataKaydi[]; simdi: Date } | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    let iptal = false;
    (async () => {
      try {
        const simdi = new Date();
        const yilBasi = donemBaslangiclari(simdi).buYil;
        const [girdiler, kayitlar] = await Promise.all([sayacVerisi(yilBasi), istatistikVerisi(yilBasi)]);
        if (!iptal) { setVeri({ girdiler, kayitlar, simdi }); setHata(null); }
      } catch (h) {
        if (!iptal) setHata(h instanceof Error ? h.message : String(h));
      }
    })();
    return () => { iptal = true; };
  }, []));

  const hesap = useMemo(() => {
    if (!veri) return null;
    const sinir = donemBaslangiclari(veri.simdi)[donem];
    const aracUyar = (id: string) => aracId === 'hepsi' || id === aracId;
    const girdiler = veri.girdiler.filter((g) => aracUyar(g.aracId) && new Date(g.baslangic) >= sinir);
    const kayitlar = veri.kayitlar.filter((k) => aracUyar(k.aracId) && new Date(k.denetimBaslangici) >= sinir);
    const toplam = girdiler.reduce((t, g) => ({ arac: t.arac + 1, hata: t.hata + g.hataAdedi, duzeltilecek: t.duzeltilecek + g.duzeltilecekAdedi }),
      { arac: 0, hata: 0, duzeltilecek: 0 });
    return {
      toplam,
      dpu: dpu(toplam),
      pareto: pareto(kayitlar, 10),
      tekrar: tekrarlayanlar(kayitlar, 2, 10),
      sistemler: sistemeGore(kayitlar, parcaSistemi, toplam.arac, SISTEMLER.map((x) => x.id)),
      haftalar: haftalikDpu(veri.girdiler.filter((g) => aracUyar(g.aracId)), veri.simdi, 8),
    };
  }, [veri, donem, aracId]);

  const aracSecenekleri = useMemo(() => {
    const var_ = new Set((veri?.girdiler ?? []).map((g) => g.aracId));
    return ARACLAR.filter((a) => var_.has(a.id));
  }, [veri]);

  const hataTipiAdi = (id: string) => HATA_TIPI_INDEKS[id]?.ad ?? id;

  const paretoListesi = (satirlar: ParetoSatiri[], bos: string, tekrar = false) => (
    satirlar.length ? (
      <View style={{ gap: bosluk.xs }}>
        {satirlar.map((p, i) => (
          <View
            key={`${p.parcaId}|${p.hataTipiId}`}
            style={s.paretoSatir}
            accessible
            accessibilityLabel={`${i + 1}. ${parcaTamAdi(p.parcaId)} ${hataTipiAdi(p.hataTipiId)}: ${p.adet} hata, ${p.aracSayisi} araç${tekrar ? '' : `, birikimli ${yuzde(p.birikimli)}`}`}
          >
            <View style={s.paretoUst}>
              <Text style={s.paretoSira}>{i + 1}</Text>
              <Text style={s.paretoAd} numberOfLines={1}>{parcaTamAdi(p.parcaId)} — {hataTipiAdi(p.hataTipiId)}</Text>
              <Text style={s.paretoSayi}>{p.adet}</Text>
            </View>
            <View style={s.cubukZemin}>
              <View style={[s.cubuk, { width: `${Math.max(2, p.pay * 100)}%` }]} />
            </View>
            <Text style={s.paretoAlt}>
              {p.aracSayisi} araç · pay {yuzde(p.pay)}{tekrar ? '' : ` · birikimli ${yuzde(p.birikimli)}`}
            </Text>
          </View>
        ))}
      </View>
    ) : <Text style={s.bos}>{bos}</Text>
  );

  const haftaGrafigi = (haftalar: ReturnType<typeof haftalikDpu>) => {
    const EN = 320; const BOY = 120; const sol = 8; const alt = 26; const ust = 14;
    const enBuyuk = Math.max(0.01, ...haftalar.map((h) => h.dpu ?? 0));
    const sutun = (EN - sol * 2) / haftalar.length;
    const kisaTarih = (d: Date) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
    return (
      <View
        accessible
        accessibilityLabel={`Haftalık DPU: ${haftalar.map((h) => `${kisaTarih(h.baslangic)} ${dpuMetni(h.dpu)}`).join(', ')}`}
      >
        <View style={s.grafik}>
          <Svg width="100%" height="100%" viewBox={`0 0 ${EN} ${BOY}`} aria-hidden>
            {haftalar.map((h, i) => {
              const x = sol + i * sutun + sutun * 0.2;
              const w = sutun * 0.6;
              const yukseklik = h.dpu === null ? 0 : Math.max(2, ((BOY - alt - ust) * h.dpu) / enBuyuk);
              const son = i === haftalar.length - 1;
              return (
                <React.Fragment key={h.baslangic.toISOString()}>
                  {h.dpu !== null ? (
                    <Rect x={x} y={BOY - alt - yukseklik} width={w} height={yukseklik} rx={2} fill={son ? renkler.birincil : renkler.birincilKoyu} opacity={son ? 0.55 : 1} />
                  ) : (
                    <Rect x={x} y={BOY - alt - 2} width={w} height={2} fill={renkler.cizgiGuclu} />
                  )}
                  <SvgText x={x + w / 2} y={BOY - alt - yukseklik - 4} fontFamily={yazi.orta} fontSize={9} fill={renkler.metinIkincil} textAnchor="middle">
                    {h.dpu === null ? '' : dpuMetni(h.dpu)}
                  </SvgText>
                  <SvgText x={x + w / 2} y={BOY - alt + 12} fontFamily={yazi.normal} fontSize={8} fill={renkler.metinSolgun} textAnchor="middle">
                    {kisaTarih(h.baslangic)}
                  </SvgText>
                  <SvgText x={x + w / 2} y={BOY - alt + 22} fontFamily={yazi.normal} fontSize={8} fill={renkler.metinSolgun} textAnchor="middle">
                    {h.arac ? `${h.arac} araç` : '—'}
                  </SvgText>
                </React.Fragment>
              );
            })}
          </Svg>
        </View>
        <Text style={s.not}>Hafta pazartesi başlar; son sütun içinde bulunulan haftadır, henüz bitmedi.</Text>
      </View>
    );
  };

  return (
    <Ekran>
      <Baslik baslik="Analiz" altBaslik="Bu cihazdaki denetimler" sol={<GeriDugmesi />} />
      {hata ? <View style={{ padding: bosluk.md }}><HataKutusu metin={hata} /></View> : null}
      {!veri || !hesap ? <Yukleniyor metin="Hesaplanıyor…" /> : (
        <ScrollView contentContainerStyle={[s.govde, tablet && s.govdeTablet]}>
          <View style={s.suzgecler}>
            <View style={s.satir}>
              {DONEMLER.map((d) => (
                <Secenek key={d.id} metin={d.ad} secili={donem === d.id} onPress={() => setDonem(d.id)} erisimEtiketi={`Dönem ${d.ad}`} />
              ))}
            </View>
            {aracSecenekleri.length > 1 ? (
              <View style={s.satir}>
                <Secenek metin="Tüm araçlar" secili={aracId === 'hepsi'} onPress={() => setAracId('hepsi')} />
                {aracSecenekleri.map((a) => (
                  <Secenek key={a.id} metin={a.ad} secili={aracId === a.id} onPress={() => setAracId(a.id)} erisimEtiketi={`Araç ${a.ad}`} />
                ))}
              </View>
            ) : null}
          </View>

          {hesap.toplam.arac === 0 ? (
            <BosDurum simge={S.rapor} baslik="Bu dönemde denetim yok" aciklama="Dönemi genişletin ya da bir denetim başlatın." />
          ) : (
            <>
              <Kart>
                <BolumBasligi metin="ÖZET" simge={S.tarih} />
                <View style={s.ozetSatir} accessible accessibilityLabel={`Özet: ${hesap.toplam.arac} araç, ${hesap.toplam.hata} hata, ${hesap.toplam.duzeltilecek} düzeltilecek, DPU ${dpuMetni(hesap.dpu)}`}>
                  {[
                    ['Araç', String(hesap.toplam.arac)],
                    ['Hata', String(hesap.toplam.hata)],
                    ['Düzeltilecek', String(hesap.toplam.duzeltilecek)],
                    ['DPU', dpuMetni(hesap.dpu)],
                  ].map(([ad, deger]) => (
                    <View key={ad} style={s.ozetHucre}>
                      <Text style={s.ozetDeger}>{deger}</Text>
                      <Text style={s.ozetAd}>{ad}</Text>
                    </View>
                  ))}
                </View>
                <Text style={s.not}>DPU: araç başına düzeltilecek hata (kabul edilebilirler hariç). {aracId === 'hepsi' ? '' : `Yalnız ${ARAC_INDEKS[aracId]?.ad ?? aracId}.`}</Text>
              </Kart>

              <Kart>
                <BolumBasligi metin="HAFTALIK DPU — SON 8 HAFTA" simge={S.son} />
                {haftaGrafigi(hesap.haftalar)}
              </Kart>

              <Kart>
                <BolumBasligi metin="EN SIK HATALAR (PARETO)" simge={S.liste} />
                <Text style={s.not}>Parça + hata tipi, düzeltilecek adede göre. Birikimli pay: ilk kaç satırın toplamın ne kadarını yaptığı.</Text>
                {paretoListesi(hesap.pareto, 'Bu dönemde düzeltilecek hata yok.')}
              </Kart>

              <Kart>
                <BolumBasligi metin="TEKRARLAYAN HATALAR" simge={S.uyari} />
                <Text style={s.not}>Aynı parça ve tip en az iki ayrı araçta. Tek araçta birkaç kez görülen hata burada değil: o aracın sorunudur, sürecin değil.</Text>
                {paretoListesi(hesap.tekrar, 'Birden çok araçta görülen hata yok.', true)}
              </Kart>

              <Kart>
                <BolumBasligi metin="SİSTEME GÖRE" simge={S.arac} />
                {hesap.sistemler.length ? hesap.sistemler.map((x) => (
                  <View key={x.sistem} style={s.sistemSatir} accessible accessibilityLabel={`${sistemAdi(x.sistem)}: ${x.hata} hata, ${x.duzeltilecek} düzeltilecek, DPU ${dpuMetni(x.dpu)}`}>
                    <Text style={s.sistemAd}>{sistemAdi(x.sistem)}</Text>
                    <View style={s.cubukZemin}>
                      <View style={[s.cubuk, { width: `${Math.max(2, (x.duzeltilecek / Math.max(1, hesap.toplam.duzeltilecek)) * 100)}%` }]} />
                    </View>
                    <Text style={s.sistemSayi}>{x.duzeltilecek}<Text style={s.sistemSayiAlt}>/{x.hata}</Text></Text>
                    <Text style={s.sistemDpu}>DPU {dpuMetni(x.dpu)}</Text>
                  </View>
                )) : <Text style={s.bos}>Bu dönemde hata yok.</Text>}
                <Text style={s.not}>Sayı: düzeltilecek / toplam hata.</Text>
              </Kart>
            </>
          )}
        </ScrollView>
      )}
    </Ekran>
  );
}

const stiller = (r: Renkler) => StyleSheet.create({
  govde: { padding: bosluk.md, gap: bosluk.md, paddingBottom: bosluk.xxxl },
  govdeTablet: { width: '100%', maxWidth: 900, alignSelf: 'center' },
  suzgecler: { gap: bosluk.xs },
  satir: { flexDirection: 'row', flexWrap: 'wrap', gap: bosluk.xs },
  ozetSatir: { flexDirection: 'row', gap: bosluk.xs },
  ozetHucre: { flex: 1, alignItems: 'center', paddingVertical: bosluk.xs, borderRadius: kose.md, backgroundColor: r.yuzeyAlt },
  ozetDeger: { ...tipografi.sayiBuyuk, color: r.metin },
  ozetAd: { ...tipografi.caption, color: r.metinSolgun },
  grafik: { width: '100%', aspectRatio: 320 / 120 },
  not: { ...tipografi.caption, color: r.metinSolgun },
  bos: { ...tipografi.body, color: r.metinSolgun, paddingVertical: bosluk.xs },
  paretoSatir: { gap: 3 },
  paretoUst: { flexDirection: 'row', alignItems: 'center', gap: bosluk.xs },
  paretoSira: { ...tipografi.captionOrta, color: r.metinSolgun, width: 18, textAlign: 'right', fontVariant: ['tabular-nums'] },
  paretoAd: { ...tipografi.bodyOrta, color: r.metin, flex: 1, minWidth: 0 },
  paretoSayi: { ...tipografi.sayi, color: r.metin },
  paretoAlt: { ...tipografi.caption, color: r.metinSolgun, paddingLeft: 18 + bosluk.xs },
  cubukZemin: { height: 6, borderRadius: kose.pill, backgroundColor: r.yuzeyAlt, overflow: 'hidden', marginLeft: 18 + bosluk.xs },
  cubuk: { height: '100%', borderRadius: kose.pill, backgroundColor: r.birincil },
  sistemSatir: { gap: 3, paddingVertical: 2 },
  sistemAd: { ...tipografi.bodyOrta, color: r.metin },
  sistemSayi: { ...tipografi.sayi, color: r.metin, position: 'absolute', right: 0, top: 0 },
  sistemSayiAlt: { ...tipografi.caption, color: r.metinSolgun },
  sistemDpu: { ...tipografi.caption, color: r.metinSolgun, paddingLeft: 18 + bosluk.xs },
});
