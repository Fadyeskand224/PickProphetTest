import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const STAT_LABELS: Record<string, string> = {
  passingYards: 'Pass Yards', passingTouchdowns: 'Pass TDs', interceptions: 'INTs',
  completions: 'Completions', attempts: 'Attempts', rushingYards: 'Rush Yards',
  rushingTouchdowns: 'Rush TDs', carries: 'Carries', receivingYards: 'Rec Yards',
  receivingTouchdowns: 'Rec TDs', receptions: 'Receptions', targets: 'Targets',
  tackles: 'Tackles', sacks: 'Sacks', passesDefended: 'PD',
};

function label(key: string) { return STAT_LABELS[key] || key; }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      playerName, league, propType, line, direction, odds,
      context: userContext, picks = [], gameData = [],
    } = body;

    if (!playerName || !line) {
      return NextResponse.json({ error: 'Missing playerName or line' }, { status: 400 });
    }

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

    const propTypeSettled = allPicks.filter((p: { prop_type: string; result: string }) => p.prop_type === propType && (p.result === 'win' || p.result === 'loss'));
    const propTypeRate = propTypeSettled.length > 0 ? Math.round(propTypeSettled.filter((p: { result: string }) => p.result === 'win').length / propTypeSettled.length * 100) : null;

    const winReasons = allSettled.filter((p: { result: string; reasoning?: string }) => p.result === 'win' && p.reasoning).map((p: { reasoning: string }) => p.reasoning).join(' | ');
    const lossReasons = allSettled.filter((p: { result: string; reasoning?: string }) => p.result === 'loss' && p.reasoning).map((p: { reasoning: string }) => p.reasoning).join(' | ');

    const playerPropHistory = playerPropPicks.slice(0, 12).map((p: {
      result: string; direction: string; line: number; opponent?: string;
      home_away?: string; date?: string; actual_stat?: number; reasoning?: string;
    }) =>
      `  [${p.result.toUpperCase()}] ${p.direction} ${p.line} vs ${p.opponent || '?'} (${p.home_away === 'H' ? 'Home' : 'Away'}) ${p.date}${p.actual_stat != null ? ` | Actual: ${p.actual_stat}` : ''}${p.reasoning ? ` | "${p.reasoning}"` : ''}`
    ).join('\n');

    let gamesStr = '';
    if (gameData.length) {
      const PROP_KEYS: Record<string, string[]> = {
        'Passing Yards': ['passingYards', 'passingTouchdowns', 'completions'],
        'Rushing Yards': ['rushingYards', 'rushingTouchdowns', 'carries'],
        'Receiving Yards': ['receivingYards', 'receptions', 'targets'],
        'Receptions': ['receptions', 'receivingYards', 'targets'],
        'Passing TDs': ['passingTouchdowns', 'passingYards', 'completions'],
        'Tackles': ['tackles', 'sacks'],
        'Sacks': ['sacks', 'tackles'],
      };
      const keys = PROP_KEYS[propType] || ['passingYards', 'rushingYards', 'receivingYards'];
      let overCount = 0;
      const gameLines = gameData.slice(0, 10).map((g: { date: string; opponent: string; result: string; ha: string; stats: Record<string, number | null> }) => {
        const primaryVal = g.stats[keys[0]];
        const hitLine = primaryVal != null ? (primaryVal >= line ? `✅ ${primaryVal}` : `❌ ${primaryVal}`) : '—';
        if (primaryVal != null && primaryVal >= line) overCount++;
        const statVals = keys.slice(0, 3).map((k) => g.stats[k] != null ? `${label(k)}: ${g.stats[k]}` : null).filter(Boolean).join(', ');
        return `    ${g.date} vs ${g.opponent} (${g.result}, ${g.ha}): ${statVals} | Line ${line}: ${hitLine}`;
      }).join('\n');
      gamesStr = `LAST ${Math.min(gameData.length, 10)} GAMES — ${propType} | HIT RATE: ${overCount}/${Math.min(gameData.length, 10)} hit Over ${line}:\n${gameLines}`;
    }

    const prompt = `You are Pick Prophet — an NFL prop betting model. Use all available data to make a sharp prediction.

═══════════════════════════════════════
RECENT GAME LOG
═══════════════════════════════════════
${gamesStr || 'No recent game data.'}

═══════════════════════════════════════
BETTOR'S TRAINING DATA
═══════════════════════════════════════
PLAYER: ${playerName} | PROP: ${propType} ${direction || 'Over'} ${line}${odds ? ` @ ${odds}` : ''}${league ? ` | ${league}` : ''}

Pick history for this player + ${propType}:
${playerPropPicks.length > 0 ? playerPropHistory : '  No history for this player/prop.'}

Win rates:
- ${playerName} on ${propType}: ${playerPropRate !== null ? playerPropRate + '%' : 'No data'} (${playerPropSettled.length} settled)
  - Home: ${homeRate !== null ? homeRate + '%' : 'N/A'} | Away: ${awayRate !== null ? awayRate + '%' : 'N/A'}
- All ${propType} picks: ${propTypeRate !== null ? propTypeRate + '%' : 'No data'}

What worked: ${winReasons ? `"${winReasons.slice(0, 400)}"` : 'None logged.'}
What failed: ${lossReasons ? `"${lossReasons.slice(0, 200)}"` : 'None.'}

Bettor's context: ${userContext || 'none'}

Respond ONLY in valid JSON:
{
  "recommendation": "Over" or "Under",
  "confidence": 1-100,
  "reasoning": "4-6 sentences citing specific stats and matchup factors.",
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

    const text = message.content.map((c) => c.type === 'text' ? c.text : '').join('');
    const pred = JSON.parse(text.replace(/```json|```/g, '').trim());
    return NextResponse.json({ prediction: pred });
  } catch (err) {
    console.error('NFL predict error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
