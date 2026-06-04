import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function statLabel(key: string): string {
  const map: Record<string, string> = {
    onTargetScoringAttempt: 'Shots on Target', totalShots: 'Total Shots', goals: 'Goals',
    goalAssist: 'Assists', keyPass: 'Key Passes', totalPass: 'Passes Attempted',
    accuratePass: 'Passes Completed', totalTackle: 'Tackles', wonTackle: 'Tackles Won',
    interceptionWon: 'Interceptions', ballRecovery: 'Ball Recoveries',
    wonContest: 'Dribbles Won', duelWon: 'Duels Won', aerialWon: 'Aerial Won',
    fouls: 'Fouls', yellowCard: 'Yellow Cards', wasFouled: 'Fouls Drawn',
    minutesPlayed: 'Minutes', touches: 'Touches', expectedGoals: 'xG', expectedAssists: 'xA',
    // NBA
    pts: 'Points', reb: 'Rebounds', ast: 'Assists', stl: 'Steals', blk: 'Blocks',
    fg3m: '3-Pointers', turnover: 'Turnovers',
    // NFL
    passingYards: 'Pass Yards', passingTouchdowns: 'Pass TDs',
    rushingYards: 'Rush Yards', receivingYards: 'Rec Yards', receptions: 'Receptions',
  };
  return map[key] || key;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      playerName, sport, league, propType, line, direction, odds,
      context: userContext, picks = [], gameData = [], seasonContext,
    } = body;

    if (!playerName || !line) {
      return NextResponse.json({ error: 'Missing playerName or line' }, { status: 400 });
    }

    // Build training data analysis
    const allPicks = picks.slice(0, 100);
    const allSettled = allPicks.filter((p: { result: string }) => p.result === 'win' || p.result === 'loss');

    const playerPropPicks = allPicks.filter((p: { player: string; prop_type: string }) =>
      p.player?.toLowerCase() === playerName.toLowerCase() && p.prop_type === propType
    );
    const playerPropSettled = playerPropPicks.filter((p: { result: string }) => p.result === 'win' || p.result === 'loss');
    const playerPropWins = playerPropSettled.filter((p: { result: string }) => p.result === 'win').length;
    const playerPropRate = playerPropSettled.length > 0
      ? Math.round(playerPropWins / playerPropSettled.length * 100)
      : null;

    const homeSettled = playerPropSettled.filter((p: { home_away: string }) => p.home_away === 'H');
    const awaySettled = playerPropSettled.filter((p: { home_away: string }) => p.home_away === 'A');
    const homeRate = homeSettled.length > 0 ? Math.round(homeSettled.filter((p: { result: string }) => p.result === 'win').length / homeSettled.length * 100) : null;
    const awayRate = awaySettled.length > 0 ? Math.round(awaySettled.filter((p: { result: string }) => p.result === 'win').length / awaySettled.length * 100) : null;

    const lineBuckets: Record<string, { w: number; l: number }> = {};
    playerPropSettled.forEach((p: { line: number; result: string }) => {
      const bucket = String(p.line);
      if (!lineBuckets[bucket]) lineBuckets[bucket] = { w: 0, l: 0 };
      p.result === 'win' ? lineBuckets[bucket].w++ : lineBuckets[bucket].l++;
    });
    const lineAnalysis = Object.entries(lineBuckets)
      .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
      .map(([l, { w, l: ls }]) => `    Line ${l}: ${w}W ${ls}L (${Math.round(w / (w + ls) * 100)}%)`)
      .join('\n');

    const propTypePicks = allPicks.filter((p: { prop_type: string }) => p.prop_type === propType);
    const propTypeSettled = propTypePicks.filter((p: { result: string }) => p.result === 'win' || p.result === 'loss');
    const propTypeRate = propTypeSettled.length > 0
      ? Math.round(propTypeSettled.filter((p: { result: string }) => p.result === 'win').length / propTypeSettled.length * 100)
      : null;

    const winningReasons = allSettled.filter((p: { result: string; reasoning?: string }) => p.result === 'win' && p.reasoning).map((p: { reasoning: string }) => p.reasoning).join(' | ');
    const losingReasons = allSettled.filter((p: { result: string; reasoning?: string }) => p.result === 'loss' && p.reasoning).map((p: { reasoning: string }) => p.reasoning).join(' | ');

    const playerPropHistory = playerPropPicks.slice(0, 15).map((p: {
      result: string; direction: string; line: number; opponent?: string;
      home_away?: string; date?: string; actual_stat?: number; reasoning?: string;
    }) =>
      `  [${p.result.toUpperCase()}] ${p.direction} ${p.line} | vs ${p.opponent || '?'} | ${p.home_away === 'H' ? 'Home' : 'Away'} | ${p.date}${p.actual_stat != null ? ` | Actual: ${p.actual_stat}` : ''}${p.reasoning ? `\n       Reason: "${p.reasoning}"` : ''}`
    ).join('\n');

    // Build recent games context
    let gamesContext = '';
    if (gameData.length) {
      const PROP_KEYS: Record<string, string[]> = {
        'Shots on Target': ['onTargetScoringAttempt', 'totalShots'],
        'Total Shots': ['totalShots', 'onTargetScoringAttempt'],
        'Goals Scored': ['goals', 'totalShots', 'expectedGoals'],
        'Assists': ['goalAssist', 'keyPass'],
        'Points': ['pts', 'fg3m', 'fgm'],
        'Rebounds': ['reb', 'dreb', 'oreb'],
        'Passing Yards': ['passingYards', 'passingTouchdowns', 'completions'],
      };
      const keys = PROP_KEYS[propType] || Object.keys(gameData[0]?.stats || {}).slice(0, 3);
      let overCount = 0;
      const gameLines = gameData.slice(0, 8).map((g: {
        date: string; opponent: string; result: string; ha: string; stats: Record<string, number | null>;
      }) => {
        const primaryVal = g.stats[keys[0]];
        const hitLine = line && primaryVal != null
          ? (primaryVal >= line ? `✅ Over (${primaryVal})` : `❌ Under (${primaryVal})`)
          : (primaryVal != null ? String(primaryVal) : '—');
        if (line && primaryVal != null && primaryVal >= line) overCount++;
        const statVals = keys.slice(0, 3).map(k => g.stats[k] != null ? `${statLabel(k)}: ${g.stats[k]}` : null).filter(Boolean).join(', ');
        return `    ${g.date} vs ${g.opponent} (${g.result}, ${g.ha}): ${statVals} | Line ${line}: ${hitLine}`;
      }).join('\n');
      const hitRate = `${overCount}/${gameData.slice(0, 8).length} games hit Over ${line}`;
      gamesContext = `LAST ${Math.min(gameData.length, 8)} GAMES — ${propType} | HIT RATE vs line ${line}: ${hitRate}:\n${gameLines}`;
    }

    // Build season context string
    let seasonStr = '';
    if (seasonContext?.context && typeof seasonContext.context === 'object') {
      const ctx = seasonContext.context;
      const os = ctx.overall || {};
      const hs = ctx.home || {};
      const as_ = ctx.away || {};
      const oApps = ctx.appearances?.total || 1;
      const hApps = ctx.appearances?.home || 1;
      const aApps = ctx.appearances?.away || 1;
      const keys = ['totalShots', 'onTargetScoringAttempt', 'goals', 'goalAssist', 'pts', 'reb', 'ast', 'passingYards'];
      const rows = keys.filter(k => os[k] != null || hs[k] != null).slice(0, 6).map(k => {
        const ov = os[k] != null ? (os[k] / oApps).toFixed(2) : '—';
        const hv = hs[k] != null ? (hs[k] / hApps).toFixed(2) : '—';
        const av = as_[k] != null ? (as_[k] / aApps).toFixed(2) : '—';
        return `    ${statLabel(k)}: Overall ${ov}/game | Home ${hv}/game | Away ${av}/game`;
      }).join('\n');
      if (rows) {
        seasonStr = `SEASON STATS (${ctx.season || ''}, ${ctx.tournament || ''}):\n  Appearances: ${oApps} total\n  Per game:\n${rows}`;
      }
    }

    const prompt = `You are Pick Prophet AI — a sports betting model trained on this bettor's real pick history. Extract SPECIFIC PATTERNS from the training data, then apply that logic to the new prop.

═══════════════════════════════════════════
STEP 1: TRAINING DATA
═══════════════════════════════════════════

PLAYER: ${playerName} | SPORT: ${sport} | PROP: ${propType} | LINE: ${line}

Historical results for this exact player + prop type:
${playerPropPicks.length > 0 ? playerPropHistory : '  No history yet for this player/prop combo.'}

HIT RATES:
- This player (${propType}): ${playerPropRate !== null ? playerPropRate + '%' : 'No data'} (${playerPropSettled.length} settled)
  - At HOME: ${homeRate !== null ? homeRate + '%' : 'No data'} (${homeSettled.length} games)
  - AWAY: ${awayRate !== null ? awayRate + '%' : 'No data'} (${awaySettled.length} games)
${lineAnalysis ? `- By line:\n${lineAnalysis}` : ''}
- All players on ${propType}: ${propTypeRate !== null ? propTypeRate + '%' : 'No data'} (${propTypeSettled.length} picks)

WINNING PICK PATTERNS: ${winningReasons ? `"${winningReasons.slice(0, 600)}"` : 'No reasoning logged yet.'}
LOSING PICK PATTERNS: ${losingReasons ? `"${losingReasons.slice(0, 300)}"` : 'None logged.'}

═══════════════════════════════════════════
STEP 2: RECENT STATS
═══════════════════════════════════════════
${seasonStr || 'No season data.'}

${gamesContext || 'No recent game data.'}

═══════════════════════════════════════════
STEP 3: THE PROP TO EVALUATE
═══════════════════════════════════════════
- Player: ${playerName}
- Sport: ${sport} | League: ${league || 'N/A'}
- Prop: ${propType} ${direction || 'Over'} ${line}
- Odds: ${odds || 'not provided'}
- Context: ${userContext || 'none'}

Respond in JSON only:
{
  "recommendation": "Over" or "Under" or "Yes" or "No",
  "confidence": 1-100,
  "reasoning": "4-6 sentences referencing actual patterns and stats.",
  "pattern_match": "High" or "Medium" or "Low",
  "key_factors": ["factor 1", "factor 2", "factor 3"],
  "risks": ["risk 1", "risk 2"],
  "value_rating": "High Value" or "Standard" or "Fade",
  "data_confidence": "Strong" or "Moderate" or "Limited"
}`;

    const message = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content.map(c => c.type === 'text' ? c.text : '').join('');
    const pred = JSON.parse(text.replace(/```json|```/g, '').trim());

    return NextResponse.json({ prediction: pred });
  } catch (err) {
    console.error('Predict error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
