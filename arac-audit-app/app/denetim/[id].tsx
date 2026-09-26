import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable, ScrollView, SectionList, StyleSheet, Text, TextInput, View,
} from 'react-native';

import { HataSayfasi, HataTaslagi, KabulAnahtari, YeniTipFormu } from '@/bilesenler/HataSayfasi';
import {
  AltSayfa, Baslik, BaslikDugmesi, DereceRozeti, Dugme, Ekran, HataKutusu, Yukleniyor,
} from '@/bilesenler/temel';
import {
  bolgelerAracIcin, DERECELER, HATA_TIPI_INDEKS, PARCA_INDEKS, parcaHataTipleri,
} from '@/cekirdek/katalog';
import { ARAC_INDEKS } from '@/cekirdek/model3d';
import { dereceGosterimi } from '@/cekirdek/puan';
import { Denetim, DereceKodu, Hata, HataTipi, Parca } from '@/cekirdek/tipler';
import { bosluk, DOKUNMA, kose, Renkler, tipografi, useTema } from '@/tema';
import {
  ayarOku, ayarYaz, denetimGetir, FotografKaydi, fotograflariGetir, fotografiHataBagla,
  hataKaydet, hataSil, kalipSay, kimlikUret,
} from '@/veri/depo';
import { useKatalog } from '@/veri/katalogDeposu';

/**
 * ÇALIŞMA EKRANI — hızlı giriş.
 *
 * 16.09.2026 ürün sahibi geri bildirimi: "programı hiç beğenmedim… parça
 * seçilecek, gap mı scratch mı seçilecek, hataları tak tak girebilecekler."
 * Önceki ekran 3B modeli merkeze koyuyordu ve her kayıt bir form açıyordu.
 * Bu ekran tersini yapar:
 *
 *   parçaya dokun → hataya dokun → KAYDEDİLDİ. Form yok.
 *
 * Derece üstte sabit durur ve son seçilen hatırlanır; aynı derecede art arda
 * girişte her kayıt tek dokunuştur. Fotoğraf, not, adet sonradan, kaydedilen
 * hatalar listesinden eklenir — hızlı yolun üstünde durmaz.
 *
 * 3B model buradan kaldırıldı ("görünüm sonraya kalsın"). Bileşen dosyaları
 * duruyor; gerçek araç modeli geldiğinde geri bağlanacak.
 */
export default function DenetimEkrani() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const ozelTipler = useKatalog((d) => d.ozelTipler);
  const tipEkle = useKatalog((d) => d.ekle);

  const [denetim, setDenetim] = useState<Denetim | null>(null);
  const [fotograflar, setFotograflar] = useState<FotografKaydi[]>([]);
  const [yuklemeHatasi, setYuklemeHatasi] = useState<string | null>(null);

  const [parcaId, setParcaId] = useState<string | null>(null);
  const [parcaArama, setParcaArama] = useState('');
  const [hataArama, setHataArama] = useState('');
  const [derece, setDerece] = useState<DereceKodu>('1');
  // "Kabul edilebilir" BİLEREK YAPIŞKAN DEĞİL: her kayıttan sonra kapanır.
  // Yapışkan olsaydı bir kez açık unutulan anahtar sonraki gerçek hataları
  // sessizce "(3) kabul edildi" diye yazardı — iş emri hiç çıkmazdı.
  const [kabul, setKabul] = useState(false);
  const [yeniTipAcik, setYeniTipAcik] = useState(false);
  const [kayitHatasi, setKayitHatasi] = useState<string | null>(null);

  const [sonKayit, setSonKayit] = useState<{ id: string; metin: string } | null>(null);
  const bildirimZamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tek alt sayfa: aynı anda iki Modal açıldığında kapanan modal DOM'da asılı
  // kalıp alttakini engelliyordu (15.09.2026). İçerik değişir, kabuk tektir.
  const [acikSayfa, setAcikSayfa] = useState<'yok' | 'liste' | 'hata'>('yok');
  const [taslak, setTaslak] = useState<HataTaslagi | null>(null);

  const tazele = useCallback(async () => {
    if (!id) return;
    try {
      const [d, f] = await Promise.all([denetimGetir(id), fotograflariGetir(id)]);
      setDenetim(d);
      setFotograflar(f);
      setYuklemeHatasi(null);
    } catch (h) {
      setYuklemeHatasi(h instanceof Error ? h.message : String(h));
    }
  }, [id]);

  useEffect(() => { tazele(); }, [tazele]);

  useEffect(() => {
    ayarOku<DereceKodu>('sonDerece', '1').then(setDerece).catch(() => { /* ilk açılış */ });
    return () => { if (bildirimZamanlayici.current) clearTimeout(bildirimZamanlayici.current); };
  }, []);

  const dereceSec = useCallback((d: DereceKodu) => {
    setDerece(d);
    ayarYaz('sonDerece', d).catch(() => { /* hatırlanmazsa sorun değil */ });
  }, []);

  const arac = denetim ? ARAC_INDEKS[denetim.aracId] : undefined;
  const parca = parcaId ? PARCA_INDEKS[parcaId] : undefined;

  // --- PARÇA LİSTESİ ----------------------------------------------------
  const bolumler = useMemo(() => {
    const q = parcaArama.trim().toLocaleLowerCase('tr');
    return bolgelerAracIcin({ tip: arac?.tip ?? 'ice' })
      .map((b) => ({
        baslik: b.ad,
        data: q
          ? b.parcalar.filter((p) => `${p.ad} ${p.en} ${b.ad}`.toLocaleLowerCase('tr').includes(q))
          : b.parcalar,
      }))
      .filter((b) => b.data.length > 0);
  }, [parcaArama, arac?.tip]);

  /** Bu denetimde son dokunulan parçalar — aynı parçaya ikinci hata tek dokunuş. */
  const sonParcalar = useMemo(() => {
    const gorulen = new Set<string>();
    const sonuc: string[] = [];
    for (const h of [...(denetim?.hatalar ?? [])].sort((a, b) => b.zaman.localeCompare(a.zaman))) {
      if (gorulen.has(h.parcaId) || !PARCA_INDEKS[h.parcaId]) continue;
      gorulen.add(h.parcaId);
      sonuc.push(h.parcaId);
      if (sonuc.length >= 6) break;
    }
    return sonuc;
  }, [denetim?.hatalar]);

  // --- HATA IZGARASI ----------------------------------------------------
  const tipler = useMemo(() => {
    if (!parcaId) return [];
    const q = hataArama.trim().toLocaleLowerCase('tr');
    const hepsi = parcaHataTipleri(parcaId);
    return q ? hepsi.filter((t) => `${t.ad} ${t.en}`.toLocaleLowerCase('tr').includes(q)) : hepsi;
    // ozelTipler: yeni tip eklendiğinde ızgara anında tazelensin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parcaId, hataArama, ozelTipler]);

  const parcaSec = useCallback((pid: string) => {
    setParcaId(pid);
    setHataArama('');
    setYeniTipAcik(false);
    setKayitHatasi(null);
  }, []);

  const parcalaraDon = useCallback(() => {
    setParcaId(null);
    setHataArama('');
    setYeniTipAcik(false);
  }, []);

  /** Tek dokunuşla kayıt — bu ekranın var olma sebebi. */
  const hizliKaydet = useCallback(async (t: HataTipi) => {
    if (!denetim || !parcaId) return;
    setKayitHatasi(null);
    const kayit: Hata = {
      id: kimlikUret('h'),
      parcaId,
      hataTipiId: t.id,
      derece,
      kabulEdilebilir: kabul,
      adet: 1, konum: '', aciklama: '', fotograflar: [],
      zaman: new Date().toISOString(),
      durum: 'acik',
    };
    try {
      await hataKaydet(denetim.id, kayit);
    } catch (h) {
      // Kayıt düşmediyse ekranda KALMALI: denetçi "kaydettim" sanıp geçerse
      // hata raporda hiç görünmez.
      setKayitHatasi(`Kaydedilemedi: ${h instanceof Error ? h.message : String(h)}`);
      return;
    }
    kalipSay(parcaId, t.id).catch(() => { /* sayaç kritik değil */ });

    const p = PARCA_INDEKS[parcaId];
    setSonKayit({ id: kayit.id, metin: `${p?.ad ?? parcaId} — ${t.ad} · ${dereceGosterimi(kayit)}` });
    if (bildirimZamanlayici.current) clearTimeout(bildirimZamanlayici.current);
    bildirimZamanlayici.current = setTimeout(() => setSonKayit(null), 6000);

    setKabul(false);
    parcalaraDon();
    setParcaArama('');
    await tazele();
  }, [denetim, parcaId, derece, kabul, parcalaraDon, tazele]);

  const geriAl = useCallback(async () => {
    if (!sonKayit) return;
    if (bildirimZamanlayici.current) clearTimeout(bildirimZamanlayici.current);
    await hataSil(sonKayit.id);
    setSonKayit(null);
    await tazele();
  }, [sonKayit, tazele]);

  // --- AYRINTILI DÜZENLEME (isteğe bağlı) ------------------------------
  const ayrintiKaydet = useCallback(async (t: HataTaslagi, fotoIdleri: string[]) => {
    if (!denetim) return;
    const hataId = t.id ?? kimlikUret('h');
    await hataKaydet(denetim.id, {
      ...t, id: hataId, zaman: t.zaman ?? new Date().toISOString(), fotograflar: fotoIdleri,
    });
    for (const fid of fotoIdleri) await fotografiHataBagla(fid, hataId);
    setTaslak(null);
    setAcikSayfa('liste');
    await tazele();
  }, [denetim, tazele]);

  const ayrintiSil = useCallback(async (hataId: string) => {
    await hataSil(hataId);
    setTaslak(null);
    setAcikSayfa('liste');
    await tazele();
  }, [tazele]);

  // --- DURUMLAR ---------------------------------------------------------
  const geriDugmesi = <BaslikDugmesi metin="‹" erisimEtiketi="Geri" onPress={() => router.back()} />;

  if (yuklemeHatasi) {
    return (
      <Ekran kenarlar={['top']}>
        <Baslik baslik="Denetim" sol={geriDugmesi} />
        <View style={{ padding: bosluk.md }}><HataKutusu metin={yuklemeHatasi} /></View>
      </Ekran>
    );
  }
  if (!denetim) {
    return (
      <Ekran kenarlar={['top']}>
        <Baslik baslik="Denetim" sol={geriDugmesi} />
        <Yukleniyor metin="Denetim açılıyor…" />
      </Ekran>
    );
  }

  const hataSayisi = denetim.hatalar.length;

  return (
    <Ekran kenarlar={['top']}>
      <Baslik
        baslik={denetim.vin || 'Denetim'}
        altBaslik={`${arac?.ad ?? denetim.aracId}${denetim.plaka ? ` · ${denetim.plaka}` : ''}`}
        sol={geriDugmesi}
        sag={(
          <View style={s.baslikSag}>
            <Dugme
              metin={`Liste (${hataSayisi})`}
              kucuk
              erisimEtiketi={`Kaydedilen ${hataSayisi} hata`}
              onPress={() => setAcikSayfa('liste')}
            />
            <Dugme
              metin="Rapor"
              kucuk
              tur="birincil"
              onPress={() => router.push({ pathname: '/denetim/rapor', params: { id: denetim.id } })}
            />
          </View>
        )}
      />

      {!parca ? (
        // ADIM 1 — PARÇA
        <View style={{ flex: 1 }}>
          <View style={s.aramaKutu}>
            <TextInput
              value={parcaArama}
              onChangeText={setParcaArama}
              placeholder="Parça ara — kaput, A direği, ön kapı…"
              placeholderTextColor={renkler.metinSolgun}
              accessibilityLabel="Parça ara"
              style={s.arama}
              autoCorrect={false}
            />
          </View>

          <SectionList<Parca, { baslik: string }>
            sections={bolumler}
            keyExtractor={(p) => p.id}
            stickySectionHeadersEnabled
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.parcaListe}
            ListHeaderComponent={sonParcalar.length && !parcaArama ? (
              <View style={{ gap: bosluk.xs, marginBottom: bosluk.sm }}>
                <Text style={s.bolumBaslik}>SON DOKUNULANLAR</Text>
                <View style={s.cipSatir}>
                  {sonParcalar.map((pid) => (
                    <Pressable
                      key={pid}
                      accessibilityRole="button"
                      accessibilityLabel={`${PARCA_INDEKS[pid]!.ad} — ${PARCA_INDEKS[pid]!.bolgeAd}`}
                      onPress={() => parcaSec(pid)}
                      style={({ pressed }) => [s.cip, pressed && s.basili]}
                    >
                      <Text style={s.cipAd} numberOfLines={1}>{PARCA_INDEKS[pid]!.ad}</Text>
                      <Text style={s.cipAlt} numberOfLines={1}>{PARCA_INDEKS[pid]!.bolgeAd}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
            renderSectionHeader={({ section }) => (
              <Text style={s.bolgeBaslik}>{section.baslik}</Text>
            )}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.ad} (${item.en})`}
                onPress={() => parcaSec(item.id)}
                style={({ pressed }) => [s.parcaSatir, pressed && s.basili]}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.parcaAd} numberOfLines={1}>{item.ad}</Text>
                  <Text style={s.parcaEn} numberOfLines={1}>{item.en}</Text>
                </View>
                <Text style={s.ok}>›</Text>
              </Pressable>
            )}
            ListEmptyComponent={<Text style={s.bos}>“{parcaArama.trim()}” ile eşleşen parça yok.</Text>}
          />
        </View>
      ) : (
        // ADIM 2 — HATA
        <View style={{ flex: 1 }}>
          <View style={s.parcaBaslik}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Parça listesine dön"
              onPress={parcalaraDon}
              style={({ pressed }) => [s.geriDugme, pressed && s.basili]}
            >
              <Text style={s.geriMetin}>‹ Parçalar</Text>
            </Pressable>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.seciliParca} numberOfLines={1}>{parca.ad}</Text>
              <Text style={s.seciliYol} numberOfLines={1}>{parca.bolgeAd} · {parca.en}</Text>
            </View>
          </View>

          <View style={s.dereceSerit}>
            <Text style={s.dereceEtiket}>DERECE</Text>
            <View style={s.dereceSatir}>
              {DERECELER.map((d) => {
                const secili = derece === d.id;
                return (
                  <Pressable
                    key={d.id}
                    accessibilityRole="radio"
                    aria-checked={secili}
                    accessibilityLabel={`Derece ${d.ad}`}
                    onPress={() => dereceSec(d.id)}
                    style={[s.dereceDugme, secili && s.dereceDugmeSecili]}
                  >
                    <Text style={[s.dereceMetin, secili && { color: renkler.metinTers }]}>{d.ad}</Text>
                  </Pressable>
                );
              })}
            </View>
            <KabulAnahtari kabul={kabul} derece={derece} onDegis={setKabul} />
          </View>

          <ScrollView contentContainerStyle={s.hataGovde} keyboardShouldPersistTaps="handled">
            <TextInput
              value={hataArama}
              onChangeText={setHataArama}
              placeholder="Hata ara — gap, scratch, gıcırtı…"
              placeholderTextColor={renkler.metinSolgun}
              accessibilityLabel="Hata tipi ara"
              style={s.arama}
              autoCorrect={false}
            />

            {kayitHatasi ? <HataKutusu metin={kayitHatasi} /> : null}

            {yeniTipAcik ? (
              <YeniTipFormu
                baslangicAd={hataArama.trim()}
                izinliGruplar={parca.gruplar}
                onVazgec={() => setYeniTipAcik(false)}
                onEkle={async (girdi) => {
                  const t = await tipEkle({ ...girdi, ekleyen: denetim.denetci?.trim() ?? '' });
                  setYeniTipAcik(false);
                  // Yeni tip eklendiyse denetçi onu kaydetmek için ekledi:
                  // ikinci bir dokunuş istemeden hemen kaydet.
                  await hizliKaydet(t);
                }}
              />
            ) : (
              <>
                <View style={s.hataIzgara}>
                  {tipler.map((t) => (
                    <Pressable
                      key={t.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${t.ad}${t.en ? ` (${t.en})` : ''} — derece ${kabul ? `(${derece})` : derece} olarak kaydet`}
                      onPress={() => hizliKaydet(t)}
                      style={({ pressed }) => [s.hataDugme, pressed && s.hataDugmeBasili]}
                    >
                      <Text style={s.hataAd} numberOfLines={2}>{t.ad}</Text>
                      {t.en ? <Text style={s.hataEn} numberOfLines={1}>{t.en}</Text> : null}
                      {t.ozel ? <Text style={s.ekipIsaret}>EKİP</Text> : null}
                    </Pressable>
                  ))}
                </View>

                {tipler.length === 0 ? (
                  <Text style={s.bos}>
                    {hataArama.trim() ? `“${hataArama.trim()}” listede yok.` : 'Bu parça için tanımlı hata tipi yok.'}
                  </Text>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={hataArama.trim() ? `“${hataArama.trim()}” adıyla yeni hata tipi ekle` : 'Yeni hata tipi ekle'}
                  onPress={() => setYeniTipAcik(true)}
                  style={[s.yeniTip, tipler.length === 0 && { borderColor: renkler.birincil }]}
                >
                  <Text style={s.yeniTipMetin}>
                    {hataArama.trim() ? `+ “${hataArama.trim()}” adıyla yeni hata tipi` : '+ Yeni hata tipi'}
                  </Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </View>
      )}

      {sonKayit ? (
        // Bildirim altta, hata ızgarasının son satırının ÜSTÜNDE yüzüyor. Metin
        // kısmı dokunuşu yutarsa kayıttan sonraki 6 sn boyunca o satırdaki
        // düğmelere basılamıyor — hızlı girişin tam ortasında (16.09.2026 ekran
        // incelemesi). Dokunuşu yalnız "Geri al" alır, gerisi alttakine geçer.
        <View style={s.bildirim} accessibilityLiveRegion="polite" pointerEvents="box-none">
          <View style={{ flex: 1 }} pointerEvents="none">
            <Text style={s.bildirimMetin} numberOfLines={2}>✓ {sonKayit.metin}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Son kaydı geri al"
            onPress={geriAl}
            hitSlop={8}
            style={s.geriAlDugme}
          >
            <Text style={s.geriAlMetin}>Geri al</Text>
          </Pressable>
        </View>
      ) : null}

      <AltSayfa
        gorunur={acikSayfa !== 'yok'}
        tamYukseklik={acikSayfa === 'liste'}
        onKapat={() => { setAcikSayfa('yok'); setTaslak(null); }}
      >
        {acikSayfa === 'liste' ? (
          <KayitListesi
            hatalar={denetim.hatalar}
            onAc={(h) => { setTaslak({ ...h }); setAcikSayfa('hata'); }}
            onKapat={() => setAcikSayfa('yok')}
          />
        ) : (
          <HataSayfasi
            denetimId={denetim.id}
            denetci={denetim.denetci}
            taslak={taslak}
            fotograflar={fotograflar}
            onKapat={() => { setTaslak(null); setAcikSayfa('liste'); }}
            onKaydet={ayrintiKaydet}
            onSil={ayrintiSil}
          />
        )}
      </AltSayfa>
    </Ekran>
  );
}

/** Kaydedilen hatalar — fotoğraf, not ve adet buradan, isteğe bağlı eklenir. */
function KayitListesi({
  hatalar, onAc, onKapat,
}: {
  hatalar: Hata[];
  onAc: (h: Hata) => void;
  onKapat: () => void;
}) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const sirali = useMemo(() => [...hatalar].sort((a, b) => b.zaman.localeCompare(a.zaman)), [hatalar]);

  return (
    <>
      <Text style={s.listeBaslik}>Kaydedilen hatalar ({hatalar.length})</Text>
      <Text style={s.listeNot}>Fotoğraf, not ya da adet eklemek için hataya dokunun.</Text>
      <ScrollView style={{ flexGrow: 1 }} contentContainerStyle={s.listeGovde}>
        {sirali.length === 0 ? (
          <Text style={s.bos}>Henüz hata kaydedilmedi.</Text>
        ) : sirali.map((h, i) => {
          const p = PARCA_INDEKS[h.parcaId];
          const t = HATA_TIPI_INDEKS[h.hataTipiId];
          return (
            <Pressable
              key={h.id}
              accessibilityRole="button"
              accessibilityLabel={`${p?.ad} ${t?.ad}, derece ${dereceGosterimi(h)} — düzenle`}
              onPress={() => onAc(h)}
              style={({ pressed }) => [s.kayitSatir, pressed && s.basili]}
            >
              <Text style={s.kayitSira}>{sirali.length - i}</Text>
              <DereceRozeti derece={h.derece} kabul={h.kabulEdilebilir} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.kayitAd} numberOfLines={1}>{p?.ad ?? h.parcaId} — {t?.ad ?? h.hataTipiId}</Text>
                <Text style={s.kayitAlt} numberOfLines={1}>
                  {[
                    p?.bolgeAd,
                    h.adet > 1 ? `${h.adet} adet` : null,
                    h.konum || null,
                    h.fotograflar.length ? `📷 ${h.fotograflar.length}` : null,
                  ].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Text style={s.ok}>›</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={s.listeEylem}>
        <Dugme metin="Kapat" onPress={onKapat} style={{ flex: 1 }} />
      </View>
    </>
  );
}

const stiller = (r: Renkler) => StyleSheet.create({
  baslikSag: { flexDirection: 'row', gap: bosluk.xs },
  basili: { backgroundColor: r.yuzeyAlt },

  aramaKutu: { paddingHorizontal: bosluk.md, paddingTop: bosluk.sm, paddingBottom: bosluk.xs },
  arama: {
    ...tipografi.body, color: r.metin, minHeight: DOKUNMA,
    paddingHorizontal: bosluk.sm, backgroundColor: r.yuzey,
    borderWidth: 1, borderColor: r.cizgi, borderRadius: kose.md,
  },

  parcaListe: { paddingHorizontal: bosluk.md, paddingBottom: 120 },
  bolumBaslik: { ...tipografi.etiket, color: r.metinSolgun },
  bolgeBaslik: {
    ...tipografi.etiket, color: r.metinSolgun, backgroundColor: r.bg,
    paddingTop: bosluk.sm, paddingBottom: bosluk.xxs,
  },
  parcaSatir: {
    flexDirection: 'row', alignItems: 'center', gap: bosluk.sm,
    minHeight: 56, paddingHorizontal: bosluk.xs,
    borderBottomWidth: 1, borderBottomColor: r.cizgiSolgun,
  },
  parcaAd: { ...tipografi.bodyOrta, color: r.metin },
  parcaEn: { ...tipografi.caption, color: r.metinSolgun },
  ok: { ...tipografi.h2, color: r.metinSolgun },

  cipSatir: { flexDirection: 'row', flexWrap: 'wrap', gap: bosluk.xs },
  cip: {
    minHeight: DOKUNMA, justifyContent: 'center', maxWidth: 220,
    paddingHorizontal: bosluk.sm, paddingVertical: 6,
    borderRadius: kose.md, borderWidth: 1, borderColor: r.cizgi, backgroundColor: r.yuzey,
  },
  cipAd: { ...tipografi.captionOrta, color: r.metin },
  cipAlt: { ...tipografi.caption, color: r.metinSolgun, fontSize: 11 },

  parcaBaslik: {
    flexDirection: 'row', alignItems: 'center', gap: bosluk.sm,
    paddingHorizontal: bosluk.md, paddingVertical: bosluk.xs,
    borderBottomWidth: 1, borderBottomColor: r.cizgiSolgun, backgroundColor: r.bgYukseltilmis,
  },
  geriDugme: {
    minHeight: DOKUNMA, justifyContent: 'center', paddingHorizontal: bosluk.sm,
    borderRadius: kose.md, borderWidth: 1, borderColor: r.cizgi, backgroundColor: r.yuzey,
  },
  geriMetin: { ...tipografi.bodyOrta, color: r.birincil },
  seciliParca: { ...tipografi.h2, color: r.metin },
  seciliYol: { ...tipografi.caption, color: r.metinSolgun },

  dereceSerit: {
    gap: bosluk.xs, paddingHorizontal: bosluk.md, paddingVertical: bosluk.sm,
    borderBottomWidth: 1, borderBottomColor: r.cizgiSolgun,
  },
  dereceEtiket: { ...tipografi.etiket, color: r.metinSolgun },
  dereceSatir: { flexDirection: 'row', gap: bosluk.xs },
  dereceDugme: {
    flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center',
    borderRadius: kose.md, borderWidth: 2, borderColor: r.cizgi, backgroundColor: r.yuzey,
  },
  dereceDugmeSecili: { borderColor: r.birincil, backgroundColor: r.birincil },
  dereceMetin: { ...tipografi.h1, color: r.metin },

  hataGovde: { padding: bosluk.md, gap: bosluk.sm, paddingBottom: 120 },
  hataIzgara: { flexDirection: 'row', flexWrap: 'wrap', gap: bosluk.xs },
  hataDugme: {
    flexGrow: 1, flexBasis: 150, minHeight: 64, justifyContent: 'center', gap: 2,
    paddingHorizontal: bosluk.sm, paddingVertical: bosluk.xs,
    borderRadius: kose.md, borderWidth: 1, borderColor: r.cizgi, backgroundColor: r.yuzey,
  },
  hataDugmeBasili: { borderColor: r.birincil, backgroundColor: r.birincilYumusak },
  hataAd: { ...tipografi.bodyOrta, color: r.metin },
  hataEn: { ...tipografi.caption, color: r.metinSolgun },
  ekipIsaret: { ...tipografi.caption, fontSize: 10, color: r.bilgi },

  yeniTip: {
    minHeight: DOKUNMA, alignItems: 'center', justifyContent: 'center',
    borderRadius: kose.md, borderWidth: 1, borderStyle: 'dashed',
    borderColor: r.cizgiGuclu, backgroundColor: r.yuzey, paddingHorizontal: bosluk.sm,
  },
  yeniTipMetin: { ...tipografi.bodyOrta, color: r.birincil, textAlign: 'center' },

  bos: { ...tipografi.body, color: r.metinSolgun, paddingVertical: bosluk.md, textAlign: 'center' },

  bildirim: {
    position: 'absolute', left: bosluk.md, right: bosluk.md, bottom: bosluk.md,
    flexDirection: 'row', alignItems: 'center', gap: bosluk.sm,
    paddingLeft: bosluk.md, paddingRight: bosluk.xs, minHeight: 56,
    borderRadius: kose.md, backgroundColor: r.metin,
  },
  bildirimMetin: { ...tipografi.bodyOrta, color: r.bg, flex: 1 },
  geriAlDugme: { minHeight: DOKUNMA, justifyContent: 'center', paddingHorizontal: bosluk.sm },
  geriAlMetin: { ...tipografi.bodyOrta, color: r.birincilYumusak },

  listeBaslik: { ...tipografi.h2, color: r.metin, paddingHorizontal: bosluk.md },
  listeNot: { ...tipografi.caption, color: r.metinSolgun, paddingHorizontal: bosluk.md },
  listeGovde: { paddingHorizontal: bosluk.md, paddingBottom: bosluk.md, gap: 6 },
  kayitSatir: {
    flexDirection: 'row', alignItems: 'center', gap: bosluk.sm, minHeight: 56,
    paddingHorizontal: bosluk.xs, borderRadius: kose.md,
    borderWidth: 1, borderColor: r.cizgiSolgun, backgroundColor: r.yuzey,
  },
  kayitSira: { ...tipografi.caption, color: r.metinSolgun, width: 22, textAlign: 'right' },
  kayitAd: { ...tipografi.bodyOrta, color: r.metin },
  kayitAlt: { ...tipografi.caption, color: r.metinSolgun },
  listeEylem: {
    padding: bosluk.md, borderTopWidth: 1, borderTopColor: r.cizgiSolgun,
    backgroundColor: r.bgYukseltilmis,
  },
});
