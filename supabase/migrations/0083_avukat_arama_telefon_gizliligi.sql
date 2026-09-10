-- GİZLİLİK: avukat aramada telefonla TOPLU TARAMA mümkündü.
--
-- BULUNAN ZAAF. search_lawyers, telefon eşlemesini yalnızca 4 HANE ile ve
-- "içinde geçiyor" (ilike '%1234%') mantığıyla yapıyordu. Bu, "numarasını
-- bildiğim meslektaşımı bulayım" özelliğini "numara parçalarını deneyerek
-- avukat listesi topla ve numara→kimlik eşlemesi çıkar" aracına çeviriyordu.
-- Örnek: "0532" sorgusu, numarasında bu dizi geçen 20 avukatı ad/büro
-- bilgisiyle döndürürdü.
--
-- Bu, 0024'teki kararla da çelişiyordu: orada telefon/e-posta/TC sütunları
-- BİLEREK okunamaz yapılmıştı ("başka kullanıcılar okuyamaz"). Numarayı
-- okutmamak ama numaradan kimliğe ulaştırmak aynı kapıyı yan taraftan açar.
--
-- DURUM (düzeltme anında ölçüldü): 18 profilin HİÇBİRİNDE telefon kayıtlı
-- değildi, yani bugün sızacak veri YOKTU — bu düzeltme, veri birikmeden önce
-- kapıyı kapatıyor.
--
-- ÇÖZÜM: telefon eşlemesi için TAM numara istenir (en az 10 hane) ve karşılaştırma
-- SON 10 HANE üzerinden yapılır — böylece 0532..., +90532..., 90532... gibi
-- farklı yazımlar da doğru eşleşir ama parça deneyerek tarama imkânsız hale
-- gelir. Ad/büro/baro no/arkadaş kodu ile arama aynen korunur (bunlar zaten
-- mesleki olarak açık bilgiler ve rehber özelliğinin amacı).
create or replace function public.search_lawyers(p_q text)
returns table(id uuid, full_name text, firm_name text, bar_number text, avatar_url text, is_premium boolean)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  q text := trim(coalesce(p_q, ''));
  digits text := regexp_replace(coalesce(p_q, ''), '[^0-9]', '', 'g');
  code text := upper(regexp_replace(coalesce(p_q, ''), '\s', '', 'g'));
begin
  if length(q) < 2 then return; end if;
  return query
    select p.id, p.full_name, p.firm_name, p.bar_number, p.avatar_url, coalesce(p.is_premium, false)
    from public.profiles p
    where p.id <> auth.uid()
      and (
        p.full_name ilike '%' || q || '%'
        or p.firm_name ilike '%' || q || '%'
        or p.bar_number ilike '%' || q || '%'
        -- TELEFON: yalnız TAM numarayla, son 10 hane karşılaştırmasıyla.
        or (
          length(digits) >= 10
          and p.phone is not null
          and right(regexp_replace(p.phone, '[^0-9]', '', 'g'), 10) = right(digits, 10)
        )
        or p.friend_code ilike '%' || code || '%'
      )
    order by p.full_name
    limit 20;
end;
$$;
