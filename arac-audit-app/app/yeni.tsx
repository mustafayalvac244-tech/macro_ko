import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EklenebilirSecim, useSecimListesi } from '@/bilesenler/EklenebilirSecim';
import { S } from '@/bilesenler/simgeler';
import {
  AltCubuk, Baslik, BilgiKutusu, BolumBasligi, Dugme, GeriDugmesi, Girdi, Kart, Secenek, useDuzen,
} from '@/bilesenler/temel';
import { SPECLER } from '@/cekirdek/aracBilgisi';
import {
  HAZIR_DENETCILER, HAZIR_KAYNAKLAR, LISTE_ANAHTARI, listedeyse, VARSAYILAN_KAYNAK,
} from '@/cekirdek/listeler';
import { ARAC_INDEKS, ARACLAR } from '@/cekirdek/model3d';
import { bicimTarih } from '@/cekirdek/rapor';
import { BODY_NO_AZAMI, bodyNoSadelestir, VIN_UZUNLUK, vinDogrula } from '@/cekirdek/vin';
import { bosluk, Renkler, tipografi, useTema } from '@/tema';
import { ayarOku, ayarYaz, ayniAracinDenetimleri, denetimGuncelle, denetimOlustur } from '@/veri/depo';
import { useTarama } from '@/veri/tarama';

/*
 * Raporun "Source" sütunu. 28.09.2026'da formdaki kaynak seçimi kaldırılmış,
 * her denetime "HMC Audit" yazılıyordu. 24.10.2026'da ürün sahibi şirketteki
 * Excel formuna bakıp "Problem Source" seçimini geri istedi: artık listeden
 * seçilir (HMC Audit / Durability, "+ Ekle" ile genişler) ve hatırlanır.
 *
 * BODY NO VE "PROBLEM YOK" (aynı gün, aynı Excel formundan): şasi ya da body
 * no'dan biri yeter. "Problem yok" hatasız aracı tek dokunuşla kaydedip
 * bitirir — Excel'deki "Problem Yok Aracı Kaydet"; sayaçta denetlenen araç
 * olarak sayılır.
 */

/**
 * Denetçi her araçta aynı kalır — bir kez seçilsin, hatırlansın.
 * Eski kayıtta hat/vardiya/denetimTipi/faz/ekip de var; bilerek OKUNMUYOR: form
 * artık onları göstermiyor, görünmeyen bir değer rapora sessizce yazılmamalı.
 *
 * Plaka, km, faz, ekip ve rapor no kaldırıldı (ürün sahibi, 24.10.2026):
 * şirkette kullanılan Excel formunun fotoğrafını attı, "bizdeki gereksiz
 * bilgileri sil" dedi; hangilerinin gideceğini kendisi seçti. Spec kaldı.
 *
 * Araç da hatırlanır (28.09.2026): form her seferinde IONIQ 3 seçili açılıyor,
 * BAYON hattındaki denetçi seçmeyi unutursa denetim yanlış parça kataloğuyla
 * açılıyordu (sınama). Artık son kullanılan araç seçili gelir.
 */
interface Varsayilanlar { denetci: string; kaynak: string; aracId?: string }

type OncekiDenetim = Awaited<ReturnType<typeof ayniAracinDenetimleri>>[number];

export default function YeniDenetim() {
  const router = useRouter();
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const { tablet } = useDuzen();

  const [aracId, setAracId] = useState(ARACLAR[0]!.id);
  const [vinHam, setVinHam] = useState('');
  const [bodyNoHam, setBodyNoHam] = useState('');
  // Spec ARACA özgü (şasi gibi): hatırlanmaz, her araçta girilir.
  const [spec, setSpec] = useState('');
  const [v, setV] = useState<Varsayilanlar>({ denetci: '', kaynak: VARSAYILAN_KAYNAK });
  const denetciler = useSecimListesi(LISTE_ANAHTARI.denetci, HAZIR_DENETCILER);
  const kaynaklar = useSecimListesi(LISTE_ANAHTARI.kaynak, HAZIR_KAYNAKLAR);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [denendi, setDenendi] = useState(false);
  // İlk "Denetime başla" dokunuşunda eksik künye ve aynı şasi SÖYLENİR; ikinci
  // dokunuş yine de başlatır (sınama: denetçisiz ve aynı şasiyle
  // uyarısız başlıyordu, künye sonradan düzeltilemiyordu).
  const [eksikSoylendi, setEksikSoylendi] = useState(false);
  const [onceki, setOnceki] = useState<{ anahtar: string; liste: OncekiDenetim[] } | null>(null);
  const kaydir = useRef<ScrollView>(null);
  const [bilgiY, setBilgiY] = useState(0);

  // Barkod ekranı okuduğu şasiyi burada bırakır; geri döndüğümüzde alıp
  // temizliyoruz ki aynı numara ikinci bir denetime sızmasın.
  const okunanVin = useTarama((d) => d.okunanVin);
  const taramayiTemizle = useTarama((d) => d.temizle);
  useEffect(() => {
    if (okunanVin) { setVinHam(okunanVin); taramayiTemizle(); }
  }, [okunanVin, taramayiTemizle]);

  useEffect(() => {
    ayarOku<Partial<Varsayilanlar> | null>('varsayilanlar', null)
      .then((k) => {
        if (k) setV({ denetci: k.denetci ?? '', kaynak: k.kaynak ?? VARSAYILAN_KAYNAK });
        if (k?.aracId && ARAC_INDEKS[k.aracId]) setAracId(k.aracId);
      })
      .catch(() => { /* ilk açılış */ });
  }, []);

  const vin = useMemo(() => vinDogrula(vinHam), [vinHam]);
  const bodyNo = bodyNoSadelestir(bodyNoHam);
  const vinBos = !vinHam.trim();
  // Şasi YA DA body no yeter; şasi yazıldıysa geçerli olmalı (yarım yazılmış
  // bir şasi, body no var diye sessizce rapora gitmesin).
  const kimlikTamam = vinBos ? !!bodyNo : vin.gecerli;
  const kimlikAnahtari = `${vinBos ? '' : vin.vin}|${bodyNo}`;

  const eksikler = [
    !listedeyse(denetciler.liste, v.denetci) && 'denetçi',
  ].filter(Boolean) as string[];
  const onceVar = !!onceki && onceki.anahtar === kimlikAnahtari && onceki.liste.length > 0;

  /** "Denetime başla" ve "Problem yok" aynı denetimi açar; ikincisi hemen bitirir. */
  const olustur = useCallback(async (hatasiz: boolean) => {
    setDenendi(true);
    if (!kimlikTamam) return;
    if (eksikler.length && !eksikSoylendi) {
      setEksikSoylendi(true);
      kaydir.current?.scrollTo({ y: bilgiY, animated: true });
      return;
    }
    if (onceki?.anahtar !== kimlikAnahtari) {
      const liste = await ayniAracinDenetimleri({ vin: vinBos ? '' : vin.vin, bodyNo }).catch(() => []);
      setOnceki({ anahtar: kimlikAnahtari, liste });
      if (liste.length) return;
    }
    setGonderiliyor(true);
    try {
      // Yalnız ekranda SEÇİLİ görünen değer yazılır: listeden kaldırılmış bir
      // ad hatırlanmış olsa bile formda görünmüyorsa rapora da gitmez.
      const denetci = listedeyse(denetciler.liste, v.denetci);
      const kaynak = listedeyse(kaynaklar.liste, v.kaynak);
      await ayarYaz('varsayilanlar', { denetci, kaynak, aracId });
      const baslangic = new Date().toISOString();
      const d = await denetimOlustur({
        aracId, vin: vinBos ? '' : vin.vin, bodyNo, plaka: '', raporNo: '',
        denetci, hat: '', vardiya: '', denetimTipi: kaynak, faz: '', ekip: '',
        spec, km: null, baslangic,
      });
      if (hatasiz) {
        await denetimGuncelle(d.id, { durum: 'tamam', bitis: baslangic });
        // Ana sayfaya: kart "TAMAMLANDI · 0 hata", sayaç bir araç artar.
        // replace('/') değil — yığında ikinci ana sayfa bırakırdı.
        router.dismissTo('/');
      } else {
        router.replace({ pathname: '/denetim/[id]', params: { id: d.id } });
      }
    } finally {
      setGonderiliyor(false);
    }
  }, [aracId, bilgiY, bodyNo, denetciler.liste, eksikSoylendi, eksikler.length, kaynaklar.liste, kimlikAnahtari,
    kimlikTamam, onceki, router, spec, v, vin.vin, vinBos]);

  const oncekiniAc = (d: OncekiDenetim) => (d.durum === 'tamam'
    ? router.replace({ pathname: '/denetim/rapor', params: { id: d.id, kaynak: 'ana' } })
    : router.replace({ pathname: '/denetim/[id]', params: { id: d.id } }));

  // VIN durumu: boşken yol göster, doluyken ne bulduğunu söyle.
  // Geçersiz şasinin hatası denendikten sonra kutunun ALTINDA kırmızı yazıyor;
  // aynı cümle bir de turuncu kutuda çıkıyordu (sınama) — artık tek yerde.
  const vinDurumu = !vinHam
    ? (bodyNo
      ? { tur: 'bilgi' as const, metin: 'Şasi yok: araç body no ile kaydedilir.' }
      : { tur: denendi ? 'uyari' as const : 'bilgi' as const, metin: `Barkod okutun ya da ${VIN_UZUNLUK} haneyi yazın; body no da yeterli.` })
    : vin.gecerli && !vin.uyarilar.length
      ? { tur: 'basari' as const, metin: `Geçerli · ${vin.bilgi.uretici ?? vin.bilgi.wmi} · model yılı ${vin.bilgi.modelYili ?? '?'}` }
      : denendi && !vin.gecerli
        ? null
        : { tur: 'uyari' as const, metin: [...vin.hatalar, ...vin.uyarilar].join(' ') };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: renkler.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Baslik baslik="Yeni denetim" altBaslik="Araç, şasi ve denetim bilgisi" sol={<GeriDugmesi />} />

      <ScrollView
        ref={kaydir}
        contentContainerStyle={[s.govde, tablet && s.govdeTablet]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.sutun, tablet && s.sutunTablet]}>
          <Kart>
            <BolumBasligi metin="Araç" simge={S.arac} />
            {/* Yalnız ad. Silüet ikonu ve "Elektrikli / İçten yanmalı" etiketi
                kaldırıldı (ürün sahibi, 25.10.2026: "araç tipleri çok dandik,
                araç tipi koyma, isim yeter"). Daha önce de ölçüler ve "ölçü
                doğrulanmadı" rozeti aynı gerekçeyle gitmişti (28.09.2026).
                Tip veri modelinde duruyor: parça listesi (motor bölmesi vb.)
                hâlâ ona göre seçilir. Bilgiler sayfasıyla aynı bileşen. */}
            <View style={s.aracIzgara}>
              {ARACLAR.map((a) => (
                <Secenek
                  key={a.id}
                  metin={a.ad}
                  erisimEtiketi={`${a.tam} seç`}
                  secili={a.id === aracId}
                  onPress={() => setAracId(a.id)}
                  style={{ flexGrow: 1, flexBasis: 100 }}
                />
              ))}
            </View>
          </Kart>

          <Kart>
            <BolumBasligi metin="Şasi numarası (VIN)" simge={S.barkod} />
            <Girdi
              mono
              value={vin.vin}
              onChangeText={setVinHam}
              placeholder="17 hane"
              autoCapitalize="characters"
              autoCorrect={false}
              spellCheck={false}
              maxLength={40}
              accessibilityLabel="Şasi numarası"
              hata={denendi && !vinBos && !vin.gecerli ? vin.hatalar.join(' ') : undefined}
              // Yol gösteren cümle kutunun altında küçük yazı; mavi bilgi kutusu
              // formu kalabalık ediyordu (25.10.2026). Uyarı ve başarı kutuda kalır.
              ipucu={vinDurumu?.tur === 'bilgi' ? vinDurumu.metin : undefined}
            />
            {vinDurumu && vinDurumu.tur !== 'bilgi' ? <BilgiKutusu tur={vinDurumu.tur} metin={vinDurumu.metin} /> : null}
            <View style={s.satir}>
              <Dugme metin="Barkod okut" simge={S.barkod} kucuk onPress={() => router.push('/barkod')} style={{ flex: 1 }} />
              <Dugme metin="Temizle" simge={S.kapat} kucuk tur="sessiz" onPress={() => setVinHam('')} />
            </View>
            <Girdi
              etiket="Body no"
              mono
              value={bodyNoHam}
              onChangeText={(t) => setBodyNoHam(bodyNoSadelestir(t))}
              placeholder="Örn. 015253"
              autoCapitalize="characters"
              autoCorrect={false}
              spellCheck={false}
              maxLength={BODY_NO_AZAMI}
              accessibilityLabel="Body numarası"
            />
            <View style={{ gap: bosluk.xxs }}>
              <Text style={s.alanEtiketi}>Spec</Text>
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
          </Kart>
        </View>

        <View style={[s.sutun, tablet && s.sutunTablet]} onLayout={(e) => setBilgiY(e.nativeEvent.layout.y)}>
          <Kart>
            <BolumBasligi metin="Denetim bilgileri" simge={S.rapor} />
            <EklenebilirSecim
              baslik="Denetçi"
              ad="Denetçi"
              liste={denetciler}
              deger={listedeyse(denetciler.liste, v.denetci)}
              degistir={(d) => setV({ ...v, denetci: d })}
              yerTutucu="Ad Soyad"
            />
            <EklenebilirSecim
              baslik="Problem source"
              ad="Kaynak"
              liste={kaynaklar}
              deger={listedeyse(kaynaklar.liste, v.kaynak)}
              degistir={(k) => setV({ ...v, kaynak: k })}
              yerTutucu="Örn. Durability"
            />
          </Kart>
        </View>
      </ScrollView>

      {eksikler.length && eksikSoylendi ? (
        <View style={s.uyariBandi}>
          <BilgiKutusu
            tur="uyari"
            metin={`${eksikler.map((e) => e[0]!.toLocaleUpperCase('tr') + e.slice(1)).join(' ve ')} seçilmedi; raporda boş kalır. Seçin ya da yine de başlatın.`}
          />
        </View>
      ) : null}
      {onceVar && onceki ? (
        <View style={s.uyariBandi}>
          <BilgiKutusu
            tur="uyari"
            metin={`Bu araç için ${onceki.liste.length} denetim var. Son: ${bicimTarih(onceki.liste[0]!.baslangic)} · ${ARAC_INDEKS[onceki.liste[0]!.aracId]?.ad ?? onceki.liste[0]!.aracId} · ${onceki.liste[0]!.durum === 'tamam' ? 'tamamlandı' : 'devam ediyor'}.`}
          />
          <Dugme metin="Onu aç" kucuk simge={S.liste} onPress={() => oncekiniAc(onceki.liste[0]!)} erisimEtiketi="Bu aracın son denetimini aç" />
        </View>
      ) : null}

      <AltCubuk style={tablet ? { justifyContent: 'flex-end' } : undefined}>
        {/* Excel'deki "Problem Yok Aracı Kaydet": hatasız araç açılıp kapanmadan,
            tek dokunuşla "tamamlandı · 0 hata" olarak kaydedilir. Uyarılar
            (denetçi, aynı araç) "Denetime başla" ile aynı: ilk dokunuşta
            söylenir, ikincisi kaydeder. */}
        <Dugme
          metin="Problem yok"
          simge={S.tamam}
          pasif={gonderiliyor}
          onPress={() => olustur(true)}
          erisimEtiketi="Problem yok: hatasız aracı kaydet ve bitir"
          style={tablet ? { minWidth: 200 } : { flex: 1 }}
        />
        <Dugme
          metin={(eksikler.length && eksikSoylendi) || onceVar ? 'Yine de başla' : 'Denetime başla'}
          tur="birincil"
          simge={S.basla}
          simgeSonda
          yukleniyor={gonderiliyor}
          onPress={() => olustur(false)}
          style={tablet ? { minWidth: 280 } : { flex: 1.4 }}
        />
      </AltCubuk>
    </KeyboardAvoidingView>
  );
}

const stiller = (r: Renkler) => StyleSheet.create({
  basili: { opacity: 0.72 },
  govde: { padding: bosluk.md, gap: bosluk.md, paddingBottom: bosluk.xxxl },
  govdeTablet: {
    flexDirection: 'row', alignItems: 'flex-start',
    width: '100%', maxWidth: 1100, alignSelf: 'center',
  },
  sutun: { gap: bosluk.md },
  sutunTablet: { flex: 1, minWidth: 0 },

  aracIzgara: { flexDirection: 'row', gap: bosluk.xs, flexWrap: 'wrap' },

  satir: { flexDirection: 'row', gap: bosluk.xs },
  alanEtiketi: { ...tipografi.caption, color: r.metinIkincil },
  uyariBandi: {
    flexDirection: 'row', alignItems: 'center', gap: bosluk.sm, flexWrap: 'wrap',
    paddingHorizontal: bosluk.md, paddingTop: bosluk.xs, backgroundColor: r.bg,
  },
});
