import { PPProp, Sport } from '@/types';

// PrizePicks league IDs — verified active as of June 2026
// Soccer: 82=EPL Full, 241=World Cup, 242=EPL 1st Half, 243=EPL 2nd Half
const SPORT_LEAGUES: Record<Sport, number[]> = {
  Soccer: [241, 82, 242, 243],
  NBA: [7, 3],
  NFL: [9, 2],
};

const LEAGUE_LABELS: Record<string, string> = {
  '82': 'EPL', '241': 'World Cup', '242': 'EPL 1H', '243': 'EPL 2H',
  '3': 'NBA', '7': 'NBA', '2': 'NFL', '9': 'NFL',
};

export async function fetchPrizePicks(sport: Sport): Promise<PPProp[]> {
  const leagueIds = SPORT_LEAGUES[sport] || [];
  const allProps: PPProp[] = [];

  await Promise.all(leagueIds.map(async (leagueId) => {
    try {
      const res = await fetch(
        `https://api.prizepicks.com/projections?league_id=${leagueId}&per_page=250`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Referer': 'https://app.prizepicks.com/',
          },
          next: { revalidate: 120 },
        }
      );
      if (!res.ok) return;
      const data = await res.json();

      const players: Record<string, string> = {};
      for (const item of data.included || []) {
        if (item.type === 'new_player') {
          players[item.id] = item.attributes?.display_name || 'Unknown';
        }
      }

      for (const proj of data.data || []) {
        const attrs = proj.attributes || {};
        const pid = proj.relationships?.new_player?.data?.id || '';
        allProps.push({
          player: players[pid] || 'Unknown',
          stat: attrs.stat_type || '',
          line: attrs.line_score ?? 0,
          desc: attrs.description || '',
          half: LEAGUE_LABELS[String(leagueId)] || 'Full Game',
          sport,
        });
      }
    } catch {
      // skip failed leagues
    }
  }));

  return allProps;
}
