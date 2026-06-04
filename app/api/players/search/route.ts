import { NextRequest, NextResponse } from 'next/server';
import { ssGet } from '@/lib/sofascore';
import { searchNBAPlayers } from '@/lib/balldontlie';
import { searchNFLPlayers } from '@/lib/nfl';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';
  const sport = searchParams.get('sport') || 'Soccer';

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    if (sport === 'NBA') {
      const results = await searchNBAPlayers(q);
      return NextResponse.json({ results });
    }

    if (sport === 'NFL') {
      const results = await searchNFLPlayers(q);
      return NextResponse.json({ results });
    }

    // Default: Soccer via SofaScore
    const data = await ssGet(`/search/all?q=${encodeURIComponent(q)}`);
    const results = (data.results || [])
      .filter((r: { type: string }) => r.type === 'player')
      .slice(0, 8)
      .map((r: { entity: { id: number; name: string; team?: { name: string }; position?: string } }) => ({
        id: r.entity.id,
        name: r.entity.name,
        team: r.entity.team?.name || '',
        position: r.entity.position || '',
        sport: 'Soccer',
      }));

    return NextResponse.json({ results });
  } catch (err) {
    console.error('Player search error:', err);
    return NextResponse.json({ results: [] });
  }
}
