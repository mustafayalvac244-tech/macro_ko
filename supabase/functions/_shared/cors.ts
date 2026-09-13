// CORS BAŞLIKLARI — TEK SAHİP.
// ===========================================================================
// NEDEN BU DOSYA VAR. Sekiz uç işlevinin her biri kendi CORS nesnesini elle
// yazıyordu. İkisi (doc-extract, payment-sheet) `x-client-info` başlığına
// izin veriyordu, altısı vermiyordu. Bu fark hiçbir uyarı üretmiyordu ve
// TARAYICIDA TAM ARIZAYA yol açıyordu.
//
// ARIZA NASIL GÖRÜNÜYORDU (13.09.2026, kullanıcı bildirdi).
// supabase-js her isteğe kendiliğinden `X-Client-Info` başlığını ekliyor —
// canlı paketten doğrulandı: `headers:{"X-Client-Info":"supabase-js/2.110.0; …"}`.
// Tarayıcı, POST'tan önce ön uçuş (preflight) yapıp bu başlığa izin verilip
// verilmediğine bakıyor. İzin listesinde yoksa isteği HİÇ GÖNDERMİYOR.
// supabase-js bunu `FunctionsFetchError` olarak sarıyor; o hatanın `context`
// alanı olmadığı için src/lib/aiHata.ts gövdeyi okuyamıyor ve en genel
// mesaja düşüyor: "Yanıt alınamadı. İnternet bağlantınızı kontrol edip
// tekrar deneyin." Yani bağlantı sorunu gibi görünen şey aslında bizim
// başlık listemizdi; kullanıcı interneti kontrol ediyor, sorun bizde.
//
// ÖLÇÜLDÜ, ÇIKARIM DEĞİL. Gerçek Chromium ile iki uç kuruldu: biri canlı
// ai-chat'in başlıklarıyla, diğeri doc-extract'inkiyle. Aynı fetch:
//   • ai-chat başlıklarıyla    → "TypeError: Failed to fetch" (istek gitmedi)
//   • doc-extract başlıklarıyla → http 403 ve gövde OKUNDU
// Etkilenen uçlar: ai-chat (sohbet, dilekçe, mütalaa, belge, künye),
// ictihat (ÜCRETSİZ içtihat araması dâhil) ve ai-saglik.
//
// LİSTE NEDEN BU KADAR GENİŞ. Yalnız bugün gönderilen başlıkları yazmak, aynı
// arızayı istemci kitaplığının bir sonraki sürümüne ertelemek olur: kitaplık
// yeni bir başlık eklediği gün tarayıcı yine sessizce engeller ve yine "ağ
// hatası" gibi görünür. Aşağıdaki liste supabase-js'in gönderebildiği
// başlıkları kapsıyor. Güvenlik açısından bir gevşeme DEĞİL: izin verilen
// başlık, kimlik doğrulamayı atlatmaz — her uç kendi yetkisini ayrıca
// denetler.
//
// tests/uclarCors.test.ts, bir uç işlevinin kendi başına CORS listesi
// tanımlamasını (ve bu dosyayı atlamasını) engelliyor.

export const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-requested-with',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  // Ön uçuş cevabı bir gün önbelleğe alınsın: her yapay zekâ isteğinden önce
  // fazladan bir gidiş-dönüş, mobil bağlantıda hissedilir bir gecikmedir.
  'Access-Control-Max-Age': '86400',
};
