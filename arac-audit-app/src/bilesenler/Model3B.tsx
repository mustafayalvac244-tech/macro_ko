import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ModelTuvali, TuvalKolu } from '@/bilesenler/ModelTuvali';

import { geometriUret } from '@/cekirdek/model3d';
import { modelWebViewHtml } from '@/cekirdek/modelWebView';
import { ModelKipi } from '@/cekirdek/tipler';
import { bosluk, kose, Renkler, tipografi, useTema } from '@/tema';

const BAKISLAR: { ad: string; etiket: string }[] = [
  { ad: 'sol', etiket: 'Sol' },
  { ad: 'sag', etiket: 'Sağ' },
  { ad: 'on', etiket: 'Ön' },
  { ad: 'arka', etiket: 'Arka' },
  { ad: 'ust', etiket: 'Üst' },
];

/**
 * Tıklanabilir 3B araç modeli.
 *
 * Geometri React Native tarafında üretilir (tek kaynak: model3d.ts), çizim
 * WebView içinde olur. Ayrıntılı gerekçe: cekirdek/modelWebView.ts.
 */
export function Model3B({
  aracId, kip, vurgular, onParcaDokunuldu, onKipDegisti,
}: {
  aracId: string;
  kip: ModelKipi;
  /** mesh kimliği -> renk. Hatası olan parçalar şiddet rengiyle boyanır. */
  vurgular: Map<string, string>;
  onParcaDokunuldu: (mesh: string) => void;
  onKipDegisti: (k: ModelKipi) => void;
}) {
  const { renkler, temaAdi } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const tuval = useRef<TuvalKolu>(null);
  const [hazir, setHazir] = useState(false);

  const html = useMemo(
    () => modelWebViewHtml(
      temaAdi === 'koyu' ? '#1B2430' : '#E8EDF3',
      temaAdi === 'koyu' ? '#121820' : '#D3DBE4',
    ),
    [temaAdi],
  );

  const gonder = useCallback((n: unknown) => {
    tuval.current?.gonder(n);
  }, []);

  const yuzler = useMemo(() => geometriUret(aracId, kip), [aracId, kip]);

  // Geometri ya da kip değişince yeniden yükle. `hazir` beklenmeli: WebView
  // betiği çalışmadan gönderilen mesaj kaybolur.
  useEffect(() => {
    if (!hazir) return;
    gonder({ tur: 'yukle', yuzler, bakis: kip === 'ic' ? 'kabin' : 'serbest' });
  }, [gonder, hazir, kip, yuzler]);

  useEffect(() => {
    if (!hazir) return;
    gonder({ tur: 'vurgula', vurgular: [...vurgular.entries()] });
  }, [gonder, hazir, vurgular]);

  const mesaj = useCallback((ham: string) => {
    let m: { tur?: string; mesh?: string };
    try { m = JSON.parse(ham); } catch { return; }
    if (m.tur === 'hazir') setHazir(true);
    else if (m.tur === 'dokunuldu' && m.mesh) onParcaDokunuldu(m.mesh);
  }, [onParcaDokunuldu]);

  return (
    <View style={s.sarma}>
      <ModelTuvali ref={tuval} html={html} onMesaj={mesaj} />


      <View style={s.kipSatiri}>
        <KucukDugme metin="Dış" secili={kip === 'dis'} onPress={() => onKipDegisti('dis')} />
        <KucukDugme metin="İç" secili={kip === 'ic'} onPress={() => onKipDegisti('ic')} />
      </View>

      <View style={s.bakisSutunu}>
        {BAKISLAR.map((b) => (
          <KucukDugme key={b.ad} metin={b.etiket} onPress={() => gonder({ tur: 'bakis', ad: b.ad })} />
        ))}
      </View>

      <View style={s.ipucuSatiri}>
        <Text style={s.ipucu}>Parçaya dokunun · sürükleyerek döndürün</Text>
      </View>
    </View>
  );
}

function KucukDugme({
  metin, onPress, secili = false,
}: { metin: string; onPress: () => void; secili?: boolean }) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={metin}
      accessibilityState={{ selected: secili }}
      onPress={onPress}
      style={({ pressed }) => [s.kucukDugme, secili && s.kucukDugmeSecili, pressed && { opacity: 0.7 }]}
    >
      <Text style={[s.kucukDugmeMetin, secili && { color: renkler.metinTers }]}>{metin}</Text>
    </Pressable>
  );
}

const stiller = (r: Renkler) => StyleSheet.create({
  // flex:1 ŞART. Tuval taşıyıcısı mutlak konumlu olduğu için akışta yer
  // kaplamaz; bu View flex almazsa yüksekliği 0'a düşer ve model hiç
  // görünmez (ölçüldü: tuval 792x0).
  sarma: {
    flex: 1, position: 'relative', borderRadius: kose.lg, overflow: 'hidden',
    borderWidth: 1, borderColor: r.cizgiSolgun, backgroundColor: r.yuzeyAlt,
  },

  kipSatiri: { position: 'absolute', left: bosluk.xs, top: bosluk.xs, flexDirection: 'row', gap: 6 },
  bakisSutunu: { position: 'absolute', right: bosluk.xs, top: bosluk.xs, gap: 6 },
  ipucuSatiri: { position: 'absolute', left: bosluk.xs, bottom: bosluk.xs },

  kucukDugme: {
    minHeight: 34, justifyContent: 'center', paddingHorizontal: bosluk.xs,
    borderRadius: kose.sm, borderWidth: 1, borderColor: r.cizgi, backgroundColor: r.yuzey,
  },
  kucukDugmeSecili: { backgroundColor: r.birincil, borderColor: r.birincil },
  kucukDugmeMetin: { ...tipografi.captionOrta, color: r.metin },

  ipucu: {
    ...tipografi.caption, color: r.metinIkincil,
    backgroundColor: r.yuzey, paddingHorizontal: bosluk.xs, paddingVertical: 3,
    borderRadius: kose.sm, overflow: 'hidden',
  },
});
