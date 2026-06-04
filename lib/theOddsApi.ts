// The Odds API — aggregates DraftKings, FanDuel, BetMGM, Caesars, etc.
const ODDS_API = 'https://api.the-odds-api.com/v4';

const SPORT_KEYS: Record<string, string[]> = {
  Soccer: ['soccer_epl', 'soccer_la_liga', 'soccer_germany_bundesliga', 'soccer_italy_serie_a', 'soccer_usa_mls'],
  NBA: ['basketball_nba'],
  NFL: ['americanfootball_nfl'],
};

const BOOKMAKERS = 'draftkings,fanduel,betmgm,caesars,pointsbet';

export async function fetchOdds(sport: string) {
  const key = process.env.THE_ODDS_API_KEY;
  if (!key) return { games: [], error: 'THE_ODDS_API_KEY not configured' };

  const sportKeys = SPORT_KEYS[sport] || SPORT_KEYS['Soccer'];
  const allGames = [];

  for (const sk of sportKeys) {
    try {
      const res = await fetch(
        `${ODDS_API}/sports/${sk}/odds?apiKey=${key}&regions=us&markets=h2h,spreads,totals&bookmakers=${BOOKMAKERS}&oddsFormat=american`,
        { next: { revalidate: 300 } }
      );
      if (!res.ok) continue;
      const data = await res.json();
      allGames.push(...(Array.isArray(data) ? data : []));
    } catch {
      // skip
    }
  }

  return { games: allGames };
}

export async function fetchPlayerProps(sport: string, eventId: string) {
  const key = process.env.THE_ODDS_API_KEY;
  if (!key) return { props: [], error: 'THE_ODDS_API_KEY not configured' };

  const sportKey = SPORT_KEYS[sport]?.[0] || 'basketball_nba';
  try {
    const res = await fetch(
      `${ODDS_API}/sports/${sportKey}/events/${eventId}/odds?apiKey=${key}&regions=us&markets=player_points,player_rebounds,player_assists,player_threes&bookmakers=${BOOKMAKERS}&oddsFormat=american`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return { props: [] };
    const data = await res.json();
    return { props: data };
  } catch {
    return { props: [] };
  }
}
