'use client';
import { Pick } from '@/types';
import { calcStats } from '@/lib/picks';

interface Props {
  picks: Pick[];
}

export default function HistoryTab({ picks }: Props) {
  const { total, wins, settled, winRate } = calcStats(picks);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '28px' }}>
        {[
          { num: total, lbl: 'Total Picks' },
          { num: wins, lbl: 'Wins' },
          { num: winRate !== null ? winRate + '%' : '—', lbl: 'Win Rate' },
        ].map(({ num, lbl }) => (
          <div key={lbl} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: '800' }}>{num}</div>
            <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)', marginTop: '4px' }}>{lbl}</div>
          </div>
        ))}
      </div>

      {picks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text3)', fontSize: '14px' }}>
          No picks in history yet.
        </div>
      ) : (
        <div>
          {/* Win rate by prop type */}
          {settled > 0 && (() => {
            const propMap: Record<string, { w: number; l: number }> = {};
            picks.filter(p => p.result !== 'pending').forEach(p => {
              if (!propMap[p.prop_type]) propMap[p.prop_type] = { w: 0, l: 0 };
              p.result === 'win' ? propMap[p.prop_type].w++ : propMap[p.prop_type].l++;
            });
            const entries = Object.entries(propMap).filter(([, v]) => v.w + v.l >= 1).sort((a, b) => (b[1].w / (b[1].w + b[1].l)) - (a[1].w / (a[1].w + a[1].l)));
            if (!entries.length) return null;
            return (
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px 28px', marginBottom: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '16px' }}>Performance by Prop Type</div>
                {entries.map(([prop, { w, l }]) => {
                  const rate = Math.round(w / (w + l) * 100);
                  return (
                    <div key={prop} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ flex: 1, fontSize: '14px', color: 'var(--text)' }}>{prop}</div>
                      <div style={{ fontSize: '13px', color: 'var(--text2)' }}>{w}W {l}L</div>
                      <div style={{ width: '80px', textAlign: 'right', fontSize: '14px', fontWeight: '700', color: rate >= 60 ? 'var(--green)' : rate >= 50 ? 'var(--yellow)' : 'var(--red)' }}>{rate}%</div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* All picks list */}
          {picks.map(p => (
            <div key={p.id} className="pick-item">
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                  {p.sport} · {p.date}
                </div>
                <div style={{ fontSize: '15px', fontWeight: '600' }}>{p.player}</div>
                <div style={{ fontSize: '13px', color: 'var(--text2)', marginTop: '3px' }}>
                  {p.direction} {p.line} {p.prop_type}{p.odds ? ' · ' + p.odds : ''}
                </div>
              </div>
              <span className={`badge ${p.result === 'win' ? 'badge-win' : p.result === 'loss' ? 'badge-loss' : 'badge-pending'}`}>
                {p.result === 'win' ? 'Win' : p.result === 'loss' ? 'Loss' : 'Pending'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
