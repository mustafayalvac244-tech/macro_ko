import { format } from 'date-fns';

/**
 * Local daily-case bank (works offline; answers/points live in Supabase).
 * Each entry is a fictional case scenario that requires real legal reasoning,
 * not a memorized rule. Rotates deterministically by day of year, so every
 * user sees the same case on the same date.
 */
const CASES: string[] = [
  'OLAY: Müvekkiliniz A, arkadaşı B\'ye "dükkanı devralması" için 800.000 TL vermiş; ortada yazılı sözleşme yok, sadece "devir işleri için" açıklamalı havale dekontu ve B\'nin "hallediyorum abi" mesajları var. B dükkanı üçüncü kişiye devretmiş ve parayı iade etmiyor. GÖREV: Hangi hukuki sebeple (sebepsiz zenginleşme mi, vekalet mi, satış vaadi mi?) hangi davayı açarsınız? Dekont ve mesajların ispat gücünü tartışın.',
  'OLAY: Kiracı müvekkiliniz, işyerinin çatısındaki gizli su sızıntısı yüzünden depodaki malları zarar görüyor. Kiraya veren "kira sözleşmesindeki \'kiralananı mevcut haliyle kabul etti\' maddesini" ileri sürüyor. Sızıntı ancak uzman incelemesiyle görülebilecek nitelikte. GÖREV: Müvekkilinizin talep edebileceği kalemleri belirleyin ve sözleşmedeki kayıt karşısında savunma stratejinizi kurun.',
  'OLAY: Boşanma davanızda karşı taraf, müvekkilinizin telefonuna gizlice yüklediği casus uygulamayla elde edilmiş WhatsApp kayıtlarını delil olarak sunuyor; kayıtlar müvekkilinizin sadakatsizliğini gösteriyor. GÖREV: Bu delillerin akıbeti ne olur? Hem delilin hukuka aykırılığı hem de "hukuka aykırı delille sabit olan olgu" tartışması üzerinden iki taraflı değerlendirme yapın.',
  'OLAY: Müvekkiliniz internetten aldığı ikinci el aracın, satıştan 3 ay sonra ağır hasar kayıtlı olduğunu öğreniyor. Satıcı ilanında "hatasız boyasız" yazmış, ekspertiz raporu da hasarı görmemiş. Satıcı tüketici değil, galerici de değil; sıradan bir kişi. GÖREV: Ayıp hükümleri mi, aldatma (hile) mi? Süreler ve talep sonuçları bakımından en avantajlı yolu gerekçelendirin.',
  'OLAY: İşçi müvekkiliniz istifa dilekçesi imzalamış; ancak aynı gün tarihli, işverence hazırlanmış "istifa etmezsen tazminatsız kovarız" içerikli ses kaydı var. İstifadan 2 gün sonra işyerinde çalışmaya devam etmiş, 1 hafta sonra çıkışı verilmiş. GÖREV: Kıdem/ihbar tazminatı ve işe iade açısından istifanın geçerliliğini tartışın; ses kaydının delil değerini değerlendirin.',
  'OLAY: Miras bırakan, ölümünden 2 yıl önce tek evini "satış" göstererek bakımını üstlenen küçük oğluna tapuda devretmiş; bedel banka kaydında yok. Diğer mirasçı müvekkiliniz, babanın o dönem huzurevinde olduğunu ve satış bedeli ödenmediğini söylüyor. GÖREV: Muris muvazaası mı, tenkis mi, ikisi birlikte mi? Dava stratejinizi ve ispat planınızı kurun.',
  'OLAY: Müvekkil şirket, tedarikçiyle yıllık alım sözleşmesi imzalamış; sözleşmede "fiyatlar döviz kuruna göre güncellenir" maddesi var ama güncelleme yöntemi yazılmamış. Kur %60 artınca tedarikçi teslimatı durdurdu, "yeni fiyat kabul edilmezse mal yok" diyor. GÖREV: Uyarlama mı, temerrüt mü? Tarafların hakları ve sizin önereceğiniz çözüm yolunu (dava/ihtar/müzakere) gerekçelendirin.',
  'OLAY: Komşu parselde yapılan inşaatın hafriyatı sırasında müvekkilinizin evinin duvarlarında çatlaklar oluştu. Belediye "ruhsat ve projeler tam" diyor; müteahhit "zemin zaten çürüktü" savunmasında. İnşaat hâlâ devam ediyor. GÖREV: Acil hukuki adımlar (tespit, tedbir) dahil tam yol haritası çizin; kimlere karşı hangi sorumluluk türüyle dava açarsınız?',
  'OLAY: Müvekkiliniz, boşandığı eşinin sosyal medyada kendisi hakkında "çocuğunu terk etti, nafaka ödemiyor" paylaşımları yaptığını, oysa nafakayı düzenli ödediğini belgeliyor. Paylaşımlar arkadaş listesine açık, 3.000 kişi görüyor. GÖREV: Kişilik hakkı ihlali kapsamında ceza ve hukuk yollarını ayrı ayrı değerlendirin; içeriklerin kaldırılması için izlenecek usulü yazın.',
  'OLAY: Kefil müvekkiliniz, arkadaşının kredisine "adi kefil" olduğunu sanıyor; bankadaki formda "müteselsil kefil" yazılı, el yazısıyla doldurulması gereken tutar/tarih kısımları matbu. Borçlu ödemeyince banka doğrudan müvekkile icra başlattı. GÖREV: Kefaletin şekil şartları yönünden geçerliliğini inceleyin; icraya karşı hangi yolla, hangi sürede ne yaparsınız?',
  'OLAY: Müvekkil apartman yönetimi, çatı onarımı için toplanan avansı ödemeyen kat malikine karşı ne yapacağını soruyor; malik "ben çatıyı kullanmıyorum, en üst kat ödesin" diyor ve 8 aydır aidat da ödemiyor. GÖREV: Ortak gider ve avanstan sorumluluk rejimini açıklayıp yönetimin izleyeceği takip yolunu (icra/dava, faiz, yönetim planı) adım adım kurun.',
  'OLAY: Trafik kazasında müvekkilinizin aracına çarpan sürücü, kaza tespit tutanağında kusuru kabul etmiş; ancak sigorta şirketi "aracın piyasa değeri üzerinden" düşük bir değer kaybı ödemesi teklif ediyor ve onarım süresince müvekkil 24 gün araç kullanamamış (ticari taksi). GÖREV: Değer kaybı + kazanç kaybı taleplerini kime karşı, hangi usulle (sigorta tahkim? dava?) yöneltirsiniz; ispat için hangi delilleri toplarsınız?',
  'OLAY: İşveren müvekkiliniz, işyerindeki kasadan para çalındığını güvenlik kamerasından tespit etti; görüntüde çalışan X görünüyor. X\'in savunmasını almadan aynı gün iş akdini feshetti ve durumu diğer çalışanlara duyurdu. X işe iade ve tazminat davası açtı, ayrıca "iftira" diyor. GÖREV: Fesih usulündeki hataları, ispat yükünü ve işverenin risklerini analiz edin; süreci baştan siz yönetseydiniz nasıl kurgulardınız?',
  'OLAY: Müvekkiliniz, 10 yıldır oturduğu evi kentsel dönüşüme giren binada 2/3 çoğunluk kararıyla yıkılacak; kendisi karara katılmadı ve teklif edilen daire değerinin düşük olduğunu düşünüyor. 15 günlik satış süreci başlatıldı. GÖREV: 6306 sayılı Kanun kapsamındaki hakları, itiraz ve dava yollarını süreleriyle birlikte planlayın.',
  'OLAY: E-ticaret sitesi işleten müvekkilinize, rakip firma "müşteri yorumlarını kopyaladığı ve markasını Google reklam anahtar kelimesi olarak kullandığı" iddiasıyla ihtarname gönderdi; 7 gün içinde tazminat istiyor. Müvekkil, yorumların kullanıcılar tarafından iki siteye de yazıldığını söylüyor. GÖREV: Haksız rekabet ve marka hukuku yönünden riski değerlendirin; ihtara vereceğiniz cevabın stratejisini kurun.',
  'OLAY: Müvekkiliniz senette "bedeli malen ahzolunmuştur" yazılı bir bonoyu ciro yoluyla devralan üçüncü kişi tarafından icra takibine uğradı. Müvekkil, senedin boş imzalanıp güvence olarak verildiğini, sonradan doldurulduğunu iddia ediyor; elinde senedin fotokopisi (boş haliyle) var. GÖREV: Kambiyo takibine karşı hangi yolla itiraz edersiniz? Kötüniyetli hamil ve anlaşmaya aykırı doldurma savunmalarının ispatını tartışın.',
];

export interface DailyQuestion {
  /** Stable key used as the answer's question_key in the database. */
  key: string;
  body: string;
}

export function getTodayQuestion(now = new Date()): DailyQuestion {
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  return {
    key: format(now, 'yyyy-MM-dd'),
    body: CASES[dayOfYear % CASES.length]!,
  };
}
