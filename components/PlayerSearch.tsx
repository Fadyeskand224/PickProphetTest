'use client';
import { useState, useRef, useEffect } from 'react';
import { PlayerSearchResult, Sport } from '@/types';

interface Props {
  sport: Sport;
  placeholder?: string;
  onSelect: (player: PlayerSearchResult) => void;
  inputStyle?: React.CSSProperties;
}

export default function PlayerSearch({ sport, placeholder, onSelect, inputStyle }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  function onInput(val: string) {
    setQuery(val);
    setActiveIdx(-1);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (val.length < 2) { setOpen(false); setResults([]); return; }
    timerRef.current = setTimeout(() => search(val), 280);
  }

  async function search(q: string) {
    try {
      const res = await fetch(`/api/players/search?q=${encodeURIComponent(q)}&sport=${sport}`);
      const data = await res.json();
      setResults(data.results || []);
      setOpen((data.results || []).length > 0);
    } catch {
      setOpen(false);
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
      <input
        type="text"
        value={query}
        onChange={e => onInput(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder || `Search ${sport} player…`}
        autoComplete="off"
        style={inputStyle}
      />
      {open && (
        <div className="autocomplete-dropdown">
          {results.map((p, i) => (
            <div
              key={p.id}
              className={`ac-item${i === activeIdx ? ' active' : ''}`}
              onMouseDown={() => select(p)}
            >
              {sport === 'Soccer' && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`https://api.sofascore.com/api/v1/player/${p.id}/image`}
                  alt=""
                  style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', background: 'var(--border2)' }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              {sport !== 'Soccer' && (
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>
                  {sport === 'NBA' ? '🏀' : '🏈'}
                </div>
              )}
              <div>
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
