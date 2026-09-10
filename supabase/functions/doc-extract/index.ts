// Belge metni çıkarma servisi — PDF / DOCX / UDF / TXT.
//
// Neden sunucuda: avukatlar dilekçeyi PDF veya UYAP'ın UDF formatında tutuyor;
// telefonda bu formatlardan metin çıkarmak native kütüphane ister (yeni derleme
// gerektirir). Sunucuda yapınca OTA ile anında yayına girer.
//
// UDF  = ZIP içinde content.xml (UYAP Doküman Formatı)
// DOCX = ZIP içinde word/document.xml
// PDF  = unpdf ile metin çıkarımı
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// Metin ayıklama saf mantık ve TESTLİ (tests/belgeMetni.test.ts): UDF
// dosyalarındaki CDATA bloğu sessizce siliniyordu, kimse fark etmiyordu.
import { stripXml } from '../_shared/belgeMetni.ts';
import JSZip from 'https://esm.sh/jszip@3.10.1';
import { extractText, getDocumentProxy } from 'https://esm.sh/unpdf@0.12.1';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};


/** ZIP tabanlı formatlardan (UDF/DOCX) metin çıkarır. */
async function fromZip(bytes: Uint8Array, kind: 'udf' | 'docx'): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  if (kind === 'udf') {
    // UDF: content.xml — bazı sürümlerde farklı adlarda olabiliyor, esnek ara.
    const name =
      Object.keys(zip.files).find((f) => f.toLowerCase() === 'content.xml') ??
      Object.keys(zip.files).find((f) => f.toLowerCase().endsWith('.xml'));
    if (!name) throw new Error('udf_content_not_found');
    return stripXml(await zip.files[name].async('string'));
  }
  const doc = zip.files['word/document.xml'];
  if (!doc) throw new Error('docx_content_not_found');
  return stripXml(await doc.async('string'));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method' }), { status: 405, headers: CORS });
  }

  // Yalnız oturum açmış kullanıcılar.
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: CORS });
  }

  let body: { filename?: string; base64?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400, headers: CORS });
  }

  const filename = (body.filename ?? '').toLowerCase();
  const b64 = body.base64 ?? '';
  if (!b64) {
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400, headers: CORS });
  }
  // ~8 MB dosya sınırı (base64 ≈ %33 şişer)
  if (b64.length > 11_000_000) {
    return new Response(JSON.stringify({ error: 'too_large' }), { status: 413, headers: CORS });
  }

  let bytes: Uint8Array;
  try {
    const bin = atob(b64);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch {
    return new Response(JSON.stringify({ error: 'bad_base64' }), { status: 400, headers: CORS });
  }

  try {
    let text = '';
    // PDF'te metne dönüşmeyen sayfalar (taranmış/görüntü). Kullanıcıya
    // söylenir: eksik okunduğunu bilmeden inceleme isteyen avukat, belgenin
    // tamamı incelenmiş sanır.
    let okunamayan: number[] = [];
    let sayfaSayisi = 0;
    if (filename.endsWith('.pdf')) {
      const pdf = await getDocumentProxy(bytes);
      // SAYFA SAYFA ÇIKARILIYOR — birleştirilmiş metin bir şeyi GİZLİYORDU:
      // bir PDF'in bazı sayfaları metin, bazıları TARANMIŞ GÖRÜNTÜ olabilir ve
      // birleşik metin dolu geldiği için "okundu" sayılıyordu.
      //
      // ÖLÇÜLEN ARIZA: resmî Avukatlık Asgari Ücret Tarifesi'ni kendi
      // çıkarıcımızla okuduk; 19.000 karakter metin geldi ama ÜCRET TABLOLARI
      // hiç gelmedi — o sayfalar 1937x3118 boyutunda taranmış JPEG. Yani
      // belgenin en kritik kısmı sessizce düştü ve biz "başarıyla okundu"
      // dedik.
      //
      // Avukat için bu, en tehlikeli veri kaybı türü: eksik olduğunu
      // GÖREMİYOR. Sözleşmedeki ödeme planı tablosu ya da karardaki hesap
      // tablosu düştüğünde, inceleme belgenin tamamını görmüş gibi konuşur.
      const res = await extractText(pdf, { mergePages: false });
      const sayfalar: string[] = Array.isArray(res.text)
        ? (res.text as string[]).map((x) => String(x ?? ''))
        : [String((res as { text?: unknown }).text ?? '')];
      // Eşik neden 40: sayfa numarası, üstbilgi ve altbilgi tek başına birkaç
      // on karakter tutuyor. Bunun altı, "o sayfada okunacak bir şey yoktu"
      // demektir; sıfır aramak, üstbilgisi olan taranmış sayfayı kaçırırdı.
      okunamayan = sayfalar
        .map((x, i) => ({ i: i + 1, n: x.replace(/\s+/g, '').length }))
        .filter((x) => x.n < 40)
        .map((x) => x.i);
      sayfaSayisi = sayfalar.length;
      text = sayfalar.join('\n').trim();
      if (!text) {
        // Taranmış (görüntü) PDF — metin katmanı yok.
        return new Response(JSON.stringify({ error: 'pdf_no_text' }), { status: 422, headers: CORS });
      }
    } else if (filename.endsWith('.udf')) {
      text = await fromZip(bytes, 'udf');
    } else if (filename.endsWith('.docx')) {
      text = await fromZip(bytes, 'docx');
    } else if (filename.endsWith('.doc')) {
      // Eski ikili .doc biçimi: güvenilir ayrıştırma için ek kütüphane gerekir.
      return new Response(JSON.stringify({ error: 'doc_legacy' }), { status: 415, headers: CORS });
    } else {
      // txt / rtf / diğer düz metin
      text = new TextDecoder('utf-8').decode(bytes);
      if (filename.endsWith('.rtf')) text = stripXml(text.replace(/\\[a-z]+\d*/g, ' '));
    }

    text = text.replace(/\u0000/g, '').trim();
    if (!text) {
      return new Response(JSON.stringify({ error: 'empty' }), { status: 422, headers: CORS });
    }
    return new Response(JSON.stringify({
      text,
      chars: text.length,
      sayfa: sayfaSayisi || undefined,
      okunamayanSayfa: okunamayan.length ? okunamayan : undefined,
    }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'parse_failed', detail: (e as Error).message }), {
      status: 422,
      headers: CORS,
    });
  }
});
