# Korpüs eksikleri — ölçümle bulunanlar

Bu liste tahminle değil, ölçümle doğdu: her satır, bir ölçüm senaryosunun
kaçırdığı bilginin izini sürerken çıktı. Kural yazmadan önce buraya bakılmalı,
çünkü bazı eksikler kural değil **kanun metni** eksikliğidir ve kural yazmakla
kapanmaz.

## Havuzda olmayan kanunlar

### 2918 sayılı Karayolları Trafik Kanunu (KTK)

**Nasıl bulundu.** Mütalaa ölçümünde trafik kazası senaryosu, sigorta boyutunu
hiç ele almadı. İz sürülünce görüldü: havuzdaki 17 kanun arasında KTK yok.
`trafik_zamanasimi` kuralı KTK m.109'a atıf yapıyor ama maddenin kendi metni
havuzda bulunmadığı için:

- model, maddeyi lafzıyla aktaramıyor (yalnız kuralın özetine dayanıyor),
- `mevzuat_maddeleri` üzerinden yapılan atıf denetimi bu atfı doğrulayamıyor,
- zorunlu mali sorumluluk sigortasına doğrudan dava, sigortacıya karşı
  zamanaşımı gibi ayrıntılar hiç beslenemiyor.

Trafik kazası, Türkiye'de avukatın en sık gördüğü uyuşmazlıklardan biri;
korpüsteki en büyük tek eksik bu.

**Neden hâlâ eklenmedi.** Bu oturumda mevzuat.gov.tr'ye erişilemedi
(bağlantı sıfırlanıyor — çıkış politikası). Kanun metni elde edilemediği için
madde metinleri havuza yazılmadı. Hafızadan yazmak bilinçli olarak
YAPILMADI: bugünkü bütün kural metinleri havuzdaki madde metni okunarak
yazıldı ve bu disiplin, uydurma lafzın dilekçeye girmesini engelleyen şeyin
ta kendisi.

**Yapılacak.** Erişim açıldığında `scripts/parse-law-pdf.py` +
`scripts/load-law-db.mjs` zinciriyle eklenmeli (diğer 17 kanun böyle eklendi).
Sonrasında `trafik_zamanasimi` kuralı, madde lafzıyla ve sigorta boyutuyla
genişletilebilir.

## Kural düzeyinde kapatılan boşluklar (bu oturumda)

| Boşluk | Nasıl bulundu | Karşılığı |
|---|---|---|
| Cevap dilekçesinde def'i–itiraz ayrımı | dilekçe ölçümü: zamanaşımı "savunma" diye yazıldı | 0051 |
| Ödeme emrine itirazın lafzı | dilekçe ölçümü: "borca itiraz" hiç geçmedi | 0051 |
| İdari dava süresi ve adli tatil | mütalaa ölçümü: yerine HAGB besleniyordu | 0059 |
| İki haklı ihtarla tahliye (TBK m.352/2) | mütalaa ölçümü: kural havuzda hiç yoktu | 0060 |
| Kuralların doğal dille bulunamaması | mütalaa ölçümü: "işten çıkarıldı" → kira kuralı | 0058 |
