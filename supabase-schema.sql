-- PickProphet Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Picks table ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS picks (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  player        TEXT NOT NULL,
  player_id     TEXT,
  sport         TEXT NOT NULL DEFAULT 'Soccer',
  league        TEXT,
  prop_type     TEXT NOT NULL,
  line          DECIMAL(8,2),
  direction     TEXT,
  odds          TEXT,
  reasoning     TEXT,
  result        TEXT DEFAULT 'pending',
  date          TEXT,
  opponent      TEXT,
  home_away     TEXT,
  match_result  TEXT,
  score         TEXT,
  actual_stat   DECIMAL(10,4),
  game_stats    JSONB DEFAULT '{}',
  from_slip     BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast user queries
CREATE INDEX IF NOT EXISTS idx_picks_user_id ON picks(user_id);
CREATE INDEX IF NOT EXISTS idx_picks_created_at ON picks(created_at DESC);

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE picks ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own picks
CREATE POLICY "picks_select_own" ON picks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "picks_insert_own" ON picks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "picks_update_own" ON picks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "picks_delete_own" ON picks
  FOR DELETE USING (auth.uid() = user_id);
