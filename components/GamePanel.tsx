'use client';
import { useState, useEffect } from 'react';
import { PPProp, PlayerSearchResult, Sport } from '@/types';
import { ssEventLineups } from '@/lib/sofascore-client';
import { PlayerAvatar } from '@/components/PlayerSearch';

interface Player {
  id: number;
  name: string;
  position?: string;
  jerseyNumber?: string;
}

interface Props {
  gameId: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamId?: number;
  awayTeamId?: number;
  sport: Sport;
  ppProps: PPProp[];          // all PrizePicks props for this sport (pre-fetched or empty)
  oddsGame?: {                 // sportsbook odds for this specific game (if loaded)
    bookmakers?: Array<{
      title: string;
      markets?: Array<{
        key: string;
        outcomes?: Array<{ name: string; price: number; point?: number }>;
      }>;
    }>;
  };
  onSelectPlayer: (player: PlayerSearchResult) => void;
}

export default function GamePanel({
  gameId, homeTeam, awayTeam, homeTeamId, awayTeamId,
  sport, ppProps, oddsGame, onSelectPlayer,
}: Props) {
  const [homePlayers, setHomePlayers] = useState<Player[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'players' | 'props' | 'odds'>('players');

  useEffect(() => {
    loadLineups();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  async function loadLineups() {
    setLoading(true);
    try {
      const data = await ssEventLineups(gameId);
      if (!data) { setLoading(false); return; }

      function extractPlayers(team: {
        players?: Array<{
          player: { id: number; name: string; position?: string };
          jerseyNumber?: string;
        }>;
      }): Player[] {
        return (team?.players || []).map(p => ({
          id: p.player.id,
          name: p.player.name,
          position: p.player.position,
          jerseyNumber: p.jerseyNumber,
        }));
      }

      setHomePlayers(extractPlayers(data.home));
      setAwayPlayers(extractPlayers(data.away));
    } catch {
      // lineups unavailable
    } finally {
      setLoading(false);
    }
  }

  // Filter PrizePicks props to players in this game
  const allPlayerNames = new Set([
    ...homePlayers.map(p => p.name.toLowerCase()),
    ...awayPlayers.map(p => p.name.toLowerCase()),
  ]);

  const matchedProps = ppProps.filter(pp =>
    allPlayerNames.has(pp.player.toLowerCase()) ||
    // fuzzy: any word in PP player name matches a player in lineup
    homePlayers.concat(awayPlayers).some(lp =>
      pp.player.toLowerCase().includes(lp.name.split(' ').pop()?.toLowerCase() || '') ||
      lp.name.toLowerCase().includes(pp.player.split(' ').pop()?.toLowerCase() || '')
    )
  );

  function handlePlayerClick(p: Player, team: 'home' | 'away') {
    const teamId = team === 'home' ? homeTeamId : awayTeamId;
    const teamName = team === 'home' ? homeTeam : awayTeam;
    onSelectPlayer({
      id: p.id,
      name: p.name,
      team: teamName,
      position: p.position || '',
      sport,
      // pass teamId so home/away detection works in stats
      ...({ teamId } as unknown as object),
    });
  }

  const sectionBtnStyle = (active: boolean) => ({
    padding: '6px 16px',
    borderRadius: '6px',
    border: 'none',
    background: active ? 'var(--green)' : 'transparent',
    color: active ? '#000' : 'var(--text2)',
    fontWeight: '600' as const,
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.15s',
  });

  return (
    <div style={{
      background: '#0f0f0f',
      borderTop: '1px solid var(--border)',
      borderBottom: '2px solid var(--green)',
      padding: '16px 20px',
      animation: 'slideDown 0.2s ease',
    }}>
      {/* Section tabs */}
      <div style={{ display: 'flex', gap: '4px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '4px', width: 'fit-content', marginBottom: '16px' }}>
        <button style={sectionBtnStyle(activeSection === 'players')} onClick={() => setActiveSection('players')}>
          👥 Lineups {homePlayers.length + awayPlayers.length > 0 ? `(${homePlayers.length + awayPlayers.length})` : ''}
        </button>
        <button style={sectionBtnStyle(activeSection === 'props')} onClick={() => setActiveSection('props')}>
          ⚡ Props {matchedProps.length > 0 ? `(${matchedProps.length})` : ''}
        </button>
        <button style={sectionBtnStyle(activeSection === 'odds')} onClick={() => setActiveSection('odds')}>
          📊 Odds
        </button>
      </div>

      {/* ── PLAYERS / LINEUPS ── */}
      {activeSection === 'players' && (
        loading ? (
          <div style={{ fontSize: '13px', color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="dots"><span style={{ background: 'var(--text3)' }} /><span style={{ background: 'var(--text3)' }} /><span style={{ background: 'var(--text3)' }} /></span>
            Loading lineups...
          </div>
        ) : homePlayers.length === 0 && awayPlayers.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--text3)' }}>
            Lineups not yet available — click a player from another source or search above.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {[
              { label: awayTeam, players: awayPlayers, side: 'away' as const },
              { label: homeTeam, players: homePlayers, side: 'home' as const },
            ].map(({ label, players, side }) => (
              <div key={side}>
                <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '9px', padding: '2px 6px', background: side === 'home' ? 'var(--green-dim)' : 'rgba(255,255,255,0.06)', color: side === 'home' ? 'var(--green)' : 'var(--text3)', borderRadius: '3px', fontWeight: '700' }}>{side === 'home' ? 'HOME' : 'AWAY'}</span>
                  {label}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {players.map(p => (
                    <button
                      key={p.id}
                      onClick={() => handlePlayerClick(p, side)}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'all 0.15s', width: '100%' }}
                      onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--green)'; (e.currentTarget as HTMLElement).style.background = 'var(--green-dim)'; }}
                      onMouseOut={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.background = 'var(--card)'; }}
                    >
                      <PlayerAvatar id={p.id} sport={sport} size={28} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                        {p.position && <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '1px' }}>{p.position}</div>}
                      </div>
                      {p.jerseyNumber && <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text3)', flexShrink: 0 }}>#{p.jerseyNumber}</div>}
                      <div style={{ fontSize: '11px', color: 'var(--green)', flexShrink: 0 }}>Analyze →</div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── PRIZEPICKS PROPS ── */}
      {activeSection === 'props' && (
        matchedProps.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--text3)' }}>
            {ppProps.length === 0
              ? 'No PrizePicks props loaded yet — click "⚡ PrizePicks Props" above first.'
              : 'No PrizePicks props found for players in this game. Lineups may not be confirmed yet.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {matchedProps.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)' }}>{p.player}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>{p.stat} · {p.desc} · {p.half}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--green)' }}>{p.line}</div>
                  <button
                    onClick={() => {
                      // Find player in lineup and load them
                      const found = homePlayers.concat(awayPlayers).find(lp =>
                        lp.name.toLowerCase().includes(p.player.split(' ').pop()?.toLowerCase() || '') ||
                        p.player.toLowerCase().includes(lp.name.split(' ').pop()?.toLowerCase() || '')
                      );
                      if (found) {
                        const side = homePlayers.includes(found) ? 'home' : 'away';
                        handlePlayerClick(found, side);
                      }
                    }}
                    style={{ fontSize: '11px', fontWeight: '700', padding: '5px 12px', borderRadius: '6px', border: '1px solid var(--green)', background: 'var(--green-dim)', color: 'var(--green)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                  >
                    Analyze →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── SPORTSBOOK ODDS ── */}
      {activeSection === 'odds' && (
        !oddsGame ? (
          <div style={{ fontSize: '13px', color: 'var(--text3)' }}>
            Click &quot;📊 Sportsbook Odds&quot; above to load lines for all today&apos;s games.
          </div>
        ) : !oddsGame.bookmakers?.length ? (
          <div style={{ fontSize: '13px', color: 'var(--text3)' }}>
            No odds available for this game yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {oddsGame.bookmakers.map(bm => (
              <div key={bm.title} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px 14px' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text2)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{bm.title}</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {bm.markets?.map(market => (
                    market.outcomes?.map(outcome => {
                      const price = outcome.price;
                      return (
                        <div key={outcome.name} style={{ padding: '6px 12px', background: 'var(--card2)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '2px' }}>{outcome.name}{outcome.point !== undefined ? ` (${outcome.point > 0 ? '+' : ''}${outcome.point})` : ''}</div>
                          <div style={{ fontSize: '14px', fontWeight: '800', color: price > 0 ? 'var(--green)' : 'var(--text)' }}>
                            {price > 0 ? '+' : ''}{price}
                          </div>
                        </div>
                      );
                    })
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
