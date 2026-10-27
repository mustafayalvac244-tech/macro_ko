import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';

import { GRUP_SIMGELERI, S } from '@/bilesenler/simgeler';
import { AramaKutusu, DereceRozeti, Dugme, Girdi, HataKutusu, Secenek, SegmentSecici } from '@/bilesenler/temel';
import { fotografKucult } from '@/cekirdek/goruntu';
import { aramaEslesir, aramaMetni } from '@/cekirdek/arama';
import { grupAdi, PARCA_INDEKS, parcaBolgeAdi, parcaCiftiAdi, parcaHataTipleri, parcaTamAdi, DERECELER } from '@/cekirdek/katalog';
import {
  demeritDegeri, HAZIR_SORUMLULAR, NAS_SISTEMLERI, SINIFLAR, sinifDegeri, varsayilanSistem,
} from '@/cekirdek/nas';
import { bicimTarih } from '@/cekirdek/rapor';
import { durumDegistir, TAKIP_DURUMLARI } from '@/cekirdek/takip';
import { DereceKodu, Hata, HataDurumu, HataGrubuId, HataTipi, SinifKodu, SorunTipi } from '@/cekirdek/tipler';
import { bosluk, DOKUNMA, dereceRenkleri, kose, Renkler, tipografi, useTema } from '@/tema';
import { fotografKaydet, FotografKaydi, fotografSil } from '@/veri/depo';
import { useDil } from '@/veri/dilDeposu';
import { fotografiKaliciyaAl } from '@/veri/fotografDeposu';
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
  const { dil, t } = useDil();
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
  // Takip (26.10.2026, takip.ts): yalnız var olan kayıt düzenlenirken görünür.
  const [takipDurum, setTakipDurum] = useState<HataDurumu>('acik');
  const [onlem, setOnlem] = useState('');
  const [dogrulamaBody, setDogrulamaBody] = useState('');
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
    setTakipDurum(taslak.durum ?? 'acik');
    setOnlem(taslak.onlem ?? '');
    setDogrulamaBody(taslak.dogrulamaBody ?? '');
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
    () => (q ? tipler.filter((x) => aramaEslesir(aramaMetni(x.ad, x.en), q)) : tipler),
    [q, tipler],
  );
  const gruplar = useMemo(() => [...new Set(suzulmus.map((x) => x.grup))], [suzulmus]);
  const duzenleme = !!taslak?.id;

  const tipSec = useCallback((tip: HataTipi) => {
    setHataTipiId(tip.id);
    if (!sistemElle && taslak) setSistem(varsayilanSistem(taslak.parcaId, tip.id));
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
          ? t(
            'Kamera izni verilmedi. Ayarlar → Uygulamalar üzerinden açabilirsiniz.',
            'Camera permission not granted. You can turn it on in Settings → Apps.',
          )
          : t('Galeri izni verilmedi.', 'Gallery permission not granted.'));
        return;
      }
      const sonuc = kameradan
        ? await ImagePicker.launchCameraAsync({ quality: 1, exif: false })
        : await ImagePicker.launchImageLibraryAsync({ quality: 1, allowsMultipleSelection: true });
      if (sonuc.canceled) return;

      const yeniler: string[] = [];
      for (const varlik of sonuc.assets) {
        const kucuk = await fotografKucult(varlik.uri);
        // Önbellekte bırakılırsa Android silebilir: belge klasörüne taşınır (fotografDeposu.ts).
        const kalici = await fotografiKaliciyaAl(kucuk.uri, `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`);
        const kayit = await fotografKaydet(denetimId, taslak?.id ?? null, kalici, kucuk.en, kucuk.boy);
        yeniler.push(kayit.id);
      }
      setFotoIdleri((o) => [...o, ...yeniler]);
    } catch (h) {
      setFotoHatasi(h instanceof Error ? h.message : String(h));
    } finally {
      setFotoYukleniyor(false);
    }
  }, [denetimId, taslak?.id, t]);

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
      ...durumDegistir(taslak, takipDurum, new Date().toISOString()),
      onlem: takipDurum === 'acik' ? '' : onlem.trim(),
      dogrulamaBody: takipDurum === 'kapali' ? dogrulamaBody.trim() : '',
      fotograflar: fotoIdleri,
    }, fotoIdleri);
  }, [aciklama, fotoIdleri, hataTipiId, onKaydet, derece, sinif, sistem, sorumlu, sorunTipi, taslak, takipDurum, onlem, dogrulamaBody]);

  const fotoHaritasi = useMemo(
    () => new Map(fotograflar.map((f) => [f.id, f])),
    [fotograflar],
  );

  if (!taslak) return null;

  const seciliTip = tipler.find((x) => x.id === hataTipiId);
  // Tipin arayüz dilindeki adı; İngilizcesi boş ekip tipi Türkçe adıyla görünür.
  const tipAdi = (x: HataTipi) => (dil === 'en' ? (x.en || x.ad) : x.ad);

  // --- BÖLÜMLER ----------------------------------------------------------
  // Yeni kayıtta sıra: hata tipi → derece → ayrıntı. VAR OLAN kaydı
  // düzenlerken sıra tersine döner: derece en üstte, 37 kutuluk tip ızgarası
  // katlı. Kullanılabilirlik sınamasında (üç ajan, 28.09.2026) derecesini
  // düzeltmek için telefonda ~650 px kaydırmak gerekiyordu (DERECE y=1370).

  const tipBolumu = !tipAcik ? (
    <View style={s.tipOzet}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={s.bolumBaslik}>{t('Hata tipi', 'Defect type')}</Text>
        <Text style={s.tipOzetAd} numberOfLines={2}>{(seciliTip && tipAdi(seciliTip)) ?? taslak.hataTipiId}</Text>
      </View>
      <Dugme
        metin={t('Değiştir', 'Change')}
        kucuk
        onPress={() => setTipAcik(true)}
        erisimEtiketi={t('Hata tipini değiştir', 'Change defect type')}
      />
    </View>
  ) : (
    <>
      <Text style={s.bolumBaslik}>{t('Hata tipi', 'Defect type')}</Text>

      <AramaKutusu
        deger={arama}
        degistir={setArama}
        yerTutucu={t('Hata ara — gıcırtı, göçük, boşluk…', 'Search defects — squeak, dent, gap…')}
        erisimEtiketi={t('Hata tipi ara', 'Search defect types')}
      />

      {yeniAcik ? (
        <YeniTipFormu
          baslangicAd={arama.trim()}
          izinliGruplar={parca?.gruplar ?? []}
          onVazgec={() => setYeniAcik(false)}
          onEkle={async (girdi) => {
            const yeniTip = await tipEkle({ ...girdi, ekleyen: denetci?.trim() ?? '' });
            setYeniAcik(false);
            setArama('');
            tipSec(yeniTip);
          }}
        />
      ) : null}

      {!yeniAcik && gruplar.map((g) => (
        <View key={g} style={{ gap: bosluk.xxs }}>
          <GrupBasligi grup={g} />
          <View style={s.izgara}>
            {suzulmus.filter((x) => x.grup === g).map((x) => {
              const secili = hataTipiId === x.id;
              return (
                <Pressable
                  key={x.id}
                  accessibilityRole="radio"
                  aria-checked={secili}
                  accessibilityLabel={dil === 'en' ? tipAdi(x) : `${x.ad}${x.en ? ` (${x.en})` : ''}`}
                  onPress={() => tipSec(x)}
                  style={[s.secenek, secili && s.secenekSecili]}
                >
                  <View style={s.secenekSatir}>
                    <Text style={[s.secenekAd, secili && { color: renkler.birincil }]} numberOfLines={2}>
                      {tipAdi(x)}
                    </Text>
                    {/* Ekip eklemesi olduğu hem işaretle hem metinle belli
                        olsun: yalnız renkle ayırmak erişilebilir değil. */}
                    {x.ozel ? <Text style={s.ozelIsaret}>{t('Ekip', 'Team')}</Text> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      {!yeniAcik && suzulmus.length === 0 ? (
        <Text style={s.bos}>
          {q
            ? t(`"${arama.trim()}" listede yok.`, `"${arama.trim()}" is not in the list.`)
            : t('Bu parça için tanımlı hata tipi yok.', 'No defect types defined for this part.')}
        </Text>
      ) : null}

      {!yeniAcik ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={q
            ? t(`"${arama.trim()}" adıyla yeni hata tipi ekle`, `Add new defect type "${arama.trim()}"`)
            : t('Yeni hata tipi ekle', 'Add new defect type')}
          onPress={() => setYeniAcik(true)}
          style={[s.yeniDugme, suzulmus.length === 0 && { borderColor: renkler.birincil }]}
        >
          <S.ekle size={18} color={renkler.birincil} strokeWidth={2.25} />
          <Text style={s.yeniDugmeMetin}>
            {q
              ? t(`"${arama.trim()}" adıyla yeni hata tipi ekle`, `Add new defect type "${arama.trim()}"`)
              : t('Yeni hata tipi ekle', 'Add new defect type')}
          </Text>
        </Pressable>
      ) : null}
    </>
  );

  const dereceBolumu = (
    <>
      <Text style={s.bolumBaslik}>{t('Demerit — 0 skora girmez, 3 en ağır', 'Demerit — 0 not scored, 3 = most severe')}</Text>
      <DereceSecici derece={derece} onSec={setDerece} />
      <Text style={s.bolumBaslik}>{t('Sınıf', 'Class')}</Text>
      <SinifSecici sinif={sinif} onSec={setSinif} />
    </>
  );

  const ayrintiBolumu = (
    <>
      <Text style={s.bolumBaslik}>{t('Tür', 'Type')}</Text>
      <View style={s.izgara}>
        {(['Part', 'Complex'] as const).map((tur) => (
          <Secenek
            key={tur}
            metin={tur === 'Part' ? t('Parça', 'Part') : t('Kompleks', 'Complex')}
            erisimEtiketi={t(`Tür ${tur === 'Part' ? 'Parça' : 'Kompleks'}`, `Type ${tur}`)}
            secili={sorunTipi === tur}
            onPress={() => setSorunTipi(tur)}
            style={{ flexGrow: 1, flexBasis: 120 }}
          />
        ))}
      </View>

      {/* Ekibin Excel'indeki SYSTEM sütunu (EXTERIOR, ELECTRIC…). Denetim ekranındaki
          Dış/İç bölümleriyle karışmasın diye "(Excel)" yazar. Kodlar Excel'deki gibi. */}
      <Text style={s.bolumBaslik}>{t('Sistem (Excel)', 'System')}</Text>
      <View style={s.izgara}>
        {NAS_SISTEMLERI.map((x) => (
          <Secenek
            key={x}
            kucuk
            metin={x}
            erisimEtiketi={t(`Sistem ${x}`, `System ${x}`)}
            secili={sistem === x}
            onPress={() => { setSistem(x); setSistemElle(true); }}
            style={{ flexGrow: 1, flexBasis: 100, justifyContent: 'center' }}
          />
        ))}
      </View>

      <Text style={s.bolumBaslik}>{t('Sorumlu', 'Responsible')}</Text>
      <View style={s.izgara}>
        {HAZIR_SORUMLULAR.map((x) => (
          <Secenek
            key={x}
            kucuk
            metin={x}
            erisimEtiketi={t(`Sorumlu ${x}`, `Responsible ${x}`)}
            secili={sorumlu.trim() === x}
            onPress={() => setSorumlu(sorumlu.trim() === x ? '' : x)}
            style={{ flexGrow: 1, flexBasis: 100, justifyContent: 'center' }}
          />
        ))}
      </View>
      <Girdi
        value={sorumlu}
        onChangeText={setSorumlu}
        placeholder={t('Listede yoksa yazın — örn. tedarikçi adı', 'Not listed? Type it — e.g. supplier name')}
        accessibilityLabel={t('Sorumlu (serbest yazım)', 'Responsible (free text)')}
        ipucu={sorunTipi === 'Part'
          ? t(
            'Parça hatasında seçilen sorumlu bu parçaya öğrenilir; sonraki kayıtlarda kendiliğinden gelir.',
            'For a Part defect, the selected Responsible is remembered for this part and filled in next time.',
          )
          : t('Kompleks hatanın sorumlusu parçaya öğrenilmez.', 'For a Complex defect, the Responsible is not remembered for the part.')}
      />

      <Girdi
        etiket={t('Açıklama', 'Notes')}
        value={aciklama}
        onChangeText={setAciklama}
        placeholder={t('İsteğe bağlı', 'Optional')}
        multiline
      />
    </>
  );

  const fotoBolumu = (
    <>
      <Text style={s.bolumBaslik}>{t('Fotoğraf — Excel’e otomatik gömülür', 'Photo — embedded in Excel automatically')}</Text>
      {fotoHatasi ? <HataKutusu metin={fotoHatasi} /> : null}
      <View style={s.fotoSerit}>
        {fotoIdleri.map((id) => {
          const f = fotoHaritasi.get(id);
          return (
            <View key={id} style={s.fotoKutu}>
              {f ? <Image source={{ uri: f.uri }} style={s.fotoGorsel} /> : null}
              <Pressable
                accessibilityRole="button" accessibilityLabel={t('Fotoğrafı sil', 'Delete photo')}
                onPress={() => fotografiKaldir(id)}
                style={s.fotoSil}
              >
                <S.kapat size={16} color={renkler.tersMetin} strokeWidth={2.5} />
              </Pressable>
            </View>
          );
        })}
        <Pressable
          accessibilityRole="button" accessibilityLabel={t('Fotoğraf çek', 'Take photo')}
          onPress={() => fotografEkle(true)}
          disabled={fotoYukleniyor}
          style={s.fotoEkle}
        >
          {fotoYukleniyor ? <ActivityIndicator color={renkler.birincil} /> : (
            <>
              <S.kamera size={22} color={renkler.birincil} strokeWidth={2} />
              <Text style={s.fotoEkleMetin}>{t('Çek', 'Camera')}</Text>
            </>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button" accessibilityLabel={t('Galeriden seç', 'Choose from gallery')}
          onPress={() => fotografEkle(false)}
          disabled={fotoYukleniyor}
          style={s.fotoEkle}
        >
          <S.galeri size={22} color={renkler.birincil} strokeWidth={2} />
          <Text style={s.fotoEkleMetin}>{t('Galeri', 'Gallery')}</Text>
        </Pressable>
      </View>
    </>
  );

  // SİLME İKİ ADIMLI ve Kaydet/Vazgeç'ten UZAKTA. Önceden "Sil" (51×48)
  // "Vazgeç"in 8 px yanındaydı ve tek dokunuşla, onaysız siliyordu (sınama).
  // Geri almak yerine onay: silme kaydın fotoğraflarını da siliyor
  // (hataSil), geri getirilemez.
  // TAKİP — ekibin Excel'indeki PROGRESS / COUNTERMEASURE / CM APPLICATION DATE /
  // VERIFICATION BODY NO. Yeni kayıtta yok: hata sahada önce kaydedilir, takip sonra.
  const onlemTarihi = takipDurum === 'giderildi' || takipDurum === 'kapali'
    ? (taslak?.giderilmeZamani ? bicimTarih(taslak.giderilmeZamani) : t('kaydedince bugünün tarihi', "today's date on save"))
    : null;
  const takipBolumu = duzenleme ? (
    <View style={{ gap: bosluk.xs }} testID="takip-bolumu">
      <Text style={s.bolumBaslik}>{t('Takip', 'Follow-up')}</Text>
      <View style={s.izgara} accessibilityRole="radiogroup" accessibilityLabel={t('Takip durumu', 'Follow-up status')}>
        {TAKIP_DURUMLARI.map((d) => (
          <Secenek
            key={d.id}
            kucuk
            metin={dil === 'en' ? d.en : d.ad}
            erisimEtiketi={t(`Takip: ${d.ad}`, `Follow-up: ${d.en}`)}
            secili={takipDurum === d.id}
            onPress={() => setTakipDurum(d.id)}
            style={{ flexGrow: 1, flexBasis: 140, justifyContent: 'center' }}
          />
        ))}
      </View>
      {takipDurum !== 'acik' ? (
        <Girdi
          etiket={t('Alınan önlem', 'Countermeasure')}
          value={onlem}
          onChangeText={setOnlem}
          placeholder={t('Örn. tedarikçiye bildirildi, klips değişti', 'E.g. reported to supplier, clip changed')}
          multiline
        />
      ) : null}
      {onlemTarihi ? (
        <Text style={s.alanEtiketi}>{t(`Önlem tarihi: ${onlemTarihi}`, `Countermeasure date: ${onlemTarihi}`)}</Text>
      ) : null}
      {takipDurum === 'kapali' ? (
        <Girdi
          etiket={t('Doğrulandığı aracın body no', 'Verification body no')}
          value={dogrulamaBody}
          onChangeText={(x) => setDogrulamaBody(x.replace(/\D/g, '').slice(0, 6))}
          placeholder={t('6 hane', '6 digits')}
          keyboardType="number-pad"
        />
      ) : null}
      <Text style={s.alanEtiketi}>
        {t("Excel'e PROGRESS (SHARED), COUNTERMEASURE ve tarih olarak gider.", 'Exported to Excel as PROGRESS (SHARED), COUNTERMEASURE and date.')}
      </Text>
    </View>
  ) : null;

  const silBolumu = duzenleme && onSil ? (
    <View style={s.silBolumu}>
      {!silOnay ? (
        // Kırmızı DOLU düğme değil, kırmızı yazı (26.10.2026, ikinci tasarım
        // incelemesi: formun en ağır düğmesi silmeydi). Dolu kırmızı yalnız
        // onayda — "Evet, sil" — kalır.
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Bu kaydı sil', 'Delete this record')}
          onPress={() => { onayaKaydir.current = true; setSilOnay(true); }}
          style={({ pressed }) => [s.silMetinDugme, pressed && { opacity: 0.6 }]}
        >
          <S.sil size={18} color={renkler.tehlike} strokeWidth={2.25} />
          <Text style={s.silMetin}>{t('Bu kaydı sil', 'Delete this record')}</Text>
        </Pressable>
      ) : (
        <View style={s.silOnayKutu}>
          <Text style={s.silOnayMetin}>
            {fotoIdleri.length
              ? t(
                `Kayıt ve ${fotoIdleri.length} fotoğrafı silinecek. Geri alınamaz.`,
                `The record and its ${fotoIdleri.length} ${fotoIdleri.length === 1 ? 'photo' : 'photos'} will be deleted. This can't be undone.`,
              )
              : t('Kayıt silinecek. Geri alınamaz.', "The record will be deleted. This can't be undone.")}
          </Text>
          <View style={s.ikiliSatir}>
            <Dugme
              metin={t('Vazgeç', 'Cancel')}
              tur="sessiz"
              onPress={() => setSilOnay(false)}
              style={{ flex: 1 }}
              erisimEtiketi={t('Silmekten vazgeç', "Don't delete")}
            />
            <Dugme
              metin={t('Evet, sil', 'Yes, delete')}
              tur="tehlike"
              simge={S.sil}
              onPress={() => taslak.id && onSil(taslak.id)}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      )}
    </View>
  ) : null;

  return (
    <>
      <View style={s.baslikSatiri}>
        <View style={{ flex: 1, minWidth: 0 }}>
          {/* Düzenlemede başlık "parça — hata tipi" (26.10.2026 dış değerlendirme:
              başlık yalnız parçaydı, hata tipi dört çip grubunun altında kalıyordu). */}
          <Text style={s.parcaAd} numberOfLines={2}>
            {parca ? parcaCiftiAdi(taslak, dil) : taslak.parcaId}
            {duzenleme && seciliTip ? ` — ${tipAdi(seciliTip)}` : ''}
          </Text>
          <Text style={s.parcaYol} numberOfLines={1}>{parca ? parcaBolgeAdi(parca.id, dil) : undefined}</Text>
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
            {/* Tip bölümü düzenlemede katlı TEK SATIR; en üstte durması dereceyi
                aşağı itmez (eskiden 37 kutuluk ızgara açıktı, o yüzden en alttaydı). */}
            {tipBolumu}
            {dereceBolumu}
            {ayrintiBolumu}
            {fotoBolumu}
            {takipBolumu}
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
        <Dugme metin={t('Vazgeç', 'Cancel')} tur="sessiz" onPress={onKapat} style={{ flex: 1 }} />
        <Dugme metin={t('Kaydet', 'Save')} tur="birincil" pasif={!hataTipiId} onPress={kaydet} style={{ flex: 1 }} />
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
  const { dil, t } = useDil();
  // İngilizce arayüzde denetçi aramaya İngilizce yazar: arama metni İngilizce
  // ada gider ve zorunlu olan o olur; Türkçe ad isteğe bağlı, boşsa
  // İngilizcesi yazılır (veri modelinde `ad` zorunlu).
  const ingilizce = dil === 'en';
  const [ad, setAd] = useState(ingilizce ? '' : baslangicAd);
  const [en, setEn] = useState(ingilizce ? baslangicAd : '');
  const [grup, setGrup] = useState<HataGrubuId | null>(izinliGruplar[0] ?? null);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const zorunluDolu = ingilizce ? !!en.trim() : !!ad.trim();

  const gonder = async () => {
    if (!zorunluDolu || !grup) return;
    setKaydediliyor(true);
    setHata(null);
    try {
      // Önerilen derece seçimi kalktı (26.10.2026): Excel'de tipin önerilen
      // puanı yok, demerit kayıtta seçilir. Alan veri modelinde duruyor.
      await onEkle({ grup, ad: ad.trim() || en.trim(), en: en.trim(), derece: '0' });
    } catch (h) {
      setHata(h instanceof Error ? h.message : String(h));
    } finally {
      setKaydediliyor(false);
    }
  };

  return (
    <View style={s.yeniKart}>
      <Text style={s.yeniBaslik}>{t('Yeni hata tipi', 'New defect type')}</Text>
      <Text style={s.yeniNot}>
        {t(
          'Eklediğiniz tip bu parçada ve aynı gruptaki tüm parçalarda kalıcı olarak listelenir.',
          'The type you add is listed permanently on this part and on all parts in the same group.',
        )}
      </Text>

      {hata ? <HataKutusu metin={hata} /> : null}

      {ingilizce ? (
        <>
          <Girdi etiket="Name" value={en} onChangeText={setEn} placeholder="E.g. Weatherstrip lifted" />
          <Girdi
            etiket="Turkish name (optional)"
            value={ad}
            onChangeText={setAd}
            placeholder="Örn. Fitil ucu kalkık"
            ipucu={ad.trim() ? undefined : 'If left empty, the English name is used in Turkish too.'}
          />
        </>
      ) : (
        <>
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
        </>
      )}

      <Text style={s.alanEtiketi}>{t('Grup', 'Group')}</Text>
      <View style={s.izgara}>
        {izinliGruplar.map((g) => (
          <Secenek
            key={g}
            metin={grupAdi(g, dil)}
            simge={GRUP_SIMGELERI[g]}
            secili={grup === g}
            onPress={() => setGrup(g)}
            style={{ flexGrow: 1, flexBasis: 150, justifyContent: 'flex-start' }}
          />
        ))}
      </View>

      <View style={s.yeniEylemler}>
        <Dugme metin={t('Vazgeç', 'Cancel')} tur="sessiz" kucuk onPress={onVazgec} style={{ flex: 1 }} />
        <Dugme
          metin={t('Ekle ve seç', 'Add & select')}
          tur="birincil"
          kucuk
          yukleniyor={kaydediliyor}
          pasif={!zorunluDolu || !grup}
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
  /** null: henüz seçilmedi (hızlı kayıtta demerit zorunlu, varsayılan yok). */
  derece: DereceKodu | null;
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
        const { on, arka } = dereceRenkleri(renkler, d.id);
        return (
          <Pressable
            key={d.id}
            accessibilityRole="radio"
            aria-checked={secili}
            accessibilityLabel={`${etiketOnEki} ${d.ad}`}
            onPress={() => onSec(d.id)}
            style={({ pressed }) => [
              s.dereceDugme, kucuk && s.dereceDugmeKucuk,
              secili ? { backgroundColor: arka, borderColor: on } : null,
              pressed && { opacity: 0.72 },
            ]}
          >
            {/* Seçili-durum dili temel.tsx Secenek ile aynı: ton + 2 px kenar + tik.
                Eskiden dolu renkti; demerit 1'de "çamurlu zeytin" görünüyordu. */}
            <Text style={[kucuk ? s.dereceRakamKucuk : s.dereceRakam, { color: on }]}>
              {d.ad}
            </Text>
            {secili ? <S.tik size={kucuk ? 14 : 16} color={on} strokeWidth={2.75} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Excel CLASS seçici: MINOR · MAJOR · MAIN. */
export function SinifSecici({ sinif, onSec }: { sinif: SinifKodu; onSec: (c: SinifKodu) => void }) {
  const { t } = useDil();
  return (
    <SegmentSecici
      secenekler={SINIFLAR.map((c) => ({ id: c, metin: c, erisimEtiketi: t(`Sınıf ${c}`, `Class ${c}`) }))}
      deger={sinif}
      onSec={(c) => c && onSec(c)}
      erisimEtiketi={t('Sınıf', 'Class')}
    />
  );
}

/** Hata grubu başlığı — simge okumadan tanımayı sağlar, 37 kutu arasında göz grubu bulur. */
export function GrupBasligi({ grup }: { grup: HataGrubuId }) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const { dil } = useDil();
  const Ikon = GRUP_SIMGELERI[grup];
  return (
    <View style={s.grupSatir}>
      {Ikon ? <Ikon size={15} color={renkler.metinIkincil} strokeWidth={2} /> : null}
      <Text style={s.grupBaslik}>{grupAdi(grup, dil)}</Text>
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
  // Çerçevesiz ton dolgu; seçili: seçili-durum dili (temel.tsx Secenek).
  secenek: {
    flexGrow: 1, flexBasis: 148, minHeight: DOKUNMA, justifyContent: 'center',
    paddingHorizontal: bosluk.xs, paddingVertical: 6,
    borderRadius: kose.sm, borderWidth: 2, borderColor: r.yuzeyAlt, backgroundColor: r.yuzeyAlt,
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
  // Fotoğraf eklemek ikincil kesik çizgili kutu değil, belirgin bir eylem
  // (26.10.2026 dış değerlendirme: SafetyCulture'da fotoğraf birinci sınıf).
  fotoEkle: {
    width: 84, height: 84, alignItems: 'center', justifyContent: 'center', gap: 4,
    borderRadius: kose.sm, backgroundColor: r.birincilYumusak,
  },
  fotoEkleMetin: { ...tipografi.captionOrta, color: r.birincil, textAlign: 'center' },

  dereceSatir: { flexDirection: 'row', gap: bosluk.xs },
  dereceDugme: {
    flex: 1, minHeight: 56, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center',
    borderRadius: kose.md, borderWidth: 2, borderColor: r.yuzeyVurgu, backgroundColor: r.yuzeyVurgu,
  },
  dereceDugmeKucuk: { minHeight: DOKUNMA },
  dereceRakam: { ...tipografi.h1, fontSize: 26, lineHeight: 32 },
  dereceRakamKucuk: { ...tipografi.h3 },

  tipOzet: {
    flexDirection: 'row', alignItems: 'center', gap: bosluk.sm, marginTop: bosluk.xs,
    padding: bosluk.sm, borderRadius: kose.md, backgroundColor: r.yuzeyAlt,
  },
  tipOzetAd: { ...tipografi.bodyOrta, color: r.metin },

  silBolumu: { marginTop: bosluk.lg, paddingTop: bosluk.md, borderTopWidth: 1, borderTopColor: r.cizgiSolgun },
  silMetinDugme: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    minHeight: DOKUNMA, paddingHorizontal: bosluk.md, alignSelf: 'center',
  },
  silMetin: { ...tipografi.bodyOrta, color: r.tehlike },
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
