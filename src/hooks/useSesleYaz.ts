import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

/**
 * SESLE YAZMA — tarayıcının konuşma tanıma özelliği (04.10.2026).
 *
 * Avukat geri bildirimi: "ekstra mikrofon istiyorlar yazarken". Avukatlar
 * çoğunlukla masaüstü web'den çalışıyor (gönderilen ekran görüntüleri web);
 * masaüstü klavyesinde telefondaki gibi bir mikrofon tuşu yok.
 *
 * YALNIZ WEB. Telefonda klavyenin kendi dikte tuşu var. Uygulama içi bir
 * mikrofon telefonda yerel bir modül ister: yeni derleme + mağaza incelemesi,
 * OTA ile gitmez — ürün sahibinin kararı olmadan eklenmedi.
 *
 * SES NEREYE GİDİYOR — doğrulandı (MDN, SpeechRecognition sayfası,
 * 04.10.2026): "Chrome gibi bazı tarayıcılarda konuşma tanıma sunucu
 * tabanlıdır; ses tanıma için bir web hizmetine gönderilir." Ses BİZE
 * gelmez; elimize yalnız metin geçer. Avukat müvekkil bilgisini dikte
 * edeceği için bu, düğmenin yanında açıkça yazar (ses.not).
 *
 * Desteklemeyen tarayıcıda (ör. Firefox) düğme hiç görünmez.
 */

type SonucListesi = ArrayLike<{ isFinal: boolean; 0?: { transcript?: string } }>;
interface Tanima {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: SonucListesi }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
}
type TanimaSinifi = new () => Tanima;

function tanimaSinifi(): TanimaSinifi | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: TanimaSinifi; webkitSpeechRecognition?: TanimaSinifi };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Bilinen hata kodları (Web Speech API belirtimi); diğerleri 'genel'. */
export type SesHatasi = 'not-allowed' | 'no-speech' | 'network' | 'audio-capture' | 'genel';

function hataKodu(kod: string | undefined): SesHatasi | null {
  if (!kod || kod === 'aborted') return null; // kullanıcı durdurdu
  if (kod === 'not-allowed' || kod === 'service-not-allowed') return 'not-allowed';
  if (kod === 'no-speech' || kod === 'network' || kod === 'audio-capture') return kod;
  return 'genel';
}

/** Dikteyi yönetir. `onMetin` her KESİNLEŞEN parçada çağrılır. */
export function useSesleYaz(onMetin: (parca: string) => void) {
  const Sinif = tanimaSinifi();
  const [dinliyor, setDinliyor] = useState(false);
  const [ara, setAra] = useState('');
  const [hata, setHata] = useState<SesHatasi | null>(null);
  const tanima = useRef<Tanima | null>(null);
  const geriCagri = useRef(onMetin);
  geriCagri.current = onMetin;

  // Ekrandan çıkılırsa mikrofon açık kalmasın.
  useEffect(() => () => tanima.current?.abort(), []);

  const baslat = () => {
    if (!Sinif || tanima.current) return;
    setHata(null);
    const r = new Sinif();
    r.lang = 'tr-TR';
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let gecici = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const sonuc = e.results[i];
        const metin = sonuc?.[0]?.transcript ?? '';
        if (sonuc?.isFinal) {
          if (metin.trim()) geriCagri.current(metin.trim());
        } else {
          gecici += metin;
        }
      }
      setAra(gecici);
    };
    r.onerror = (e) => setHata(hataKodu(e.error));
    r.onend = () => {
      tanima.current = null;
      setDinliyor(false);
      setAra('');
    };
    tanima.current = r;
    try {
      r.start();
      setDinliyor(true);
    } catch {
      tanima.current = null;
      setHata('genel');
    }
  };

  const durdur = () => tanima.current?.stop();

  return { destek: !!Sinif, dinliyor, ara, hata, baslat, durdur };
}
