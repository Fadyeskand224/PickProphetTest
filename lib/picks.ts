import { Pick } from '@/types';

// ── Local storage fallback (for unauthenticated users) ───────────────────────
const LS_KEY = 'pickprophet_picks';

export function localGetPicks(): Pick[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function localSavePicks(picks: Pick[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(picks));
  } catch {
    // ignore quota errors
  }
}

// ── API helpers ───────────────────────────────────────────────────────────────
export async function apiGetPicks(userId: string): Promise<Pick[]> {
  const res = await fetch(`/api/picks?userId=${encodeURIComponent(userId)}`);
  const data = await res.json();
  return data.picks || [];
}

export async function apiSavePick(userId: string, pick: Omit<Pick, 'id' | 'user_id' | 'created_at'>): Promise<Pick | null> {
  const res = await fetch('/api/picks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, pick }),
  });
  const data = await res.json();
  return data.pick || null;
}

export async function apiDeletePick(userId: string, pickId: string): Promise<boolean> {
  const res = await fetch(`/api/picks/${pickId}?userId=${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
  return res.ok;
}

export async function apiUpdatePick(userId: string, pickId: string, updates: Partial<Pick>): Promise<Pick | null> {
  const res = await fetch(`/api/picks/${pickId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, updates }),
  });
  const data = await res.json();
  return data.pick || null;
}

// ── Stats helpers ─────────────────────────────────────────────────────────────
export function calcStats(picks: Pick[]) {
  const settled = picks.filter(p => p.result === 'win' || p.result === 'loss');
  const wins = settled.filter(p => p.result === 'win').length;
  const losses = settled.length - wins;
  const winRate = settled.length > 0 ? Math.round(wins / settled.length * 100) : null;
  return { total: picks.length, wins, losses, settled: settled.length, winRate };
}
