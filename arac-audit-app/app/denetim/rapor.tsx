import { File, Paths } from 'expo-file-system';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { S } from '@/bilesenler/simgeler';
import {
  AltCubuk, Baslik, BaslikCipi, BilgiKutusu, BolumBasligi, DereceRozeti, Dugme, Ekran, GeriDugmesi,
  HataKutusu, IlerlemeCubugu, Kart, useDuzen, Yukleniyor,
} from '@/bilesenler/temel';
import { DERECELER, HATA_TIPI_INDEKS, PARCA_INDEKS, parcaTamAdi, bolgelerAracIcin } from '@/cekirdek/katalog';
import { aracEtiketi, ARAC_INDEKS } from '@/cekirdek/model3d';
import { demeritDegeri, SINIFLAR, sinifDegeri, sistemDegeri } from '@/cekirdek/nas';
import { denetimOzeti } from '@/cekirdek/puan';
import { kmGoster } from '@/cekirdek/aracBilgisi';
import { bicimTarih, csvUret, excelUret } from '@/cekirdek/rapor';
import { sureDakika, sureMetni } from '@/cekirdek/istatistik';
import { eksikSistemler, kapsamMetni, mevcutSistemler, sistemAdi } from '@/cekirdek/sistemler';
import { aracKimligi } from '@/cekirdek/vin';
import { Denetim, FotografBaytlari } from '@/cekirdek/tipler';
import { bosluk, kose, Renkler, tipografi, useTema } from '@/tema';
import { AcmaIstegi, useAcmaIstegi } from '@/veri/acmaIstegi';
import { denetimGetir, denetimGuncelle, fotograflariGetir } from '@/veri/depo';

/**
 * Paylaşılan dosyanın dili. Ekibin kendi tablosu ("Part Related Issues") baştan
 * sona İngilizce — başlıklar da, açıklamalar da. Ekran Türkçe kalır; dosya
 * ekibin kullandığı dilde çıkar.
 */
const DOSYA_DILI = 'en' as const;

export default function RaporEkrani() {
  // kaynak=ana: rapor ana sayfadan (bitmiş denetimin kartından) açıldı; çalışma
  // ekranına GERİ dönülmez, ona GEÇİLİR.
  // bitir=1: çalışma ekranındaki "Denetimi bitir"den gelindi; onay bandı
  // açık başlar (25.10.2026).
  const { id, kaynak, bitir: bitirIstegi } = useLocalSearchParams<{ id: string; kaynak?: string; bitir?: string }>();
  const router = useRouter();
  const acmaIste = useAcmaIstegi((d) => d.iste);
  const [bitirOnay, setBitirOnay] = useState(bitirIstegi === '1');
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
    return `denetim_${d.vin || (d.bodyNo ? `body${d.bodyNo}` : 'sasisiz')}_${t.getFullYear()}${iki(t.getMonth() + 1)}${iki(t.getDate())}_${iki(t.getHours())}${iki(t.getMinutes())}.${uzanti}`;
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

  // BİTİR İKİ ADIMLI. Önceden onaysızdı, "CSV"nin 8 px yanındaydı ve doğrudan
  // ana sayfaya atıyordu (üç ajanın sınaması, 28.09.2026).
  const bitir = useCallback(async () => {
    if (!denetim) return;
    if (!bitirOnay) { setBitirOnay(true); return; }
    await denetimGuncelle(denetim.id, { durum: 'tamam', bitis: new Date().toISOString() });
    // replace('/') DEĞİL: o, yığındaki çalışma ekranını bırakıp üstüne ikinci
    // bir ana sayfa koyuyordu; Android'de geri tuşu eski ekrana dönüyordu
    // (uçtan uca sınama, 28.09.2026). dismissTo ana sayfaya kadar kapatır.
    router.dismissTo('/');
  }, [denetim, router, bitirOnay]);

  /**
   * Çalışma ekranında bir şeyi açar: rapordaki hata satırı → o kaydın
   * düzenlemesi; künyedeki "Düzenle" → denetim bilgileri. Önceden bir hatayı
   * düzeltip rapora dönmek 9 dokunuştu (sınama).
   */
  const calismaEkranindaAc = useCallback((istek: AcmaIstegi) => {
    acmaIste(istek);
    if (kaynak === 'ana' || !router.canGoBack()) router.replace({ pathname: '/denetim/[id]', params: { id: istek.denetimId } });
    else router.back();
  }, [acmaIste, kaynak, router]);

  /** Rapordaki liste demerit'e göre: önce 3, sonra zaman (eski "kabul edilebilir" = 0). */
  const siraliHatalar = useMemo(() => [...(denetim?.hatalar ?? [])].sort((a, b) =>
    (demeritDegeri(b) - demeritDegeri(a))
    || a.zaman.localeCompare(b.zaman)), [denetim]);

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
  const sistemListesi = mevcutSistemler(bolgelerAracIcin({ tip: arac?.tip ?? 'ice' }));
  const kontrolEdilen = sistemListesi.filter((x) => (denetim.kapsam ?? []).includes(x)).length;
  const agir = ozet.sinifDagilimi.MAJOR + ozet.sinifDagilimi.MAIN;

  const kunye: [string, string, boolean?][] = [
    ['Araç', arac ? `${arac.kod} · ${arac.tam}` : denetim.aracId],
    ['Şasi', denetim.vin || '—', true],
    ['Body No', denetim.bodyNo || '—', true],
    ['Spec', denetim.spec || '—'],
    ['Kaynak', denetim.denetimTipi || '—'],
    ['Denetçi', denetim.denetci || '—'],
    // Formdan kaldırılanlar (hat/vardiya 28.09.2026; plaka, km, faz, ekip,
    // rapor no 24.10.2026) yalnız eski bir denetimde doluysa gösterilir.
    ...([
      ['Plaka', denetim.plaka, true],
      ['Kilometre', kmGoster(denetim.km)],
      ['Faz', denetim.faz],
      ['Ekip', denetim.ekip],
      ['Rapor No', denetim.raporNo],
      ['Hat / Vardiya', [denetim.hat, denetim.vardiya].filter(Boolean).join(' / ')],
    ] as [string, string, boolean?][]).filter(([, deger]) => !!deger),
    ['Tarih', bicimTarih(denetim.baslangic)],
    ['Durum', denetim.durum === 'tamam'
      ? `Tamamlandı${denetim.bitis ? ` · ${bicimTarih(denetim.bitis)}` : ''}`
      : 'Devam ediyor'],
    // Süre ve kapsam 24.10.2026'da eklendi (benzer uygulamaların incelenmesi).
    ...(denetim.durum === 'tamam' && sureDakika(denetim.baslangic, denetim.bitis) !== null
      ? [['Süre', sureMetni(sureDakika(denetim.baslangic, denetim.bitis))] as [string, string]]
      : []),
    ['Kontrol edilen sistemler', kapsamMetni(denetim.kapsam ?? [], mevcutSistemler(bolgelerAracIcin({ tip: arac?.tip ?? 'ice' })))],
  ];

  return (
    <Ekran>
      <Baslik
        baslik="Rapor"
        sol={<GeriDugmesi />}
        cipler={(
          <>
            <BaslikCipi metin={aracKimligi(denetim)} mono />
            <BaslikCipi simge={S.arac} metin={aracEtiketi(arac, denetim.aracId)} />
            {denetim.faz ? <BaslikCipi simge={S.faz} metin={denetim.faz} /> : null}
            <BaslikCipi
              simge={denetim.durum === 'devam' ? S.vardiya : S.tik}
              metin={denetim.durum === 'devam' ? 'Devam ediyor' : 'Tamamlandı'}
            />
          </>
        )}
      />

      <ScrollView contentContainerStyle={s.govde} showsVerticalScrollIndicator={false}>
        {/* TEK ÖZET KARTI (25.10.2026, Lumiform'un rapor özeti örnek): dört
            ayrı ölçü kutusu yerine bir kart — sayılar yan yana, altında kontrol
            ilerlemesi. 26.10.2026: Excel'in alanlarıyla — problem, demerit,
            MAJOR+MAIN. MAJOR/MAIN sıfırsa kırmızı değil: kırmızı yalnız sorun
            varken görünsün. */}
        <Kart>
          <View
            style={s.ozetSatir}
            accessible
            accessibilityLabel={`Rapor özeti: ${ozet.toplamAdet} problem, demerit ${ozet.demeritToplami}, ${agir} MAJOR ya da MAIN, ${ozet.fotografliHata} fotoğraflı`}
          >
            {[
              { deger: ozet.toplamAdet, etiket: 'problem', renk: renkler.birincil },
              { deger: ozet.demeritToplami, etiket: 'demerit', renk: renkler.metin },
              { deger: agir, etiket: 'MAJOR / MAIN', renk: agir ? renkler.derece3 : renkler.metin },
              { deger: ozet.fotografliHata, etiket: 'fotoğraflı', renk: renkler.metin },
            ].map((x, i) => (
              <View key={x.etiket} style={[s.ozetHucre, i > 0 && s.ozetAyrac]}>
                <Text style={[s.ozetDeger, { color: x.renk }]}>{x.deger}</Text>
                <Text style={s.ozetEtiket} numberOfLines={2}>{x.etiket}</Text>
              </View>
            ))}
          </View>
          <View style={s.ozetKapsam}>
            <View style={s.ozetKapsamUst}>
              <Text style={s.ozetKapsamMetin}>Kontrol edilen sistemler</Text>
              <Text style={s.ozetKapsamSayi}>{`${kontrolEdilen}/${sistemListesi.length}`}</Text>
            </View>
            <IlerlemeCubugu
              deger={kontrolEdilen}
              toplam={sistemListesi.length}
              etiket={`Kontrol edilen sistemler ${kontrolEdilen}/${sistemListesi.length}`}
            />
          </View>
        </Kart>

        <View style={[s.ikili, tablet && s.ikiliTablet]}>
          <Kart style={tablet ? { flex: 1 } : undefined}>
            <BolumBasligi
              metin="Künye"
              simge={S.etiket}
              sag={(
                <Dugme
                  metin="Düzenle"
                  kucuk
                  tur="sessiz"
                  simge={S.duzenle}
                  erisimEtiketi="Denetim bilgilerini düzenle"
                  onPress={() => calismaEkranindaAc({ denetimId: denetim.id, tur: 'bilgiler' })}
                />
              )}
            />
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
              <BolumBasligi metin="Demerit ve class" simge={S.uyari} />
              {/* İki ayrı sütun: solda demerit'e, sağda class'a göre problem
                  adedi. Satırlar birbirine bağlı DEĞİL (aynı satırda durmaları
                  "demerit 3 = MINOR" diye okunmasın diye ayrı sütun). */}
              <View style={s.ikiSutun}>
                <View style={s.sutun}>
                  {DERECELER.map((d) => (
                    <View key={d.id} style={s.dereceSatiri} accessible accessibilityLabel={`Demerit ${d.id}: ${ozet.dereceDagilimi[d.id]} problem`}>
                      <DereceRozeti derece={d.id} kabul={false} />
                      <Text style={s.dereceSayi}>{ozet.dereceDagilimi[d.id]}</Text>
                    </View>
                  ))}
                </View>
                <View style={s.sutun}>
                  {SINIFLAR.map((c) => (
                    <View key={c} style={s.dereceSatiri} accessible accessibilityLabel={`${c}: ${ozet.sinifDagilimi[c]} problem`}>
                      <Text style={s.sinifAd}>{c}</Text>
                      <Text style={s.dereceSayi}>{ozet.sinifDagilimi[c]}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </Kart>

            <Kart>
              <BolumBasligi metin="Bölgeye göre" simge={S.arac} />
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
          <BolumBasligi metin={`Problemler (${denetim.hatalar.length}) — demerit'e göre`} simge={S.liste} />
          <View testID="rapor-hatalar" style={{ gap: 6 }}>
            {denetim.hatalar.length === 0 ? <Text style={s.bos}>Hata kaydedilmedi.</Text> : null}
            {siraliHatalar.map((h) => (
              <Pressable
                key={h.id}
                accessibilityRole="button"
                // Demerit etikette olmalı: düğmenin etiketi içindeki rozetin
                // etiketini örter; yoksa ekran okuyucu sıralamayı duyuramaz.
                accessibilityLabel={`${parcaTamAdi(h.parcaId)} ${HATA_TIPI_INDEKS[h.hataTipiId]?.ad ?? ''}, demerit ${demeritDegeri(h)}, ${sinifDegeri(h)} — düzenle`}
                onPress={() => calismaEkranindaAc({ denetimId: denetim.id, tur: 'hata', hataId: h.id })}
                style={({ pressed }) => [s.hataSatiri, pressed && { opacity: 0.72 }]}
              >
                {/* kabul GEÇİLMELİ: eski "kabul edilebilir" kayıt rozette 0
                    görünür (demerit'i 0); geçilmezse 3 görünürdü. */}
                <DereceRozeti derece={h.derece} kabul={h.kabulEdilebilir} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.hataAd} numberOfLines={1}>
                    {parcaTamAdi(h.parcaId)} — {HATA_TIPI_INDEKS[h.hataTipiId]?.ad ?? h.hataTipiId}
                  </Text>
                  <Text style={s.hataYol} numberOfLines={1}>
                    {[
                      PARCA_INDEKS[h.parcaId]?.bolgeAd,
                      h.adet > 1 ? `${h.adet} adet` : null,
                      sinifDegeri(h) !== 'MINOR' ? sinifDegeri(h) : null,
                      sistemDegeri(h),
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
                <S.ileri size={18} color={renkler.metinSolgun} strokeWidth={2} />
              </Pressable>
            ))}
          </View>
        </Kart>

        {bilgi ? <BilgiKutusu metin={bilgi} /> : null}
        {hata ? <HataKutusu metin={hata} /> : null}
      </ScrollView>

      {bitirOnay ? (
        <View style={s.onayBandi}>
          <Text style={s.onayMetin}>
            Denetim "tamamlandı" olarak işaretlenecek. Sonradan kayıt eklenirse yeniden açılır.
            {/* Kapsam uyarısı (24.10.2026): hiç bakılmamış sistem "hatasız" sanılmasın. */}
            {eksikSistemler(denetim.kapsam ?? [], mevcutSistemler(bolgelerAracIcin({ tip: arac?.tip ?? 'ice' }))).length
              ? ` Kontrol edildi işareti olmayan sistemler: ${eksikSistemler(denetim.kapsam ?? [], mevcutSistemler(bolgelerAracIcin({ tip: arac?.tip ?? 'ice' }))).map((x) => sistemAdi(x)).join(', ')}.`
              : ' Bütün sistemler kontrol edildi.'}
          </Text>
          <Dugme metin="Vazgeç" tur="sessiz" kucuk onPress={() => setBitirOnay(false)} erisimEtiketi="Bitirmekten vazgeç" />
        </View>
      ) : null}

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
          <Dugme
            metin={bitirOnay ? 'Evet, bitir' : 'Bitir'}
            erisimEtiketi={bitirOnay ? 'Denetimi bitirmeyi onayla' : 'Denetimi bitir'}
            simge={S.tamam}
            tur={bitirOnay ? 'birincil' : 'ikincil'}
            onPress={bitir}
          />
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
  ozetSatir: { flexDirection: 'row' },
  ozetHucre: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: 4 },
  ozetAyrac: { borderLeftWidth: 1, borderLeftColor: r.cizgiSolgun },
  ozetDeger: { ...tipografi.sayiBuyuk },
  ozetEtiket: { ...tipografi.caption, color: r.metinSolgun, textAlign: 'center' },
  ozetKapsam: { gap: 6, paddingTop: bosluk.sm, borderTopWidth: 1, borderTopColor: r.cizgiSolgun },
  ozetKapsamUst: { flexDirection: 'row', justifyContent: 'space-between', gap: bosluk.sm },
  ozetKapsamMetin: { ...tipografi.caption, color: r.metinSolgun },
  ozetKapsamSayi: { ...tipografi.captionOrta, color: r.metinIkincil, fontVariant: ['tabular-nums'] },

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
  kunyeMono: { ...tipografi.kimlik, color: r.metin },

  ikiSutun: { flexDirection: 'row', gap: bosluk.lg },
  sutun: { flex: 1 },
  dereceSatiri: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: bosluk.sm,
    minHeight: 40, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: r.cizgiSolgun,
  },
  dereceSayi: { ...tipografi.sayi, color: r.metin, minWidth: 24, textAlign: 'right' },
  sinifAd: { ...tipografi.captionOrta, color: r.metinIkincil },

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

  onayBandi: {
    flexDirection: 'row', alignItems: 'center', gap: bosluk.sm,
    paddingHorizontal: bosluk.md, paddingVertical: bosluk.xs,
    borderTopWidth: 1, borderTopColor: r.cizgiSolgun, backgroundColor: r.uyariYumusak,
  },
  onayMetin: { ...tipografi.caption, color: r.uyari, flex: 1 },
});
