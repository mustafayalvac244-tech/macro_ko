// UÇ İŞLEVLERİ İÇİN TİP DENETİMİ KABUKLARI.
//
// NEDEN VAR. tsconfig.json, supabase/functions dizinini denetimden HARİÇ
// tutuyordu; yani uç işlevlerinde yazılan hiçbir tip ya da kapsam hatası
// yakalanmıyordu. Bugün tam bu yüzden bir hata üretildi: bir değişken,
// tanımlandığı bloğun DIŞINDA kullanıldı. Derleyici görseydi anında söylerdi;
// görmediği için ancak o kod yolu çalıştığında — yani kullanıcının isteğinde —
// çökecekti.
//
// Uç işlevleri Deno'da koşuyor ve npm:/jsr:/https: biçiminde içe aktarma
// kullanıyor; tsc bunları çözemez. Bu kabuklar çözümlemeyi susturur, GERİYE
// KALAN her şey (kapsam, tip, imza) denetlenir. Amaç Deno'yu taklit etmek
// değil, kendi kodumuzdaki hataları yakalamak.

declare module 'npm:*';
declare module 'jsr:*';
declare module 'https://*';

// Deno çalışma ortamı globalleri.
declare const Deno: {
  env: { get(ad: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

// Supabase uç çalışma ortamının yerleşik gömme oturumu.
declare const Supabase: {
  ai: { Session: new (model: string) => { run(girdi: string, ayar?: Record<string, unknown>): Promise<unknown> } };
};
