import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AracIkonu } from '@/bilesenler/AracIkonu';
import { GuncellemeBildirimi } from '@/bilesenler/Guncelleme';
import { S } from '@/bilesenler/simgeler';
import {
  AramaKutusu, Baslik, BaslikDugmesi, BolumBasligi, BosDurum, Dugme, Ekran,
  HataKutusu, Rozet, Secenek, useDuzen, Yukleniyor,
} from '@/bilesenler/temel';
import { aramaSadelestir } from '@/cekirdek/arama';
import { ARAC_INDEKS } from '@/cekirdek/model3d';
import { bicimTarih } from '@/cekirdek/rapor';
import { bosluk, kose, Renkler, tipografi, useTema } from '@/tema';
import { DenetimOzetSatiri, denetimleriListele } from '@/veri/depo';

/** Ana sayfada okunan en fazla denetim. Özet sayılar da yalnız bunlardan. */
const LISTE_SINIRI = 200;

export default function DenetimListesi() {
  const router = useRouter();
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const { tablet } = useDuzen();

  const [satirlar, setSatirlar] = useState<DenetimOzetSatiri[] | null>(null);
  const [hata, setHata] = useState<string | null>(null);
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
        const liste = await denetimleriListele(LISTE_SINIRI);
        if (iptal) return;
        setSatirlar(liste);
        setHata(null);
      } catch (h) {
        if (!iptal) setHata(h instanceof Error ? h.message : String(h));
      }
    })();
    return () => { iptal = true; };
  }, []));

  const yeniDenetim = () => router.push('/yeni');

  const gorunen = useMemo(() => {
    const sozcukler = aramaSadelestir(arama).split(' ').filter(Boolean);
    return (satirlar ?? []).filter((d) => {
      if (suzgec !== 'hepsi' && d.durum !== suzgec) return false;
      if (!sozcukler.length) return true;
      const metin = aramaSadelestir([
        d.vin, d.plaka, ARAC_INDEKS[d.aracId]?.ad, d.spec, d.denetci, bicimTarih(d.baslangic),
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

      <View style={[s.kahraman, !tablet && s.kahramanDar]}>
        <View style={s.kahramanSimge}>
          <S.barkod size={26} color={renkler.cubukVurgu} strokeWidth={2} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={s.kahramanBaslik}>Yeni denetim başlat</Text>
          <Text style={s.kahramanAlt}>Şasiyi okut · parçayı seç · hataya dokun</Text>
        </View>
        <Dugme
          metin="Yeni denetim"
          tur="birincil"
          simge={S.ekle}
          onPress={yeniDenetim}
          style={tablet ? undefined : { alignSelf: 'stretch' }}
        />
      </View>

      {/* Özet sayı kutuları ve sunucu uyarı kutusu kaldırıldı (ürün sahibi,
          28.09.2026: "çok kalabalık olmasın"). Kayıtların yalnız cihazda
          olduğu başlığın alt satırında ve Ayarlar → Veri'de yazıyor; eskiden
          burada yazan "bağlantı gelince gönderilecek" cümlesi YANLIŞTI —
          gönderen kod yok (27.09.2026). */}

      {satirlar?.length ? (
        <View style={s.aramaBlok}>
          <AramaKutusu
            deger={arama}
            degistir={setArama}
            yerTutucu="Şasi (son haneler de olur), plaka, araç, denetçi…"
            erisimEtiketi="Denetim ara"
          />
          <View style={s.suzgecSatir}>
            {([
              ['hepsi', `Tümü ${satirlar.length}`],
              ['devam', `Devam eden ${devamSayisi}`],
              ['tamam', `Tamamlanan ${tamamSayisi}`],
            ] as const).map(([k, metin]) => (
              <Secenek key={k} metin={metin} secili={suzgec === k} onPress={() => setSuzgec(k)} />
            ))}
          </View>
          <BolumBasligi
            metin="DENETİMLER"
            simge={S.liste}
            sag={(
              <Text style={s.sayac}>
                {satirlar.length >= LISTE_SINIRI && gorunen.length === satirlar.length ? `son ${LISTE_SINIRI}` : gorunen.length}
              </Text>
            )}
          />
        </View>
      ) : null}
    </View>
  );

  return (
    <Ekran>
      <Baslik
        baslik="Denetimler"
        altBaslik="Kayıtlar yalnız bu cihazda"
        sag={<BaslikDugmesi simge={S.ayarlar} erisimEtiketi="Ayarlar" onPress={() => router.push('/ayarlar')} />}
      />

      {hata ? <View style={s.hataKap}><HataKutusu metin={`Kayıtlar okunamadı: ${hata}`} /></View> : null}

      {satirlar === null && !hata ? (
        <Yukleniyor metin="Kayıtlar açılıyor…" />
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
            <Text style={s.eslesmeYok}>Aramayla eşleşen denetim yok.</Text>
          ) : (
            <BosDurum
              simge={S.arac}
              baslik="Henüz denetim kaydı yok"
              aciklama={'Akış üç adım: şasiyi okut ya da yaz · parçayı seç · hataya dokun.\nHer kayıt önce cihaza yazılır; bağlantı olmadan da çalışır.'}
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
  const arac = ARAC_INDEKS[satir.aracId];
  const devam = satir.durum === 'devam';
  const durumRozeti = devam
    ? <Rozet metin="DEVAM EDİYOR" simge={S.vardiya} renk={renkler.bilgi} zemin={renkler.bilgiYumusak} />
    : <Rozet metin="TAMAMLANDI" simge={S.tik} renk={renkler.basari} zemin={renkler.basariYumusak} />;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={devam ? `${satir.vin} denetimini aç` : `${satir.vin} raporunu aç`}
      onPress={onPress}
      style={({ pressed }) => [s.kart, tablet && s.kartIkili, pressed && s.basili]}
    >
      <View style={s.kartUst}>
        <View style={s.aracYuva}>
          {arac ? <AracIkonu arac={arac} boy={24} /> : <S.arac size={24} color={renkler.metinIkincil} strokeWidth={1.75} />}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.vin} numberOfLines={1}>{satir.vin || '(şasi yok)'}</Text>
          <Text style={s.meta} numberOfLines={1}>
            {arac?.ad ?? satir.aracId}{satir.spec ? ` · ${satir.spec}` : ''}{satir.plaka ? ` · ${satir.plaka}` : ''}
          </Text>
        </View>
      </View>

      {/* Rozet HER BOYUTTA alt satırda: aynı satırda şasiyi sondan kesiyordu —
          önce telefonda, sonra dikey tablette ("NLHB51ABPDH…", sınama
          28.09.2026). Ayırt edici seri numarası tam kesilen kısımda. */}
      <View style={s.kartAlt}>
        {durumRozeti}
        <View style={s.metaSatir}>
          <S.tarih size={14} color={renkler.metinSolgun} strokeWidth={2} />
          <Text style={s.meta} numberOfLines={1}>{bicimTarih(satir.baslangic)}</Text>
        </View>
        {satir.denetci ? (
          <View style={[s.metaSatir, { flexShrink: 1 }]}>
            <S.kisi size={14} color={renkler.metinSolgun} strokeWidth={2} />
            <Text style={s.meta} numberOfLines={1}>{satir.denetci}</Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }} />
        <Text style={s.sayilar}>{satir.hataAdedi} hata</Text>
        {satir.agirAdedi > 0 ? (
          <View style={[s.sonucPul, { backgroundColor: renkler.derece3Yumusak }]}>
            <Text style={[s.sonucMetin, { color: renkler.derece3 }]}>{satir.agirAdedi} × DERECE 3</Text>
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

  // Yeni denetim kartı — uygulama çubuğunun koyu yüzeyiyle, sayfanın ana eylemi.
  kahraman: {
    flexDirection: 'row', alignItems: 'center', gap: bosluk.md,
    padding: bosluk.md, borderRadius: kose.lg, backgroundColor: r.cubuk,
    boxShadow: `0 2px 8px ${r.golge}`,
  },
  kahramanDar: { flexDirection: 'column', alignItems: 'flex-start', gap: bosluk.sm },
  kahramanSimge: {
    width: 52, height: 52, borderRadius: kose.md, alignItems: 'center', justifyContent: 'center',
    backgroundColor: r.cubukYuzey,
  },
  kahramanBaslik: { ...tipografi.h2, color: r.cubukMetin },
  kahramanAlt: { ...tipografi.caption, color: r.cubukMetinSolgun },

  sayac: { ...tipografi.captionOrta, color: r.metinSolgun, fontVariant: ['tabular-nums'] },
  aramaBlok: { gap: bosluk.sm },
  suzgecSatir: { flexDirection: 'row', flexWrap: 'wrap', gap: bosluk.xs },
  eslesmeYok: { ...tipografi.body, color: r.metinSolgun, textAlign: 'center', paddingVertical: bosluk.lg },

  kart: {
    gap: bosluk.sm, padding: bosluk.sm,
    backgroundColor: r.yuzey, borderRadius: kose.lg,
    borderWidth: 1, borderColor: r.cizgiSolgun,
    boxShadow: `0 1px 3px ${r.golge}`,
  },
  sutunSatiri: { marginHorizontal: -bosluk.sm / 2 },
  hucre: { width: '50%', paddingHorizontal: bosluk.sm / 2 },
  kartIkili: { flex: 1 },
  kartUst: { flexDirection: 'row', alignItems: 'center', gap: bosluk.sm },
  aracYuva: {
    width: 78, height: 44, borderRadius: kose.md, alignItems: 'center', justifyContent: 'center',
    backgroundColor: r.yuzeyAlt,
  },
  vin: { ...tipografi.mono, color: r.metin },
  meta: { ...tipografi.caption, color: r.metinSolgun },
  kartAlt: {
    flexDirection: 'row', alignItems: 'center', gap: bosluk.sm, flexWrap: 'wrap',
    paddingTop: bosluk.xs, borderTopWidth: 1, borderTopColor: r.cizgiSolgun,
  },
  metaSatir: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sayilar: { ...tipografi.captionOrta, color: r.metinIkincil, fontVariant: ['tabular-nums'] },
  sonucPul: { paddingHorizontal: bosluk.xs, paddingVertical: 3, borderRadius: kose.sm },
  sonucMetin: { ...tipografi.etiket },
});
