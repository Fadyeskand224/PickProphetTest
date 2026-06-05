'use client';
import { useState, useRef, useEffect } from 'react';
import { PlayerSearchResult, Sport } from '@/types';
import { ssSearch, ssPlayerImageUrl } from '@/lib/sofascore-client';

interface Props {
  sport: Sport;
  placeholder?: string;
  onSelect: (player: PlayerSearchResult) => void;
  inputStyle?: React.CSSProperties;
  defaultValue?: string;
}

const SPORT_EMOJI: Record<Sport, string> = { Soccer: '⚽', NBA: '🏀', NFL: '🏈' };

async function searchPlayers(q: string, sport: Sport): Promise<PlayerSearchResult[]> {
  if (sport === 'Soccer') {
    const data = await ssSearch(q);
    return (data.results || [])
      .filter((r: { type: string }) => r.type === 'player')
      .slice(0, 8)
      .map((r: { entity: { id: number; name: string; team?: { id: number; name: string }; position?: string } }) => ({
        id: r.entity.id,
        name: r.entity.name,
        team: r.entity.team?.name || '',
        teamId: r.entity.team?.id,
        position: r.entity.position || '',
        sport: 'Soccer' as Sport,
      }));
  }
  const res = await fetch(`/api/players/search?q=${encodeURIComponent(q)}&sport=${sport}`);
  const data = await res.json();
  return data.results || [];
}

function PlayerAvatar({ id, sport, size = 32 }: { id: string | number; sport: Sport; size?: number }) {
  const [imgFailed, setImgFailed] = useState(false);

  if (sport !== 'Soccer' || imgFailed) {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.5, flexShrink: 0 }}>
        {SPORT_EMOJI[sport]}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={ssPlayerImageUrl(id)}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', background: 'var(--border2)', flexShrink: 0 }}
      onError={() => setImgFailed(true)}
    />
  );
}

export { PlayerAvatar };

export default function PlayerSearch({ sport, placeholder, onSelect, inputStyle }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Reset when sport changes
  useEffect(() => {
    setQuery('');
    setResults([]);
    setOpen(false);
  }, [sport]);

  function onInput(val: string) {
    setQuery(val);
    setActiveIdx(-1);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (val.length < 2) { setOpen(false); setResults([]); return; }
    timerRef.current = setTimeout(() => doSearch(val), 300);
  }

  async function doSearch(q: string) {
    setLoading(true);
    try {
      const res = await searchPlayers(q, sport);
      setResults(res);
      setOpen(res.length > 0);
    } catch {
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  function select(p: PlayerSearchResult) {
    setQuery(p.name);
    setOpen(false);
    setResults([]);
    onSelect(p);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (activeIdx >= 0 && results[activeIdx]) select(results[activeIdx]); }
    else if (e.key === 'Escape') { setOpen(false); }
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={query}
          onChange={e => onInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder || `Search ${sport} player… (e.g. Salah, Mbappe)`}
          autoComplete="off"
          style={inputStyle}
        />
        {loading && (
          <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)' }}>
            <span className="dots" style={{ color: 'var(--text3)' }}><span /><span /><span /></span>
          </div>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="autocomplete-dropdown">
          {results.map((p, i) => (
            <div
              key={p.id}
              className={`ac-item${i === activeIdx ? ' active' : ''}`}
              onMouseDown={() => select(p)}
            >
              <PlayerAvatar id={p.id} sport={sport} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>{p.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '1px' }}>
                  {[p.team, p.position].filter(Boolean).join(' · ')}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
