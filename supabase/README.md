# Supabase Setup

Macro Ko uses [Supabase](https://supabase.com) for authentication, the relational
database, and secure document storage.

## 1. Create a project

1. Create a new project at https://supabase.com/dashboard.
2. Under **Project Settings → API**, copy the **Project URL** and **anon public key**.
3. Copy `.env.example` to `.env` in the repo root and fill in both values:

   ```
   EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

## 2. Run the migration

Open the **SQL Editor** in the Supabase dashboard and run the contents of
[`migrations/0001_init.sql`](./migrations/0001_init.sql), or apply it with the
Supabase CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

This creates:

- `profiles`, `clients`, `cases`, `hearings`, `deadlines`, `documents` tables
- Enums for case status, priority, hearing type, and document category
- A trigger that auto-creates a `profiles` row on signup
- Row Level Security policies scoping every table to `auth.uid()`
- A private `case-documents` storage bucket with owner-scoped storage policies

## 3. Enable email auth

Under **Authentication → Providers**, make sure **Email** is enabled. Email
confirmations can be turned off during development under **Authentication →
Settings** for faster sign-up testing.

## 4. Storage path convention

Documents are uploaded to `case-documents/<owner_id>/<case_id>/<filename>`,
which is what the storage RLS policies check against. Do not change this
convention in `src/hooks/useDocuments.ts` without updating the policies.
