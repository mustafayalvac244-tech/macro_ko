import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AracGorselleriAyari } from '@/bilesenler/AracGorselleriAyari';
import { ListeDuzenle, useSecimListesi } from '@/bilesenler/EklenebilirSecim';
import { SurumKarti } from '@/bilesenler/Guncelleme';
import { GRUP_SIMGELERI, S, Simge } from '@/bilesenler/simgeler';
import {
  Baslik, BilgiKutusu, BolumBasligi, Dugme, Ekran, Kart, Secenek, useDuzen,
} from '@/bilesenler/temel';
import { grupAdi } from '@/cekirdek/katalog';
import { HAZIR_DENETCILER, HAZIR_KAYNAKLAR, LISTE_ANAHTARI } from '@/cekirdek/listeler';
import { bosluk, kose, Renkler, TemaTercihi, tipografi, useTema } from '@/tema';
import { bekleyenSenkron, hataTipiKullanimi } from '@/veri/depo';
import { nasExcelOlustur, yedekOlustur } from '@/veri/yedek';
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
  const excelAktar = async () => {
    setAktariliyor(true); setAktarSonucu(null); setAktarHatasi(null);
    try {
      const x = await nasExcelOlustur();
      setAktarSonucu(
        t(`${x.denetim} araç, ${x.problem} problem satırı.`, `${x.denetim} ${x.denetim === 1 ? 'vehicle' : 'vehicles'}, ${x.problem} problem ${x.problem === 1 ? 'row' : 'rows'}.`)
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
      <Baslik baslik={t('Ayarlar', 'Settings')} />
      <ScrollView contentContainerStyle={s.govde}>
        {/* Sürüm ve tek dokunuşla güncelleme EN ÜSTTE (26.10.2026, ürün
            sahibi: "güncelleme butonu koy"). Web'de gizli. */}
        <SurumKarti />

        <Kart>
          <BolumBasligi metin={t('Görünüm', 'Appearance')} simge={S.gorunum} />
          <View style={s.satir}>
            {TEMALAR.map((x) => (
              <Secenek
                key={x.deger}
                metin={dil === 'en' ? x.en : x.etiket}
                simge={en >= 600 ? x.simge : undefined}
                erisimEtiketi={t(`${x.etiket} tema`, `${x.en} theme`)}
                secili={tercih === x.deger}
                onPress={() => tercihiAyarla(x.deger)}
                style={{ flex: 1 }}
              />
            ))}
          </View>
          {/* Dil (26.10.2026, ürün sahibi: "İng Türkçe seçenek de olsun").
              Seçenek adları kendi dillerinde yazılır: dili bilmeyen biri de
              kendi dilini bulsun. Excel/CSV raporunun dili bundan bağımsız. */}
          <Text style={s.aciklama}>{t('Dil', 'Language')}</Text>
          <View style={s.satir}>
            {([['tr', 'Türkçe'], ['en', 'English']] as const).map(([kod, ad]) => (
              <Secenek
                key={kod}
                metin={ad}
                erisimEtiketi={`${t('Dil', 'Language')}: ${ad}`}
                secili={dil === kod}
                onPress={() => dilAyarla(kod)}
                style={{ flex: 1 }}
              />
            ))}
          </View>
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
          <BolumBasligi metin="Problem source" simge={S.etiket} />
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
          <BolumBasligi metin={t('Araç görselleri (360°)', 'Vehicle images (360°)')} simge={S.arac} />
          <AracGorselleriAyari />
        </Kart>

        <Kart>
          <BolumBasligi metin={t('Veri', 'Data')} simge={S.veri} />
          {/* "Gönderilmeyi bekliyor" demiyoruz: gönderen bir kod yok, sunucu
              kurulmadı. Sayı, cihazda duran satırların sayısıdır. */}
          <BilgiKutusu
            metin={bekleyen > 0
              ? t(
                `${bekleyen} kayıt (denetim, hata ve fotoğraf satırı) yalnız bu cihazda. Merkezi sunucu bağlantısı henüz kurulmadı; dışarı almak için denetim raporunu Excel olarak paylaşın.`,
                `${bekleyen} ${bekleyen === 1 ? 'record' : 'records'} (audit, defect and photo rows) on this device only. There is no central server connection yet; to get data out, share the audit report as Excel.`,
              )
              : t('Cihazda kayıt yok.', 'No records on the device.')}
          />
          <Text style={s.aciklama}>
            {t(
              "Yedek: bütün denetimler, hatalar ve fotoğraflar tek zip dosyasında; Drive'a ya da e-postaya koyun. "
              + 'Telefon kaybolursa tek kopya budur. Geri yükleme henüz yok; dosya düz JSON + JPEG.',
              'Backup: all audits, defects and photos in a single zip file; put it on Drive or in an email. '
              + 'If the phone is lost, this is the only copy. No restore yet; the file is plain JSON + JPEG.',
            )}
          </Text>
          <Dugme
            metin={t('Yedek al (zip)', 'Back up (zip)')}
            simge={S.veri}
            yukleniyor={yedekleniyor}
            onPress={yedekAl}
            erisimEtiketi={t('Tüm verinin yedeğini al', 'Back up all data')}
          />
          {yedekSonucu ? <BilgiKutusu tur="basari" metin={yedekSonucu} /> : null}
          {yedekHatasi ? <BilgiKutusu tur="uyari" metin={yedekHatasi} /> : null}

          <Text style={s.aciklama}>
            {t(
              "Excel'e aktar: bütün denetimler, ekibin Excel'indeki AUDIT_CARS_LIST ve PROBLEMS_LIST sütunlarıyla. "
              + 'Satırlar o dosyaya yapıştırılabilir. Fotoğraflar bu dosyada yok; PHOTO LINK yedekteki dosya adını yazar.',
              "Export to Excel: all audits, with the AUDIT_CARS_LIST and PROBLEMS_LIST columns of the team's Excel. "
              + 'The rows can be pasted into that file. Photos are not in this file; PHOTO LINK gives the file name in the backup.',
            )}
          </Text>
          <Dugme
            metin={t("Excel'e aktar (NAS)", 'Export to Excel (NAS)')}
            simge={S.rapor}
            yukleniyor={aktariliyor}
            onPress={excelAktar}
            erisimEtiketi={t('Bütün denetimleri ekibin Excel düzeninde aktar', "Export all audits in the team's Excel layout")}
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
  satir: { flexDirection: 'row', gap: bosluk.xs },
  tipSatiri: {
    flexDirection: 'row', alignItems: 'center', gap: bosluk.sm,
    padding: bosluk.xs, borderRadius: kose.md,
    borderWidth: 1, borderColor: r.cizgiSolgun, backgroundColor: r.yuzey,
  },
  tipAd: { ...tipografi.bodyOrta, color: r.metin },
  tipNotSatir: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tipNot: { ...tipografi.caption, color: r.metinSolgun, flexShrink: 1 },
});
