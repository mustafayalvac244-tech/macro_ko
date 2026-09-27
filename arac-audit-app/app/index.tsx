import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AracIkonu } from '@/bilesenler/AracIkonu';
import { S } from '@/bilesenler/simgeler';
import {
  Baslik, BaslikDugmesi, BilgiKutusu, BolumBasligi, BosDurum, Dugme, Ekran,
  HataKutusu, Olcu, Rozet, useDuzen, Yukleniyor,
} from '@/bilesenler/temel';
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

  const ozet = useMemo(() => {
    if (!satirlar) return null;
    const bugun = new Date().toDateString();
    let devam = 0, bugunku = 0, bulgu = 0, agir = 0;
    for (const x of satirlar) {
      if (x.durum === 'devam') devam += 1;
      if (new Date(x.baslangic).toDateString() === bugun) bugunku += 1;
      bulgu += x.hataAdedi;
      agir += x.agirAdedi;
    }
    return { devam, bugunku, bulgu, agir };
  }, [satirlar]);

  const yeniDenetim = () => router.push('/yeni');

  const ust = (
    <View style={s.ust}>
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

      {ozet && satirlar?.length ? (
        <View style={s.olcuSatiri}>
          <Olcu genis simge={S.vardiya} deger={ozet.devam} etiket="devam eden" renk={renkler.bilgi} zemin={renkler.bilgiYumusak} />
          <Olcu genis simge={S.tarih} deger={ozet.bugunku} etiket="bugün başlatılan" renk={renkler.birincil} zemin={renkler.birincilYumusak} />
          <Olcu genis simge={S.rapor} deger={ozet.bulgu} etiket="bulgu" />
          <Olcu genis simge={S.uyari} deger={ozet.agir} etiket="derece 3" renk={renkler.derece3} zemin={renkler.derece3Yumusak} />
        </View>
      ) : null}

      {/* Eskiden burada "bağlantı gelince kendiliğinden gönderilecek" yazıyordu.
          Doğru değildi: gönderen bir kod yok, sunucu kurulmadı (27.09.2026'da
          fark edildi). Denetçi kayıtlarının bir yere gittiğini sanmamalı. */}
      <BilgiKutusu metin="Merkezi sunucu bağlantısı henüz yok: kayıtlar yalnız bu cihazda. Dışarı almak için denetimin raporunu Excel olarak paylaşın." />

      {satirlar?.length ? (
        <BolumBasligi
          metin="DENETİMLER"
          simge={S.liste}
          sag={(
            <Text style={s.sayac}>
              {satirlar.length >= LISTE_SINIRI ? `son ${LISTE_SINIRI}` : satirlar.length}
            </Text>
          )}
        />
      ) : null}
    </View>
  );

  return (
    <Ekran>
      <Baslik
        baslik="Denetimler"
        altBaslik="Araç Audit"
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
          data={satirlar ?? []}
          keyExtractor={(d) => d.id}
          style={{ flex: 1 }}
          contentContainerStyle={s.liste}
          // İki sütunda aralık `gap` ile değil hücre dolgusuyla verilir: tek
          // kalan son kart `flex: 1` ile tüm satırı kaplıyordu; yüzde genişlik
          // her satırda aynı kalır.
          columnWrapperStyle={tablet ? s.sutunSatiri : undefined}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={ust}
          ListEmptyComponent={(
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
                onPress={() => router.push({ pathname: '/denetim/[id]', params: { id: item.id } })}
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
      accessibilityLabel={`${satir.vin} denetimini aç`}
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
            {arac?.ad ?? satir.aracId}{satir.plaka ? ` · ${satir.plaka}` : ''}
          </Text>
        </View>
        {/* Telefonda rozet alt satıra iner: aynı satırda şasiyi sondan kesiyordu,
            ayırt edici seri numarası da tam kesilen kısımda. */}
        {tablet ? durumRozeti : null}
      </View>

      <View style={s.kartAlt}>
        {tablet ? null : durumRozeti}
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
        <Text style={s.sayilar}>{satir.hataAdedi} bulgu</Text>
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

  olcuSatiri: { flexDirection: 'row', flexWrap: 'wrap', gap: bosluk.xs },
  sayac: { ...tipografi.captionOrta, color: r.metinSolgun, fontVariant: ['tabular-nums'] },

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
