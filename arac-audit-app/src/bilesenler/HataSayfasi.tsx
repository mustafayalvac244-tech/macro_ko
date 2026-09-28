import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View, ViewStyle,
} from 'react-native';

import { GRUP_SIMGELERI, S } from '@/bilesenler/simgeler';
import { AramaKutusu, DereceRozeti, Dugme, Girdi, HataKutusu, Secenek } from '@/bilesenler/temel';
import { fotografKucult } from '@/cekirdek/goruntu';
import { aramaEslesir, aramaMetni } from '@/cekirdek/arama';
import { HATA_GRUPLARI, PARCA_INDEKS, parcaHataTipleri, parcaTamAdi, DERECELER } from '@/cekirdek/katalog';
import { DereceKodu, Hata, HataGrubuId, HataTipi, SorunTipi } from '@/cekirdek/tipler';
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
 * hata tipini seç, Kaydet. Şiddet hata tipinden ön seçilir; adet, konum,
 * açıklama ve fotoğraf isteğe bağlıdır.
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
  const [derece, setDerece] = useState<DereceKodu>('1');
  const [kabul, setKabul] = useState(false);
  const [sorunTipi, setSorunTipi] = useState<SorunTipi>('Part');
  const [sorumlu, setSorumlu] = useState('');
  const [adet, setAdet] = useState('1');
  const [konum, setKonum] = useState('');
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
    setDerece(taslak.derece || '1');
    setKabul(!!taslak.kabulEdilebilir);
    setSorunTipi(taslak.sorunTipi === 'Complex' ? 'Complex' : 'Part');
    setSorumlu(taslak.sorumlu ?? '');
    setAdet(String(taslak.adet || 1));
    setKonum(taslak.konum ?? '');
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
    if (!duzenleme) setDerece(t.derece);
  }, [duzenleme]);

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
      kabulEdilebilir: kabul,
      sorunTipi,
      sorumlu: sorumlu.trim(),
      adet: Math.max(1, Math.min(99, Number(adet) || 1)),
      konum: konum.trim(),
      aciklama: aciklama.trim(),
      fotograflar: fotoIdleri,
    }, fotoIdleri);
  }, [aciklama, adet, fotoIdleri, hataTipiId, kabul, konum, onKaydet, derece, sorumlu, sorunTipi, taslak]);

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
        <Text style={s.bolumBaslik}>HATA TİPİ</Text>
        <Text style={s.tipOzetAd} numberOfLines={2}>{seciliTip?.ad ?? taslak.hataTipiId}</Text>
      </View>
      <Dugme metin="Değiştir" kucuk onPress={() => setTipAcik(true)} erisimEtiketi="Hata tipini değiştir" />
    </View>
  ) : (
    <>
      <Text style={s.bolumBaslik}>HATA TİPİ</Text>

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
                    {t.ozel ? <Text style={s.ozelIsaret}>EKİP</Text> : null}
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
      <Text style={s.bolumBaslik}>DERECE — 3 EN AĞIR</Text>
      <DereceSecici derece={derece} onSec={setDerece} />
      <KabulAnahtari kabul={kabul} derece={derece} onDegis={setKabul} />
    </>
  );

  const ayrintiBolumu = (
    <>
      <Text style={s.bolumBaslik}>TÜR</Text>
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

      <Girdi
        etiket="SORUMLU"
        value={sorumlu}
        onChangeText={setSorumlu}
        placeholder="Örn. HMTR PD (tedarikçi)"
        ipucu={sorunTipi === 'Part'
          ? 'Part hatasında yazılan sorumlu bu parçaya öğrenilir; sonraki kayıtlarda kendiliğinden gelir.'
          : 'Complex hatanın sorumlusu parçaya öğrenilmez.'}
      />

      <View style={s.adetKonumSatir}>
        <View style={{ gap: bosluk.xxs }}>
          <Text style={s.alanEtiketi}>ADET</Text>
          <View style={s.adetKutu}>
            <Pressable
              accessibilityRole="button" accessibilityLabel="Adedi azalt"
              onPress={() => setAdet(String(Math.max(1, (Number(adet) || 1) - 1)))}
              style={s.adetDugme}
            >
              <S.azalt size={20} color={renkler.metin} strokeWidth={2.25} />
            </Pressable>
            <TextInput
              value={adet}
              onChangeText={setAdet}
              keyboardType="number-pad"
              accessibilityLabel="Adet"
              style={s.adetGirdi}
            />
            <Pressable
              accessibilityRole="button" accessibilityLabel="Adedi artır"
              onPress={() => setAdet(String(Math.min(99, (Number(adet) || 1) + 1)))}
              style={s.adetDugme}
            >
              <S.ekle size={20} color={renkler.metin} strokeWidth={2.25} />
            </Pressable>
          </View>
        </View>
        <View style={s.konumKutu}>
          <Girdi etiket="KONUM" value={konum} onChangeText={setKonum} placeholder="Örn. üst köşe" />
        </View>
      </View>

      <Girdi etiket="AÇIKLAMA" value={aciklama} onChangeText={setAciklama} placeholder="İsteğe bağlı" multiline />
    </>
  );

  const fotoBolumu = (
    <>
      <Text style={s.bolumBaslik}>FOTOĞRAF — EXCEL’E OTOMATİK GÖMÜLÜR</Text>
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
                <S.kapat size={16} color={renkler.cubukMetin} strokeWidth={2.5} />
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
        {hataTipiId ? <DereceRozeti derece={derece} kabul={kabul} buyuk /> : null}
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
  const [derece, setDerece] = useState<DereceKodu>('1');
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const gonder = async () => {
    if (!ad.trim() || !grup) return;
    setKaydediliyor(true);
    setHata(null);
    try {
      await onEkle({ grup, ad: ad.trim(), en: en.trim(), derece });
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

      <Girdi etiket="ADI (TÜRKÇE)" value={ad} onChangeText={setAd} placeholder="Örn. Fitil ucu kalkık" />
      {/* İngilizcesi boş bırakılınca İngilizce raporda Türkçe ad çıkıyordu
          ("Front bumper hare" — sınama, 28.09.2026). Zorunlu yapılmadı:
          denetçi hattayken İngilizce aramasın; ama ne olacağı yazılı. */}
      <Girdi
        etiket="İNGİLİZCESİ (RAPOR İÇİN)"
        value={en}
        onChangeText={setEn}
        placeholder="Örn. Weatherstrip lifted"
        ipucu={en.trim() ? undefined : 'Boş kalırsa İngilizce raporda Türkçe adı yazılır.'}
      />

      <Text style={s.alanEtiketi}>GRUP</Text>
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

      <Text style={s.alanEtiketi}>ÖNERİLEN DERECE</Text>
      {/* "Önerilen derece" öneki ŞART: çalışma ekranındaki DERECE seçimi de
          ekranda duruyor, aynı etiketle iki radyo ekran okuyucuda ayırt
          edilemez. */}
      <DereceSecici derece={derece} onSec={setDerece} etiketOnEki="Önerilen derece" kucuk />

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
 * "Kabul edilebilir" anahtarı. Açıkken derece parantezle yazılır: (3).
 *
 * Etiket anahtarın NE YAZDIRACAĞINI gösterir, yalnız açık/kapalı değil: denetçi
 * raporda "(3)" mü "3" mü çıkacağını kaydetmeden görsün. Parantez anlamı tersine
 * çeviriyor; yanlış basılırsa kabul edilmiş bulgu iş emri doğurur.
 */
export function KabulAnahtari({
  kabul, derece, onDegis, style,
}: { kabul: boolean; derece: DereceKodu; onDegis: (k: boolean) => void; style?: ViewStyle }) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  return (
    <Pressable
      accessibilityRole="switch"
      aria-checked={kabul}
      accessibilityLabel={`Kabul edilebilir — raporda ${kabul ? `(${derece})` : derece} yazılır`}
      onPress={() => onDegis(!kabul)}
      style={({ pressed }) => [s.kabulSatir, kabul && s.kabulSatirAcik, pressed && { opacity: 0.8 }, style]}
    >
      {/* Ray + topuz: açık/kapalı yalnız renkle değil TOPUZUN YERİYLE de okunur. */}
      <View style={[s.ray, kabul && s.rayAcik]}>
        <View style={[s.topuz, kabul && s.topuzAcik]} />
      </View>
      {/* İki satıra sarabilir: dikey tablette "Kabul e…" diye kesiliyordu. */}
      <Text style={[s.kabulMetin, { flex: 1 }]} numberOfLines={2}>Kabul edilebilir</Text>
      {/* "Raporda" etiketi: etiketsiz "(3)" kutusu ilk kez kullanana bir şey
          söylemiyordu (sınama, 28.09.2026). Kutu raporda yazılacak olanı gösterir. */}
      <View style={s.kabulOnizlemeKap}>
        <Text style={s.kabulOnizlemeEtiket}>Raporda</Text>
        <View style={[s.kabulOnizleme, kabul && s.kabulOnizlemeAcik]}>
          <Text style={s.kabulOnizlemeMetin}>{kabul ? `(${derece})` : derece}</Text>
        </View>
      </View>
    </Pressable>
  );
}

/**
 * Derece seçici: 3 · 2 · 1 (3 en ağır). Seçili olan kendi derece rengiyle DOLU
 * çizilir, diğerleri boş kutuda yalnız rakamı derece renginde taşır. Seçim
 * yalnız renkle değil dolu/boş farkıyla da okunur; rakam her zaman yazılıdır.
 * Kontrastlar ölçüldü (27.09.2026): seçili rakam en az 5.28:1, seçili olmayan
 * rakam kendi zemininde en az 5.28:1 — iki temada da.
 */
export function DereceSecici({
  derece, onSec, etiketOnEki = 'Derece', kucuk = false,
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
      {DERECELER.map((d) => {
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
  alanEtiketi: { ...tipografi.etiket, color: r.metinSolgun },
  // ADET SABİT GENİŞLİKTE. Önceden satırın üçte biriydi: iki 48'lik düğme ve
  // sayı sığmıyordu — web'de "+" KONUM'un altında kalıyor, telefonda sayıya yer
  // kalmıyordu (uçtan uca sınamanın ekran görüntüsü, 28.09.2026). Dar ekranda
  // KONUM alt satıra iner.
  adetKonumSatir: { flexDirection: 'row', flexWrap: 'wrap', gap: bosluk.xs, alignItems: 'flex-end' },
  konumKutu: { flexGrow: 1, flexBasis: 160, minWidth: 0 },
  adetKutu: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  adetDugme: {
    width: DOKUNMA, height: DOKUNMA, alignItems: 'center', justifyContent: 'center',
    borderRadius: kose.sm, borderWidth: 1, borderColor: r.cizgi, backgroundColor: r.yuzey,
  },
  adetGirdi: {
    width: 60, textAlign: 'center', ...tipografi.sayiBuyuk, color: r.metin,
    borderWidth: 1, borderColor: r.cizgi, borderRadius: kose.sm,
    backgroundColor: r.yuzey, minHeight: DOKUNMA,
  },

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

  kabulSatir: {
    flexDirection: 'row', alignItems: 'center', gap: bosluk.sm, minHeight: 60,
    paddingHorizontal: bosluk.sm, paddingVertical: 6, borderRadius: kose.md,
    borderWidth: 1, borderColor: r.cizgi, backgroundColor: r.yuzey,
  },
  kabulSatirAcik: { borderColor: r.birincil, backgroundColor: r.birincilYumusak },
  // Kapalı rayın kenarı metinSolgun: cizgiGuclu yüzeyde 2.58:1 idi, bir
  // denetim öğesinin sınırı için WCAG 1.4.11'in 3:1'inin altında (27.09.2026).
  ray: {
    width: 48, height: 28, borderRadius: kose.pill, borderWidth: 1.5, padding: 2,
    borderColor: r.metinSolgun, backgroundColor: r.yuzeyAlt, justifyContent: 'center',
  },
  rayAcik: { backgroundColor: r.birincil, borderColor: r.birincil },
  topuz: { width: 21, height: 21, borderRadius: kose.pill, backgroundColor: r.metinSolgun },
  topuzAcik: { backgroundColor: r.metinTers, alignSelf: 'flex-end' },
  kabulMetin: { ...tipografi.bodyOrta, color: r.metin },
  kabulOnizleme: {
    minWidth: 54, height: 40, paddingHorizontal: 6, borderRadius: kose.sm,
    borderWidth: 1.5, borderColor: r.cizgi, backgroundColor: r.yuzey,
    alignItems: 'center', justifyContent: 'center',
  },
  kabulOnizlemeAcik: { borderStyle: 'dashed', borderColor: r.birincil },
  kabulOnizlemeKap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kabulOnizlemeEtiket: { ...tipografi.caption, color: r.metinIkincil },
  kabulOnizlemeMetin: { ...tipografi.sayiBuyuk, fontSize: 22, lineHeight: 28, color: r.metin },

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
