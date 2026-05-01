-- Migration: add `liked` column to turns
--
-- Lets users mark individual turns as favorites. Defaults to false on
-- existing rows. RLS is unchanged — the existing policy on `turns` already
-- restricts updates to the owner of the parent conversation.
--
-- Run this once in the Supabase SQL Editor:
--   Project → SQL Editor → New query → paste → Run

alter table public.turns
  add column if not exists liked boolean not null default false;
