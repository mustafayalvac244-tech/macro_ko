-- KURALLAR, AVUKAT HUKUKİ TERİMİ KULLANMADIĞINDA BULUNMUYORDU.
--
-- ÖLÇÜLEN ARIZA (mütalaa ölçümü). "Müvekkil performans düşüklüğü gerekçesiyle
-- çıkarıldı, savunması alınmamış" diye anlatılan bir işe iade olayında arama
-- şunları döndürdü:
--
--   on_yil_uzama_tahliye (0.108) · ihbar_oneli (0.066) · haksiz_fiil (0.058)
--
-- Yani KİRA sözleşmesinin on yıllık uzama süresi, bir işten çıkarma olayına
-- "kesin hukuki kural" diye besleniyordu; ise_iade kuralı ise HİÇ gelmiyordu.
-- Üretilen mütalaada arabuluculuktan söz edilmedi — oysa işe iadede
-- arabuluculuk DAVA ŞARTIDIR (İşMK m.3) ve bir aylık süre ona başvuruyla
-- işler (İşK m.20). Doğrudan dava açan avukat, davasını usulden kaybeder.
--
-- Aynı ölçüm üç yazılışı yan yana koydu:
--   "işe iade davası açacağız"        → ise_iade (0.263)  ✔
--   "işten attılar"                    → ise_iade (0.127)  2. sırada
--   "performans gerekçesiyle çıkarıldı" → ise_iade YOK      ✘
--
-- KÖK SEBEP: tetikleyici listeleri hukuk terimleriyle yazılmış. Avukat müvekkilin
-- anlattığını yazıyor ("çıkarıldı", "işten attılar", "savunmam alınmadı"),
-- kuralın beklediği kelimeleri değil. Terimi bilen zaten kuralı da biliyor;
-- yardıma en çok ihtiyacı olan anlatım tam da bulunamayan anlatım.
--
-- Çözüm: tetikleyicilere GÜNLÜK DİLİ ekliyoruz. Kural metinleri değişmiyor.

update public.legal_rules
set triggers = triggers || ' '
  || 'işten çıkarıldı isten cikarildi işten çıkarma isten cikarma işten attılar '
  || 'isten attilar işten atıldı isten atildi işine son verildi isine son verildi '
  || 'iş akdi feshedildi is akdi feshedildi iş sözleşmesi feshedildi '
  || 'is sozlesmesi feshedildi sözleşmem feshedildi çıkışım verildi cikisim verildi '
  || 'performans düşüklüğü performans dusuklugu verimsizlik gerekçe gösterilmeden '
  || 'sebep gösterilmeden sebep gosterilmeden savunmam alınmadı savunmasi alinmadi '
  || 'savunma alınmadan savunma alinmadan geçersiz fesih gecersiz fesih '
  || 'haksız fesih haksiz fesih otuz işçi 30 işçi altı ay kıdem'
where id = 'ise_iade';

-- Arabuluculuk kuralı da aynı sebeple bulunamıyordu: dava şartı olduğu hâlde
-- yalnız "arabuluculuk" kelimesiyle çağrılabiliyordu.
update public.legal_rules
set triggers = triggers || ' '
  || 'dava açmadan önce dava acmadan once doğrudan dava açabilir miyim '
  || 'işçi alacağı davası isci alacagi davasi işe iade davası ise iade davasi '
  || 'işten çıkarıldı isten cikarildi kıdem ihbar davası kidem ihbar davasi '
  || 'ticari alacak davası ticari alacak davasi kiralanan tahliyesi davası'
where id = 'arabuluculuk_dava_sarti_kapsam';

-- İhbar öneli kuralı işten çıkarma olaylarında hemen her zaman ilgili; günlük
-- dil eklenince ise_iade ile birlikte gelmesi doğru sonuçtur.
update public.legal_rules
set triggers = triggers || ' '
  || 'işten çıkarıldı isten cikarildi ihbar süresi ihbaronel bildirim süresi '
  || 'kaç hafta önce haber kac hafta once haber'
where id = 'ihbar_oneli';
