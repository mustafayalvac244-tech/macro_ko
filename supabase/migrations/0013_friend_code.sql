-- Vekil Kodu: kodla arkadaş ekleme (sohbette kişi bulma)
create or replace function gen_friend_code() returns text
language sql volatile as $$
  select 'VP-' || (
    select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', (floor(random()*31)+1)::int, 1), '')
    from generate_series(1, 6)
  )
$$;

alter table profiles add column if not exists friend_code text unique default gen_friend_code();
update profiles set friend_code = gen_friend_code() where friend_code is null;
