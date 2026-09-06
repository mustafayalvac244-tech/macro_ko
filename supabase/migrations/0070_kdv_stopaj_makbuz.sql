-- SERBEST MESLEK MAKBUZU: gelir kalemlerine KDV/stopaj oranı ve hesaplanan
-- tutarlar, artı makbuz numarası. Var olan kayıtlar etkilenmez (hepsi null
-- kalır = "kesinti uygulanmamış" — mevcut 51 kaydın anlamı değişmez).
--
-- Oranlar (vat_rate/withholding_rate) UYGULAMADAN girilir; tutarlar
-- (vat_amount/withholding_amount/net_total) veritabanında STORED GENERATED
-- olarak hesaplanır ki uygulama kodu ile veritabanı hiçbir zaman farklı bir
-- sayı üretmesin (tek hesap yeri).
alter table finance_entries add column if not exists vat_rate numeric
  check (vat_rate is null or (vat_rate >= 0 and vat_rate <= 100));
alter table finance_entries add column if not exists withholding_rate numeric
  check (withholding_rate is null or (withholding_rate >= 0 and withholding_rate <= 100));

alter table finance_entries add column if not exists vat_amount numeric
  generated always as (
    case when vat_rate is not null then round(amount * vat_rate / 100.0, 2) else null end
  ) stored;

alter table finance_entries add column if not exists withholding_amount numeric
  generated always as (
    case when withholding_rate is not null then round(amount * withholding_rate / 100.0, 2) else null end
  ) stored;

-- Avukatın eline geçecek nakit: matrah + KDV − stopaj. KDV/stopaj hiç
-- uygulanmamışsa (null) sıfır muamelesi görür, net_total = amount kalır.
alter table finance_entries add column if not exists net_total numeric
  generated always as (
    amount
      + coalesce(round(amount * vat_rate / 100.0, 2), 0)
      - coalesce(round(amount * withholding_rate / 100.0, 2), 0)
  ) stored;

alter table finance_entries add column if not exists receipt_no text;
alter table finance_entries add column if not exists receipt_issued boolean not null default false;
