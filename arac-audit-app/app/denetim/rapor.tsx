import { File, Paths } from 'expo-file-system';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { S } from '@/bilesenler/simgeler';
import {
  AltCubuk, Baslik, BaslikCipi, BilgiKutusu, BolumBasligi, DereceRozeti, Dugme, Ekran, GeriDugmesi,
  HataKutusu, Kart, Olcu, useDuzen, Yukleniyor,
} from '@/bilesenler/temel';
import { DERECELER, HATA_TIPI_INDEKS, PARCA_INDEKS, parcaTamAdi } from '@/cekirdek/katalog';
import { ARAC_INDEKS } from '@/cekirdek/model3d';
import { denetimOzeti } from '@/cekirdek/puan';
import { bicimTarih, csvUret, excelUret } from '@/cekirdek/rapor';
import { Denetim, FotografBaytlari } from '@/cekirdek/tipler';
import { bosluk, kose, Renkler, tipografi, useTema } from '@/tema';
import { denetimGetir, denetimGuncelle, fotograflariGetir } from '@/veri/depo';

/**
 * Paylaşılan dosyanın dili. Ekibin kendi tablosu ("Part Related Issues") baştan
 * sona İngilizce — başlıklar da, açıklamalar da. Ekran Türkçe kalır; dosya
 * ekibin kullandığı dilde çıkar.
 */
const DOSYA_DILI = 'en' as const;

export default function RaporEkrani() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const { tablet } = useDuzen();

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
        dosya.write(excelUret(denetim, fotolar, { dil: DOSYA_DILI }));
        setBilgi(`${fotolar.size} fotoğraf dosyanın içine gömüldü.`);
      } else {
        dosya.write(csvUret(denetim, { dil: DOSYA_DILI }));
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
      <Ekran>
        <Baslik baslik="Rapor" sol={<GeriDugmesi />} />
        {hata ? <View style={{ padding: bosluk.md }}><HataKutusu metin={hata} /></View> : <Yukleniyor />}
      </Ekran>
    );
  }

  const arac = ARAC_INDEKS[denetim.aracId];
  const enCokBolge = Math.max(1, ...ozet.bolgeDagilimi.map((b) => b.adet));

  const kunye: [string, string, boolean?][] = [
    ['Araç', arac?.tam ?? denetim.aracId],
    ['Şasi', denetim.vin, true],
    ['Plaka', denetim.plaka || '—', true],
    ['Faz', denetim.faz || '—'],
    ['Ekip', denetim.ekip || '—'],
    ['Kaynak', denetim.denetimTipi || '—'],
    ['Rapor No', denetim.raporNo || '—'],
    ['Denetçi', denetim.denetci || '—'],
    // Hat ve vardiya formdan kaldırıldı (28.09.2026); yalnız eski bir
    // denetimde doluysa gösterilir.
    ...([denetim.hat, denetim.vardiya].some(Boolean)
      ? [['Hat / Vardiya', [denetim.hat, denetim.vardiya].filter(Boolean).join(' / ')] as [string, string]]
      : []),
    ['Tarih', bicimTarih(denetim.baslangic)],
  ];

  return (
    <Ekran>
      <Baslik
        baslik="Rapor"
        sol={<GeriDugmesi />}
        cipler={(
          <>
            <BaslikCipi metin={denetim.vin} mono />
            <BaslikCipi simge={S.arac} metin={arac?.ad ?? denetim.aracId} />
            {denetim.faz ? <BaslikCipi simge={S.faz} metin={denetim.faz} /> : null}
            <BaslikCipi
              simge={denetim.durum === 'devam' ? S.vardiya : S.tik}
              metin={denetim.durum === 'devam' ? 'Devam ediyor' : 'Tamamlandı'}
            />
          </>
        )}
      />

      <ScrollView contentContainerStyle={s.govde} showsVerticalScrollIndicator={false}>
        <View style={s.olcuSatiri}>
          <Olcu genis simge={S.rapor} deger={ozet.toplamAdet} etiket="bulgu" renk={renkler.birincil} zemin={renkler.birincilYumusak} />
          <Olcu genis simge={S.uyari} deger={ozet.dereceDagilimi['3'].adet} etiket="derece 3" renk={renkler.derece3} zemin={renkler.derece3Yumusak} />
          <Olcu genis simge={S.kabul} deger={ozet.kabulEdilebilirAdet} etiket="kabul edilebilir" />
          <Olcu genis simge={S.kamera} deger={ozet.fotografliHata} etiket="fotoğraflı" />
        </View>

        <View style={[s.ikili, tablet && s.ikiliTablet]}>
          <Kart style={tablet ? { flex: 1 } : undefined}>
            <BolumBasligi metin="KÜNYE" simge={S.etiket} />
            <View style={s.kunye}>
              {kunye.map(([e, d, mono]) => (
                <View key={e} style={[s.kunyeHucre, tablet && s.kunyeHucreIkili]}>
                  <Text style={s.kunyeEtiket}>{e}</Text>
                  <Text style={[s.kunyeDeger, mono && s.kunyeMono]} numberOfLines={1}>{d}</Text>
                </View>
              ))}
            </View>
          </Kart>

          <View style={[{ gap: bosluk.md }, tablet && { flex: 1 }]}>
            <Kart>
              <BolumBasligi metin="DERECEYE GÖRE" simge={S.uyari} />
              {DERECELER.map((d) => {
                const dd = ozet.dereceDagilimi[d.id];
                return (
                  <View key={d.id} style={s.dereceSatiri}>
                    <View style={s.dereceHucre}>
                      <DereceRozeti derece={d.id} kabul={false} />
                      <Text style={s.dereceSayi}>{dd.adet}</Text>
                      <Text style={s.dereceNot}>düzeltilecek</Text>
                    </View>
                    <View style={s.dereceHucre}>
                      <DereceRozeti derece={d.id} kabul />
                      <Text style={s.dereceSayi}>{dd.kabul}</Text>
                      <Text style={s.dereceNot}>kabul edilebilir</Text>
                    </View>
                  </View>
                );
              })}
            </Kart>

            <Kart>
              <BolumBasligi metin="BÖLGEYE GÖRE" simge={S.arac} />
              {ozet.bolgeDagilimi.length === 0 ? (
                <Text style={s.bos}>Hata kaydedilmedi.</Text>
              ) : ozet.bolgeDagilimi.map((b) => (
                <View key={b.id} style={s.dagilimSatiri}>
                  <View style={s.dagilimUst}>
                    <Text style={s.dagilimAd} numberOfLines={1}>{b.ad}</Text>
                    <Text style={s.dagilimSayi}>{b.adet}</Text>
                  </View>
                  {/* Çubuk uzunluğu en kalabalık bölgeye göre; sayı yanında yazılı. */}
                  <View style={s.cubukIz}>
                    <View style={[s.cubukDolu, { width: `${(b.adet / enCokBolge) * 100}%` }]} />
                  </View>
                </View>
              ))}
            </Kart>
          </View>
        </View>

        <Kart>
          <BolumBasligi metin={`HATALAR (${denetim.hatalar.length})`} simge={S.liste} />
          <View testID="rapor-hatalar" style={{ gap: 6 }}>
            {denetim.hatalar.length === 0 ? <Text style={s.bos}>Hata kaydedilmedi.</Text> : null}
            {denetim.hatalar.map((h) => (
              <View key={h.id} style={s.hataSatiri}>
                {/* kabul GEÇİLMELİ: geçilmezse (3) bu ekranda düz 3 görünüyordu —
                    kabul edilmiş bulgu düzeltilecek hata gibi (26.09.2026). */}
                <DereceRozeti derece={h.derece} kabul={h.kabulEdilebilir} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.hataAd} numberOfLines={1}>
                    {parcaTamAdi(h.parcaId)} — {HATA_TIPI_INDEKS[h.hataTipiId]?.ad ?? h.hataTipiId}
                  </Text>
                  <Text style={s.hataYol} numberOfLines={1}>
                    {[
                      PARCA_INDEKS[h.parcaId]?.bolgeAd,
                      h.adet > 1 ? `${h.adet} adet` : null,
                      h.sorunTipi === 'Complex' ? 'Complex' : null,
                      h.sorumlu ? `→ ${h.sorumlu}` : null,
                    ].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                {h.fotograflar.length ? (
                  <View style={s.fotoSayi}>
                    <S.kamera size={14} color={renkler.metinIkincil} strokeWidth={2} />
                    <Text style={s.fotoSayiMetin}>{h.fotograflar.length}</Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        </Kart>

        {bilgi ? <BilgiKutusu metin={bilgi} /> : null}
        {hata ? <HataKutusu metin={hata} /> : null}
      </ScrollView>

      <AltCubuk style={tablet ? { justifyContent: 'flex-end' } : undefined}>
        <Dugme
          metin="Excel"
          erisimEtiketi="Excel olarak paylaş"
          simge={S.excel}
          tur="birincil"
          yukleniyor={calisiyor === 'xlsx'}
          onPress={() => paylas('xlsx')}
          style={tablet ? { minWidth: 200 } : { flex: 1 }}
        />
        <Dugme
          metin="CSV"
          erisimEtiketi="CSV olarak paylaş"
          simge={S.csv}
          yukleniyor={calisiyor === 'csv'}
          onPress={() => paylas('csv')}
        />
        {denetim.durum === 'devam' ? (
          <Dugme metin="Bitir" erisimEtiketi="Denetimi bitir" simge={S.tamam} onPress={bitir} />
        ) : null}
      </AltCubuk>
    </Ekran>
  );
}

const stiller = (r: Renkler) => StyleSheet.create({
  govde: {
    padding: bosluk.md, gap: bosluk.md, paddingBottom: bosluk.xxxl,
    width: '100%', maxWidth: 1100, alignSelf: 'center',
  },
  olcuSatiri: { flexDirection: 'row', flexWrap: 'wrap', gap: bosluk.xs },

  ikili: { gap: bosluk.md },
  ikiliTablet: { flexDirection: 'row', alignItems: 'flex-start' },

  kunye: { flexDirection: 'row', flexWrap: 'wrap' },
  kunyeHucre: {
    width: '100%', paddingVertical: bosluk.xs,
    borderBottomWidth: 1, borderBottomColor: r.cizgiSolgun,
  },
  kunyeHucreIkili: { width: '50%', paddingRight: bosluk.sm },
  kunyeEtiket: { ...tipografi.etiket, color: r.metinSolgun },
  kunyeDeger: { ...tipografi.bodyOrta, color: r.metin },
  kunyeMono: { ...tipografi.mono, color: r.metin },

  dereceSatiri: {
    flexDirection: 'row', gap: bosluk.sm, paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: r.cizgiSolgun,
  },
  dereceHucre: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: bosluk.xs },
  dereceSayi: { ...tipografi.sayi, color: r.metin, minWidth: 24, textAlign: 'right' },
  dereceNot: { ...tipografi.caption, color: r.metinSolgun, flexShrink: 1 },

  bos: { ...tipografi.body, color: r.metinSolgun },

  dagilimSatiri: { gap: 4, paddingVertical: 4 },
  dagilimUst: { flexDirection: 'row', justifyContent: 'space-between', gap: bosluk.sm },
  dagilimAd: { ...tipografi.body, color: r.metin, flex: 1 },
  dagilimSayi: { ...tipografi.sayi, color: r.metin },
  cubukIz: { height: 8, borderRadius: kose.pill, backgroundColor: r.yuzeyAlt, overflow: 'hidden' },
  cubukDolu: { height: 8, borderRadius: kose.pill, backgroundColor: r.birincil },

  hataSatiri: {
    flexDirection: 'row', alignItems: 'center', gap: bosluk.sm,
    padding: bosluk.xs, borderRadius: kose.md,
    borderWidth: 1, borderColor: r.cizgiSolgun, backgroundColor: r.yuzey,
  },
  hataAd: { ...tipografi.bodyOrta, color: r.metin },
  hataYol: { ...tipografi.caption, color: r.metinSolgun },
  fotoSayi: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  fotoSayiMetin: { ...tipografi.captionOrta, color: r.metinIkincil },
});
