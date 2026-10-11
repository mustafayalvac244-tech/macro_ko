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
// DOCX, RTF ve düz metin de oradan (09.10.2026, tests/belgeEkiOkuma.test.ts):
// izlenen değişikliklerde SİLİNEN metin okunuyor, RTF kaçışlı kalıyor,
// Windows-1254 bozuluyor, fotoğraf "metin" diye dönüyordu.
import { docxMetni, duzMetinOku, udfMetni } from '../_shared/belgeMetni.ts';
// ZIP girdisi AÇILMIŞ boyutla sınırlı okunur (sıkıştırma bombası, 10.10.2026).
import { ZIP_ACILMIS_TAVAN, sinirliOku, type AkisBenzeri } from '../_shared/zipTavan.ts';
import JSZip from 'https://esm.sh/jszip@3.10.1';
import { extractText, getDocumentProxy } from 'https://esm.sh/unpdf@0.12.1';
// CORS başlıkları ORTAK dosyadan geliyor — bkz. _shared/cors.ts.
// Burada elle yazılmaları, altı uçta `x-client-info` başlığının izin
// listesinden düşmesine ve tarayıcıda tam arızaya yol açmıştı.
import { CORS } from '../_shared/cors.ts';



/**
 * ZIP girdisini metne okur ama AÇILMIŞ boyutu ZIP_ACILMIS_TAVAN ile sınırlar:
 * 8 MB'lık bir ZIP deflate ile gigabaytlara açılabilir (bkz. _shared/zipTavan.ts).
 * Tavan aşılırsa akış durdurulur ve 'zip_too_large' fırlatılır.
 */
async function girdiMetni(girdi: { internalStream(tur: string): AkisBenzeri }): Promise<string> {
  const bayt = await sinirliOku(girdi.internalStream('uint8array'), ZIP_ACILMIS_TAVAN);
  return new TextDecoder('utf-8').decode(bayt);
}

/** ZIP tabanlı formatlardan (UDF/DOCX) metin çıkarır. */
async function fromZip(bytes: Uint8Array, kind: 'udf' | 'docx'): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  if (kind === 'udf') {
    // UDF: content.xml — bazı sürümlerde farklı adlarda olabiliyor, esnek ara.
    const name =
      Object.keys(zip.files).find((f) => f.toLowerCase() === 'content.xml') ??
      Object.keys(zip.files).find((f) => f.toLowerCase().endsWith('.xml'));
    if (!name) throw new Error('udf_content_not_found');
    // udfMetni: belgenin kendi "<…>" ifadelerini etiket sanıp silmez,
    // resim/boş paragraf yer tutucularını atar (bkz. _shared/belgeMetni.ts).
    return udfMetni(await girdiMetni(zip.files[name]));
  }
  const doc = zip.files['word/document.xml'];
  if (!doc) throw new Error('docx_content_not_found');
  // docxMetni: yalnız <w:t> metindir; silinen (w:del) ve taşınan eski metin
  // (w:moveFrom) atılır, run sınırında kelimeye boşluk girmez.
  return docxMetni(await girdiMetni(doc));
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
        // Taranmış (görüntü) PDF — metin katmanı yok. SAYFA SAYISI DA DÖNER
        // (04.10.2026): metni olmayan PDF artık yapay zekâya GÖRÜNTÜSÜYLE
        // gidebiliyor; istemci sayfa tavanını bilmek için sayıya ihtiyaç duyar.
        return new Response(JSON.stringify({ error: 'pdf_no_text', sayfa: sayfaSayisi }), { status: 422, headers: CORS });
      }
    } else if (filename.endsWith('.udf')) {
      text = await fromZip(bytes, 'udf');
    } else if (filename.endsWith('.docx')) {
      text = await fromZip(bytes, 'docx');
    } else if (filename.endsWith('.doc')) {
      // Eski ikili .doc biçimi: güvenilir ayrıştırma için ek kütüphane gerekir.
      return new Response(JSON.stringify({ error: 'doc_legacy' }), { status: 415, headers: CORS });
    } else {
      // txt / rtf / diğer DÜZ METİN — yalnız gerçekten metinse. İkili dosya
      // (fotoğraf, Excel…) eskiden UTF-8 sanılıp çöp metin olarak dönüyordu.
      const duz = duzMetinOku(filename, bytes);
      if ('hata' in duz) {
        return new Response(JSON.stringify({ error: duz.hata }), { status: 415, headers: CORS });
      }
      text = duz.metin;
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
    const mesaj = e instanceof Error ? e.message : String(e);
    // Açılmış boyut tavanı (sıkıştırma bombası): istemcinin zaten bildiği
    // 'too_large' koduyla döner ("dosya çok büyük").
    if (mesaj === 'zip_too_large') {
      return new Response(JSON.stringify({ error: 'too_large' }), { status: 413, headers: CORS });
    }
    // İç hata metni (kütüphane/yol/bellek ayrıntısı) kullanıcıya DÖNMEZ;
    // sunucu günlüğüne yazılır (10.10.2026). İstemci yalnız `error` kodunu okur.
    console.error('doc-extract parse_failed:', mesaj);
    return new Response(JSON.stringify({ error: 'parse_failed' }), {
      status: 422,
      headers: CORS,
    });
  }
});
