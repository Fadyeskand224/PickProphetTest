import { NextRequest, NextResponse } from 'next/server';
import { ssGet, fmtDate } from '@/lib/sofascore';
import { getNBAPlayerRecentGames } from '@/lib/nba';
import { getNFLPlayerGameLog } from '@/lib/nfl';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const playerId = searchParams.get('playerId');
  const sport = searchParams.get('sport') || 'Soccer';
  const teamId = searchParams.get('teamId');

  if (!playerId) {
    return NextResponse.json({ events: [] }, { status: 400 });
  }

  try {
    if (sport === 'NBA') {
      const stats = await getNBAPlayerRecentGames(Number(playerId), 15);
      const events = stats.map((s) => {
        const isHome = s.game.home_team.id === s.team.id;
        const myScore = isHome ? s.game.home_team_score : s.game.visitor_team_score;
        const oppScore = isHome ? s.game.visitor_team_score : s.game.home_team_score;
        const result = myScore > oppScore ? 'W' : myScore < oppScore ? 'L' : 'D';
        const opponent = isHome ? s.game.visitor_team.full_name : s.game.home_team.full_name;
        return {
          date: new Date(s.game.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          opponent,
          result,
          score: `${myScore}–${oppScore}`,
          ha: isHome ? 'H' : 'A',
          postseason: s.game.postseason,
          stats: {
            pts: s.pts, reb: s.reb, ast: s.ast, stl: s.stl, blk: s.blk,
            fg3m: s.fg3m, fgm: s.fgm, fga: s.fga, fg_pct: s.fg_pct,
            dreb: s.dreb, oreb: s.oreb, turnover: s.turnover, ft_pct: s.ft_pct,
            min: parseFloat(s.min) || 0,
          },
        };
      });
      return NextResponse.json({ events });
    }

    if (sport === 'NFL') {
      const data = await getNFLPlayerGameLog(playerId);
      if (!data) return NextResponse.json({ events: [] });
      // ESPN game log parsing — basic structure
      const events = (data.events?.items || []).slice(0, 8).map((ev: {
        stats: string[];
        gameDate: string;
        opponent?: { displayName: string };
        homeAway: string;
        result?: { winner: boolean };
      }) => ({
        date: new Date(ev.gameDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        opponent: ev.opponent?.displayName || 'Unknown',
        result: ev.result?.winner ? 'W' : 'L',
        score: '—',
        ha: ev.homeAway === 'home' ? 'H' : 'A',
        stats: Object.fromEntries(
          (data.labels || []).map((l: string, i: number) => [l, parseFloat(ev.stats?.[i]) || 0])
        ),
      }));
      return NextResponse.json({ events });
    }

    // Soccer via SofaScore
    const eventsData = await ssGet(`/player/${playerId}/events/last/0`);
    const rawEvents = (eventsData.events || [])
      .filter((ev: { status?: { type: string } }) => ev.status?.type === 'finished')
      .sort((a: { startTimestamp: number }, b: { startTimestamp: number }) => b.startTimestamp - a.startTimestamp)
      .slice(0, 8);

    const statsPromises = rawEvents.map((ev: { id: number }) =>
      ssGet(`/event/${ev.id}/player/${playerId}/statistics`).catch(() => ({ statistics: {} }))
    );
    const statsResults = await Promise.all(statsPromises);

    const events = rawEvents.map((ev: {
      homeTeam?: { id: number; name: string };
      awayTeam?: { id: number; name: string };
      homeScore?: { current: number };
      awayScore?: { current: number };
      startTimestamp: number;
    }, idx: number) => {
      const stats = statsResults[idx]?.statistics || {};
      const playerTeamId = teamId ? parseInt(teamId) : null;
      const isHome = playerTeamId ? (ev.homeTeam?.id === playerTeamId) : true;
      const opponent = isHome ? ev.awayTeam?.name : ev.homeTeam?.name;
      const myScore = isHome ? (ev.homeScore?.current ?? 0) : (ev.awayScore?.current ?? 0);
      const oppScore = isHome ? (ev.awayScore?.current ?? 0) : (ev.homeScore?.current ?? 0);
      let result: 'W' | 'L' | 'D' = 'D';
      if (myScore > oppScore) result = 'W';
      else if (myScore < oppScore) result = 'L';

      return {
        date: fmtDate(ev.startTimestamp),
        opponent: opponent || 'Unknown',
        result,
        score: `${myScore}–${oppScore}`,
        ha: isHome ? 'H' : 'A',
        stats,
      };
    });

    return NextResponse.json({ events });
  } catch (err) {
    console.error('Events error:', err);
    return NextResponse.json({ events: [], error: String(err) });
  }
}
