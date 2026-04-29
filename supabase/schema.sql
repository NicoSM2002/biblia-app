-- Habla con la Palabra — database schema
--
-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New
-- query → paste → Run). It creates two tables (conversations, turns) and
-- enables Row Level Security so each user only ever sees their own rows.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_user_idx
  on public.conversations(user_id, updated_at desc);

create table if not exists public.turns (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  ord int not null,
  question text not null,
  verse_reference text,
  verse_text text,
  response text not null,
  created_at timestamptz not null default now()
);

create index if not exists turns_conv_idx
  on public.turns(conversation_id, ord);

-- ---------------------------------------------------------------------------
-- Auto-update updated_at on conversations whenever a turn is added.
-- ---------------------------------------------------------------------------

create or replace function public.touch_conversation_updated_at()
returns trigger
language plpgsql
as $$
begin
  update public.conversations
     set updated_at = now()
   where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists turns_touch_conv on public.turns;
create trigger turns_touch_conv
  after insert on public.turns
  for each row execute function public.touch_conversation_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security — every user only sees / writes their own data.
-- ---------------------------------------------------------------------------

alter table public.conversations enable row level security;
alter table public.turns enable row level security;

drop policy if exists "users own their conversations" on public.conversations;
create policy "users own their conversations"
  on public.conversations
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users own turns of their conversations" on public.turns;
create policy "users own turns of their conversations"
  on public.turns
  for all
  using (
    exists (
      select 1
        from public.conversations c
       where c.id = turns.conversation_id
         and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
        from public.conversations c
       where c.id = turns.conversation_id
         and c.user_id = auth.uid()
    )
  );
