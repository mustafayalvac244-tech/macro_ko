import { supabase } from '@/lib/supabase';
import type { BriefSections } from '@/hooks/useBriefs';
import type { CaseWithClient } from '@/types/database';

interface BriefInput {
  caseItem: CaseWithClient;
}

function catLabel(c: CaseWithClient): string {
  return c.court_category === 'ceza' ? 'ceza' : c.court_category === 'idare' ? 'idari' : 'hukuk';
}

/**
 * Şablon motoru: dava verisinden deterministik, düzenlenebilir bir brief taslağı
 * üretir. İnternet/anahtar gerektirmez; AI anahtarı girilirse OpenAI tercih edilir.
 */
export function generateTemplateBrief({ caseItem: c }: BriefInput): BriefSections {
  const taraf = c.client?.full_name ?? 'Müvekkil';
  const karsi = c.opposing_party || 'karşı taraf';
  const tur = c.case_type || `${catLabel(c)} davası`;
  const mahkeme = c.court_name || 'Sayın Mahkeme';
  const dosyaNo = c.case_number ? ` (${c.case_number})` : '';

  const acilis = `Sayın Başkan, değerli heyet;\n\n${mahkeme} nezdinde görülen${dosyaNo} ${tur} dosyasında ${taraf} vekili olarak beyanda bulunuyorum. ${karsi} aleyhine açılan/yürütülen işbu davada, dava dilekçemizde ve önceki beyanlarımızda ayrıntılarıyla açıkladığımız üzere talebimiz haklı ve hukuki dayanaklara sahiptir.\n\nÖzetle: [buraya 2-3 cümlelik olay özeti ve talep sonucu yazın]. Delillerimiz dosyaya sunulmuş olup, dinlenecek tanıklarımız olayın esasını doğrulayacaktır.`;

  const dayanakMap: Record<string, string> = {
    ceza: `• CMK ilgili usul hükümleri (özellikle delil değerlendirmesi ve savunma hakkı)\n• TCK'daki ilgili suç tipi ve unsurları — [madde no girin]\n• Lehe hükümler / takdiri indirim nedenleri (TCK 62)\n• Yargıtay ilgili ceza dairesi içtihatları — [emsal karar ekleyin]`,
    idari: `• İYUK 2 (iptal davasının konusu) / İYUK 27 (yürütmenin durdurulması)\n• İşlemin yetki, şekil, sebep, konu, maksat yönünden hukuka aykırılığı\n• İlgili mevzuat: [dayanak kanun/yönetmelik maddesi girin]\n• Danıştay emsal kararları — [daire/karar no ekleyin]`,
    hukuk: `• TBK / TMK ilgili maddeleri — [madde no girin]\n• HMK ispat yükü kuralları (HMK 190) ve delil sözleşmeleri\n• Sözleşme hükümleri / haksız fiil unsurları / sebepsiz zenginleşme\n• Yargıtay ilgili hukuk dairesi içtihatları — [emsal karar ekleyin]`,
  };

  const tanik = `Tanıklara yöneltilecek sorular (taslak):\n\n1. Olay tarihinde nerede bulunuyordunuz, taraflarla ilişkiniz nedir?\n2. [Olayın kilit anına dair doğrudan gözlem sorusu yazın]\n3. ${karsi} ile ${taraf} arasındaki görüşmelere tanık oldunuz mu? Ne konuşuldu?\n4. [Belge/işlemle ilgili doğrulama sorusu]\n5. Anlattıklarınızı destekleyen yazışma, kayıt veya başka tanık var mı?\n\nÇapraz sorguda dikkat: Karşı tanığın önceki beyanlarıyla çelişkilerini tutanakla karşılaştırın; evet/hayır ile yanıtlanacak kapalı sorular kullanın.`;

  const karsiSavunma = `Muhtemel karşı savunmalar ve cevap stratejisi:\n\n• "Talep zamanaşımına uğradı" → Zamanaşımını kesen/durduran sebepleri belgeleyin (ihtar, kısmi ödeme, dava).\n• "Belgeler geçersiz/imza inkârı" → İmza incelemesi talebine hazırlıklı olun; ıslak imzalı asılları duruşmaya getirin.\n• "Zarar/kusur ispatlanamadı" → Bilirkişi raporu ve tanık anlatımlarının örtüşen noktalarını vurgulayın.\n• [Somut olaya özgü beklenen savunmayı ve cevabınızı yazın]`;

  const sonrasi = `Duruşma sonrası yapılacaklar:\n\n☐ Duruşma tutanağını UYAP'tan indir, ara kararları not et\n☐ Verilen kesin süreleri takvime işle (özellikle delil/bilirkişi avansı)\n☐ Müvekkile 24 saat içinde özet bilgi ver\n☐ Eksik delil/tanık bildirimi için dilekçe hazırla\n☐ Bir sonraki celse tarihini ve hazırlık görevlerini uygulamaya kaydet`;

  return {
    acilis,
    dayanaklar: dayanakMap[catLabel(c)] ?? dayanakMap.hukuk!,
    tanik,
    karsi: karsiSavunma,
    sonrasi,
  };
}

/** Modelin JSON'unu bulup ayrıştırır (bazen ```json bloğu içinde döner). */
function parseBriefJson(raw: string): Partial<BriefSections> | null {
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Partial<BriefSections>;
  } catch {
    return null;
  }
}

/**
 * Duruşma brief'ini KENDİ AI'mızla (Vekil AI / ai-chat) üretir — ANAHTARSIZ.
 * Eskiden kullanıcıdan kendi OpenAI anahtarını istiyordu; kimse anahtar
 * girmediği için özellik fiilen ölüydü ve hep şablona düşüyordu. Artık
 * sunucudaki anahtarla çalışır, mevzuat + içtihat beslemesinden yararlanır.
 * Hata/kota durumunda null döner ve şablon motoru devreye girer.
 */
export async function generateAiBrief({ caseItem: c }: BriefInput): Promise<BriefSections | null> {
  const taraflar = `${c.client?.full_name ?? 'Müvekkil'} — karşı taraf: ${c.opposing_party || 'belirtilmemiş'}`;
  const talep = c.description || c.title;
  const tur = c.case_type || `${catLabel(c)} davası`;
  const mahkeme = c.court_name ? ` Mahkeme: ${c.court_name}.` : '';

  const prompt =
    `Bir ${tur} dosyası için DURUŞMA BRIEF'i hazırla. Taraflar: ${taraflar}. Talep/konu: ${talep}.${mahkeme}\n` +
    'Şu beş bölümü doldur:\n' +
    '- acilis: duruşmada okunacak kısa açılış beyanı\n' +
    '- dayanaklar: hukuki dayanaklar (yalnız EMİN OLDUĞUN madde numaralarını yaz; emin değilsen kanun adını yaz)\n' +
    '- tanik: tanığa sorulacak sorular\n' +
    '- karsi: karşı tarafın olası savunmaları ve bunlara hazır cevaplar\n' +
    '- sonrasi: duruşma sonrası yapılacaklar listesi\n' +
    'SADECE şu JSON şemasında yanıt ver, başka hiçbir açıklama yazma:\n' +
    '{"acilis":"...","dayanaklar":"...","tanik":"...","karsi":"...","sonrasi":"..."}';

  try {
    const { data, error } = await supabase.functions.invoke('ai-chat', {
      body: { messages: [{ role: 'user', text: prompt }] },
    });
    if (error) return null;
    const raw = (data as { text?: string } | null)?.text;
    if (!raw) return null;
    const parsed = parseBriefJson(raw);
    if (!parsed?.acilis) return null;
    return {
      acilis: parsed.acilis ?? '',
      dayanaklar: parsed.dayanaklar ?? '',
      tanik: parsed.tanik ?? '',
      karsi: parsed.karsi ?? '',
      sonrasi: parsed.sonrasi ?? '',
    };
  } catch {
    return null;
  }
}

/** Duruşma öncesi kontrol listesi — kalemler sabit, işaretler kayıt altında. */
export const CHECKLIST_ITEMS = [
  'vekaletname',
  'kimlik',
  'dosya',
  'delil',
  'tanik',
  'tutanak',
  'cubbe',
  'salon',
  'telefon',
] as const;
export type ChecklistItem = (typeof CHECKLIST_ITEMS)[number];
