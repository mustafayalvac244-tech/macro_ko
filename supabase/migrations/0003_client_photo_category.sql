-- Vekil :: add "client_photo" document category
-- Run this in the Supabase SQL Editor after 0002_delete_account.sql.

alter type document_category add value if not exists 'client_photo';
