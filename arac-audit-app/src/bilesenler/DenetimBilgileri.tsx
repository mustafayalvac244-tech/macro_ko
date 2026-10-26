// DENETİM BİLGİLERİ — başladıktan sonra künyeyi düzeltmek, denetimi silmek.
//
// Kullanılabilirlik sınaması (üç ajan, web paketi, 28.09.2026): denetçi, faz,
// ekip, spec ve km boş bırakılarak başlatılabiliyordu ve sonradan
// DOLDURULAMIYORDU — rapor künyesi "—" ile kaldı. Yanlış seçilen araç da
// düzeltilemiyordu; denetim silinemiyordu (denetimSil hiçbir ekranda yoktu).
//
// Plaka, km, faz, ekip ve rapor no kaldırıldı (ürün sahibi, 24.10.2026; bkz.
// yeni.tsx). Eski bir denetimde dolu olsalar da burada gösterilmez, KAYDETMEK
// onları SİLMEZ: onKaydet yalnız bu ekrandaki alanları gönderir.
//
// Body no ve Problem Source 24.10.2026'da eklendi (yeni.tsx'teki not). Şasi
// ya da body no'dan biri yeter.
//
// Araç yalnız KAYITLI PARÇALARIN HEPSİ yeni araçta da varsa değişir:
// elektrikli ile benzinlinin parça listesi farklı (şarj kapağı / yakıt
// kapağı); başka araca geçen bir kayıt raporda var olmayan parçayı gösterirdi.

import React, { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { EklenebilirSecim, useSecimListesi } from '@/bilesenler/EklenebilirSecim';
import { S } from '@/bilesenler/simgeler';
import { BilgiKutusu, Dugme, Girdi, HataKutusu, Secenek } from '@/bilesenler/temel';
import { SPECLER } from '@/cekirdek/aracBilgisi';
import { bolgelerAracIcin } from '@/cekirdek/katalog';
import { HAZIR_DENETCILER, HAZIR_KAYNAKLAR, LISTE_ANAHTARI } from '@/cekirdek/listeler';
import { aracEtiketi, ARACLAR } from '@/cekirdek/model3d';
import { Denetim } from '@/cekirdek/tipler';
import { BODY_NO_GIRDI_AZAMI, bodyNoGecerli, bodyNoSadelestir, vinDogrula } from '@/cekirdek/vin';
import { bosluk, kose, Renkler, tipografi, useTema } from '@/tema';
import { useDil } from '@/veri/dilDeposu';

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
  const { dil, t } = useDil();
  const denetciler = useSecimListesi(LISTE_ANAHTARI.denetci, HAZIR_DENETCILER);
  const kaynaklar = useSecimListesi(LISTE_ANAHTARI.kaynak, HAZIR_KAYNAKLAR);

  const [aracId, setAracId] = useState(denetim.aracId);
  const [vinHam, setVinHam] = useState(denetim.vin);
  const [bodyNo, setBodyNo] = useState(denetim.bodyNo ?? '');
  const [kaynak, setKaynak] = useState(denetim.denetimTipi);
  const [spec, setSpec] = useState(denetim.spec);
  const [denetci, setDenetci] = useState(denetim.denetci);
  const [aracUyarisi, setAracUyarisi] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);
  const [silOnay, setSilOnay] = useState(false);
  const [silHatasi, setSilHatasi] = useState<string | null>(null);
  // Onay en altta açılır; kaydırılmazsa "Evet, sil" alttaki çubuğun
  // arkasında kalıyordu (HataSayfasi'ndaki aynı düzeltme).
  const kaydirma = useRef<ScrollView>(null);
  const onayaKaydir = useRef(false);

  const vin = useMemo(() => vinDogrula(vinHam, dil), [vinHam, dil]);
  const vinBos = !vinHam.trim();
  // Excel'in kuralı (tam 6 rakam) yalnız DEĞİŞTİRİLEN body no'ya uygulanır:
  // eski bir kayıttaki harfli body no, başka bir alan düzeltilirken engel olmasın.
  const bodyHatali = bodyNo !== (denetim.bodyNo ?? '') && !!bodyNo && !bodyNoGecerli(bodyNo);
  const kimlikTamam = !bodyHatali && (vinBos ? !!bodyNo : vin.gecerli);

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
    const ad = aracEtiketi(ARACLAR.find((a) => a.id === id), id);
    setAracUyarisi(t(
      `Bu denetimde ${ad} için olmayan parçalara kayıt var; araç değiştirilemez.`,
      `This audit has records on parts that ${ad} doesn't have; the vehicle can't be changed.`,
    ));
  };

  const kaydet = async () => {
    if (!kimlikTamam || calisiyor) return;
    setCalisiyor(true);
    try {
      await onKaydet({
        aracId,
        vin: vinBos ? '' : vin.vin,
        bodyNo,
        denetimTipi: kaynak,
        spec,
        denetci: denetci.trim(),
      });
    } finally {
      setCalisiyor(false);
    }
  };

  const hataSayisi = denetim.hatalar.length;

  return (
    <>
      <View style={s.ust}>
        <Text style={s.baslik}>{t('Denetim bilgileri', 'Audit details')}</Text>
        <Text style={s.not}>
          {t(
            'Rapor künyesinde görünür. Boş bıraktığınız alan raporda "—" olur.',
            'Shown in the report header. Fields left empty appear as "—" in the report.',
          )}
        </Text>
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
        <Text style={s.etiket}>{t('Araç', 'Vehicle')}</Text>
        <View style={s.satir}>
          {ARACLAR.map((a) => (
            <Secenek
              key={a.id}
              metin={aracEtiketi(a)}
              erisimEtiketi={aracUygun.get(a.id)
                ? t(`Araç ${aracEtiketi(a)}`, `Vehicle ${aracEtiketi(a)}`)
                : t(
                  `Araç ${aracEtiketi(a)} — kayıtlı parçalar bu araçta yok`,
                  `Vehicle ${aracEtiketi(a)} — recorded parts not on this vehicle`,
                )}
              secili={aracId === a.id}
              onPress={() => aracSec(a.id)}
              style={{ flexGrow: 1, flexBasis: 140 }}
            />
          ))}
        </View>
        {aracUyarisi ? <BilgiKutusu tur="uyari" metin={aracUyarisi} /> : null}

        <Girdi
          etiket={t('Şasi numarası (VIN)', 'VIN')}
          mono
          value={vin.vin}
          onChangeText={setVinHam}
          autoCapitalize="characters"
          autoCorrect={false}
          spellCheck={false}
          maxLength={40}
          accessibilityLabel={t('Şasi numarası', 'VIN')}
          hata={vinBos
            ? (bodyNo ? undefined : t('Şasi ya da body no girin.', 'Enter a VIN or body no.'))
            : !vin.gecerli ? vin.hatalar.join(' ') : undefined}
        />
        <Girdi
          etiket="Body no"
          mono
          value={bodyNo}
          onChangeText={(x) => setBodyNo(bodyNoSadelestir(x))}
          placeholder={t('6 hane, örn. 015253', '6 digits, e.g. 015253')}
          keyboardType="number-pad"
          autoCorrect={false}
          spellCheck={false}
          maxLength={BODY_NO_GIRDI_AZAMI}
          accessibilityLabel={t('Body numarası', 'Body number')}
          hata={bodyHatali ? t('Body no 6 hane olmalı.', 'Body no must be 6 digits.') : undefined}
        />
        <View style={s.specKm}>
          <View style={{ gap: bosluk.xxs }}>
            <Text style={s.etiket}>Spec</Text>
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
        </View>

        <EklenebilirSecim
          baslik={t('Denetçi', 'Auditor')}
          ad={t('Denetçi', 'Auditor')}
          liste={degeriGoster(denetciler, denetim.denetci)}
          deger={denetci}
          degistir={setDenetci}
          yerTutucu={t('Ad Soyad', 'Full name')}
        />
        {/* Excel'deki PROBLEM SOURCE sütunu. Türkçede "Hata kaynağı" (26.10.2026 dış değerlendirme: tek dil). */}
        <EklenebilirSecim
          baslik={t('Hata kaynağı', 'Problem source')}
          ad={t('Kaynak', 'Source')}
          liste={degeriGoster(kaynaklar, denetim.denetimTipi)}
          deger={kaynak}
          degistir={setKaynak}
          yerTutucu={t('Örn. Durability', 'E.g. Durability')}
        />

        {/* Denetimi silmek iki adımlı ve Kaydet'ten uzakta: hatalarıyla ve
            fotoğraflarıyla birlikte gider, geri getirilemez. */}
        <View style={s.silBolumu}>
          {silHatasi ? <HataKutusu metin={silHatasi} /> : null}
          {!silOnay ? (
            <Dugme
              metin={t('Denetimi sil', 'Delete audit')}
              simge={S.sil}
              onPress={() => { onayaKaydir.current = true; setSilOnay(true); }}
              erisimEtiketi={t('Denetimi sil', 'Delete audit')}
            />
          ) : (
            <View style={s.silOnayKutu}>
              <Text style={s.silOnayMetin}>
                {hataSayisi
                  ? t(
                    `Denetim ${hataSayisi} hatası ve fotoğraflarıyla birlikte silinecek. Geri alınamaz.`,
                    `The audit will be deleted with its ${hataSayisi} ${hataSayisi === 1 ? 'defect' : 'defects'} and photos. This can't be undone.`,
                  )
                  : t('Denetim silinecek. Geri alınamaz.', "The audit will be deleted. This can't be undone.")}
              </Text>
              <View style={s.satir}>
                <Dugme
                  metin={t('Vazgeç', 'Cancel')}
                  tur="sessiz"
                  onPress={() => setSilOnay(false)}
                  style={{ flex: 1 }}
                  erisimEtiketi={t('Silmekten vazgeç', "Don't delete")}
                />
                <Dugme
                  metin={t('Evet, sil', 'Yes, delete')}
                  tur="tehlike"
                  simge={S.sil}
                  onPress={() => {
                    onSil().catch((h) => {
                      const ileti = h instanceof Error ? h.message : String(h);
                      setSilHatasi(t(`Silinemedi: ${ileti}`, `Couldn't delete: ${ileti}`));
                    });
                  }}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={s.eylemler}>
        <Dugme metin={t('Vazgeç', 'Cancel')} tur="sessiz" onPress={onKapat} style={{ flex: 1 }} />
        <Dugme
          metin={t('Kaydet', 'Save')}
          tur="birincil"
          pasif={!kimlikTamam}
          yukleniyor={calisiyor}
          onPress={kaydet}
          style={{ flex: 1 }}
        />
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
  etiket: { ...tipografi.caption, color: r.metinIkincil },
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
