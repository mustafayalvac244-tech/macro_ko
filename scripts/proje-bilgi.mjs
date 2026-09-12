// PROJE BİLGİSİ — SALT OKUNUR. Verinin fiilen hangi BÖLGEDE durduğunu söyler.
//
// NEDEN BU DOSYA VAR. Kullanım koşulları "Verileriniz yurt dışındaki
// (İrlanda / AB) sunucularda barındırılır" diyor. Bu bir OLGU iddiası ve
// KVKK aydınlatma metni buna dayanacak — yani doğruluğu önemli. Alan adı
// Cloudflare arkasında olduğu için DNS bölge vermiyor; tek güvenilir kaynak
// Supabase'in kendi proje kaydı.
//
// Hiçbir şeyi DEĞİŞTİRMEZ: yalnız GET yapar.
//
// KULLANIM: SUPABASE_ACCESS_TOKEN=... node scripts/proje-bilgi.mjs

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF || 'wjshlysfmeqlnfiibknj';

if (!TOKEN) {
  console.error('SUPABASE_ACCESS_TOKEN gerekli.');
  process.exit(1);
}

const res = await fetch(`https://api.supabase.com/v1/projects/${REF}`, {
  headers: { Authorization: `Bearer ${TOKEN}` },
});

if (!res.ok) {
  console.error(`HATA ${res.status}: ${(await res.text()).slice(0, 400)}`);
  process.exit(1);
}

const p = await res.json();
const satir = (a, d) => console.log(String(a).padEnd(28) + (d ?? '(yok)'));

satir('proje adı', p.name);
satir('ref', p.id ?? REF);
satir('>> BÖLGE', p.region);
satir('kuruluş', p.created_at);
satir('durum', p.status);
satir('veritabanı ana makine', p.database?.host);
satir('postgres sürümü', p.database?.version);

// AB bölgesi mi? KVKK m.9 değerlendirmesi doğrudan buna bağlı.
const AB = /^eu-/i.test(String(p.region ?? ''));
console.log();
console.log(AB
  ? `SONUÇ: bölge "${p.region}" AB içinde görünüyor — koşullardaki "İrlanda / AB" ifadesi bölgeyle TUTARLI.`
  : `SONUÇ: bölge "${p.region}" AB DIŞINDA görünüyor — koşullardaki "İrlanda / AB" ifadesi YANLIŞ, düzeltilmeli.`);
