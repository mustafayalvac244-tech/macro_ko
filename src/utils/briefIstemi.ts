import type { CourtCategory } from '@/types/database';
import { adlariRolleCevir, kimlikNumarasiniGizle } from '@/utils/yapayZekaMaskesi';

/**
 * Duruşma brifi için YAPAY ZEKÂYA gidecek istem.
 *
 * Müvekkil ve karşı taraf adı GİTMEZ (10.10.2026 denetçi bulgusu): brif
 * metni rol ister ("Müvekkil", "Karşı taraf"); gerçek adı avukat çıktıya kendisi
 * yazar. Konu metnindeki kayıtlı adlar da role çevrilir (bkz. yapayZekaMaskesi
 * — bu anonimleştirme garantisi değildir). Yerel şablon motoru (cihazdan
 * çıkmaz) gerçek adı kullanmaya devam eder.
 */
export interface BriefIstemiGirdi {
  title: string;
  description?: string | null;
  case_type?: string | null;
  court_name?: string | null;
  court_category?: CourtCategory | null;
  opposing_party?: string | null;
  client?: { full_name: string; company?: string | null } | null;
}

export function catLabel(c: { court_category?: CourtCategory | null }): string {
  return c.court_category === 'ceza' ? 'ceza' : c.court_category === 'idare' ? 'idari' : 'hukuk';
}

export function briefIstemi(c: BriefIstemiGirdi): string {
  const tur = c.case_type || `${catLabel(c)} davası`;
  const mahkeme = c.court_name ? ` Mahkeme: ${c.court_name}.` : '';
  const talep = kimlikNumarasiniGizle(
    adlariRolleCevir(c.description || c.title, [
      { ad: c.client?.full_name, rol: 'Müvekkil', parcalar: true },
      { ad: c.client?.company, rol: 'Müvekkil' },
      { ad: c.opposing_party, rol: 'Karşı taraf', parcalar: true },
    ])
  );

  return (
    `Bir ${tur} dosyası için DURUŞMA BRIEF'i hazırla. Taraflar: Müvekkil ve Karşı taraf (adlar gizlendi; ` +
    `kişi veya kurum adı uydurma, tarafları yalnız "Müvekkil" ve "Karşı taraf" diye an). Talep/konu: ${talep}.${mahkeme}\n` +
    'Şu beş bölümü doldur:\n' +
    '- acilis: duruşmada okunacak kısa açılış beyanı\n' +
    '- dayanaklar: hukuki dayanaklar (yalnız EMİN OLDUĞUN madde numaralarını yaz; emin değilsen kanun adını yaz)\n' +
    '- tanik: tanığa sorulacak sorular\n' +
    '- karsi: karşı tarafın olası savunmaları ve bunlara hazır cevaplar\n' +
    '- sonrasi: duruşma sonrası yapılacaklar listesi\n' +
    'SADECE şu JSON şemasında yanıt ver, başka hiçbir açıklama yazma:\n' +
    '{"acilis":"...","dayanaklar":"...","tanik":"...","karsi":"...","sonrasi":"..."}'
  );
}
