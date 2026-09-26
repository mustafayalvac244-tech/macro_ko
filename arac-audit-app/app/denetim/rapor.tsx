import { File, Paths } from 'expo-file-system';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  Baslik, BaslikDugmesi, BilgiKutusu, Dugme, HataKutusu, Olcu, DereceRozeti, Yukleniyor,
} from '@/bilesenler/temel';
import { HATA_TIPI_INDEKS, PARCA_INDEKS } from '@/cekirdek/katalog';
import { ARAC_INDEKS } from '@/cekirdek/model3d';
import { denetimOzeti } from '@/cekirdek/puan';
import { bicimTarih, csvUret, excelUret } from '@/cekirdek/rapor';
import { Denetim, FotografBaytlari } from '@/cekirdek/tipler';
import { bosluk, kose, Renkler, tipografi, useTema } from '@/tema';
import { denetimGetir, denetimGuncelle, fotograflariGetir } from '@/veri/depo';

export default function RaporEkrani() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);

  const [denetim, setDenetim] = useState<Denetim | null>(null);
  const [calisiyor, setCalisiyor] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    denetimGetir(id).then(setDenetim).catch((h) => setHata(String(h)));
  }, [id]);

  const ozet = useMemo(() => denetimOzeti(denetim), [denetim]);

  /** Fotoğrafları diskten okuyup Excel'e gömülecek bayta çevirir. */
  const fotoBaytlari = useCallback(async (d: Denetim): Promise<Map<string, FotografBaytlari>> => {
    const kayitlar = await fotograflariGetir(d.id);
    const harita = new Map<string, FotografBaytlari>();
    for (const k of kayitlar) {
      try {
        const dosya = new File(k.uri);
        harita.set(k.id, { bayt: await dosya.bytes(), en: k.en, boy: k.boy });
      } catch {
        // Fotoğraf dosyası silinmiş olabilir (cihaz temizliği). Raporu bu
        // yüzden iptal etmiyoruz; o hata fotoğrafsız çıkar.
      }
    }
    return harita;
  }, []);

  const dosyaAdi = useCallback((d: Denetim, uzanti: string) => {
    const t = new Date(d.baslangic);
    const iki = (n: number) => String(n).padStart(2, '0');
    return `denetim_${d.vin || 'sasisiz'}_${t.getFullYear()}${iki(t.getMonth() + 1)}${iki(t.getDate())}_${iki(t.getHours())}${iki(t.getMinutes())}.${uzanti}`;
  }, []);

  const paylas = useCallback(async (tur: 'xlsx' | 'csv') => {
    if (!denetim) return;
    setCalisiyor(tur);
    setHata(null);
    setBilgi(null);
    try {
      const ad = dosyaAdi(denetim, tur);
      const dosya = new File(Paths.cache, ad);
      if (dosya.exists) dosya.delete();
      dosya.create();

      if (tur === 'xlsx') {
        const fotolar = await fotoBaytlari(denetim);
        dosya.write(excelUret(denetim, fotolar));
        setBilgi(`${fotolar.size} fotoğraf dosyanın içine gömüldü.`);
      } else {
        dosya.write(csvUret(denetim));
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(dosya.uri, {
          mimeType: tur === 'xlsx'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'text/csv',
          dialogTitle: 'Denetim raporunu paylaş',
        });
      } else {
        setBilgi(`Dosya hazır: ${dosya.uri}`);
      }
    } catch (h) {
      setHata(h instanceof Error ? h.message : String(h));
    } finally {
      setCalisiyor(null);
    }
  }, [denetim, dosyaAdi, fotoBaytlari]);

  const bitir = useCallback(async () => {
    if (!denetim) return;
    await denetimGuncelle(denetim.id, { durum: 'tamam', bitis: new Date().toISOString() });
    router.replace('/');
  }, [denetim, router]);

  if (!denetim) {
    return (
      <View style={{ flex: 1, backgroundColor: renkler.bg }}>
        <Baslik baslik="Rapor" sol={<BaslikDugmesi metin="‹" erisimEtiketi="Geri" onPress={() => router.back()} />} />
        {hata ? <View style={{ padding: bosluk.md }}><HataKutusu metin={hata} /></View> : <Yukleniyor />}
      </View>
    );
  }

  const arac = ARAC_INDEKS[denetim.aracId];

  return (
    <View style={{ flex: 1, backgroundColor: renkler.bg }}>
      <Baslik
        baslik="Rapor"
        altBaslik={denetim.vin}
        sol={<BaslikDugmesi metin="‹" erisimEtiketi="Geri" onPress={() => router.back()} />}
      />

      <ScrollView contentContainerStyle={s.govde} showsVerticalScrollIndicator={false}>

        <View style={s.olcuSatiri}>
          <Olcu deger={ozet.toplamAdet} etiket="hata adedi" genis />
          <Olcu deger={ozet.dereceDagilimi['3'].adet} etiket="derece 3" genis />
          <Olcu deger={ozet.fotografliHata} etiket="fotoğraflı" genis />
        </View>

        <View style={s.kunye}>
          {[
            ['Araç', arac?.tam ?? denetim.aracId],
            ['Şasi', denetim.vin],
            ['Plaka', denetim.plaka || '—'],
            ['Rapor No', denetim.raporNo || '—'],
            ['Denetçi', denetim.denetci || '—'],
            ['Hat / Vardiya', [denetim.hat, denetim.vardiya].filter(Boolean).join(' / ') || '—'],
            ['Tip', denetim.denetimTipi || '—'],
            ['Tarih', bicimTarih(denetim.baslangic)],
          ].map(([e, d]) => (
            <View key={e} style={s.kunyeSatiri}>
              <Text style={s.kunyeEtiket}>{e}</Text>
              <Text style={s.kunyeDeger} numberOfLines={1}>{d}</Text>
            </View>
          ))}
        </View>

        <Text style={s.bolumBaslik}>BÖLGEYE GÖRE</Text>
        {ozet.bolgeDagilimi.length === 0 ? (
          <Text style={s.bos}>Hata kaydedilmedi.</Text>
        ) : ozet.bolgeDagilimi.map((b) => (
          <View key={b.id} style={s.dagilimSatiri}>
            <Text style={s.dagilimAd} numberOfLines={1}>{b.ad}</Text>
            <Text style={s.dagilimSayi}>{b.adet} hata</Text>
          </View>
        ))}

        <Text style={s.bolumBaslik}>HATALAR ({denetim.hatalar.length})</Text>
        {denetim.hatalar.map((h) => (
          <View key={h.id} style={s.hataSatiri}>
            <DereceRozeti derece={h.derece} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.hataAd} numberOfLines={1}>
                {PARCA_INDEKS[h.parcaId]?.ad ?? h.parcaId} — {HATA_TIPI_INDEKS[h.hataTipiId]?.ad ?? h.hataTipiId}
              </Text>
              <Text style={s.hataYol} numberOfLines={1}>
                {PARCA_INDEKS[h.parcaId]?.bolgeAd}
                {h.fotograflar.length ? ` · ${h.fotograflar.length} fotoğraf` : ''}
              </Text>
            </View>
          </View>
        ))}

        {bilgi ? <BilgiKutusu metin={bilgi} /> : null}
        {hata ? <HataKutusu metin={hata} /> : null}
      </ScrollView>

      <View style={s.altCubuk}>
        <Dugme metin="⤓ Excel" tur="birincil" yukleniyor={calisiyor === 'xlsx'} onPress={() => paylas('xlsx')} style={{ flex: 1 }} />
        <Dugme metin="⤓ CSV" yukleniyor={calisiyor === 'csv'} onPress={() => paylas('csv')} />
        {denetim.durum === 'devam' ? <Dugme metin="✓ Bitir" onPress={bitir} /> : null}
      </View>
    </View>
  );
}

const stiller = (r: Renkler) => StyleSheet.create({
  govde: { padding: bosluk.md, gap: bosluk.sm, paddingBottom: bosluk.xxxl },
  sonucKutu: {
    backgroundColor: r.yuzey, borderRadius: kose.lg, borderWidth: 1,
    borderColor: r.cizgiSolgun, padding: bosluk.md, gap: 2,
  },
  sonucMetin: { ...tipografi.display },
  gerekce: { ...tipografi.caption, color: r.metinSolgun },
  olcuSatiri: { flexDirection: 'row', gap: bosluk.xs },

  kunye: {
    backgroundColor: r.yuzey, borderRadius: kose.md, borderWidth: 1,
    borderColor: r.cizgiSolgun, paddingHorizontal: bosluk.sm,
  },
  kunyeSatiri: {
    flexDirection: 'row', justifyContent: 'space-between', gap: bosluk.sm,
    paddingVertical: bosluk.xs, borderBottomWidth: 1, borderBottomColor: r.cizgiSolgun,
  },
  kunyeEtiket: { ...tipografi.caption, color: r.metinSolgun },
  kunyeDeger: { ...tipografi.captionOrta, color: r.metin, flexShrink: 1 },

  bolumBaslik: { ...tipografi.etiket, color: r.metinSolgun, marginTop: bosluk.sm },
  bos: { ...tipografi.body, color: r.metinSolgun },

  dagilimSatiri: {
    flexDirection: 'row', justifyContent: 'space-between', gap: bosluk.sm,
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: r.cizgiSolgun,
  },
  dagilimAd: { ...tipografi.body, color: r.metin, flex: 1 },
  dagilimSayi: { ...tipografi.caption, color: r.metinSolgun, fontVariant: ['tabular-nums'] },

  hataSatiri: {
    flexDirection: 'row', alignItems: 'center', gap: bosluk.sm,
    padding: bosluk.xs, borderRadius: kose.md,
    borderWidth: 1, borderColor: r.cizgiSolgun, backgroundColor: r.yuzey,
  },
  hataAd: { ...tipografi.bodyOrta, color: r.metin },
  hataYol: { ...tipografi.caption, color: r.metinSolgun },

  altCubuk: {
    flexDirection: 'row', gap: bosluk.xs, padding: bosluk.md,
    backgroundColor: r.bgYukseltilmis, borderTopWidth: 1, borderTopColor: r.cizgiSolgun,
  },
});
