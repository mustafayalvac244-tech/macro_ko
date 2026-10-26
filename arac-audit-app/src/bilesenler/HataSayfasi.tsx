import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';

import { GRUP_SIMGELERI, S } from '@/bilesenler/simgeler';
import { AramaKutusu, DereceRozeti, Dugme, Girdi, HataKutusu, Secenek } from '@/bilesenler/temel';
import { fotografKucult } from '@/cekirdek/goruntu';
import { aramaEslesir, aramaMetni } from '@/cekirdek/arama';
import { HATA_GRUPLARI, PARCA_INDEKS, parcaHataTipleri, parcaTamAdi, DERECELER } from '@/cekirdek/katalog';
import {
  demeritDegeri, HAZIR_SORUMLULAR, NAS_SISTEMLERI, SINIFLAR, sinifDegeri, varsayilanSistem,
} from '@/cekirdek/nas';
import { DereceKodu, Hata, HataGrubuId, HataTipi, SinifKodu, SorunTipi } from '@/cekirdek/tipler';
import { bosluk, DOKUNMA, dereceRenkleri, kose, Renkler, tipografi, useTema } from '@/tema';
import { fotografKaydet, FotografKaydi, fotografSil } from '@/veri/depo';
import { useKatalog } from '@/veri/katalogDeposu';

export interface HataTaslagi extends Omit<Hata, 'id' | 'zaman'> {
  id?: string;
  zaman?: string;
}

/**
 * Hata kaydı sayfası.
 *
 * TASARIM SÖZÜ: bir hatayı kaydetmek en fazla üç dokunuş — parçaya dokun,
 * hata tipini seç, Kaydet. Şiddet hata tipinden ön seçilir; açıklama ve
 * fotoğraf isteğe bağlıdır.
 *
 * ADET VE KONUM KALDIRILDI (ürün sahibi, 24.10.2026: şirketteki Excel formunda
 * yoklar, "gereksiz bilgileri sil"). Aynı hata iki yerdeyse iki kayıt girilir;
 * yer gerekiyorsa açıklamaya yazılır. Eski bir kayıtta dolu olabilirler:
 * düzenleyip kaydetmek onları SİLMEZ (taslaktan olduğu gibi geçer) ve rapor
 * onları yazmaya devam eder.
 *
 * EXCEL ALANLARI (26.10.2026, ürün sahibi: "içeriği buna göre yap, Excel'de
 * her şey var"): DEMERIT 0–3 (varsayılan 0, Excel formu da 0 ile açılıyor),
 * CLASS MINOR/MAJOR/MAIN (varsayılan MINOR), SYSTEM (parça ve tipten önerilir,
 * değiştirilebilir), RESPONSIBLE (Excel'deki hazır liste + serbest yazım).
 * "Kabul edilebilir" anahtarı kalktı: Excel'de yok, karşılığı demerit 0.
 * Hata tipi seçmek demerit'i DEĞİŞTİRMEZ — Excel'de tipin önerilen puanı yok.
 *
 * ARAMA VE "YENİ TİP" NEDEN BURADA: bir dış panelde 37 hata tipi listeleniyor;
 * kaydırarak aramak üç dokunuş sözünü bozar. Arama kutusu listeyi tek yazışta
 * daraltır. Eşleşme çıkmazsa aynı kutu "bu adla yeni tip ekle" düğmesine
 * dönüşür — denetçi gördüğü hatayı yazar, kaydeder, devam eder. Kod
 * değişikliği beklemek zorunda kalmaz.
 */
export function HataSayfasi({
  denetimId, denetci, taslak, fotograflar, onKapat, onKaydet, onSil,
}: {
  denetimId: string;
  denetci?: string;
  taslak: HataTaslagi | null;
  fotograflar: FotografKaydi[];
  onKapat: () => void;
  onKaydet: (h: HataTaslagi, yeniFotoIdleri: string[]) => void;
  onSil?: (hataId: string) => void;
}) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const ozelTipler = useKatalog((d) => d.ozelTipler);
  const tipEkle = useKatalog((d) => d.ekle);

  const [hataTipiId, setHataTipiId] = useState<string | null>(null);
  const [derece, setDerece] = useState<DereceKodu>('0');
  const [sinif, setSinif] = useState<SinifKodu>('MINOR');
  const [sistem, setSistem] = useState('');
  /** Sistem elle seçildiyse tip değişince önerilenle EZİLMEZ. */
  const [sistemElle, setSistemElle] = useState(false);
  const [sorunTipi, setSorunTipi] = useState<SorunTipi>('Part');
  const [sorumlu, setSorumlu] = useState('');
  const [aciklama, setAciklama] = useState('');
  const [fotoIdleri, setFotoIdleri] = useState<string[]>([]);
  const [fotoHatasi, setFotoHatasi] = useState<string | null>(null);
  const [fotoYukleniyor, setFotoYukleniyor] = useState(false);
  const [acilanTaslak, setAcilanTaslak] = useState<HataTaslagi | null>(null);
  const [arama, setArama] = useState('');
  const [yeniAcik, setYeniAcik] = useState(false);
  /** Tip ızgarası açık mı? Düzenlemede katlı başlar ("Değiştir" ile açılır). */
  const [tipAcik, setTipAcik] = useState(true);
  const [silOnay, setSilOnay] = useState(false);
  // Onay kutusu kaydırmanın EN ALTINDA açılır; kendiliğinden kaydırılmazsa
  // "Evet, sil" alttaki Vazgeç/Kaydet çubuğunun arkasında kalıyordu
  // (uçtan uca sınamanın ekran görüntüsü, 28.09.2026).
  const kaydirma = useRef<ScrollView>(null);
  const onayaKaydir = useRef(false);

  // Sayfa her açılışta taslaktan doldurulur. useEffect yerine render sırasında
  // karşılaştırma: taslak değiştiği anda alanlar doğru değerle çizilsin.
  if (taslak && taslak !== acilanTaslak) {
    setAcilanTaslak(taslak);
    setHataTipiId(taslak.hataTipiId || null);
    // Eski "kabul edilebilir" kayıt düzenlenince demerit 0 görünür ve öyle kaydedilir.
    setDerece(String(demeritDegeri(taslak)) as DereceKodu);
    setSinif(sinifDegeri(taslak));
    setSistem(taslak.sistem || (taslak.hataTipiId ? varsayilanSistem(taslak.parcaId, taslak.hataTipiId) : ''));
    setSistemElle(!!taslak.sistem);
    setSorunTipi(taslak.sorunTipi === 'Complex' ? 'Complex' : 'Part');
    setSorumlu(taslak.sorumlu ?? '');
    setAciklama(taslak.aciklama ?? '');
    setFotoIdleri(taslak.fotograflar ?? []);
    setFotoHatasi(null);
    setArama('');
    setYeniAcik(false);
    setTipAcik(!taslak.id);
    setSilOnay(false);
  }

  const parca = taslak ? PARCA_INDEKS[taslak.parcaId] : undefined;
  // ozelTipler bağımlılıkta: yeni tip eklendiğinde liste anında tazelensin.
  const tipler = useMemo(
    () => (taslak ? parcaHataTipleri(taslak.parcaId) : []),
    [taslak, ozelTipler],
  );

  const q = arama.trim();
  const suzulmus = useMemo(
    () => (q ? tipler.filter((t) => aramaEslesir(aramaMetni(t.ad, t.en), q)) : tipler),
    [q, tipler],
  );
  const gruplar = useMemo(() => [...new Set(suzulmus.map((t) => t.grup))], [suzulmus]);
  const duzenleme = !!taslak?.id;

  const tipSec = useCallback((t: HataTipi) => {
    setHataTipiId(t.id);
    if (!sistemElle && taslak) setSistem(varsayilanSistem(taslak.parcaId, t.id));
  }, [sistemElle, taslak]);

  const fotografEkle = useCallback(async (kameradan: boolean) => {
    setFotoHatasi(null);
    setFotoYukleniyor(true);
    try {
      const izin = kameradan
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!izin.granted) {
        setFotoHatasi(kameradan
          ? 'Kamera izni verilmedi. Ayarlar → Uygulamalar üzerinden açabilirsiniz.'
          : 'Galeri izni verilmedi.');
        return;
      }
      const sonuc = kameradan
        ? await ImagePicker.launchCameraAsync({ quality: 1, exif: false })
        : await ImagePicker.launchImageLibraryAsync({ quality: 1, allowsMultipleSelection: true });
      if (sonuc.canceled) return;

      const yeniler: string[] = [];
      for (const varlik of sonuc.assets) {
        const kucuk = await fotografKucult(varlik.uri);
        const kayit = await fotografKaydet(denetimId, taslak?.id ?? null, kucuk.uri, kucuk.en, kucuk.boy);
        yeniler.push(kayit.id);
      }
      setFotoIdleri((o) => [...o, ...yeniler]);
    } catch (h) {
      setFotoHatasi(h instanceof Error ? h.message : String(h));
    } finally {
      setFotoYukleniyor(false);
    }
  }, [denetimId, taslak?.id]);

  const fotografiKaldir = useCallback(async (id: string) => {
    setFotoIdleri((o) => o.filter((x) => x !== id));
    await fotografSil(id).catch(() => { /* kayıt zaten yok */ });
  }, []);

  const kaydet = useCallback(() => {
    if (!taslak || !hataTipiId) return;
    onKaydet({
      ...taslak,
      hataTipiId,
      derece,
      kabulEdilebilir: false,
      sinif,
      sistem: sistem || varsayilanSistem(taslak.parcaId, hataTipiId),
      sorunTipi,
      sorumlu: sorumlu.trim(),
      adet: taslak.adet || 1,
      konum: taslak.konum ?? '',
      aciklama: aciklama.trim(),
      fotograflar: fotoIdleri,
    }, fotoIdleri);
  }, [aciklama, fotoIdleri, hataTipiId, onKaydet, derece, sinif, sistem, sorumlu, sorunTipi, taslak]);

  const fotoHaritasi = useMemo(
    () => new Map(fotograflar.map((f) => [f.id, f])),
    [fotograflar],
  );

  if (!taslak) return null;

  const seciliTip = tipler.find((t) => t.id === hataTipiId);

  // --- BÖLÜMLER ----------------------------------------------------------
  // Yeni kayıtta sıra: hata tipi → derece → ayrıntı. VAR OLAN kaydı
  // düzenlerken sıra tersine döner: derece en üstte, 37 kutuluk tip ızgarası
  // katlı. Kullanılabilirlik sınamasında (üç ajan, 28.09.2026) derecesini
  // düzeltmek için telefonda ~650 px kaydırmak gerekiyordu (DERECE y=1370).

  const tipBolumu = !tipAcik ? (
    <View style={s.tipOzet}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={s.bolumBaslik}>Hata tipi</Text>
        <Text style={s.tipOzetAd} numberOfLines={2}>{seciliTip?.ad ?? taslak.hataTipiId}</Text>
      </View>
      <Dugme metin="Değiştir" kucuk onPress={() => setTipAcik(true)} erisimEtiketi="Hata tipini değiştir" />
    </View>
  ) : (
    <>
      <Text style={s.bolumBaslik}>Hata tipi</Text>

      <AramaKutusu
        deger={arama}
        degistir={setArama}
        yerTutucu="Hata ara — gıcırtı, göçük, boşluk…"
        erisimEtiketi="Hata tipi ara"
      />

      {yeniAcik ? (
        <YeniTipFormu
          baslangicAd={arama.trim()}
          izinliGruplar={parca?.gruplar ?? []}
          onVazgec={() => setYeniAcik(false)}
          onEkle={async (girdi) => {
            const t = await tipEkle({ ...girdi, ekleyen: denetci?.trim() ?? '' });
            setYeniAcik(false);
            setArama('');
            tipSec(t);
          }}
        />
      ) : null}

      {!yeniAcik && gruplar.map((g) => (
        <View key={g} style={{ gap: bosluk.xxs }}>
          <GrupBasligi grup={g} />
          <View style={s.izgara}>
            {suzulmus.filter((t) => t.grup === g).map((t) => {
              const secili = hataTipiId === t.id;
              return (
                <Pressable
                  key={t.id}
                  accessibilityRole="radio"
                  aria-checked={secili}
                  accessibilityLabel={`${t.ad}${t.en ? ` (${t.en})` : ''}`}
                  onPress={() => tipSec(t)}
                  style={[s.secenek, secili && s.secenekSecili]}
                >
                  <View style={s.secenekSatir}>
                    <Text style={[s.secenekAd, secili && { color: renkler.birincil }]} numberOfLines={2}>
                      {t.ad}
                    </Text>
                    {/* Ekip eklemesi olduğu hem işaretle hem metinle belli
                        olsun: yalnız renkle ayırmak erişilebilir değil. */}
                    {t.ozel ? <Text style={s.ozelIsaret}>Ekip</Text> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      {!yeniAcik && suzulmus.length === 0 ? (
        <Text style={s.bos}>
          {q ? `"${arama.trim()}" listede yok.` : 'Bu parça için tanımlı hata tipi yok.'}
        </Text>
      ) : null}

      {!yeniAcik ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={q ? `"${arama.trim()}" adıyla yeni hata tipi ekle` : 'Yeni hata tipi ekle'}
          onPress={() => setYeniAcik(true)}
          style={[s.yeniDugme, suzulmus.length === 0 && { borderColor: renkler.birincil }]}
        >
          <S.ekle size={18} color={renkler.birincil} strokeWidth={2.25} />
          <Text style={s.yeniDugmeMetin}>
            {q ? `"${arama.trim()}" adıyla yeni hata tipi ekle` : 'Yeni hata tipi ekle'}
          </Text>
        </Pressable>
      ) : null}
    </>
  );

  const dereceBolumu = (
    <>
      <Text style={s.bolumBaslik}>Demerit — 0 skora girmez, 3 en ağır</Text>
      <DereceSecici derece={derece} onSec={setDerece} />
      <Text style={s.bolumBaslik}>Class</Text>
      <SinifSecici sinif={sinif} onSec={setSinif} />
    </>
  );

  const ayrintiBolumu = (
    <>
      <Text style={s.bolumBaslik}>Tür</Text>
      <View style={s.izgara}>
        {(['Part', 'Complex'] as const).map((tur) => (
          <Secenek
            key={tur}
            metin={tur}
            erisimEtiketi={`Tür ${tur}`}
            secili={sorunTipi === tur}
            onPress={() => setSorunTipi(tur)}
            style={{ flexGrow: 1, flexBasis: 120 }}
          />
        ))}
      </View>

      <Text style={s.bolumBaslik}>System</Text>
      <View style={s.izgara}>
        {NAS_SISTEMLERI.map((x) => (
          <Secenek
            key={x}
            kucuk
            metin={x}
            erisimEtiketi={`System ${x}`}
            secili={sistem === x}
            onPress={() => { setSistem(x); setSistemElle(true); }}
            style={{ flexGrow: 1, flexBasis: 100, justifyContent: 'center' }}
          />
        ))}
      </View>

      <Text style={s.bolumBaslik}>Responsible</Text>
      <View style={s.izgara}>
        {HAZIR_SORUMLULAR.map((x) => (
          <Secenek
            key={x}
            kucuk
            metin={x}
            erisimEtiketi={`Responsible ${x}`}
            secili={sorumlu.trim() === x}
            onPress={() => setSorumlu(sorumlu.trim() === x ? '' : x)}
            style={{ flexGrow: 1, flexBasis: 100, justifyContent: 'center' }}
          />
        ))}
      </View>
      <Girdi
        value={sorumlu}
        onChangeText={setSorumlu}
        placeholder="Listede yoksa yazın — örn. tedarikçi adı"
        accessibilityLabel="Sorumlu (serbest yazım)"
        ipucu={sorunTipi === 'Part'
          ? 'Part hatasında seçilen sorumlu bu parçaya öğrenilir; sonraki kayıtlarda kendiliğinden gelir.'
          : 'Complex hatanın sorumlusu parçaya öğrenilmez.'}
      />

      <Girdi etiket="Açıklama" value={aciklama} onChangeText={setAciklama} placeholder="İsteğe bağlı" multiline />
    </>
  );

  const fotoBolumu = (
    <>
      <Text style={s.bolumBaslik}>Fotoğraf — Excel’e otomatik gömülür</Text>
      {fotoHatasi ? <HataKutusu metin={fotoHatasi} /> : null}
      <View style={s.fotoSerit}>
        {fotoIdleri.map((id) => {
          const f = fotoHaritasi.get(id);
          return (
            <View key={id} style={s.fotoKutu}>
              {f ? <Image source={{ uri: f.uri }} style={s.fotoGorsel} /> : null}
              <Pressable
                accessibilityRole="button" accessibilityLabel="Fotoğrafı sil"
                onPress={() => fotografiKaldir(id)}
                style={s.fotoSil}
              >
                <S.kapat size={16} color={renkler.tersMetin} strokeWidth={2.5} />
              </Pressable>
            </View>
          );
        })}
        <Pressable
          accessibilityRole="button" accessibilityLabel="Fotoğraf çek"
          onPress={() => fotografEkle(true)}
          disabled={fotoYukleniyor}
          style={s.fotoEkle}
        >
          {fotoYukleniyor ? <ActivityIndicator color={renkler.birincil} /> : (
            <>
              <S.kamera size={22} color={renkler.birincil} strokeWidth={2} />
              <Text style={s.fotoEkleMetin}>Çek</Text>
            </>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button" accessibilityLabel="Galeriden seç"
          onPress={() => fotografEkle(false)}
          disabled={fotoYukleniyor}
          style={s.fotoEkle}
        >
          <S.galeri size={22} color={renkler.birincil} strokeWidth={2} />
          <Text style={s.fotoEkleMetin}>Galeri</Text>
        </Pressable>
      </View>
    </>
  );

  // SİLME İKİ ADIMLI ve Kaydet/Vazgeç'ten UZAKTA. Önceden "Sil" (51×48)
  // "Vazgeç"in 8 px yanındaydı ve tek dokunuşla, onaysız siliyordu (sınama).
  // Geri almak yerine onay: silme kaydın fotoğraflarını da siliyor
  // (hataSil), geri getirilemez.
  const silBolumu = duzenleme && onSil ? (
    <View style={s.silBolumu}>
      {!silOnay ? (
        <Dugme metin="Bu kaydı sil" simge={S.sil} onPress={() => { onayaKaydir.current = true; setSilOnay(true); }} erisimEtiketi="Bu kaydı sil" />
      ) : (
        <View style={s.silOnayKutu}>
          <Text style={s.silOnayMetin}>
            {fotoIdleri.length
              ? `Kayıt ve ${fotoIdleri.length} fotoğrafı silinecek. Geri alınamaz.`
              : 'Kayıt silinecek. Geri alınamaz.'}
          </Text>
          <View style={s.ikiliSatir}>
            <Dugme metin="Vazgeç" tur="sessiz" onPress={() => setSilOnay(false)} style={{ flex: 1 }} erisimEtiketi="Silmekten vazgeç" />
            <Dugme metin="Evet, sil" tur="tehlike" simge={S.sil} onPress={() => taslak.id && onSil(taslak.id)} style={{ flex: 1 }} />
          </View>
        </View>
      )}
    </View>
  ) : null;

  return (
    <>
      <View style={s.baslikSatiri}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.parcaAd} numberOfLines={1}>{parca ? parcaTamAdi(parca.id) : taslak.parcaId}</Text>
          <Text style={s.parcaYol} numberOfLines={1}>{parca?.bolgeAd}</Text>
        </View>
        {hataTipiId ? <DereceRozeti derece={derece} kabul={false} buyuk /> : null}
      </View>

      <ScrollView
        ref={kaydirma}
        style={s.kaydir}
        contentContainerStyle={s.kaydirIc}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => {
          if (!onayaKaydir.current) return;
          onayaKaydir.current = false;
          kaydirma.current?.scrollToEnd({ animated: true });
        }}
      >
        {duzenleme ? (
          <>
            {dereceBolumu}
            {ayrintiBolumu}
            {fotoBolumu}
            {tipBolumu}
            {silBolumu}
          </>
        ) : (
          <>
            {tipBolumu}
            {dereceBolumu}
            {ayrintiBolumu}
            {fotoBolumu}
          </>
        )}
      </ScrollView>

      <View style={s.eylemler}>
        <Dugme metin="Vazgeç" tur="sessiz" onPress={onKapat} style={{ flex: 1 }} />
        <Dugme metin="Kaydet" tur="birincil" pasif={!hataTipiId} onPress={kaydet} style={{ flex: 1 }} />
      </View>
    </>
  );
}

/**
 * Yeni hata tipi formu.
 *
 * Grup seçimi PARÇANIN İZİN VERDİĞİ gruplarla sınırlıdır. Aksi hâlde denetçi
 * "cam" grubuna bir tip ekler, kapı sacında aramaya devam eder ve eklediği
 * şeyi bulamaz — eklediğini sanıp kaydetmeden geçer.
 */
export function YeniTipFormu({
  baslangicAd, izinliGruplar, onEkle, onVazgec,
}: {
  baslangicAd: string;
  izinliGruplar: HataGrubuId[];
  onEkle: (g: { grup: HataGrubuId; ad: string; en: string; derece: DereceKodu }) => Promise<void>;
  onVazgec: () => void;
}) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const [ad, setAd] = useState(baslangicAd);
  const [en, setEn] = useState('');
  const [grup, setGrup] = useState<HataGrubuId | null>(izinliGruplar[0] ?? null);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const gonder = async () => {
    if (!ad.trim() || !grup) return;
    setKaydediliyor(true);
    setHata(null);
    try {
      // Önerilen derece seçimi kalktı (26.10.2026): Excel'de tipin önerilen
      // puanı yok, demerit kayıtta seçilir. Alan veri modelinde duruyor.
      await onEkle({ grup, ad: ad.trim(), en: en.trim(), derece: '0' });
    } catch (h) {
      setHata(h instanceof Error ? h.message : String(h));
    } finally {
      setKaydediliyor(false);
    }
  };

  return (
    <View style={s.yeniKart}>
      <Text style={s.yeniBaslik}>Yeni hata tipi</Text>
      <Text style={s.yeniNot}>
        Eklediğiniz tip bu parçada ve aynı gruptaki tüm parçalarda kalıcı olarak listelenir.
      </Text>

      {hata ? <HataKutusu metin={hata} /> : null}

      <Girdi etiket="Adı (Türkçe)" value={ad} onChangeText={setAd} placeholder="Örn. Fitil ucu kalkık" />
      {/* İngilizcesi boş bırakılınca İngilizce raporda Türkçe ad çıkıyordu
          ("Front bumper hare" — sınama, 28.09.2026). Zorunlu yapılmadı:
          denetçi hattayken İngilizce aramasın; ama ne olacağı yazılı. */}
      <Girdi
        etiket="İngilizcesi (rapor için)"
        value={en}
        onChangeText={setEn}
        placeholder="Örn. Weatherstrip lifted"
        ipucu={en.trim() ? undefined : 'Boş kalırsa İngilizce raporda Türkçe adı yazılır.'}
      />

      <Text style={s.alanEtiketi}>Grup</Text>
      <View style={s.izgara}>
        {izinliGruplar.map((g) => (
          <Secenek
            key={g}
            metin={HATA_GRUPLARI[g]?.ad ?? g}
            simge={GRUP_SIMGELERI[g]}
            secili={grup === g}
            onPress={() => setGrup(g)}
            style={{ flexGrow: 1, flexBasis: 150, justifyContent: 'flex-start' }}
          />
        ))}
      </View>

      <View style={s.yeniEylemler}>
        <Dugme metin="Vazgeç" tur="sessiz" kucuk onPress={onVazgec} style={{ flex: 1 }} />
        <Dugme
          metin="Ekle ve seç"
          tur="birincil"
          kucuk
          yukleniyor={kaydediliyor}
          pasif={!ad.trim() || !grup}
          onPress={gonder}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}

/**
 * Demerit seçici: 0 · 1 · 2 · 3 (Excel'deki sırayla; 0 skora girmez). Seçili
 * olan kendi rengiyle DOLU çizilir, diğerleri boş kutuda yalnız rakamı renkli
 * taşır. Seçim yalnız renkle değil dolu/boş farkıyla da okunur; rakam her
 * zaman yazılıdır. Kontrastlar ölçüldü (1–3: 27.09.2026; 0: 26.10.2026),
 * iki temada: seçili rakam en az 5.28:1, seçili olmayan rakam kendi zemininde
 * en az 5.28:1; 0 için 6.67:1 ve 5.72:1.
 */
const DEMERIT_SIRASI = [...DERECELER].sort((a, b) => a.id.localeCompare(b.id));

export function DereceSecici({
  derece, onSec, etiketOnEki = 'Demerit', kucuk = false,
}: {
  derece: DereceKodu;
  onSec: (d: DereceKodu) => void;
  /** Aynı ekranda iki derece seçici varsa ekran okuyucu ayırt etsin diye. */
  etiketOnEki?: string;
  kucuk?: boolean;
}) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  return (
    <View style={s.dereceSatir}>
      {DEMERIT_SIRASI.map((d) => {
        const secili = derece === d.id;
        const { on } = dereceRenkleri(renkler, d.id);
        return (
          <Pressable
            key={d.id}
            accessibilityRole="radio"
            aria-checked={secili}
            accessibilityLabel={`${etiketOnEki} ${d.ad}`}
            onPress={() => onSec(d.id)}
            style={({ pressed }) => [
              s.dereceDugme, kucuk && s.dereceDugmeKucuk,
              secili ? { backgroundColor: on, borderColor: on } : null,
              pressed && { opacity: 0.72 },
            ]}
          >
            <Text style={[kucuk ? s.dereceRakamKucuk : s.dereceRakam, { color: secili ? renkler.metinTers : on }]}>
              {d.ad}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Excel CLASS seçici: MINOR · MAJOR · MAIN. */
export function SinifSecici({ sinif, onSec }: { sinif: SinifKodu; onSec: (c: SinifKodu) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: bosluk.xs }} accessibilityRole="radiogroup" accessibilityLabel="Class">
      {SINIFLAR.map((c) => (
        <Secenek
          key={c}
          kucuk
          metin={c}
          erisimEtiketi={`Class ${c}`}
          secili={sinif === c}
          onPress={() => onSec(c)}
          style={{ flex: 1, justifyContent: 'center' }}
        />
      ))}
    </View>
  );
}

/** Hata grubu başlığı — simge okumadan tanımayı sağlar, 37 kutu arasında göz grubu bulur. */
export function GrupBasligi({ grup }: { grup: HataGrubuId }) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const Ikon = GRUP_SIMGELERI[grup];
  return (
    <View style={s.grupSatir}>
      {Ikon ? <Ikon size={15} color={renkler.metinIkincil} strokeWidth={2} /> : null}
      <Text style={s.grupBaslik}>{HATA_GRUPLARI[grup]?.ad ?? grup}</Text>
    </View>
  );
}

const stiller = (r: Renkler) => StyleSheet.create({
  baslikSatiri: {
    flexDirection: 'row', alignItems: 'center', gap: bosluk.sm,
    paddingHorizontal: bosluk.md, paddingVertical: bosluk.xs,
  },
  parcaAd: { ...tipografi.h2, color: r.metin },
  parcaYol: { ...tipografi.caption, color: r.metinSolgun },

  kaydir: { flexGrow: 0 },
  kaydirIc: { paddingHorizontal: bosluk.md, paddingBottom: bosluk.md, gap: bosluk.sm },

  bolumBaslik: { ...tipografi.etiket, color: r.metinSolgun, marginTop: bosluk.xs },
  grupSatir: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: bosluk.xxs },
  grupBaslik: { ...tipografi.captionOrta, color: r.metinIkincil },

  izgara: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  secenek: {
    flexGrow: 1, flexBasis: 148, minHeight: DOKUNMA, justifyContent: 'center',
    paddingHorizontal: bosluk.xs, paddingVertical: 6,
    borderRadius: kose.sm, borderWidth: 1, borderColor: r.cizgi, backgroundColor: r.yuzey,
  },
  secenekSecili: { borderColor: r.birincil, backgroundColor: r.birincilYumusak },
  secenekSatir: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  secenekAd: { ...tipografi.captionOrta, color: r.metin, flexShrink: 1 },
  ozelIsaret: {
    ...tipografi.caption, fontSize: 9, color: r.bilgi,
    borderWidth: 1, borderColor: r.bilgi, borderRadius: kose.sm,
    paddingHorizontal: 4, overflow: 'hidden',
  },

  bos: { ...tipografi.body, color: r.metinSolgun, paddingVertical: bosluk.xs },

  yeniDugme: {
    flexDirection: 'row', gap: bosluk.xs,
    minHeight: DOKUNMA, alignItems: 'center', justifyContent: 'center',
    borderRadius: kose.md, borderWidth: 1, borderStyle: 'dashed',
    borderColor: r.cizgiGuclu, backgroundColor: r.yuzey, paddingHorizontal: bosluk.sm,
  },
  yeniDugmeMetin: { ...tipografi.bodyOrta, color: r.birincil, textAlign: 'center' },

  yeniKart: {
    gap: bosluk.xs, padding: bosluk.sm, borderRadius: kose.md,
    borderWidth: 1, borderColor: r.birincil, backgroundColor: r.birincilYumusak,
  },
  yeniBaslik: { ...tipografi.h3, color: r.metin },
  yeniNot: { ...tipografi.caption, color: r.metinIkincil },
  yeniEylemler: { flexDirection: 'row', gap: bosluk.xs, marginTop: bosluk.xxs },

  ikiliSatir: { flexDirection: 'row', gap: bosluk.xs, alignItems: 'flex-end' },
  alanEtiketi: { ...tipografi.caption, color: r.metinIkincil },
  fotoSerit: { flexDirection: 'row', flexWrap: 'wrap', gap: bosluk.xs },
  fotoKutu: {
    width: 84, height: 84, borderRadius: kose.sm, overflow: 'hidden',
    borderWidth: 1, borderColor: r.cizgi,
  },
  fotoGorsel: { width: '100%', height: '100%' },
  fotoSil: {
    position: 'absolute', top: 2, right: 2, width: 26, height: 26,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: kose.sm, backgroundColor: r.perde,
  },
  fotoEkle: {
    width: 84, height: 84, alignItems: 'center', justifyContent: 'center', gap: 4,
    borderRadius: kose.sm, borderWidth: 1, borderStyle: 'dashed',
    borderColor: r.cizgiGuclu, backgroundColor: r.yuzey,
  },
  fotoEkleMetin: { ...tipografi.captionOrta, color: r.metinIkincil, textAlign: 'center' },

  dereceSatir: { flexDirection: 'row', gap: bosluk.xs },
  dereceDugme: {
    flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center',
    borderRadius: kose.md, borderWidth: 1.5, borderColor: r.cizgi, backgroundColor: r.yuzey,
  },
  dereceDugmeKucuk: { minHeight: DOKUNMA },
  dereceRakam: { ...tipografi.h1, fontSize: 26, lineHeight: 32 },
  dereceRakamKucuk: { ...tipografi.h3 },

  tipOzet: {
    flexDirection: 'row', alignItems: 'center', gap: bosluk.sm, marginTop: bosluk.xs,
    padding: bosluk.sm, borderRadius: kose.md,
    borderWidth: 1, borderColor: r.cizgi, backgroundColor: r.yuzey,
  },
  tipOzetAd: { ...tipografi.bodyOrta, color: r.metin },

  silBolumu: { marginTop: bosluk.lg, paddingTop: bosluk.md, borderTopWidth: 1, borderTopColor: r.cizgiSolgun },
  silOnayKutu: {
    gap: bosluk.sm, padding: bosluk.sm, borderRadius: kose.md,
    borderWidth: 1, borderColor: r.tehlike, backgroundColor: r.tehlikeYumusak,
  },
  silOnayMetin: { ...tipografi.bodyOrta, color: r.tehlike },

  eylemler: {
    flexDirection: 'row', gap: bosluk.xs, padding: bosluk.md,
    borderTopWidth: 1, borderTopColor: r.cizgiSolgun, backgroundColor: r.bgYukseltilmis,
  },
});
