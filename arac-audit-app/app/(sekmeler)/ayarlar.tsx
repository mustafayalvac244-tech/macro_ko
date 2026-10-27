import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AracGorselleriAyari } from '@/bilesenler/AracGorselleriAyari';
import { ListeDuzenle, useSecimListesi } from '@/bilesenler/EklenebilirSecim';
import { SurumKarti } from '@/bilesenler/Guncelleme';
import { GRUP_SIMGELERI, S, Simge } from '@/bilesenler/simgeler';
import {
  Baslik, BilgiKutusu, BolumBasligi, Dugme, Ekran, Kart, OnayKutusu, Secenek, SegmentSecici, useDuzen,
} from '@/bilesenler/temel';
import { AktarimDonemi } from '@/cekirdek/aktarim';
import { grupAdi } from '@/cekirdek/katalog';
import { DONEMLER } from '@/cekirdek/sayac';
import { bicimTarih } from '@/cekirdek/rapor';
import { HAZIR_DENETCILER, HAZIR_KAYNAKLAR, LISTE_ANAHTARI } from '@/cekirdek/listeler';
import { bosluk, kose, Renkler, TemaTercihi, tipografi, useTema } from '@/tema';
import { bekleyenSenkron, hataTipiKullanimi } from '@/veri/depo';
import { nasExcelOlustur, yedekGeriYukle, yedekOlustur } from '@/veri/yedek';
import { useDil, useDilDeposu } from '@/veri/dilDeposu';
import { useKatalog } from '@/veri/katalogDeposu';

const TEMALAR: { deger: TemaTercihi; etiket: string; en: string; simge: Simge }[] = [
  { deger: 'sistem', etiket: 'Sistem', en: 'System', simge: S.sistemTema },
  { deger: 'acik', etiket: 'Açık', en: 'Light', simge: S.acikTema },
  { deger: 'koyu', etiket: 'Koyu', en: 'Dark', simge: S.koyuTema },
];

export default function Ayarlar() {
  const { renkler, tercih, tercihiAyarla } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  // Telefonda üç seçenek yan yana; simge + ad + tik sığmıyor, "Sistem" "Sis…"
  // diye kesiliyordu (28.09.2026 ekran görüntüsü). Dar ekranda simge düşer;
  // tik kalır, çünkü seçimi yalnız renkle değil onunla da gösteriyoruz.
  const { en } = useDuzen();
  const { dil, t } = useDil();
  const dilAyarla = useDilDeposu((d) => d.ayarla);
  const denetciler = useSecimListesi(LISTE_ANAHTARI.denetci, HAZIR_DENETCILER);
  const kaynaklar = useSecimListesi(LISTE_ANAHTARI.kaynak, HAZIR_KAYNAKLAR);

  const [bekleyen, setBekleyen] = useState(0);
  // TAM YEDEK (yedek.ts): kayıtlar yalnız cihazda; bu, kaybolmaya karşı tek önlem.
  const [yedekleniyor, setYedekleniyor] = useState(false);
  const [yedekSonucu, setYedekSonucu] = useState<string | null>(null);
  const [yedekHatasi, setYedekHatasi] = useState<string | null>(null);
  // GERİ YÜKLEME (26.10.2026): önce sorulur; kayıtlar eklenir, var olan değişmez.
  const [geriSoru, setGeriSoru] = useState(false);
  const [geriYukleniyor, setGeriYukleniyor] = useState(false);
  const [geriSonucu, setGeriSonucu] = useState<string | null>(null);
  const [geriHatasi, setGeriHatasi] = useState<string | null>(null);
  const geriYukle = async () => {
    setGeriSoru(false); setGeriYukleniyor(true); setGeriSonucu(null); setGeriHatasi(null);
    try {
      const g = await yedekGeriYukle();
      if (g.iptal) return;
      setGeriSonucu(t(
        `Yedek (${g.yedekTarihi ? bicimTarih(g.yedekTarihi) : 'tarihsiz'}) yüklendi: ${g.denetim} denetim, ${g.hata} hata, ${g.foto} fotoğraf eklendi.`
          + (g.zatenVarDenetim ? ` ${g.zatenVarDenetim} denetim telefonda zaten vardı, dokunulmadı.` : ''),
        `Backup (${g.yedekTarihi ? bicimTarih(g.yedekTarihi) : 'undated'}) restored: added ${g.denetim} audits, ${g.hata} defects, ${g.foto} photos.`
          + (g.zatenVarDenetim ? ` ${g.zatenVarDenetim} audits were already on the phone and left unchanged.` : ''),
      ));
      bekleyenSenkron().then(setBekleyen).catch(() => {});
    } catch (h) {
      setGeriHatasi(t(`Geri yüklenemedi: ${h instanceof Error ? h.message : String(h)}`, `Restore failed: ${h instanceof Error ? h.message : String(h)}`));
    } finally {
      setGeriYukleniyor(false);
    }
  };
  const yedekAl = async () => {
    setYedekleniyor(true); setYedekSonucu(null); setYedekHatasi(null);
    try {
      const y = await yedekOlustur();
      const mb = (y.bayt / 1_048_576).toFixed(1).replace('.', ',');
      setYedekSonucu(
        t(
          `${y.denetim} denetim, ${y.hata} hata, ${y.foto} fotoğraf — ${mb} MB.`,
          // İngilizcede ondalık ayırıcı nokta.
          `${y.denetim} ${y.denetim === 1 ? 'audit' : 'audits'}, ${y.hata} ${y.hata === 1 ? 'defect' : 'defects'}, ${y.foto} ${y.foto === 1 ? 'photo' : 'photos'} — ${mb.replace(',', '.')} MB.`,
        )
        + (y.eksikFoto ? t(` ${y.eksikFoto} fotoğrafın dosyası bulunamadı, yedeğe girmedi.`, ` ${y.eksikFoto} photo ${y.eksikFoto === 1 ? 'file was' : 'files were'} not found and left out of the backup.`) : '')
        + (y.paylasildi ? '' : t(` Paylaşım yok; dosya: ${y.uri}`, ` Sharing unavailable; file: ${y.uri}`)),
      );
    } catch (h) {
      setYedekHatasi(t(`Yedek alınamadı: ${h instanceof Error ? h.message : String(h)}`, `Backup failed: ${h instanceof Error ? h.message : String(h)}`));
    } finally {
      setYedekleniyor(false);
    }
  };

  // EXCEL'E AKTAR (26.10.2026): ekibin Excel'indeki iki liste sayfası.
  const [aktariliyor, setAktariliyor] = useState(false);
  const [aktarSonucu, setAktarSonucu] = useState<string | null>(null);
  const [aktarHatasi, setAktarHatasi] = useState<string | null>(null);
  // Dönem ve "devam edenler" (26.10.2026, aktarim.ts): varsayılan yalnız bitmişler.
  const [aktarDonem, setAktarDonem] = useState<AktarimDonemi>('hepsi');
  const [devamDahil, setDevamDahil] = useState(false);
  const excelAktar = async () => {
    setAktariliyor(true); setAktarSonucu(null); setAktarHatasi(null);
    try {
      const x = await nasExcelOlustur(new Date(), { donem: aktarDonem, devamDahil });
      const devamNotu = x.disaridaDevam
        ? t(` Devam eden ${x.disaridaDevam} denetim katılmadı.`, ` ${x.disaridaDevam} in-progress ${x.disaridaDevam === 1 ? 'audit was' : 'audits were'} left out.`)
        : '';
      if (!x.denetim) {
        setAktarHatasi(t('Bu seçimde aktarılacak denetim yok.', 'No audits to export for this selection.') + devamNotu);
        return;
      }
      setAktarSonucu(
        t(`${x.denetim} araç, ${x.problem} hata.`, `${x.denetim} ${x.denetim === 1 ? 'vehicle' : 'vehicles'}, ${x.problem} ${x.problem === 1 ? 'defect' : 'defects'}.`)
        + devamNotu
        + (x.paylasildi ? '' : t(` Paylaşım yok; dosya: ${x.uri}`, ` Sharing unavailable; file: ${x.uri}`)),
      );
    } catch (h) {
      setAktarHatasi(t(`Excel dosyası oluşturulamadı: ${h instanceof Error ? h.message : String(h)}`, `Could not create the Excel file: ${h instanceof Error ? h.message : String(h)}`));
    } finally {
      setAktariliyor(false);
    }
  };

  useEffect(() => {
    bekleyenSenkron().then(setBekleyen).catch(() => {});
  }, []);

  return (
    <Ekran>
      <Baslik baslik={t('Ayarlar', 'Settings')} icerikGenisligi={760} />
      <ScrollView contentContainerStyle={s.govde}>
        {/* Sürüm ve tek dokunuşla güncelleme EN ÜSTTE (26.10.2026, ürün
            sahibi: "güncelleme butonu koy"). Web'de gizli. */}
        <SurumKarti />

        <Kart>
          <BolumBasligi metin={t('Görünüm', 'Appearance')} simge={S.gorunum} />
          <SegmentSecici
            secenekler={TEMALAR.map((x) => ({
              id: x.deger, metin: dil === 'en' ? x.en : x.etiket, simge: en >= 600 ? x.simge : undefined,
              erisimEtiketi: t(`${x.etiket} tema`, `${x.en} theme`),
            }))}
            deger={tercih}
            onSec={(x) => x && tercihiAyarla(x)}
            erisimEtiketi={t('Tema', 'Theme')}
          />
          {/* Dil (26.10.2026, ürün sahibi: "İng Türkçe seçenek de olsun").
              Seçenek adları kendi dillerinde yazılır: dili bilmeyen biri de
              kendi dilini bulsun. Excel/CSV raporunun dili bundan bağımsız. */}
          <Text style={s.aciklama}>{t('Dil', 'Language')}</Text>
          <SegmentSecici
            secenekler={([['tr', 'Türkçe'], ['en', 'English']] as const).map(([kod, ad]) => ({
              id: kod, metin: ad, erisimEtiketi: `${t('Dil', 'Language')}: ${ad}`,
            }))}
            deger={dil}
            onSec={(x) => x && dilAyarla(x)}
            erisimEtiketi={t('Dil', 'Language')}
          />
        </Kart>

        {/* Yeni denetim formundaki hazır seçenekler. Kaldırılan ad eski
            denetimlerde yazılı kalır; yalnız yeni denetimde seçilemez. */}
        <Kart>
          <BolumBasligi metin={t('Denetçiler', 'Auditors')} simge={S.ekip} />
          <Text style={s.aciklama}>{t('Yeni denetimde listeden seçilir. Bu cihazda saklanır; başka tablete geçmez.', 'Picked from this list in a new audit. Stored on this device; not copied to other tablets.')}</Text>
          <ListeDuzenle ad={t('Denetçi', 'Auditor')} liste={denetciler} yerTutucu={t('Ad Soyad', 'Full name')} />
        </Kart>

        {/* FAZLAR listesi kalktı: faz formdan çıktı (ürün sahibi, 24.10.2026). */}

        <Kart>
          <BolumBasligi metin={t('Hata kaynağı', 'Problem source')} simge={S.etiket} />
          <Text style={s.aciklama}>{t("Ekibin Excel'indeki liste. Yeni denetimde seçilir ve hatırlanır; Audit skoruna yalnız AUDIT girer.", "The list from the team's Excel. Picked in a new audit and remembered; only AUDIT counts toward the audit score.")}</Text>
          <ListeDuzenle ad={t('Kaynak', 'Source')} liste={kaynaklar} yerTutucu={t('Örn. LONG TERM', 'E.g. LONG TERM')} />
        </Kart>

        <Kart>
          <BolumBasligi metin={t('Ekibin eklediği hata tipleri', 'Defect types added by the team')} simge={S.etiket} />
          <OzelTipler />
        </Kart>

        {/* Döndürülebilir araç (26.10.2026): dokuz bakış yuvasına galeriden
            görsel seçme; görseller yalnız bu telefonda durur. */}
        <Kart>
          <BolumBasligi
            metin={t('Araç görselleri (360°)', 'Vehicle images (360°)')}
            simge={S.arac}
            bilgi={t(
              'IONIQ 3 denetimde görsel yüklemeden de döner: uygulama aracın kendi çizimini gösterir. Gerçek görsel isterseniz standart bakış görsellerini (önden, sol önden, soldan … üstten) her bakışa seçin; görsel çizimin yerini alır. Eksik bir yan, karşı yanın aynasıyla gösterilir.',
              'IONIQ 3 rotates in the audit without any images: the app shows its own drawing of the vehicle. For real pictures, pick the standard view images (front, front LH, LH side … top) for each view; an image replaces the drawing. A missing side is shown as the mirror of the opposite side.',
            )}
          />
          <AracGorselleriAyari />
        </Kart>

        <Kart>
          <BolumBasligi metin={t('Veri', 'Data')} simge={S.veri} />
          {/* "Gönderilmeyi bekliyor" demiyoruz: gönderen bir kod yok, sunucu
              kurulmadı. Satır sayısı yazılmıyor (26.10.2026 dış değerlendirme:
              "7 kayıt (… satırı)" geliştirici dili); kullanıcıya gereken tek bilgi
              verinin nerede durduğu. */}
          <BilgiKutusu
            tur={bekleyen > 0 ? 'uyari' : 'bilgi'}
            metin={bekleyen > 0
              ? t(
                'Kayıtlar yalnız bu telefonda; sunucuya gönderilmiyor. Telefon kaybolursa elinizde yalnız yedek kalır: her vardiya sonunda yedek alın.',
                'Records are on this phone only; nothing is sent to a server. If the phone is lost, only the backup remains: back up at the end of every shift.',
              )
              : t('Telefonda kayıt yok.', 'No records on this phone.')}
          />
          <Text style={s.aciklama}>
            {t(
              'Bütün denetimler, hatalar ve fotoğraflar tek dosyada. Drive\'a ya da e-postaya koyun; yeni telefonda "Yedekten geri yükle" ile geri gelir.',
              'All audits, defects and photos in one file. Put it on Drive or in an email; on a new phone, "Restore from backup" brings it back.',
            )}
          </Text>
          <Dugme
            metin={t('Yedek al', 'Back up')}
            simge={S.veri}
            yukleniyor={yedekleniyor}
            onPress={yedekAl}
            erisimEtiketi={t('Tüm verinin yedeğini al', 'Back up all data')}
          />
          {yedekSonucu ? <BilgiKutusu tur="basari" metin={yedekSonucu} /> : null}
          {yedekHatasi ? <BilgiKutusu tur="uyari" metin={yedekHatasi} /> : null}
          {geriSoru ? (
            <View style={{ gap: bosluk.xs }} testID="geri-yukle-onay">
              <BilgiKutusu
                tur="uyari"
                metin={t(
                  'Seçeceğiniz yedekteki kayıtlar bu telefona EKLENİR. Telefonda zaten olan kayıtlar değişmez, silinmez.',
                  'Records in the backup you pick are ADDED to this phone. Records already on the phone are not changed or deleted.',
                )}
              />
              <View style={{ flexDirection: 'row', gap: bosluk.xs }}>
                <Dugme metin={t('Vazgeç', 'Cancel')} tur="sessiz" onPress={() => setGeriSoru(false)} style={{ flex: 1 }} />
                <Dugme metin={t('Yedek dosyasını seç', 'Pick backup file')} tur="birincil" onPress={geriYukle} style={{ flex: 1.4 }} />
              </View>
            </View>
          ) : (
            <Dugme
              metin={t('Yedekten geri yükle', 'Restore from backup')}
              simge={S.geriAl}
              yukleniyor={geriYukleniyor}
              onPress={() => { setGeriSoru(true); setGeriSonucu(null); setGeriHatasi(null); }}
              erisimEtiketi={t('Yedek zip dosyasından kayıtları geri yükle', 'Restore records from a backup zip')}
            />
          )}
          {geriSonucu ? <BilgiKutusu tur="basari" metin={geriSonucu} /> : null}
          {geriHatasi ? <BilgiKutusu tur="uyari" metin={geriHatasi} /> : null}

          <Text style={s.aciklama}>
            {t(
              "Bitmiş denetimler ekibin Excel sütunlarıyla; satırlar kopyalanıp ekibin dosyasına yapıştırılabilir. Fotoğraflar bu dosyada değil, yedekte.",
              "Finished audits in the team's Excel columns; the rows can be pasted into the team's file. Photos are not in this file; they are in the backup.",
            )}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.aktarDonemSatir}
            accessibilityRole="radiogroup" accessibilityLabel={t('Aktarılacak dönem', 'Period to export')}>
            {([{ id: 'hepsi', ad: 'Hepsi', en: 'All' }, ...DONEMLER.map((d) => ({ id: d.id, ad: d.uzun, en: d.enUzun }))] as const).map((d) => (
              <Secenek
                key={d.id}
                kucuk
                metin={t(d.ad, d.en)}
                secili={aktarDonem === d.id}
                onPress={() => setAktarDonem(d.id)}
                erisimEtiketi={t(`Dönem: ${d.ad}`, `Period: ${d.en}`)}
              />
            ))}
          </ScrollView>
          <OnayKutusu
            metin={t('Devam edenleri de kat', 'Include in-progress audits')}
            secili={devamDahil}
            onPress={() => setDevamDahil((x) => !x)}
            erisimEtiketi={t('Devam eden denetimleri de kat', 'Include in-progress audits')}
          />
          <Dugme
            metin={t("Excel'e aktar", 'Export to Excel')}
            simge={S.excel}
            yukleniyor={aktariliyor}
            onPress={excelAktar}
            erisimEtiketi={t('Seçilen denetimleri ekibin Excel düzeninde aktar', "Export the selected audits in the team's Excel layout")}
          />
          {aktarSonucu ? <BilgiKutusu tur="basari" metin={aktarSonucu} /> : null}
          {aktarHatasi ? <BilgiKutusu tur="uyari" metin={aktarHatasi} /> : null}
        </Kart>

      </ScrollView>
    </Ekran>
  );
}

/**
 * Uygulama içinden eklenen hata tiplerini yönetir.
 *
 * KALDIRMA GERÇEK SİLME DEĞİLDİR ve öyle olmamalı: eski hatalar bu kimliğe
 * bağlı, satırı silsek geçmiş raporlarda hata adı yerine "ht_m4x9…" görünür.
 * Kaldırılan tip seçim listesinden çıkar, raporlarda adıyla kalır. Kaç kayıtta
 * kullanıldığı da gösterilir ki denetçi ne kaldırdığını bilerek yapsın.
 */
function OzelTipler() {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const { dil, t } = useDil();
  const tipler = useKatalog((d) => d.ozelTipler);
  const kaldir = useKatalog((d) => d.kaldir);
  const geriAl = useKatalog((d) => d.geriAl);
  const [kullanim, setKullanim] = useState<Record<string, number>>({});

  useEffect(() => {
    let iptal = false;
    Promise.all(tipler.map(async (tip) => [tip.id, await hataTipiKullanimi(tip.id)] as const))
      .then((c) => { if (!iptal) setKullanim(Object.fromEntries(c)); })
      .catch(() => { /* sayı gösterilemezse liste yine de çalışır */ });
    return () => { iptal = true; };
  }, [tipler]);

  if (tipler.length === 0) {
    return (
      <BilgiKutusu metin={t('Henüz eklenmedi. Hata kaydı ekranında aradığınız hatayı bulamazsanız oradan ekleyebilirsiniz; eklediğiniz tip listeye kalıcı olarak girer.', 'None added yet. If you cannot find a defect on the defect entry screen, you can add it there; the type you add stays in the list for good.')} />
    );
  }

  return (
    <>
      {tipler.map((tip) => {
        const GrupIkon = GRUP_SIMGELERI[tip.grup];
        // İngilizce arayüzde önce İngilizce ad (boşsa Türkçesi); öbür dildeki
        // ad, bugünkü gibi alt satırda.
        const anaAd = dil === 'en' ? (tip.en || tip.ad) : tip.ad;
        const ikinciAd = dil === 'en' ? (tip.en ? tip.ad : null) : (tip.en || null);
        const kullanimAdedi = kullanim[tip.id] ?? 0;
        return (
        <View key={tip.id} style={[s.tipSatiri, tip.silindi && { opacity: 0.6 }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.tipAd} numberOfLines={2}>
              {anaAd}{tip.silindi ? t(' — listeden kaldırıldı', ' — removed from list') : ''}
            </Text>
            <View style={s.tipNotSatir}>
              {GrupIkon ? <GrupIkon size={13} color={renkler.metinSolgun} strokeWidth={2} /> : null}
              <Text style={s.tipNot} numberOfLines={2}>
              {[
                grupAdi(tip.grup, dil),
                ikinciAd,
                tip.ekleyen ? t(`ekleyen: ${tip.ekleyen}`, `added by: ${tip.ekleyen}`) : null,
                t(`${kullanimAdedi} kayıtta kullanıldı`, `used in ${kullanimAdedi} ${kullanimAdedi === 1 ? 'record' : 'records'}`),
              ].filter(Boolean).join(' · ')}
              </Text>
            </View>
          </View>
          <Dugme
            metin={tip.silindi ? t('Geri al', 'Restore') : t('Kaldır', 'Remove')}
            simge={tip.silindi ? S.geriAl : S.sil}
            kucuk
            tur={tip.silindi ? 'ikincil' : 'sessiz'}
            erisimEtiketi={`${anaAd}: ${tip.silindi ? t('listeye geri al', 'restore to list') : t('listeden kaldır', 'remove from list')}`}
            onPress={() => (tip.silindi ? geriAl(tip.id) : kaldir(tip.id))}
          />
        </View>
        );
      })}
    </>
  );
}

const stiller = (r: Renkler) => StyleSheet.create({
  govde: {
    padding: bosluk.md, gap: bosluk.md, paddingBottom: bosluk.xxxl,
    width: '100%', maxWidth: 760, alignSelf: 'center',
  },
  aciklama: { ...tipografi.caption, color: r.metinSolgun },
  aktarDonemSatir: { flexDirection: 'row', gap: bosluk.xs },
  satir: { flexDirection: 'row', gap: bosluk.xs },
  tipSatiri: {
    flexDirection: 'row', alignItems: 'center', gap: bosluk.sm,
    padding: bosluk.xs, borderRadius: kose.md, backgroundColor: r.yuzeyAlt,
  },
  tipAd: { ...tipografi.bodyOrta, color: r.metin },
  tipNotSatir: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tipNot: { ...tipografi.caption, color: r.metinSolgun, flexShrink: 1 },
});
