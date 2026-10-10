// İÇTİHAT ARAMA UCUNUN SAF MANTIĞI (09.10.2026).
//
// NEDEN AYRI DOSYA. functions/ictihat/index.ts Deno'ya özgü içe aktarmalar
// taşıyor ve test ortamında yüklenemiyor; içindeki kusurlar (künyeyi ezen
// arşiv yazımı, bir gün geri tarih, kesme işaretiyle ölen arama, sayfa
// atlayan akıllı kip) bu yüzden ancak canlıda görünüyordu. Buradaki her
// işlev tests/ictihatArama.test.ts'te davranışıyla sınanıyor.
//
// Bu dosya hiçbir şey içe aktarmaz: hem Deno'da hem vitest'te aynen koşar.

/** Arşive yazılan / arşivden gelen kararın künyesi (uçtaki Hit'in alt kümesi). */
export interface KararKunyesi {
  id: string;
  daire: string;
  esasNo: string;
  kararNo: string;
  kararTarihi: string;
  durum: string;
}

/**
 * Kurulu KARARIN GELDİĞİ KAYNAĞA göre değil, DAİRE ADINA göre belirler.
 *
 * Eski hâli kaynağa bakıyordu: canlı UYAP Emsal yolundan gelen her karara
 * "BAM/Yerel" diyordu. Ölçüldü: bu yüzden 14 YARGITAY kararı (ör. "Yargıtay
 * 1. Ceza Dairesi") havuza "BAM/Yerel" olarak yazılmış. Kaynak, kararın hangi
 * mercie ait olduğunu söylemez — daire adı söyler.
 *
 * Ayrıca hasatçılarla AYNI kuralı kullanır; iki kod yolu farklı etiket
 * üretince aynı havuzda "Diğer" ve "BAM/Yerel" gibi iki ayrı çöp kova oluşuyordu.
 * (functions/ictihat/index.ts'ten aynen taşındı.)
 */
export function kurulOf(daire: string): string {
  const d = (daire ?? '').toLocaleLowerCase('tr');
  if (d.includes('bölge adliye')) return 'BAM';
  if (d.includes('bölge idare')) return 'BİM';
  if (d.includes('danıştay')) return 'Danıştay';
  if (d.includes('yargıtay')) return 'Yargıtay';
  if (d.includes('anayasa')) return 'AYM';
  return 'Yerel';
}

/**
 * ictihat_kararlar upsert yükü — BOŞ KÜNYE ALANI YÜKE GİRMEZ.
 *
 * BULUNAN KUSUR (09.10.2026). Eski yazım boş alanı `null` olarak
 * gönderiyordu. PostgREST `on_conflict` birleştirmesinde yükteki HER sütunu
 * günceller; belge ucu kararı künyesiz (daire/esas/karar/tarih boş)
 * arşivlediği için, havuzda DOLU künyesiyle duran bir kararın künyesi her
 * açılışta null'a, kurulu "Yerel"e dönüyordu. Yükte olmayan sütuna ise
 * birleştirme dokunmaz: boş alanı hiç göndermemek, var olanı korur.
 *
 * Aynı sebeple daire boşken kurul TÜRETİLMEZ (kurulOf('') → 'Yerel' bir
 * uydurma olurdu) ve boş arama terimi eskisinin üstüne yazılmaz.
 */
export function arsivSatiri(h: KararKunyesi, fullText: string, aramaTerimi: string): Record<string, string> {
  const satir: Record<string, string> = { id: h.id };
  const daire = (h.daire ?? '').trim();
  if (daire) {
    satir.kurul = kurulOf(daire);
    satir.daire = daire;
  }
  if (h.esasNo) satir.esas_no = h.esasNo;
  if (h.kararNo) satir.karar_no = h.kararNo;
  if (h.kararTarihi) satir.karar_tarihi = h.kararTarihi;
  if (h.durum) satir.durum = h.durum;
  const terim = (aramaTerimi ?? '').slice(0, 120).trim();
  if (terim) satir.arama_terimi = terim;
  satir.full_text = fullText;
  return satir;
}

/** Düz ve tipografik kesme işaretleri (klavyeler ve kopyala-yapıştır farklı üretir). */
const KESME = "['’ʼ‘`´]";

/**
 * KESME İŞARETİ TEMİZLİĞİ.
 *
 * _shared/uyapCanli.ts'te kayıtlı ölçüm: "Kesme işareti UYAP aramasını
 * öldürüyor (ölçüldü: 0 vs 86.985 kayıt)". Arama ucu sorguyu olduğu gibi
 * gönderiyordu; "Yargıtay'ın" araması boş dönüyordu.
 *
 * Türkçede kesme işareti özel adı, kısaltmayı ya da sayıyı EKİNDEN ayırır
 * ("Yargıtay'ın", "TBK'nın", "344'üncü"). Ek, arama için gürültüdür; kesme
 * ve ardından gelen harfler atılır. (Kesmeyi boşluğa çevirmek "ın" gibi tek
 * başına bir sözcük bırakırdı; kaynağın bunu nasıl eşlediği ölçülmedi.)
 * Sözcüğe bağlı olmayan kesme (tek tırnak gibi kullanılan) boşluğa çevrilir.
 *
 * Başka hiçbir karaktere dokunulmaz: "2019/3641" künye araması ve çift
 * tırnaklı tam ifade araması aynen kalmalı.
 */
export function kesmeTemizle(q: string): string {
  return (q ?? '')
    .replace(new RegExp(`([\\p{L}\\p{N}])${KESME}+\\p{L}*`, 'gu'), '$1')
    .replace(new RegExp(KESME, 'gu'), ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Bir Date'in Türkiye'deki takvim günü, "GG.AA.YYYY". Saat dilimi verisi yoksa null. */
function turkiyeGunu(d: Date): string | null {
  try {
    const p = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Istanbul',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).formatToParts(d);
    const al = (t: string) => p.find((x) => x.type === t)?.value ?? '';
    const g = al('day');
    const a = al('month');
    const y = al('year');
    return g && a && y ? `${g}.${a}.${y}` : null;
  } catch {
    return null;
  }
}

/**
 * Bedesten karar tarihini GG.AA.YYYY olarak verir.
 *
 * BULUNAN KUSUR (09.10.2026). Bedesten `kararTarihi`yi Türkiye gece
 * yarısının UTC karşılığı olarak gönderebiliyor: 05.03.2024 tarihli karar
 * "2024-03-04T21:00:00.000+00:00" (kayıt: functions/katalog-tick). Uç bu
 * dizgenin ilk 10 karakterini alıp 04.03.2024 gösteriyordu — süre ve
 * kesinleşme hesabında kullanılan bir tarihte bir gün hata.
 *
 * Önce kaynağın kendi gösterim alanına (`kararTarihiStr`, "05.03.2024")
 * güvenilir. Yoksa saatli ISO Türkiye saatine çevrilir (2016 öncesi kış saati
 * dahil); saatsiz ISO olduğu gibi çevrilir.
 */
export function bedestenTarihi(gosterim: unknown, iso: unknown): string {
  const g = typeof gosterim === 'string' ? gosterim.trim() : '';
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(g)) return g;
  const s = typeof iso === 'string' ? iso.trim() : '';
  if (!s) return '';
  if (/T\d{2}:\d{2}/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      const gun = turkiyeGunu(d);
      if (gun) return gun;
    }
  }
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
}

/**
 * AKILLI KİP, 1. SAYFA: önce tam ifade (ardışık) sonuçları, ardından kelime
 * aramasının 1. sayfasının TAMAMI; tekrarlar atılır.
 *
 * BULUNAN KUSUR (09.10.2026). Birleşik liste sayfa boyuna KESİLİYORDU; 2.
 * sayfa ise kelime aramasının 2. sayfası. Tam ifade sonuçlarının yerinden
 * ettiği kelime sonuçları ne 1. sayfada ne sonrakilerde görünüyordu — "daha
 * fazla göster" sessizce sonuç atlıyordu. Kesmemek, sayfalamayı kelime
 * aramasının kendi sayfalarına bağlı tutar; istemci zaten kimliğe göre
 * tekrarları ayıklıyor.
 */
export function akilliIlkSayfa<T extends { id: string }>(ifade: readonly T[], kelime: readonly T[]): T[] {
  const gorulen = new Set<string>();
  const sonuc: T[] = [];
  for (const h of [...ifade, ...kelime]) {
    if (h.id && !gorulen.has(h.id)) {
      gorulen.add(h.id);
      sonuc.push(h);
    }
  }
  return sonuc;
}

/**
 * Künye araması "bu künyeyle karar bulunamadı" DİYEBİLİR Mİ?
 *
 * Diyemez: tam eşleşme yokken iki kaynaktan biri (UYAP Emsal: BAM/yerel;
 * Bedesten: Yargıtay) düşmüşse. Yargıtay künyesi yalnız Bedesten'de,
 * istinaf künyesi yalnız Emsal'de bulunur; düşen kaynağın kapsadığı karar
 * aranmamış olur. Karşı tarafın atfını doğrulayan avukata "bulunamadı"
 * demek, atfın uydurma olduğunu ima eder — yanlış bir "yok", "ulaşılamadı"dan
 * çok daha zararlıdır.
 */
export function kunyeYokDenemez(exactSayisi: number, emsalDustu: boolean, yargitayDustu: boolean): boolean {
  return exactSayisi === 0 && (emsalDustu || yargitayDustu);
}

/**
 * Uçtan dönen HATA yanıtı (durum + gövde).
 *
 * BULUNAN KUSUR (09.10.2026). Dış catch, hız sınırı ve yapılandırma dışındaki
 * HER hatayı `source_unreachable` olarak döndürüyordu; istemci bunu "Resmi
 * karar bankası (UYAP) yanıt vermiyor — uygulamada bir sorun yok" diye
 * gösteriyor. Yapay zekâ servisi düştüğünde (08.10'da Console hesabı askıya
 * alındı) avukata UYAP suçlanıyordu.
 *
 * Kodlar ai-chat ile ORTAK sözlükte: 'upstream' = yapay zekâ servisi,
 * 'empty' = yapay zekâ boş cevap (bkz. src/lib/aiHata.ts). Yayındaki eski
 * istemci tanımadığı kodu genel hata olarak gösterir; diğer kodlar aynen.
 */
export function ucHataYaniti(msg: string, ayrinti?: string): { status: number; govde: Record<string, string> } {
  if (msg === 'rate_limit') return { status: 429, govde: { error: 'rate_limit' } };
  if (msg === 'not_configured') return { status: 503, govde: { error: 'not_configured' } };
  // Güvenlik reddi de ai-chat'te olduğu gibi servis hatası olarak bildirilir.
  if (msg === 'upstream' || msg === 'refusal') {
    return { status: 502, govde: ayrinti ? { error: 'upstream', detail: ayrinti } : { error: 'upstream' } };
  }
  if (msg === 'empty') return { status: 502, govde: { error: 'empty' } };
  return { status: 502, govde: { error: 'source_unreachable', detail: ayrinti ?? msg } };
}
