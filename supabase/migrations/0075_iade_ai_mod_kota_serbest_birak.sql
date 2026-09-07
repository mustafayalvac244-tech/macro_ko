-- HAK İADESİ, "AI" KATMANININ SORU/MÜTALAA KOTASINI DA GERİ VERSİN.
--
-- BULUNAN AÇIK. ai_istek_iade (0056) yalnız GÜNLÜK çağrı sayacını (ai_usage)
-- ve KONTÖR bakiyesini (ai_kontor) geri veriyordu. "ai" katmanı (1.499₺/ay,
-- 250 soru + 12 mütalaa — bkz. 0074) KONTÖRE HİÇ BAKMAZ; o katmandaki hak
-- yalnız ai_mod_kota'da tutulur. Sonuç: "ai" katmanındaki bir avukat "bu
-- cevap işe yaramadı" deyip elle iade istediğinde ai_kontor/ai_usage'da
-- iade edecek bir şey bulunmuyordu (zaten hiç düşülmemişti) ama ai_mod_kota
-- satırı GÜNCELLENMİYORDU — yani manuel iade, o katmanda kullanıcıya
-- gerçekte HİÇBİR ŞEY geri vermiyordu; 250/12'lik aylık hakkından biri
-- boşuna gitmiş oluyordu. Kusurlu çıktıda hak gitmez ilkesi (0056), ai
-- katmanı için mekanik tespitin (kusurluCikti) YAKALAYAMADIĞI durumlarda
-- (yapısal olarak kusursuz ama hukuken işe yaramaz metin) fiilen işlemiyordu.
--
-- ÇÖZÜM. ai_istek.gun (YYYY-AA-GG) alanının ilk 7 karakteri ai_mod_kota.ay
-- (YYYY-AA) ile aynı biçimdir (bkz. supabase/functions/_shared/kullanim.ts:
-- aiPeriod/aiGun) — bu yüzden ekstra sütun gerekmez. ai_istek.mod = 'mutalaa'
-- olan istekler mütalaa kotasından, diğerleri (dilekce/kunye/belge/sohbet)
-- soru kotasından düşülmüştü (bkz. ai-chat/index.ts: ai_mod_rezerve_et
-- çağrısı p_mutalaa: isMutalaa ile TÜM modlar için, mod ayrımı olmaksızın,
-- istek başlamadan yapılıyor) — aynı ayrım burada da kullanılır.
--
-- ai_mod_serbest_birak zaten "ai" katmanı DIŞINDAKİ (pro/elit) kullanıcılar
-- ya da o ay hiç ai_mod_kota satırı olmayanlar için NO-OP'tur (WHERE eşleşen
-- satır yoksa hiçbir şey güncellenmez) — bu yüzden tier kontrolü GEREKMEZ,
-- koşulsuz çağrı güvenlidir. Yalnız r.musteriye_yazildi = true iken çalışır
-- (fonksiyonun zaten erken döndüğü dal) — mekanik kusurda hak zaten istek
-- ANINDA serbest bırakılmıştı (bkz. ai-chat/index.ts: cfg.modLimits && kusurlu
-- → aiModSerbestBirak); aynı satır için İKİNCİ KEZ serbest bırakmak, o
-- kullanıcının ARADAN GEÇEN SÜREDE gerçekten harcadığı başka bir hakkı
-- yanlışlıkla geri vermiş olurdu.
create or replace function public.ai_istek_iade(p_istek uuid, p_user uuid, p_sebep text default null)
returns jsonb
language plpgsql
security definer set search_path = public as $$
declare r public.ai_istek;
begin
  select * into r from public.ai_istek where id = p_istek and user_id = p_user;
  if not found then
    return jsonb_build_object('ok', false, 'neden', 'bulunamadi');
  end if;
  if r.iade_edildi then
    return jsonb_build_object('ok', false, 'neden', 'zaten_iade');
  end if;

  update public.ai_istek set iade_edildi = true, iade_sebep = left(coalesce(p_sebep, ''), 300) where id = p_istek;

  -- Müşteriye hiç yazılmamışsa (mekanik kusur) geri verilecek bir şey yok;
  -- iade yine kaydedilir, çünkü kalite göstergesi olarak değerlidir. Bu
  -- durumda ai_mod_kota da ZATEN istek anında serbest bırakılmıştı.
  if not r.musteriye_yazildi then
    return jsonb_build_object('ok', true, 'iade_try', 0, 'hak', 0);
  end if;

  -- Günlük çağrı sayacı bir azalır (negatife düşmesin).
  update public.ai_usage
     set calls = greatest(0, calls - 1), updated_at = now()
   where user_id = p_user and period = r.gun;

  if r.maliyet_try > 0 then
    update public.ai_kontor
       set bakiye_try = bakiye_try + r.maliyet_try,
           toplam_harcanan_try = greatest(0, toplam_harcanan_try - r.maliyet_try),
           guncellendi = now()
     where user_id = p_user;
  end if;

  -- "ai" katmanı kotasını geri ver — no-op olur eğer kullanıcı o katmanda
  -- değilse ya da o ay için hiç ai_mod_kota satırı yoksa.
  perform public.ai_mod_serbest_birak(p_user, left(r.gun, 7), r.mod = 'mutalaa');

  return jsonb_build_object('ok', true, 'iade_try', r.maliyet_try, 'hak', 1);
end;
$$;
