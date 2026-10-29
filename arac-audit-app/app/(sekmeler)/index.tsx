import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { GuncelleDugmesi, GuncellemeBildirimi } from '@/bilesenler/Guncelleme';
import { Sayac } from '@/bilesenler/Sayac';
import { S } from '@/bilesenler/simgeler';
import {
  AramaKutusu, Baslik, BolumBasligi, BosDurum, Dugme, Ekran,
  HataKutusu, IlerlemeCubugu, Rozet, Secenek, useDuzen, Yukleniyor,
} from '@/bilesenler/temel';
import { aramaSadelestir } from '@/cekirdek/arama';
import { hataMetni } from '@/cekirdek/hataMetni';
import { bolgelerAracIcin } from '@/cekirdek/katalog';
import { aracEtiketi, ARAC_INDEKS, ARACLAR } from '@/cekirdek/model3d';
import { kapsamDurumu, mevcutSistemler } from '@/cekirdek/sistemler';
import { bicimTarih } from '@/cekirdek/rapor';
import { aracKimligi } from '@/cekirdek/vin';
import { sureDakika, sureMetni } from '@/cekirdek/istatistik';
import { sayacBaslangici, sayacHesapla, SayacSonucu } from '@/cekirdek/sayac';
import { bosluk, kose, Renkler, tipografi, useTema } from '@/tema';
import { DenetimOzetSatiri, denetimleriListele, sayacVerisi } from '@/veri/depo';
import { useDil } from '@/veri/dilDeposu';

/** Ana sayfada okunan en fazla denetim. Özet sayılar da yalnız bunlardan. */
const LISTE_SINIRI = 200;

export default function DenetimListesi() {
  const router = useRouter();
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const { tablet } = useDuzen();
  const { dil, t } = useDil();

  const [satirlar, setSatirlar] = useState<DenetimOzetSatiri[] | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [sayac, setSayac] = useState<SayacSonucu | null>(null);
  // ARAMA VE SÜZGEÇ (28.09.2026): ekip lideri 200 kayıtta bir şasiyi bulmak
  // için tablette ~16, telefonda ~37 ekran kaydırmak zorundaydı (sınama; 3
  // kayıtla ölçülüp hesaplandı). Şasi son haneleriyle de bulunur: eşleşme
  // kelime başından değil, İÇİNDEN.
  const [arama, setArama] = useState('');
  const [suzgec, setSuzgec] = useState<'hepsi' | 'devam' | 'tamam'>('hepsi');

  // Ekrana her dönüşte tazele: denetim ekranından çıkınca liste güncel olmalı.
  useFocusEffect(useCallback(() => {
    let iptal = false;
    (async () => {
      try {
        const simdi = new Date();
        const [liste, sayilacak] = await Promise.all([
          denetimleriListele(LISTE_SINIRI),
          sayacVerisi(sayacBaslangici(simdi)),
        ]);
        if (iptal) return;
        setSatirlar(liste);
        setSayac(sayacHesapla(sayilacak, simdi, ARACLAR.map((a) => a.id)));
        setHata(null);
      } catch (h) {
        if (!iptal) setHata(hataMetni(h, dil));
      }
    })();
    return () => { iptal = true; };
  }, [dil]));

  const yeniDenetim = () => router.push('/yeni');

  const gorunen = useMemo(() => {
    const sozcukler = aramaSadelestir(arama).split(' ').filter(Boolean);
    return (satirlar ?? []).filter((d) => {
      if (suzgec !== 'hepsi' && d.durum !== suzgec) return false;
      if (!sozcukler.length) return true;
      const metin = aramaSadelestir([
        d.vin, d.bodyNo, ARAC_INDEKS[d.aracId]?.ad, ARAC_INDEKS[d.aracId]?.kod, d.spec, d.denetci, bicimTarih(d.baslangic),
      ].filter(Boolean).join(' '));
      return sozcukler.every((q) => metin.includes(q));
    });
  }, [satirlar, arama, suzgec]);

  const devamSayisi = (satirlar ?? []).filter((d) => d.durum === 'devam').length;
  const tamamSayisi = (satirlar ?? []).length - devamSayisi;

  // Bitmiş denetimin kartı RAPORU açar: önceden çalışma ekranı açılıyor ve
  // raporu görmek isteyen biri yanlışlıkla kayıt ekleyebiliyordu (sınama).
  const kartiAc = (d: DenetimOzetSatiri) => (d.durum === 'tamam'
    ? router.push({ pathname: '/denetim/rapor', params: { id: d.id, kaynak: 'ana' } })
    : router.push({ pathname: '/denetim/[id]', params: { id: d.id } }));

  const ust = (
    <View style={s.ust}>
      {/* Arka planda yeni sürüm indiyse (OTA). Web'de ve inen sürüm yokken
          hiçbir şey çizmez. */}
      <GuncellemeBildirimi />

      {/* Sayfanın ana eylemi: tek, büyük düğme. 25.10.2026'ya kadar koyu bir
          "kahraman" kartın içindeydi (başlık + açıklama + düğme); ürün sahibi
          arayüzü beğenmedi, kart ekranı ağırlaştırıyordu. Akışın anlatımı ilk
          açılıştaki boş durumda zaten var. */}
      <Dugme
        metin={t('Yeni denetim', 'New audit')}
        tur="birincil"
        simge={S.ekle}
        onPress={yeniDenetim}
        style={tablet ? s.yeniDugmeTablet : s.yeniDugme}
      />

      {/* Özet sayı kutuları ve sunucu uyarı kutusu kaldırıldı (ürün sahibi,
          28.09.2026: "çok kalabalık olmasın"). Kayıtların yalnız cihazda
          olduğu başlığın alt satırında ve Ayarlar → Veri'de yazıyor; eskiden
          burada yazan "bağlantı gelince gönderilecek" cümlesi YANLIŞTI —
          gönderen kod yok (27.09.2026). */}

      {/* Analiz artık alt sekmede; sayaçtaki kısayol düğmesi kalktı. */}
      {sayac ? <Sayac sonuc={sayac} /> : null}

      {satirlar?.length ? (
        <View style={s.aramaBlok}>
          <AramaKutusu
            deger={arama}
            degistir={setArama}
            // Kısa: telefonda uzun yer tutucu kesiliyordu (dış değerlendirme).
            yerTutucu={t('Şasi, body no ya da araç ara', 'Search VIN, body no or vehicle')}
            erisimEtiketi={t('Denetim ara', 'Search audits')}
          />
          <View style={s.suzgecSatir}>
            {([
              ['hepsi', t(`Tümü ${satirlar.length}`, `All ${satirlar.length}`)],
              ['devam', t(`Devam eden ${devamSayisi}`, `In progress ${devamSayisi}`)],
              ['tamam', t(`Tamamlanan ${tamamSayisi}`, `Completed ${tamamSayisi}`)],
            ] as const).map(([k, metin]) => (
              <Secenek key={k} metin={metin} secili={suzgec === k} onPress={() => setSuzgec(k)} kucuk />
            ))}
          </View>
          <BolumBasligi
            metin={t('Kayıtlar', 'Records')}
            simge={S.liste}
            sag={(
              <Text style={s.sayac}>
                {satirlar.length >= LISTE_SINIRI && gorunen.length === satirlar.length ? t(`son ${LISTE_SINIRI}`, `last ${LISTE_SINIRI}`) : gorunen.length}
              </Text>
            )}
          />
        </View>
      ) : null}
    </View>
  );

  return (
    <Ekran>
      {/* Ayarlar alt sekmede (25.10.2026); başlıktaki dişli kalktı. */}
      {/* "Güncelle" tek dokunuş (26.10.2026); web'de ve geliştirmede görünmez. */}
      <Baslik baslik={t('Denetimler', 'Audits')} altBaslik={t('Kayıtlar yalnız bu cihazda', 'Records are on this device only')} sag={<GuncelleDugmesi />} icerikGenisligi={1100} />

      {hata ? <View style={s.hataKap}><HataKutusu metin={t(`Kayıtlar okunamadı: ${hata}`, `Could not read records: ${hata}`)} /></View> : null}

      {satirlar === null && !hata ? (
        <Yukleniyor metin={t('Kayıtlar açılıyor…', 'Loading records…')} />
      ) : (
        <FlatList
          // Sütun sayısı değişince FlatList baştan kurulmalı; anahtar bunu sağlar.
          key={tablet ? 'iki' : 'tek'}
          numColumns={tablet ? 2 : 1}
          data={gorunen}
          keyExtractor={(d) => d.id}
          style={{ flex: 1 }}
          contentContainerStyle={s.liste}
          // İki sütunda aralık `gap` ile değil hücre dolgusuyla verilir: tek
          // kalan son kart `flex: 1` ile tüm satırı kaplıyordu; yüzde genişlik
          // her satırda aynı kalır.
          columnWrapperStyle={tablet ? s.sutunSatiri : undefined}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={ust}
          ListEmptyComponent={satirlar?.length ? (
            <Text style={s.eslesmeYok}>{t('Aramayla eşleşen denetim yok.', 'No audits match the search.')}</Text>
          ) : (
            <BosDurum
              simge={S.arac}
              baslik={t('Henüz denetim kaydı yok', 'No audits yet')}
              aciklama={t('Akış üç adım: şasiyi okut ya da yaz · parçayı seç · hatayı seçip Ekle.\nHer kayıt önce cihaza yazılır; bağlantı olmadan da çalışır.', 'Three steps: scan or type the VIN · pick the part · pick the defect and Add.\nEvery record is saved on the device first; it works offline too.')}
            />
          )}
          renderItem={({ item }) => (
            <View style={tablet ? s.hucre : undefined}>
              <DenetimKarti
                satir={item}
                tablet={tablet}
                onPress={() => kartiAc(item)}
              />
            </View>
          )}
        />
      )}
    </Ekran>
  );
}

function DenetimKarti({
  satir, tablet, onPress,
}: { satir: DenetimOzetSatiri; tablet: boolean; onPress: () => void }) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const { dil, t } = useDil();
  const arac = ARAC_INDEKS[satir.aracId];
  const devam = satir.durum === 'devam';
  // Kontrol ilerlemesi — Lumiform'un ana ekranında başlanmış formlar
  // ilerlemeleriyle durur. Toplam araca göre (EV'de de 5 sistem var ama
  // tanım tek yerde: mevcutSistemler).
  const toplamSistem = mevcutSistemler(bolgelerAracIcin({ tip: arac?.tip ?? 'ice' })).length;
  const kontrol = Math.min(satir.kapsamAdedi, toplamSistem);

  // Kontrol listesi kullanılıp yarım bırakıldıysa düz "Tamamlandı" yanıltır
  // (28.10.2026); kaç sistemin işaretli olduğu rozette yazar.
  const kismi = !devam && kapsamDurumu(kontrol, toplamSistem) === 'kismi';
  const durumRozeti = devam
    ? <Rozet metin={t('Devam ediyor', 'In progress')} simge={S.vardiya} renk={renkler.bilgi} zemin={renkler.bilgiYumusak} />
    : kismi
      ? <Rozet metin={t(`Kısmi · ${kontrol}/${toplamSistem} sistem`, `Partial · ${kontrol}/${toplamSistem} systems`)} simge={S.uyari} renk={renkler.uyari} zemin={renkler.uyariYumusak} />
      : <Rozet metin={t('Tamamlandı', 'Completed')} simge={S.tik} renk={renkler.basari} zemin={renkler.basariYumusak} />;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={devam
        ? t(`${aracKimligi(satir)} denetimini aç`, `Open audit ${aracKimligi(satir)}`)
        : kismi
          ? t(`${aracKimligi(satir)} raporunu aç, kısmi: ${kontrol}/${toplamSistem} sistem kontrol edildi`, `Open report ${aracKimligi(satir)}, partial: ${kontrol}/${toplamSistem} systems checked`)
          : t(`${aracKimligi(satir)} raporunu aç`, `Open report ${aracKimligi(satir)}`)}
      onPress={onPress}
      style={({ pressed }) => [s.kart, tablet && s.kartIkili, pressed && s.basili]}
    >
      {/* Silüet ikonu kaldırıldı (ürün sahibi, 25.10.2026: "araç tipleri çok
          dandik … isim yeter"); kart şasi + araç adıyla başlar. */}
      <View style={s.kartUst}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.vin} numberOfLines={1}>{aracKimligi(satir) || t('(şasi yok)', '(no VIN)')}</Text>
          <Text style={s.meta} numberOfLines={1}>
            {aracEtiketi(arac, satir.aracId)}{satir.spec ? ` · ${satir.spec}` : ''}
          </Text>
        </View>
      </View>

      {devam ? (
        <View style={s.ilerleme}>
          <View style={s.ilerlemeUst}>
            <Text style={s.ilerlemeMetin}>{t('Kontrol edilen sistemler', 'Systems checked')}</Text>
            <Text style={s.ilerlemeSayi}>{`${kontrol}/${toplamSistem}`}</Text>
          </View>
          <IlerlemeCubugu deger={kontrol} toplam={toplamSistem} etiket={t(`Kontrol edilen sistemler ${kontrol}/${toplamSistem}`, `Systems checked ${kontrol}/${toplamSistem}`)} />
        </View>
      ) : null}

      {/* Rozet HER BOYUTTA alt satırda: aynı satırda şasiyi sondan kesiyordu —
          önce telefonda, sonra dikey tablette ("NLHB51ABPDH…", sınama
          28.09.2026). Ayırt edici seri numarası tam kesilen kısımda. */}
      <View style={s.kartAlt}>
        {durumRozeti}
        <View style={s.metaSatir}>
          <S.tarih size={14} color={renkler.metinSolgun} strokeWidth={2} />
          <Text style={s.meta} numberOfLines={1}>
            {bicimTarih(satir.baslangic)}
            {!devam && sureDakika(satir.baslangic, satir.bitis) !== null ? ` · ${sureMetni(sureDakika(satir.baslangic, satir.bitis), dil)}` : ''}
          </Text>
        </View>
        {satir.denetci ? (
          <View style={[s.metaSatir, { flexShrink: 1 }]}>
            <S.kisi size={14} color={renkler.metinSolgun} strokeWidth={2} />
            <Text style={s.meta} numberOfLines={1}>{satir.denetci}</Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }} />
        <Text style={s.sayilar}>{t(`${satir.hataAdedi} hata`, `${satir.hataAdedi} ${satir.hataAdedi === 1 ? 'defect' : 'defects'}`)}</Text>
        {satir.agirAdedi > 0 ? (
          <View style={[s.sonucPul, { backgroundColor: renkler.derece3Yumusak }]}>
            <Text style={[s.sonucMetin, { color: renkler.derece3 }]}>{t(`${satir.agirAdedi} × demerit 3`, `${satir.agirAdedi} × demerit 3`)}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const stiller = (r: Renkler) => StyleSheet.create({
  basili: { opacity: 0.72 },
  hataKap: { paddingHorizontal: bosluk.md, paddingTop: bosluk.md },
  liste: {
    padding: bosluk.md, gap: bosluk.sm, paddingBottom: bosluk.xxxl,
    width: '100%', maxWidth: 1100, alignSelf: 'center',
  },
  ust: { gap: bosluk.md, marginBottom: bosluk.xxs },

  yeniDugme: { minHeight: 52, alignSelf: 'stretch' },
  yeniDugmeTablet: { minHeight: 52, alignSelf: 'flex-start', minWidth: 320 },

  sayac: { ...tipografi.captionOrta, color: r.metinSolgun, fontVariant: ['tabular-nums'] },
  aramaBlok: { gap: bosluk.sm },
  suzgecSatir: { flexDirection: 'row', flexWrap: 'wrap', gap: bosluk.xs },
  eslesmeYok: { ...tipografi.body, color: r.metinSolgun, textAlign: 'center', paddingVertical: bosluk.lg },

  // Kart dili temel.tsx Kart ile aynı: gölge var, çerçeve yok (26.10.2026).
  kart: {
    gap: bosluk.sm, padding: bosluk.sm,
    backgroundColor: r.yuzey, borderRadius: kose.lg,
    boxShadow: `0 4px 12px ${r.golge}`,
  },
  sutunSatiri: { marginHorizontal: -bosluk.sm / 2 },
  hucre: { width: '50%', paddingHorizontal: bosluk.sm / 2 },
  kartIkili: { flex: 1 },
  kartUst: { flexDirection: 'row', alignItems: 'center', gap: bosluk.sm },
  vin: { ...tipografi.kimlik, color: r.metin },
  meta: { ...tipografi.caption, color: r.metinSolgun },
  kartAlt: {
    flexDirection: 'row', alignItems: 'center', gap: bosluk.sm, flexWrap: 'wrap',
    paddingTop: bosluk.xs, borderTopWidth: 1, borderTopColor: r.cizgiSolgun,
  },
  metaSatir: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sayilar: { ...tipografi.captionOrta, color: r.metinIkincil, fontVariant: ['tabular-nums'] },
  sonucPul: { paddingHorizontal: bosluk.xs, paddingVertical: 3, borderRadius: kose.sm },
  ilerleme: { gap: 6 },
  ilerlemeUst: { flexDirection: 'row', justifyContent: 'space-between', gap: bosluk.sm },
  ilerlemeMetin: { ...tipografi.caption, color: r.metinSolgun },
  ilerlemeSayi: { ...tipografi.captionOrta, color: r.metinIkincil, fontVariant: ['tabular-nums'] },
  sonucMetin: { ...tipografi.etiket },
});
