// BallDontLie API for NBA player data (free tier)
const BDL = 'https://api.balldontlie.io/v1';

const headers = () => ({
  'Authorization': process.env.BALLDONTLIE_API_KEY || '',
});

export async function bdlGet(path: string) {
  const res = await fetch(`${BDL}${path}`, {
    headers: headers(),
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`BallDontLie ${path} → ${res.status}`);
  return res.json();
}

export async function searchNBAPlayers(q: string) {
  try {
    const data = await bdlGet(`/players?search=${encodeURIComponent(q)}&per_page=8`);
    return (data.data || []).map((p: { id: number; first_name: string; last_name: string; team?: { full_name: string }; position: string }) => ({
      id: p.id,
      name: `${p.first_name} ${p.last_name}`,
      team: p.team?.full_name || '',
      position: p.position || '',
      sport: 'NBA' as const,
    }));
  } catch {
    return [];
  }
}

export async function getNBAPlayerStats(playerId: number) {
  try {
    // Get last 8 games for the player
    const data = await bdlGet(`/stats?player_ids[]=${playerId}&per_page=8&sort=-date`);
    return data.data || [];
  } catch {
    return [];
  }
}
