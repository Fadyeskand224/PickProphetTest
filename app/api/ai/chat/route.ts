import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages = [], picks = [] } = body;

    if (!messages.length) {
      return NextResponse.json({ error: 'No messages' }, { status: 400 });
    }

    // Build system prompt from picks data
    const total = picks.length;
    const settled = picks.filter((p: { result: string }) => p.result === 'win' || p.result === 'loss');
    const wins = settled.filter((p: { result: string }) => p.result === 'win').length;
    const winRate = settled.length ? Math.round(wins / settled.length * 100) : null;

    const propMap: Record<string, { w: number; l: number }> = {};
    settled.forEach((p: { prop_type: string; result: string }) => {
      if (!propMap[p.prop_type]) propMap[p.prop_type] = { w: 0, l: 0 };
      p.result === 'win' ? propMap[p.prop_type].w++ : propMap[p.prop_type].l++;
    });
    const propBreakdown = Object.entries(propMap)
      .sort((a, b) => (b[1].w / (b[1].w + b[1].l)) - (a[1].w / (a[1].w + a[1].l)))
      .map(([prop, { w, l }]) => `  • ${prop}: ${w}W ${l}L (${Math.round(w / (w + l) * 100)}%)`)
      .join('\n');

    const playerMap: Record<string, { w: number; l: number }> = {};
    settled.forEach((p: { player: string; result: string }) => {
      if (!playerMap[p.player]) playerMap[p.player] = { w: 0, l: 0 };
      p.result === 'win' ? playerMap[p.player].w++ : playerMap[p.player].l++;
    });
    const playerBreakdown = Object.entries(playerMap)
      .filter(([, v]) => v.w + v.l >= 2)
      .sort((a, b) => (b[1].w / (b[1].w + b[1].l)) - (a[1].w / (a[1].w + a[1].l)))
      .slice(0, 8)
      .map(([player, { w, l }]) => `  • ${player}: ${w}W ${l}L (${Math.round(w / (w + l) * 100)}%)`)
      .join('\n');

    const recentPicks = picks.slice(0, 15).map((p: {
      player: string; direction: string; line: number; prop_type: string;
      opponent?: string; home_away?: string; result: string; actual_stat?: number; reasoning?: string;
    }) =>
      `  • ${p.player} | ${p.direction} ${p.line} ${p.prop_type}${p.opponent ? ' vs ' + p.opponent : ''}${p.home_away ? ' (' + p.home_away + ')' : ''} | ${p.result.toUpperCase()}${p.actual_stat != null ? ' | Actual: ' + p.actual_stat : ''}${p.reasoning ? ' | ' + p.reasoning.slice(0, 80) : ''}`
    ).join('\n');

    const systemPrompt = `You are Pick Prophet AI — a sharp sports betting analyst and advisor. You have access to this bettor's full pick history and performance data. Use it to give specific, data-driven advice.

BETTOR STATS:
- Total picks logged: ${total}
- Overall win rate: ${winRate !== null ? winRate + '%' : 'N/A'} (${settled.length} settled)

PERFORMANCE BY PROP TYPE:
${propBreakdown || '  No settled picks yet'}

PERFORMANCE BY PLAYER:
${playerBreakdown || '  Not enough data yet'}

RECENT PICK HISTORY:
${recentPicks || '  No picks logged yet'}

Your role:
- Give honest, sharp betting advice based on the data
- Reference specific win rates and patterns when relevant
- Flag value bets and fades based on their track record
- Be concise but insightful — no fluff
- You can also give general prop betting strategy advice`;

    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    const reply = response.content.map(c => c.type === 'text' ? c.text : '').join('');
    return NextResponse.json({ reply });
  } catch (err) {
    console.error('Chat error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
