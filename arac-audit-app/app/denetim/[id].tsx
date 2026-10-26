import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdimliSecim, Konum, KOK_KONUM } from '@/bilesenler/AdimliSecim';
import { DenetimBilgileri } from '@/bilesenler/DenetimBilgileri';
import {
  DereceSecici, GrupBasligi, HataSayfasi, HataTaslagi, SinifSecici, YeniTipFormu,
} from '@/bilesenler/HataSayfasi';
import { S } from '@/bilesenler/simgeler';
import {
  AltSayfa, AramaKutusu, Baslik, BaslikCipi, BaslikDugmesi, BilgiKutusu, BolumBasligi, BosDurum, DereceRozeti,
  Dugme, Ekran, GeriDugmesi, HataKutusu, Rozet, useDuzen, Yukleniyor,
} from '@/bilesenler/temel';
import { aramaEslesir, aramaMetni } from '@/cekirdek/arama';
import {
  bolgelerAracIcin, HATA_TIPI_INDEKS, hataTipiAdi, PARCA_INDEKS, parcaBolgeAdi, parcaHataTipleri, parcaTamAdi,
} from '@/cekirdek/katalog';
import { aracEtiketi, ARAC_INDEKS } from '@/cekirdek/model3d';
import { VARSAYILAN_SINIF, varsayilanSistem } from '@/cekirdek/nas';
import { dereceGosterimi } from '@/cekirdek/puan';
import { bicimTarih } from '@/cekirdek/rapor';
import { kapsamMetni, mevcutSistemler, parcaSistemi } from '@/cekirdek/sistemler';
import { aracKimligi } from '@/cekirdek/vin';
import {
  Denetim, DereceKodu, Hata, HataGrubuId, HataTipi, SinifKodu,
} from '@/cekirdek/tipler';
import { bosluk, DOKUNMA, kose, Renkler, tipografi, useTema } from '@/tema';
import { useAcmaIstegi } from '@/veri/acmaIstegi';
import {
  ayarOku, ayarYaz, denetimGetir, denetimGuncelle, denetimSil, FotografKaydi, fotograflariGetir,
  fotografiHataBagla, hataKaydet, hataSil, kapsamAyarla, kimlikUret,
} from '@/veri/depo';
import { useDil } from '@/veri/dilDeposu';
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
 * Derece hata panelinin üstünde durur. YENİ PARÇADA 1'DEN BAŞLAR (28.09.2026):
 * önceden son seçilen derece hatırlanıp bir sonraki parçaya taşınıyordu;
 * kullanılabilirlik sınamasında üç ajandan ikisi bunu en önemli sorunlardan
 * saydı — dereceye bakmayan denetçi önceki dereceyi SESSİZCE yazıyordu
 * (telefonda 14 kaydın 10'unda seçili gelen derece istenenden farklıydı; o
 * dereceleri ajan kendisi seçti). Aynı parçaya art arda hata için bildirimde
 * "Aynı parçaya" var. Fotoğraf ve not sonradan, kaydedilen hatalar
 * listesinden eklenir — hızlı yolun üstünde durmaz.
 *
 * EXCEL ALANLARI (26.10.2026, ürün sahibi: "içeriği buna göre yap"): derece
 * artık ekibin Excel'indeki DEMERIT (0–3) ve yanında CLASS (MINOR/MAJOR/MAIN).
 * Excel formu her kayıttan sonra 0 / MINOR'a döner; burada da öyle — HER
 * kayıttan sonra, "Aynı parçaya" yolunda da. Yapışkan değer yukarıdaki
 * sınamadaki gibi sessizce yanlış yazılırdı. "Kabul edilebilir" anahtarı
 * kalktı: Excel'de yok, karşılığı demerit 0. SYSTEM parça ve tipten önerilir
 * (nas.ts); ayrıntıda değiştirilebilir.
 *
 * ADIM ADIM SEÇİM (ürün sahibi, 24.10.2026: "seçe seçe ilerlesinler, en
 * dıştan"): parça artık Sistem → Bölge → Parça diye seçilir (AdimliSecim.tsx).
 * Kayıttan sonra aynı bölgenin parçalarına dönülür.
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
/** Alttaki bildirim: bir kayıt düştü (geri alınabilir) ya da geri alındı. */
type Bildirim =
  | { tur: 'kayit'; id: string; metin: string; parcaId: string }
  | { tur: 'geriAlindi'; metin: string };

export default function DenetimEkrani() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { renkler } = useTema();
  const { dil, t } = useDil();
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
  // Sistem/bölge: kayıttan sonra SİLİNMEZ — aynı bölgede ikinci hata için
  // denetçi yeniden en dıştan başlamasın.
  const [konum, setKonum] = useState<Konum>(KOK_KONUM);
  const [hataArama, setHataArama] = useState('');
  // Excel formu gibi 0 / MINOR ile başlar, her kayıttan sonra oraya döner.
  const [derece, setDerece] = useState<DereceKodu>('0');
  const [sinif, setSinif] = useState<SinifKodu>(VARSAYILAN_SINIF);
  const [yeniTipAcik, setYeniTipAcik] = useState(false);
  const [kayitHatasi, setKayitHatasi] = useState<string | null>(null);

  const [bildirim, setBildirim] = useState<Bildirim | null>(null);
  // Parça → sorumlu (ekibin tablosunda L: "HMTR PD (HWASEUNG)"). Ayrıntı
  // ekranında bir parça için yazılan sorumlu burada öğrenilir, o parçanın
  // sonraki hızlı kayıtlarına kendiliğinden gelir. Hiç yazılmamışsa BOŞ kalır:
  // bilinmeyen bir sorumluyu tahmin edip rapora basmak yanlış kişiye iş açar.
  const [sorumluHaritasi, setSorumluHaritasi] = useState<Record<string, string>>({});
  const bildirimZamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tek alt sayfa: aynı anda iki Modal açıldığında kapanan modal DOM'da asılı
  // kalıp alttakini engelliyordu (15.09.2026). İçerik değişir, kabuk tektir.
  const [acikSayfa, setAcikSayfa] = useState<'yok' | 'liste' | 'hata' | 'bilgiler'>('yok');
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

  const bildirimGoster = useCallback((b: Bildirim | null, sure = 0) => {
    if (bildirimZamanlayici.current) clearTimeout(bildirimZamanlayici.current);
    setBildirim(b);
    if (b && sure) bildirimZamanlayici.current = setTimeout(() => setBildirim(null), sure);
  }, []);

  // BİTMİŞ DENETİM DEĞİŞİRSE YENİDEN AÇILIR. Önceden "TAMAMLANDI" denetime
  // uyarısız kayıt eklenebiliyor, kart "tamamlandı" demeye devam ediyordu;
  // gönderilmiş Excel sessizce eskiyordu (üç ajanın sınaması, 28.09.2026).
  // Ekranın üstünde bunu söyleyen bir bant var; değişiklik olunca durum
  // "devam ediyor"a döner, bitiş zamanı silinir.
  const yenidenAcGerekirse = useCallback(async () => {
    if (denetim?.durum === 'tamam') await denetimGuncelle(denetim.id, { durum: 'devam', bitis: null });
  }, [denetim?.durum, denetim?.id]);

  useEffect(() => {
    ayarOku<Record<string, string>>('sorumluHaritasi', {}).then(setSorumluHaritasi).catch(() => { /* ilk açılış */ });
    return () => { if (bildirimZamanlayici.current) clearTimeout(bildirimZamanlayici.current); };
  }, []);

  const dereceSec = useCallback((d: DereceKodu) => setDerece(d), []);

  const arac = denetim ? ARAC_INDEKS[denetim.aracId] : undefined;
  const parca = parcaId ? PARCA_INDEKS[parcaId] : undefined;

  // --- PARÇA SEÇİMİ ----------------------------------------------------
  const bolgeler = useMemo(() => bolgelerAracIcin({ tip: arac?.tip ?? 'ice' }), [arac?.tip]);

  // KAPSAM (sistemler.ts): işaretli sistemler. Elle değişince de denetim
  // "değişti" sayılır (bitmişse yeniden açılır).
  const kapsam = useMemo(() => new Set(denetim?.kapsam ?? []), [denetim?.kapsam]);
  const kapsamDegistir = useCallback(async (sistem: string, isaretli: boolean) => {
    if (!denetim) return;
    await kapsamAyarla(denetim.id, sistem, isaretli);
    await yenidenAcGerekirse().catch(() => {});
    await tazele();
  }, [denetim, tazele, yenidenAcGerekirse]);

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
    const q = hataArama.trim();
    const hepsi = parcaHataTipleri(parcaId);
    return q ? hepsi.filter((t) => aramaEslesir(aramaMetni(t.ad, t.en), q)) : hepsi;
    // ozelTipler: yeni tip eklendiğinde ızgara anında tazelensin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parcaId, hataArama, ozelTipler]);

  /** Izgara grup grup çizilir; grup sırası listedeki ilk görünüşe göre. */
  const tipGruplari = useMemo(() => {
    const m = new Map<HataGrubuId, HataTipi[]>();
    for (const t of tipler) m.set(t.grup, [...(m.get(t.grup) ?? []), t]);
    return [...m.entries()];
  }, [tipler]);

  /** Parçayı açar. Demerit 0'a, class MINOR'a döner (dosya başı notu). */
  const parcaSec = useCallback((pid: string) => {
    setParcaId(pid);
    setHataArama('');
    setYeniTipAcik(false);
    setKayitHatasi(null);
    setDerece('0');
    setSinif(VARSAYILAN_SINIF);
  }, []);

  const parcalaraDon = useCallback(() => {
    setParcaId(null);
    setHataArama('');
    setYeniTipAcik(false);
  }, []);

  /** Tek dokunuşla kayıt — bu ekranın var olma sebebi. */
  const hizliKaydet = useCallback(async (tip: HataTipi) => {
    if (!denetim || !parcaId) return;
    setKayitHatasi(null);
    const kayit: Hata = {
      id: kimlikUret('h'),
      parcaId,
      hataTipiId: tip.id,
      derece,
      kabulEdilebilir: false,
      sinif,
      sistem: varsayilanSistem(parcaId, tip.id),
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
      const neden = h instanceof Error ? h.message : String(h);
      setKayitHatasi(t(`Kaydedilemedi: ${neden}`, `Could not save: ${neden}`));
      return;
    }
    // Kayıt düştü; bitmiş denetimi yeniden açamazsak bu kaydı "kaydedilemedi"
    // diye göstermek yanlış olurdu — yalnız durum güncellenmemiş kalır.
    await yenidenAcGerekirse().catch(() => {});
    // Hata kaydedilen sistem kontrol edilmiş sayılır — denetçi ayrıca işaretlemesin.
    const sistem = parcaSistemi(parcaId);
    if (sistem) await kapsamAyarla(denetim.id, sistem, true).catch(() => {});
    // Kullanım sayacını hataKaydet kendisi artırıyor. Burada da çağrılıyordu;
    // hızlı girişteki her kayıt iki kez sayılıyordu (26.09.2026'da fark edildi).

    // Bildirim metni kayıt anındaki dilde kurulur (6 sn ekranda kalır).
    bildirimGoster({
      tur: 'kayit', id: kayit.id, parcaId,
      metin: t(
        `${parcaTamAdi(parcaId)} — ${tip.ad} · demerit ${dereceGosterimi(kayit)} · ${sinif}`,
        `${parcaTamAdi(parcaId, 'en')} — ${tip.en || tip.ad} · demerit ${dereceGosterimi(kayit)} · ${sinif}`,
      ),
    }, 6000);

    setDerece('0');
    setSinif(VARSAYILAN_SINIF);
    parcalaraDon();
    setParcaArama('');
    await tazele();
  }, [denetim, parcaId, derece, sinif, sorumluHaritasi, parcalaraDon, tazele, bildirimGoster, yenidenAcGerekirse, t]);

  // Geri almak SESSİZ değil: yalnız başlıktaki sayaç değişiyordu (sınamada
  // "geri alındı mı?" sorusu kaldı). Kısa bir "Geri alındı" bildirimi çıkar.
  const geriAl = useCallback(async () => {
    if (bildirim?.tur !== 'kayit') return;
    await hataSil(bildirim.id);
    bildirimGoster({ tur: 'geriAlindi', metin: t(`Geri alındı: ${bildirim.metin}`, `Undone: ${bildirim.metin}`) }, 3000);
    await tazele();
  }, [bildirim, tazele, bildirimGoster, t]);

  // Aynı parçaya art arda hata: listeye dönüp parçayı yeniden aramak yerine
  // bildirimden tek dokunuş. Demerit ve class kayıttan sonra zaten 0 / MINOR.
  const ayniParcaya = useCallback(() => {
    if (bildirim?.tur !== 'kayit') return;
    setParcaId(bildirim.parcaId);
    setHataArama('');
    setYeniTipAcik(false);
    setKayitHatasi(null);
    bildirimGoster(null);
  }, [bildirim, bildirimGoster]);

  // --- AYRINTILI DÜZENLEME (isteğe bağlı) ------------------------------
  const ayrintiKaydet = useCallback(async (t: HataTaslagi, fotoIdleri: string[]) => {
    if (!denetim) return;
    const hataId = t.id ?? kimlikUret('h');
    await hataKaydet(denetim.id, {
      ...t, id: hataId, zaman: t.zaman ?? new Date().toISOString(), fotograflar: fotoIdleri,
    });
    for (const fid of fotoIdleri) await fotografiHataBagla(fid, hataId);
    await yenidenAcGerekirse();
    const sistem = parcaSistemi(t.parcaId);
    if (sistem) await kapsamAyarla(denetim.id, sistem, true).catch(() => {});

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
  }, [denetim, sorumluHaritasi, tazele, yenidenAcGerekirse]);

  const ayrintiSil = useCallback(async (hataId: string) => {
    await hataSil(hataId);
    await yenidenAcGerekirse();
    setTaslak(null);
    setAcikSayfa('liste');
    await tazele();
  }, [tazele, yenidenAcGerekirse]);

  const kaydiAc = useCallback((h: Hata) => {
    setTaslak({ ...h });
    setAcikSayfa('hata');
  }, []);

  // Rapordan gelen "şunu aç" isteği (acmaIstegi.ts): o kaydın düzenlemesi ya
  // da denetim bilgileri. Bir kez okunur, silinir.
  const acmaIstegi = useAcmaIstegi((d) => d.istek);
  const acmaIste = useAcmaIstegi((d) => d.iste);
  useEffect(() => {
    if (!acmaIstegi || !denetim || acmaIstegi.denetimId !== denetim.id) return;
    if (acmaIstegi.tur === 'hata') {
      const h = denetim.hatalar.find((x) => x.id === acmaIstegi.hataId);
      if (h) kaydiAc(h);
    } else {
      setAcikSayfa('bilgiler');
    }
    acmaIste(null);
  }, [acmaIstegi, denetim, kaydiAc, acmaIste]);

  const bilgileriKaydet = useCallback(async (alanlar: Partial<Denetim>) => {
    if (!denetim) return;
    await denetimGuncelle(denetim.id, alanlar);
    // Araç değiştiyse seçili parça yeni aracın listesinde olmayabilir (tablette
    // seçim açık kalır): seçimi kaldır.
    if (alanlar.aracId && alanlar.aracId !== denetim.aracId) { parcalaraDon(); setKonum(KOK_KONUM); }
    setAcikSayfa('yok');
    await tazele();
  }, [denetim, tazele, parcalaraDon]);

  const denetimiSil = useCallback(async () => {
    if (!denetim) return;
    await denetimSil(denetim.id);
    router.dismissTo('/'); // replace('/') yığında ikinci ana sayfa bırakırdı (rapor.tsx → bitir)
  }, [denetim, router]);

  // --- DURUMLAR ---------------------------------------------------------
  if (yuklemeHatasi) {
    return (
      <Ekran>
        <Baslik baslik={t('Denetim', 'Audit')} sol={<GeriDugmesi />} />
        <View style={{ padding: bosluk.md }}><HataKutusu metin={yuklemeHatasi} /></View>
      </Ekran>
    );
  }
  if (!denetim) {
    return (
      <Ekran>
        <Baslik baslik={t('Denetim', 'Audit')} sol={<GeriDugmesi />} />
        <Yukleniyor metin={t('Denetim açılıyor…', 'Opening audit…')} />
      </Ekran>
    );
  }

  const hataSayisi = denetim.hatalar.length;
  const seciliAdet = parcaId ? parcaSayilari.get(parcaId) ?? 0 : 0;

  // --- PARÇA GEZGİNİ (adım adım) ----------------------------------------
  const parcaGezgini = (
    <AdimliSecim
      bolgeler={bolgeler}
      konum={konum}
      setKonum={setKonum}
      arama={parcaArama}
      setArama={setParcaArama}
      parcaId={parcaId}
      parcaSayilari={parcaSayilari}
      sonParcalar={sonParcalar}
      onSec={parcaSec}
      tablet={tablet}
      kapsam={kapsam}
      onKapsam={kapsamDegistir}
      // Lumiform'daki "tamamla": raporu bitirme onayı açık hâlde açar; orada
      // kontrol edilmemiş sistemler sayılır (25.10.2026).
      onBitir={denetim.durum === 'devam'
        ? () => router.push({ pathname: '/denetim/rapor', params: { id: denetim.id, bitir: '1' } })
        : undefined}
      aracId={denetim.aracId}
    />
  );

  // --- HATA PANELİ ------------------------------------------------------
  const hataPaneli = parca ? (
    <View style={{ flex: 1 }}>
      <View style={s.parcaBaslik}>
        {!tablet ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Parça listesine dön', 'Back to part list')}
            onPress={parcalaraDon}
            style={({ pressed }) => [s.geriDugme, pressed && s.basili]}
          >
            <S.geri size={20} color={renkler.birincil} strokeWidth={2.25} />
            <Text style={s.geriMetin}>{t('Parçalar', 'Parts')}</Text>
          </Pressable>
        ) : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.seciliParca} numberOfLines={1}>{parcaTamAdi(parca.id, dil)}</Text>
          <Text style={s.seciliYol} numberOfLines={1}>{parcaBolgeAdi(parca.id, dil)}</Text>
        </View>
        {seciliAdet > 0 ? (
          <Rozet
            metin={t(`${seciliAdet} KAYIT`, `${seciliAdet} ${seciliAdet === 1 ? 'RECORD' : 'RECORDS'}`)}
            renk={renkler.birincil}
            zemin={renkler.birincilYumusak}
          />
        ) : null}
        {tablet ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Parça seçimini kaldır', 'Clear part selection')}
            onPress={parcalaraDon}
            style={({ pressed }) => [s.kapatDugme, pressed && s.basili]}
          >
            <S.kapat size={20} color={renkler.metinIkincil} strokeWidth={2} />
          </Pressable>
        ) : null}
      </View>

      <View style={[s.dereceSerit, tablet && s.dereceSeritTablet]}>
        <View style={[{ gap: bosluk.xs }, tablet && { flex: 1 }]}>
          <Text style={s.dereceEtiket}>{t('Demerit — 0 skora girmez', 'Demerit — 0 not scored')}</Text>
          <DereceSecici derece={derece} onSec={dereceSec} kucuk />
        </View>
        <View style={[{ gap: bosluk.xs }, tablet && { flex: 1 }]}>
          <Text style={s.dereceEtiket}>Class</Text>
          <SinifSecici sinif={sinif} onSec={setSinif} />
        </View>
      </View>

      <ScrollView contentContainerStyle={s.hataGovde} keyboardShouldPersistTaps="handled">
        <AramaKutusu
          deger={hataArama}
          degistir={setHataArama}
          yerTutucu={t('Hata ara — gap, scratch, gıcırtı…', 'Search defects — gap, scratch, squeak…')}
          erisimEtiketi={t('Hata tipi ara', 'Search defect types')}
        />

        {/* Hata kutularının üstünde hangi değerle kaydedileceği yazmıyordu
            (sınama, 28.09.2026). Sonuç burada: dokunulan hata BU değerle düşer. */}
        {/* Ekran okuyucu için TEK cümle; rozet ağaçtan gizli — yoksa demerit
            seçicisiyle aynı adlı ikinci bir öğe oluyordu. */}
        <View
          style={s.kayitDerecesi}
          accessible
          accessibilityLabel={t(
            `Dokunduğunuz hata demerit ${derece}, ${sinif} olarak kaydedilir`,
            `The defect you tap is saved as demerit ${derece}, ${sinif}`,
          )}
        >
          <Text style={s.kayitDerecesiMetin} aria-hidden>{t('Dokunduğunuz hata', 'The defect you tap is saved as')}</Text>
          <View aria-hidden><DereceRozeti derece={derece} kabul={false} /></View>
          <Text style={s.kayitDerecesiMetin} aria-hidden>{t(`· ${sinif} olarak kaydedilir`, `· ${sinif}`)}</Text>
        </View>

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
                  {liste.map((tip) => (
                    <Pressable
                      key={tip.id}
                      accessibilityRole="button"
                      accessibilityLabel={t(
                        `${tip.ad}${tip.en ? ` (${tip.en})` : ''} — demerit ${derece}, ${sinif} olarak kaydet`,
                        `${tip.en || tip.ad} — save as demerit ${derece}, ${sinif}`,
                      )}
                      onPress={() => hizliKaydet(tip)}
                      style={({ pressed }) => [s.hataDugme, pressed && s.hataDugmeBasili]}
                    >
                      <View style={s.hataDugmeUst}>
                        {/* Ekibin eklediği tipin İngilizcesi boş olabilir: o zaman Türkçesi. */}
                        <Text style={s.hataAd} numberOfLines={2}>{t(tip.ad, tip.en || tip.ad)}</Text>
                        {tip.ozel ? <Text style={s.ekipIsaret}>{t('Ekip', 'Team')}</Text> : null}
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}

            {tipler.length === 0 ? (
              <Text style={s.bos}>
                {hataArama.trim()
                  ? t(`“${hataArama.trim()}” listede yok.`, `“${hataArama.trim()}” is not in the list.`)
                  : t('Bu parça için tanımlı hata tipi yok.', 'No defect types defined for this part.')}
              </Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={hataArama.trim()
                ? t(`“${hataArama.trim()}” adıyla yeni hata tipi ekle`, `Add new defect type “${hataArama.trim()}”`)
                : t('Yeni hata tipi ekle', 'Add new defect type')}
              onPress={() => setYeniTipAcik(true)}
              style={({ pressed }) => [s.yeniTip, tipler.length === 0 && { borderColor: renkler.birincil }, pressed && s.basili]}
            >
              <S.ekle size={18} color={renkler.birincil} strokeWidth={2.25} />
              <Text style={s.yeniTipMetin}>
                {hataArama.trim()
                  ? t(`“${hataArama.trim()}” adıyla yeni hata tipi`, `New defect type “${hataArama.trim()}”`)
                  : t('Yeni hata tipi', 'New defect type')}
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
        // Telefonda başlıkta yalnız araç adı: "BJ · IONIQ 3" dar başlıkta
        // "BJ · ION…" diye kesiliyordu (ekran görüntüsü, 26.10.2026).
        baslik={tablet ? (aracKimligi(denetim) || t('Denetim', 'Audit')) : (arac?.ad ?? t('Denetim', 'Audit'))}
        sol={<GeriDugmesi />}
        cipler={(
          <>
            {!tablet && aracKimligi(denetim) ? <BaslikCipi metin={aracKimligi(denetim)} mono /> : null}
            {/* Şasi de body no da varsa body no ayrıca görünür (başlıkta şasi var). */}
            {denetim.vin && denetim.bodyNo ? <BaslikCipi metin={`Body ${denetim.bodyNo}`} mono /> : null}
            {tablet ? <BaslikCipi simge={S.arac} metin={aracEtiketi(arac, denetim.aracId)} /> : null}
            {/* Plaka, faz ve ekip formdan kalktı (ürün sahibi, 24.10.2026). */}
            {denetim.spec ? <BaslikCipi metin={`Spec ${denetim.spec}`} /> : null}
          </>
        )}
        sag={(
          <>
            <BaslikDugmesi
              simge={S.duzenle}
              metin={t('Bilgiler', 'Details')}
              erisimEtiketi={t('Denetim bilgilerini düzenle', 'Edit audit details')}
              onPress={() => setAcikSayfa('bilgiler')}
            />
            <BaslikDugmesi
              simge={S.liste}
              metin={t('Kayıtlar', 'Records')}
              sayac={hataSayisi}
              erisimEtiketi={t(
                `Kaydedilen ${hataSayisi} hata`,
                `${hataSayisi} recorded ${hataSayisi === 1 ? 'defect' : 'defects'}`,
              )}
              onPress={() => setAcikSayfa('liste')}
            />
            <BaslikDugmesi
              simge={S.rapor}
              metin={t('Rapor', 'Report')}
              birincil
              erisimEtiketi={t('Rapor', 'Report')}
              onPress={() => router.push({ pathname: '/denetim/rapor', params: { id: denetim.id } })}
            />
          </>
        )}
      />

      {denetim.durum === 'tamam' ? (
        <View style={s.tamamBandi}>
          <BilgiKutusu
            metin={t(
              `Bu denetim tamamlandı${denetim.bitis ? ` (${bicimTarih(denetim.bitis)})` : ''}. Kayıt ekler, düzeltir ya da silerseniz yeniden "devam ediyor" olur.`,
              `This audit is completed${denetim.bitis ? ` (${bicimTarih(denetim.bitis)})` : ''}. If you add, edit or delete a record, it goes back to "in progress".`,
            )}
          />
        </View>
      ) : null}

      {tablet ? (
        <View style={s.ikiBolme}>
          <View style={s.solBolme}>{parcaGezgini}</View>
          <View style={s.sagBolme}>
            {hataPaneli ?? <DenetimOzeti denetim={denetim} onAc={kaydiAc} onTumu={() => setAcikSayfa('liste')} />}
          </View>
        </View>
      ) : (hataPaneli ?? parcaGezgini)}

      {bildirim ? (
        // Bildirim altta, hata ızgarasının son satırının ÜSTÜNDE yüzüyor. Metin
        // kısmı dokunuşu yutarsa kayıttan sonraki 6 sn boyunca o satırdaki
        // düğmelere basılamıyor — hızlı girişin tam ortasında (26.09.2026 ekran
        // incelemesi). Dokunuşu yalnız düğmeler alır, gerisi alttakine geçer.
        // Telefonda düğmeler ikinci satıra iner (metin kısalmasın diye).
        <View style={[s.bildirimKap, { bottom: bosluk.md + kenar.bottom }]} pointerEvents="box-none">
          <View style={s.bildirim} accessibilityLiveRegion="polite" pointerEvents="box-none">
            <View style={s.bildirimSol} pointerEvents="none">
              {bildirim.tur === 'kayit'
                ? <S.tamam size={20} color={renkler.tersVurgu} strokeWidth={2.25} />
                : <S.geriAl size={20} color={renkler.tersVurgu} strokeWidth={2.25} />}
              <Text style={s.bildirimMetin} numberOfLines={3}>{bildirim.metin}</Text>
            </View>
            {bildirim.tur === 'kayit' ? (
              <View style={s.bildirimDugmeler} pointerEvents="box-none">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t(
                    `Aynı parçaya bir hata daha: ${parcaTamAdi(bildirim.parcaId)}`,
                    `Another defect on the same part: ${parcaTamAdi(bildirim.parcaId, 'en')}`,
                  )}
                  onPress={ayniParcaya}
                  hitSlop={8}
                  style={({ pressed }) => [s.geriAlDugme, pressed && s.basili]}
                >
                  <S.ekle size={18} color={renkler.tersVurgu} strokeWidth={2.25} />
                  <Text style={s.geriAlMetin}>{t('Aynı parçaya', 'Same part')}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('Son kaydı geri al', 'Undo last record')}
                  onPress={geriAl}
                  hitSlop={8}
                  style={({ pressed }) => [s.geriAlDugme, pressed && s.basili]}
                >
                  <S.geriAl size={18} color={renkler.tersVurgu} strokeWidth={2.25} />
                  <Text style={s.geriAlMetin}>{t('Geri al', 'Undo')}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      <AltSayfa
        gorunur={acikSayfa !== 'yok'}
        tamYukseklik={acikSayfa === 'liste' || acikSayfa === 'bilgiler'}
        onKapat={() => { setAcikSayfa('yok'); setTaslak(null); }}
      >
        {acikSayfa === 'bilgiler' ? (
          <DenetimBilgileri
            key={denetim.id}
            denetim={denetim}
            onKaydet={bilgileriKaydet}
            onSil={denetimiSil}
            onKapat={() => setAcikSayfa('yok')}
          />
        ) : acikSayfa === 'liste' ? (
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
 * Tablette parça seçilmemişken sağ bölme: ne yapılacağı, seçili derece ve son
 * kayıtlar. Sayı kutuları vardı, kaldırıldı (28.09.2026, "çok kalabalık");
 * sayılar rapor ekranında.
 */
function DenetimOzeti({
  denetim, onAc, onTumu,
}: {
  denetim: Denetim;
  onAc: (h: Hata) => void;
  onTumu: () => void;
}) {
  const { renkler } = useTema();
  const { dil, t } = useDil();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const son = useMemo(
    () => [...denetim.hatalar].sort((a, b) => b.zaman.localeCompare(a.zaman)).slice(0, 5),
    [denetim.hatalar],
  );
  const kapsamYazi = kapsamMetni(
    denetim.kapsam ?? [], mevcutSistemler(bolgelerAracIcin({ tip: ARAC_INDEKS[denetim.aracId]?.tip ?? 'ice' })), dil,
  );

  return (
    <ScrollView contentContainerStyle={s.ozetGovde}>
      {/* "Seçili derece" rozeti kalktı: demerit parça açılınca seçiliyor
          (her yeni kayıtta 0). "Kayıt o anda düşer" ilk kez kullanan birine bir
          şey söylemiyordu (sınama, 28.09.2026). */}
      <BosDurum
        simge={S.sec}
        baslik={t('Soldan sistem → bölge → parça seçin', 'Select system → area → part on the left')}
        aciklama={t(
          "Sonra demerit ve class'ı seçip hataya dokunun; hata o anda kaydedilir ve aynı bölgenin parçalarına dönülür.",
          'Then set demerit and class and tap a defect; it is saved at once and you return to the parts of the same area.',
        )}
      />
      <Text style={s.kapsamOzeti} accessibilityLabel={t(`Kontrol edilen sistemler: ${kapsamYazi}`, `Systems checked: ${kapsamYazi}`)}>
        {t(`Kontrol edilen sistemler: ${kapsamYazi}`, `Systems checked: ${kapsamYazi}`)}
      </Text>

      {son.length ? (
        <View style={{ gap: bosluk.xs }}>
          <BolumBasligi
            metin={t('Son kayıtlar', 'Recent records')}
            simge={S.son}
            sag={(
              <Dugme
                metin={t('Tümü', 'All')} kucuk tur="sessiz" simge={S.liste} onPress={onTumu}
                erisimEtiketi={t('Tüm kayıtları aç', 'Open all records')}
              />
            )}
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
  const { dil, t } = useDil();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const tip = HATA_TIPI_INDEKS[h.hataTipiId];
  const alt = [
    parcaBolgeAdi(h.parcaId, dil),
    h.adet > 1 ? t(`${h.adet} adet`, `${h.adet} pcs`) : null,
    h.konum || null,
    h.sorunTipi === 'Complex' ? 'Complex' : null,
    h.sorumlu ? `→ ${h.sorumlu}` : null,
  ].filter(Boolean).join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(
        `${parcaTamAdi(h.parcaId)} ${tip?.ad}, demerit ${dereceGosterimi(h)} — düzenle`,
        `${parcaTamAdi(h.parcaId, 'en')} ${hataTipiAdi(h.hataTipiId, 'en')}, demerit ${dereceGosterimi(h)} — edit`,
      )}
      onPress={onPress}
      style={({ pressed }) => [s.kayitSatir, pressed && s.basili]}
    >
      {sira !== undefined ? <Text style={s.kayitSira}>{sira}</Text> : null}
      <DereceRozeti derece={h.derece} kabul={h.kabulEdilebilir} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.kayitAd} numberOfLines={1}>{parcaTamAdi(h.parcaId, dil)} — {hataTipiAdi(h.hataTipiId, dil)}</Text>
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

/** Kaydedilen hatalar — fotoğraf ve not buradan, isteğe bağlı eklenir. */
function KayitListesi({
  hatalar, onAc, onKapat,
}: {
  hatalar: Hata[];
  onAc: (h: Hata) => void;
  onKapat: () => void;
}) {
  const { renkler } = useTema();
  const { t } = useDil();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const sirali = useMemo(() => [...hatalar].sort((a, b) => b.zaman.localeCompare(a.zaman)), [hatalar]);

  return (
    <>
      <View style={s.listeUst}>
        <Text style={s.listeBaslik}>{t(`Kaydedilen hatalar (${hatalar.length})`, `Recorded defects (${hatalar.length})`)}</Text>
        <Text style={s.listeNot}>
          {t('Düzeltmek, silmek ya da fotoğraf eklemek için kayda dokunun.', 'Tap a record to edit, delete or add photos.')}
        </Text>
      </View>
      <ScrollView style={{ flexGrow: 1 }} contentContainerStyle={s.listeGovde}>
        {sirali.length === 0 ? (
          <BosDurum simge={S.liste} baslik={t('Henüz hata kaydedilmedi', 'No defects recorded yet')} />
        ) : sirali.map((h, i) => (
          <KayitSatiri key={h.id} hata={h} sira={sirali.length - i} onPress={() => onAc(h)} />
        ))}
      </ScrollView>
      <View style={s.listeEylem}>
        <Dugme metin={t('Kapat', 'Close')} onPress={onKapat} style={{ flex: 1 }} />
      </View>
    </>
  );
}

const stiller = (r: Renkler) => StyleSheet.create({
  basili: { opacity: 0.72 },

  kapsamOzeti: { ...tipografi.caption, color: r.metinIkincil, textAlign: 'center' },
  tamamBandi: { paddingHorizontal: bosluk.md, paddingTop: bosluk.sm, paddingBottom: bosluk.xs, backgroundColor: r.bg },

  // İki bölme (tablet)
  ikiBolme: { flex: 1, flexDirection: 'row' },
  solBolme: {
    width: '36%', minWidth: 300, maxWidth: 420,
    borderRightWidth: 1, borderRightColor: r.cizgi,
  },
  sagBolme: { flex: 1, minWidth: 0 },

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
    flexGrow: 1, flexBasis: 150, minHeight: 52, justifyContent: 'center', gap: 2,
    paddingHorizontal: bosluk.sm, paddingVertical: bosluk.xs,
    borderRadius: kose.md, borderWidth: 1, borderColor: r.cizgi, backgroundColor: r.yuzey,
  },
  hataDugmeBasili: { borderColor: r.birincil, backgroundColor: r.birincilYumusak },
  hataDugmeUst: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  hataAd: { ...tipografi.bodyOrta, color: r.metin, flex: 1 },
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
  kayitDerecesi: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  kayitDerecesiMetin: { ...tipografi.captionOrta, color: r.metinIkincil },

  // Bildirim — iki temada da uygulama çubuğunun koyu yüzeyi.
  bildirimKap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: bosluk.md },
  bildirim: {
    width: '100%', maxWidth: 640,
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: bosluk.sm,
    paddingLeft: bosluk.md, paddingRight: bosluk.xs, minHeight: 58,
    borderRadius: kose.lg, backgroundColor: r.ters, borderWidth: 1, borderColor: r.tersCizgi,
    boxShadow: `0 6px 18px ${r.golge}`,
  },
  bildirimSol: { flexGrow: 1, flexBasis: 220, flexDirection: 'row', alignItems: 'center', gap: bosluk.xs, paddingVertical: bosluk.xs },
  bildirimDugmeler: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 'auto' },
  bildirimMetin: { ...tipografi.bodyOrta, color: r.tersMetin, flex: 1 },
  geriAlDugme: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    minHeight: DOKUNMA, paddingHorizontal: bosluk.sm, borderRadius: kose.md,
  },
  geriAlMetin: { ...tipografi.bodyOrta, color: r.tersVurgu },

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
