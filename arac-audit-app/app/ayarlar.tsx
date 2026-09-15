import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Baslik, BaslikDugmesi, BilgiKutusu, Dugme, Girdi, SiddetRozeti } from '@/bilesenler/temel';
import { SIDDETLER } from '@/cekirdek/katalog';
import { VARSAYILAN_ESIKLER } from '@/cekirdek/puan';
import { Esikler } from '@/cekirdek/tipler';
import { bosluk, DOKUNMA, kose, Renkler, TemaTercihi, tipografi, useTema } from '@/tema';
import { ayarOku, ayarYaz, bekleyenSenkron } from '@/veri/depo';

const TEMALAR: { deger: TemaTercihi; etiket: string }[] = [
  { deger: 'sistem', etiket: 'Sistem' },
  { deger: 'acik', etiket: 'Açık' },
  { deger: 'koyu', etiket: 'Koyu' },
];

export default function Ayarlar() {
  const router = useRouter();
  const { renkler, tercih, tercihiAyarla } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);

  const [esikler, setEsikler] = useState<Esikler>(VARSAYILAN_ESIKLER);
  const [bekleyen, setBekleyen] = useState(0);
  const [kaydedildi, setKaydedildi] = useState(false);

  useEffect(() => {
    ayarOku<Esikler>('esikler', VARSAYILAN_ESIKLER).then(setEsikler).catch(() => {});
    bekleyenSenkron().then(setBekleyen).catch(() => {});
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: renkler.bg }}>
      <Baslik
        baslik="Ayarlar"
        sol={<BaslikDugmesi metin="‹" erisimEtiketi="Geri" onPress={() => router.back()} />}
      />
      <ScrollView contentContainerStyle={s.govde}>
        <Text style={s.bolumBaslik}>GÖRÜNÜM</Text>
        <View style={s.satir}>
          {TEMALAR.map((t) => (
            <Pressable
              key={t.deger}
              accessibilityRole="radio"
              accessibilityState={{ selected: tercih === t.deger }}
              accessibilityLabel={`${t.etiket} tema`}
              onPress={() => tercihiAyarla(t.deger)}
              style={[s.secim, tercih === t.deger && s.secimSecili]}
            >
              <Text style={[s.secimMetin, tercih === t.deger && { color: renkler.birincil }]}>{t.etiket}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.bolumBaslik}>KARAR EŞİKLERİ</Text>
        <BilgiKutusu
          tur="uyari"
          metin="Bu ağırlıklar ve eşikler ÖRNEK başlangıç değerleridir; resmî bir audit standardından alınmamıştır. Kendi standardınızın sayılarını girin."
        />
        <View style={s.ikili}>
          <View style={{ flex: 1 }}>
            <Girdi
              etiket="ŞARTLI EŞİĞİ"
              value={String(esikler.sartliPuan)}
              keyboardType="number-pad"
              onChangeText={(t) => setEsikler({ ...esikler, sartliPuan: Math.max(1, Number(t) || 0) })}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Girdi
              etiket="RED EŞİĞİ"
              value={String(esikler.redPuan)}
              keyboardType="number-pad"
              onChangeText={(t) => setEsikler({ ...esikler, redPuan: Math.max(1, Number(t) || 0) })}
            />
          </View>
        </View>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: esikler.kritikVarsaRed }}
          accessibilityLabel="Tek kritik hata aracı reddetsin"
          onPress={() => setEsikler({ ...esikler, kritikVarsaRed: !esikler.kritikVarsaRed })}
          style={s.onay}
        >
          <View style={[s.kutu, esikler.kritikVarsaRed && { backgroundColor: renkler.birincil, borderColor: renkler.birincil }]}>
            {esikler.kritikVarsaRed ? <Text style={s.tik}>✓</Text> : null}
          </View>
          <Text style={s.onayMetin}>Tek bir kritik (A) hata aracı reddetsin</Text>
        </Pressable>

        <Text style={s.bolumBaslik}>CEZA PUANI AĞIRLIKLARI</Text>
        {SIDDETLER.map((sd) => (
          <View key={sd.id} style={s.siddetSatiri}>
            <SiddetRozeti siddet={sd.id} />
            <View style={{ flex: 1 }}>
              <Text style={s.siddetAd}>{sd.ad} — {sd.puan} puan</Text>
              <Text style={s.siddetNot}>{sd.aciklama}</Text>
            </View>
          </View>
        ))}

        <Text style={s.bolumBaslik}>VERİ</Text>
        <BilgiKutusu
          metin={bekleyen > 0
            ? `${bekleyen} kayıt sunucuya gönderilmeyi bekliyor. Merkezi sunucu bağlantısı henüz kurulmadı — kayıtlar cihazda güvende.`
            : 'Gönderilmeyi bekleyen kayıt yok.'}
        />

        {kaydedildi ? <BilgiKutusu metin="Ayarlar kaydedildi." /> : null}
      </ScrollView>

      <View style={s.altCubuk}>
        <Dugme
          metin="Kaydet"
          tur="birincil"
          onPress={async () => {
            await ayarYaz('esikler', esikler);
            setKaydedildi(true);
          }}
        />
      </View>
    </View>
  );
}

const stiller = (r: Renkler) => StyleSheet.create({
  govde: { padding: bosluk.md, gap: bosluk.sm, paddingBottom: bosluk.xxxl },
  bolumBaslik: { ...tipografi.etiket, color: r.metinSolgun, marginTop: bosluk.sm },
  satir: { flexDirection: 'row', gap: bosluk.xs },
  ikili: { flexDirection: 'row', gap: bosluk.xs },
  secim: {
    flex: 1, minHeight: DOKUNMA, alignItems: 'center', justifyContent: 'center',
    borderRadius: kose.md, borderWidth: 1, borderColor: r.cizgi, backgroundColor: r.yuzey,
  },
  secimSecili: { borderColor: r.birincil, backgroundColor: r.birincilYumusak },
  secimMetin: { ...tipografi.bodyOrta, color: r.metin },
  onay: { flexDirection: 'row', alignItems: 'center', gap: bosluk.sm, minHeight: DOKUNMA },
  kutu: {
    width: 26, height: 26, borderRadius: kose.sm, borderWidth: 1.5,
    borderColor: r.cizgiGuclu, alignItems: 'center', justifyContent: 'center',
  },
  tik: { color: '#FFFFFF', ...tipografi.captionOrta },
  onayMetin: { ...tipografi.body, color: r.metin, flex: 1 },
  siddetSatiri: {
    flexDirection: 'row', alignItems: 'center', gap: bosluk.sm,
    padding: bosluk.xs, borderRadius: kose.md,
    borderWidth: 1, borderColor: r.cizgiSolgun, backgroundColor: r.yuzey,
  },
  siddetAd: { ...tipografi.bodyOrta, color: r.metin },
  siddetNot: { ...tipografi.caption, color: r.metinSolgun },
  altCubuk: {
    padding: bosluk.md, backgroundColor: r.bgYukseltilmis,
    borderTopWidth: 1, borderTopColor: r.cizgiSolgun,
  },
});
