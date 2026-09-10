// İSTEM BİLEŞENLERİNİN BOYUTU — model çağrısı yok, kotadan bir şey götürmez.
// ---------------------------------------------------------------------------
// NEDEN VAR. Ücretsiz tavan günde 200.000 token ve bir dilekçe isteği ~7.900
// token yiyor: günde ~25 istek. Bu, hem ürünün hem "ölç → düzelt → tekrar ölç"
// döngüsünün önündeki asıl duvar. Token azaltmak, kapasiteyi doğrudan artırır
// ve ücretli hatta faturayı düşürür.
//
// Ama körlemesine kısmak, ölçülerek kazanılmış doğruluğu geri verir. Bu betik,
// neyin ne kadar yer kapladığını ÖNCE ölçmek için: her senaryo için kural,
// mevzuat ve içtihat bloklarının karakter uzunluğunu çıkarır.
//
// İLK ÖLÇÜMÜN SONUCU (10 senaryo): kural ~3.400, mevzuat ~3.500, içtihat
// ~1.400 karakter; toplam besleme ~8.200 karakter. Buna sabit talimat
// (~5.200 karakter) ekleniyor. Yani istemde "şişme" yok: en büyük iki blok,
// dilekçenin dayandığı kuralların ve madde metinlerinin ta kendisi. Kural
// bloğunu kısmak, def'i/itiraz lafzı gibi ölçümle kazanılmış düzeltmeleri
// doğrudan silmek olurdu. Güvenli ve büyük bir kesinti YOK — bu, ölçüp
// vazgeçilmiş bir iyileştirmedir; kayıt burada dursun ki tekrar denenmesin.
//
// Kullanım: SVC=<service_role> node scripts/istem-bilesenleri.mjs
import { readFileSync } from 'node:fs';
const url='https://wjshlysfmeqlnfiibknj.supabase.co', svc=process.env.SVC;
const H={apikey:svc,Authorization:'Bearer '+svc,'Content-Type':'application/json'};
const rpc=async(ad,g)=>{const r=await fetch(`${url}/rest/v1/rpc/${ad}`,{method:'POST',headers:H,body:JSON.stringify(g)});return r.ok?r.json():[];};
const { senaryolar } = JSON.parse(readFileSync('scripts/dilekce-senaryolari.json','utf8'));
let tk=0, tm=0, ti=0, n=0;
for (const s of senaryolar) {
  const q = s.olay;
  const kural = await rpc('search_legal_rules',{q, match_count:3});
  const mevz  = await rpc('search_mevzuat_fts',{q, match_count:7});
  const ict   = await rpc('search_ictihat_fts',{q, match_count:4});
  const k = kural.reduce((t,r)=>t+String(r.body??'').length,0);
  // ai-chat mevzuatı snippet olarak veriyor; içtihat snippet'i 400 karakterde kesiliyor
  const m = mevz.reduce((t,r)=>t+String(r.snippet??'').length,0);
  const i = ict.slice(0,5).reduce((t,r)=>t+Math.min(String(r.snippet??'').length,400)+60,0);
  tk+=k; tm+=m; ti+=i; n++;
  console.log(`${s.id.padEnd(20)} kural ${String(k).padStart(5)} · mevzuat ${String(m).padStart(5)} · içtihat ${String(i).padStart(5)}`);
}
console.log(`\nORTALAMA: kural ${Math.round(tk/n)} · mevzuat ${Math.round(tm/n)} · içtihat ${Math.round(ti/n)} karakter`);
console.log(`Toplam besleme ortalaması: ${Math.round((tk+tm+ti)/n)} karakter ≈ ${Math.round((tk+tm+ti)/n/3.5)} token (TR için ~3.5 krktr/token)`);
