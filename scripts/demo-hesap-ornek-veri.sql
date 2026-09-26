-- Apple incelemecisinin demo hesabına ÖRNEK veri
-- ===========================================================================
-- 25.09.2026 — ÖLÇÜLDÜ: demo hesap (bayram@vekilpro.app) girişte HTTP 200
-- veriyor ama İÇİ BOŞ: 0 dava, 0 müvekkil, 0 duruşma. İnceleme notu
-- "Dashboard: upcoming hearings and deadlines" diyor; incelemeci her ekranda
-- boş durum görüyordu. Boş bir uygulama, "özelliği bulamadık" türü redlerin
-- klasik sebebi.
--
-- Bütün kayıtlar KURGUSAL ve "Örnek" diye işaretli; gerçek kişi, gerçek
-- dosya, TC kimlik numarası YOK.
--
-- CANLIYA UYGULANDI 25.09.2026 ~13:23 UTC. Demo hesapla GERÇEK girişle
-- (RLS yolu, incelemecinin göreceği yol) geri okundu: 3 müvekkil, 3 dava,
-- 3 yaklaşan duruşma (27.09, 04.10, 15.10), 2 süre (28.09, 01.10).
-- DİKKAT: tarihler sabitlendi — inceleme 27.09'dan sonra yapılırsa ilk
-- duruşma "geçmiş" görünür. Yeniden gönderimde tarihleri tazelemek için
-- demo hesabın kayıtlarını silip bu betiği tekrar çalıştırmak yeter.
--
-- TEKRAR ÇALIŞTIRILABİLİR: hesapta en az bir dava varsa hiçbir şey yazmaz.
-- Tarihler now()'a göre — duruşmalar her zaman "yaklaşan" görünür.

do $$
declare
  sahip uuid := (select id from auth.users where email = 'bayram@vekilpro.app');
  m1 uuid; m2 uuid; m3 uuid; d1 uuid; d2 uuid; d3 uuid;
begin
  if sahip is null then raise exception 'demo hesap bulunamadı'; end if;
  if exists (select 1 from public.cases where owner_id = sahip) then
    raise notice 'demo hesapta zaten dava var — dokunulmadı';
    return;
  end if;

  insert into public.clients (owner_id, full_name, client_type, phone, notes)
  values (sahip, 'Ayşe Yılmaz (Örnek)', 'gercek', '0555 000 00 01', 'Örnek müvekkil — App Review demo kaydı')
  returning id into m1;
  insert into public.clients (owner_id, full_name, client_type, phone, notes)
  values (sahip, 'Mehmet Demir (Örnek)', 'gercek', '0555 000 00 02', 'Örnek müvekkil — App Review demo kaydı')
  returning id into m2;
  insert into public.clients (owner_id, full_name, company, client_type, notes)
  values (sahip, 'Örnek Tekstil A.Ş.', 'Örnek Tekstil A.Ş.', 'tuzel', 'Örnek şirket müvekkil — App Review demo kaydı')
  returning id into m3;

  insert into public.cases (owner_id, client_id, title, case_number, court_name, case_type, status, priority, opposing_party, description, opened_date)
  values (sahip, m1, 'İşçilik alacağı davası (Örnek)', '2026/345 Esas', 'İstanbul 12. İş Mahkemesi', 'İş', 'active', 'high',
          'Örnek Lojistik Ltd. Şti.', 'Kıdem ve ihbar tazminatı talebi. Örnek dosya.', current_date - 40)
  returning id into d1;
  insert into public.cases (owner_id, client_id, title, case_number, court_name, case_type, status, priority, opposing_party, description, opened_date)
  values (sahip, m2, 'Kira bedelinin tespiti (Örnek)', '2026/112 Esas', 'Ankara 5. Sulh Hukuk Mahkemesi', 'Kira', 'active', 'medium',
          'Örnek Kiracı', 'Beş yılı dolduran kira ilişkisinde bedel tespiti. Örnek dosya.', current_date - 25)
  returning id into d2;
  insert into public.cases (owner_id, client_id, title, case_number, court_name, case_type, status, priority, opposing_party, description, opened_date)
  values (sahip, m3, 'Ticari alacak davası (Örnek)', '2025/890 Esas', 'İstanbul Anadolu 3. Asliye Ticaret Mahkemesi', 'Ticaret', 'pending', 'medium',
          'Örnek Perakende A.Ş.', 'Fatura alacağının tahsili. Örnek dosya.', current_date - 120)
  returning id into d3;

  insert into public.hearings (owner_id, case_id, title, type, location, scheduled_at, reminder_minutes_before, notes) values
    (sahip, d1, 'Tanık dinlenmesi', 'hearing', 'İstanbul Adliyesi (Çağlayan), B Blok', date_trunc('day', now()) + interval '2 days 10 hours 30 minutes', 1440, 'Örnek duruşma'),
    (sahip, d2, 'Bilirkişi raporu üzerine duruşma', 'hearing', 'Ankara Adliyesi', date_trunc('day', now()) + interval '9 days 11 hours', 1440, 'Örnek duruşma'),
    (sahip, d3, 'Arabuluculuk toplantısı', 'mediation', 'İstanbul Anadolu Adliyesi', date_trunc('day', now()) + interval '20 days 14 hours', 1440, 'Örnek toplantı');

  insert into public.deadlines (owner_id, case_id, title, description, due_at, priority, reminder_minutes_before) values
    (sahip, d1, 'Cevaba cevap dilekçesi', 'HMK m.136 — iki haftalık süre. Örnek süre.', date_trunc('day', now()) + interval '3 days 17 hours', 'high', 1440),
    (sahip, d3, 'Bilirkişi raporuna itiraz', 'Tebliğden itibaren iki hafta. Örnek süre.', date_trunc('day', now()) + interval '6 days 17 hours', 'medium', 1440);
end $$;

-- Doğrulama
select (select count(*) from public.clients   where owner_id = u.id) as muvekkil,
       (select count(*) from public.cases     where owner_id = u.id) as dava,
       (select count(*) from public.hearings  where owner_id = u.id and scheduled_at > now()) as yaklasan_durusma,
       (select count(*) from public.deadlines where owner_id = u.id and due_at > now()) as yaklasan_sure
from auth.users u where u.email = 'bayram@vekilpro.app';
