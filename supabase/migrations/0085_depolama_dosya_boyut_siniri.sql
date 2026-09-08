-- DEPOLAMA: yükleme boyutu SINIRSIZDI.
--
-- BULUNAN AÇIK. case-documents kovasının file_size_limit değeri NULL'dı, yani
-- tek bir istek istediği kadar büyük dosya yükleyebilirdi. Free planda toplam
-- depolama 1 GB ve veritabanı zaten 500 MB sınırının %83'ünde (bkz. 0084):
-- kötü niyetli tek bir kullanıcı ya da yanlışlıkla yüklenen dev bir video,
-- tüm büroların belge yüklemesini durdurabilirdi. Kimlik doğrulaması bunu
-- engellemez — saldırgan da meşru bir hesap açabilir.
--
-- ÖLÇÜM (bu düzeltme yazılırken): kovada 4 dosya, toplam 1.125 kB, en büyüğü
-- 714 kB. Yani 25 MB'lık sınır mevcut kullanımın 35 katı — taranmış bir dava
-- dosyası ya da uzun bir bilirkişi raporu için fazlasıyla geniş, ama kovayı
-- tek başına doldurmaya yetmez.
--
-- NOT: allowed_mime_types bilinçli olarak NULL bırakıldı. Tür kısıtı koymak
-- caziptir ama uygulamanın bugün hangi MIME tiplerini gönderdiği ölçülmedi;
-- yanlış bir liste, avukatın gerçek bir belgeyi yükleyememesine yol açardı.
-- Boyut sınırı, ölçülmemiş bir tür listesinden daha güvenli bir ilk adımdır.

update storage.buckets
   set file_size_limit = 26214400  -- 25 MB
 where id = 'case-documents';
