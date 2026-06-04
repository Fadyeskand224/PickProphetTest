// SofaScore API proxy helpers — called server-side from API routes
const SS = 'https://api.sofascore.com/api/v1';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Accept': 'application/json',
  'Referer': 'https://www.sofascore.com/',
};

export async function ssGet(path: string) {
  const res = await fetch(`${SS}${path}`, { headers, next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`SofaScore ${path} → ${res.status}`);
  return res.json();
}

export function ssImageUrl(playerId: string | number) {
  return `${SS}/player/${playerId}/image`;
}

export function fmtDate(ts: number) {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
