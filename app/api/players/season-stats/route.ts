import { NextRequest, NextResponse } from 'next/server';
import { ssGet } from '@/lib/sofascore';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const playerId = searchParams.get('playerId');
  const propType = searchParams.get('propType') || '';
  const line = parseFloat(searchParams.get('line') || '0') || null;

  if (!playerId) {
    return NextResponse.json({ context: '' }, { status: 400 });
  }

  try {
    // Get seasons
    const seasData = await ssGet(`/player/${playerId}/statistics/seasons`);
    const typesMap = seasData.typesMap || {};
    const tournaments = seasData.uniqueTournamentSeasons || [];

    let bestTournId: string | null = null;
    let bestSeasonId: number | null = null;

    for (const t of tournaments) {
      const tid = String(t.uniqueTournament.id);
      const tSeasons = typesMap[tid] || {};
      for (const s of t.seasons) {
        const types = tSeasons[s.id] || [];
        if (types.includes('home') && types.includes('away')) {
          bestTournId = tid;
          bestSeasonId = s.id;
          break;
        }
      }
      if (bestTournId) break;
    }

    if (!bestTournId || !bestSeasonId) {
      return NextResponse.json({ context: 'No season data found.' });
    }

    // Fetch overall/home/away in parallel
    const [oRes, hRes, aRes] = await Promise.all([
      ssGet(`/player/${playerId}/unique-tournament/${bestTournId}/season/${bestSeasonId}/statistics/overall`),
      ssGet(`/player/${playerId}/unique-tournament/${bestTournId}/season/${bestSeasonId}/statistics/home`),
      ssGet(`/player/${playerId}/unique-tournament/${bestTournId}/season/${bestSeasonId}/statistics/away`),
    ]);

    const os = oRes.statistics || {};
    const hs = hRes.statistics || {};
    const as_ = aRes.statistics || {};
    const oApps = os.appearances || 1;
    const hApps = hs.appearances || 1;
    const aApps = as_.appearances || 1;

    const tournName = tournaments.find((t: { uniqueTournament: { id: number } }) => String(t.uniqueTournament.id) === bestTournId)?.uniqueTournament.name || '';
    const seasonName = tournaments.find((t: { uniqueTournament: { id: number }; seasons: { id: number; name: string }[] }) => String(t.uniqueTournament.id) === bestTournId)
      ?.seasons.find((s: { id: number }) => s.id === bestSeasonId)?.name || '';

    const context = {
      tournament: tournName,
      season: seasonName,
      appearances: { total: oApps, home: hApps, away: aApps },
      overall: os,
      home: hs,
      away: as_,
    };

    return NextResponse.json({ context, line, propType });
  } catch (err) {
    console.error('Season stats error:', err);
    return NextResponse.json({ context: '' });
  }
}
