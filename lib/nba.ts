// NBA data via BallDontLie API — all NBA-specific functions live here
const BDL = 'https://api.balldontlie.io/v1';

function bdlHeaders() {
  return { 'Authorization': process.env.BALLDONTLIE_API_KEY || '' };
}

async function bdlFetch(path: string, revalidate = 300) {
  const res = await fetch(`${BDL}${path}`, {
    headers: bdlHeaders(),
    next: { revalidate },
  });
  if (!res.ok) throw new Error(`BallDontLie ${path} → ${res.status}`);
  return res.json();
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface NBATeam {
  id: number;
  name: string;
  full_name: string;
  abbreviation: string;
  city: string;
  conference: string;
  division: string;
}

export interface NBAGame {
  id: number;
  date: string;
  home_team: NBATeam;
  visitor_team: NBATeam;
  home_team_score: number;
  visitor_team_score: number;
  season: number;
  postseason: boolean;
  status: string;
  time: string;
}

export interface NBAPlayerStat {
  id: number;
  game: NBAGame;
  player: { id: number; first_name: string; last_name: string; position: string };
  team: NBATeam;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  fg3m: number;
  fg3a: number;
  fgm: number;
  fga: number;
  fg_pct: number;
  dreb: number;
  oreb: number;
  turnover: number;
  ft_pct: number;
  ftm: number;
  fta: number;
  min: string;
  pf: number;
}

export interface NBASeasonAverage {
  player_id: number;
  season: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  fg3m: number;
  fg_pct: number;
  ft_pct: number;
  turnover: number;
  games_played: number;
  min: string;
}

// ── Season helper ──────────────────────────────────────────────────────────────

export function getCurrentNBASeason(): number {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  // Season starts in October: Oct-Dec 2025 = season 2025; Jan-Sep 2026 = season 2025
  return month >= 10 ? year : year - 1;
}

// ── Player search ──────────────────────────────────────────────────────────────

export async function searchNBAPlayers(q: string) {
  try {
    const data = await bdlFetch(`/players?search=${encodeURIComponent(q)}&per_page=8`);
    return (data.data || []).map((p: { id: number; first_name: string; last_name: string; team?: NBATeam; position: string }) => ({
      id: p.id,
      name: `${p.first_name} ${p.last_name}`,
      team: p.team?.full_name || '',
      teamId: p.team?.id,
      position: p.position || '',
      sport: 'NBA' as const,
    }));
  } catch {
    return [];
  }
}

// ── Player recent games (with real team names) ─────────────────────────────────

export async function getNBAPlayerRecentGames(playerId: number, count = 15): Promise<NBAPlayerStat[]> {
  try {
    const data = await bdlFetch(`/stats?player_ids[]=${playerId}&per_page=${count}&sort=-date`, 60);
    return data.data || [];
  } catch {
    return [];
  }
}

// ── Today's NBA games ──────────────────────────────────────────────────────────

export async function getNBATodayGames(): Promise<NBAGame[]> {
  const today = new Date().toISOString().split('T')[0];
  try {
    const data = await bdlFetch(`/games?dates[]=${today}&per_page=15`, 120);
    return data.data || [];
  } catch {
    return [];
  }
}

// ── Team's last N completed games ──────────────────────────────────────────────

export async function getNBATeamRecentForm(teamId: number, n = 5): Promise<NBAGame[]> {
  const season = getCurrentNBASeason();
  try {
    const data = await bdlFetch(`/games?team_ids[]=${teamId}&seasons[]=${season}&per_page=82`, 600);
    return ((data.data || []) as NBAGame[])
      .filter((g) => g.status === 'Final')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, n);
  } catch {
    return [];
  }
}

// ── Player stats vs a specific opponent (current season) ──────────────────────

export async function getNBAPlayerVsOpponent(playerId: number, opponentTeamId: number): Promise<NBAPlayerStat[]> {
  const season = getCurrentNBASeason();
  try {
    const data = await bdlFetch(`/stats?player_ids[]=${playerId}&seasons[]=${season}&per_page=100`, 600);
    return ((data.data || []) as NBAPlayerStat[]).filter((s) => {
      const g = s.game;
      return g.home_team.id === opponentTeamId || g.visitor_team.id === opponentTeamId;
    });
  } catch {
    return [];
  }
}

// ── Season averages ────────────────────────────────────────────────────────────

export async function getNBASeasonAverages(playerId: number): Promise<NBASeasonAverage | null> {
  const season = getCurrentNBASeason();
  try {
    const data = await bdlFetch(`/season_averages?season=${season}&player_ids[]=${playerId}`, 3600);
    return data.data?.[0] || null;
  } catch {
    return null;
  }
}

// ── Format team form for AI prompt ────────────────────────────────────────────

export function formatTeamForm(teamName: string, games: NBAGame[], teamId: number): string {
  if (!games.length) return `${teamName}: No recent game data`;
  const results = games.map((g) => {
    const isHome = g.home_team.id === teamId;
    const myScore = isHome ? g.home_team_score : g.visitor_team_score;
    const oppScore = isHome ? g.visitor_team_score : g.home_team_score;
    const result = myScore > oppScore ? 'W' : 'L';
    const opp = isHome ? g.visitor_team.abbreviation : g.home_team.abbreviation;
    const ha = isHome ? 'H' : 'A';
    return `${result}(${myScore}-${oppScore} vs ${opp} ${ha})`;
  });
  const wins = results.filter((r) => r.startsWith('W')).length;
  return `${teamName}: ${wins}/${games.length} last ${games.length} — ${results.join(', ')}`;
}

// ── Format H2H stats for AI prompt ────────────────────────────────────────────

export function formatH2HStats(playerName: string, opponentName: string, stats: NBAPlayerStat[]): string {
  if (!stats.length) return `No H2H data for ${playerName} vs ${opponentName} this season`;
  const lines = stats.map((s) => {
    const isHome = s.game.home_team.id === s.team.id;
    const ha = isHome ? 'H' : 'A';
    const gameResult = (isHome ? s.game.home_team_score > s.game.visitor_team_score : s.game.visitor_team_score > s.game.home_team_score) ? 'W' : 'L';
    const date = new Date(s.game.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const mins = parseFloat(s.min) || 0;
    return `  ${date} (${gameResult},${ha}): ${s.pts}pts ${s.reb}reb ${s.ast}ast ${s.fg3m}threes | ${mins.toFixed(0)}min`;
  });
  const avg = {
    pts: (stats.reduce((a, s) => a + (s.pts || 0), 0) / stats.length).toFixed(1),
    reb: (stats.reduce((a, s) => a + (s.reb || 0), 0) / stats.length).toFixed(1),
    ast: (stats.reduce((a, s) => a + (s.ast || 0), 0) / stats.length).toFixed(1),
    fg3m: (stats.reduce((a, s) => a + (s.fg3m || 0), 0) / stats.length).toFixed(1),
  };
  return `${playerName} vs ${opponentName} (${stats.length} games this season):\n${lines.join('\n')}\n  Season avg vs this team: ${avg.pts}pts / ${avg.reb}reb / ${avg.ast}ast / ${avg.fg3m} threes`;
}

// Backwards-compat shim for old balldontlie imports
export async function bdlGet(path: string) {
  return bdlFetch(path);
}
export { getNBAPlayerRecentGames as getNBAPlayerStats };
