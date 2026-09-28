// GÜNCELLEME — OTA (havadan güncelleme) için ekrandaki iki parça.
//
// Ürün sahibi, 28.09.2026: "OTA ile güncelleme at." Uygulama her açılışta yeni
// sürümü arar ve ARKA PLANDA indirir; açılışı beklemez (app.json →
// updates.fallbackToCacheTimeout 0: fabrikada bağlantı zayıf olabilir, denetçi
// boş ekranda beklememeli). İnen sürüm bir sonraki açılışta kendiliğinden
// devreye girer; buradaki düğmeler beklemeden devreye almak için.
//
// GÖRÜNMEDİĞİ YERLER: web ve geliştirme sunucusu. Web'deki expo-updates
// taklidi `isEnabled: true` döndürüyor (expo-updates 57.0.23,
// build/ExpoUpdates.web.js); yalnız isEnabled'e bakmak yetmiyor.

import * as Updates from 'expo-updates';
import React, { useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { S } from '@/bilesenler/simgeler';
import { BilgiKutusu, BolumBasligi, Dugme, Kart } from '@/bilesenler/temel';
import { calisanPaketMetni } from '@/cekirdek/surum';
import { bosluk, kose, Renkler, tipografi, useTema } from '@/tema';

export const GUNCELLEME_ACIK = Platform.OS !== 'web' && Updates.isEnabled;

const INDI = 'Yeni sürüm indirildi. Yeniden başlatınca devreye girer; kayıtlar silinmez.';
const BASLATILAMADI = 'Yeniden başlatılamadı. Uygulamayı kapatıp açın; yeni sürüm açılışta devreye girer.';

/**
 * Ana sayfa: arka planda yeni sürüm indiyse tek satırlık şerit, yoksa hiçbir
 * şey. Kart değil şerit: ilk sürüm (kutu + tam genişlik düğme) telefonda
 * ekranın beşte birini kaplıyordu; ürün sahibi "çok kalabalık olmasın" dedi.
 */
export function GuncellemeBildirimi() {
  return GUNCELLEME_ACIK ? <Bildirim /> : null;
}

function Bildirim() {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const { isUpdatePending } = Updates.useUpdates();
  const [basarisiz, setBasarisiz] = useState(false);
  if (!isUpdatePending) return null;
  const renk = basarisiz ? renkler.uyari : renkler.basari;
  return (
    <View style={[s.serit, { backgroundColor: basarisiz ? renkler.uyariYumusak : renkler.basariYumusak, borderLeftColor: renk }]}>
      <S.guncelleme size={18} color={renk} strokeWidth={2} />
      <Text style={[s.seritMetin, { color: renk }]}>
        {basarisiz ? BASLATILAMADI : 'Yeni sürüm hazır · kayıtlar silinmez'}
      </Text>
      {basarisiz ? null : (
        <Dugme
          metin="Yeniden başlat"
          tur="birincil"
          kucuk
          simge={S.yenidenBaslat}
          erisimEtiketi="Yeni sürümü yüklemek için uygulamayı yeniden başlat"
          onPress={() => { Updates.reloadAsync().catch(() => setBasarisiz(true)); }}
        />
      )}
    </View>
  );
}

/** Ayarlar → Sürüm: hangi paketin çalıştığı ve elle denetleme. */
export function SurumKarti() {
  return GUNCELLEME_ACIK ? <SurumIcerigi /> : null;
}

type Durum = null | 'guncel' | 'ulasilamadi' | 'baslatilamadi';

function SurumIcerigi() {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const { currentlyRunning, isUpdatePending, isChecking, isDownloading } = Updates.useUpdates();
  const [durum, setDurum] = useState<Durum>(null);

  const denetle = async () => {
    setDurum(null);
    try {
      const sonuc = await Updates.checkForUpdateAsync();
      // Geri alma yönergesi `isAvailable: false` ile gelir ama yine de
      // indirilmelidir; yoksa sunucudan geri alınan sürüm telefonda kalır.
      if (!sonuc.isAvailable && !sonuc.isRollBackToEmbedded) {
        setDurum('guncel');
        return;
      }
      const inen = await Updates.fetchUpdateAsync();
      // Başarılıysa useUpdates → isUpdatePending true olur ve düğme değişir.
      if (!inen.isNew && !inen.isRollBackToEmbedded) setDurum('guncel');
    } catch {
      setDurum('ulasilamadi');
    }
  };

  const kutu = currentlyRunning.isEmergencyLaunch
    ? {
      tur: 'uyari' as const,
      metin: `Son güncelleme açılamadı; APK ile gelen paket çalışıyor.${currentlyRunning.emergencyLaunchReason ? ` (${currentlyRunning.emergencyLaunchReason})` : ''}`,
    }
    : null;
  const durumKutusu = durum === 'baslatilamadi' ? { tur: 'uyari' as const, metin: BASLATILAMADI }
    : isUpdatePending ? { tur: 'basari' as const, metin: INDI }
    : durum === 'guncel' ? { tur: 'basari' as const, metin: 'Güncel: yeni sürüm yok.' }
    : durum === 'ulasilamadi' ? { tur: 'uyari' as const, metin: 'Güncelleme sunucusuna ulaşılamadı. Bağlantıyı kontrol edip yeniden deneyin; uygulama bu arada çalışmaya devam eder.' }
    : null;

  return (
    <Kart>
      <BolumBasligi metin="SÜRÜM" simge={S.guncelleme} />
      <View style={s.bilgi}>
        <Text style={s.surum}>{`Sürüm ${currentlyRunning.runtimeVersion || '—'}`}</Text>
        <Text style={s.paket} selectable>{calisanPaketMetni(currentlyRunning)}</Text>
      </View>
      {kutu ? <BilgiKutusu tur={kutu.tur} metin={kutu.metin} /> : null}
      {durumKutusu ? <BilgiKutusu tur={durumKutusu.tur} metin={durumKutusu.metin} /> : null}
      {isUpdatePending ? (
        <Dugme
          metin="Yeniden başlat"
          tur="birincil"
          simge={S.yenidenBaslat}
          erisimEtiketi="Yeni sürümü yüklemek için uygulamayı yeniden başlat"
          onPress={() => { Updates.reloadAsync().catch(() => setDurum('baslatilamadi')); }}
        />
      ) : (
        <Dugme
          metin={isDownloading ? 'İndiriliyor…' : 'Güncellemeleri denetle'}
          simge={S.guncelleme}
          yukleniyor={isChecking || isDownloading}
          onPress={denetle}
        />
      )}
    </Kart>
  );
}

const stiller = (r: Renkler) => StyleSheet.create({
  serit: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: bosluk.sm,
    paddingVertical: bosluk.xs, paddingHorizontal: bosluk.sm,
    borderRadius: kose.md, borderLeftWidth: 3,
  },
  seritMetin: { ...tipografi.bodyOrta, flex: 1, minWidth: 160 },
  bilgi: { gap: bosluk.xxs },
  surum: { ...tipografi.bodyOrta, color: r.metin },
  paket: { ...tipografi.caption, color: r.metinIkincil },
});
