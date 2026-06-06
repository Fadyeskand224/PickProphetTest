import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import {
  getNBATodayGames, getNBATeamRecentForm, getNBAPlayerVsOpponent,
  getNBASeasonAverages, formatTeamForm, formatH2HStats,
} from '@/lib/nba';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const STAT_LABELS: Record<string, string> = {
  pts: 'Points', reb: 'Rebounds', ast: 'Assists', stl: 'Steals', blk: 'Blocks',
  fg3m: '3-Pointers Made', fgm: 'FGM', fga: 'FGA', turnover: 'Turnovers',
  dreb: 'Def Rebounds', oreb: 'Off Rebounds', min: 'Minutes',
};

function label(key: string) { return STAT_LABELS[key] || key; }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      playerName, playerId, playerTeamId, propType, line, direction, odds,
      context: userContext, picks = [], gameData = [],
    } = body;

    if (!playerName || !line) {
      return NextResponse.json({ error: 'Missing playerName or line' }, { status: 400 });
    }

    // ── 1. Fetch live matchup & context from BallDontLie ─────────────────────
    const [todayGames, seasonAvgs] = await Promise.all([
      getNBATodayGames(),
      playerId ? getNBASeasonAverages(Number(playerId)) : Promise.resolve(null),
    ]);

    // Find today's game for this player's team
    const todayGame = playerTeamId
      ? todayGames.find((g) => g.home_team.id === Number(playerTeamId) || g.visitor_team.id === Number(playerTeamId))
      : null;

    const isHome = todayGame ? todayGame.home_team.id === Number(playerTeamId) : null;
    const opponentTeam = todayGame ? (isHome ? todayGame.visitor_team : todayGame.home_team) : null;
    const playerTeamObj = todayGame ? (isHome ? todayGame.home_team : todayGame.visitor_team) : null;

    // Fetch team form & H2H in parallel (only if we found today's game)
    const [playerTeamForm, opponentForm, h2hStats] = await Promise.all([
      playerTeamObj ? getNBATeamRecentForm(playerTeamObj.id, 5) : Promise.resolve([]),
      opponentTeam ? getNBATeamRecentForm(opponentTeam.id, 5) : Promise.resolve([]),
      (playerId && opponentTeam) ? getNBAPlayerVsOpponent(Number(playerId), opponentTeam.id) : Promise.resolve([]),
    ]);

    // ── 2. Build matchup context string ──────────────────────────────────────
    let matchupStr = '';
    if (todayGame) {
      const gameTime = todayGame.time || 'TBD';
      const isPlayoff = todayGame.postseason;
      matchupStr = `TODAY'S GAME:
  ${playerTeamObj?.full_name} ${isHome ? '(HOME)' : '(AWAY)'} vs ${opponentTeam?.full_name} | ${isPlayoff ? '🏆 PLAYOFFS' : 'Regular Season'} | ${gameTime}

RECENT TEAM FORM (last 5):
  ${formatTeamForm(playerTeamObj?.full_name || 'Player Team', playerTeamForm, playerTeamObj?.id || 0)}
  ${formatTeamForm(opponentTeam?.full_name || 'Opponent', opponentForm, opponentTeam?.id || 0)}

HEAD-TO-HEAD — ${playerName} vs ${opponentTeam?.full_name}:
  ${formatH2HStats(playerName, opponentTeam?.full_name || 'Opponent', h2hStats)}

STRATEGIC CONTEXT:
  - Playoff games often feature tighter defense, reduced pace, more strategic rotations
  - Teams trailing in a series may play starters heavy minutes to stay alive
  - Teams with a series lead may rest stars or shorten rotations for home games
  - Back-to-back situations reduce player output by ~8-12% on average
  - Home court advantage typically adds ~3 pts to team scoring
`;
    } else {
      matchupStr = `TODAY'S GAME: No scheduled game found for today. Analysis based on recent form and season trends.\n`;
    }

    // ── 3. Build season averages string ──────────────────────────────────────
    let seasonStr = '';
    if (seasonAvgs) {
      seasonStr = `SEASON AVERAGES (${seasonAvgs.games_played} games played):
  ${seasonAvgs.pts} pts | ${seasonAvgs.reb} reb | ${seasonAvgs.ast} ast | ${seasonAvgs.stl} stl | ${seasonAvgs.blk} blk
  ${seasonAvgs.fg3m} threes/game | ${(seasonAvgs.fg_pct * 100).toFixed(1)}% FG | ${(seasonAvgs.ft_pct * 100).toFixed(1)}% FT`;
    }

    // ── 4. Build recent games context ─────────────────────────────────────────
    let gamesStr = '';
    if (gameData.length) {
      const PROP_KEYS: Record<string, string[]> = {
        'Points': ['pts', 'fg3m', 'fgm'],
        'Rebounds': ['reb', 'dreb', 'oreb'],
        'Assists': ['ast', 'turnover'],
        '3-Pointers Made': ['fg3m', 'pts', 'fgm'],
        'Steals': ['stl', 'blk'],
        'Blocks': ['blk', 'stl'],
        'Turnovers': ['turnover', 'pts', 'ast'],
        'Points+Rebounds+Assists': ['pts', 'reb', 'ast'],
        'Points+Rebounds': ['pts', 'reb'],
        'Points+Assists': ['pts', 'ast'],
        'Rebounds+Assists': ['reb', 'ast'],
      };
      const keys = PROP_KEYS[propType] || ['pts', 'reb', 'ast'];
      let overCount = 0;
      const gameLines = (gameData as Array<{ date: string; opponent: string; result: string; ha: string; postseason?: boolean; stats: Record<string, number | null> }>)
        .slice(0, 15)
        .map((g) => {
          const primaryKey = keys[0];
          let primaryVal: number | null = null;
          if (propType.includes('+')) {
            primaryVal = keys.reduce((sum, k) => sum + (g.stats[k] ?? 0), 0);
          } else {
            primaryVal = g.stats[primaryKey] ?? null;
          }
          const hitLine = primaryVal != null
            ? (primaryVal >= line ? `✅ ${primaryVal}` : `❌ ${primaryVal}`)
            : '—';
          if (primaryVal != null && primaryVal >= line) overCount++;
          const statVals = keys.slice(0, 3).map((k) => g.stats[k] != null ? `${label(k)}: ${g.stats[k]}` : null).filter(Boolean).join(', ');
          const playoff = g.postseason ? ' [PLAYOFFS]' : '';
          return `    ${g.date} vs ${g.opponent} (${g.result}, ${g.ha})${playoff}: ${statVals} | Line ${line}: ${hitLine}`;
        })
        .join('\n');
      const hitRate = `${overCount}/${Math.min(gameData.length, 15)} games hit Over ${line}`;
      gamesStr = `LAST ${Math.min(gameData.length, 15)} GAMES — ${propType} | HIT RATE vs line ${line}: ${hitRate}:\n${gameLines}`;
    }

    // ── 5. Build training data analysis ──────────────────────────────────────
    const allPicks = picks.slice(0, 100);
    const allSettled = allPicks.filter((p: { result: string }) => p.result === 'win' || p.result === 'loss');

    const playerPropPicks = allPicks.filter((p: { player: string; prop_type: string }) =>
      p.player?.toLowerCase() === playerName.toLowerCase() && p.prop_type === propType
    );
    const playerPropSettled = playerPropPicks.filter((p: { result: string }) => p.result === 'win' || p.result === 'loss');
    const playerPropWins = playerPropSettled.filter((p: { result: string }) => p.result === 'win').length;
    const playerPropRate = playerPropSettled.length > 0 ? Math.round(playerPropWins / playerPropSettled.length * 100) : null;

    const homeSettled = playerPropSettled.filter((p: { home_away: string }) => p.home_away === 'H');
    const awaySettled = playerPropSettled.filter((p: { home_away: string }) => p.home_away === 'A');
    const homeRate = homeSettled.length > 0 ? Math.round(homeSettled.filter((p: { result: string }) => p.result === 'win').length / homeSettled.length * 100) : null;
    const awayRate = awaySettled.length > 0 ? Math.round(awaySettled.filter((p: { result: string }) => p.result === 'win').length / awaySettled.length * 100) : null;

    const propTypePicks = allPicks.filter((p: { prop_type: string }) => p.prop_type === propType);
    const propTypeSettled = propTypePicks.filter((p: { result: string }) => p.result === 'win' || p.result === 'loss');
    const propTypeRate = propTypeSettled.length > 0
      ? Math.round(propTypeSettled.filter((p: { result: string }) => p.result === 'win').length / propTypeSettled.length * 100) : null;

    const winReasons = allSettled.filter((p: { result: string; reasoning?: string }) => p.result === 'win' && p.reasoning).map((p: { reasoning: string }) => p.reasoning).slice(0, 5).join(' | ');
    const lossReasons = allSettled.filter((p: { result: string; reasoning?: string }) => p.result === 'loss' && p.reasoning).map((p: { reasoning: string }) => p.reasoning).slice(0, 3).join(' | ');

    const playerPropHistory = playerPropPicks.slice(0, 10).map((p: {
      result: string; direction: string; line: number; opponent?: string;
      home_away?: string; date?: string; actual_stat?: number; reasoning?: string;
    }) =>
      `  [${p.result.toUpperCase()}] ${p.direction} ${p.line} vs ${p.opponent || '?'} (${p.home_away === 'H' ? 'Home' : 'Away'}) ${p.date}${p.actual_stat != null ? ` | Actual: ${p.actual_stat}` : ''}${p.reasoning ? ` | "${p.reasoning}"` : ''}`
    ).join('\n');

    // ── 6. Build prompt ───────────────────────────────────────────────────────
    const prompt = `You are Pick Prophet — an NBA prop betting model. You have access to LIVE matchup data, real team stats, and this bettor's personal pick history. Analyze everything before making your call.

═══════════════════════════════════════
LIVE MATCHUP CONTEXT (fetched right now)
═══════════════════════════════════════
${matchupStr}
${seasonStr ? `\n${seasonStr}\n` : ''}
═══════════════════════════════════════
RECENT GAME LOG (last 15 games)
═══════════════════════════════════════
${gamesStr || 'No recent game data.'}

═══════════════════════════════════════
BETTOR'S TRAINING DATA
═══════════════════════════════════════
PLAYER: ${playerName} | PROP: ${propType} ${direction || 'Over'} ${line}${odds ? ` @ ${odds}` : ''}

Pick history for this player + ${propType}:
${playerPropPicks.length > 0 ? playerPropHistory : '  No history yet for this player/prop.'}

Win rates:
- ${playerName} on ${propType}: ${playerPropRate !== null ? playerPropRate + '%' : 'No data'} (${playerPropSettled.length} settled)
  - Home: ${homeRate !== null ? homeRate + '%' : 'N/A'} | Away: ${awayRate !== null ? awayRate + '%' : 'N/A'}
- All NBA ${propType} picks: ${propTypeRate !== null ? propTypeRate + '%' : 'No data'} (${propTypeSettled.length} picks)

What worked: ${winReasons ? `"${winReasons.slice(0, 400)}"` : 'No logged reasoning.'}
What failed: ${lossReasons ? `"${lossReasons.slice(0, 200)}"` : 'None.'}

Extra context from bettor: ${userContext || 'none'}

═══════════════════════════════════════
YOUR ANALYSIS
═══════════════════════════════════════
Using all the above — the live matchup, opponent defensive context, team form, H2H history, recent game log, and bettor's track record — give your sharpest prediction.

Pay special attention to:
1. How does this player historically perform vs TODAY's specific opponent?
2. Is there a playoff/series momentum angle (rest days, must-win, series lead)?
3. Does the team's recent form suggest pace/scoring environment for/against?
4. What's the minute trend — has the player been playing more or less recently?

Respond ONLY in valid JSON:
{
  "recommendation": "Over" or "Under",
  "confidence": 1-100,
  "reasoning": "4-6 sentences citing specific matchup data, H2H stats, and team trends.",
  "pattern_match": "High" or "Medium" or "Low",
  "key_factors": ["factor citing specific data", "factor 2", "factor 3"],
  "risks": ["specific risk 1", "risk 2"],
  "value_rating": "High Value" or "Standard" or "Fade",
  "data_confidence": "Strong" or "Moderate" or "Limited",
  "matchup_found": ${todayGame ? 'true' : 'false'}
}`;

    const message = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content.map((c) => c.type === 'text' ? c.text : '').join('');
    const pred = JSON.parse(text.replace(/```json|```/g, '').trim());

    return NextResponse.json({
      prediction: pred,
      matchupContext: todayGame ? {
        opponent: opponentTeam?.full_name,
        isHome,
        isPlayoff: todayGame.postseason,
      } : null,
    });
  } catch (err) {
    console.error('NBA predict error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
