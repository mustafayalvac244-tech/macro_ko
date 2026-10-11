import type { BildirimTuru, EtkinlikTuru } from '@/utils/bildirimPlani';

/**
 * BİLDİRİM METNİ — saf ve testli.
 *
 * NEDEN AYRI DOSYA. Bu metin İKİ ayrı yoldan üretiliyor: kayıt kaydedilirken
 * (kaydinBildirimleriniKur) ve eşitleme kaydı yeniden kurarken
 * (syncEtkinlikBildirimleri). İkisi ayrı ayrı yazıldığında sessizce ayrıştılar
 * ve bu gerçekten oldu:
 *
 *   ÖDEME SÖZLERİNDE AŞAMA ÖNEKİ KAYBOLUYORDU. Eşitleme yolundaki metin
 *   üreticisi ödeme sözlerinde erken dönüyor ve "⏰ 3 gün kaldı" / "🚨 1 gün
 *   kaldı" önekini hiç uygulamıyordu. Yani vadeden ÜÇ GÜN ÖNCE çalan bildirim
 *   "💰 Ödeme günü: Ahmet Bey" diyordu — avukat ödemenin BUGÜN olduğunu
 *   sanırdı. Aynı kaydın ilk kurulan bildirimi ise doğru öneki taşıyordu; fark
 *   yalnızca uygulama yeniden kurulduktan sonra ortaya çıkıyordu.
 *
 * Metin artık tek yerden üretiliyor ve davranış testlere bağlı. Çeviri ve tarih
 * biçimleme dışarıdan veriliyor (projedeki aiHata.ts kalıbı): ikisi de i18n
 * üzerinden AsyncStorage'a bağlı olduğundan doğrudan import edilseydi bu dosya
 * yine test edilemezdi.
 */

export type Cevir = (anahtar: string, p?: Record<string, string | number>) => string;

/**
 * KİLİT EKRANINA MÜVEKKİL VE DAVA ADI YAZILMAZ (09.10.2026 denetimi).
 *
 * Bildirim, telefonun kilidi açılmadan görünür. Önceki metin ödeme sözünde
 * müvekkilin ADINI ("💰 Ödeme günü: <ad>"), duruşma/görev/duruşma sonrası
 * bildiriminde DAVA ADINI yazıyordu; dava adı formun kendi örneğinde bile taraf
 * adlarıdır ('Yılmaz / Demir İnşaat A.Ş.'). Kaynak artık bu alanları HİÇ
 * taşımıyor: metne giremeyecekleri tipten belli.
 *
 * Duruşma/görev BAŞLIĞI kalıyor (çoğunlukla "Ön inceleme", "İstinaf dilekçesi"
 * gibi iş adıdır). Kullanıcı başlığa ad yazarsa o görünür — bu metin onu
 * ayıklayamaz.
 */
export interface BildirimKaynagi {
  /** Duruşma/görev başlığı — bildirim başlığında görünür. Ödeme sözünde KULLANILMAZ. */
  baslik: string;
  /** Yalnız ödeme sözünde: tutar etiketi (taksit işaretiyle, "5.000,00 ₺ (2/12)"). */
  tutar?: string;
  anISO: string;
  /** Duruşma türü (hearing/mediation/deposition…) — yalnız duruşmalarda. */
  hearingType?: string;
}

export function bildirimMetni(
  etkinlikTuru: EtkinlikTuru,
  tur: BildirimTuru,
  kaynak: BildirimKaynagi,
  cevir: Cevir,
  tarihBicimle: (iso: string) => string
): { title: string; body: string } {
  const turEtiketi = () => cevir(`hearingType.${kaynak.hearingType ?? 'hearing'}`);

  // Duruşma sonrası sorusunun aşama kavramı yoktur; kendi metnini taşır.
  // Aynı gün birden çok duruşma olabilir: hangisi olduğu saatinden anlaşılır.
  if (tur === 'sonuc') {
    return {
      title: cevir('notif.outcomeTitle', { type: turEtiketi() }),
      body: cevir('notif.outcomeBody', { date: tarihBicimle(kaynak.anISO) }),
    };
  }

  const anaBaslik =
    etkinlikTuru === 'soz'
      ? cevir('notif.promiseTitle')
      : etkinlikTuru === 'durusma'
        ? cevir('notif.hearingTitle', { type: turEtiketi(), title: kaynak.baslik })
        : cevir('notif.deadlineTitle', { title: kaynak.baslik });

  // Aşama öneki ÜÇ türe de uygulanır — kaydetme yolundaki davranışın aynısı.
  const title =
    tur === '3g'
      ? cevir('notif.stage3d', { title: anaBaslik })
      : tur === '1g'
        ? cevir('notif.stage1d', { title: anaBaslik })
        : anaBaslik;

  const body =
    etkinlikTuru === 'soz'
      ? cevir('notif.promiseBody', { amount: kaynak.tutar ?? '' })
      : cevir('notif.eventBody', { date: tarihBicimle(kaynak.anISO) });

  return { title, body };
}
