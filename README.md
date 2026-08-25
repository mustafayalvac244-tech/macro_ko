# Macro Ko — Legal Case & Document Management

A cross-platform mobile app for lawyers to track cases, clients, court hearings,
legal deadlines, and case documents — built with Expo (React Native) and Supabase.

> **Note:** this repository also contains an unrelated project in
> [`ko-macro/`](./ko-macro) — a Knight Online combo/farm macro and respawn
> tracker driven by an Arduino Leonardo. It shares no code with the app below.

## Tech Stack

- **App**: Expo SDK 57 (React Native 0.86, TypeScript), Expo Router (file-based navigation)
- **State/data**: Zustand (auth session) + TanStack Query (server state/caching)
- **Backend**: Supabase (Postgres, Auth, Row Level Security, Storage)
- **Notifications**: expo-notifications (local reminders for hearings & deadlines)
- **Calendar**: react-native-calendars
- **File handling**: expo-document-picker, expo-image-picker, expo-file-system

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set up your Supabase project — see [`supabase/README.md`](./supabase/README.md)
   for the schema migration and storage bucket setup.
3. Copy the env template and add your Supabase credentials:
   ```bash
   cp .env.example .env
   ```
4. Start the app:
   ```bash
   npm run start
   ```
   Then press `i` for iOS simulator, `a` for Android emulator, or scan the QR
   code with Expo Go on a physical device.

## Project Structure

```
app/                      Expo Router routes (screens & navigation)
  (auth)/                 Login / signup, shown when signed out
  (app)/                  Tab navigator: Dashboard, Cases, Calendar, Vault, Clients
  case-form.tsx            Modal: create/edit case
  client-form.tsx           Modal: create/edit client
  hearing-form.tsx          Modal: schedule/edit a hearing
  deadline-form.tsx         Modal: create/edit a deadline
  document-upload.tsx       Modal: upload a document to a case
  settings.tsx               Profile, notification toggle, sign out

src/
  components/ui/           Shared themed components (Button, Card, Input, ...)
  components/cases|clients|documents|calendar/   Domain-specific list items
  hooks/                   TanStack Query hooks wrapping Supabase queries
  lib/                     Supabase client, notification scheduling
  store/                   Zustand auth store
  theme/                   Color palette, spacing, typography tokens
  types/database.ts        Hand-maintained types mirroring the SQL schema
  utils/format.ts          Date/file-size/text formatting helpers

supabase/
  migrations/0001_init.sql SQL schema, RLS policies, storage bucket
  README.md                 Supabase project setup instructions
```

## Design

Dark navy/corporate-grey theme (`src/theme/theme.ts`) with a muted gold accent
for a professional, high-end feel. Every primary screen is reachable from the
bottom tab bar in one tap, and case/document detail in two to three taps.

## Data Model

`profiles` (1 per lawyer) → `clients` → `cases` → `hearings` / `deadlines` /
`documents`. All tables are scoped by `owner_id` with Row Level Security so
each lawyer only ever sees their own data. See
[`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql) for
the full schema.
