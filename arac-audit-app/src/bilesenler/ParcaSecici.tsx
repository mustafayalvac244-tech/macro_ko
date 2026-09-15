import React, { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';

import { Dugme } from '@/bilesenler/temel';
import { bolgelerAracIcin } from '@/cekirdek/katalog';
import { AracTipi, Parca } from '@/cekirdek/tipler';
import { bosluk, DOKUNMA, kose, Renkler, tipografi, useTema } from '@/tema';

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
  const s = useMemo(() => stiller(renkler), [renkler]);
  const [arama, setArama] = useState('');

  const bolumler = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase('tr');
    return bolgelerAracIcin({ tip: aracTipi })
      .map((b) => ({
        baslik: `${b.simge ?? ''} ${b.ad}`.trim(),
        data: q
          ? b.parcalar.filter((p) => `${p.ad} ${p.en} ${b.ad}`.toLocaleLowerCase('tr').includes(q))
          : b.parcalar,
      }))
      .filter((b) => b.data.length > 0);
  }, [arama, aracTipi]);

  return (
    <>
      <Text style={s.baslik}>Bölge ve parça seç</Text>

      <TextInput
        value={arama}
        onChangeText={setArama}
        placeholder="Parça ara — arka kapı, garniş, far…"
        placeholderTextColor={renkler.metinSolgun}
        accessibilityLabel="Parça ara"
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
            accessibilityLabel={`${item.ad} (${item.en}) seç`}
            onPress={() => onSec(item.id)}
            style={({ pressed }) => [s.satir, pressed && { backgroundColor: renkler.yuzeyAlt }]}
          >
            <Text style={s.parcaAd}>{item.ad}</Text>
            <Text style={s.parcaEn}>{item.en}</Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={s.bos}>Eşleşen parça yok.</Text>}
      />

      <View style={s.eylemler}>
        <Dugme metin="Kapat" onPress={onKapat} style={{ flex: 1 }} />
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
