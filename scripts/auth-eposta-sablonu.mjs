// ŞİFRE SIFIRLAMA E-POSTASI: LİNK YERİNE 6 HANELİ KOD.
//
// BULUNAN HATA (kullanıcı bildirdi, 12.09.2026). Şifremi unuttum akışında
// gelen e-postadaki bağlantıya tıklayınca kullanıcı DOĞRUDAN HESABA GİRİYOR,
// yeni şifre sorulmuyor. Yani "şifre sıfırlama" fiilen bir giriş bağlantısına
// dönüşmüş durumda.
//
// SEBEP UYGULAMADA DEĞİL. app/forgot-password.tsx zaten doğru yazılmış:
// e-posta ister, sonra 6 haneli KOD ister ve verifyOtp({type:'recovery'})
// çağırır. Ama Supabase'in "Reset Password" e-posta şablonu varsayılan hâlde
// duruyor ve içinde {{ .ConfirmationURL }} var — yani kod değil, tek
// tıklamayla oturum açan bir sihirli bağlantı gönderiliyor. Kullanıcı o
// bağlantıya tıklayınca Supabase oturumu açıyor ve uygulamanın kod ekranı
// hiç devreye girmiyor.
//
// NEDEN GÜVENLİK SORUNU. Bu bağlantı e-posta kutusuna düşen tek bir
// tıklamayla TAM OTURUM veriyor; e-postaya erişen herkes (iletilen bir mesaj,
// açık bırakılmış bir sekme, kurumsal posta arşivi) hesaba girer ve şifreyi
// bilmesine bile gerek kalmaz. Kod ise uygulamaya elle girilmek zorundadır.
//
// DÜZELTME: şablonu {{ .Token }} kullanacak biçimde değiştiriyoruz.
//
// NEDEN BETİK / İŞ AKIŞI. Şablon veritabanında değil PROJE AYARLARINDA duruyor;
// SQL ile değiştirilemez. Management API'nin config ucundan yazılıyor ve
// kimlik için zaten tanımlı SUPABASE_ACCESS_TOKEN kullanılıyor — yeni secret
// YOK. Panelden elle de yapılabilir ama o zaman hangi metnin yayında olduğu
// hiçbir yerde kayıtlı olmaz; burada duruyor ve gözden geçirilebiliyor.
//
// KULLANIM: SUPABASE_ACCESS_TOKEN=... node scripts/auth-eposta-sablonu.mjs
//           (--kuru ile yalnız gönderilecek gövdeyi yazdırır, değişiklik yapmaz)

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF || 'wjshlysfmeqlnfiibknj';
const KURU = process.argv.includes('--kuru');
// --oku: hiçbir şey yazmaz, yalnız yayındaki e-posta ayarlarını ve HIZ
// SINIRLARINI raporlar. Kullanıcı "bir kere gönderdim ama 'çok fazla deneme'
// diyor" dedi; sınırın kaç olduğunu tahmin etmek yerine okuyoruz.
const OKU = process.argv.includes('--oku');

if (!TOKEN && !KURU) {
  console.error('SUPABASE_ACCESS_TOKEN gerekli.');
  process.exit(1);
}

// Şablon SADE TUTULDU. Süslü HTML e-posta istemcilerinde bozuluyor ve
// spam puanını yükseltiyor; burada tek iş var: kodu okunur göstermek.
const KURTAR_GOVDE = `<!doctype html>
<html lang="tr"><body style="margin:0;padding:24px;background:#f4f7fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0e1b33">
  <div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #dde5f2;border-radius:14px;padding:28px">
    <p style="margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:1.2px;color:#4a5a78;text-transform:uppercase">Vekil Pro</p>
    <h1 style="margin:0 0 14px;font-size:21px;line-height:1.3">Şifre sıfırlama kodunuz</h1>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#4a5a78">
      Uygulamadaki <b>Şifremi unuttum</b> ekranına aşağıdaki kodu yazın:
    </p>
    <p style="margin:0 0 18px;font-size:34px;font-weight:800;letter-spacing:7px;text-align:center;color:#12336b;background:#f4f7fc;border:1px solid #dde5f2;border-radius:10px;padding:16px 0">
      {{ .Token }}
    </p>
    <p style="margin:0 0 10px;font-size:13.5px;line-height:1.6;color:#7385a3">
      Kod kısa süre içinde geçersiz olur. Bu isteği siz yapmadıysanız bu e-postayı yok sayın;
      şifreniz değişmez.
    </p>
    <p style="margin:0;font-size:13.5px;line-height:1.6;color:#7385a3">
      Kodu <b>kimseyle paylaşmayın.</b> Vekil Pro hiçbir zaman sizden bu kodu telefonla ya da
      mesajla istemez.
    </p>
  </div>
</body></html>`;

const govde = {
  mailer_subjects_recovery: 'Vekil Pro şifre sıfırlama kodunuz',
  mailer_templates_recovery_content: KURTAR_GOVDE,
};

if (KURU) {
  console.log(JSON.stringify(govde, null, 2));
  process.exit(0);
}

if (OKU) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/config/auth`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const c = await r.json();
  const alanlar = [
    'smtp_host', 'smtp_sender_name', 'smtp_admin_email',
    'rate_limit_email_sent', 'rate_limit_otp', 'rate_limit_verify',
    'mailer_otp_exp', 'mailer_autoconfirm', 'mailer_secure_email_change_enabled',
  ];
  for (const a of alanlar) console.log(`${a.padEnd(38)} ${c[a] ?? '(tanımsız)'}`);
  console.log(
    c.smtp_host
      ? `\nKENDİ SMTP'NİZ TANIMLI: ${c.smtp_host}`
      : '\nKENDİ SMTP TANIMLI DEĞİL — Supabase\'in yerleşik servisi kullanılıyor.\n' +
        'Yerleşik servis ÜRETİM İÇİN DEĞİLDİR: saatlik gönderim sayısı düşüktür ve\n' +
        'teslim edilebilirliği garanti edilmez. Kayıt/şifre e-postaları buna bağlıysa\n' +
        'aynı saatte birkaç kişiden fazlası e-postasını ALAMAZ.'
  );
  process.exit(0);
}

const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/config/auth`, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(govde),
});

const metin = await res.text();
if (!res.ok) {
  console.error(`HATA ${res.status}: ${metin.slice(0, 400)}`);
  process.exit(1);
}

// Doğrulama: yazdıktan sonra GERİ OKU. "200 döndü" ile "şablon değişti" aynı
// şey değil; alan adı yanlışsa API sessizce yok sayabilir.
const oku = await fetch(`https://api.supabase.com/v1/projects/${REF}/config/auth`, {
  headers: { Authorization: `Bearer ${TOKEN}` },
});
const cfg = await oku.json();
const icerik = String(cfg.mailer_templates_recovery_content ?? '');
const tokenVar = icerik.includes('{{ .Token }}');
const linkVar = icerik.includes('ConfirmationURL');

console.log(`konu     : ${cfg.mailer_subjects_recovery}`);
console.log(`{{ .Token }} var mı : ${tokenVar}`);
console.log(`ConfirmationURL kaldı mı : ${linkVar}`);

if (!tokenVar || linkVar) {
  console.error('DOĞRULAMA BAŞARISIZ — şablon beklendiği gibi yazılmadı.');
  process.exit(1);
}
console.log('Şifre sıfırlama artık 6 haneli kod gönderiyor.');
