// KENDİ SMTP'MİZ (Resend) — Supabase'in yerleşik e-posta servisinden çıkış.
//
// NEDEN (ölçüldü, 12.09.2026). Yayındaki ayar: rate_limit_email_sent = 2.
// Yani SAATTE 2 e-posta — kişi başı değil, TÜM PROJE için. Kayıt onayı, şifre
// sıfırlama ve e-posta değiştirme bu 2'yi paylaşıyordu. mailer_autoconfirm
// false olduğundan kayıt olan herkes onay maili bekliyor: aynı saatte üçüncü
// kişi mailini ALAMAZ ve hesabı açılmaz. Lansman engeli buydu.
//
// Sebep: kendi SMTP'miz yoktu (smtp_host tanımsız). Supabase'in yerleşik
// servisi test içindir; düşük kotalıdır ve teslim garantisi vermez.
//
// API ANAHTARI KODA YAZILMAZ. GitHub secret'ından ortam değişkeni olarak
// gelir; bu dosyada yalnız nereye yazılacağı durur.
//
// KULLANIM: RESEND_API_KEY=... SUPABASE_ACCESS_TOKEN=... node scripts/auth-smtp.mjs

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF || 'wjshlysfmeqlnfiibknj';
const KEY = process.env.RESEND_API_KEY;
const GONDEREN = process.env.SMTP_GONDEREN || 'noreply@vekilpro.app';
const AD = process.env.SMTP_GONDEREN_ADI || 'Vekil Pro';

// Saatlik gönderim tavanı. 200 seçildi çünkü:
//   • Resend'in ücretsiz katmanı günde 100 mail veriyor; saatlik 200 onu
//     zaten aşamaz, yani tavan pratikte Resend'in kendi kotasıdır.
//   • Tavanı büsbütün kaldırmak, bir hata döngüsünde kotayı bir saatte
//     tüketip GERÇEK kullanıcıları maildesiz bırakır.
const SAATLIK = Number(process.env.SMTP_SAATLIK || 200);

if (!TOKEN || !KEY) {
  console.error('SUPABASE_ACCESS_TOKEN ve RESEND_API_KEY gerekli.');
  process.exit(1);
}

const govde = {
  smtp_host: 'smtp.resend.com',
  smtp_port: 465,
  smtp_user: 'resend',
  smtp_pass: KEY,
  smtp_admin_email: GONDEREN,
  smtp_sender_name: AD,
  // Aynı adrese arka arkaya mail gönderme aralığı (saniye). 60 varsayılan;
  // 20'ye çekiyoruz ki "kodu tekrar gönder" makul sürede çalışsın.
  smtp_max_frequency: 20,
  rate_limit_email_sent: SAATLIK,
};

const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/config/auth`, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(govde),
});
if (!res.ok) {
  // Anahtar hata gövdesinde geri dönebilir; yazdırmadan önce maskele.
  const t = (await res.text()).replaceAll(KEY, '***');
  console.error(`HATA ${res.status}: ${t.slice(0, 400)}`);
  process.exit(1);
}

// Yazdıktan sonra GERİ OKU — "200 döndü" ile "ayar değişti" aynı şey değil.
const oku = await fetch(`https://api.supabase.com/v1/projects/${REF}/config/auth`, {
  headers: { Authorization: `Bearer ${TOKEN}` },
});
const c = await oku.json();
console.log(`smtp_host              ${c.smtp_host}`);
console.log(`smtp_admin_email       ${c.smtp_admin_email}`);
console.log(`smtp_sender_name       ${c.smtp_sender_name}`);
console.log(`rate_limit_email_sent  ${c.rate_limit_email_sent}  (saatte)`);
console.log(`smtp_max_frequency     ${c.smtp_max_frequency}  (saniye)`);

if (c.smtp_host !== 'smtp.resend.com' || Number(c.rate_limit_email_sent) !== SAATLIK) {
  console.error('DOĞRULAMA BAŞARISIZ — ayar beklendiği gibi yazılmadı.');
  process.exit(1);
}
console.log(`\nTamam. Saatlik sınır 2 → ${SAATLIK}.`);
