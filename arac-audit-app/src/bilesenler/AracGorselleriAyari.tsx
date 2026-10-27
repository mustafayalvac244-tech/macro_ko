// AYARLAR → ARAÇ GÖRSELLERİ (360°) — bakış yuvalarına görsel seçme.
//
// Ürün sahibi, 26.10.2026: döndürülebilir araç için resmî görselleri seçti;
// elindekiler standart bakışlar. Her araç için dokuz yuva (Ön, Sol ön, Sol yan,
// Sol arka, Arka, Sağ arka, Sağ yan, Sağ ön, Üstten); her yuvaya galeriden tek
// görsel seçilir, değiştirilir, temizlenir. Görseller depoya ve APK'ya girmez
// (ikisi de herkese açık); yalnız bu telefonda durur.
//
// Her satır dürüst durum yazar: görsel var mı, eksik yan aynalanıyor mu, parça
// haritası bu görsele uyuyor mu (oran %2 içinde) — uymuyorsa o bakışta
// dokunuş parçayı değil bölgeyi açar.

import React, { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { S } from '@/bilesenler/simgeler';
import { Dugme, SegmentSecici } from '@/bilesenler/temel';
import { aracHaritasiVar, AYNA_ESI, cizimVar, kaynakHaritasi, oranUyar, yuvaAdi, YUVALAR } from '@/cekirdek/donusGorunumu';
import { GorunumId } from '@/cekirdek/gorunumParcalari';
import { aracEtiketi, ARACLAR } from '@/cekirdek/model3d';
import { Arac } from '@/cekirdek/tipler';
import { bosluk, DOKUNMA, kose, Renkler, tipografi, useTema } from '@/tema';
import { useAracGorselleri, yuvaAdresi } from '@/veri/aracGorselleri';
import { useCizimDeposu } from '@/veri/cizimDeposu';
import { useDil } from '@/veri/dilDeposu';

export function AracGorselleriAyari() {
  const { renkler } = useTema();
  const { t } = useDil();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const [acik, setAcik] = useState<string | null>(null);
  const cizim = useCizimDeposu((d) => d.stil);
  const cizimSec = useCizimDeposu((d) => d.ayarla);

  return (
    <View style={{ gap: bosluk.sm }}>
      {/* Çizim stili (26.10.2026): teknik varsayılan, renkli isteğe bağlı (cizimDeposu.ts). */}
      <Text style={s.aciklama}>{t('Görselsiz bakışlarda çizim', 'Drawing for views without images')}</Text>
      <SegmentSecici
        secenekler={[
          { id: 'teknik' as const, metin: t('Teknik', 'Technical'), erisimEtiketi: t('Çizim: teknik (açık gri, rengi yalnız hatalar taşır)', 'Drawing: technical (light grey, only defects are coloured)') },
          { id: 'renkli' as const, metin: t('Renkli', 'Coloured'), erisimEtiketi: t('Çizim: renkli (aracın kendi renkleri)', "Drawing: coloured (the vehicle's own colours)") },
        ]}
        deger={cizim}
        onSec={(x) => x && cizimSec(x)}
        erisimEtiketi={t('Görselsiz bakışlarda çizim', 'Drawing for views without images')}
      />
      {/* Uzun anlatım başlıktaki (i) notuna taşındı (26.10.2026, ikinci tasarım
          incelemesi: "Ayarlar'da 360 için bir paragraf"); gizlilik cümlesi görünür kalır. */}
      <Text style={s.aciklama}>
        {t(
          'Görseller yalnız bu telefonda durur; hiçbir yere yüklenmez, yedeğe girmez.',
          'Images stay on this phone only; they are not uploaded anywhere or included in the backup.',
        )}
      </Text>
      {ARACLAR.map((a) => (
        <AracSatiri key={a.id} arac={a} acik={acik === a.id} setAcik={(x) => setAcik(x ? a.id : null)} />
      ))}
    </View>
  );
}

function AracSatiri({ arac, acik, setAcik }: { arac: Arac; acik: boolean; setAcik: (x: boolean) => void }) {
  const { renkler } = useTema();
  const { t } = useDil();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const gorsel = useAracGorselleri((d) => d.gorseller[arac.id]);
  const dolu = gorsel ? Object.keys(gorsel.yuvalar).length : 0;
  const ad = aracEtiketi(arac);

  return (
    <View style={s.satir}>
      <View style={s.satirUst}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.ad} numberOfLines={1}>{ad}</Text>
          <Text style={s.durum}>
            {dolu
              ? t(`${dolu}/9 bakış`, `${dolu}/9 views`)
              : aracHaritasiVar(arac.id)
                ? t('Görsel yok — uygulamanın çizimi kullanılıyor', 'No images — the app\'s drawing is used')
                : cizimVar(arac.id)
                  ? t('Görsel yok — genel çizim kullanılıyor (bu modelin kendi çizimi yok)', 'No images — the generic drawing is used (no drawing for this model)')
                  : t('Görsel yok — şematik harita kullanılıyor', 'No images — the schematic map is used')}
          </Text>
        </View>
        <Dugme
          metin={acik ? t('Kapat', 'Close') : t('Görseller', 'Images')}
          simge={acik ? S.kapat : S.galeri}
          kucuk
          tur={acik ? 'sessiz' : 'ikincil'}
          onPress={() => setAcik(!acik)}
          erisimEtiketi={t(`${ad}: görselleri ${acik ? 'kapat' : 'aç'}`, `${ad}: ${acik ? 'close' : 'open'} images`)}
        />
      </View>
      {acik ? (
        <View style={{ gap: bosluk.xs }}>
          {YUVALAR.map((y) => <YuvaSatiri key={y} aracId={arac.id} aracAdi={ad} yuva={y} />)}
        </View>
      ) : null}
    </View>
  );
}

function YuvaSatiri({ aracId, aracAdi, yuva }: { aracId: string; aracAdi: string; yuva: GorunumId }) {
  const { renkler } = useTema();
  const { dil, t } = useDil();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const yuvalar = useAracGorselleri((d) => d.gorseller[aracId]?.yuvalar);
  const yuvaSec = useAracGorselleri((d) => d.yuvaSec);
  const yuvaTemizle = useAracGorselleri((d) => d.yuvaTemizle);
  const [calisiyor, setCalisiyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const kendi = yuvalar?.[yuva];
  const es = AYNA_ESI[yuva];
  const aynaKaynagi = !kendi && es ? yuvalar?.[es] : undefined;
  const gosterilen = kendi ?? aynaKaynagi;
  const yuvaAd = yuvaAdi(yuva, dil);

  // Parça haritası bu görsele uyuyor mu? (Aynalanan yuva kaynağın haritasını kullanır.)
  const haritaYuvasi = kendi ? yuva : aynaKaynagi && es ? es : null;
  const harita = haritaYuvasi ? kaynakHaritasi(aracId, haritaYuvasi) : undefined;
  const oran = gosterilen ? gosterilen.en / Math.max(1, gosterilen.boy) : 0;
  const haritaDurumu = !gosterilen ? null
    : !harita ? t('parça haritası yok — dokunuş bölgeyi açar', 'no part map — a tap opens the area')
      : oranUyar(oran, harita.oran) ? t('parça haritası uyuyor', 'part map fits')
        : t(
          `oran uymuyor (görsel ${oran.toFixed(2)}, harita ${harita.oran.toFixed(2)}) — dokunuş bölgeyi açar`,
          `ratio mismatch (image ${oran.toFixed(2)}, map ${harita.oran.toFixed(2)}) — a tap opens the area`,
        );

  const sec = async () => {
    setCalisiyor(true); setHata(null);
    try {
      const x = await yuvaSec(aracId, yuva);
      if (x.durum === 'izinYok') setHata(t('Galeri izni verilmedi.', 'Gallery permission was not granted.'));
    } catch (h) {
      setHata(`${t('Seçilemedi', 'Could not pick')}: ${h instanceof Error ? h.message : String(h)}`);
    } finally {
      setCalisiyor(false);
    }
  };

  return (
    <View style={s.yuva}>
      <View style={s.onizleme}>
        {gosterilen ? (
          <Image
            source={{ uri: yuvaAdresi(aracId, gosterilen) }}
            resizeMode="contain"
            style={[StyleSheet.absoluteFill, !kendi && { transform: [{ scaleX: -1 }] }]}
          />
        ) : <Text style={s.bosYazi}>—</Text>}
      </View>
      {/* Düğmeler yazının ALTINDA: telefonda yan yana dururken durum yazısı
          üç satırda kesiliyordu, harita durumu hiç okunmuyordu (26.10.2026). */}
      <View style={{ flex: 1, minWidth: 0, gap: bosluk.xs }}>
        <View style={{ gap: 2 }}>
          <Text style={s.yuvaAd}>{yuvaAd}</Text>
          <Text style={s.durum}>
            {kendi ? t('Görsel seçildi', 'Image selected')
              : aynaKaynagi && es ? t(`Aynalanmış: ${yuvaAdi(es, 'tr')} görselinden`, `Mirrored from ${yuvaAdi(es, 'en')}`)
                : t('Boş', 'Empty')}
            {haritaDurumu ? ` · ${haritaDurumu}` : ''}
          </Text>
          {hata ? <Text style={s.hata}>{hata}</Text> : null}
        </View>
        <View style={s.dugmeler}>
          <Dugme
            metin={kendi ? t('Değiştir', 'Replace') : t('Seç', 'Pick')}
            kucuk
            yukleniyor={calisiyor}
            onPress={sec}
            erisimEtiketi={t(`${aracAdi}: ${yuvaAd} görselini seç`, `${aracAdi}: pick ${yuvaAd} image`)}
          />
          {kendi ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(`${aracAdi}: ${yuvaAd} görselini temizle`, `${aracAdi}: clear ${yuvaAd} image`)}
              onPress={() => yuvaTemizle(aracId, yuva)}
              style={({ pressed }) => [s.temizle, pressed && { opacity: 0.72 }]}
            >
              <S.sil size={18} color={renkler.metinIkincil} strokeWidth={2} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const stiller = (r: Renkler) => StyleSheet.create({
  aciklama: { ...tipografi.caption, color: r.metinSolgun },
  satir: {
    gap: bosluk.xs, padding: bosluk.sm, borderRadius: kose.md, backgroundColor: r.yuzeyAlt,
  },
  satirUst: { flexDirection: 'row', alignItems: 'center', gap: bosluk.xs },
  ad: { ...tipografi.bodyOrta, color: r.metin },
  durum: { ...tipografi.caption, color: r.metinSolgun },
  hata: { ...tipografi.caption, color: r.tehlike },
  yuva: {
    flexDirection: 'row', alignItems: 'flex-start', gap: bosluk.sm, padding: bosluk.xs,
    borderRadius: kose.md, backgroundColor: r.yuzey,
  },
  onizleme: {
    width: 88, height: 44, borderRadius: kose.sm, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center', backgroundColor: r.yuzey,
  },
  bosYazi: { ...tipografi.caption, color: r.metinSolgun },
  yuvaAd: { ...tipografi.captionOrta, color: r.metin },
  dugmeler: { flexDirection: 'row', alignItems: 'center', gap: bosluk.xs },
  temizle: {
    width: DOKUNMA, height: DOKUNMA, alignItems: 'center', justifyContent: 'center',
    borderRadius: kose.md, backgroundColor: r.yuzeyVurgu,
  },
});
