import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Baslik, BaslikDugmesi, BilgiKutusu, BosDurum, Dugme, Ekran,
  HataKutusu, Rozet, Yukleniyor,
} from '@/bilesenler/temel';
import { ARAC_INDEKS } from '@/cekirdek/model3d';
import { bicimTarih } from '@/cekirdek/rapor';
import { bosluk, kose, Renkler, tipografi, useTema } from '@/tema';
import { bekleyenSenkron, DenetimOzetSatiri, denetimleriListele } from '@/veri/depo';

export default function DenetimListesi() {
  const router = useRouter();
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);

  const [satirlar, setSatirlar] = useState<DenetimOzetSatiri[] | null>(null);
  const [bekleyen, setBekleyen] = useState(0);
  const [hata, setHata] = useState<string | null>(null);

  // Ekrana her dönüşte tazele: denetim ekranından çıkınca liste güncel olmalı.
  useFocusEffect(useCallback(() => {
    let iptal = false;
    (async () => {
      try {
        const [liste, n] = await Promise.all([denetimleriListele(200), bekleyenSenkron()]);
        if (iptal) return;
        setSatirlar(liste);
        setBekleyen(n);
        setHata(null);
      } catch (h) {
        if (!iptal) setHata(h instanceof Error ? h.message : String(h));
      }
    })();
    return () => { iptal = true; };
  }, []));


  return (
    <Ekran kenarlar={['top']}>
      <Baslik
        baslik="Denetimler"
        altBaslik={bekleyen > 0 ? `${bekleyen} kayıt gönderilmeyi bekliyor` : 'Tüm kayıtlar güncel'}
        sag={<BaslikDugmesi metin="⚙" erisimEtiketi="Ayarlar" onPress={() => router.push('/ayarlar')} />}
      />

      <View style={s.govde}>
        <Dugme metin="+  Yeni Denetim" tur="birincil" onPress={() => router.push('/yeni')} />

        {hata ? <HataKutusu metin={`Kayıtlar okunamadı: ${hata}`} /> : null}

        {satirlar === null && !hata ? (
          <Yukleniyor metin="Kayıtlar açılıyor…" />
        ) : satirlar && satirlar.length === 0 ? (
          <BosDurum
            baslik="Henüz denetim kaydı yok"
            aciklama={'Akış üç adım: araç ve şasi · 3B modelde parçaya dokun · hatayı seç.\n\nHer kayıt önce cihaza yazılır; bağlantı olmadan da çalışır.'}
          />
        ) : (
          <FlatList
            data={satirlar ?? []}
            keyExtractor={(d) => d.id}
            contentContainerStyle={{ gap: bosluk.xs, paddingBottom: bosluk.xxxl }}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              bekleyen > 0
                ? <BilgiKutusu tur="uyari" metin={`${bekleyen} kayıt henüz sunucuya gönderilmedi. Bağlantı gelince kendiliğinden gönderilecek.`} />
                : null
            }
            renderItem={({ item }) => (
              <DenetimSatiri
                satir={item}
                onPress={() => router.push({ pathname: '/denetim/[id]', params: { id: item.id } })}
              />
            )}
          />
        )}
      </View>
    </Ekran>
  );
}

function DenetimSatiri({
  satir, onPress,
}: { satir: DenetimOzetSatiri; onPress: () => void }) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);

  const arac = ARAC_INDEKS[satir.aracId];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${satir.vin} denetimini aç`}
      onPress={onPress}
      style={({ pressed }) => [s.satir, pressed && s.satirBasili]}
    >
      <View style={s.satirSol}>
        <View style={s.satirUst}>
          <Text style={s.vin} numberOfLines={1}>{satir.vin || '(şasi yok)'}</Text>
          {satir.durum === 'devam' ? <Rozet metin="DEVAM EDİYOR" renk={renkler.bilgi} zemin={renkler.bilgiYumusak} /> : null}
          {!satir.senkronlandi ? <Rozet metin="GÖNDERİLMEDİ" renk={renkler.uyari} zemin={renkler.uyariYumusak} /> : null}
        </View>
        <Text style={s.meta} numberOfLines={1}>
          {(arac?.ad ?? satir.aracId)} · {satir.plaka || 'plakasız'} · {bicimTarih(satir.baslangic)}
          {satir.denetci ? ` · ${satir.denetci}` : ''}
        </Text>
      </View>

      <View style={s.satirSag}>
        {satir.agirAdedi > 0 ? (
          <View style={[s.sonucPul, { backgroundColor: renkler.tehlikeYumusak }]}>
            <Text style={[s.sonucMetin, { color: renkler.tehlike }]}>{satir.agirAdedi} × derece 3</Text>
          </View>
        ) : null}
        <Text style={s.sayilar}>{satir.hataAdedi} hata</Text>
      </View>
    </Pressable>
  );
}

const stiller = (r: Renkler) => StyleSheet.create({
  govde: { flex: 1, padding: bosluk.md, gap: bosluk.md },

  satir: {
    flexDirection: 'row', alignItems: 'center', gap: bosluk.sm,
    backgroundColor: r.yuzey, borderRadius: kose.md,
    borderWidth: 1, borderColor: r.cizgiSolgun, padding: bosluk.sm,
  },
  satirBasili: { backgroundColor: r.yuzeyAlt },
  satirSol: { flex: 1, minWidth: 0, gap: 2 },
  satirUst: { flexDirection: 'row', alignItems: 'center', gap: bosluk.xs, flexWrap: 'wrap' },
  vin: { ...tipografi.mono, color: r.metin },
  meta: { ...tipografi.caption, color: r.metinSolgun },

  satirSag: { alignItems: 'flex-end', gap: 4 },
  sonucPul: { paddingHorizontal: bosluk.xs, paddingVertical: 3, borderRadius: kose.sm },
  sonucMetin: { ...tipografi.etiket },
  sayilar: { ...tipografi.caption, color: r.metinSolgun, fontVariant: ['tabular-nums'] },
});
