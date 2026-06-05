'use client';
// Client-side SofaScore calls — must run in browser only (SofaScore blocks server-side)
export const SS = 'https://api.sofascore.com/api/v1';

export function ssPlayerImageUrl(playerId: string | number) {
  return `${SS}/player/${playerId}/image`;
}

export function ssTeamImageUrl(teamId: string | number) {
  return `${SS}/team/${teamId}/image`;
}

export function fmtDate(ts: number) {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export async function ssSearch(q: string) {
  const res = await fetch(`${SS}/search/all?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}

export async function ssPlayerEvents(playerId: string | number) {
  const res = await fetch(`${SS}/player/${playerId}/events/last/0`);
  if (!res.ok) throw new Error('Events failed');
  return res.json();
}

export async function ssEventPlayerStats(eventId: number, playerId: string | number) {
  const res = await fetch(`${SS}/event/${eventId}/player/${playerId}/statistics`);
  if (!res.ok) return { statistics: {} };
  return res.json();
}

export async function ssPlayerSeasons(playerId: string | number) {
  const res = await fetch(`${SS}/player/${playerId}/statistics/seasons`);
  if (!res.ok) throw new Error('Seasons failed');
  return res.json();
}

export async function ssSeasonStats(playerId: string | number, tournId: string, seasonId: number, type: string) {
  const res = await fetch(`${SS}/player/${playerId}/unique-tournament/${tournId}/season/${seasonId}/statistics/${type}`);
  if (!res.ok) return { statistics: {} };
  return res.json();
}

export async function ssTodayEvents(sport: 'football' | 'basketball' | 'american-football') {
  const today = new Date().toISOString().split('T')[0];
  const res = await fetch(`${SS}/sport/${sport}/scheduled-events/${today}`);
  if (!res.ok) return { events: [] };
  return res.json();
}

export async function ssEventLineups(eventId: number) {
  const res = await fetch(`${SS}/event/${eventId}/lineups`);
  if (!res.ok) return null;
  return res.json();
}

export async function ssEventOdds(eventId: number) {
  const res = await fetch(`${SS}/event/${eventId}/odds/1/all/1`);
  if (!res.ok) return null;
  return res.json();
}

// Map our sport names to SofaScore sport slugs
export const SPORT_SLUG: Record<string, 'football' | 'basketball' | 'american-football'> = {
  Soccer: 'football',
  NBA: 'basketball',
  NFL: 'american-football',
};
