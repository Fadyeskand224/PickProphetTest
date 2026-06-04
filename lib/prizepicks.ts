import { PPProp, Sport } from '@/types';

// PrizePicks league IDs by sport
const SPORT_LEAGUES: Record<Sport, number[]> = {
  Soccer: [82, 242, 243],
  NBA: [3],
  NFL: [2],
};

const SPORT_HALVES: Record<string, string> = {
  '82': 'Full Game', '242': '1st Half', '243': '2nd Half',
  '3': 'Full Game', '2': 'Full Game',
};

export async function fetchPrizePicks(sport: Sport): Promise<PPProp[]> {
  const leagueIds = SPORT_LEAGUES[sport] || [];
  const allProps: PPProp[] = [];

  for (const leagueId of leagueIds) {
    try {
      const res = await fetch(
        `https://api.prizepicks.com/projections?league_id=${leagueId}&per_page=250`,
        { next: { revalidate: 120 } }
      );
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
          half: SPORT_HALVES[String(leagueId)] || 'Full Game',
          sport,
        });
      }
    } catch {
      // Silently skip failed league fetches
    }
  }

  return allProps;
}
