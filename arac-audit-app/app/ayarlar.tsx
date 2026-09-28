import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ListeDuzenle, useSecimListesi } from '@/bilesenler/EklenebilirSecim';
import { SurumKarti } from '@/bilesenler/Guncelleme';
import { GRUP_SIMGELERI, S, Simge } from '@/bilesenler/simgeler';
import {
  Baslik, BilgiKutusu, BolumBasligi, DereceRozeti, Dugme, Ekran, GeriDugmesi, Kart, Secenek, useDuzen,
} from '@/bilesenler/temel';
import { HATA_GRUPLARI } from '@/cekirdek/katalog';
import { HAZIR_DENETCILER, HAZIR_FAZLAR, LISTE_ANAHTARI } from '@/cekirdek/listeler';
import { bosluk, kose, Renkler, TemaTercihi, tipografi, useTema } from '@/tema';
import { bekleyenSenkron, hataTipiKullanimi } from '@/veri/depo';
import { useKatalog } from '@/veri/katalogDeposu';

const TEMALAR: { deger: TemaTercihi; etiket: string; simge: Simge }[] = [
  { deger: 'sistem', etiket: 'Sistem', simge: S.sistemTema },
  { deger: 'acik', etiket: 'Açık', simge: S.acikTema },
  { deger: 'koyu', etiket: 'Koyu', simge: S.koyuTema },
];

export default function Ayarlar() {
  const { renkler, tercih, tercihiAyarla } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  // Telefonda üç seçenek yan yana; simge + ad + tik sığmıyor, "Sistem" "Sis…"
  // diye kesiliyordu (28.09.2026 ekran görüntüsü). Dar ekranda simge düşer;
  // tik kalır, çünkü seçimi yalnız renkle değil onunla da gösteriyoruz.
  const { en } = useDuzen();
  const denetciler = useSecimListesi(LISTE_ANAHTARI.denetci, HAZIR_DENETCILER);
  const fazlar = useSecimListesi(LISTE_ANAHTARI.faz, HAZIR_FAZLAR);

  const [bekleyen, setBekleyen] = useState(0);

  useEffect(() => {
    bekleyenSenkron().then(setBekleyen).catch(() => {});
  }, []);

  return (
    <Ekran>
      <Baslik baslik="Ayarlar" sol={<GeriDugmesi />} />
      <ScrollView contentContainerStyle={s.govde}>
        <Kart>
          <BolumBasligi metin="GÖRÜNÜM" simge={S.gorunum} />
          <Text style={s.aciklama}>Üst çubuk iki temada da koyudur; içerik seçilen temayı izler.</Text>
          <View style={s.satir}>
            {TEMALAR.map((t) => (
              <Secenek
                key={t.deger}
                metin={t.etiket}
                simge={en >= 600 ? t.simge : undefined}
                erisimEtiketi={`${t.etiket} tema`}
                secili={tercih === t.deger}
                onPress={() => tercihiAyarla(t.deger)}
                style={{ flex: 1 }}
              />
            ))}
          </View>
        </Kart>

        {/* Yeni denetim formundaki hazır seçenekler. Kaldırılan ad eski
            denetimlerde yazılı kalır; yalnız yeni denetimde seçilemez. */}
        <Kart>
          <BolumBasligi metin="DENETÇİLER" simge={S.ekip} />
          <Text style={s.aciklama}>Yeni denetimde listeden seçilir. Bu cihazda saklanır; başka tablete geçmez.</Text>
          <ListeDuzenle ad="Denetçi" liste={denetciler} yerTutucu="Ad Soyad" />
        </Kart>

        <Kart>
          <BolumBasligi metin="FAZLAR" simge={S.faz} />
          <ListeDuzenle ad="Faz" liste={fazlar} yerTutucu="Ör. P1" buyukHarf />
        </Kart>

        <Kart>
          <BolumBasligi metin="EKİBİN EKLEDİĞİ HATA TİPLERİ" simge={S.etiket} />
          <OzelTipler />
        </Kart>

        <Kart>
          <BolumBasligi metin="VERİ" simge={S.veri} />
          {/* "Gönderilmeyi bekliyor" demiyoruz: gönderen bir kod yok, sunucu
              kurulmadı. Sayı, cihazda duran satırların sayısıdır. */}
          <BilgiKutusu
            metin={bekleyen > 0
              ? `${bekleyen} kayıt (denetim, hata ve fotoğraf satırı) yalnız bu cihazda. Merkezi sunucu bağlantısı henüz kurulmadı; dışarı almak için denetim raporunu Excel olarak paylaşın.`
              : 'Cihazda kayıt yok.'}
          />
        </Kart>

        {/* Hangi paketin çalıştığı ve elle güncelleme denetimi. Web'de gizli. */}
        <SurumKarti />
      </ScrollView>
    </Ekran>
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
      {tipler.map((t) => {
        const GrupIkon = GRUP_SIMGELERI[t.grup];
        return (
        <View key={t.id} style={[s.tipSatiri, t.silindi && { opacity: 0.6 }]}>
          {/* Bu bir hata TİPİ, kaydedilmiş bulgu değil: tipin kabul durumu yok. */}
          <DereceRozeti derece={t.derece} kabul={false} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.tipAd} numberOfLines={2}>
              {t.ad}{t.silindi ? ' — listeden kaldırıldı' : ''}
            </Text>
            <View style={s.tipNotSatir}>
              {GrupIkon ? <GrupIkon size={13} color={renkler.metinSolgun} strokeWidth={2} /> : null}
              <Text style={s.tipNot} numberOfLines={2}>
              {[
                HATA_GRUPLARI[t.grup]?.ad ?? t.grup,
                t.en || null,
                t.ekleyen ? `ekleyen: ${t.ekleyen}` : null,
                `${kullanim[t.id] ?? 0} kayıtta kullanıldı`,
              ].filter(Boolean).join(' · ')}
              </Text>
            </View>
          </View>
          <Dugme
            metin={t.silindi ? 'Geri al' : 'Kaldır'}
            simge={t.silindi ? S.geriAl : S.sil}
            kucuk
            tur={t.silindi ? 'ikincil' : 'sessiz'}
            erisimEtiketi={`${t.ad}: ${t.silindi ? 'listeye geri al' : 'listeden kaldır'}`}
            onPress={() => (t.silindi ? geriAl(t.id) : kaldir(t.id))}
          />
        </View>
        );
      })}
    </>
  );
}

const stiller = (r: Renkler) => StyleSheet.create({
  govde: {
    padding: bosluk.md, gap: bosluk.md, paddingBottom: bosluk.xxxl,
    width: '100%', maxWidth: 760, alignSelf: 'center',
  },
  aciklama: { ...tipografi.caption, color: r.metinSolgun },
  satir: { flexDirection: 'row', gap: bosluk.xs },
  tipSatiri: {
    flexDirection: 'row', alignItems: 'center', gap: bosluk.sm,
    padding: bosluk.xs, borderRadius: kose.md,
    borderWidth: 1, borderColor: r.cizgiSolgun, backgroundColor: r.yuzey,
  },
  tipAd: { ...tipografi.bodyOrta, color: r.metin },
  tipNotSatir: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tipNot: { ...tipografi.caption, color: r.metinSolgun, flexShrink: 1 },
});
