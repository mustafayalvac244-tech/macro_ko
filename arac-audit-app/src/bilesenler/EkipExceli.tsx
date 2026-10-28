// EKİBİN EXCEL'İNE EKLE (27.10.2026) — Ayarlar > Veri.
//
// Ürün sahibi: "excel formati atsam çıktı otomatik doldurur dimi". Denetçi
// ekibin NAS dosyasını seçer; seçili denetimler dosyanın iki liste sayfasının
// sonuna eklenir (cekirdek/ekipExceli.ts). Paylaşmadan önce hangi parçanın /
// tipin Excel'e hangi adla yazılacağı gösterilir: eşleme otomatik ve yanlış
// olabilir (ölçüldü, README Aşama 8); denetçi düzeltir, seçimi telefonda kalır.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { S } from '@/bilesenler/simgeler';
import { AramaKutusu, BilgiKutusu, Dugme, Secenek } from '@/bilesenler/temel';
import { AktarimSecimi } from '@/cekirdek/aktarim';
import { aramaEslesir, aramaMetni } from '@/cekirdek/arama';
import { etiketAnahtari } from '@/cekirdek/ekipEslemesi';
import { DegisenAlan, DoldurmaSonucu, ekipExceliniDoldur, ElleEsleme, EslemeSatiri } from '@/cekirdek/ekipExceli';
import { hataMetni } from '@/cekirdek/hataMetni';
import { hataTipiAdi, parcaTamAdi } from '@/cekirdek/katalog';
import { takipAdi } from '@/cekirdek/takip';
import { Denetim } from '@/cekirdek/tipler';
import { bosluk, kose, Renkler, tipografi, useTema } from '@/tema';
import { useDil } from '@/veri/dilDeposu';
import {
  ekipDenetimleri, ekipDosyasiniPaylas, ekipDosyasiSec, elleEslemeOku, elleEslemeYaz, gonderimKaydiEkle,
  gonderimKaydiOku, SecilenDosya,
} from '@/veri/yedek';

const satirAnahtari = (e: Pick<EslemeSatiri, 'tur' | 'anahtar'>) => `${e.tur}:${e.anahtar}`;

export function EkipExceli({ secim }: { secim: AktarimSecimi }) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const { dil, t } = useDil();

  const [elle, setElle] = useState<ElleEsleme>({});
  const [hazirlaniyor, setHazirlaniyor] = useState(false);
  const [paylasiliyor, setPaylasiliyor] = useState(false);
  const [sonuc, setSonuc] = useState<DoldurmaSonucu | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [not, setNot] = useState<string | null>(null);
  const [paylasildi, setPaylasildi] = useState<string | null>(null);
  const [duzenlenen, setDuzenlenen] = useState<string | null>(null);
  const [arama, setArama] = useState('');
  const dosya = useRef<SecilenDosya | null>(null);
  const denetimler = useRef<Denetim[]>([]);

  useEffect(() => { elleEslemeOku().then(setElle).catch(() => {}); }, []);

  const hazirla = async (eslemeler: ElleEsleme) => {
    if (!dosya.current) return;
    setHazirlaniyor(true); setHata(null); setPaylasildi(null);
    // Doldurma eşzamanlı ve büyük dosyada saniyeler sürebilir: önce dönen
    // göstergenin çizilmesine fırsat ver.
    await new Promise((r) => setTimeout(r, 30));
    try {
      // Gönderim izi her doldurmada tazeden okunur: başka bir doldurma az önce yazmış olabilir.
      const gonderilen = await gonderimKaydiOku().catch(() => ({}));
      setSonuc(ekipExceliniDoldur(dosya.current.bayt, denetimler.current, { elleEsleme: eslemeler, gonderilen }));
    } catch (h) {
      setSonuc(null);
      setHata(t(`Dosya doldurulamadı: ${hataMetni(h, 'tr')}`, `Could not fill the file: ${hataMetni(h, 'en')}`));
    } finally {
      setHazirlaniyor(false);
    }
  };

  const basla = async () => {
    setHata(null); setNot(null); setPaylasildi(null); setDuzenlenen(null);
    try {
      const { secilen, disaridaDevam } = await ekipDenetimleri(secim);
      const devamNotu = disaridaDevam
        ? t(`Devam eden ${disaridaDevam} denetim katılmadı.`, `${disaridaDevam} in-progress ${disaridaDevam === 1 ? 'audit was' : 'audits were'} left out.`)
        : null;
      if (!secilen.length) {
        setSonuc(null);
        setHata(t('Bu seçimde eklenecek denetim yok.', 'No audits to add for this selection.') + (devamNotu ? ` ${devamNotu}` : ''));
        return;
      }
      const d = await ekipDosyasiSec();
      if (!d) return;
      dosya.current = d;
      denetimler.current = secilen;
      setNot(devamNotu);
      await hazirla(elle);
    } catch (h) {
      setHata(t(`Dosya açılamadı: ${hataMetni(h, 'tr')}`, `Could not open the file: ${hataMetni(h, 'en')}`));
    }
  };

  /** deger: yazılacak etiket; '' uygulamanın adı; null otomatik seçime dön. */
  const eslemeDegistir = async (e: EslemeSatiri, deger: string | null) => {
    const tur = { ...(elle[e.tur] ?? {}) };
    if (deger === null) delete tur[e.anahtar]; else tur[e.anahtar] = deger;
    const yeni: ElleEsleme = { ...elle, [e.tur]: tur };
    setElle(yeni); setDuzenlenen(null); setArama('');
    await elleEslemeYaz(yeni).catch(() => {});
    await hazirla(yeni);
  };

  const paylas = async () => {
    if (!dosya.current || !sonuc) return;
    setPaylasiliyor(true); setHata(null);
    try {
      const p = await ekipDosyasiniPaylas(dosya.current.ad, sonuc.bayt);
      // Paylaşım penceresi kapanınca gönderilmiş sayılır (vazgeçildiyse de):
      // zararsız, çünkü iz yalnız satırı dosyada BULURSA kullanılıyor.
      await gonderimKaydiEkle(sonuc.gonderim).catch(() => {});
      setPaylasildi(p.paylasildi
        ? t(
          `"${dosya.current.ad}" hazır. NAS'taki dosyanın yerine koyun. Makroya ve öbür sayfalara dokunulmadı.`,
          `"${dosya.current.ad}" is ready. Put it in place of the file on the NAS. The macro and the other sheets were not touched.`,
        )
        : t(`Paylaşım yok; dosya: ${p.uri}`, `Sharing unavailable; file: ${p.uri}`));
    } catch (h) {
      setHata(t(`Paylaşılamadı: ${hataMetni(h, 'tr')}`, `Could not share: ${hataMetni(h, 'en')}`));
    } finally {
      setPaylasiliyor(false);
    }
  };

  const eklenen = sonuc ? sonuc.aracEklendi + sonuc.problemEklendi : 0;
  // Dikkat isteyenler (ekipte karşılığı yok) önce, sonra çok kullanılan.
  const satirlar = useMemo(() => (sonuc?.esleme ?? []).slice().sort((a, b) =>
    Number(b.kaynak === 'uygulama') - Number(a.kaynak === 'uygulama') || b.adet - a.adet), [sonuc]);

  return (
    <View style={s.kok}>
      <Text style={s.aciklama}>
        {t(
          "Ekibin NAS dosyasını (.xlsm) seçin: seçili denetimler dosyanın araç ve hata listelerinin sonuna, makronun yazdığı biçimde eklenir. Makro ve öbür sayfalar değişmez; dosyada zaten olan araç ve hata tekrar eklenmez.",
          "Pick the team's NAS file (.xlsm): the selected audits are appended to the file's vehicle and defect lists the way the macro writes them. The macro and the other sheets are unchanged; vehicles and defects already in the file are not added again.",
        )}
      </Text>
      <BilgiKutusu
        tur="uyari"
        metin={t(
          "Dosyayı NAS'tan yeni alın ve doldurunca hemen geri koyun: arada başka biri satır eklediyse eski kopyayı üstüne yazmak onun satırlarını siler.",
          'Take a fresh copy from the NAS and put it back right after filling: if someone added rows in between, overwriting with the old copy deletes their rows.',
        )}
      />
      <Dugme
        metin={t("Ekibin Excel'ine ekle", "Add to the team's Excel")}
        simge={S.excel}
        yukleniyor={hazirlaniyor}
        onPress={basla}
        erisimEtiketi={t("Ekibin Excel dosyasını seç ve seçili denetimleri ekle", "Pick the team's Excel file and add the selected audits")}
      />
      {hata ? <BilgiKutusu tur="uyari" metin={hata} /> : null}

      {sonuc ? (
        <View style={s.kok} testID="ekip-excel-sonuc">
          <BilgiKutusu
            tur={eklenen ? 'basari' : 'bilgi'}
            metin={[
              eklenen
                ? t(`${sonuc.aracEklendi} araç, ${sonuc.problemEklendi} hata eklenecek.`, `${sonuc.aracEklendi} ${sonuc.aracEklendi === 1 ? 'vehicle' : 'vehicles'}, ${sonuc.problemEklendi} ${sonuc.problemEklendi === 1 ? 'defect' : 'defects'} will be added.`)
                : t('Eklenecek yeni kayıt yok: hepsi dosyada zaten var.', 'Nothing new to add: everything is already in the file.'),
              sonuc.aracZatenVar ? t(`${sonuc.aracZatenVar} araç listede zaten var; araç satırı eklenmedi.`, `${sonuc.aracZatenVar} ${sonuc.aracZatenVar === 1 ? 'vehicle is' : 'vehicles are'} already listed; no vehicle row added.`) : null,
              sonuc.problemZatenVar ? t(`${sonuc.problemZatenVar} hata dosyada zaten var; eklenmedi.`, `${sonuc.problemZatenVar} ${sonuc.problemZatenVar === 1 ? 'defect is' : 'defects are'} already in the file; not added.`) : null,
              sonuc.baskaAdla ? t(`Bunların ${sonuc.baskaAdla} tanesi daha önce başka adla gönderilmişti; Excel'deki adı eski kaldı.`, `${sonuc.baskaAdla} of them ${sonuc.baskaAdla === 1 ? 'was' : 'were'} sent earlier under another name; the name in Excel is the old one.`) : null,
              not,
            ].filter(Boolean).join(' ')}
          />
          {sonuc.degisenler.length ? (
            <View style={s.kok} testID="ekip-excel-degisenler">
              <BilgiKutusu
                tur="uyari"
                metin={t(
                  `${sonuc.degisenler.length} hata Excel'e gönderildikten sonra uygulamada değişti. Excel'deki satırları ESKİ; tekrar eklenmedi. Excel'de elle düzeltin:`,
                  `${sonuc.degisenler.length} ${sonuc.degisenler.length === 1 ? 'defect was' : 'defects were'} changed in the app after being sent. Their rows in Excel are OLD and were not added again. Fix them in Excel by hand:`,
                )}
              />
              {sonuc.degisenler.map((d) => (
                <Text key={d.hataId} style={s.degisen}>
                  {`Body ${d.govde} · ${d.gun} · ${dil === 'en' ? d.ad.en : d.ad.tr}: `}
                  {d.alanlar.map((a) => alanMetni(a, dil)).join('; ')}
                </Text>
              ))}
            </View>
          ) : null}
          {sonuc.altiHaneOlmayan ? (
            <BilgiKutusu
              tur="uyari"
              metin={t(
                `${sonuc.altiHaneOlmayan} denetimin body numarası 6 hane değil. Ekibin makrosu bunu kabul etmiyor; yine de yazıldı, kontrol edin.`,
                `${sonuc.altiHaneOlmayan} ${sonuc.altiHaneOlmayan === 1 ? "audit's body number is" : "audits' body numbers are"} not 6 digits. The team's macro does not accept that; written anyway, please check.`,
              )}
            />
          ) : null}

          {satirlar.length ? (
            <>
              <Text style={s.altBaslik}>{t("Excel'e yazılacak adlar", 'Names written to Excel')}</Text>
              <Text style={s.aciklama}>
                {t(
                  'Ekibin listesinden otomatik seçildi. Yanlışsa "Değiştir"e dokunun; seçiminiz bu telefonda hatırlanır.',
                  'Picked automatically from the team\'s list. If one is wrong, tap "Change"; your choice is remembered on this phone.',
                )}
              </Text>
              {satirlar.map((e) => (
                <EslemeSatirBileseni
                  key={satirAnahtari(e)}
                  e={e}
                  acik={duzenlenen === satirAnahtari(e)}
                  ac={() => { setDuzenlenen(duzenlenen === satirAnahtari(e) ? null : satirAnahtari(e)); setArama(''); }}
                  arama={arama}
                  setArama={setArama}
                  sonuc={sonuc}
                  elleVar={(elle[e.tur] ?? {})[e.anahtar] !== undefined}
                  sec={(deger) => eslemeDegistir(e, deger)}
                  dil={dil}
                />
              ))}
            </>
          ) : null}

          {eklenen ? (
            <Dugme
              metin={t('Doldurulmuş dosyayı kaydet / paylaş', 'Save / share the filled file')}
              tur="birincil"
              simge={S.excel}
              yukleniyor={paylasiliyor}
              pasif={hazirlaniyor}
              onPress={paylas}
              erisimEtiketi={t('Doldurulmuş Excel dosyasını kaydet ya da paylaş', 'Save or share the filled Excel file')}
            />
          ) : null}
          {paylasildi ? <BilgiKutusu tur="basari" metin={paylasildi} /> : null}
        </View>
      ) : null}
    </View>
  );
}

function EslemeSatirBileseni({ e, acik, ac, arama, setArama, sonuc, elleVar, sec, dil }: {
  e: EslemeSatiri;
  acik: boolean;
  ac: () => void;
  arama: string;
  setArama: (q: string) => void;
  sonuc: DoldurmaSonucu;
  elleVar: boolean;
  sec: (deger: string | null) => void;
  dil: 'tr' | 'en';
}) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const { t } = useDil();
  const ad = dil === 'en' ? e.ad.en : e.ad.tr;
  const kaynakNotu = {
    ekip: t('ekibin listesinden', "from the team's list"),
    elle: t('sizin seçiminiz', 'your choice'),
    uygulama: t('ekibin listesinde karşılığı yok — uygulamanın adı', "no match in the team's list — the app's name"),
  }[e.kaynak];
  const etiketler = e.tur === 'parca' ? sonuc.parcaEtiketleri : sonuc.tipEtiketleri;
  const bulunan = useMemo(() => {
    if (!acik) return [];
    const q = arama.trim();
    const yazilan = etiketAnahtari(e.yazilan);
    const uygun = etiketler.filter((x) => etiketAnahtari(x.ad) !== yazilan && (!q || aramaEslesir(aramaMetni(x.ad), q)));
    // Aramada kısa etiket önce: "hood pnl" → "HOOD PNL", iç sacdan ("HOOD(FRT PNL)
    // INR PNL") önce; eşitlikte sık kullanılan (liste zaten sıklık sırasında).
    const kelime = (x: { ad: string }) => aramaMetni(x.ad).split(' ').length;
    return (q ? uygun.map((x, i) => ({ x, i, k: kelime(x) })).sort((a, b) => a.k - b.k || a.i - b.i).map((y) => y.x) : uygun).slice(0, 12);
  }, [acik, arama, etiketler, e.yazilan]);

  return (
    <View style={s.satir} testID={`ekip-esleme-${e.tur}-${e.anahtar}`}>
      <View style={s.satirUst}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.uygulamaAdi} numberOfLines={2}>{ad}</Text>
          <Text style={[s.yazilan, e.kaynak === 'uygulama' && { color: renkler.uyari }]} numberOfLines={2}>
            → {e.yazilan.trim()}
          </Text>
          <Text style={s.not} numberOfLines={2}>
            {kaynakNotu} · {t(`${e.adet} satır`, `${e.adet} ${e.adet === 1 ? 'row' : 'rows'}`)}
          </Text>
        </View>
        <Dugme
          metin={acik ? t('Kapat', 'Close') : t('Değiştir', 'Change')}
          simge={acik ? S.kapat : S.duzenle}
          kucuk
          tur="sessiz"
          onPress={ac}
          erisimEtiketi={t(`${ad}: Excel'e yazılan adı değiştir`, `${ad}: change the name written to Excel`)}
        />
      </View>
      {acik ? (
        <View style={s.secici}>
          <AramaKutusu
            deger={arama}
            degistir={setArama}
            yerTutucu={t('Ekibin listesinde ara (ör. FRT DR)', "Search the team's list (e.g. FRT DR)")}
            erisimEtiketi={t('Ekibin listesinde ara', "Search the team's list")}
          />
          {bulunan.map((x) => (
            <Secenek
              key={x.ad}
              metin={`${x.ad.trim()}${x.sayi ? t(` (${x.sayi} kayıt)`, ` (${x.sayi} ${x.sayi === 1 ? 'record' : 'records'})`) : ''}`}
              secili={false}
              onPress={() => sec(x.ad)}
              erisimEtiketi={t(`${x.ad.trim()} yaz`, `Write ${x.ad.trim()}`)}
            />
          ))}
          {!bulunan.length ? <Text style={s.not}>{t('Listede bulunamadı.', 'Not found in the list.')}</Text> : null}
          <View style={s.seciciAlt}>
            <Secenek
              kucuk
              metin={t(`Uygulamanın adını yaz: ${e.ad.en}`, `Write the app's name: ${e.ad.en}`)}
              secili={false}
              onPress={() => sec('')}
              erisimEtiketi={t('Uygulamanın İngilizce adını yaz', "Write the app's English name")}
            />
            {elleVar ? (
              <Secenek
                kucuk
                metin={t('Otomatik seçime dön', 'Back to automatic')}
                secili={false}
                onPress={() => sec(null)}
                erisimEtiketi={t('Otomatik seçime dön', 'Back to automatic')}
              />
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** Gönderimden sonra değişen alanın okunur hâli: "demerit 1 → 3". */
function alanMetni(a: DegisenAlan, dil: 'tr' | 'en'): string {
  const en = dil === 'en';
  const parca = (k: string) => k.split('+').map((id) => parcaTamAdi(id, dil)).join(' ↔ ');
  switch (a.alan) {
    case 'parca': return `${en ? 'part' : 'parça'} ${parca(a.eski)} → ${parca(a.yeni)}`;
    case 'tip': return `${en ? 'type' : 'tip'} ${hataTipiAdi(a.eski, dil)} → ${hataTipiAdi(a.yeni, dil)}`;
    case 'demerit': return `demerit ${a.eski} → ${a.yeni}`;
    case 'sinif': return `${en ? 'class' : 'sınıf'} ${a.eski} → ${a.yeni}`;
    case 'sistem': return `${en ? 'system' : 'sistem'} ${a.eski} → ${a.yeni}`;
    case 'takip': return `${en ? 'follow-up' : 'takip'} ${takipAdi(a.eski, dil)} → ${takipAdi(a.yeni, dil)}`;
    case 'onlem': return a.eski ? (en ? 'countermeasure changed' : 'önlem değişti') : (en ? 'countermeasure added' : 'önlem eklendi');
  }
}

const stiller = (r: Renkler) => StyleSheet.create({
  kok: { gap: bosluk.xs },
  degisen: { ...tipografi.caption, color: r.metin },
  aciklama: { ...tipografi.caption, color: r.metinSolgun },
  altBaslik: { ...tipografi.bodyOrta, color: r.metin, marginTop: bosluk.xs },
  satir: { padding: bosluk.xs, borderRadius: kose.md, backgroundColor: r.yuzeyAlt, gap: bosluk.xs },
  satirUst: { flexDirection: 'row', alignItems: 'center', gap: bosluk.sm },
  uygulamaAdi: { ...tipografi.caption, color: r.metinIkincil },
  yazilan: { ...tipografi.bodyOrta, color: r.metin },
  not: { ...tipografi.caption, color: r.metinSolgun },
  secici: { gap: bosluk.xs },
  seciciAlt: { flexDirection: 'row', flexWrap: 'wrap', gap: bosluk.xs },
});
