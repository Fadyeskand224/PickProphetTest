'use client';
import { useState } from 'react';
import PlayerSearch from '@/components/PlayerSearch';
import StatChart from '@/components/StatChart';
import GamesTable from '@/components/GamesTable';
import PropSelect from '@/components/PropSelect';
import { Pick, PlayerSearchResult, GameRow, StatConfig, PPProp, PredictionResult, Sport } from '@/types';
import { getStatTabs, getDefaultStatTab, getLeaguesForSport } from '@/lib/statConfig';

interface Props {
  sport: Sport;
  picks: Pick[];
}

export default function PredictTab({ sport, picks }: Props) {
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerSearchResult | null>(null);
  const [gameData, setGameData] = useState<GameRow[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [activeStatTab, setActiveStatTab] = useState(getDefaultStatTab(sport));
  const [statTabCfg, setStatTabCfg] = useState<StatConfig>(getStatTabs(sport)[getDefaultStatTab(sport)]);
  const [seasonCtx, setSeasonCtx] = useState<unknown>(null);

  // Form state
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

  // Sportsbook odds
  const [oddsGames, setOddsGames] = useState<unknown[]>([]);
  const [oddsLoading, setOddsLoading] = useState(false);
  const [oddsStatus, setOddsStatus] = useState('');

  const STAT_TABS = getStatTabs(sport);

  async function loadPlayer(p: PlayerSearchResult) {
    setSelectedPlayer(p);
    setGameData([]);
    setDataLoading(true);
    setPrediction(null);
    setActiveStatTab(getDefaultStatTab(sport));
    setStatTabCfg(STAT_TABS[getDefaultStatTab(sport)]);

    try {
      const [evRes, seasRes] = await Promise.all([
        fetch(`/api/players/events?playerId=${p.id}&sport=${sport}`),
        sport === 'Soccer' ? fetch(`/api/players/season-stats?playerId=${p.id}`) : Promise.resolve(null),
      ]);
      const evData = await evRes.json();
      setGameData(evData.events || []);
      if (seasRes) {
        const seasData = await seasRes.json();
        setSeasonCtx(seasData);
      }
    } catch {
      // ignore
    } finally {
      setDataLoading(false);
    }
  }

  async function loadPrizePicks() {
    setPpLoading(true);
    setPpStatus('');
    try {
      const res = await fetch(`/api/odds/prizepicks?sport=${sport}`);
      const data = await res.json();
      setPpProps(data.props || []);
      setPpStatus(data.props?.length > 0 ? `${data.props.length} props loaded` : 'No props live right now');
    } catch {
      setPpStatus('Error fetching props');
    } finally {
      setPpLoading(false);
    }
  }

  async function loadOdds() {
    setOddsLoading(true);
    setOddsStatus('');
    try {
      const res = await fetch(`/api/odds/sportsbooks?sport=${sport}`);
      const data = await res.json();
      if (data.error) {
        setOddsStatus(data.error);
      } else {
        setOddsGames(data.games || []);
        setOddsStatus(data.games?.length > 0 ? `${data.games.length} games with odds` : 'No live games found');
      }
    } catch {
      setOddsStatus('Error fetching odds');
    } finally {
      setOddsLoading(false);
    }
  }

  function selectPP(p: PPProp) {
    setPropType(p.stat);
    setLine(String(p.line));
    if (!selectedPlayer) {
      // auto-fill player name search (user still needs to click)
    }
  }

  async function generatePrediction() {
    if (!selectedPlayer || !line) return;
    setPredicting(true);
    setPredError('');
    setPrediction(null);
    try {
      const res = await fetch('/api/ai/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName: selectedPlayer.name,
          sport, league, propType, line: parseFloat(line),
          direction: 'Over', odds, context,
          picks, gameData, seasonContext: seasonCtx,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPrediction(data.prediction);
    } catch (err) {
      setPredError(String(err));
    } finally {
      setPredicting(false);
    }
  }

  function switchStatTab(key: string) {
    setActiveStatTab(key);
    setStatTabCfg(STAT_TABS[key]);
  }

  const propLine = line ? parseFloat(line) : null;

  return (
    <div>
      {/* ── PrizePicks ── */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px 28px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--green)' }}>⚡ PrizePicks Live Props</span>
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '12px' }}>
          Fetch today&apos;s {sport} props from PrizePicks and load them into the form below.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <button onClick={loadPrizePicks} disabled={ppLoading} className="btn-outline">
            {ppLoading
              ? <><span className="dots"><span style={{ background: 'var(--green)' }} /><span style={{ background: 'var(--green)' }} /><span style={{ background: 'var(--green)' }} /></span> Fetching...</>
              : '↺ Fetch Live Props'}
          </button>
          <button onClick={loadOdds} disabled={oddsLoading} className="btn-outline">
            {oddsLoading ? 'Loading...' : '📊 Sportsbook Odds'}
          </button>
          {ppStatus && <span style={{ fontSize: '13px', color: 'var(--text3)' }}>{ppStatus}</span>}
          {oddsStatus && <span style={{ fontSize: '13px', color: 'var(--text3)' }}>{oddsStatus}</span>}
        </div>

        {ppProps.length > 0 && (
          <div>
            <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '12px' }}>
              Click a prop to load it into the form
            </div>
            <div style={{ maxHeight: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {ppProps.map((p, i) => (
                <div
                  key={i}
                  onClick={() => selectPP(p)}
                  style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--green)'; (e.currentTarget as HTMLElement).style.background = 'var(--green-dim)'; }}
                  onMouseOut={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.background = 'var(--card2)'; }}
                >
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>{p.player}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>{p.stat} · {p.desc} · {p.half}</div>
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--green)', marginLeft: '16px', whiteSpace: 'nowrap' }}>{p.line}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sportsbook odds display */}
        {oddsGames.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '12px' }}>
              Sportsbook Odds (Best Lines)
            </div>
            <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {(oddsGames as Array<{ id: string; home_team: string; away_team: string; commence_time: string; bookmakers?: Array<{ title: string; markets?: Array<{ key: string; outcomes?: Array<{ name: string; price: number }> }> }> }>).slice(0, 8).map((g, i) => (
                <div key={i} style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>{g.home_team} vs {g.away_team}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{new Date(g.commence_time).toLocaleString()}</div>
                  {g.bookmakers && g.bookmakers.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                      {g.bookmakers.slice(0, 3).map((bm) => (
                        <span key={bm.title} style={{ fontSize: '11px', color: 'var(--text2)', background: 'var(--border)', padding: '2px 8px', borderRadius: '4px' }}>
                          {bm.title}: {(bm.markets?.[0]?.outcomes?.[0]?.price ?? 0) > 0 ? '+' : ''}{bm.markets?.[0]?.outcomes?.[0]?.price}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Player Search ── */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px 28px', marginBottom: '20px' }}>
        <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text2)', marginBottom: '12px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Search a Player</div>
        <PlayerSearch sport={sport} onSelect={loadPlayer} inputStyle={{ fontSize: '16px', padding: '14px 18px' }} />
        {dataLoading && <div style={{ fontSize: '13px', color: 'var(--text3)', marginTop: '10px' }}>Loading match data...</div>}
      </div>

      {/* ── Player data section ── */}
      {selectedPlayer && (
        <>
          {/* Player profile */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px 28px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '24px' }}>
            {sport === 'Soccer' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`https://api.sofascore.com/api/v1/player/${selectedPlayer.id}/image`}
                alt=""
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border2)', flexShrink: 0 }}
              />
            ) : (
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--card2)', border: '2px solid var(--border2)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px' }}>
                {sport === 'NBA' ? '🏀' : '🏈'}
              </div>
            )}
            <div>
              <div style={{ fontSize: '22px', fontWeight: '800', marginBottom: '4px' }}>{selectedPlayer.name}</div>
              <div style={{ fontSize: '14px', color: 'var(--text2)' }}>{selectedPlayer.team}</div>
              <div style={{ fontSize: '12px', color: 'var(--text3)' }}>{selectedPlayer.position}</div>
            </div>
          </div>

          {/* Stats content */}
          {gameData.length > 0 && (
            <>
              {/* Stat category tabs */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
                {Object.entries(STAT_TABS).map(([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => switchStatTab(key)}
                    className={`stat-cat-tab${activeStatTab === key ? ' active' : ''}`}
                  >
                    {cfg.label}
                  </button>
                ))}
              </div>

              {/* Averages row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
                {statTabCfg.avgStats.map(s => {
                  const vals = gameData.map(g => g.stats[s.key]).filter(v => v !== null && v !== undefined) as number[];
                  const a = vals.length ? vals.reduce((sum, v) => sum + v, 0) / vals.length : null;
                  const display = a === null ? '—' : Number.isInteger(a) ? String(a) : a.toFixed(2);
                  return (
                    <div key={s.key} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px 16px', textAlign: 'center' }}>
                      <div style={{ fontSize: '32px', fontWeight: '800', lineHeight: 1, marginBottom: '6px' }}>{display}</div>
                      <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text3)' }}>{s.label}</div>
                    </div>
                  );
                })}
              </div>

              <StatChart gameData={gameData} cfg={statTabCfg} propLine={propLine} />
              <GamesTable gameData={gameData} cfg={statTabCfg} propLine={propLine} />
            </>
          )}

          {/* ── Prop line + AI Prediction form ── */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px 28px', marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--green)', marginBottom: '16px' }}>Generate AI Prediction</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label className="field-label">League</label>
                <select value={league} onChange={e => setLeague(e.target.value)}>
                  {getLeaguesForSport(sport).map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Prop Type</label>
                <PropSelect sport={sport} value={propType} onChange={setPropType} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label className="field-label">Line</label>
                <input type="number" value={line} onChange={e => { setLine(e.target.value); }} placeholder="2.5" step="0.5" />
              </div>
              <div>
                <label className="field-label">Odds</label>
                <input type="text" value={odds} onChange={e => setOdds(e.target.value)} placeholder="-115" />
              </div>
              <div />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="field-label">Context (matchup, injuries, form, etc.)</label>
              <textarea value={context} onChange={e => setContext(e.target.value)} placeholder="e.g. Facing a team that allows 14 shots per game. Playing at home..." style={{ minHeight: '80px' }} />
            </div>

            <button onClick={generatePrediction} disabled={predicting || !line} className="btn-green">
              {predicting
                ? <><span className="dots"><span style={{ background: '#000' }} /><span style={{ background: '#000' }} /><span style={{ background: '#000' }} /></span> Analyzing...</>
                : '✦ Generate AI Prediction'}
            </button>
          </div>

          {/* ── Prediction result ── */}
          {predError && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '28px 32px', color: 'var(--text3)' }}>
              Error: {predError}
            </div>
          )}

          {prediction && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '28px 32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: '700' }}>{selectedPlayer.name}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text2)', marginTop: '4px' }}>{sport} · {propType} {line}{odds ? ' · ' + odds : ''}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--green)' }}>{prediction.recommendation}</div>
                  <div style={{ marginTop: '6px' }}>
                    <span className={`badge ${prediction.value_rating === 'High Value' ? 'badge-value' : prediction.value_rating === 'Fade' ? 'badge-fade' : 'badge-standard'}`}>
                      {prediction.value_rating}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {prediction.confidence >= 70 ? 'High Confidence' : prediction.confidence >= 50 ? 'Moderate Confidence' : 'Low Confidence'}
                </span>
                <span style={{ fontSize: '22px', fontWeight: '700' }}>{prediction.confidence}%</span>
              </div>
              <div className="conf-bar" style={{ marginBottom: '20px' }}>
                <div className={`conf-fill ${prediction.confidence >= 70 ? 'conf-high' : prediction.confidence >= 50 ? 'conf-med' : 'conf-low'}`} style={{ width: prediction.confidence + '%' }} />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                {prediction.pattern_match && (
                  <span style={{ fontSize: '12px', fontWeight: '600', padding: '4px 12px', borderRadius: '99px',
                    background: prediction.pattern_match === 'High' ? 'var(--green-dim)' : prediction.pattern_match === 'Medium' ? 'var(--yellow-dim)' : 'var(--red-dim)',
                    color: prediction.pattern_match === 'High' ? 'var(--green)' : prediction.pattern_match === 'Medium' ? 'var(--yellow)' : 'var(--red)' }}>
                    Pattern Match: {prediction.pattern_match}
                  </span>
                )}
                {prediction.data_confidence && (
                  <span style={{ fontSize: '12px', fontWeight: '600', padding: '4px 12px', borderRadius: '99px', background: 'rgba(255,255,255,0.06)', color: 'var(--text2)' }}>
                    Data: {prediction.data_confidence}
                  </span>
                )}
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '20px 0' }} />

              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '10px' }}>AI Reasoning</div>
                <div style={{ fontSize: '14px', color: 'var(--text2)', lineHeight: '1.7' }}>{prediction.reasoning}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--green)', marginBottom: '10px' }}>Key Factors</div>
                  {prediction.key_factors.map((f, i) => (
                    <div key={i} style={{ fontSize: '13px', color: 'var(--text2)', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--green)', fontWeight: '700' }}>+ </span>{f}
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--red)', marginBottom: '10px' }}>Risk Factors</div>
                  {prediction.risks.map((r, i) => (
                    <div key={i} style={{ fontSize: '13px', color: 'var(--text2)', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--red)', fontWeight: '700' }}>− </span>{r}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
