// ANALİZ — Pareto, tekrarlayan hata, sisteme göre skor, haftalık eğilim.
//
// NEDEN (24.10.2026, benzer uygulamaların incelenmesi): son kontrol kalite
// panolarının ortak çekirdeği — hata tiplerini sıklığa göre sıralamak
// (Pareto), aynı hatanın birden çok araçta görülmesini ayrı göstermek
// (tekrarlayan hata; "aracın sorunu değil sürecin sorunu") ve skoru zamana
// göre izlemek. Kaynaklar README'de. Hesaplar istatistik.ts'te (testli);
// burada yalnız süzgeç ve çizim.
//
// 26.10.2026: ölçü ekibin Excel'indeki Audit Skoru (sayac.ts); sistemler
// Excel'in SYSTEM listesi. Excel'in Scores sayfası gibi YALNIZ AUDIT
// kaynağını sayar — diğer kaynaklar Excel dışa aktarmasında.
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
  Baslik, BolumBasligi, BosDurum, Ekran, HataKutusu, Kart, Secenek, useDuzen, Yukleniyor,
} from '@/bilesenler/temel';
import {
  haftalikSkor, HataKaydi, pareto, ParetoSatiri, sistemeGore, tekrarlayanlar,
} from '@/cekirdek/istatistik';
import { hataTipiAdi, parcaTamAdi } from '@/cekirdek/katalog';
import { aracEtiketi, ARAC_INDEKS, ARACLAR } from '@/cekirdek/model3d';
import { auditSkoru, skoraGirerMi } from '@/cekirdek/nas';
import { Donem, donemBaslangiclari, donemIcinde, SayacGirdisi, sayacBaslangici } from '@/cekirdek/sayac';
import { bosluk, kose, Renkler, tipografi, useTema, yazi } from '@/tema';
import { istatistikVerisi, sayacVerisi } from '@/veri/depo';
import { useDil } from '@/veri/dilDeposu';
import { useKatalog } from '@/veri/katalogDeposu';

const DONEMLER: { id: Donem; ad: string; en: string }[] = [
  { id: 'buHafta', ad: 'Bu hafta', en: 'This week' }, { id: 'gecenHafta', ad: 'Geçen hafta', en: 'Last week' },
  { id: 'buAy', ad: 'Bu ay', en: 'This month' }, { id: 'buYil', ad: 'Bu yıl', en: 'This year' },
];

const skorMetni = (v: number | null) => (v === null ? '—' : String(v));
// Türkçede yüzde işareti başta: "%20" (dış değerlendirme: "20%" yazıyordu).
const yuzde = (v: number, dil: 'tr' | 'en') => (dil === 'en' ? `${Math.round(v * 100)}%` : `%${Math.round(v * 100)}`);

const GRAFIK_BOY = 150;

export default function Analiz() {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const { tablet } = useDuzen();
  const { dil, t } = useDil();
  // Ekibin eklediği tipler indekse katalogDeposu yüklenince girer; burada
  // yalnız yeniden çizim için okunuyor.
  useKatalog((d) => d.ozelTipler);

  const [donem, setDonem] = useState<Donem>('buAy');
  const [aracId, setAracId] = useState<string>('hepsi');
  // Grafik ölçeklenmez, kabın gerçek genişliğinde çizilir: yazılar her ekranda
  // aynı px (26.10.2026 dış değerlendirme: tablette eksen yazısı kart
  // başlığından büyüktü, telefonda 8 px'ti).
  const [grafikEn, setGrafikEn] = useState(320);
  const [veri, setVeri] = useState<{ girdiler: SayacGirdisi[]; kayitlar: HataKaydi[]; simdi: Date } | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    let iptal = false;
    (async () => {
      try {
        const simdi = new Date();
        // Haftalık grafik son 8 haftayı ister; Ocak'ta o yıl başından
        // öncesine taşar, okuma ikisinden eskisinden başlar.
        const sekizHafta = new Date(donemBaslangiclari(simdi).buHafta.getTime() - 7 * 7 * 86_400_000);
        const enEski = new Date(Math.min(sayacBaslangici(simdi).getTime(), sekizHafta.getTime()));
        const [tumGirdiler, tumKayitlar] = await Promise.all([sayacVerisi(enEski), istatistikVerisi(enEski)]);
        // Excel'in Scores sayfası gibi: yalnız AUDIT kaynağı.
        const girdiler = tumGirdiler.filter((g) => skoraGirerMi(g.kaynak));
        const kayitlar = tumKayitlar.filter((k) => skoraGirerMi(k.kaynak));
        if (!iptal) { setVeri({ girdiler, kayitlar, simdi }); setHata(null); }
      } catch (h) {
        if (!iptal) setHata(h instanceof Error ? h.message : String(h));
      }
    })();
    return () => { iptal = true; };
  }, []));

  const hesap = useMemo(() => {
    if (!veri) return null;
    const sinir = donemBaslangiclari(veri.simdi);
    const aracUyar = (id: string) => aracId === 'hepsi' || id === aracId;
    const icinde = (iso: string) => { const an = new Date(iso); return an <= veri.simdi && donemIcinde(an, donem, sinir); };
    const girdiler = veri.girdiler.filter((g) => aracUyar(g.aracId) && icinde(g.baslangic));
    const kayitlar = veri.kayitlar.filter((k) => aracUyar(k.aracId) && icinde(k.denetimBaslangici));
    const toplam = girdiler.reduce((t, g) => ({ arac: t.arac + 1, hata: t.hata + g.hataAdedi, demerit: t.demerit + g.demerit }),
      { arac: 0, hata: 0, demerit: 0 });
    return {
      toplam,
      skor: auditSkoru(toplam.demerit, toplam.arac),
      pareto: pareto(kayitlar, 10),
      tekrar: tekrarlayanlar(kayitlar, 2, 10),
      sistemler: sistemeGore(kayitlar, toplam.arac),
      haftalar: haftalikSkor(veri.girdiler.filter((g) => aracUyar(g.aracId)), veri.simdi, 8),
    };
  }, [veri, donem, aracId]);

  const aracSecenekleri = useMemo(() => {
    const var_ = new Set((veri?.girdiler ?? []).map((g) => g.aracId));
    return ARACLAR.filter((a) => var_.has(a.id));
  }, [veri]);

  const paretoListesi = (satirlar: ParetoSatiri[], bos: string, tekrar = false) => (
    satirlar.length ? (
      <View style={{ gap: bosluk.xs }}>
        {satirlar.map((p, i) => (
          <View
            key={`${p.parcaId}|${p.hataTipiId}`}
            style={s.paretoSatir}
            accessible
            accessibilityLabel={t(
              `${i + 1}. ${parcaTamAdi(p.parcaId, dil)} ${hataTipiAdi(p.hataTipiId, dil)}: ${p.adet} hata, demerit ${p.demerit}, ${p.aracSayisi} araç${tekrar ? '' : `, birikimli ${yuzde(p.birikimli, dil)}`}`,
              `${i + 1}. ${parcaTamAdi(p.parcaId, dil)} ${hataTipiAdi(p.hataTipiId, dil)}: ${p.adet} ${p.adet === 1 ? 'problem' : 'problems'}, demerit ${p.demerit}, ${p.aracSayisi} ${p.aracSayisi === 1 ? 'vehicle' : 'vehicles'}${tekrar ? '' : `, cumulative ${yuzde(p.birikimli, dil)}`}`,
            )}
          >
            <View style={s.paretoUst}>
              <Text style={s.paretoSira}>{i + 1}</Text>
              <Text style={s.paretoAd} numberOfLines={1}>{parcaTamAdi(p.parcaId, dil)} — {hataTipiAdi(p.hataTipiId, dil)}</Text>
              <Text style={s.paretoSayi}>{p.adet}</Text>
            </View>
            <View style={s.cubukZemin}>
              <View style={[s.cubuk, { width: `${Math.max(2, p.pay * 100)}%` }]} />
            </View>
            <Text style={s.paretoAlt}>
              {t(`${p.aracSayisi} araç · demerit ${p.demerit} · pay ${yuzde(p.pay, dil)}`, `${p.aracSayisi} ${p.aracSayisi === 1 ? 'vehicle' : 'vehicles'} · demerit ${p.demerit} · share ${yuzde(p.pay, dil)}`)}
              {tekrar ? '' : t(` · birikimli ${yuzde(p.birikimli, dil)}`, ` · cumulative ${yuzde(p.birikimli, dil)}`)}
            </Text>
          </View>
        ))}
      </View>
    ) : <Text style={s.bos}>{bos}</Text>
  );

  const haftaGrafigi = (haftalar: ReturnType<typeof haftalikSkor>) => {
    const EN = grafikEn; const BOY = GRAFIK_BOY; const sol = 8; const alt = 34; const ust = 18;
    const enBuyuk = Math.max(1, ...haftalar.map((h) => h.skor ?? 0));
    const sutun = (EN - sol * 2) / haftalar.length;
    const kisaTarih = (d: Date) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
    return (
      <View
        accessible
        accessibilityLabel={`${t('Haftalık audit skoru', 'Weekly audit score')}: ${haftalar.map((h) => `${kisaTarih(h.baslangic)} ${skorMetni(h.skor)}`).join(', ')}`}
      >
        <View style={s.grafik} onLayout={(e) => setGrafikEn(Math.max(200, Math.round(e.nativeEvent.layout.width)))}>
          <Svg width={EN} height={BOY} viewBox={`0 0 ${EN} ${BOY}`} aria-hidden>
            {haftalar.map((h, i) => {
              const x = sol + i * sutun + sutun * 0.2;
              const w = sutun * 0.6;
              const yukseklik = h.skor === null ? 0 : Math.max(2, ((BOY - alt - ust) * h.skor) / enBuyuk);
              const son = i === haftalar.length - 1;
              return (
                <React.Fragment key={h.baslangic.toISOString()}>
                  {h.skor !== null ? (
                    <Rect x={x} y={BOY - alt - yukseklik} width={w} height={yukseklik} rx={2} fill={son ? renkler.birincil : renkler.birincilKoyu} opacity={son ? 0.55 : 1} />
                  ) : (
                    <Rect x={x} y={BOY - alt - 2} width={w} height={2} fill={renkler.cizgiGuclu} />
                  )}
                  <SvgText x={x + w / 2} y={BOY - alt - yukseklik - 4} fontFamily={yazi.orta} fontSize={12} fill={renkler.metinIkincil} textAnchor="middle">
                    {h.skor === null ? '' : skorMetni(h.skor)}
                  </SvgText>
                  <SvgText x={x + w / 2} y={BOY - alt + 14} fontFamily={yazi.normal} fontSize={11} fill={renkler.metinSolgun} textAnchor="middle">
                    {kisaTarih(h.baslangic)}
                  </SvgText>
                  <SvgText x={x + w / 2} y={BOY - alt + 28} fontFamily={yazi.normal} fontSize={11} fill={renkler.metinSolgun} textAnchor="middle">
                    {h.arac ? t(`${h.arac} araç`, `${h.arac} veh`) : '—'}
                  </SvgText>
                </React.Fragment>
              );
            })}
          </Svg>
        </View>
      </View>
    );
  };

  return (
    <Ekran>
      <Baslik baslik={t('Analiz', 'Analysis')} altBaslik={t('Bu cihazdaki denetimler', 'Audits on this device')} />
      {hata ? <View style={{ padding: bosluk.md }}><HataKutusu metin={hata} /></View> : null}
      {!veri || !hesap ? <Yukleniyor metin={t('Hesaplanıyor…', 'Calculating…')} /> : (
        <ScrollView contentContainerStyle={[s.govde, tablet && s.govdeTablet]}>
          {/* Süzgeçler tek satır, sığmazsa yana kayar (26.10.2026 dış değerlendirme:
              "Bu yıl" tek başına ikinci satıra düşüyordu). */}
          <View style={s.suzgecler}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.suzgecSatir}>
              {DONEMLER.map((d) => (
                <Secenek key={d.id} kucuk metin={dil === 'en' ? d.en : d.ad} secili={donem === d.id} onPress={() => setDonem(d.id)} erisimEtiketi={t(`Dönem ${d.ad}`, `Period: ${d.en}`)} />
              ))}
            </ScrollView>
            {aracSecenekleri.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.suzgecSatir}>
                <Secenek kucuk metin={t('Tüm araçlar', 'All vehicles')} secili={aracId === 'hepsi'} onPress={() => setAracId('hepsi')} />
                {aracSecenekleri.map((a) => (
                  <Secenek key={a.id} kucuk metin={a.kod} secili={aracId === a.id} onPress={() => setAracId(a.id)} erisimEtiketi={t(`Araç ${aracEtiketi(a)}`, `Vehicle ${aracEtiketi(a)}`)} />
                ))}
              </ScrollView>
            ) : null}
          </View>

          {hesap.toplam.arac === 0 ? (
            <BosDurum simge={S.rapor} baslik={t('Bu dönemde denetim yok', 'No audits in this period')} aciklama={t('Dönemi genişletin ya da bir denetim başlatın.', 'Choose a longer period or start an audit.')} />
          ) : (
            <>
              <Kart>
                <BolumBasligi
                  metin={t('Özet', 'Summary')}
                  simge={S.analiz}
                  bilgi={t(
                    "Audit skoru = 100 × demerit ÷ araç (Excel'deki tanım). Yalnız AUDIT kaynaklı, bitmiş denetimler.",
                    'Audit score = 100 × demerit ÷ vehicles (as defined in the Excel). Finished AUDIT-source audits only.',
                  )}
                />
                <View style={s.ozetSatir} accessible accessibilityLabel={t(
                  `Özet: ${hesap.toplam.arac} araç, ${hesap.toplam.hata} hata, demerit ${hesap.toplam.demerit}, audit skoru ${skorMetni(hesap.skor)}`,
                  `Summary: ${hesap.toplam.arac} ${hesap.toplam.arac === 1 ? 'vehicle' : 'vehicles'}, ${hesap.toplam.hata} ${hesap.toplam.hata === 1 ? 'problem' : 'problems'}, demerit ${hesap.toplam.demerit}, audit score ${skorMetni(hesap.skor)}`,
                )}>
                  {[
                    [t('Araç', 'Vehicles'), String(hesap.toplam.arac)],
                    [t('Hata', 'Problems'), String(hesap.toplam.hata)],
                    ['Demerit', String(hesap.toplam.demerit)],
                    [t('Skor', 'Score'), skorMetni(hesap.skor)],
                  ].map(([ad, deger]) => (
                    <View key={ad} style={s.ozetHucre}>
                      <Text style={s.ozetDeger}>{deger}</Text>
                      <Text style={s.ozetAd}>{ad}</Text>
                    </View>
                  ))}
                </View>
              </Kart>

              <Kart>
                <BolumBasligi
                  metin={t('Haftalık audit skoru — son 8 hafta', 'Weekly audit score — last 8 weeks')}
                  simge={S.son}
                  bilgi={t('Hafta pazartesi başlar; son sütun içinde bulunulan haftadır, henüz bitmedi.', 'Weeks start on Monday; the last column is the current week, not over yet.')}
                />
                {haftaGrafigi(hesap.haftalar)}
              </Kart>

              <Kart>
                <BolumBasligi
                  metin={t('En sık hatalar (Pareto)', 'Most frequent defects (Pareto)')}
                  simge={S.liste}
                  bilgi={t("Parça + hata tipi, hata adedine göre (demerit'i 0 olanlar dahil). Birikimli pay: ilk kaç satırın toplamın ne kadarını yaptığı.", 'Part + defect type, by problem count (demerit 0 included). Cumulative share: how much of the total the top rows make up.')}
                />
                {paretoListesi(hesap.pareto, t('Bu dönemde hata yok.', 'No problems in this period.'))}
              </Kart>

              <Kart>
                <BolumBasligi
                  metin={t('Tekrarlayan hatalar', 'Recurring defects')}
                  simge={S.uyari}
                  bilgi={t('Aynı parça ve tip en az iki ayrı araçta. Tek araçta birkaç kez görülen hata burada değil: o aracın sorunudur, sürecin değil.', 'Same part and type on at least two different vehicles. A defect repeated on a single vehicle is not listed here: that is a vehicle problem, not a process problem.')}
                />
                {paretoListesi(hesap.tekrar, t('Birden çok araçta görülen hata yok.', 'No defect seen on more than one vehicle.'), true)}
              </Kart>

              <Kart>
                <BolumBasligi
                  metin={t('Sisteme göre', 'By system')}
                  simge={S.arac}
                  bilgi={t("Excel'deki SYSTEM sütunu. Sayı: hata adedi; skor: o sistemin demerit'i dönemin bütün araçlarına bölünerek.", "The Excel SYSTEM column. Number: problem count; score: the system's demerit divided by all vehicles in the period.")}
                />
                {hesap.sistemler.length ? hesap.sistemler.map((x) => (
                  <View key={x.sistem} style={s.sistemSatir} accessible accessibilityLabel={t(`${x.sistem}: ${x.hata} hata, demerit ${x.demerit}, skor ${skorMetni(x.skor)}`, `${x.sistem}: ${x.hata} ${x.hata === 1 ? 'problem' : 'problems'}, demerit ${x.demerit}, score ${skorMetni(x.skor)}`)}>
                    <Text style={s.sistemAd}>{x.sistem}</Text>
                    <View style={s.cubukZemin}>
                      <View style={[s.cubuk, { width: `${Math.max(2, (x.hata / Math.max(1, hesap.toplam.hata)) * 100)}%` }]} />
                    </View>
                    <Text style={s.sistemSayi}>{x.hata}</Text>
                    <Text style={s.sistemDpu}>{t(`demerit ${x.demerit} · skor ${skorMetni(x.skor)}`, `demerit ${x.demerit} · score ${skorMetni(x.skor)}`)}</Text>
                  </View>
                )) : <Text style={s.bos}>{t('Bu dönemde hata yok.', 'No problems in this period.')}</Text>}
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
  suzgecSatir: { flexDirection: 'row', gap: bosluk.xs },
  satir: { flexDirection: 'row', flexWrap: 'wrap', gap: bosluk.xs },
  ozetSatir: { flexDirection: 'row', gap: bosluk.xs },
  ozetHucre: { flex: 1, alignItems: 'center', paddingVertical: bosluk.xs, borderRadius: kose.md, backgroundColor: r.yuzeyAlt },
  ozetDeger: { ...tipografi.sayiBuyuk, color: r.metin },
  ozetAd: { ...tipografi.caption, color: r.metinSolgun },
  grafik: { width: '100%', height: GRAFIK_BOY },
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
  sistemDpu: { ...tipografi.caption, color: r.metinSolgun, paddingLeft: 18 + bosluk.xs },
});
