/**
 * ÇİFT DOKUNUŞ KİLİDİ — iş sürerken aynı düğmeye ikinci basış yok sayılır
 * (09.10.2026).
 *
 * BULUNAN KUSUR: dava detayındaki "Taksit Ekle" isteği sürerken düğme açık
 * kalıyordu (yükleniyor durumu yoktu); iki dokunuş aynı numaralı iki taksit
 * yazıyordu. Kilit bir ref'tir (`useRef(false)`): React yeniden çizimini
 * beklemeden İLK dokunuşta kapanır; düğmenin `loading` hâli görsel geri
 * bildirimdir. İş bitince — hata olsa da — açılır.
 *
 * SINIRI: kilit bellektedir, yalnız bu ekranı korur. İki cihazdan aynı anda
 * ekleme ya da yanıtı kaybolan bir isteğin tekrarı sunucuda engellenmez;
 * case_installments'ta (case_id, seq) tekilliği yok.
 */
export async function tekSeferde(kilit: { current: boolean }, is: () => Promise<void>): Promise<void> {
  if (kilit.current) return;
  kilit.current = true;
  try {
    await is();
  } finally {
    kilit.current = false;
  }
}
