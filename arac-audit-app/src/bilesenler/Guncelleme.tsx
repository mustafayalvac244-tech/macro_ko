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
import { ceviri, useDil, useDilDeposu } from '@/veri/dilDeposu';

export const GUNCELLEME_ACIK = Platform.OS !== 'web' && Updates.isEnabled;

const INDI = 'Yeni sürüm indirildi. Yeniden başlatınca devreye girer; kayıtlar silinmez.';
const INDI_EN = 'New version downloaded. It takes effect after a restart; records are kept.';
const BASLATILAMADI = 'Yeniden başlatılamadı. Uygulamayı kapatıp açın; yeni sürüm açılışta devreye girer.';
const BASLATILAMADI_EN = 'Could not restart. Close and reopen the app; the new version takes effect on launch.';

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
  const { t } = useDil();
  if (!isUpdatePending) return null;
  const renk = basarisiz ? renkler.uyari : renkler.basari;
  return (
    <View style={[s.serit, { backgroundColor: basarisiz ? renkler.uyariYumusak : renkler.basariYumusak, borderLeftColor: renk }]}>
      <S.guncelleme size={18} color={renk} strokeWidth={2} />
      <Text style={[s.seritMetin, { color: renk }]}>
        {basarisiz ? t(BASLATILAMADI, BASLATILAMADI_EN) : t('Yeni sürüm hazır · kayıtlar silinmez', 'New version ready · records are kept')}
      </Text>
      {basarisiz ? null : (
        <Dugme
          metin={t('Yeniden başlat', 'Restart')}
          tur="birincil"
          kucuk
          simge={S.yenidenBaslat}
          erisimEtiketi={t('Yeni sürümü yüklemek için uygulamayı yeniden başlat', 'Restart the app to install the new version')}
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
const SONUC_METNI_EN: Record<Exclude<GuncellemeSonucu, null>, string> = {
  guncel: 'Up to date: no new version.',
  ulasilamadi: 'Could not reach the update server. Check the connection and try again; the app keeps working meanwhile.',
  baslatilamadi: BASLATILAMADI_EN,
};

/** Ana sayfa başlığındaki "Güncelle" — yeni sürüm inmişse vurgulu. */
export function GuncelleDugmesi() {
  return GUNCELLEME_ACIK ? <GuncelleDugmesiIc /> : null;
}

function GuncelleDugmesiIc() {
  const { guncelle, calisiyor, bekleyen } = useTekDokunusGuncelle();
  const { t } = useDil();
  return (
    <BaslikDugmesi
      simge={S.guncelleme}
      metin={bekleyen ? t('Yeni sürümü yükle', 'Install new version') : t('Güncelle', 'Update')}
      birincil={bekleyen}
      yukleniyor={calisiyor}
      erisimEtiketi={bekleyen
        ? t('Yeni sürüm hazır: yüklemek için uygulamayı yeniden başlat', 'New version ready: restart the app to install it')
        : t('Güncellemeleri denetle ve yükle', 'Check for and install updates')}
      onPress={async () => {
        const s = await guncelle();
        // Beklerken dil değişmiş olabilir: uyarı o anki dilde.
        const c = ceviri(useDilDeposu.getState().dil);
        if (s) Alert.alert(c('Güncelleme', 'Update'), c(SONUC_METNI[s], SONUC_METNI_EN[s]));
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
  const { dil, t } = useDil();
  const { currentlyRunning } = Updates.useUpdates();
  const { guncelle, sonuc: durum, calisiyor, bekleyen: isUpdatePending } = useTekDokunusGuncelle();

  const kutu = currentlyRunning.isEmergencyLaunch
    ? {
      tur: 'uyari' as const,
      metin: `${t('Son güncelleme açılamadı; APK ile gelen paket çalışıyor.', 'The last update failed to start; the bundle shipped with the APK is running.')}${currentlyRunning.emergencyLaunchReason ? ` (${currentlyRunning.emergencyLaunchReason})` : ''}`,
    }
    : null;
  const durumKutusu = durum === 'baslatilamadi' ? { tur: 'uyari' as const, metin: t(BASLATILAMADI, BASLATILAMADI_EN) }
    : isUpdatePending ? { tur: 'basari' as const, metin: t(INDI, INDI_EN) }
    : durum === 'guncel' ? { tur: 'basari' as const, metin: t('Güncel: yeni sürüm yok.', 'Up to date: no new version.') }
    : durum === 'ulasilamadi' ? { tur: 'uyari' as const, metin: t('Güncelleme sunucusuna ulaşılamadı. Bağlantıyı kontrol edip yeniden deneyin; uygulama bu arada çalışmaya devam eder.', 'Could not reach the update server. Check the connection and try again; the app keeps working meanwhile.') }
    : null;

  return (
    <Kart>
      <BolumBasligi metin={t('Sürüm', 'Version')} simge={S.guncelleme} />
      <View style={s.bilgi}>
        <Text style={s.surum}>{t(`Sürüm ${currentlyRunning.runtimeVersion || '—'}`, `Version ${currentlyRunning.runtimeVersion || '—'}`)}</Text>
        <Text style={s.paket} selectable>{calisanPaketMetni(currentlyRunning, dil)}</Text>
      </View>
      {kutu ? <BilgiKutusu tur={kutu.tur} metin={kutu.metin} /> : null}
      {durumKutusu ? <BilgiKutusu tur={durumKutusu.tur} metin={durumKutusu.metin} /> : null}
      <Dugme
        metin={isUpdatePending ? t('Yeni sürümü yükle', 'Install new version') : t('Güncelle', 'Update')}
        tur="birincil"
        simge={isUpdatePending ? S.yenidenBaslat : S.guncelleme}
        yukleniyor={calisiyor}
        erisimEtiketi={isUpdatePending
          ? t('Yeni sürüm hazır: yüklemek için uygulamayı yeniden başlat', 'New version ready: restart the app to install it')
          : t('Güncellemeleri denetle ve yükle', 'Check for and install updates')}
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
