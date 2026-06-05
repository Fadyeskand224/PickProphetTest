'use client';
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import PlayerSearch, { PlayerAvatar } from '@/components/PlayerSearch';
import PropSelect from '@/components/PropSelect';
import { Pick, PlayerSearchResult, GameRow, Sport } from '@/types';
import {
  ssPlayerEvents, ssEventPlayerStats, fmtDate,
} from '@/lib/sofascore-client';

const PROP_TO_STAT: Record<string, string> = {
  'Goals Scored': 'goals', 'Anytime Goal Scorer': 'goals',
  'Shots on Target': 'onTargetScoringAttempt', 'Total Shots': 'totalShots',
  'Assists': 'goalAssist', 'Key Passes': 'keyPass',
  'Passes Attempted': 'totalPass', 'Passes Completed': 'accuratePass',
  'Tackles': 'totalTackle', 'Interceptions': 'interceptionWon',
  'Saves': 'saves', 'Dribbles Completed': 'wonContest',
  'Duels Won': 'duelWon', 'Aerial Duels Won': 'aerialWon',
  'Fouls Committed': 'fouls', 'Yellow Card': 'yellowCard',
  'Minutes Played': 'minutesPlayed',
  'Points': 'pts', 'Rebounds': 'reb', '3-Pointers Made': 'fg3m', 'Steals': 'stl', 'Blocks': 'blk',
};

interface SlipBetDraft {
  player: string; propType: string; line: number | ''; direction: 'Over' | 'Under' | 'Yes' | 'No'; odds: string; result: 'win' | 'loss' | 'pending';
}

interface Props {
  sport: Sport;
  picks: Pick[];
  onAddPick: (pick: Omit<Pick, 'id' | 'user_id' | 'created_at'>) => Promise<void>;
  onRemovePick: (id: string) => Promise<void>;
}

const SPORT_COLOR: Record<Sport, string> = { Soccer: '#3dff8f', NBA: '#f5a623', NFL: '#5ba3ff' };

export default function TrainTab({ sport, picks, onAddPick, onRemovePick }: Props) {
  const [trainPlayer, setTrainPlayer] = useState<PlayerSearchResult | null>(null);
  const [trainGames, setTrainGames] = useState<GameRow[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [gamesError, setGamesError] = useState('');
  const [logIdx, setLogIdx] = useState<number | null>(null);
  const [logResult, setLogResult] = useState<'win' | 'loss' | 'pending'>('pending');
  const [logPropType, setLogPropType] = useState('');
  const [logLine, setLogLine] = useState('');
  const [logDirection, setLogDirection] = useState<'Over' | 'Under' | 'Yes' | 'No'>('Over');
  const [logOdds, setLogOdds] = useState('');
  const [logReasoning, setLogReasoning] = useState('');
  const [savingLog, setSavingLog] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [slipStatus, setSlipStatus] = useState('');
  const [slipBets, setSlipBets] = useState<SlipBetDraft[]>([]);
  const [slipLoading, setSlipLoading] = useState(false);

  const wins = picks.filter(p => p.result === 'win').length;
  const settled = picks.filter(p => p.result === 'win' || p.result === 'loss').length;
  const winRate = settled > 0 ? Math.round(wins / settled * 100) : null;

  async function selectTrainPlayer(p: PlayerSearchResult) {
    setTrainPlayer(p);
    setLogIdx(null);
    setTrainGames([]);
    setGamesError('');
    setGamesLoading(true);

    try {
      if (sport === 'Soccer') {
        const evData = await ssPlayerEvents(p.id);
        const events = (evData.events || [])
          .filter((ev: { status?: { type: string } }) => ev.status?.type === 'finished')
          .sort((a: { startTimestamp: number }, b: { startTimestamp: number }) => b.startTimestamp - a.startTimestamp)
          .slice(0, 8);

        if (!events.length) { setGamesError('No recent finished games found.'); setGamesLoading(false); return; }

        const statsResults = await Promise.all(
          events.map((ev: { id: number }) => ssEventPlayerStats(ev.id, p.id))
        );

        const gameRows: GameRow[] = events.map((ev: {
          homeTeam?: { id: number; name: string };
          awayTeam?: { id: number; name: string };
          homeScore?: { current: number };
          awayScore?: { current: number };
          startTimestamp: number;
          id: number;
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
          return {
            date: fmtDate(ev.startTimestamp),
            opponent: opponent || 'Unknown',
            result,
            score: `${myScore}–${oppScore}`,
            ha: isHome ? 'H' : 'A',
            stats,
            event_id: ev.id,
          };
        });

        setTrainGames(gameRows);
      } else {
        // NBA/NFL via server route
        const res = await fetch(`/api/players/events?playerId=${p.id}&sport=${sport}`);
        const data = await res.json();
        setTrainGames(data.events || []);
      }
    } catch (err) {
      setGamesError('Could not load games: ' + String(err));
    } finally {
      setGamesLoading(false);
    }
  }

  function openLogger(idx: number) {
    setLogIdx(idx);
    setLogResult('pending');
    setLogLine('');
    setLogOdds('');
    setLogReasoning('');
  }

  function actualStat(): { val: number } | null {
    if (logIdx === null) return null;
    const g = trainGames[logIdx];
    const key = PROP_TO_STAT[logPropType];
    if (!key || g.stats[key] == null) return null;
    return { val: g.stats[key] as number };
  }

  async function saveLoggedPick() {
    if (logIdx === null || !logLine || !trainPlayer) return;
    const g = trainGames[logIdx];
    const a = actualStat();
    setSavingLog(true);
    await onAddPick({
      player: trainPlayer.name, player_id: String(trainPlayer.id), sport,
      prop_type: logPropType, line: parseFloat(logLine), direction: logDirection,
      odds: logOdds || null, reasoning: logReasoning || (a ? `Actual ${logPropType}: ${a.val}` : null) || null,
      result: logResult, date: g.date, opponent: g.opponent,
      home_away: g.ha, match_result: g.result, score: g.score,
      actual_stat: a?.val ?? null, game_stats: g.stats,
    });
    setSavingLog(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
    setLogIdx(null);
  }

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setSlipPreview(dataUrl);
      setSlipBets([]);
      setSlipStatus('');
      setSlipLoading(true);
      try {
        const base64 = dataUrl.split(',')[1];
        const res = await fetch('/api/ai/read-slip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        const bets: SlipBetDraft[] = (data.bets || []).map((b: { player?: string; propType?: string; line?: number; direction?: string; odds?: string; result?: string }) => ({
          player: b.player || '', propType: b.propType || 'Shots on Target',
          line: b.line ?? '', direction: (b.direction || 'Over') as SlipBetDraft['direction'],
          odds: b.odds || '', result: (b.result || 'pending') as SlipBetDraft['result'],
        }));
        setSlipBets(bets);
        setSlipStatus(`✓ Found ${bets.length} bet${bets.length !== 1 ? 's' : ''}${data.slipNote ? ' · ' + data.slipNote : ''}`);
      } catch (err) {
        setSlipStatus('Error: ' + String(err));
      } finally {
        setSlipLoading(false);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/*': [] }, maxFiles: 1 });

  async function saveSlipBet(idx: number) {
    const b = slipBets[idx];
    if (!b.player || !b.line) return;
    await onAddPick({
      player: b.player, player_id: null, sport,
      prop_type: b.propType, line: Number(b.line), direction: b.direction,
      odds: b.odds || null, reasoning: 'Imported from slip photo', result: b.result,
      date: new Date().toLocaleDateString(), opponent: null,
      home_away: null, match_result: null, score: null,
      actual_stat: null, game_stats: {}, from_slip: true,
    });
    setSlipBets(prev => prev.filter((_, i) => i !== idx));
  }

  const a = actualStat();
  const sportColor = SPORT_COLOR[sport];

  // Group picks by sport for display
  const sportPicks = picks.filter(p => p.sport === sport);
  const otherPicks = picks.filter(p => p.sport !== sport);

  return (
    <div>
      {/* ── Stats summary ── */}
      {picks.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
          {[
            { num: picks.length, lbl: 'Total Picks' },
            { num: wins, lbl: 'Wins' },
            { num: picks.filter(p => p.result === 'loss').length, lbl: 'Losses' },
            { num: winRate !== null ? winRate + '%' : '—', lbl: 'Win Rate' },
          ].map(({ num, lbl }) => (
            <div key={lbl} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '26px', fontWeight: '800', color: lbl === 'Win Rate' && winRate !== null ? (winRate >= 55 ? 'var(--green)' : winRate >= 45 ? 'var(--yellow)' : 'var(--red)') : 'var(--text)' }}>{num}</div>
              <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)', marginTop: '4px' }}>{lbl}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Step 1: Player search ── */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px 28px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: sportColor }} />
          <label className="field-label" style={{ marginBottom: 0 }}>Step 1 — Search a {sport} player</label>
        </div>
        <PlayerSearch sport={sport} onSelect={selectTrainPlayer} inputStyle={{ fontSize: '15px', padding: '13px 16px' }} />
        {gamesError && <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--red)' }}>{gamesError}</div>}
      </div>

      {/* ── Slip Upload ── */}
      <div style={{ background: 'var(--card)', border: '1px dashed var(--border2)', borderRadius: '16px', padding: '24px 28px', marginBottom: '16px' }}>
        <div style={{ marginBottom: '12px' }}>
          <label className="field-label" style={{ color: 'var(--green)', marginBottom: '4px' }}>📸 Upload a Bet Slip</label>
          <div style={{ fontSize: '13px', color: 'var(--text3)' }}>AI reads your slip photo — edit the results, then save to training data</div>
        </div>
        {!slipPreview ? (
          <div {...getRootProps()} style={{ border: `2px dashed ${isDragActive ? 'var(--green)' : 'var(--border2)'}`, borderRadius: '12px', padding: '28px', textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.2s' }}>
            <input {...getInputProps()} />
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🖼️</div>
            <div style={{ fontSize: '14px', color: 'var(--text2)', fontWeight: '500' }}>{isDragActive ? 'Drop it here!' : 'Click or drag a slip photo here'}</div>
            <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '4px' }}>JPG, PNG, screenshot — any image works</div>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={slipPreview} alt="slip" style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px' }} />
            <button onClick={() => { setSlipPreview(null); setSlipBets([]); setSlipStatus(''); }} style={{ marginTop: '12px', background: 'var(--red-dim)', color: 'var(--red)', border: '1px solid var(--red)', borderRadius: '8px', padding: '7px 16px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
              🗑 Remove photo
            </button>
          </div>
        )}
        {slipLoading && <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: '6px' }}><span className="dots"><span style={{ background: 'var(--green)' }} /><span style={{ background: 'var(--green)' }} /><span style={{ background: 'var(--green)' }} /></span> Reading your slip with AI...</div>}
        {slipStatus && !slipLoading && <div style={{ marginTop: '12px', fontSize: '13px', color: slipStatus.startsWith('Error') ? 'var(--red)' : 'var(--green)' }}>{slipStatus}</div>}

        {slipBets.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <label className="field-label" style={{ color: 'var(--green)', marginBottom: 0 }}>Edit bets below, then save each one:</label>
              <button onClick={() => setSlipBets(prev => [...prev, { player: '', propType: 'Shots on Target', line: '', direction: 'Over', odds: '', result: 'pending' }])} style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: '7px', padding: '5px 12px', fontSize: '12px', color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit' }}>+ Add bet</button>
            </div>
            {slipBets.map((b, i) => (
              <div key={i} style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 18px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--green)' }}>Bet {i + 1}</div>
                  <button onClick={() => setSlipBets(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: '18px' }}>✕</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <div><label className="field-label">Player Name</label>
                    <input type="text" value={b.player} onChange={e => setSlipBets(prev => prev.map((x, j) => j === i ? { ...x, player: e.target.value } : x))} placeholder="Player name" style={{ height: '36px' }} /></div>
                  <div><label className="field-label">Prop Type</label>
                    <PropSelect sport={sport} value={b.propType} onChange={v => setSlipBets(prev => prev.map((x, j) => j === i ? { ...x, propType: v } : x))} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                  <div><label className="field-label">Line</label><input type="number" value={b.line} onChange={e => setSlipBets(prev => prev.map((x, j) => j === i ? { ...x, line: e.target.value as unknown as number } : x))} placeholder="2.5" step="0.5" style={{ height: '36px' }} /></div>
                  <div><label className="field-label">Direction</label><select value={b.direction} onChange={e => setSlipBets(prev => prev.map((x, j) => j === i ? { ...x, direction: e.target.value as SlipBetDraft['direction'] } : x))} style={{ height: '36px' }}><option>Over</option><option>Under</option><option>Yes</option><option>No</option></select></div>
                  <div><label className="field-label">Result</label><select value={b.result} onChange={e => setSlipBets(prev => prev.map((x, j) => j === i ? { ...x, result: e.target.value as SlipBetDraft['result'] } : x))} style={{ height: '36px' }}><option value="pending">Pending</option><option value="win">Win ✓</option><option value="loss">Loss ✗</option></select></div>
                  <div><label className="field-label">Odds</label><input type="text" value={b.odds} onChange={e => setSlipBets(prev => prev.map((x, j) => j === i ? { ...x, odds: e.target.value } : x))} placeholder="-115" style={{ height: '36px' }} /></div>
                </div>
                <button onClick={() => saveSlipBet(i)} className="btn-green" style={{ fontSize: '13px', padding: '9px 20px' }}>+ Save to Training Data</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Step 2: Recent games ── */}
      {trainPlayer && (
        <div style={{ background: 'var(--card)', border: `1px solid var(--border)`, borderRadius: '16px', padding: '24px 28px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
            <div style={{ border: `2px solid ${sportColor}`, borderRadius: '50%' }}>
              <PlayerAvatar id={trainPlayer.id} sport={sport} size={48} />
            </div>
            <div>
              <div style={{ fontSize: '17px', fontWeight: '700' }}>{trainPlayer.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>{trainPlayer.team}{trainPlayer.position ? ' · ' + trainPlayer.position : ''}</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: sportColor }} />
            <label className="field-label" style={{ marginBottom: 0 }}>Step 2 — Click a game to log a prop result</label>
          </div>

          {gamesLoading && <div style={{ color: 'var(--text3)', fontSize: '14px', padding: '20px 0', display: 'flex', alignItems: 'center', gap: '8px' }}><span className="dots"><span style={{ background: 'var(--text3)' }} /><span style={{ background: 'var(--text3)' }} /><span style={{ background: 'var(--text3)' }} /></span> Loading recent games...</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {trainGames.map((g, i) => {
              const resColor = g.result === 'W' ? 'var(--green)' : g.result === 'L' ? 'var(--red)' : 'var(--text3)';
              const logged = picks.filter(p => p.opponent === g.opponent && p.date === g.date && p.player === trainPlayer.name).length;
              const isSelected = logIdx === i;
              return (
                <div key={i} onClick={() => openLogger(i)} style={{ cursor: 'pointer', background: isSelected ? 'var(--green-dim)' : 'var(--card2)', border: `1px solid ${isSelected ? 'var(--green)' : 'var(--border)'}`, borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.15s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    {/* H/A + Result badge */}
                    <div style={{ textAlign: 'center', minWidth: '42px' }}>
                      <div style={{ fontSize: '9px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>{g.ha === 'H' ? 'HOME' : 'AWAY'}</div>
                      <div style={{ fontSize: '13px', fontWeight: '800', color: resColor, background: `${resColor}22`, padding: '2px 8px', borderRadius: '6px' }}>{g.result}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>vs {g.opponent}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>{g.date} · <span style={{ color: resColor }}>{g.score}</span></div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {logged > 0 && <span style={{ fontSize: '11px', color: 'var(--green)', fontWeight: '600', background: 'var(--green-dim)', padding: '2px 8px', borderRadius: '4px' }}>{logged} logged</span>}
                    <span style={{ color: 'var(--green)', fontSize: '20px', fontWeight: '300' }}>+</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Inline prop logger ── */}
      {logIdx !== null && trainGames[logIdx] && (
        <div style={{ background: 'var(--card)', border: '2px solid var(--green)', borderRadius: '16px', padding: '24px 28px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <label className="field-label" style={{ color: 'var(--green)', marginBottom: '6px' }}>Log Prop Result</label>
              <div style={{ fontSize: '14px', fontWeight: '600' }}>
                {trainPlayer?.name} vs <strong>{trainGames[logIdx].opponent}</strong>
                &nbsp;
                <span style={{ color: trainGames[logIdx].result === 'W' ? 'var(--green)' : trainGames[logIdx].result === 'L' ? 'var(--red)' : 'var(--text3)', padding: '2px 8px', borderRadius: '6px', fontSize: '13px', background: trainGames[logIdx].result === 'W' ? 'var(--green-dim)' : trainGames[logIdx].result === 'L' ? 'var(--red-dim)' : 'rgba(255,255,255,0.06)' }}>
                  {trainGames[logIdx].result} {trainGames[logIdx].score}
                </span>
                &nbsp;<span style={{ color: 'var(--text3)', fontSize: '12px' }}>{trainGames[logIdx].date} · {trainGames[logIdx].ha === 'H' ? 'Home' : 'Away'}</span>
              </div>
            </div>
            <button onClick={() => setLogIdx(null)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: '20px' }}>✕</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '14px' }}>
            <div><label className="field-label">Prop Type</label><PropSelect sport={sport} value={logPropType} onChange={setLogPropType} /></div>
            <div><label className="field-label">Line</label><input type="number" value={logLine} onChange={e => setLogLine(e.target.value)} placeholder="e.g. 2.5" step="0.5" /></div>
            <div><label className="field-label">Direction</label><select value={logDirection} onChange={e => setLogDirection(e.target.value as typeof logDirection)}><option>Over</option><option>Under</option><option>Yes</option><option>No</option></select></div>
          </div>

          {a && (
            <div style={{ background: 'var(--green-dim)', border: '1px solid var(--green)', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', fontSize: '13px' }}>
              <strong style={{ color: 'var(--text)' }}>Actual stat this game:</strong>{' '}
              <span style={{ color: 'var(--green)', fontWeight: '800', fontSize: '16px' }}>{a.val}</span>
              {logLine && <span style={{ color: 'var(--text2)', marginLeft: '8px' }}>{logPropType} · {a.val >= parseFloat(logLine) ? '✅ Hit Over' : '❌ Missed Under'}</span>}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '14px' }}>
            <div>
              <label className="field-label">Result</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                {(['win', 'loss', 'pending'] as const).map(r => (
                  <button key={r} onClick={() => setLogResult(r)} style={{ padding: '10px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '13px', fontFamily: 'inherit', transition: 'all 0.15s', border: `1px solid ${logResult === r ? (r === 'win' ? 'var(--green)' : r === 'loss' ? 'var(--red)' : 'var(--border2)') : 'var(--border)'}`, background: logResult === r ? (r === 'win' ? 'var(--green-dim)' : r === 'loss' ? 'var(--red-dim)' : 'rgba(255,255,255,0.08)') : 'var(--card2)', color: logResult === r ? (r === 'win' ? 'var(--green)' : r === 'loss' ? 'var(--red)' : 'var(--text)') : 'var(--text2)' }}>
                    {r === 'win' ? '✓ Win' : r === 'loss' ? '✗ Loss' : '⏳ TBD'}
                  </button>
                ))}
              </div>
            </div>
            <div><label className="field-label">Odds (optional)</label><input type="text" value={logOdds} onChange={e => setLogOdds(e.target.value)} placeholder="-115" /></div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label className="field-label">Why did you take this? (helps AI learn)</label>
            <textarea value={logReasoning} onChange={e => setLogReasoning(e.target.value)} placeholder="e.g. Averaging 4+ shots at home, facing weak defense..." style={{ minHeight: '70px' }} />
          </div>

          <button onClick={saveLoggedPick} disabled={savingLog || !logLine} className="btn-green" style={{ background: savedFlash ? '#22c55e' : '' }}>
            {savingLog ? 'Saving...' : savedFlash ? '✓ Saved!' : '+ Save to Training Data'}
          </button>
        </div>
      )}

      {/* ── Saved picks ── */}
      <div>
        {picks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text3)', fontSize: '14px' }}>
            No picks logged yet. Search a player above to get started.
          </div>
        ) : (
          <>
            {/* Current sport picks */}
            {sportPicks.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: sportColor }} />
                  <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text3)' }}>{sport} Picks ({sportPicks.length})</div>
                </div>
                {sportPicks.slice(0, 15).map(p => <PickCard key={p.id} pick={p} onRemove={onRemovePick} />)}
              </div>
            )}

            {/* Other sport picks */}
            {otherPicks.length > 0 && (
              <div>
                <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '12px' }}>Other Sports ({otherPicks.length})</div>
                {otherPicks.slice(0, 10).map(p => <PickCard key={p.id} pick={p} onRemove={onRemovePick} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PickCard({ pick: p, onRemove }: { pick: Pick; onRemove: (id: string) => Promise<void> }) {
  const sportColor: Record<string, string> = { Soccer: '#3dff8f', NBA: '#f5a623', NFL: '#5ba3ff' };
  const color = sportColor[p.sport] || 'var(--text3)';

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', transition: 'border-color 0.2s' }}
      onMouseOver={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
      onMouseOut={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Top row: sport badge + player + date */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', background: `${color}22`, color, letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0 }}>{p.sport}</span>
          <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)' }}>{p.player}</span>
          <span style={{ fontSize: '11px', color: 'var(--text3)', marginLeft: 'auto' }}>{p.date}{p.opponent ? ' vs ' + p.opponent : ''}</span>
        </div>

        {/* The actual pick */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text)' }}>
            <span style={{ color: p.direction === 'Over' || p.direction === 'Yes' ? 'var(--green)' : 'var(--red)' }}>{p.direction}</span>
            {' '}{p.line}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text2)' }}>{p.prop_type}</div>
          {p.odds && <div style={{ fontSize: '12px', color: 'var(--text3)', background: 'var(--card2)', padding: '2px 8px', borderRadius: '4px' }}>{p.odds}</div>}
        </div>

        {/* Bottom row: game context */}
        {(p.home_away || p.actual_stat != null || p.match_result) && (
          <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text3)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {p.home_away && <span>{p.home_away === 'H' ? 'Home' : 'Away'}</span>}
            {p.match_result && <span>Game: <span style={{ fontWeight: '600', color: p.match_result === 'W' ? 'var(--green)' : p.match_result === 'L' ? 'var(--red)' : 'var(--text3)' }}>{p.match_result}</span>{p.score ? ' ' + p.score : ''}</span>}
            {p.actual_stat != null && <span>Actual: <span style={{ fontWeight: '600', color: 'var(--text)' }}>{p.actual_stat}</span></span>}
          </div>
        )}

        {p.reasoning && (
          <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text3)', lineHeight: '1.5', fontStyle: 'italic' }}>
            &ldquo;{p.reasoning.slice(0, 100)}{p.reasoning.length > 100 ? '…' : ''}&rdquo;
          </div>
        )}
      </div>

      {/* Right side: result + remove */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', marginLeft: '16px', flexShrink: 0 }}>
        <span style={{ fontSize: '12px', fontWeight: '700', padding: '4px 12px', borderRadius: '99px', letterSpacing: '0.04em', textTransform: 'uppercase', background: p.result === 'win' ? 'var(--green-dim)' : p.result === 'loss' ? 'var(--red-dim)' : 'rgba(255,255,255,0.06)', color: p.result === 'win' ? 'var(--green)' : p.result === 'loss' ? 'var(--red)' : 'var(--text2)' }}>
          {p.result === 'win' ? '✓ Win' : p.result === 'loss' ? '✗ Loss' : '⏳ Pending'}
        </span>
        <button onClick={() => onRemove(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: '12px', fontFamily: 'inherit', transition: 'color 0.2s' }}
          onMouseOver={e => (e.currentTarget.style.color = 'var(--red)')}
          onMouseOut={e => (e.currentTarget.style.color = 'var(--text3)')}>
          remove
        </button>
      </div>
    </div>
  );
}
