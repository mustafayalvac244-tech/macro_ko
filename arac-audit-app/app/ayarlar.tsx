import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Baslik, BaslikDugmesi, BilgiKutusu, Dugme, DereceRozeti } from '@/bilesenler/temel';
import { HATA_GRUPLARI } from '@/cekirdek/katalog';
import { bosluk, DOKUNMA, kose, Renkler, TemaTercihi, tipografi, useTema } from '@/tema';
import { bekleyenSenkron, hataTipiKullanimi } from '@/veri/depo';
import { useKatalog } from '@/veri/katalogDeposu';

const TEMALAR: { deger: TemaTercihi; etiket: string }[] = [
  { deger: 'sistem', etiket: 'Sistem' },
  { deger: 'acik', etiket: 'Açık' },
  { deger: 'koyu', etiket: 'Koyu' },
];

export default function Ayarlar() {
  const router = useRouter();
  const { renkler, tercih, tercihiAyarla } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);

  const [bekleyen, setBekleyen] = useState(0);

  useEffect(() => {
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



        <Text style={s.bolumBaslik}>EKİBİN EKLEDİĞİ HATA TİPLERİ</Text>
        <OzelTipler />

        <Text style={s.bolumBaslik}>VERİ</Text>
        <BilgiKutusu
          metin={bekleyen > 0
            ? `${bekleyen} kayıt sunucuya gönderilmeyi bekliyor. Merkezi sunucu bağlantısı henüz kurulmadı — kayıtlar cihazda güvende.`
            : 'Gönderilmeyi bekleyen kayıt yok.'}
        />

      </ScrollView>

    </View>
  );
}

/**
 * Uygulama içinden eklenen hata tiplerini yönetir.
 *
 * KALDIRMA GERÇEK SİLME DEĞİLDİR ve öyle olmamalı: eski hatalar bu kimliğe
 * bağlı, satırı silsek geçmiş raporlarda hata adı yerine "ht_m4x9…" görünür.
 * Kaldırılan tip seçim listesinden çıkar, raporlarda adıyla kalır. Kaç kayıtta
 * kullanıldığı da gösterilir ki denetçi ne kaldırdığını bilerek yapsın.
 */
function OzelTipler() {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const tipler = useKatalog((d) => d.ozelTipler);
  const kaldir = useKatalog((d) => d.kaldir);
  const geriAl = useKatalog((d) => d.geriAl);
  const [kullanim, setKullanim] = useState<Record<string, number>>({});

  useEffect(() => {
    let iptal = false;
    Promise.all(tipler.map(async (t) => [t.id, await hataTipiKullanimi(t.id)] as const))
      .then((c) => { if (!iptal) setKullanim(Object.fromEntries(c)); })
      .catch(() => { /* sayı gösterilemezse liste yine de çalışır */ });
    return () => { iptal = true; };
  }, [tipler]);

  if (tipler.length === 0) {
    return (
      <BilgiKutusu metin="Henüz eklenmedi. Hata kaydı ekranında aradığınız hatayı bulamazsanız oradan ekleyebilirsiniz; eklediğiniz tip listeye kalıcı olarak girer." />
    );
  }

  return (
    <>
      {tipler.map((t) => (
        <View key={t.id} style={[s.siddetSatiri, t.silindi && { opacity: 0.6 }]}>
          <DereceRozeti derece={t.derece} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.siddetAd} numberOfLines={2}>
              {t.ad}{t.silindi ? ' — listeden kaldırıldı' : ''}
            </Text>
            <Text style={s.siddetNot} numberOfLines={2}>
              {[
                HATA_GRUPLARI[t.grup]?.ad ?? t.grup,
                t.en || null,
                t.ekleyen ? `ekleyen: ${t.ekleyen}` : null,
                `${kullanim[t.id] ?? 0} kayıtta kullanıldı`,
              ].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <Dugme
            metin={t.silindi ? 'Geri al' : 'Kaldır'}
            kucuk
            tur={t.silindi ? 'ikincil' : 'sessiz'}
            onPress={() => (t.silindi ? geriAl(t.id) : kaldir(t.id))}
          />
        </View>
      ))}
    </>
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
