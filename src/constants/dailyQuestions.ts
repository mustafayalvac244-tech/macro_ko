import { format } from 'date-fns';

/**
 * Local daily-question bank (works offline; answers/points live in Supabase).
 * The question rotates deterministically by day of year, so every user sees
 * the same question on the same date.
 */
const QUESTIONS: string[] = [
  'Miras bırakanın ölümüyle birlikte saklı pay alacaklısının hakları nasıl doğar? Açıklayınız.',
  'İşveren, işçinin sosyal medya paylaşımını gerekçe göstererek iş akdini haklı nedenle feshedebilir mi? Değerlendiriniz.',
  'Kiracı, kiralananı erken tahliye ederse kalan aylardan sorumluluğu nasıl belirlenir?',
  'Boşanma davasında sosyal medya yazışmaları delil olarak kullanılabilir mi? Hukuka aykırı delil tartışması yapınız.',
  'Apartman yöneticisinin kat maliklerine karşı sorumluluğunun hukuki niteliği nedir?',
  'Trafik kazasında araç değer kaybı hangi şartlarda ve kimden talep edilir?',
  'İnternetten alınan üründe cayma hakkı hangi hallerde kullanılamaz? Örnekle açıklayınız.',
  'Bononun teminat amaçlı verildiği iddiası hangi delillerle ispatlanabilir?',
  'İşçinin rekabet yasağı sözleşmesinin geçerlilik şartları nelerdir?',
  'Muris muvazaası (mirastan mal kaçırma) davasında ispat yükü kimdedir? Tartışınız.',
  'Kat karşılığı inşaat sözleşmesinde yüklenicinin temerrüdü halinde arsa sahibinin seçimlik hakları nelerdir?',
  'Anlaşmalı boşanma protokolünde kararlaştırılan nafakadan sonradan feragat mümkün müdür?',
  'Alacaklı, borçlunun üçüncü kişideki maaş alacağına nasıl haciz koydurur? Sınırları nelerdir?',
  'Tüketici kredisinde erken ödeme halinde faiz indirimi nasıl hesaplanır?',
  'İş kazasında işverenin kusursuz sorumluluğu var mıdır? İçtihat çerçevesinde değerlendiriniz.',
  'Tapuda yolsuz tescile güvenerek taşınmaz edinen üçüncü kişinin durumu nedir?',
  'Ceza yargılamasında sanığın susma hakkının kapsamı nedir? Aleyhe delil sayılabilir mi?',
  'Kefilin sorumluluğunun sona erdiği halleri sayınız ve birini örnekle açıklayınız.',
  'Ortak velayet Türk hukukunda mümkün müdür? Güncel içtihatlarla tartışınız.',
  'İşyeri kirasında kiraya verenin ihtiyaç nedeniyle tahliye davasının şartları nelerdir?',
  'Zamanaşımına uğramış borç için yapılan kısmi ödeme zamanaşımını keser mi?',
  'Vasiyetnamenin iptali ile tenkis davası arasındaki farkları açıklayınız.',
  'Eser sözleşmesinde ayıplı ifa halinde iş sahibinin hakları nelerdir?',
  'Boşanmada ziynet eşyası talebinde ispat yükü nasıl dağılır?',
  'Haksız tutuklama nedeniyle tazminat davası kime karşı ve hangi sürede açılır?',
  'Şufa (önalım) hakkı hangi hallerde kullanılamaz? Fiili taksim savunmasını değerlendiriniz.',
  'Belirli süreli iş sözleşmesinin objektif koşulları nelerdir; yokluğunda sonuç ne olur?',
  'Mirasın hükmen reddi ile gerçek reddi arasındaki farkları açıklayınız.',
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
    body: QUESTIONS[dayOfYear % QUESTIONS.length]!,
  };
}
