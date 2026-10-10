// DOSYADAN KÜNYE — avukatın kendi kayıtlarından gelen kesin bilgiler.
// ---------------------------------------------------------------------------
// ai-chat/index.ts'ten taşındı (09.10.2026): orada sınanamıyordu ve iki kusuru
// sınanmadığı için aylarca görünmedi (bkz. tests/dilekceSunucu.test.ts).
//
// NEDEN. Ölçümde üretilen taslaklarda 13-21 arası köşeli parantez boşluğu
// vardı: [Davacı Ad-Soyad], [Vekil ad-soyad], [Esas No], [Mahkeme]… Avukat,
// PROGRAMDA ZATEN KAYITLI olan bilgileri taslağa elle geçiriyordu. "İşimi
// hızlandırsın" beklentisinin en somut karşılığı burada: elimizdeki veriyi
// kullanmak.
//
// Model bu bilgileri BİLEMEZ (olay anlatısında geçmiyorsa uydurması yasak);
// biz biliyoruz. Bu yüzden dosyadan gelen değer, künyede modelin yazdığından
// da önce gelir.
//
// MÜVEKKİLİN SIFATI (davacı mı davalı mı) kayıtta tutulmuyor; dilekçe TÜRÜNDEN
// çıkarılır: dava açan davacıdır, cevap veren davalıdır, ihtarname çeken
// keşidecidir.
//
// Sorgular çağıranın kendi oturumuyla (RLS altında) yapılır.
//
// Saf modül: Deno'ya özgü hiçbir şey yok; istemci dışarıdan verilir.

/** Kullandığımız sorgu zinciri; test sahte istemciyle sınar. */
// deno-lint-ignore no-explicit-any
export type SorguIstemcisi = { from(tablo: string): any };

export async function dosyaKunyesiOku(
  db: SorguIstemcisi,
  kullaniciId: string,
  caseId: string | null,
  tip: string
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const tarihYaz = (v: unknown): string => {
    const d = v ? new Date(String(v)) : null;
    if (!d || Number.isNaN(d.getTime())) return '';
    return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`;
  };

  // DOSYA SEÇİLMESE DE DOLAN İKİ ŞEY VAR: avukatın kendi adı ve imza sıfatı.
  // İkisi de her taslakta elle yazılıyordu; birincisini profil, ikincisini
  // dilekçe türü söylüyor. Dosya seçmek bunlar için şart değil.
  const { data: dava } = caseId
    ? await db
        .from('cases')
        .select('id, client_id, case_number, court_name, opposing_party, decision_number, decision_date, decision_served_date')
        .eq('id', caseId)
        .maybeSingle()
    : { data: null };
  const d = (dava as Record<string, unknown>) ?? {};

  let musteri: Record<string, unknown> | null = null;
  if (d.client_id) {
    const { data } = await db
      .from('clients')
      .select('full_name, company, address, title, tc_no')
      .eq('id', d.client_id as string)
      .maybeSingle();
    musteri = (data as Record<string, unknown>) ?? null;
  }
  // PROFİL SORGUSU KULLANICIYA FİLTRELENİR — RLS'E GÜVENİLMEZ. Canlıda
  // (pg_policies, 09.10.2026 ölçüldü) "profiles readable by authenticated"
  // politikası duruyor: oturumlu her avukat TÜM profil satırlarını görür.
  // Filtresiz sorgu bu yüzden bütün avukatların ad/baro/sicilini çekiyordu;
  // maybeSingle() birden çok satırda null döndüğü için imzaya avukatın kendi
  // adı HİÇ yazılmıyordu, tek satır görünseydi BAŞKA avukatın adı yazılırdı.
  const { data: prof } = await db
    .from('profiles')
    .select('full_name, baro, bar_number, firm_name')
    .eq('id', kullaniciId)
    .maybeSingle();
  const p = (prof as Record<string, unknown>) ?? {};

  const musteriAdi = String(musteri?.full_name ?? musteri?.company ?? '').trim();
  // TCKN KÜNYEYE YAZILIR. Dava dilekçesinde davacının kimlik numarası ZORUNLU
  // unsurdur (HMK m.119/1-c) ve eksikliği bir haftalık kesin süreye, süre
  // içinde tamamlanmazsa davanın AÇILMAMIŞ SAYILMASINA yol açar (m.119/2).
  // Kayıtta varsa taslakta boşluk bırakmanın anlamı yok.
  const musteriTc = String(musteri?.tc_no ?? '').trim();
  const musteriSatiri = [
    musteriAdi,
    musteriTc ? `T.C. ${musteriTc}` : '',
    String(musteri?.address ?? '').trim(),
  ].filter(Boolean).join(' — ');
  const karsi = String(d.opposing_party ?? '').trim();
  const vekilAdi = String(p.full_name ?? '').trim();
  const vekilSatiri = vekilAdi
    ? [`Av. ${vekilAdi.replace(/^Av\.?\s*/i, '')}`, String(p.baro ?? '').trim(), String(p.firm_name ?? '').trim()]
        .filter(Boolean)
        .join(' — ')
    : '';

  if (vekilSatiri) out.VEKILI = vekilSatiri;
  const mahkeme = String(d.court_name ?? '').trim();
  if (mahkeme) out.MAHKEME = mahkeme;
  const esas = String(d.case_number ?? '').trim();
  if (esas) {
    out.ESASNO = esas;
    out.DOSYANO = esas;
  }

  // Müvekkilin ve karşı tarafın satırdaki YERİ dilekçe türüne göre değişir.
  const musteriEtiketi: Record<string, string> = {
    dava: 'DAVACI', replik: 'DAVACI', cevap: 'DAVALI', duplik: 'DAVALI',
    istinaf: 'ISTINAFEDEN', temyiz: 'TEMYIZEDEN', itiraz: 'ITIRAZEDENBORCLU',
    ihtarname: 'KESIDECI', bilirkisi: 'ITIRAZEDEN', islah: 'ISLAHEDEN',
  };
  const karsiEtiketi: Record<string, string> = {
    dava: 'DAVALI', replik: 'DAVALI', cevap: 'DAVACI', duplik: 'DAVACI',
    istinaf: 'KARSITARAF', temyiz: 'KARSITARAF', itiraz: 'ALACAKLI',
    ihtarname: 'MUHATAP', bilirkisi: 'KARSITARAF', islah: 'KARSITARAF',
  };
  if (musteriSatiri && musteriEtiketi[tip]) out[musteriEtiketi[tip]] = musteriSatiri;
  if (karsi && karsiEtiketi[tip]) out[karsiEtiketi[tip]] = karsi;

  // İmza bloğundaki "… Vekili" sıfatı da türden gelir.
  const imzaSifat: Record<string, string> = {
    dava: 'Davacı', replik: 'Davacı', cevap: 'Davalı', duplik: 'Davalı',
    istinaf: 'İstinaf Eden', temyiz: 'Temyiz Eden', itiraz: 'İtiraz Eden (Borçlu)',
    ihtarname: 'Keşideci', bilirkisi: 'İtiraz Eden', islah: 'Islah Eden',
  };
  if (imzaSifat[tip]) out.IMZASIFAT = imzaSifat[tip];

  // Kanun yolu dilekçelerinde kararın künyesi ve tebliğ tarihi.
  const kararSatiri = [mahkeme, esas, String(d.decision_number ?? '').trim(), tarihYaz(d.decision_date)]
    .filter(Boolean)
    .join(' · ');
  if (kararSatiri && (tip === 'istinaf' || tip === 'temyiz')) {
    out.KARAR = kararSatiri;
    out.TEMYIZEDILENKARAR = kararSatiri;
  }
  const teblig = tarihYaz(d.decision_served_date);
  // Not: bilirkişi RAPORUNUN tebliğ tarihi ayrı bir tarihtir ve kayıtta
  // tutulmuyor; karar tebliğ tarihini oraya yazmak yanlış süre hesaplatırdı.
  if (teblig) out.TEBLIGTARIHI = teblig;
  return out;
}
