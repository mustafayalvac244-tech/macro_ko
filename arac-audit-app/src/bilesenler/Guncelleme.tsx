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
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';

import { S } from '@/bilesenler/simgeler';
import { BaslikDugmesi, BilgiKutusu, BolumBasligi, Dugme, Kart } from '@/bilesenler/temel';
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

/**
 * TEK DOKUNUŞLA GÜNCELLE (26.10.2026, ürün sahibi: "güncelleme butonu koy,
 * tıklayıp güncelleyeyim"). Önceden iki adımdı: Ayarlar → Sürüm →
 * "Güncellemeleri denetle", inince ayrıca "Yeniden başlat". Şimdi tek dokunuş:
 * denetle → indir → yeniden başlat. Kayıtlar cihazdaki veritabanında,
 * yeniden başlatma onlara dokunmaz.
 */
export type GuncellemeSonucu = 'guncel' | 'ulasilamadi' | 'baslatilamadi' | null;

export function useTekDokunusGuncelle() {
  const { isUpdatePending, isChecking, isDownloading } = Updates.useUpdates();
  const [calisiyor, setCalisiyor] = useState(false);
  const [sonuc, setSonuc] = useState<GuncellemeSonucu>(null);
  const guncelle = async (): Promise<GuncellemeSonucu> => {
    setSonuc(null);
    setCalisiyor(true);
    try {
      if (!isUpdatePending) {
        const denetim = await Updates.checkForUpdateAsync();
        // Geri alma yönergesi `isAvailable: false` ile gelir ama yine de
        // indirilmelidir; yoksa sunucudan geri alınan sürüm telefonda kalır.
        if (!denetim.isAvailable && !denetim.isRollBackToEmbedded) {
          setSonuc('guncel');
          return 'guncel';
        }
        const inen = await Updates.fetchUpdateAsync();
        if (!inen.isNew && !inen.isRollBackToEmbedded) {
          setSonuc('guncel');
          return 'guncel';
        }
      }
      try {
        await Updates.reloadAsync();
      } catch {
        setSonuc('baslatilamadi');
        return 'baslatilamadi';
      }
      return null;
    } catch {
      setSonuc('ulasilamadi');
      return 'ulasilamadi';
    } finally {
      setCalisiyor(false);
    }
  };
  return { guncelle, sonuc, calisiyor: calisiyor || isChecking || isDownloading, bekleyen: isUpdatePending };
}

const SONUC_METNI: Record<Exclude<GuncellemeSonucu, null>, string> = {
  guncel: 'Güncel: yeni sürüm yok.',
  ulasilamadi: 'Güncelleme sunucusuna ulaşılamadı. Bağlantıyı kontrol edip yeniden deneyin; uygulama bu arada çalışmaya devam eder.',
  baslatilamadi: BASLATILAMADI,
};

/** Ana sayfa başlığındaki "Güncelle" — yeni sürüm inmişse vurgulu. */
export function GuncelleDugmesi() {
  return GUNCELLEME_ACIK ? <GuncelleDugmesiIc /> : null;
}

function GuncelleDugmesiIc() {
  const { guncelle, calisiyor, bekleyen } = useTekDokunusGuncelle();
  return (
    <BaslikDugmesi
      simge={S.guncelleme}
      metin={bekleyen ? 'Yeni sürümü yükle' : 'Güncelle'}
      birincil={bekleyen}
      yukleniyor={calisiyor}
      erisimEtiketi={bekleyen ? 'Yeni sürüm hazır: yüklemek için uygulamayı yeniden başlat' : 'Güncellemeleri denetle ve yükle'}
      onPress={async () => {
        const s = await guncelle();
        if (s) Alert.alert('Güncelleme', SONUC_METNI[s]);
      }}
    />
  );
}

/** Ayarlar → Sürüm: hangi paketin çalıştığı ve tek dokunuşla güncelleme. */
export function SurumKarti() {
  return GUNCELLEME_ACIK ? <SurumIcerigi /> : null;
}

function SurumIcerigi() {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const { currentlyRunning } = Updates.useUpdates();
  const { guncelle, sonuc: durum, calisiyor, bekleyen: isUpdatePending } = useTekDokunusGuncelle();

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
      <BolumBasligi metin="Sürüm" simge={S.guncelleme} />
      <View style={s.bilgi}>
        <Text style={s.surum}>{`Sürüm ${currentlyRunning.runtimeVersion || '—'}`}</Text>
        <Text style={s.paket} selectable>{calisanPaketMetni(currentlyRunning)}</Text>
      </View>
      {kutu ? <BilgiKutusu tur={kutu.tur} metin={kutu.metin} /> : null}
      {durumKutusu ? <BilgiKutusu tur={durumKutusu.tur} metin={durumKutusu.metin} /> : null}
      <Dugme
        metin={isUpdatePending ? 'Yeni sürümü yükle' : 'Güncelle'}
        tur="birincil"
        simge={isUpdatePending ? S.yenidenBaslat : S.guncelleme}
        yukleniyor={calisiyor}
        erisimEtiketi={isUpdatePending ? 'Yeni sürüm hazır: yüklemek için uygulamayı yeniden başlat' : 'Güncellemeleri denetle ve yükle'}
        onPress={() => { guncelle(); }}
      />
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
