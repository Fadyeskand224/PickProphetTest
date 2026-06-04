// NFL player data via ESPN unofficial API (free, no key needed)
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';

export async function searchNFLPlayers(q: string) {
  try {
    const res = await fetch(
      `https://site.web.api.espn.com/apis/common/v3/search?query=${encodeURIComponent(q)}&limit=8&type=player&sport=football&league=nfl`,
      { next: { revalidate: 60 } }
    );
    const data = await res.json();
    const hits = data.items?.[0]?.results || [];
    return hits.map((h: { id: string; displayName: string; team?: { displayName: string }; position?: { displayName: string } }) => ({
      id: h.id,
      name: h.displayName,
      team: h.team?.displayName || '',
      position: h.position?.displayName || '',
      sport: 'NFL' as const,
    }));
  } catch {
    return [];
  }
}

export async function getNFLPlayerGameLog(playerId: string) {
  try {
    const res = await fetch(
      `${ESPN}/athletes/${playerId}/gamelog?season=2024`,
      { next: { revalidate: 60 } }
    );
    const data = await res.json();
    return data;
  } catch {
    return null;
  }
}
