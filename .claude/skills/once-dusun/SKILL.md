---
name: once-dusun
description: Canlı bir şeyi değiştirmeden ÖNCE yapılacak düşünme adımı — bu değişiklik neyi çarpar, nasıl yanlış çıkar, nasıl geri alınır, ve "bitti" demeden önce ne görmem gerekir. Bir ayar sayısını büyütürken (işçi, eşzamanlılık, sıklık, yığın, limit), cron/zamanlama kurarken, uç işlevi dağıtırken, göç uygularken, dış bir servise (Apple, Play, Supabase) yazarken, ürün sahibine "sebep şu" diye teşhis söylerken ve koruma testi yazarken MUTLAKA bu skill'i kullan. Kullanıcı "düşün", "dikkat et" demese bile geçerlidir. Ölçüm NASIL yapılır sorusu ayrı — o `olcum` skill'inde.
---

# Önce düşün, sonra yap

`olcum` skill'i "sayıyı nasıl doğru ölçerim" diyor. Bu dosya ondan **önce**
gelen adımı anlatıyor: **değişikliği yapmadan önce nasıl yanlış çıkacağını
düşünmek.**

> Ürün sahibinin 19.09.2026'daki cümlesi: *"Bir şeyi yapmadan önce düşün
> sonra yap."* Bu dosya o cümlenin karşılığıdır ve aşağıdaki her madde
> BU PROJEDE GERÇEKTEN OLMUŞ bir olaydan geliyor. Genel tavsiye yok.

---

## 1. "Bu sayıyı büyütürsem NE çarpılır?" — en pahalı ders

**OLAY (18/19.09.2026 gecesi).** Vektörleme işçisi 8 → 16 → 32 → 64
çıkarıldı. İlk dört dakika harika göründü: 7.699/saat, hata %2,2. Sonra
veritabanı yeni bağlantı kabul edemez hâle geldi — `select now()` bile
açılamıyordu — ve bu hâlde **7,5 saat** kaldı. Ürün sahibi uyandığında
enkaz gördü.

Sebep, işçi sayısı değildi. Uç işlevi **her çağrının sonunda** şunu
koşuyordu:

```sql
select count(*) from ictihat_kararlar where embedding is null   -- ~70.000 satır
```

Tek başına zararsız. 64 ile çarpılınca dakikada 64 kez koşan bir canavar.

**Uyarı zaten ekrandaydı ve üstünden geçildi.** 16 işçiye çıkarken yanıt
gövdesinde `"remaining":null` görünmüştü. `null` demek "bu sayım
tamamlanamadı" demekti. Okundu, fark edilmedi, sayı büyütülmeye devam
edildi.

**Kural — bir eşzamanlılık/sıklık/limit sayısını büyütmeden önce:**

1. **Tek birimin maliyetini yaz.** "Bir çağrı ne yapıyor?" Sorgu sayısı,
   en pahalı sorgunun ne taradığı, kaç bağlantı tuttuğu.
2. **N ile çarp ve yüksek sesle söyle.** "64 × (70 bin satırlık sayım) =
   dakikada 64 tam tarama." Bu cümle kurulabiliyorsa karar zaten verilmiştir.
3. **Paylaşılan kaynağı adıyla say.** Bağlantı havuzu, `cron.max_running_jobs`,
   edge eşzamanlılığı, disk. Hangisi önce biter?
4. **Aynı kaynağı kullanan DİĞER işi adıyla say.** O gece hasat ve katalog
   işleri aynı cron bütçesini paylaşıyordu; vektörleme 32 iş kurunca
   `cron.max_running_jobs = 32` tavanı tek başına doldu (ölçüldü: toplam
   aktif iş 42'ydi) ve pg_cron fazlasını **sessizce atlıyordu** — hata
   vermeden.
5. **Basamağı iki katına çıkarırken bir öncekinin hata sayısı 0 olmalı.**
   Sıfır değilse büyütme; önce sebebini bul.

**Ve en önemlisi:** ürün sahibi "64 falan dene" dediyse bu, *denemeyi
başıboş bırakma* izni değildir. Gözü üstünde olmayan bir deney, deney değil
kumardır. Gece boyu koşacak bir ayarı, sonucunu göremeyeceğin bir saatte
açma — ya başında kal, ya küçük değerde bırak.

---

## 2. Maliyeti ödeyen ile faydayı gören farklıysa, o kod yanlış yerdedir

Aynı olayın ikinci yarısı. O pahalı sayım **hiçbir işe yaramıyordu**: cron
onu okumuyordu. Yalnız `scripts/embed-ictihat.mjs` döngüsünü nerede
durduracağını bilmek için kullanıyordu.

Yani **bedeli her çağrı ödüyordu, faydasını ayda birkaç kez koşan bir betik
görüyordu.**

**Kural:** bir hesabın maliyetini kim ödüyor, faydasını kim görüyor — ikisi
farklıysa hesabı **isteyene** taşı. Çözüm bir bayrak kadar basitti:
gövdede `kalan: true` gelirse say, gelmezse sayma.

---

## 3. Koruma testini yazdıktan sonra BOZ ve düştüğünü gör

**OLAY (18.09.2026).** Aydınlatma metninde kimlik numarası geçiyor mu diye
test yazıldı, geçti. Sonra metin dosyadan silinip tekrar koşuldu: **test yine
geçti.** Çünkü aynı sayfadaki başka bir cümle (müvekkilin kimlik numarası)
aynı kelimeleri içeriyordu. Test, ölçtüğünü sandığı şeyi ölçmüyordu.

**Kural:** koruma testi yazdıysan, korumaya çalıştığın şeyi **gerçekten
boz**, testin düştüğünü gör, sonra geri al. Geçen bir test kanıt değildir;
**bozulunca düşen** bir test kanıttır. Üç kontrol yazdıysan üçünü de ayrı
ayrı boz.

---

## 4. Teşhisi söylemeden önce "bunu nereden biliyorum?" diye sor

**OLAY (18.09.2026).** Ürün sahibine gün boyu "engel Paid Apps sözleşmesi"
denildi. Kaynak: onun gönderdiği bir ekran görüntüsündeki uyarı. Hiç
ölçülmedi. Gerçek engel bambaşkaydı — vitrin tamamen boştu.

**OLAY (aynı gün).** Tek bir 404 görülüp "bu kayıt yok" sanıldı ve buna
dayanarak bir ürünün satış ülkesi 175'ten 1'e düşürüldü.

**Kural:** "sebep şudur" bir İDDİADIR. Söylemeden önce:
- Bunu ölçtüm mü, yoksa birinden mi duydum / bir ekrandan mı okudum?
- Ölçmediysem cümleyi öyle kur: *"ölçmedim, tahminim şu"*.
- Ayırt edici ölçüm ne olurdu? Yapılabiliyorsa yap, yapılamıyorsa bunu söyle.

Yanlış teşhis, teşhissizlikten kötüdür: kural hâline gelir ve sonraki
oturumu yanlış yere götürür.

---

## 5. Geri dönüşü önce planla, sonra değiştir

O gece geri çekme kararı doğruydu ama **hazır değildi**: veritabanı bağlantı
kabul etmediği için `cron.unschedule` bile koşturulamadı. Kurtaran şey,
göçlerin GitHub Actions üzerinden Management API ile uygulanabilmesiydi —
yani şans eseri ikinci bir yol vardı.

**Kural:** canlıda bir şey değiştirmeden önce üç soruyu yanıtla:
1. **Nasıl geri alırım?** Komutu şimdi yaz, sonra değil.
2. **O komutu, değişiklik ters giderse hangi yoldan koşturabilirim?** Tek yol
   varsa ve o yol tıkanabilirse, ikinci yolu önce kur.
3. **Ne görürsem geri alırım?** Eşiği ÖNCEDEN söyle ("hata > 0", "hasat
   yarıya düşerse"). Eşik sonradan konursa insan hep "biraz daha bekleyeyim"
   der — o gece tam olarak bu oldu.

---

## 6. "Kabul edildi" ≠ "yazıldı" ≠ "çalışıyor"

Üç ayrı durum, üç ayrı kanıt ister. Bu projede üçü de ayrı ayrı yanılttı:

| Sanılan | Gerçek | Olay |
|---|---|---|
| HTTP 2xx döndü → yazıldı | Alan geri okunduğunda `null` | `contentRightsDeclaration` |
| İş akışı "success" → dağıtıldı | Varsayılan girdiyle BAŞKA işlev dağıtıldı | 15.09.2026 |
| Cron kurulu → çalışıyor | Her çağrı `WORKER_RESOURCE_LIMIT` ile düşüyordu | vektörleme |
| Boş liste → kayıt yok | Hata yutulmuştu | abonelik denetimi |

**Kural:** yazdıktan sonra **geri oku**. Dağıttıktan sonra **sürüm numarasına
bak**. Kurduktan sonra **yanıt gövdesini oku**, durum koduna değil.

---

## 7. Ölçüm aracının kendisi yükün parçası olabilir

**OLAY (19.09.2026).** Tıkanmayı ölçmek için yazılan salt okunur göç
`count(*) filter (where embedding is not null)` kullanıyordu — 100 bin
satırın tamamını taramak demek. Göç 5 dakikadan uzun asılı kaldı ve bir
öncekisi zaman aşımıyla düştü. Yani "yük var mı" diye bakan sorgu, yükü
artırıyordu.

**Kural:** sistem zorlanıyorken ölçüm sorgusu **ucuz** olmalı. Kısmi indeks
varsa onu kullan; toplam satır sayısı için `pg_class.reltuples` tahmini
yeter — ama adında **TAHMİN** yazsın, kesin sayıymış gibi sunulmasın.

---

## 8. Yapmadan önce yazılacak dört satır

Canlıyı değiştiren her iş için, koda dokunmadan önce:

```
DEĞİŞİKLİK : ne yapıyorum (tek cümle)
ÇARPAN     : bu şey neyi N ile çarpıyor, N kaç, paylaşılan kaynak hangisi
YANLIŞ GİDERSE : hangi belirtiyi göreceğim + geri alma komutu + onu
                 koşturacağım ikinci yol
BİTTİ DEMEK İÇİN : hangi ölçümü, ne zaman, hangi eşikle okuyacağım
```

Dört satır bir dakika sürer. O gece bu dört satır yazılsaydı, "ÇARPAN"
satırında *"64 × 70 bin satırlık sayım"* yazacaktı ve iş orada bitecekti.
