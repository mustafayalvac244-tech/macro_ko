import { File, Paths } from 'expo-file-system';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BoyaAciklamasi, DonusGorunumu } from '@/bilesenler/DonusGorunumu';
import { S } from '@/bilesenler/simgeler';
import {
  AltCubuk, Baslik, BaslikCipi, BilgiKutusu, BolumBasligi, BosDurum, DereceRozeti, Dugme, Ekran, GeriDugmesi,
  HataKutusu, IlerlemeCubugu, Kart, useDuzen, Yukleniyor,
} from '@/bilesenler/temel';
import {
  BOLGELER, DERECELER, HATA_TIPI_INDEKS, hataTipiAdi, parcaBolgeAdi, parcaCiftiAdi, parcaTamAdi, bolgelerAracIcin,
} from '@/cekirdek/katalog';
import { aracHaritasiVar, parcaDemeritleri } from '@/cekirdek/donusGorunumu';
import { aracEtiketi, ARAC_INDEKS } from '@/cekirdek/model3d';
import { demeritDegeri, SINIFLAR, sinifDegeri, sistemDegeri } from '@/cekirdek/nas';
import { takipAdi } from '@/cekirdek/takip';
import { denetimOzeti } from '@/cekirdek/puan';
import { kmGoster } from '@/cekirdek/aracBilgisi';
import { bicimTarih, csvUret, excelUret } from '@/cekirdek/rapor';
import { sureDakika, sureMetni } from '@/cekirdek/istatistik';
import { eksikSistemler, kapsamMetni, mevcutSistemler, sistemAdi } from '@/cekirdek/sistemler';
import { aracKimligi } from '@/cekirdek/vin';
import { Denetim, FotografBaytlari } from '@/cekirdek/tipler';
import { bosluk, kose, Renkler, tipografi, useTema } from '@/tema';
import { AcmaIstegi, useAcmaIstegi } from '@/veri/acmaIstegi';
import { useAracGorselleri } from '@/veri/aracGorselleri';
import { degisiklikGunlugu, denetimGetir, denetimGuncelle, fotograflariGetir } from '@/veri/depo';
import { GunlukKaydi, gunlukOzeti } from '@/cekirdek/gunluk';
import { useDil } from '@/veri/dilDeposu';

/**
 * Paylaşılan dosyanın dili. Ekibin kendi tablosu ("Part Related Issues") baştan
 * sona İngilizce — başlıklar da, açıklamalar da. Ekran arayüz dilindedir
 * (Türkçe/İngilizce); dosya her zaman ekibin kullandığı dilde çıkar.
 */
const DOSYA_DILI = 'en' as const;

/** Bölge dağılımında İngilizce ad: denetimOzeti bölge adını Türkçe verir. */
const BOLGE_EN: Record<string, string> = Object.fromEntries(BOLGELER.map((b) => [b.id, b.en]));

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
  const { dil, t } = useDil();

  const [denetim, setDenetim] = useState<Denetim | null>(null);
  const [calisiyor, setCalisiyor] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [okundu, setOkundu] = useState(false); // okundu ve yoksa: "bulunamadı", sonsuz tekerlek değil

  // Değişiklik geçmişi (26.10.2026, göç 10): düzeltilen ve silinen kayıtların izi.
  const [gunluk, setGunluk] = useState<GunlukKaydi[]>([]);
  useEffect(() => {
    if (!id) return;
    denetimGetir(id).then((d) => { setDenetim(d); setOkundu(true); }).catch((h) => setHata(String(h)));
    degisiklikGunlugu(id).then(setGunluk).catch(() => setGunluk([]));
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
    const an = new Date(d.baslangic);
    const iki = (n: number) => String(n).padStart(2, '0');
    return `denetim_${d.vin || (d.bodyNo ? `body${d.bodyNo}` : 'sasisiz')}_${an.getFullYear()}${iki(an.getMonth() + 1)}${iki(an.getDate())}_${iki(an.getHours())}${iki(an.getMinutes())}.${uzanti}`;
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
        setBilgi(t(`${fotolar.size} fotoğraf dosyanın içine gömüldü.`, `${fotolar.size} ${fotolar.size === 1 ? 'photo' : 'photos'} embedded in the file.`));
      } else {
        dosya.write(csvUret(denetim, { dil: DOSYA_DILI }));
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(dosya.uri, {
          mimeType: tur === 'xlsx'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'text/csv',
          dialogTitle: t('Denetim raporunu paylaş', 'Share audit report'),
        });
      } else {
        setBilgi(t(`Dosya hazır: ${dosya.uri}`, `File ready: ${dosya.uri}`));
      }
    } catch (h) {
      setHata(h instanceof Error ? h.message : String(h));
    } finally {
      setCalisiyor(null);
    }
  }, [denetim, dosyaAdi, fotoBaytlari, t]);

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
        <Baslik baslik={t('Rapor', 'Report')} sol={<GeriDugmesi />} />
        {hata ? <View style={{ padding: bosluk.md }}><HataKutusu metin={hata} /></View>
          : okundu ? (
            <BosDurum
              simge={S.uyari}
              baslik={t('Denetim bulunamadı', 'Audit not found')}
              aciklama={t('Bu telefonda yok: silinmiş olabilir.', 'Not on this phone: it may have been deleted.')}
              eylem={<Dugme metin={t('Denetimlere dön', 'Back to audits')} tur="birincil" onPress={() => router.dismissTo('/')} />}
            />
          ) : <Yukleniyor />}
      </Ekran>
    );
  }

  const arac = ARAC_INDEKS[denetim.aracId];
  const enCokBolge = Math.max(1, ...ozet.bolgeDagilimi.map((b) => b.adet));
  const sistemListesi = mevcutSistemler(bolgelerAracIcin({ tip: arac?.tip ?? 'ice' }));
  const kontrolEdilen = sistemListesi.filter((x) => (denetim.kapsam ?? []).includes(x)).length;
  const agir = ozet.sinifDagilimi.MAJOR + ozet.sinifDagilimi.MAIN;

  const kunye: [string, string, boolean?][] = [
    [t('Araç', 'Vehicle'), arac ? `${arac.kod} · ${arac.tam}` : denetim.aracId],
    [t('Şasi', 'VIN'), denetim.vin || '—', true],
    ['Body No', denetim.bodyNo || '—', true],
    ['Spec', denetim.spec || '—'],
    [t('Kaynak', 'Source'), denetim.denetimTipi || '—'],
    [t('Denetçi', 'Auditor'), denetim.denetci || '—'],
    // Formdan kaldırılanlar (hat/vardiya 28.09.2026; plaka, km, faz, ekip,
    // rapor no 24.10.2026) yalnız eski bir denetimde doluysa gösterilir.
    ...([
      [t('Plaka', 'Plate'), denetim.plaka, true],
      [t('Kilometre', 'Mileage'), kmGoster(denetim.km, dil)],
      [t('Faz', 'Phase'), denetim.faz],
      [t('Ekip', 'Team'), denetim.ekip],
      [t('Rapor No', 'Report No'), denetim.raporNo],
      [t('Hat / Vardiya', 'Line / Shift'), [denetim.hat, denetim.vardiya].filter(Boolean).join(' / ')],
    ] as [string, string, boolean?][]).filter(([, deger]) => !!deger),
    [t('Tarih', 'Date'), bicimTarih(denetim.baslangic)],
    [t('Durum', 'Status'), denetim.durum === 'tamam'
      ? `${t('Tamamlandı', 'Completed')}${denetim.bitis ? ` · ${bicimTarih(denetim.bitis)}` : ''}`
      : t('Devam ediyor', 'In progress')],
    // Süre ve kapsam 24.10.2026'da eklendi (benzer uygulamaların incelenmesi).
    ...(denetim.durum === 'tamam' && sureDakika(denetim.baslangic, denetim.bitis) !== null
      ? [[t('Süre', 'Duration'), sureMetni(sureDakika(denetim.baslangic, denetim.bitis), dil)] as [string, string]]
      : []),
    [t('Kontrol edilen sistemler', 'Systems checked'), kapsamMetni(denetim.kapsam ?? [], mevcutSistemler(bolgelerAracIcin({ tip: arac?.tip ?? 'ice' })), dil)],
  ];

  return (
    <Ekran>
      <Baslik
        baslik={t('Rapor', 'Report')}
        sol={<GeriDugmesi />}
        ciplerSar
        cipler={(
          <>
            <BaslikCipi metin={aracKimligi(denetim)} mono />
            <BaslikCipi simge={S.arac} metin={aracEtiketi(arac, denetim.aracId)} />
            {denetim.faz ? <BaslikCipi simge={S.faz} metin={denetim.faz} /> : null}
            <BaslikCipi
              simge={denetim.durum === 'devam' ? S.vardiya : S.tik}
              metin={denetim.durum === 'devam' ? t('Devam ediyor', 'In progress') : t('Tamamlandı', 'Completed')}
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
            accessibilityLabel={t(
              `Rapor özeti: ${ozet.toplamAdet} hata, demerit ${ozet.demeritToplami}, ${agir} MAJOR ya da MAIN, ${ozet.fotografliHata} fotoğraflı`,
              `Report summary: ${ozet.toplamAdet} ${ozet.toplamAdet === 1 ? 'problem' : 'problems'}, demerit ${ozet.demeritToplami}, ${agir} MAJOR or MAIN, ${ozet.fotografliHata} with photo`,
            )}
          >
            {[
              { deger: ozet.toplamAdet, etiket: t('hata', ozet.toplamAdet === 1 ? 'problem' : 'problems'), renk: renkler.birincil },
              { deger: ozet.demeritToplami, etiket: 'demerit', renk: renkler.metin },
              { deger: agir, etiket: 'MAJOR / MAIN', renk: agir ? renkler.derece3 : renkler.metin },
              { deger: ozet.fotografliHata, etiket: t('fotoğraflı', 'with photo'), renk: renkler.metin },
            ].map((x, i) => (
              <View key={x.etiket} style={[s.ozetHucre, i > 0 && s.ozetAyrac]}>
                <Text style={[s.ozetDeger, { color: x.renk }]}>{x.deger}</Text>
                <Text style={s.ozetEtiket} numberOfLines={2}>{x.etiket}</Text>
              </View>
            ))}
          </View>
          <View style={s.ozetKapsam}>
            <View style={s.ozetKapsamUst}>
              <Text style={s.ozetKapsamMetin}>{t('Kontrol edilen sistemler', 'Systems checked')}</Text>
              <Text style={s.ozetKapsamSayi}>{`${kontrolEdilen}/${sistemListesi.length}`}</Text>
            </View>
            <IlerlemeCubugu
              deger={kontrolEdilen}
              toplam={sistemListesi.length}
              etiket={t(`Kontrol edilen sistemler ${kontrolEdilen}/${sistemListesi.length}`, `Systems checked ${kontrolEdilen}/${sistemListesi.length}`)}
            />
          </View>
        </Kart>

        <View style={[s.ikili, tablet && s.ikiliTablet]}>
          <Kart style={tablet ? { flex: 1 } : undefined}>
            <BolumBasligi
              metin={t('Künye', 'Details')}
              simge={S.etiket}
              sag={(
                <Dugme
                  metin={t('Düzenle', 'Edit')}
                  kucuk
                  tur="sessiz"
                  simge={S.duzenle}
                  erisimEtiketi={t('Denetim bilgilerini düzenle', 'Edit audit details')}
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
              <BolumBasligi metin={t('Demerit ve sınıf', 'Demerit and class')} simge={S.uyari} />
              {/* İki ayrı sütun: solda demerit'e, sağda class'a göre problem
                  adedi. Satırlar birbirine bağlı DEĞİL (aynı satırda durmaları
                  "demerit 3 = MINOR" diye okunmasın diye ayrı sütun). */}
              <View style={s.ikiSutun}>
                <View style={s.sutun}>
                  {DERECELER.map((d) => (
                    <View key={d.id} style={s.dereceSatiri} accessible accessibilityLabel={t(`Demerit ${d.id}: ${ozet.dereceDagilimi[d.id]} hata`, `Demerit ${d.id}: ${ozet.dereceDagilimi[d.id]} ${ozet.dereceDagilimi[d.id] === 1 ? 'problem' : 'problems'}`)}>
                      <DereceRozeti derece={d.id} kabul={false} />
                      <Text style={s.dereceSayi}>{ozet.dereceDagilimi[d.id]}</Text>
                    </View>
                  ))}
                </View>
                <View style={s.sutun}>
                  {SINIFLAR.map((c) => (
                    <View key={c} style={s.dereceSatiri} accessible accessibilityLabel={t(`${c}: ${ozet.sinifDagilimi[c]} hata`, `${c}: ${ozet.sinifDagilimi[c]} ${ozet.sinifDagilimi[c] === 1 ? 'problem' : 'problems'}`)}>
                      <Text style={s.sinifAd}>{c}</Text>
                      <Text style={s.dereceSayi}>{ozet.sinifDagilimi[c]}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </Kart>

            <Kart>
              <BolumBasligi metin={t('Bölgeye göre', 'By area')} simge={S.arac} />
              {ozet.bolgeDagilimi.length === 0 ? (
                <Text style={s.bos}>{t('Hata kaydedilmedi.', 'No defects recorded.')}</Text>
              ) : ozet.bolgeDagilimi.map((b) => (
                <View key={b.id} style={s.dagilimSatiri}>
                  <View style={s.dagilimUst}>
                    <Text style={s.dagilimAd} numberOfLines={1}>{dil === 'en' ? BOLGE_EN[b.id] ?? 'Unknown' : b.ad}</Text>
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

        {/* ARAÇ ÜZERİNDE HATALAR (26.10.2026). Dış değerlendirmede tasarımcı: "raporda
            araç üzerinde hata haritası yok"; sektördeki örnekler (ATS Inspect) hatayı
            araç resmi üzerinde gösteriyor. Salt okunur: döndürülür, seçilmez. Çizimi
            ya da görseli olmayan araçta kart çıkmaz. */}
        {/* `length > 0`: çıplak 0 Android'de Text dışında metin olur ve çöker. */}
        {denetim.hatalar.length > 0 && (aracHaritasiVar(denetim.aracId)
          || Object.keys(useAracGorselleri.getState().gorseller[denetim.aracId]?.yuvalar ?? {}).length > 0) ? (
          <Kart>
            <BolumBasligi metin={t('Araç üzerinde hatalar', 'Defects on the vehicle')} simge={S.arac} />
            <View testID="rapor-arac-haritasi">
              <DonusGorunumu
                aracId={denetim.aracId}
                bolgeler={bolgelerAracIcin({ tip: arac?.tip ?? 'ice' })}
                kayitliParcalar={parcaDemeritleri(denetim.hatalar)}
                onBolgeSec={() => {}}
                onParcaSec={() => {}}
                saltOkunur
              />
            </View>
            <BoyaAciklamasi boya="demerit" />
          </Kart>
        ) : null}

        <Kart>
          <BolumBasligi metin={t(`Problemler (${denetim.hatalar.length}) — demerit'e göre`, `Problems (${denetim.hatalar.length}) — by demerit`)} simge={S.liste} />
          <View testID="rapor-hatalar" style={{ gap: 6 }}>
            {denetim.hatalar.length === 0 ? <Text style={s.bos}>{t('Hata kaydedilmedi.', 'No defects recorded.')}</Text> : null}
            {siraliHatalar.map((h) => (
              <Pressable
                key={h.id}
                accessibilityRole="button"
                // Demerit etikette olmalı: düğmenin etiketi içindeki rozetin
                // etiketini örter; yoksa ekran okuyucu sıralamayı duyuramaz.
                accessibilityLabel={`${parcaCiftiAdi(h, dil)} ${HATA_TIPI_INDEKS[h.hataTipiId] ? hataTipiAdi(h.hataTipiId, dil) : ''}, demerit ${demeritDegeri(h)}, ${sinifDegeri(h)} — ${t('düzenle', 'edit')}`}
                onPress={() => calismaEkranindaAc({ denetimId: denetim.id, tur: 'hata', hataId: h.id })}
                style={({ pressed }) => [s.hataSatiri, pressed && { opacity: 0.72 }]}
              >
                {/* kabul GEÇİLMELİ: eski "kabul edilebilir" kayıt rozette 0
                    görünür (demerit'i 0); geçilmezse 3 görünürdü. */}
                <DereceRozeti derece={h.derece} kabul={h.kabulEdilebilir} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.hataAd} numberOfLines={2}>
                    {parcaCiftiAdi(h, dil)} — {hataTipiAdi(h.hataTipiId, dil)}
                  </Text>
                  <Text style={s.hataYol} numberOfLines={1}>
                    {[
                      parcaBolgeAdi(h.parcaId, dil),
                      h.adet > 1 ? t(`${h.adet} adet`, `qty ${h.adet}`) : null,
                      sinifDegeri(h) !== 'MINOR' ? sinifDegeri(h) : null,
                      sistemDegeri(h),
                      h.durum && h.durum !== 'acik' ? takipAdi(h.durum, dil) : null,
                      h.sorunTipi === 'Complex' ? t('Kompleks', 'Complex') : null,
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

        {gunluk.length ? (
          <Kart>
            <BolumBasligi metin={t(`Değişiklik geçmişi (${gunluk.length})`, `Change history (${gunluk.length})`)} simge={S.son} />
            <View style={{ gap: bosluk.xs }} testID="degisiklik-gecmisi">
              {gunluk.map((g) => (
                <View key={g.id} style={s.gunlukSatir}>
                  <Text style={s.gunlukZaman}>{bicimTarih(g.zaman)}{g.denetci ? ` · ${g.denetci}` : ''}</Text>
                  <Text style={s.gunlukMetin}>{gunlukOzeti(g, dil)}</Text>
                </View>
              ))}
            </View>
          </Kart>
        ) : null}

        {bilgi ? <BilgiKutusu metin={bilgi} /> : null}
        {hata ? <HataKutusu metin={hata} /> : null}
      </ScrollView>

      {bitirOnay ? (
        <View style={s.onayBandi}>
          <Text style={s.onayMetin}>
            {t('Denetim "tamamlandı" olarak işaretlenecek. Sonradan kayıt eklenirse yeniden açılır.', 'The audit will be marked "completed". It reopens if a record is added later.')}
            {/* Kapsam uyarısı (24.10.2026): hiç bakılmamış sistem "hatasız" sanılmasın. */}
            {eksikSistemler(denetim.kapsam ?? [], mevcutSistemler(bolgelerAracIcin({ tip: arac?.tip ?? 'ice' }))).length
              ? ` ${t('Kontrol edildi işareti olmayan sistemler', 'Systems not marked as checked')}: ${eksikSistemler(denetim.kapsam ?? [], mevcutSistemler(bolgelerAracIcin({ tip: arac?.tip ?? 'ice' }))).map((x) => sistemAdi(x, dil)).join(', ')}.`
              : t(' Bütün sistemler kontrol edildi.', ' All systems checked.')}
          </Text>
          <Dugme metin={t('Vazgeç', 'Cancel')} tur="sessiz" kucuk onPress={() => setBitirOnay(false)} erisimEtiketi={t('Bitirmekten vazgeç', 'Cancel finishing')} />
        </View>
      ) : null}

      <AltCubuk style={tablet ? { justifyContent: 'flex-end' } : undefined}>
        <Dugme
          metin="Excel"
          erisimEtiketi={t('Excel olarak paylaş', 'Share as Excel')}
          simge={S.excel}
          tur="birincil"
          yukleniyor={calisiyor === 'xlsx'}
          onPress={() => paylas('xlsx')}
          style={tablet ? { minWidth: 200 } : { flex: 1 }}
        />
        <Dugme
          metin="CSV"
          erisimEtiketi={t('CSV olarak paylaş', 'Share as CSV')}
          simge={S.csv}
          yukleniyor={calisiyor === 'csv'}
          onPress={() => paylas('csv')}
        />
        {denetim.durum === 'devam' ? (
          <Dugme
            metin={bitirOnay ? t('Evet, bitir', 'Yes, finish') : t('Bitir', 'Finish')}
            erisimEtiketi={bitirOnay ? t('Denetimi bitirmeyi onayla', 'Confirm finishing the audit') : t('Denetimi bitir', 'Finish audit')}
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
    padding: bosluk.xs, borderRadius: kose.md, backgroundColor: r.yuzeyAlt,
  },
  hataAd: { ...tipografi.bodyOrta, color: r.metin },
  hataYol: { ...tipografi.caption, color: r.metinSolgun },
  fotoSayi: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  fotoSayiMetin: { ...tipografi.captionOrta, color: r.metinIkincil },
  gunlukSatir: { gap: 2, paddingVertical: bosluk.xxs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: r.cizgiSolgun },
  gunlukZaman: { ...tipografi.caption, color: r.metinSolgun },
  gunlukMetin: { ...tipografi.body, color: r.metin },

  onayBandi: {
    flexDirection: 'row', alignItems: 'center', gap: bosluk.sm,
    paddingHorizontal: bosluk.md, paddingVertical: bosluk.xs,
    borderTopWidth: 1, borderTopColor: r.cizgiSolgun, backgroundColor: r.uyariYumusak,
  },
  onayMetin: { ...tipografi.caption, color: r.uyari, flex: 1 },
});
