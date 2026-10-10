// HUKUKİ ARAŞTIRMA (mod: 'mutalaa') — SAF YARDIMCILAR.
// ---------------------------------------------------------------------------
// Deno/Supabase bağımlılığı YOK, bu yüzden vitest ile sınanır (tests/mutalaaUretim.test.ts).
// Üç iş: istemin yapısı, çıktının bölüm denetimi, iç süre bütçesi.

// ───────────────────────── İSTEM YAPISI ─────────────────────────
//
// 09.10.2026 DENETİM: ekran "mütalaa ya da hukuki tavsiye DEĞİLDİR; ne
// yapmanız gerektiğini SÖYLEMEZ" (tr: mut.disclaimer / mut.lead) diyordu, istem
// ise "RESMİ HUKUKİ MÜTALAA ... SONUÇ VE KANAAT (net tavsiye)" ürettiriyordu.
// scripts/olcum-*.json'daki gerçek çıktılarda başlık "HUKUKİ MÜTALAA" ve metin
// "Tavsiye: Derhal arabulucuya başvur" idi: ekran bir şey söylüyor, ürün başka
// bir şey yapıyordu. Ekran metni bilinçli bir üründür (Derin Araştırma → Hukuki
// Araştırma, KARAR-DEFTERI), bu yüzden düzeltilen İSTEMDİR.
//
// Başlık ADLARI bilerek DEĞİŞMEDİ: scripts/mutalaa-olcut.mjs ve
// scripts/eval-mutalaa.mjs aynı altı adı arıyor; yalnız her başlığın altına
// yazılacak ŞEYİN tanımı "tavsiye"den "tespit + seçenek"e çekildi.
// Değişikliğin model çıktısına etkisi ÖLÇÜLMEDİ (yapay zekâ isteği yapılmadı).
export const MUTALAA_YAPI_TALIMATI =
  'ŞU AN "HUKUKİ ARAŞTIRMA" MODUNDASIN: avukata, bir kıdemli ortağın hazırlık notu düzeyinde ' +
  'bir ARAŞTIRMA NOTU hazırlıyorsun. Bu not mütalaa ya da hukuki tavsiye DEĞİLDİR; neyin yapılacağına ' +
  'avukat karar verir. Belgenin başlığına "mütalaa" YAZMA; başlık "HUKUKİ ARAŞTIRMA NOTU" olsun. ' +
  'Müvekkile ya da avukata emir verme ("başvurun", "açın", "derhal yapın" yok); tespit ve seçenek dilini ' +
  'kullan ("… süresi X\'tir", "… yoluna gidilirse …"). Şu başlıklarla yaz:\n' +
  '1. OLAY VE TESPİTLER\n2. HUKUKİ SORUNLAR\n3. İNCELEME (her sorunu ayrı ayrı, dayanaklarıyla)\n' +
  '4. RİSKLER VE KARŞI TARAFIN OLASI SAVUNMALARI\n' +
  '5. SONUÇ VE KANAAT (bulguların özeti: hangi görüşün neden daha güçlü göründüğü; kesin yönlendirme değil)\n' +
  '6. ATILACAK ADIMLAR (avukatın değerlendirebileceği olası adımlar; her biri bağlı olduğu SÜREYLE, sıralı)\n' +
  'Aşağıdaki ARAŞTIRMA DOSYASINDAKİ gerçek kural/madde/kararlara dayan; dosyada olmayan madde ' +
  'numarası veya karar UYDURMA. Kapsamlı ama gereksiz tekrarsız yaz.\n' +
  'Dosyada uygun karar yoksa "[emsal karar: İçtihat Arama ile ekleyin]" yaz; esas/karar numarasını ezberden yazma.\n';

// ───────────────────────── BÖLÜM DENETİMİ ─────────────────────────
//
// Bu denetim bugüne kadar YALNIZ ölçüm betiğindeydi (scripts/mutalaa-olcut.mjs);
// yani eksik bölümü ÖLÇÜYORDUK ama kullanıcıyı ondan KORUMUYORDUK (yarıda
// kesilen not "tamam" diye veriliyor, hak düşülüyordu). Betikteki sürümden iki
// fark: (1) başlık ARANIR, kelime değil — gövdede geçen "risk" RİSKLER başlığını
// kurtarmasın; (2) her bölümün okunur adı döner, ekran onu gösterir.
//
// JS'in /i bayrağı Türkçe büyük İ'yi küçük i'ye eşlemez; bu yüzden karşılaştırma
// Türkçe küçültülmüş + aksanı düşürülmüş metinde ASCII desenle yapılır.
export const MUTALAA_BOLUMLERI: ReadonlyArray<{ ad: string; desen: RegExp }> = [
  { ad: 'OLAY VE TESPİTLER', desen: /olay ve tespit/ },
  { ad: 'HUKUKİ SORUNLAR', desen: /hukuki sorun/ },
  { ad: 'İNCELEME', desen: /inceleme/ },
  { ad: 'RİSKLER VE KARŞI TARAFIN OLASI SAVUNMALARI', desen: /risk/ },
  { ad: 'SONUÇ VE KANAAT', desen: /(sonuc ve )?kanaat/ },
  { ad: 'ATILACAK ADIMLAR', desen: /(atilacak )?adimlar/ },
];

/** Satırlar korunur (başlık satır başında aranacak); biçim işaretleri atılır. */
function satirliSade(v: string): string {
  return String(v ?? '')
    .toLocaleLowerCase('tr')
    .replace(/[ğüşıöçâîû]/g, (c) => ({ ğ: 'g', ü: 'u', ş: 's', ı: 'i', ö: 'o', ç: 'c', â: 'a', î: 'i', û: 'u' })[c] as string)
    .replace(/[*_`]/g, '')
    .replace(/[ \t ]+/g, ' ');
}

/** Metinde başlığı BULUNAMAYAN bölümlerin okunur adları (hepsi varsa boş). */
export function eksikBolumler(metin: string): string[] {
  const sade = satirliSade(metin);
  return MUTALAA_BOLUMLERI
    // Satır başı + isteğe bağlı işaretler (#, >, numara, nokta/parantez, tire) + başlık.
    .filter(({ desen }) => !new RegExp(`^[\\s#>\\d.)(-]*${desen.source}`, 'm').test(sade))
    .map(({ ad }) => ad);
}

// ───────────────────────── İÇ SÜRE BÜTÇESİ ─────────────────────────
//
// 04.10.2026 ÖLÇÜLDÜ: Sonnet 5 + düşünmeyle mütalaa 151,6 sn'de Supabase'in istek
// süresi sınırına çarpıp HTTP 546 ile düştü (scripts/olcum-sonnet-sonuc.json;
// KARAR-DEFTERI: sınır 150 sn). 546'yı PLATFORM üretir: işlev öldürüldüğü için
// ne hak iadesi çalışır (basarisizsaIadeEt) ne de kullanıcıya anlamlı hata gider;
// istemci gövdeyi okuyamaz ve "internet bağlantınızı kontrol edin" der.
//
// Bu yüzden model adımları KENDİ bütçemize bağlanır: dolarsa işlev kendi
// kararıyla 504 + zaman_asimi döner, sarmalayıcı hakkı iade eder, ekran doğru
// sebebi söyler.
//
// 120 sn: ÖLÇÜLMEDİ, TAHMİN. 150 sn'lik sınırdan, sentez bittikten sonra koşan
// atıf/madde/künye denetimleri ve kayıt için bırakılan paydır; bu payın
// yeterliliği ölçülmedi. Aşırı sıkı olursa normal koşunun (72,9 sn ölçüldü,
// 05.10) üstünde ~47 sn tolerans kalır.
export const MUTALAA_MODEL_BUTCESI_MS = 120_000;

/** Başlangıçtan geçen süreyi tavandan düşer; eksiye inmez. */
export function kalanMs(basladi: number, simdi: number, tavanMs: number): number {
  return Math.max(0, tavanMs - (simdi - basladi));
}

/**
 * İşi verilen süre içinde bekler; dolarsa `zaman_asimi` hatası atar.
 *
 * NOT: Promise.race iptal DEĞİL, vazgeçmedir — kaybeden model çağrısı arka planda
 * kendi ömrünce sürer (Anthropic isteğine AbortSignal geçirilmiyor; sarmalayan
 * ucretliChat zincirine sinyal taşımak bu alanın dışındaydı). Kullanıcıdan
 * faturalanmaz (recordUsage çağrılmaz); bizim tarafta ölçülmeyen bir token
 * harcaması kalabilir.
 */
export function sureyleBekle<T>(is: Promise<T>, ms: number): Promise<T> {
  // Bütçe bitmişse işi beklemeden reddet; eldeki söz sahipsiz kalmasın.
  if (ms <= 0) {
    is.catch(() => {});
    return Promise.reject(new Error('zaman_asimi'));
  }
  return new Promise<T>((coz, red) => {
    const zamanlayici = setTimeout(() => {
      is.catch(() => {});
      red(new Error('zaman_asimi'));
    }, ms);
    is.then(
      (v) => {
        clearTimeout(zamanlayici);
        coz(v);
      },
      (e) => {
        clearTimeout(zamanlayici);
        red(e);
      },
    );
  });
}
