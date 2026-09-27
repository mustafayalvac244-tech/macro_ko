import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable, ScrollView, SectionList, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  DereceSecici, GrupBasligi, HataSayfasi, HataTaslagi, KabulAnahtari, YeniTipFormu,
} from '@/bilesenler/HataSayfasi';
import { BOLGE_SIMGELERI, S } from '@/bilesenler/simgeler';
import {
  AltSayfa, AramaKutusu, Baslik, BaslikCipi, BaslikDugmesi, BolumBasligi, BosDurum, DereceRozeti,
  Dugme, Ekran, GeriDugmesi, HataKutusu, Olcu, Rozet, useDuzen, Yukleniyor,
} from '@/bilesenler/temel';
import {
  bolgelerAracIcin, HATA_TIPI_INDEKS, PARCA_INDEKS, parcaHataTipleri, parcaTamAdi,
} from '@/cekirdek/katalog';
import { ARAC_INDEKS } from '@/cekirdek/model3d';
import { denetimOzeti, dereceGosterimi } from '@/cekirdek/puan';
import {
  BolgeGrubu, Denetim, DereceKodu, Hata, HataGrubuId, HataTipi, Parca,
} from '@/cekirdek/tipler';
import { bosluk, DOKUNMA, kose, Renkler, tipografi, useTema } from '@/tema';
import {
  ayarOku, ayarYaz, denetimGetir, FotografKaydi, fotograflariGetir, fotografiHataBagla,
  hataKaydet, hataSil, kimlikUret,
} from '@/veri/depo';
import { useKatalog } from '@/veri/katalogDeposu';

/**
 * ÇALIŞMA EKRANI — hızlı giriş.
 *
 * 26.09.2026 ürün sahibi geri bildirimi: "programı hiç beğenmedim… parça
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
 * DÜZEN (27.09.2026): tablette İKİ BÖLME — solda parça gezgini hep açık,
 * sağda hata paneli. Telefonda iki adım: önce parça listesi, sonra hata
 * paneli. Kayıt akışı ikisinde de aynıdır: kayıttan sonra parça seçimi
 * kalkar. Seçim kalsaydı bir sonraki hata, denetçi başka parçaya baktığı hâlde
 * eski parçaya yazılabilirdi.
 *
 * 3B model buradan kaldırıldı ("görünüm sonraya kalsın"). Bileşen dosyaları
 * duruyor; gerçek araç modeli geldiğinde geri bağlanacak.
 */
export default function DenetimEkrani() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const { tablet } = useDuzen();
  const kenar = useSafeAreaInsets();
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
  // Parça → sorumlu (ekibin tablosunda L: "HMTR PD (HWASEUNG)"). Ayrıntı
  // ekranında bir parça için yazılan sorumlu burada öğrenilir, o parçanın
  // sonraki hızlı kayıtlarına kendiliğinden gelir. Hiç yazılmamışsa BOŞ kalır:
  // bilinmeyen bir sorumluyu tahmin edip rapora basmak yanlış kişiye iş açar.
  const [sorumluHaritasi, setSorumluHaritasi] = useState<Record<string, string>>({});
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
    ayarOku<Record<string, string>>('sorumluHaritasi', {}).then(setSorumluHaritasi).catch(() => { /* ilk açılış */ });
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
        grup: b.grup,
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

  /** Parça başına kayıt sayısı — gezginde rozet olarak görünür. */
  const parcaSayilari = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of denetim?.hatalar ?? []) m.set(h.parcaId, (m.get(h.parcaId) ?? 0) + 1);
    return m;
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

  /** Izgara grup grup çizilir; grup sırası listedeki ilk görünüşe göre. */
  const tipGruplari = useMemo(() => {
    const m = new Map<HataGrubuId, HataTipi[]>();
    for (const t of tipler) m.set(t.grup, [...(m.get(t.grup) ?? []), t]);
    return [...m.entries()];
  }, [tipler]);

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
      sorunTipi: 'Part',
      sorumlu: sorumluHaritasi[parcaId] ?? '',
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
    // Kullanım sayacını hataKaydet kendisi artırıyor. Burada da çağrılıyordu;
    // hızlı girişteki her kayıt iki kez sayılıyordu (26.09.2026'da fark edildi).

    setSonKayit({ id: kayit.id, metin: `${parcaTamAdi(parcaId)} — ${t.ad} · ${dereceGosterimi(kayit)}` });
    if (bildirimZamanlayici.current) clearTimeout(bildirimZamanlayici.current);
    bildirimZamanlayici.current = setTimeout(() => setSonKayit(null), 6000);

    setKabul(false);
    parcalaraDon();
    setParcaArama('');
    await tazele();
  }, [denetim, parcaId, derece, kabul, sorumluHaritasi, parcalaraDon, tazele]);

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

    // Sorumluyu yalnız PART hatalarından öğren. Complex bir hatanın sorumlusu
    // çoğu zaman bir tasarım ekibi ("MSV Closure Design Team 1"); onu parçaya
    // bağlarsak o parçanın sonraki sıradan hataları yanlış yere yazılır.
    const yeniSorumlu = t.sorumlu?.trim() ?? '';
    if (t.sorunTipi === 'Part' && yeniSorumlu && sorumluHaritasi[t.parcaId] !== yeniSorumlu) {
      const harita = { ...sorumluHaritasi, [t.parcaId]: yeniSorumlu };
      setSorumluHaritasi(harita);
      ayarYaz('sorumluHaritasi', harita).catch(() => { /* öğrenilmezse elle yazılır */ });
    }

    setTaslak(null);
    setAcikSayfa('liste');
    await tazele();
  }, [denetim, sorumluHaritasi, tazele]);

  const ayrintiSil = useCallback(async (hataId: string) => {
    await hataSil(hataId);
    setTaslak(null);
    setAcikSayfa('liste');
    await tazele();
  }, [tazele]);

  const kaydiAc = useCallback((h: Hata) => {
    setTaslak({ ...h });
    setAcikSayfa('hata');
  }, []);

  // --- DURUMLAR ---------------------------------------------------------
  if (yuklemeHatasi) {
    return (
      <Ekran>
        <Baslik baslik="Denetim" sol={<GeriDugmesi />} />
        <View style={{ padding: bosluk.md }}><HataKutusu metin={yuklemeHatasi} /></View>
      </Ekran>
    );
  }
  if (!denetim) {
    return (
      <Ekran>
        <Baslik baslik="Denetim" sol={<GeriDugmesi />} />
        <Yukleniyor metin="Denetim açılıyor…" />
      </Ekran>
    );
  }

  const hataSayisi = denetim.hatalar.length;
  const seciliAdet = parcaId ? parcaSayilari.get(parcaId) ?? 0 : 0;

  // --- PARÇA GEZGİNİ ----------------------------------------------------
  const parcaGezgini = (
    <View style={s.gezgin}>
      <View style={s.aramaKutu}>
        <AramaKutusu
          deger={parcaArama}
          degistir={setParcaArama}
          yerTutucu="Parça ara — kaput, A direği, ön kapı…"
          erisimEtiketi="Parça ara"
        />
      </View>

      <SectionList<Parca, { baslik: string; grup: BolgeGrubu }>
        sections={bolumler}
        keyExtractor={(p) => p.id}
        stickySectionHeadersEnabled
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.parcaListe}
        ListHeaderComponent={sonParcalar.length && !parcaArama ? (
          <View style={s.sonBlok}>
            <BolumBasligi metin="SON DOKUNULANLAR" simge={S.son} />
            <View style={s.cipSatir}>
              {sonParcalar.map((pid) => {
                const p = PARCA_INDEKS[pid]!;
                return (
                  <Pressable
                    key={pid}
                    accessibilityRole="button"
                    accessibilityLabel={`${p.ad} — ${p.bolgeAd}`}
                    onPress={() => parcaSec(pid)}
                    style={({ pressed }) => [s.cip, pid === parcaId && s.cipSecili, pressed && s.basili]}
                  >
                    <Text style={s.cipAd} numberOfLines={1}>{p.ad}</Text>
                    <Text style={s.cipAlt} numberOfLines={1}>{p.bolgeAd}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
        renderSectionHeader={({ section }) => {
          const Ikon = BOLGE_SIMGELERI[section.grup];
          return (
            <View style={s.bolgeBaslik}>
              {Ikon ? <Ikon size={15} color={renkler.metinSolgun} strokeWidth={2} /> : null}
              <Text style={s.bolgeBaslikMetin} numberOfLines={1}>{section.baslik}</Text>
            </View>
          );
        }}
        renderItem={({ item }) => {
          const adet = parcaSayilari.get(item.id) ?? 0;
          // Tablette parça bir SEÇİM (sağ bölme onu gösterir) → radyo; telefonda
          // bir sonraki adıma geçiş → düğme.
          const secili = tablet && item.id === parcaId;
          return (
            <Pressable
              accessibilityRole={tablet ? 'radio' : 'button'}
              aria-checked={tablet ? secili : undefined}
              accessibilityLabel={`${item.ad} (${item.en})${adet ? `, ${adet} kayıt` : ''}`}
              onPress={() => parcaSec(item.id)}
              style={({ pressed }) => [s.parcaSatir, secili && s.parcaSatirSecili, pressed && s.basili]}
            >
              <View style={[s.seciliCizgi, secili && { backgroundColor: renkler.birincil }]} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.parcaAd, secili && { color: renkler.birincil }]} numberOfLines={1}>{item.ad}</Text>
                <Text style={s.parcaEn} numberOfLines={1}>{item.en}</Text>
              </View>
              {adet > 0 ? (
                <View style={s.adetPul}><Text style={s.adetPulMetin}>{adet}</Text></View>
              ) : null}
              {!tablet ? <S.ileri size={20} color={renkler.metinSolgun} strokeWidth={2} /> : null}
            </Pressable>
          );
        }}
        ListEmptyComponent={<Text style={s.bos}>“{parcaArama.trim()}” ile eşleşen parça yok.</Text>}
      />
    </View>
  );

  // --- HATA PANELİ ------------------------------------------------------
  const hataPaneli = parca ? (
    <View style={{ flex: 1 }}>
      <View style={s.parcaBaslik}>
        {!tablet ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Parça listesine dön"
            onPress={parcalaraDon}
            style={({ pressed }) => [s.geriDugme, pressed && s.basili]}
          >
            <S.geri size={20} color={renkler.birincil} strokeWidth={2.25} />
            <Text style={s.geriMetin}>Parçalar</Text>
          </Pressable>
        ) : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.seciliParca} numberOfLines={1}>{parca.ad}</Text>
          <Text style={s.seciliYol} numberOfLines={1}>{parca.bolgeAd} · {parca.en}</Text>
        </View>
        {seciliAdet > 0 ? (
          <Rozet metin={`${seciliAdet} KAYIT`} renk={renkler.birincil} zemin={renkler.birincilYumusak} />
        ) : null}
        {tablet ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Parça seçimini kaldır"
            onPress={parcalaraDon}
            style={({ pressed }) => [s.kapatDugme, pressed && s.basili]}
          >
            <S.kapat size={20} color={renkler.metinIkincil} strokeWidth={2} />
          </Pressable>
        ) : null}
      </View>

      <View style={[s.dereceSerit, tablet && s.dereceSeritTablet]}>
        <View style={[{ gap: bosluk.xs }, tablet && { flex: 1 }]}>
          <Text style={s.dereceEtiket}>DERECE — 3 EN AĞIR</Text>
          <DereceSecici derece={derece} onSec={dereceSec} />
        </View>
        <KabulAnahtari kabul={kabul} derece={derece} onDegis={setKabul} style={tablet ? { flex: 1 } : undefined} />
      </View>

      <ScrollView contentContainerStyle={s.hataGovde} keyboardShouldPersistTaps="handled">
        <AramaKutusu
          deger={hataArama}
          degistir={setHataArama}
          yerTutucu="Hata ara — gap, scratch, gıcırtı…"
          erisimEtiketi="Hata tipi ara"
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
            {tipGruplari.map(([g, liste]) => (
              <View key={g} style={s.grup}>
                <GrupBasligi grup={g} />
                <View style={s.hataIzgara}>
                  {liste.map((t) => (
                    <Pressable
                      key={t.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${t.ad}${t.en ? ` (${t.en})` : ''} — derece ${kabul ? `(${derece})` : derece} olarak kaydet`}
                      onPress={() => hizliKaydet(t)}
                      style={({ pressed }) => [s.hataDugme, pressed && s.hataDugmeBasili]}
                    >
                      <View style={s.hataDugmeUst}>
                        <Text style={s.hataAd} numberOfLines={2}>{t.ad}</Text>
                        {t.ozel ? <Text style={s.ekipIsaret}>EKİP</Text> : null}
                      </View>
                      {t.en ? <Text style={s.hataEn} numberOfLines={1}>{t.en}</Text> : null}
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}

            {tipler.length === 0 ? (
              <Text style={s.bos}>
                {hataArama.trim() ? `“${hataArama.trim()}” listede yok.` : 'Bu parça için tanımlı hata tipi yok.'}
              </Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={hataArama.trim() ? `“${hataArama.trim()}” adıyla yeni hata tipi ekle` : 'Yeni hata tipi ekle'}
              onPress={() => setYeniTipAcik(true)}
              style={({ pressed }) => [s.yeniTip, tipler.length === 0 && { borderColor: renkler.birincil }, pressed && s.basili]}
            >
              <S.ekle size={18} color={renkler.birincil} strokeWidth={2.25} />
              <Text style={s.yeniTipMetin}>
                {hataArama.trim() ? `“${hataArama.trim()}” adıyla yeni hata tipi` : 'Yeni hata tipi'}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  ) : null;

  return (
    <Ekran>
      <Baslik
        // Tablette başlık şasi numarasıdır. Telefonda 17 hane düğmelerle aynı
        // satıra sığmıyor ve SONDAN kesiliyordu — ayırt edici seri numarası
        // tam da sondadır. Orada başlık araç adı olur, şasi alttaki çipe iner.
        mono={tablet}
        baslik={tablet ? (denetim.vin || 'Denetim') : (arac?.ad ?? 'Denetim')}
        sol={<GeriDugmesi />}
        cipler={(
          <>
            {!tablet && denetim.vin ? <BaslikCipi metin={denetim.vin} mono /> : null}
            {tablet ? <BaslikCipi simge={S.arac} metin={arac?.ad ?? denetim.aracId} /> : null}
            {denetim.plaka ? <BaslikCipi metin={denetim.plaka} mono /> : null}
            {denetim.faz ? <BaslikCipi simge={S.faz} metin={denetim.faz} /> : null}
            {denetim.ekip ? <BaslikCipi simge={S.ekip} metin={denetim.ekip} /> : null}
          </>
        )}
        sag={(
          <>
            <BaslikDugmesi
              simge={S.liste}
              metin="Kayıtlar"
              sayac={hataSayisi}
              erisimEtiketi={`Kaydedilen ${hataSayisi} hata`}
              onPress={() => setAcikSayfa('liste')}
            />
            <BaslikDugmesi
              simge={S.rapor}
              metin="Rapor"
              birincil
              erisimEtiketi="Rapor"
              onPress={() => router.push({ pathname: '/denetim/rapor', params: { id: denetim.id } })}
            />
          </>
        )}
      />

      {tablet ? (
        <View style={s.ikiBolme}>
          <View style={s.solBolme}>{parcaGezgini}</View>
          <View style={s.sagBolme}>
            {hataPaneli ?? <DenetimOzeti denetim={denetim} derece={derece} onAc={kaydiAc} onTumu={() => setAcikSayfa('liste')} />}
          </View>
        </View>
      ) : (hataPaneli ?? parcaGezgini)}

      {sonKayit ? (
        // Bildirim altta, hata ızgarasının son satırının ÜSTÜNDE yüzüyor. Metin
        // kısmı dokunuşu yutarsa kayıttan sonraki 6 sn boyunca o satırdaki
        // düğmelere basılamıyor — hızlı girişin tam ortasında (26.09.2026 ekran
        // incelemesi). Dokunuşu yalnız "Geri al" alır, gerisi alttakine geçer.
        <View style={[s.bildirimKap, { bottom: bosluk.md + kenar.bottom }]} pointerEvents="box-none">
          <View style={s.bildirim} accessibilityLiveRegion="polite" pointerEvents="box-none">
            <View style={s.bildirimSol} pointerEvents="none">
              <S.tamam size={20} color={renkler.cubukVurgu} strokeWidth={2.25} />
              <Text style={s.bildirimMetin} numberOfLines={2}>{sonKayit.metin}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Son kaydı geri al"
              onPress={geriAl}
              hitSlop={8}
              style={({ pressed }) => [s.geriAlDugme, pressed && s.basili]}
            >
              <S.geriAl size={18} color={renkler.cubukVurgu} strokeWidth={2.25} />
              <Text style={s.geriAlMetin}>Geri al</Text>
            </Pressable>
          </View>
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
            onAc={kaydiAc}
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

/**
 * Tablette parça seçilmemişken sağ bölme: ne yapılacağı ve denetimin o anki
 * durumu. Sayılar rapor ekranıyla AYNI kaynaktan (`denetimOzeti`) gelir;
 * iki ekranda farklı sayı görmek denetçinin ikisine de güvenini bitirir.
 */
function DenetimOzeti({
  denetim, derece, onAc, onTumu,
}: {
  denetim: Denetim;
  derece: DereceKodu;
  onAc: (h: Hata) => void;
  onTumu: () => void;
}) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const ozet = useMemo(() => denetimOzeti(denetim), [denetim]);
  const son = useMemo(
    () => [...denetim.hatalar].sort((a, b) => b.zaman.localeCompare(a.zaman)).slice(0, 5),
    [denetim.hatalar],
  );

  return (
    <ScrollView contentContainerStyle={s.ozetGovde}>
      <BosDurum
        simge={S.sec}
        baslik="Soldan bir parça seçin"
        aciklama="Sonra hata tipine dokunun — kayıt o anda düşer, form açılmaz."
        eylem={(
          <View style={s.seciliDerece}>
            <Text style={s.seciliDereceMetin}>Seçili derece</Text>
            <DereceRozeti derece={derece} kabul={false} />
          </View>
        )}
      />

      <View style={s.olcuSatiri}>
        <Olcu genis simge={S.rapor} deger={ozet.toplamAdet} etiket="bulgu" renk={renkler.birincil} zemin={renkler.birincilYumusak} />
        <Olcu genis simge={S.uyari} deger={ozet.dereceDagilimi['3'].adet} etiket="derece 3" renk={renkler.derece3} zemin={renkler.derece3Yumusak} />
        <Olcu genis simge={S.kabul} deger={ozet.kabulEdilebilirAdet} etiket="kabul edilebilir" />
      </View>

      {son.length ? (
        <View style={{ gap: bosluk.xs }}>
          <BolumBasligi
            metin="SON KAYITLAR"
            simge={S.son}
            sag={<Dugme metin="Tümü" kucuk tur="sessiz" simge={S.liste} onPress={onTumu} erisimEtiketi="Tüm kayıtları aç" />}
          />
          {son.map((h) => (
            <KayitSatiri key={h.id} hata={h} onPress={() => onAc(h)} />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

/** Kaydedilmiş tek hata satırı — liste sayfasında ve özet bölmesinde aynı. */
function KayitSatiri({ hata: h, sira, onPress }: { hata: Hata; sira?: number; onPress: () => void }) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const p = PARCA_INDEKS[h.parcaId];
  const t = HATA_TIPI_INDEKS[h.hataTipiId];
  const alt = [
    p?.bolgeAd,
    h.adet > 1 ? `${h.adet} adet` : null,
    h.konum || null,
    h.sorunTipi === 'Complex' ? 'Complex' : null,
    h.sorumlu ? `→ ${h.sorumlu}` : null,
  ].filter(Boolean).join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${parcaTamAdi(h.parcaId)} ${t?.ad}, derece ${dereceGosterimi(h)} — düzenle`}
      onPress={onPress}
      style={({ pressed }) => [s.kayitSatir, pressed && s.basili]}
    >
      {sira !== undefined ? <Text style={s.kayitSira}>{sira}</Text> : null}
      <DereceRozeti derece={h.derece} kabul={h.kabulEdilebilir} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.kayitAd} numberOfLines={1}>{parcaTamAdi(h.parcaId)} — {t?.ad ?? h.hataTipiId}</Text>
        {alt ? <Text style={s.kayitAlt} numberOfLines={1}>{alt}</Text> : null}
      </View>
      {h.fotograflar.length ? (
        <View style={s.fotoSayi}>
          <S.kamera size={14} color={renkler.metinIkincil} strokeWidth={2} />
          <Text style={s.fotoSayiMetin}>{h.fotograflar.length}</Text>
        </View>
      ) : null}
      <S.ileri size={18} color={renkler.metinSolgun} strokeWidth={2} />
    </Pressable>
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
      <View style={s.listeUst}>
        <Text style={s.listeBaslik}>Kaydedilen hatalar ({hatalar.length})</Text>
        <Text style={s.listeNot}>Fotoğraf, not ya da adet eklemek için hataya dokunun.</Text>
      </View>
      <ScrollView style={{ flexGrow: 1 }} contentContainerStyle={s.listeGovde}>
        {sirali.length === 0 ? (
          <BosDurum simge={S.liste} baslik="Henüz hata kaydedilmedi" />
        ) : sirali.map((h, i) => (
          <KayitSatiri key={h.id} hata={h} sira={sirali.length - i} onPress={() => onAc(h)} />
        ))}
      </ScrollView>
      <View style={s.listeEylem}>
        <Dugme metin="Kapat" onPress={onKapat} style={{ flex: 1 }} />
      </View>
    </>
  );
}

const stiller = (r: Renkler) => StyleSheet.create({
  basili: { opacity: 0.72 },

  // İki bölme (tablet)
  ikiBolme: { flex: 1, flexDirection: 'row' },
  solBolme: {
    width: '36%', minWidth: 300, maxWidth: 420,
    borderRightWidth: 1, borderRightColor: r.cizgi,
  },
  sagBolme: { flex: 1, minWidth: 0 },

  // Parça gezgini
  gezgin: { flex: 1, backgroundColor: r.bgYukseltilmis },
  aramaKutu: { paddingHorizontal: bosluk.md, paddingTop: bosluk.sm, paddingBottom: bosluk.xs },
  parcaListe: { paddingBottom: 120 },
  sonBlok: { gap: bosluk.xs, paddingHorizontal: bosluk.md, paddingTop: bosluk.xs, paddingBottom: bosluk.sm },
  bolgeBaslik: {
    flexDirection: 'row', alignItems: 'center', gap: bosluk.xs,
    paddingHorizontal: bosluk.md, paddingTop: bosluk.sm, paddingBottom: 6,
    backgroundColor: r.bgYukseltilmis, borderBottomWidth: 1, borderBottomColor: r.cizgiSolgun,
  },
  bolgeBaslikMetin: { ...tipografi.captionOrta, color: r.metinIkincil, flex: 1 },
  parcaSatir: {
    flexDirection: 'row', alignItems: 'center', gap: bosluk.sm,
    minHeight: 58, paddingRight: bosluk.md,
    borderBottomWidth: 1, borderBottomColor: r.cizgiSolgun,
  },
  parcaSatirSecili: { backgroundColor: r.birincilYumusak },
  seciliCizgi: { width: 4, alignSelf: 'stretch', backgroundColor: 'transparent', marginRight: bosluk.xs },
  parcaAd: { ...tipografi.bodyOrta, color: r.metin },
  parcaEn: { ...tipografi.caption, color: r.metinSolgun },
  adetPul: {
    minWidth: 26, height: 24, paddingHorizontal: 7, borderRadius: kose.pill,
    alignItems: 'center', justifyContent: 'center', backgroundColor: r.yuzeyVurgu,
  },
  adetPulMetin: { ...tipografi.captionOrta, color: r.metin, fontVariant: ['tabular-nums'] },

  cipSatir: { flexDirection: 'row', flexWrap: 'wrap', gap: bosluk.xs },
  cip: {
    minHeight: DOKUNMA, justifyContent: 'center', maxWidth: 220,
    paddingHorizontal: bosluk.sm, paddingVertical: 6,
    borderRadius: kose.md, borderWidth: 1, borderColor: r.cizgi, backgroundColor: r.yuzey,
  },
  cipSecili: { borderColor: r.birincil, backgroundColor: r.birincilYumusak },
  cipAd: { ...tipografi.captionOrta, color: r.metin },
  cipAlt: { ...tipografi.caption, color: r.metinSolgun, fontSize: 11 },

  // Hata paneli
  parcaBaslik: {
    flexDirection: 'row', alignItems: 'center', gap: bosluk.sm,
    paddingHorizontal: bosluk.md, paddingVertical: bosluk.sm,
    borderBottomWidth: 1, borderBottomColor: r.cizgiSolgun, backgroundColor: r.bgYukseltilmis,
  },
  geriDugme: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    minHeight: DOKUNMA, paddingLeft: bosluk.xs, paddingRight: bosluk.sm,
    borderRadius: kose.md, borderWidth: 1, borderColor: r.cizgi, backgroundColor: r.yuzey,
  },
  geriMetin: { ...tipografi.bodyOrta, color: r.birincil },
  kapatDugme: {
    width: DOKUNMA, height: DOKUNMA, alignItems: 'center', justifyContent: 'center',
    borderRadius: kose.md, borderWidth: 1, borderColor: r.cizgi, backgroundColor: r.yuzey,
  },
  seciliParca: { ...tipografi.h2, color: r.metin },
  seciliYol: { ...tipografi.caption, color: r.metinSolgun },

  dereceSerit: {
    gap: bosluk.sm, paddingHorizontal: bosluk.md, paddingVertical: bosluk.sm,
    borderBottomWidth: 1, borderBottomColor: r.cizgiSolgun, backgroundColor: r.bgYukseltilmis,
  },
  dereceSeritTablet: { flexDirection: 'row', alignItems: 'flex-end', gap: bosluk.md },
  dereceEtiket: { ...tipografi.etiket, color: r.metinSolgun },

  hataGovde: { padding: bosluk.md, gap: bosluk.md, paddingBottom: 120 },
  grup: { gap: bosluk.xs },
  hataIzgara: { flexDirection: 'row', flexWrap: 'wrap', gap: bosluk.xs },
  hataDugme: {
    flexGrow: 1, flexBasis: 160, minHeight: 64, justifyContent: 'center', gap: 2,
    paddingHorizontal: bosluk.sm, paddingVertical: bosluk.xs,
    borderRadius: kose.md, borderWidth: 1, borderColor: r.cizgi, backgroundColor: r.yuzey,
    boxShadow: `0 1px 2px ${r.golge}`,
  },
  hataDugmeBasili: { borderColor: r.birincil, backgroundColor: r.birincilYumusak },
  hataDugmeUst: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  hataAd: { ...tipografi.bodyOrta, color: r.metin, flex: 1 },
  hataEn: { ...tipografi.caption, color: r.metinSolgun },
  ekipIsaret: {
    ...tipografi.etiket, fontSize: 9, lineHeight: 13, color: r.bilgi,
    borderWidth: 1, borderColor: r.bilgi, borderRadius: kose.sm, paddingHorizontal: 4, marginTop: 3,
  },

  yeniTip: {
    flexDirection: 'row', gap: bosluk.xs,
    minHeight: DOKUNMA, alignItems: 'center', justifyContent: 'center',
    borderRadius: kose.md, borderWidth: 1, borderStyle: 'dashed',
    borderColor: r.cizgiGuclu, backgroundColor: r.yuzey, paddingHorizontal: bosluk.sm,
  },
  yeniTipMetin: { ...tipografi.bodyOrta, color: r.birincil, textAlign: 'center' },

  bos: { ...tipografi.body, color: r.metinSolgun, padding: bosluk.md, textAlign: 'center' },

  // Tablet özet bölmesi
  ozetGovde: { padding: bosluk.lg, gap: bosluk.md, paddingBottom: 120, maxWidth: 760, width: '100%', alignSelf: 'center' },
  olcuSatiri: { flexDirection: 'row', flexWrap: 'wrap', gap: bosluk.xs },
  seciliDerece: { flexDirection: 'row', alignItems: 'center', gap: bosluk.xs, marginTop: bosluk.xxs },
  seciliDereceMetin: { ...tipografi.captionOrta, color: r.metinIkincil },

  // Bildirim — iki temada da uygulama çubuğunun koyu yüzeyi.
  bildirimKap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: bosluk.md },
  bildirim: {
    width: '100%', maxWidth: 640,
    flexDirection: 'row', alignItems: 'center', gap: bosluk.sm,
    paddingLeft: bosluk.md, paddingRight: bosluk.xs, minHeight: 58,
    borderRadius: kose.lg, backgroundColor: r.cubuk, borderWidth: 1, borderColor: r.cubukCizgi,
    boxShadow: `0 6px 18px ${r.golge}`,
  },
  bildirimSol: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: bosluk.xs },
  bildirimMetin: { ...tipografi.bodyOrta, color: r.cubukMetin, flex: 1 },
  geriAlDugme: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    minHeight: DOKUNMA, paddingHorizontal: bosluk.sm, borderRadius: kose.md,
  },
  geriAlMetin: { ...tipografi.bodyOrta, color: r.cubukVurgu },

  // Kayıt listesi
  listeUst: { paddingHorizontal: bosluk.md, gap: 2 },
  listeBaslik: { ...tipografi.h2, color: r.metin },
  listeNot: { ...tipografi.caption, color: r.metinSolgun },
  listeGovde: { paddingHorizontal: bosluk.md, paddingBottom: bosluk.md, gap: 6 },
  kayitSatir: {
    flexDirection: 'row', alignItems: 'center', gap: bosluk.sm, minHeight: 58,
    paddingHorizontal: bosluk.sm, borderRadius: kose.md,
    borderWidth: 1, borderColor: r.cizgiSolgun, backgroundColor: r.yuzey,
  },
  kayitSira: { ...tipografi.caption, color: r.metinSolgun, width: 22, textAlign: 'right', fontVariant: ['tabular-nums'] },
  kayitAd: { ...tipografi.bodyOrta, color: r.metin },
  kayitAlt: { ...tipografi.caption, color: r.metinSolgun },
  fotoSayi: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  fotoSayiMetin: { ...tipografi.captionOrta, color: r.metinIkincil },
  listeEylem: {
    padding: bosluk.md, borderTopWidth: 1, borderTopColor: r.cizgiSolgun,
    backgroundColor: r.bgYukseltilmis,
  },
});
