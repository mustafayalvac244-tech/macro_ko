import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { HataSayfasi, HataTaslagi } from '@/bilesenler/HataSayfasi';
import { Model3B } from '@/bilesenler/Model3B';
import { ParcaSecici } from '@/bilesenler/ParcaSecici';
import {
  AltSayfa, Baslik, BaslikDugmesi, BilgiKutusu, Dugme, Ekran,
  HataKutusu, Olcu, SiddetRozeti, Yukleniyor,
} from '@/bilesenler/temel';
import { BOLGELER, HATA_TIPI_INDEKS, HIZLI_KALIPLAR, PARCA_INDEKS } from '@/cekirdek/katalog';
import { ARAC_INDEKS } from '@/cekirdek/model3d';
import { denetimOzeti, SIDDET_INDEKS } from '@/cekirdek/puan';
import { Denetim, Hata, ModelKipi } from '@/cekirdek/tipler';
import { bosluk, kose, Renkler, siddetRenkleri, tipografi, useTema } from '@/tema';
import {
  denetimGetir, FotografKaydi, fotograflariGetir, fotografiHataBagla,
  hataKaydet, hataSil, kimlikUret, sikKullanilanlar,
} from '@/veri/depo';

/** mesh kimliğinden parça kimliğine — 3B dokunuşunu katalog parçasına bağlar. */
const MESH_PARCA: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const b of BOLGELER) for (const p of b.parcalar) if (p.mesh) m[p.mesh] = p.id;
  return m;
})();

export default function DenetimEkrani() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);

  const [denetim, setDenetim] = useState<Denetim | null>(null);
  const [fotograflar, setFotograflar] = useState<FotografKaydi[]>([]);
  const [kip, setKip] = useState<ModelKipi>('dis');
  const [taslak, setTaslak] = useState<HataTaslagi | null>(null);
  // Aynı anda YALNIZ BİR alt sayfa açık olsun. İki ayrı boolean tutulduğunda
  // parça seçici kapanmadan hata sayfası açılıyor, iki katman üst üste
  // biniyor ve alttakine dokunulamıyor oluyordu (15.09.2026 tarayıcı sınavı).
  const [acikSayfa, setAcikSayfa] = useState<'yok' | 'secici' | 'hata'>('yok');
  const [hizli, setHizli] = useState<[string, string][]>(HIZLI_KALIPLAR);
  const [hata, setHata] = useState<string | null>(null);

  const tazele = useCallback(async () => {
    if (!id) return;
    try {
      const [d, f, sik] = await Promise.all([
        denetimGetir(id), fotograflariGetir(id), sikKullanilanlar(14),
      ]);
      setDenetim(d);
      setFotograflar(f);
      // Kullanım sayacı yeterince doluysa hızlı seçim ondan gelir; değilse
      // katalogdaki başlangıç kalıpları kullanılır.
      if (sik.length >= 4) setHizli(sik.map((k) => [k.parcaId, k.hataTipiId]));
      setHata(null);
    } catch (h) {
      setHata(h instanceof Error ? h.message : String(h));
    }
  }, [id]);

  useEffect(() => { tazele(); }, [tazele]);

  const ozet = useMemo(() => denetimOzeti(denetim), [denetim]);
  const arac = denetim ? ARAC_INDEKS[denetim.aracId] : undefined;

  /** Hatası olan parçaları en yüksek şiddetin rengiyle boyar. */
  const vurgular = useMemo(() => {
    const oncelik: Record<string, number> = { A: 3, B: 2, C: 1 };
    const enYuksek = new Map<string, string>();
    for (const h of denetim?.hatalar ?? []) {
      const mesh = PARCA_INDEKS[h.parcaId]?.mesh;
      if (!mesh) continue;
      const mevcut = enYuksek.get(mesh);
      if (!mevcut || (oncelik[h.siddet] ?? 0) > (oncelik[mevcut] ?? 0)) enYuksek.set(mesh, h.siddet);
    }
    const harita = new Map<string, string>();
    for (const [mesh, sd] of enYuksek) harita.set(mesh, siddetRenkleri(renkler, sd).on);
    return harita;
  }, [denetim?.hatalar, renkler]);

  const yeniHataAc = useCallback((parcaId: string, hataTipiId?: string) => {
    setAcikSayfa('hata');
    setTaslak({
      parcaId,
      hataTipiId: hataTipiId ?? '',
      siddet: hataTipiId ? (HATA_TIPI_INDEKS[hataTipiId]?.siddet ?? 'C') : 'C',
      adet: 1, konum: '', aciklama: '', fotograflar: [], durum: 'acik',
    });
  }, []);

  const kaydet = useCallback(async (t: HataTaslagi, fotoIdleri: string[]) => {
    if (!denetim) return;
    const hataId = t.id ?? kimlikUret('h');
    const kayit: Hata = {
      ...t,
      id: hataId,
      zaman: t.zaman ?? new Date().toISOString(),
      fotograflar: fotoIdleri,
    };
    await hataKaydet(denetim.id, kayit);
    // Hata kaydedilmeden çekilen fotoğraflar boşta duruyordu; şimdi bağla.
    for (const fid of fotoIdleri) await fotografiHataBagla(fid, hataId);
    setTaslak(null);
    setAcikSayfa('yok');
    await tazele();
  }, [denetim, tazele]);

  const sil = useCallback(async (hataId: string) => {
    await hataSil(hataId);
    setTaslak(null);
    setAcikSayfa('yok');
    await tazele();
  }, [tazele]);

  if (hata) {
    return (
      <Ekran kenarlar={['top']}>
        <Baslik baslik="Denetim" sol={<BaslikDugmesi metin="‹" erisimEtiketi="Geri" onPress={() => router.back()} />} />
        <View style={{ padding: bosluk.md }}><HataKutusu metin={hata} /></View>
      </Ekran>
    );
  }

  if (!denetim) {
    return (
      <Ekran kenarlar={['top']}>
        <Baslik baslik="Denetim" sol={<BaslikDugmesi metin="‹" erisimEtiketi="Geri" onPress={() => router.back()} />} />
        <Yukleniyor metin="Denetim açılıyor…" />
      </Ekran>
    );
  }

  const sonucRenk = ozet.sonuc.kod === 'RED' ? renkler.tehlike
    : ozet.sonuc.kod === 'SARTLI' ? renkler.uyari : renkler.basari;

  return (
    <Ekran kenarlar={['top']}>
      <Baslik
        baslik={denetim.vin || 'Denetim'}
        altBaslik={`${arac?.ad ?? denetim.aracId} · ${denetim.plaka || 'plakasız'}`}
        sol={<BaslikDugmesi metin="‹" erisimEtiketi="Geri" onPress={() => router.back()} />}
      />

      <ScrollView contentContainerStyle={s.govde} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.olcuSatiri}>
          <Olcu deger={ozet.toplamAdet} etiket="hata adedi" />
          <Olcu deger={ozet.toplamPuan} etiket="ceza puanı" />
          <Olcu deger={ozet.siddetDagilimi.A.adet} etiket="kritik (A)" renk={ozet.siddetDagilimi.A.adet ? renkler.tehlike : undefined} />
          <Olcu deger={ozet.fotografliHata} etiket="fotoğraflı" />
          <Olcu deger={ozet.sonuc.ad} etiket="sonuç" renk={sonucRenk} />
        </ScrollView>

        <View style={s.modelKutu}>
          <Model3B
            aracId={denetim.aracId}
            kip={kip}
            vurgular={vurgular}
            onKipDegisti={setKip}
            onParcaDokunuldu={(mesh) => {
              const parcaId = MESH_PARCA[mesh];
              if (parcaId) yeniHataAc(parcaId);
            }}
          />
        </View>

        {arac && !arac.olcuDogrulandi ? (
          <BilgiKutusu tur="uyari" metin={`${arac.ad}: ${arac.not} Model şematiktir.`} />
        ) : null}

        <Dugme metin="☰  Listeden parça seç" onPress={() => setAcikSayfa('secici')} />

        <Text style={s.bolumBaslik}>HIZLI SEÇİM — EN SIK KAYDEDİLENLER</Text>
        <FlatList
          horizontal
          data={hizli.filter(([p, h]) => PARCA_INDEKS[p] && HATA_TIPI_INDEKS[h])}
          keyExtractor={([p, h]) => `${p}.${h}`}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: bosluk.xs }}
          renderItem={({ item: [parcaId, hataTipiId] }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${PARCA_INDEKS[parcaId]!.ad} — ${HATA_TIPI_INDEKS[hataTipiId]!.ad} ekle`}
              onPress={() => yeniHataAc(parcaId, hataTipiId)}
              style={({ pressed }) => [s.hizliKart, pressed && { opacity: 0.7 }]}
            >
              <Text style={s.hizliAd} numberOfLines={2}>
                {PARCA_INDEKS[parcaId]!.ad} — {HATA_TIPI_INDEKS[hataTipiId]!.ad}
              </Text>
              <Text style={s.hizliYol} numberOfLines={1}>{PARCA_INDEKS[parcaId]!.bolgeAd}</Text>
            </Pressable>
          )}
        />

        <Text style={s.bolumBaslik}>KAYDEDİLEN HATALAR ({denetim.hatalar.length})</Text>
        {denetim.hatalar.length === 0 ? (
          <Text style={s.bosMetin}>Henüz hata yok. Modelden bir parçaya dokunun.</Text>
        ) : (
          denetim.hatalar.map((h) => {
            const p = PARCA_INDEKS[h.parcaId];
            const t = HATA_TIPI_INDEKS[h.hataTipiId];
            const ilkFoto = fotograflar.find((f) => f.id === h.fotograflar[0]);
            return (
              <Pressable
                key={h.id}
                accessibilityRole="button"
                accessibilityLabel={`${p?.ad} ${t?.ad} kaydını düzenle`}
                onPress={() => { setTaslak({ ...h }); setAcikSayfa('hata'); }}
                style={({ pressed }) => [s.hataSatiri, pressed && { backgroundColor: renkler.yuzeyAlt }]}
              >
                <SiddetRozeti siddet={h.siddet} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.hataAd} numberOfLines={1}>{p?.ad ?? h.parcaId} — {t?.ad ?? h.hataTipiId}</Text>
                  <Text style={s.hataYol} numberOfLines={1}>
                    {p?.bolgeAd}
                    {h.adet > 1 ? ` · ${h.adet} adet` : ''}
                    {h.konum ? ` · ${h.konum}` : ''}
                    {` · ${(SIDDET_INDEKS[h.siddet]?.puan ?? 0) * h.adet} puan`}
                  </Text>
                </View>
                {ilkFoto ? <Image source={{ uri: ilkFoto.uri }} style={s.fotoPul} /> : (
                  <Text style={s.fotoYok}>📷—</Text>
                )}
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <View style={s.altCubuk}>
        <Dugme metin="+ Hata Ekle" tur="birincil" onPress={() => setAcikSayfa('secici')} style={{ flex: 1 }} />
        <Dugme metin="Rapor" onPress={() => router.push({ pathname: '/denetim/rapor', params: { id: denetim.id } })} style={{ flex: 1 }} />
      </View>

      {/* TEK alt sayfa kabuğu: içerik değişir, kabuk değişmez. İki Modal üst
          üste açıldığında kapanan modal DOM'da asılı kalıp alttakini
          engelliyordu. */}
      <AltSayfa
        gorunur={acikSayfa !== 'yok'}
        tamYukseklik={acikSayfa === 'secici'}
        onKapat={() => { setAcikSayfa('yok'); setTaslak(null); }}
      >
        {acikSayfa === 'secici' ? (
          <ParcaSecici
            aracTipi={arac?.tip ?? 'ice'}
            onKapat={() => setAcikSayfa('yok')}
            onSec={(parcaId) => yeniHataAc(parcaId)}
          />
        ) : (
          <HataSayfasi
            denetimId={denetim.id}
            denetci={denetim.denetci}
            taslak={taslak}
            fotograflar={fotograflar}
            onKapat={() => { setTaslak(null); setAcikSayfa('yok'); }}
            onKaydet={kaydet}
            onSil={sil}
          />
        )}
      </AltSayfa>

    </Ekran>
  );
}

const stiller = (r: Renkler) => StyleSheet.create({
  govde: { padding: bosluk.md, gap: bosluk.sm, paddingBottom: bosluk.xxxl },
  olcuSatiri: { gap: bosluk.xs, paddingRight: bosluk.md },
  modelKutu: { height: 320 },

  bolumBaslik: { ...tipografi.etiket, color: r.metinSolgun, marginTop: bosluk.xs },
  bosMetin: { ...tipografi.body, color: r.metinSolgun, paddingVertical: bosluk.md, textAlign: 'center' },

  hizliKart: {
    width: 168, gap: 2, padding: bosluk.xs,
    borderRadius: kose.md, borderWidth: 1, borderColor: r.cizgi, backgroundColor: r.yuzey,
  },
  hizliAd: { ...tipografi.captionOrta, color: r.metin },
  hizliYol: { ...tipografi.caption, color: r.metinSolgun, fontSize: 11 },

  hataSatiri: {
    flexDirection: 'row', alignItems: 'center', gap: bosluk.sm,
    padding: bosluk.xs, borderRadius: kose.md,
    borderWidth: 1, borderColor: r.cizgiSolgun, backgroundColor: r.yuzey,
  },
  hataAd: { ...tipografi.bodyOrta, color: r.metin },
  hataYol: { ...tipografi.caption, color: r.metinSolgun },
  fotoPul: { width: 40, height: 40, borderRadius: kose.sm, borderWidth: 1, borderColor: r.cizgi },
  fotoYok: { ...tipografi.caption, color: r.metinSolgun },

  altCubuk: {
    flexDirection: 'row', gap: bosluk.xs, padding: bosluk.md,
    backgroundColor: r.bgYukseltilmis, borderTopWidth: 1, borderTopColor: r.cizgiSolgun,
  },
});
