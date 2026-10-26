import React, { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';

import { Dugme } from '@/bilesenler/temel';
import { bolgelerAracIcin } from '@/cekirdek/katalog';
import { AracTipi, Parca } from '@/cekirdek/tipler';
import { bosluk, DOKUNMA, kose, Renkler, tipografi, useTema } from '@/tema';
import { useDil } from '@/veri/dilDeposu';

/**
 * Bölge → parça seçici.
 *
 * 3B model her parçayı göstermez (fonksiyon testi, yol testi, motor bölmesi
 * gibi görünmeyen kalemler var). Bu liste TÜM parçaları kapsar ve aramayla
 * 166 kalem arasından tek yazışta hedefe götürür.
 */
export function ParcaSecici({
  aracTipi, onKapat, onSec,
}: {
  aracTipi: AracTipi;
  onKapat: () => void;
  onSec: (parcaId: string) => void;
}) {
  const { renkler } = useTema();
  const { dil, t } = useDil();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const [arama, setArama] = useState('');

  const bolumler = useMemo(() => {
    // Küçültme arayüz dilinde: Türkçe yerelde İngilizce "I" → "ı" olur, eşleşmez.
    const q = arama.trim().toLocaleLowerCase(dil);
    return bolgelerAracIcin({ tip: aracTipi })
      .map((b) => ({
        baslik: `${b.simge ?? ''} ${t(b.ad, b.en)}`.trim(),
        data: q
          ? b.parcalar.filter((p) => `${p.ad} ${p.en} ${t(b.ad, b.en)}`.toLocaleLowerCase(dil).includes(q))
          : b.parcalar,
      }))
      .filter((b) => b.data.length > 0);
  }, [arama, aracTipi, dil, t]);

  return (
    <>
      <Text style={s.baslik}>{t('Bölge ve parça seç', 'Select area and part')}</Text>

      <TextInput
        value={arama}
        onChangeText={setArama}
        placeholder={t('Parça ara — arka kapı, garniş, far…', 'Search part — rear door, garnish, headlamp…')}
        placeholderTextColor={renkler.metinSolgun}
        accessibilityLabel={t('Parça ara', 'Search part')}
        style={s.arama}
        autoCorrect={false}
      />

      <SectionList
        style={{ flexGrow: 1 }}
        sections={bolumler}
        keyExtractor={(p: Parca) => p.id}
        stickySectionHeadersEnabled
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.liste}
        renderSectionHeader={({ section }) => (
          <Text style={s.bolumBaslik}>{section.baslik}</Text>
        )}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(`${item.ad} (${item.en}) seç`, `Select ${item.en}`)}
            onPress={() => onSec(item.id)}
            style={({ pressed }) => [s.satir, pressed && { backgroundColor: renkler.yuzeyAlt }]}
          >
            <Text style={s.parcaAd}>{t(item.ad, item.en)}</Text>
            {/* İkinci satır Türkçede İngilizce adı gösterir; İngilizcede aynı adı tekrar ederdi. */}
            {dil === 'en' ? null : <Text style={s.parcaEn}>{item.en}</Text>}
          </Pressable>
        )}
        ListEmptyComponent={<Text style={s.bos}>{t('Eşleşen parça yok.', 'No matching parts.')}</Text>}
      />

      <View style={s.eylemler}>
        <Dugme metin={t('Kapat', 'Close')} onPress={onKapat} style={{ flex: 1 }} />
      </View>
    </>
  );
}

const stiller = (r: Renkler) => StyleSheet.create({
  baslik: { ...tipografi.h2, color: r.metin, paddingHorizontal: bosluk.md },
  arama: {
    ...tipografi.body, color: r.metin, marginHorizontal: bosluk.md,
    borderWidth: 1, borderColor: r.cizgi, borderRadius: kose.md,
    paddingHorizontal: bosluk.sm, minHeight: DOKUNMA, backgroundColor: r.yuzey,
  },
  liste: { paddingHorizontal: bosluk.md, paddingBottom: bosluk.md },
  bolumBaslik: {
    ...tipografi.etiket, color: r.metinSolgun,
    backgroundColor: r.bgYukseltilmis, paddingTop: bosluk.sm, paddingBottom: bosluk.xxs,
  },
  satir: {
    minHeight: DOKUNMA, justifyContent: 'center', paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: r.cizgiSolgun,
  },
  parcaAd: { ...tipografi.bodyOrta, color: r.metin },
  parcaEn: { ...tipografi.caption, color: r.metinSolgun },
  bos: { ...tipografi.body, color: r.metinSolgun, textAlign: 'center', paddingVertical: bosluk.xl },
  eylemler: {
    padding: bosluk.md, borderTopWidth: 1, borderTopColor: r.cizgiSolgun,
    backgroundColor: r.bgYukseltilmis,
  },
});
