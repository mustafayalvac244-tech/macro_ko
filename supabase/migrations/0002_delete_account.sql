-- Vekil :: account self-deletion
-- Allows an authenticated user to permanently delete their own account and
-- ALL of their data (required by Google Play / App Store account-deletion
-- policies). Run this in the Supabase SQL Editor after 0001_init.sql.

create or replace function delete_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Remove the caller's storage object records (case-documents/<uid>/...).
  delete from storage.objects
  where bucket_id = 'case-documents'
    and (storage.foldername(name))[1] = auth.uid()::text;

  -- Delete the auth user row. profiles.id references auth.users on delete
  -- cascade, and clients/cases/hearings/deadlines/documents all cascade from
  -- profiles, so this wipes every row the user owns.
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function delete_account() from public, anon;
grant execute on function delete_account() to authenticated;
