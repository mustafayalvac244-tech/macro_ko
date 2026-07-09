-- Vekil Pro :: Günün Davası — günlük hukuk sorusu, cevaplar ve puanlar
-- Run after 0008.

create table question_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  question_key text not null, -- 'yyyy-MM-dd' — one entry per user per day
  body text not null check (char_length(body) between 10 and 4000),
  points int not null default 100,
  created_at timestamptz not null default now(),
  unique (user_id, question_key)
);

create index question_answers_key_idx on question_answers (question_key, created_at desc);
create index question_answers_user_idx on question_answers (user_id, created_at desc);

alter table question_answers enable row level security;

-- Every signed-in lawyer sees all answers (leaderboard, best answers)
create policy "qa readable by authenticated" on question_answers
  for select using (auth.role() = 'authenticated');
create policy "qa insert own" on question_answers
  for insert with check (user_id = auth.uid());
create policy "qa update own" on question_answers
  for update using (user_id = auth.uid());
create policy "qa delete own" on question_answers
  for delete using (user_id = auth.uid());
