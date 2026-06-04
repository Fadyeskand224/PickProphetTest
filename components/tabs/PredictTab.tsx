'use client';
import { useState, useEffect } from 'react';
import PlayerSearch from '@/components/PlayerSearch';
import StatChart from '@/components/StatChart';
import GamesTable from '@/components/GamesTable';
import PropSelect from '@/components/PropSelect';
import GamePanel from '@/components/GamePanel';
import { Pick, PlayerSearchResult, GameRow, StatConfig, PPProp, PredictionResult, Sport } from '@/types';
import { getStatTabs, getDefaultStatTab, getLeaguesForSport } from '@/lib/statConfig';
import {
  ssPlayerEvents, ssEventPlayerStats, ssPlayerSeasons, ssSeasonStats,
  ssPlayerImageUrl, ssTodayEvents, fmtDate, SPORT_SLUG,
} from '@/lib/sofascore-client';

interface TodayGame {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamId?: number;
  awayTeamId?: number;
  time: string;
  tournament: string;
  status: string;
}

interface Props { sport: Sport; picks: Pick[]; }

export default function PredictTab({ sport, picks }: Props) {
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerSearchResult | null>(null);
  const [gameData, setGameData] = useState<GameRow[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [activeStatTab, setActiveStatTab] = useState(getDefaultStatTab(sport));
  const [statTabCfg, setStatTabCfg] = useState<StatConfig>(getStatTabs(sport)[getDefaultStatTab(sport)]);
  const [seasonCtx, setSeasonCtx] = useState<unknown>(null);

  // Today's schedule
  const [todayGames, setTodayGames] = useState<TodayGame[]>([]);
  const [todayLoading, setTodayLoading] = useState(false);
  const [expandedGameId, setExpandedGameId] = useState<number | null>(null);

  // Form
  const [propType, setPropType] = useState('');
  const [league, setLeague] = useState(getLeaguesForSport(sport)[0] || '');
  const [line, setLine] = useState('');
  const [odds, setOdds] = useState('');
  const [context, setContext] = useState('');
  const [predicting, setPredicting] = useState(false);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [predError, setPredError] = useState('');

  // PrizePicks
  const [ppLoading, setPpLoading] = useState(false);
  const [ppProps, setPpProps] = useState<PPProp[]>([]);
  const [ppStatus, setPpStatus] = useState('');

  // Odds
  const [oddsGames, setOddsGames] = useState<unknown[]>([]);
  const [oddsLoading, setOddsLoading] = useState(false);
  const [oddsStatus, setOddsStatus] = useState('');
  const [showOdds, setShowOdds] = useState(false);

  const STAT_TABS = getStatTabs(sport);

  // Load today's schedule on mount and sport change
  useEffect(() => {
    loadTodaySchedule();
    setPrediction(null);
    setSelectedPlayer(null);
    setGameData([]);
    setExpandedGameId(null);
    setPpProps([]);
    setPpStatus('');
    setOddsGames([]);
    setShowOdds(false);
    setActiveStatTab(getDefaultStatTab(sport));
    setStatTabCfg(getStatTabs(sport)[getDefaultStatTab(sport)]);
    setLeague(getLeaguesForSport(sport)[0] || '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sport]);

  async function loadTodaySchedule() {
    setTodayLoading(true);
    try {
      const slug = SPORT_SLUG[sport];
      const data = await ssTodayEvents(slug);
      const events = (data.events || []).slice(0, 20);
      const games: TodayGame[] = events.map((ev: {
        id: number;
        homeTeam: { id: number; name: string };
        awayTeam: { id: number; name: string };
        startTimestamp: number;
        tournament?: { name: string };
        status?: { type: string; description?: string };
      }) => ({
        id: ev.id,
        homeTeam: ev.homeTeam?.name || '?',
        awayTeam: ev.awayTeam?.name || '?',
        homeTeamId: ev.homeTeam?.id,
        awayTeamId: ev.awayTeam?.id,
        time: new Date(ev.startTimestamp * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        tournament: ev.tournament?.name || '',
        status: ev.status?.type || 'notstarted',
      }));
      setTodayGames(games);
    } catch {
      // silently fail
    } finally {
      setTodayLoading(false);
    }
  }

  async function loadPlayer(p: PlayerSearchResult) {
    setSelectedPlayer(p);
    setGameData([]);
    setDataLoading(true);
    setPrediction(null);
    setActiveStatTab(getDefaultStatTab(sport));
    setStatTabCfg(STAT_TABS[getDefaultStatTab(sport)]);

    try {
      if (sport === 'Soccer') {
        const evData = await ssPlayerEvents(p.id);
        const events = (evData.events || [])
          .filter((ev: { status?: { type: string } }) => ev.status?.type === 'finished')
          .sort((a: { startTimestamp: number }, b: { startTimestamp: number }) => b.startTimestamp - a.startTimestamp)
          .slice(0, 8);

        const statsResults = await Promise.all(
          events.map((ev: { id: number }) => ssEventPlayerStats(ev.id, p.id))
        );

        const rows: GameRow[] = events.map((ev: {
          homeTeam?: { id: number; name: string };
          awayTeam?: { id: number; name: string };
          homeScore?: { current: number };
          awayScore?: { current: number };
          startTimestamp: number;
        }, idx: number) => {
          const stats = statsResults[idx]?.statistics || {};
          const tId = (p as unknown as { teamId?: number }).teamId;
          const isHome = tId ? ev.homeTeam?.id === tId : true;
          const opponent = isHome ? ev.awayTeam?.name : ev.homeTeam?.name;
          const myScore = isHome ? (ev.homeScore?.current ?? 0) : (ev.awayScore?.current ?? 0);
          const oppScore = isHome ? (ev.awayScore?.current ?? 0) : (ev.homeScore?.current ?? 0);
          let result: 'W' | 'L' | 'D' = 'D';
          if (myScore > oppScore) result = 'W';
          else if (myScore < oppScore) result = 'L';
          return { date: fmtDate(ev.startTimestamp), opponent: opponent || 'Unknown', result, score: `${myScore}–${oppScore}`, ha: isHome ? 'H' : 'A', stats };
        });

        setGameData(rows);

        // Season stats (Soccer only)
        try {
          const seasData = await ssPlayerSeasons(p.id);
          const typesMap = seasData.typesMap || {};
          const tournaments = seasData.uniqueTournamentSeasons || [];
          let bestTournId: string | null = null;
          let bestSeasonId: number | null = null;
          for (const t of tournaments) {
            const tid = String(t.uniqueTournament.id);
            const tSeasons = typesMap[tid] || {};
            for (const s of t.seasons) {
              const types = tSeasons[s.id] || [];
              if (types.includes('home') && types.includes('away')) { bestTournId = tid; bestSeasonId = s.id; break; }
            }
            if (bestTournId) break;
          }
          if (bestTournId && bestSeasonId) {
            const [o, h, a] = await Promise.all([
              ssSeasonStats(p.id, bestTournId, bestSeasonId, 'overall'),
              ssSeasonStats(p.id, bestTournId, bestSeasonId, 'home'),
              ssSeasonStats(p.id, bestTournId, bestSeasonId, 'away'),
            ]);
            const tournName = tournaments.find((t: { uniqueTournament: { id: number } }) => String(t.uniqueTournament.id) === bestTournId)?.uniqueTournament.name || '';
            const seasonName = tournaments.find((t: { uniqueTournament: { id: number }; seasons: { id: number; name: string }[] }) => String(t.uniqueTournament.id) === bestTournId)?.seasons.find((s: { id: number }) => s.id === bestSeasonId)?.name || '';
            setSeasonCtx({ context: { overall: o.statistics, home: h.statistics, away: a.statistics, appearances: { total: o.statistics?.appearances || 1, home: h.statistics?.appearances || 1, away: a.statistics?.appearances || 1 }, tournament: tournName, season: seasonName } });
          }
        } catch { /* ignore season stats failure */ }

      } else {
        const res = await fetch(`/api/players/events?playerId=${p.id}&sport=${sport}`);
        const data = await res.json();
        setGameData(data.events || []);
      }
    } catch {
      // ignore
    } finally {
      setDataLoading(false);
    }
  }

  async function loadPrizePicks() {
    setPpLoading(true); setPpStatus('');
    try {
      const res = await fetch(`/api/odds/prizepicks?sport=${sport}`);
      const data = await res.json();
      setPpProps(data.props || []);
      setPpStatus(data.props?.length > 0 ? `${data.props.length} live props` : 'No props live right now');
    } catch { setPpStatus('Error fetching props'); }
    finally { setPpLoading(false); }
  }

  async function loadOdds() {
    setOddsLoading(true); setOddsStatus(''); setShowOdds(false);
    try {
      const res = await fetch(`/api/odds/sportsbooks?sport=${sport}`);
      const data = await res.json();
      if (data.error) { setOddsStatus(data.error); }
      else { setOddsGames(data.games || []); setOddsStatus(data.games?.length > 0 ? `${data.games.length} games` : 'No games found'); setShowOdds(true); }
    } catch { setOddsStatus('Error'); }
    finally { setOddsLoading(false); }
  }

  async function generatePrediction() {
    if (!selectedPlayer || !line) return;
    setPredicting(true); setPredError(''); setPrediction(null);
    try {
      const res = await fetch('/api/ai/predict', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: selectedPlayer.name, sport, league, propType, line: parseFloat(line), direction: 'Over', odds, context, picks, gameData, seasonContext: seasonCtx }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPrediction(data.prediction);
    } catch (err) { setPredError(String(err)); }
    finally { setPredicting(false); }
  }

  function switchStatTab(key: string) {
    setActiveStatTab(key);
    setStatTabCfg(STAT_TABS[key]);
  }

  const propLine = line ? parseFloat(line) : null;

  return (
    <div>
      {/* ── Today's Schedule ── */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px 24px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--green)', marginBottom: '2px' }}>🗓 Today&apos;s {sport} Schedule</div>
            <div style={{ fontSize: '12px', color: 'var(--text3)' }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
          </div>
          <button onClick={loadTodaySchedule} disabled={todayLoading} style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: '8px', padding: '6px 14px', fontSize: '12px', color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit' }}>
            {todayLoading ? '↺ Loading...' : '↺ Refresh'}
          </button>
        </div>

        {todayLoading && <div style={{ fontSize: '13px', color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: '6px' }}><span className="dots"><span style={{ background: 'var(--text3)' }} /><span style={{ background: 'var(--text3)' }} /><span style={{ background: 'var(--text3)' }} /></span> Loading today&apos;s games...</div>}

        {!todayLoading && todayGames.length === 0 && (
          <div style={{ fontSize: '13px', color: 'var(--text3)', textAlign: 'center', padding: '12px 0' }}>
            No {sport} games scheduled today. Check back later or switch sport.
          </div>
        )}

        {todayGames.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: expandedGameId ? 'none' : '260px', overflowY: expandedGameId ? 'visible' : 'auto' }}>
            {todayGames.map(g => {
              const isLive = g.status === 'inprogress';
              const isExpanded = expandedGameId === g.id;

              // Find matching sportsbook game by team name
              const oddsMatch = (oddsGames as Array<{ home_team: string; away_team: string; bookmakers?: unknown[] }>).find(og =>
                og.home_team?.toLowerCase().includes(g.homeTeam.split(' ').pop()?.toLowerCase() || '') ||
                og.away_team?.toLowerCase().includes(g.awayTeam.split(' ').pop()?.toLowerCase() || '')
              );

              return (
                <div key={g.id}>
                  {/* Game row */}
                  <div
                    onClick={() => setExpandedGameId(isExpanded ? null : g.id)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: isExpanded ? 'var(--green-dim)' : 'var(--card2)', borderRadius: isExpanded ? '8px 8px 0 0' : '8px', border: `1px solid ${isExpanded ? 'var(--green)' : isLive ? 'rgba(61,255,143,0.4)' : 'var(--border)'}`, cursor: 'pointer', transition: 'all 0.15s' }}
                    onMouseOver={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.borderColor = 'var(--green)'; }}
                    onMouseOut={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.borderColor = isLive ? 'rgba(61,255,143,0.4)' : 'var(--border)'; }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>
                        {g.awayTeam} <span style={{ color: 'var(--text3)', fontWeight: '400' }}>@</span> {g.homeTeam}
                      </div>
                      {g.tournament && <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>{g.tournament}</div>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0, marginLeft: '12px' }}>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: isLive ? 'var(--green)' : 'var(--text2)' }}>
                        {isLive ? '🔴 LIVE' : g.time}
                      </div>
                      <div style={{ fontSize: '14px', color: isExpanded ? 'var(--green)' : 'var(--text3)', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'none' }}>▶</div>
                    </div>
                  </div>

                  {/* Expanded game panel */}
                  {isExpanded && (
                    <GamePanel
                      gameId={g.id}
                      homeTeam={g.homeTeam}
                      awayTeam={g.awayTeam}
                      homeTeamId={g.homeTeamId}
                      awayTeamId={g.awayTeamId}
                      sport={sport}
                      ppProps={ppProps}
                      oddsGame={oddsMatch as { bookmakers?: Array<{ title: string; markets?: Array<{ key: string; outcomes?: Array<{ name: string; price: number; point?: number }> }> }> } | undefined}
                      onSelectPlayer={(player) => {
                        loadPlayer(player);
                        // Scroll down to player section
                        setTimeout(() => {
                          document.getElementById('player-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 100);
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── PrizePicks + Odds ── */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px 24px', marginBottom: '20px' }}>
        <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--green)', marginBottom: '6px' }}>⚡ Live Props &amp; Odds</div>
        <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '14px' }}>Fetch today&apos;s {sport} props from PrizePicks and best lines from sportsbooks.</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
          <button onClick={loadPrizePicks} disabled={ppLoading} className="btn-outline">
            {ppLoading ? <><span className="dots"><span style={{ background: 'var(--green)' }} /><span style={{ background: 'var(--green)' }} /><span style={{ background: 'var(--green)' }} /></span> Fetching...</> : '⚡ PrizePicks Props'}
          </button>
          <button onClick={loadOdds} disabled={oddsLoading} className="btn-outline">
            {oddsLoading ? 'Loading...' : '📊 Sportsbook Odds'}
          </button>
          {ppStatus && <span style={{ fontSize: '12px', color: ppStatus.includes('No') ? 'var(--text3)' : 'var(--green)' }}>{ppStatus}</span>}
          {oddsStatus && <span style={{ fontSize: '12px', color: oddsStatus.includes('No') || oddsStatus.includes('Error') ? 'var(--text3)' : 'var(--green)' }}>{oddsStatus}</span>}
        </div>

        {ppProps.length > 0 && (
          <div style={{ marginBottom: showOdds && oddsGames.length > 0 ? '16px' : '0' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '8px' }}>PrizePicks — click to load into form</div>
            <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {ppProps.map((p, i) => (
                <div key={i} onClick={() => { setPropType(p.stat); setLine(String(p.line)); }} style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--green)'; (e.currentTarget as HTMLElement).style.background = 'var(--green-dim)'; }}
                  onMouseOut={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.background = 'var(--card2)'; }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>{p.player}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '1px' }}>{p.stat} · {p.desc} · {p.half}</div>
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--green)', marginLeft: '16px' }}>{p.line}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {showOdds && oddsGames.length > 0 && (
          <div>
            <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '8px' }}>Best Lines by Sportsbook</div>
            <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {(oddsGames as Array<{ id: string; home_team: string; away_team: string; commence_time: string; bookmakers?: Array<{ title: string; markets?: Array<{ outcomes?: Array<{ name: string; price: number }> }> }> }>).slice(0, 10).map((g, i) => (
                <div key={i} style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>{g.away_team} @ {g.home_team}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{new Date(g.commence_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
                  </div>
                  {g.bookmakers && g.bookmakers.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {g.bookmakers.slice(0, 4).map(bm => {
                        const price = bm.markets?.[0]?.outcomes?.[0]?.price ?? 0;
                        return (
                          <span key={bm.title} style={{ fontSize: '11px', color: 'var(--text2)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '4px' }}>
                            {bm.title} <strong style={{ color: price > 0 ? 'var(--green)' : 'var(--text)' }}>{price > 0 ? '+' : ''}{price}</strong>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Player Search ── */}
      <div id="player-section" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px 24px', marginBottom: '20px' }}>
        <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text2)', marginBottom: '12px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Search a {sport} Player</div>
        <PlayerSearch sport={sport} onSelect={loadPlayer} inputStyle={{ fontSize: '16px', padding: '14px 18px' }} />
        {dataLoading && (
          <div style={{ fontSize: '13px', color: 'var(--text3)', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="dots"><span style={{ background: 'var(--text3)' }} /><span style={{ background: 'var(--text3)' }} /><span style={{ background: 'var(--text3)' }} /></span>
            Loading player data from SofaScore...
          </div>
        )}
      </div>

      {/* ── Player data ── */}
      {selectedPlayer && !dataLoading && (
        <>
          {/* Player profile */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px 24px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '20px' }}>
            {sport === 'Soccer' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ssPlayerImageUrl(selectedPlayer.id)} alt="" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--green)', flexShrink: 0 }} />
            ) : (
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--card2)', border: '3px solid var(--green)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px' }}>
                {sport === 'NBA' ? '🏀' : '🏈'}
              </div>
            )}
            <div>
              <div style={{ fontSize: '24px', fontWeight: '800', marginBottom: '4px' }}>{selectedPlayer.name}</div>
              <div style={{ fontSize: '14px', color: 'var(--text2)' }}>{selectedPlayer.team}</div>
              <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>{selectedPlayer.position}</div>
              {gameData.length > 0 && <div style={{ fontSize: '11px', color: 'var(--green)', marginTop: '6px', fontWeight: '600' }}>✓ {gameData.length} recent games loaded</div>}
            </div>
          </div>

          {gameData.length > 0 && (
            <>
              {/* Stat category tabs */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                {Object.entries(STAT_TABS).map(([key, cfg]) => (
                  <button key={key} onClick={() => switchStatTab(key)} className={`stat-cat-tab${activeStatTab === key ? ' active' : ''}`}>{cfg.label}</button>
                ))}
              </div>

              {/* Averages */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
                {statTabCfg.avgStats.map(s => {
                  const vals = gameData.map(g => g.stats[s.key]).filter(v => v !== null && v !== undefined) as number[];
                  const a = vals.length ? vals.reduce((sum, v) => sum + v, 0) / vals.length : null;
                  const display = a === null ? '—' : (s.dec ? a.toFixed(s.dec) : Number.isInteger(a) ? String(a) : a.toFixed(1));
                  return (
                    <div key={s.key} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                      <div style={{ fontSize: '30px', fontWeight: '800', lineHeight: 1, marginBottom: '6px' }}>{display}</div>
                      <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text3)' }}>{s.label}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '2px' }}>avg last {vals.length}g</div>
                    </div>
                  );
                })}
              </div>

              <StatChart gameData={gameData} cfg={statTabCfg} propLine={propLine} />
              <GamesTable gameData={gameData} cfg={statTabCfg} propLine={propLine} />
            </>
          )}

          {/* ── AI Prediction form ── */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px 28px', marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--green)', marginBottom: '16px' }}>✦ Generate AI Prediction</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div><label className="field-label">League</label>
                <select value={league} onChange={e => setLeague(e.target.value)}>
                  {getLeaguesForSport(sport).map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div><label className="field-label">Prop Type</label><PropSelect sport={sport} value={propType} onChange={setPropType} /></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div><label className="field-label">Line</label><input type="number" value={line} onChange={e => setLine(e.target.value)} placeholder="e.g. 2.5" step="0.5" /></div>
              <div><label className="field-label">Odds</label><input type="text" value={odds} onChange={e => setOdds(e.target.value)} placeholder="-115 or +110" /></div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="field-label">Extra Context (injuries, matchup, weather, etc.)</label>
              <textarea value={context} onChange={e => setContext(e.target.value)} placeholder="e.g. Facing a team allowing 14 shots/game, playing at home, no injury news..." style={{ minHeight: '80px' }} />
            </div>

            <button onClick={generatePrediction} disabled={predicting || !line || !propType} className="btn-green">
              {predicting ? <><span className="dots"><span style={{ background: '#000' }} /><span style={{ background: '#000' }} /><span style={{ background: '#000' }} /></span>&nbsp; Analyzing...</> : '✦ Generate AI Prediction'}
            </button>
          </div>

          {/* ── Prediction result ── */}
          {predError && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--red)', borderRadius: '16px', padding: '20px 24px', color: 'var(--red)', fontSize: '14px' }}>
              {predError}
            </div>
          )}

          {prediction && <PredictionCard player={selectedPlayer.name} sport={sport} propType={propType} line={line} odds={odds} prediction={prediction} />}
        </>
      )}
    </div>
  );
}

function PredictionCard({ player, sport, propType, line, odds, prediction: pred }: {
  player: string; sport: Sport; propType: string; line: string; odds: string; prediction: PredictionResult;
}) {
  const confClass = pred.confidence >= 70 ? 'conf-high' : pred.confidence >= 50 ? 'conf-med' : 'conf-low';
  const confLabel = pred.confidence >= 70 ? 'High Confidence' : pred.confidence >= 50 ? 'Moderate Confidence' : 'Low Confidence';
  const valueStyle = pred.value_rating === 'High Value'
    ? { bg: 'var(--green-dim)', color: 'var(--green)' }
    : pred.value_rating === 'Fade'
    ? { bg: 'var(--red-dim)', color: 'var(--red)' }
    : { bg: 'rgba(255,255,255,0.06)', color: 'var(--text2)' };
  const recColor = pred.recommendation === 'Over' || pred.recommendation === 'Yes' ? 'var(--green)' : 'var(--red)';

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '28px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '20px', fontWeight: '800' }}>{player}</div>
          <div style={{ fontSize: '13px', color: 'var(--text2)', marginTop: '4px' }}>{sport} · {propType} {line}{odds ? ' · ' + odds : ''}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '32px', fontWeight: '900', color: recColor }}>{pred.recommendation}</div>
          <span style={{ fontSize: '12px', fontWeight: '700', padding: '4px 12px', borderRadius: '99px', letterSpacing: '0.04em', textTransform: 'uppercase', background: valueStyle.bg, color: valueStyle.color }}>
            {pred.value_rating}
          </span>
        </div>
      </div>

      {/* Confidence bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{confLabel}</span>
        <span style={{ fontSize: '24px', fontWeight: '800' }}>{pred.confidence}%</span>
      </div>
      <div className="conf-bar" style={{ marginBottom: '16px' }}>
        <div className={`conf-fill ${confClass}`} style={{ width: pred.confidence + '%' }} />
      </div>

      {/* Meta badges */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {pred.pattern_match && (
          <span style={{ fontSize: '12px', fontWeight: '600', padding: '4px 12px', borderRadius: '99px', background: pred.pattern_match === 'High' ? 'var(--green-dim)' : pred.pattern_match === 'Medium' ? 'var(--yellow-dim)' : 'var(--red-dim)', color: pred.pattern_match === 'High' ? 'var(--green)' : pred.pattern_match === 'Medium' ? 'var(--yellow)' : 'var(--red)' }}>
            Pattern Match: {pred.pattern_match}
          </span>
        )}
        {pred.data_confidence && (
          <span style={{ fontSize: '12px', fontWeight: '600', padding: '4px 12px', borderRadius: '99px', background: 'rgba(255,255,255,0.06)', color: 'var(--text2)' }}>
            Data: {pred.data_confidence}
          </span>
        )}
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0 0 20px 0' }} />

      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '10px' }}>AI Reasoning</div>
        <div style={{ fontSize: '14px', color: 'var(--text2)', lineHeight: '1.75' }}>{pred.reasoning}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--green)', marginBottom: '10px' }}>Key Factors</div>
          {pred.key_factors.map((f, i) => (
            <div key={i} style={{ fontSize: '13px', color: 'var(--text2)', padding: '7px 0', borderBottom: '1px solid var(--border)', display: 'flex', gap: '8px' }}>
              <span style={{ color: 'var(--green)', fontWeight: '700', flexShrink: 0 }}>+</span>{f}
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--red)', marginBottom: '10px' }}>Risk Factors</div>
          {pred.risks.map((r, i) => (
            <div key={i} style={{ fontSize: '13px', color: 'var(--text2)', padding: '7px 0', borderBottom: '1px solid var(--border)', display: 'flex', gap: '8px' }}>
              <span style={{ color: 'var(--red)', fontWeight: '700', flexShrink: 0 }}>−</span>{r}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
