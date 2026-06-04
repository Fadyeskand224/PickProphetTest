'use client';
import { useState } from 'react';
import { GameRow, StatConfig } from '@/types';

function fmtStat(val: number | null | undefined): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'number') return Number.isInteger(val) ? String(val) : val.toFixed(2);
  return String(val);
}

const ALL_STAT_GROUPS = [
  { label: 'Shooting', stats: [
    { key: 'totalShots', label: 'Total Shots' }, { key: 'onTargetScoringAttempt', label: 'Shots on Target' },
    { key: 'shotOffTarget', label: 'Shots off Target' }, { key: 'blockedScoringAttempt', label: 'Blocked' },
    { key: 'expectedGoals', label: 'xG', dec: 2 }, { key: 'goals', label: 'Goals' },
  ]},
  { label: 'Passing', stats: [
    { key: 'totalPass', label: 'Passes' }, { key: 'accuratePass', label: 'Accurate' },
    { key: 'keyPass', label: 'Key Passes' }, { key: 'goalAssist', label: 'Assists' },
    { key: 'totalCross', label: 'Crosses' }, { key: 'expectedAssists', label: 'xA', dec: 2 },
  ]},
  { label: 'Defense', stats: [
    { key: 'totalTackle', label: 'Tackles' }, { key: 'wonTackle', label: 'Tackles Won' },
    { key: 'interceptionWon', label: 'Interceptions' }, { key: 'ballRecovery', label: 'Ball Rec.' },
  ]},
  { label: 'Other', stats: [
    { key: 'minutesPlayed', label: 'Minutes' }, { key: 'touches', label: 'Touches' },
    { key: 'fouls', label: 'Fouls' }, { key: 'yellowCard', label: 'Yellow' },
    { key: 'rating', label: 'Rating', dec: 1 },
    // NBA
    { key: 'pts', label: 'PTS' }, { key: 'reb', label: 'REB' }, { key: 'ast', label: 'AST' },
    { key: 'stl', label: 'STL' }, { key: 'blk', label: 'BLK' }, { key: 'fg3m', label: '3PM' },
    // NFL
    { key: 'passingYards', label: 'Pass Yds' }, { key: 'rushingYards', label: 'Rush Yds' },
    { key: 'receivingYards', label: 'Rec Yds' }, { key: 'receptions', label: 'REC' },
  ]},
];

interface Props {
  gameData: GameRow[];
  cfg: StatConfig;
  propLine: number | null;
}

export default function GamesTable({ gameData, cfg, propLine }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  function toggle(idx: number) {
    setOpenIdx(prev => prev === idx ? null : idx);
  }

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden', marginBottom: '20px' }}>
      <table className="games-table">
        <thead>
          <tr>
            <th style={{ width: '16px' }}></th>
            <th>Date</th>
            <th>Opponent</th>
            <th>Result</th>
            <th>H/A</th>
            {cfg.tableStats.map(s => <th key={s.key}>{s.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {gameData.map((g, idx) => {
            const resClass = g.result === 'W' ? 'result-w' : g.result === 'L' ? 'result-l' : 'result-d';
            const isOpen = openIdx === idx;
            return (
              <>
                <tr key={idx} className="game-row" onClick={() => toggle(idx)}>
                  <td style={{ color: 'var(--text3)', fontSize: '11px', paddingRight: '4px', transition: 'color 0.15s' }}>
                    {isOpen ? '▼' : '▶'}
                  </td>
                  <td>{g.date}</td>
                  <td style={{ color: 'var(--text)' }}>{g.opponent}</td>
                  <td>
                    <span className={resClass}>{g.result}</span>{' '}
                    <span style={{ color: 'var(--text3)', fontSize: '12px' }}>{g.score}</span>
                  </td>
                  <td style={{ color: 'var(--text3)' }}>{g.ha}</td>
                  {cfg.tableStats.map(s => {
                    const v = g.stats[s.key];
                    const isOver = propLine !== null && v !== null && v !== undefined && v >= propLine;
                    const display = s.dec && v !== null && v !== undefined
                      ? Number(v).toFixed(s.dec)
                      : fmtStat(v);
                    return <td key={s.key} className={isOver ? 'cell-over' : ''}>{display}</td>;
                  })}
                </tr>
                {isOpen && (
                  <tr key={`detail-${idx}`} style={{ background: '#0f0f0f' }}>
                    <td colSpan={100} style={{ padding: 0 }}>
                      <div style={{
                        padding: '20px 24px',
                        borderTop: '1px solid var(--border)',
                        borderBottom: '2px solid var(--green)',
                        animation: 'slideDown 0.2s ease',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                          <div>
                            <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text)' }}>{g.opponent}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>{g.date} · {g.ha === 'H' ? 'Home' : 'Away'}</div>
                          </div>
                          <span className={resClass} style={{ fontSize: '18px', fontWeight: '800', padding: '6px 14px', borderRadius: '8px' }}>
                            {g.result} {g.score}
                          </span>
                          {g.stats.rating != null && (
                            <span style={{ background: 'var(--green-dim)', color: 'var(--green)', fontSize: '13px', fontWeight: '700', padding: '4px 12px', borderRadius: '8px' }}>
                              Rating: {Number(g.stats.rating).toFixed(1)}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: '12px' }}>
                          {ALL_STAT_GROUPS.map(group => {
                            const rows = group.stats.filter(s => g.stats[s.key] != null);
                            if (!rows.length) return null;
                            return (
                              <div key={group.label} style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px' }}>
                                <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--green)', marginBottom: '10px' }}>
                                  {group.label}
                                </div>
                                {rows.map(s => {
                                  const v = g.stats[s.key];
                                  const display = s.dec ? Number(v).toFixed(s.dec) : String(v);
                                  return (
                                    <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                                      <span style={{ fontSize: '12px', color: 'var(--text2)' }}>{s.label}</span>
                                      <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>{display}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
