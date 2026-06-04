// ── Sport types ───────────────────────────────────────────────────────────────
export type Sport = 'Soccer' | 'NBA' | 'NFL';

// ── Pick / training data ──────────────────────────────────────────────────────
export interface Pick {
  id: string;
  user_id?: string;
  player: string;
  player_id?: string | null;
  sport: Sport;
  league?: string | null;
  prop_type: string;
  line: number;
  direction: 'Over' | 'Under' | 'Yes' | 'No';
  odds?: string | null;
  reasoning?: string | null;
  result: 'win' | 'loss' | 'pending';
  date?: string | null;
  opponent?: string | null;
  home_away?: 'H' | 'A' | null;
  match_result?: 'W' | 'L' | 'D' | null;
  score?: string | null;
  actual_stat?: number | null;
  game_stats?: Record<string, unknown>;
  from_slip?: boolean;
  created_at?: string;
}

// ── Player search ─────────────────────────────────────────────────────────────
export interface PlayerSearchResult {
  id: string | number;
  name: string;
  team?: string;
  position?: string;
  sport: Sport;
}

// ── Game row ─────────────────────────────────────────────────────────────────
export interface GameRow {
  date: string;
  opponent: string;
  result: 'W' | 'L' | 'D';
  score: string;
  ha: 'H' | 'A';
  stats: Record<string, number | null>;
  event_id?: number;
}

// ── Stat tab config ──────────────────────────────────────────────────────────
export interface StatConfig {
  label: string;
  primaryStat: string;
  primaryLabel: string;
  avgStats: { key: string; label: string; dec?: number }[];
  tableStats: { key: string; label: string; dec?: number }[];
}

// ── PrizePicks prop ──────────────────────────────────────────────────────────
export interface PPProp {
  player: string;
  stat: string;
  line: number;
  desc: string;
  half: string;
  sport: Sport;
}

// ── Odds API ──────────────────────────────────────────────────────────────────
export interface OddsGame {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Bookmaker[];
}

export interface Bookmaker {
  key: string;
  title: string;
  markets: Market[];
}

export interface Market {
  key: string;
  outcomes: Outcome[];
}

export interface Outcome {
  name: string;
  price: number;
  point?: number;
  description?: string;
}

// ── AI Prediction ────────────────────────────────────────────────────────────
export interface PredictionResult {
  recommendation: string;
  confidence: number;
  reasoning: string;
  pattern_match: 'High' | 'Medium' | 'Low';
  key_factors: string[];
  risks: string[];
  value_rating: 'High Value' | 'Standard' | 'Fade';
  data_confidence: 'Strong' | 'Moderate' | 'Limited';
}

// ── Chat message ─────────────────────────────────────────────────────────────
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ── Slip bet ─────────────────────────────────────────────────────────────────
export interface SlipBet {
  player: string;
  propType: string;
  line: number | null;
  direction: 'Over' | 'Under' | 'Yes' | 'No';
  odds: string | null;
  result: 'win' | 'loss' | 'pending';
}

// ── Player profile ────────────────────────────────────────────────────────────
export interface PlayerProfile {
  id: string | number;
  name: string;
  team?: string;
  position?: string;
  meta?: string;
  imageUrl?: string;
}
