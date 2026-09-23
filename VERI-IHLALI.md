# Veri ihlali olursa — ilk 72 saat

> **23.09.2026'da yazıldı.** Depoda veri ihlali prosedürü yoktu (`72 saat`,
> ihlal bildirimi hiçbir yerde geçmiyordu — tarandı). Olay anında ne
> yapılacağını düşünmeye vakit olmaz; bu yüzden şimdi yazılıyor.
>
> **Bu belge bir yapay zekâ taslağıdır, avukat tarafından kontrol
> edilmedi.** Aşağıdaki hukuki dayanaklar bilgi kesimim itibarıyladır;
> olay anında Kurum'un sitesinden güncel hâline bakılmalı.

---

## 1. Önce: bu bir ihlal mi?

KVKK m.12/5'in ölçütü: kişisel verilerin **kanuni olmayan yollarla
başkaları tarafından elde edilmesi.**

| Olay | İhlal mi? |
|---|---|
| Veritabanı yavaşladı, giriş 504 verdi (22-23.09.2026'da yaşandı) | **Hayır.** Erişilemezlik; kimse veriyi ele geçirmedi |
| Servis anahtarı (`sb_secret_…` / `service_role`) bir yere sızdı | **Evet sayılmalı** — anahtar RLS'yi atlar, her şeyi okur |
| Bir kullanıcı başka bir kullanıcının dosyasını görebildi | **Evet** |
| Depolama kovası (belgeler) herkese açık kaldı | **Evet** — kimse indirmemiş olsa bile |
| Yedek dosyası yetkisiz birine gitti | **Evet** |

Emin değilsen **ihlal say ve saati başlat.** Sonradan "değilmiş" demek,
72 saati kaçırmaktan ucuzdur.

---

## 2. İki ayrı sıfatımız var — bildirim yükü farklı

| Veri | Biz neyiz | Kim kime bildirir |
|---|---|---|
| Avukatın **kendi hesabı** (ad, e-posta, TC, baro no, ödeme) | **veri sorumlusu** | **Biz** → Kurul'a (72 saat) + etkilenen avukatlara |
| Dava/müvekkil kayıtlarındaki **üçüncü kişi verileri** | **veri işleyen** | **Biz** → avukatlara, gecikmeksizin (Kullanım Koşulları m.18/ç). Kurul'a ve müvekkile bildirim **avukatın** yükümlülüğü |

Uygulamada ikisi birlikte olur: bir sızıntı hem hesapları hem dosyaları
kapsar. İkisini de yap.

---

## 3. Saat saat

### 0-1. saat — durdur
1. **Sızan anahtarı iptal et.** Supabase Dashboard → Settings → API Keys →
   ilgili gizli anahtarı iptal et, yenisini üret. Yeni anahtarı **yalnız**
   GitHub Secrets'a ve Vault'a (`vekil_service_key`) yaz — sohbete değil.
2. Açık kalan kova/tablo varsa **kapat**.
3. Kanıtı koru: Supabase kayıtları (auth, edge, postgres) **sınırlı süre**
   saklanır. Önce dışa aktar, sonra incele.
   *Saklama süresi planımıza göre değişir; ölçülmedi.*

### 1-24. saat — kapsamı çıkar
- Hangi tablolar, hangi kullanıcılar, hangi zaman aralığı?
- Özel nitelikli veri var mı? Dava dosyalarında **ceza mahkûmiyeti ve sağlık
  verisi olabilir** (KVKK m.6). Varsa bildirimde açıkça söylenir.
- Etkilenen kullanıcı listesini SQL ile çıkar ve sakla.

### 24-72. saat — bildir
1. **Kurul'a** (hesap verisi için, veri sorumlusu olarak): Kurum'un internet
   sitesindeki **Veri İhlal Bildirim Formu**.
   Dayanak: KVKK m.12/5; Kurul'un 24.01.2019 tarih ve 2019/10 sayılı kararı —
   **öğrenmeden itibaren 72 saat.** Bilgilerin tamamı yoksa eldeki kadarı
   bildirilir, kalanı sonra tamamlanır. 72 saat geçerse **gecikmenin sebebi**
   de yazılır.
2. **Avukatlara** (etkilenen her kullanıcıya, e-posta ile): aşağıdaki şablon.
3. **Kayıt:** ne oldu, ne zaman öğrenildi, ne yapıldı — bu dosyanın sonundaki
   tabloya.

---

## 4. Avukatlara bildirim şablonu

> **Konu: Vekil Pro — hesabınızı etkileyen güvenlik olayı**
>
> Sayın [Ad Soyad],
>
> [TARİH SAAT]'te öğrendiğimiz bir güvenlik olayı, Vekil Pro'daki
> kayıtlarınızı etkilemiş olabilir.
>
> **Ne oldu:** [kısa, teknik olmayan açıklama]
> **Hangi kayıtlar:** [hesap bilgileri / dava kayıtları / belgeler]
> **Zaman aralığı:** [başlangıç – bitiş]
> **Ne yaptık:** [anahtar iptal edildi / erişim kapatıldı / …]
>
> Dava ve müvekkil kayıtlarınız bakımından veri sorumlusu sizsiniz; bu
> bildirim, KVKK m.12/5 kapsamında Kurul'a ve müvekkillerinize karşı kendi
> değerlendirmenizi yapabilmeniz için gönderilmektedir (Kullanım Koşulları
> m.18/ç). Bildiklerimiz bundan ibarettir; yeni bilgi öğrendikçe size
> yazacağız.
>
> Sorularınız için: [başvuru adresi — `src/config/kvkk.ts`, VERI_SORUMLUSU.eposta]

**Kural:** bilmediğin şeyi yazma. "Etkilenmemiştir" demek için kanıt gerekir;
yoksa "etkilenmiş olabilir" yazılır.

---

## 5. Bu belgenin önkoşulları — bugün EKSİK

| Eksik | Neden önemli |
|---|---|
| Veri sorumlusu unvanı / adresi / e-postası (`src/config/kvkk.ts`) | Kurul formu ve avukat bildirimi bunları ister |
| Kullanıcılara toplu e-posta gönderme yolu | Resend kurulu (`RESEND_API_KEY` GitHub Secrets'ta); toplu bildirim betiği **yazılmadı** |

---

## 6. Olay kaydı

| Tarih | Olay | İhlal mi | Bildirim | Not |
|---|---|---|---|---|
| 22-23.09.2026 | Giriş 504, veritabanı yavaşlığı | Hayır — erişilemezlik | — | `0154` göçü |
| 23.09.2026 | `vektorle_toplu/tetikle` girişsiz çağrılabiliyordu | Hayır — veri okumuyor; kötüye kullanım kanıtı yok | — | `0155` ile kapatıldı |
