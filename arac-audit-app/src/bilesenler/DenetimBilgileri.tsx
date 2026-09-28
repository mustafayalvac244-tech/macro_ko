// DENETİM BİLGİLERİ — başladıktan sonra künyeyi düzeltmek, denetimi silmek.
//
// Kullanılabilirlik sınaması (üç ajan, web paketi, 28.09.2026): denetçi, faz,
// ekip, spec ve km boş bırakılarak başlatılabiliyordu ve sonradan
// DOLDURULAMIYORDU — rapor künyesi "—" ile kaldı. Yanlış seçilen araç da
// düzeltilemiyordu; denetim silinemiyordu (denetimSil hiçbir ekranda yoktu).
//
// Araç yalnız KAYITLI PARÇALARIN HEPSİ yeni araçta da varsa değişir:
// elektrikli ile benzinlinin parça listesi farklı (şarj kapağı / yakıt
// kapağı); başka araca geçen bir kayıt raporda var olmayan parçayı gösterirdi.

import React, { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { EklenebilirSecim, useSecimListesi } from '@/bilesenler/EklenebilirSecim';
import { S } from '@/bilesenler/simgeler';
import { BilgiKutusu, Dugme, Girdi, HataKutusu, Secenek } from '@/bilesenler/temel';
import { KM_HANE, kmAyikla, kmSadelestir, SPECLER } from '@/cekirdek/aracBilgisi';
import { bolgelerAracIcin } from '@/cekirdek/katalog';
import { HAZIR_DENETCILER, HAZIR_FAZLAR, LISTE_ANAHTARI } from '@/cekirdek/listeler';
import { ARACLAR } from '@/cekirdek/model3d';
import { Denetim } from '@/cekirdek/tipler';
import { plakaDogrula, vinDogrula } from '@/cekirdek/vin';
import { bosluk, kose, Renkler, tipografi, useTema } from '@/tema';

type SecimListesi = ReturnType<typeof useSecimListesi>;

/**
 * Listeden sonradan kaldırılmış bir ad bu denetimde yazılıysa ekranda da
 * görünsün. Liste KALICI olarak değişmez; yalnız bu ekranda eklenir.
 */
function degeriGoster(liste: SecimListesi, deger: string): SecimListesi {
  return deger && !liste.liste.includes(deger) ? { ...liste, liste: [...liste.liste, deger] } : liste;
}

export function DenetimBilgileri({
  denetim, onKaydet, onSil, onKapat,
}: {
  denetim: Denetim;
  onKaydet: (alanlar: Partial<Denetim>) => Promise<void>;
  onSil: () => Promise<void>;
  onKapat: () => void;
}) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const denetciler = useSecimListesi(LISTE_ANAHTARI.denetci, HAZIR_DENETCILER);
  const fazlar = useSecimListesi(LISTE_ANAHTARI.faz, HAZIR_FAZLAR);

  const [aracId, setAracId] = useState(denetim.aracId);
  const [vinHam, setVinHam] = useState(denetim.vin);
  const [plakaHam, setPlakaHam] = useState(denetim.plaka);
  const [spec, setSpec] = useState(denetim.spec);
  const [kmHam, setKmHam] = useState(denetim.km === null ? '' : String(denetim.km));
  const [denetci, setDenetci] = useState(denetim.denetci);
  const [faz, setFaz] = useState(denetim.faz);
  const [ekip, setEkip] = useState(denetim.ekip);
  const [raporNo, setRaporNo] = useState(denetim.raporNo);
  const [aracUyarisi, setAracUyarisi] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);
  const [silOnay, setSilOnay] = useState(false);
  const [silHatasi, setSilHatasi] = useState<string | null>(null);
  // Onay en altta açılır; kaydırılmazsa "Evet, sil" alttaki çubuğun
  // arkasında kalıyordu (HataSayfasi'ndaki aynı düzeltme).
  const kaydirma = useRef<ScrollView>(null);
  const onayaKaydir = useRef(false);

  const vin = useMemo(() => vinDogrula(vinHam), [vinHam]);

  /** Kayıtlı parçaların hepsi bu araçta da var mı? */
  const aracUygun = useMemo(() => {
    const parcalar = [...new Set(denetim.hatalar.map((h) => h.parcaId))];
    const m = new Map<string, boolean>();
    for (const a of ARACLAR) {
      const var_ = new Set(bolgelerAracIcin({ tip: a.tip }).flatMap((b) => b.parcalar.map((p) => p.id)));
      m.set(a.id, parcalar.every((pid) => var_.has(pid)));
    }
    return m;
  }, [denetim.hatalar]);

  const aracSec = (id: string) => {
    if (aracUygun.get(id)) {
      setAracId(id);
      setAracUyarisi(null);
      return;
    }
    const ad = ARACLAR.find((a) => a.id === id)?.ad ?? id;
    setAracUyarisi(`Bu denetimde ${ad} için olmayan parçalara kayıt var; araç değiştirilemez.`);
  };

  const kaydet = async () => {
    if (!vin.gecerli || calisiyor) return;
    setCalisiyor(true);
    try {
      await onKaydet({
        aracId,
        vin: vin.vin,
        plaka: plakaDogrula(plakaHam).bicimli,
        spec,
        km: kmAyikla(kmHam),
        denetci: denetci.trim(),
        faz: faz.trim(),
        ekip: ekip.trim(),
        raporNo: raporNo.trim(),
      });
    } finally {
      setCalisiyor(false);
    }
  };

  const hataSayisi = denetim.hatalar.length;

  return (
    <>
      <View style={s.ust}>
        <Text style={s.baslik}>Denetim bilgileri</Text>
        <Text style={s.not}>Rapor künyesinde görünür. Boş bıraktığınız alan raporda "—" olur.</Text>
      </View>

      <ScrollView
        ref={kaydirma}
        style={s.kaydir}
        contentContainerStyle={s.govde}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => {
          if (!onayaKaydir.current) return;
          onayaKaydir.current = false;
          kaydirma.current?.scrollToEnd({ animated: true });
        }}
      >
        <Text style={s.etiket}>ARAÇ</Text>
        <View style={s.satir}>
          {ARACLAR.map((a) => (
            <Secenek
              key={a.id}
              metin={a.ad}
              erisimEtiketi={aracUygun.get(a.id) ? `Araç ${a.ad}` : `Araç ${a.ad} — kayıtlı parçalar bu araçta yok`}
              secili={aracId === a.id}
              onPress={() => aracSec(a.id)}
              style={{ flexGrow: 1, flexBasis: 90 }}
            />
          ))}
        </View>
        {aracUyarisi ? <BilgiKutusu tur="uyari" metin={aracUyarisi} /> : null}

        <Girdi
          etiket="ŞASİ NUMARASI (VIN)"
          mono
          value={vin.vin}
          onChangeText={setVinHam}
          autoCapitalize="characters"
          autoCorrect={false}
          spellCheck={false}
          maxLength={40}
          accessibilityLabel="Şasi numarası"
          hata={!vin.gecerli ? vin.hatalar.join(' ') : undefined}
        />
        <Girdi
          etiket="PLAKA (VARSA)"
          value={plakaHam}
          onChangeText={setPlakaHam}
          placeholder="Örn. 41 ABC 12"
          autoCapitalize="characters"
          accessibilityLabel="Plaka"
        />
        <View style={s.specKm}>
          <View style={{ gap: bosluk.xxs }}>
            <Text style={s.etiket}>SPEC</Text>
            <View style={s.satir}>
              {SPECLER.map((x) => (
                <Secenek
                  key={x}
                  metin={x}
                  erisimEtiketi={`Spec ${x}`}
                  secili={spec === x}
                  onPress={() => setSpec(spec === x ? '' : x)}
                  style={{ minWidth: 72 }}
                />
              ))}
            </View>
          </View>
          <View style={{ flex: 1, minWidth: 140 }}>
            <Girdi
              etiket="KM"
              value={kmHam}
              onChangeText={(t) => setKmHam(kmSadelestir(t))}
              placeholder="Göstergedeki değer"
              keyboardType="number-pad"
              maxLength={KM_HANE}
              accessibilityLabel="Kilometre"
            />
          </View>
        </View>

        <EklenebilirSecim
          baslik="DENETÇİ"
          ad="Denetçi"
          liste={degeriGoster(denetciler, denetim.denetci)}
          deger={denetci}
          degistir={setDenetci}
          yerTutucu="Ad Soyad"
        />
        <EklenebilirSecim
          baslik="FAZ"
          ad="Faz"
          liste={degeriGoster(fazlar, denetim.faz)}
          deger={faz}
          degistir={setFaz}
          yerTutucu="Örn. P1"
          buyukHarf
        />
        <Girdi etiket="EKİP" value={ekip} onChangeText={setEkip} placeholder="Örn. QE Team 2" />
        <Girdi etiket="RAPOR NO" value={raporNo} onChangeText={setRaporNo} placeholder="İsteğe bağlı" />

        {/* Denetimi silmek iki adımlı ve Kaydet'ten uzakta: hatalarıyla ve
            fotoğraflarıyla birlikte gider, geri getirilemez. */}
        <View style={s.silBolumu}>
          {silHatasi ? <HataKutusu metin={silHatasi} /> : null}
          {!silOnay ? (
            <Dugme metin="Denetimi sil" simge={S.sil} onPress={() => { onayaKaydir.current = true; setSilOnay(true); }} erisimEtiketi="Denetimi sil" />
          ) : (
            <View style={s.silOnayKutu}>
              <Text style={s.silOnayMetin}>
                {hataSayisi
                  ? `Denetim ${hataSayisi} hatası ve fotoğraflarıyla birlikte silinecek. Geri alınamaz.`
                  : 'Denetim silinecek. Geri alınamaz.'}
              </Text>
              <View style={s.satir}>
                <Dugme metin="Vazgeç" tur="sessiz" onPress={() => setSilOnay(false)} style={{ flex: 1 }} erisimEtiketi="Silmekten vazgeç" />
                <Dugme
                  metin="Evet, sil"
                  tur="tehlike"
                  simge={S.sil}
                  onPress={() => { onSil().catch((h) => setSilHatasi(`Silinemedi: ${h instanceof Error ? h.message : String(h)}`)); }}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={s.eylemler}>
        <Dugme metin="Vazgeç" tur="sessiz" onPress={onKapat} style={{ flex: 1 }} />
        <Dugme metin="Kaydet" tur="birincil" pasif={!vin.gecerli} yukleniyor={calisiyor} onPress={kaydet} style={{ flex: 1 }} />
      </View>
    </>
  );
}

const stiller = (r: Renkler) => StyleSheet.create({
  ust: { paddingHorizontal: bosluk.md, gap: 2 },
  baslik: { ...tipografi.h2, color: r.metin },
  not: { ...tipografi.caption, color: r.metinSolgun },
  kaydir: { flexGrow: 1 },
  govde: { padding: bosluk.md, gap: bosluk.sm },
  etiket: { ...tipografi.etiket, color: r.metinSolgun },
  satir: { flexDirection: 'row', flexWrap: 'wrap', gap: bosluk.xs },
  specKm: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: bosluk.sm },
  silBolumu: { marginTop: bosluk.lg, paddingTop: bosluk.md, borderTopWidth: 1, borderTopColor: r.cizgiSolgun },
  silOnayKutu: {
    gap: bosluk.sm, padding: bosluk.sm, borderRadius: kose.md,
    borderWidth: 1, borderColor: r.tehlike, backgroundColor: r.tehlikeYumusak,
  },
  silOnayMetin: { ...tipografi.bodyOrta, color: r.tehlike },
  eylemler: {
    flexDirection: 'row', gap: bosluk.xs, padding: bosluk.md,
    borderTopWidth: 1, borderTopColor: r.cizgiSolgun, backgroundColor: r.bgYukseltilmis,
  },
});
