'use client';
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import PlayerSearch from '@/components/PlayerSearch';
import PropSelect from '@/components/PropSelect';
import { Pick, PlayerSearchResult, GameRow, Sport } from '@/types';

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
  // NBA
  'Points': 'pts', 'Rebounds': 'reb', 'Assists (NBA)': 'ast',
  'Steals': 'stl', 'Blocks': 'blk', '3-Pointers Made': 'fg3m',
};

interface Props {
  sport: Sport;
  picks: Pick[];
  onAddPick: (pick: Omit<Pick, 'id' | 'user_id' | 'created_at'>) => Promise<void>;
  onRemovePick: (id: string) => Promise<void>;
}

interface SlipBetDraft {
  player: string;
  propType: string;
  line: number | '';
  direction: 'Over' | 'Under' | 'Yes' | 'No';
  odds: string;
  result: 'win' | 'loss' | 'pending';
}

export default function TrainTab({ sport, picks, onAddPick, onRemovePick }: Props) {
  const [trainPlayer, setTrainPlayer] = useState<PlayerSearchResult | null>(null);
  const [trainGames, setTrainGames] = useState<GameRow[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [logIdx, setLogIdx] = useState<number | null>(null);
  const [logResult, setLogResult] = useState<'win' | 'loss' | 'pending'>('pending');
  const [logPropType, setLogPropType] = useState('');
  const [logLine, setLogLine] = useState('');
  const [logDirection, setLogDirection] = useState<'Over' | 'Under' | 'Yes' | 'No'>('Over');
  const [logOdds, setLogOdds] = useState('');
  const [logReasoning, setLogReasoning] = useState('');
  const [savingLog, setSavingLog] = useState(false);

  // Slip upload
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
    setGamesLoading(true);
    try {
      const res = await fetch(`/api/players/events?playerId=${p.id}&sport=${sport}&teamId=${(p as unknown as { teamId?: string }).teamId || ''}`);
      const data = await res.json();
      setTrainGames(data.events || []);
    } catch {
      // ignore
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

  function actualStatForLog(): { key: string; val: number } | null {
    if (logIdx === null) return null;
    const g = trainGames[logIdx];
    const key = PROP_TO_STAT[logPropType];
    if (!key || g.stats[key] == null) return null;
    return { key, val: g.stats[key] as number };
  }

  async function saveLoggedPick() {
    if (logIdx === null || !logLine) return;
    const g = trainGames[logIdx];
    const actual = actualStatForLog();
    const autoReasoning = logReasoning || (actual ? `Actual ${logPropType}: ${actual.val}` : '');
    setSavingLog(true);
    await onAddPick({
      player: trainPlayer!.name,
      player_id: String(trainPlayer!.id),
      sport,
      prop_type: logPropType,
      line: parseFloat(logLine),
      direction: logDirection,
      odds: logOdds || null,
      reasoning: autoReasoning || null,
      result: logResult,
      date: g.date,
      opponent: g.opponent,
      home_away: g.ha,
      match_result: g.result,
      score: g.score,
      actual_stat: actual?.val ?? null,
      game_stats: g.stats,
    });
    setSavingLog(false);
    setLogIdx(null);
  }

  // Slip handling
  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setSlipPreview(dataUrl);
      setSlipBets([]);
      setSlipStatus('');
      await readSlipWithAI(dataUrl, file.type);
    };
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 1,
  });

  async function readSlipWithAI(dataUrl: string, mimeType: string) {
    setSlipLoading(true);
    setSlipStatus('');
    try {
      const base64 = dataUrl.split(',')[1];
      const res = await fetch('/api/ai/read-slip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const bets: SlipBetDraft[] = (data.bets || []).map((b: { player?: string; propType?: string; line?: number; direction?: string; odds?: string; result?: string }) => ({
        player: b.player || '',
        propType: b.propType || 'Shots on Target',
        line: b.line ?? '',
        direction: (b.direction || 'Over') as SlipBetDraft['direction'],
        odds: b.odds || '',
        result: (b.result || 'pending') as SlipBetDraft['result'],
      }));
      setSlipBets(bets);
      setSlipStatus(`✓ Found ${bets.length} bet${bets.length !== 1 ? 's' : ''}${data.slipNote ? ' · ' + data.slipNote : ''}`);
    } catch (err) {
      setSlipStatus('Error: ' + String(err));
    } finally {
      setSlipLoading(false);
    }
  }

  async function saveSlipBet(idx: number) {
    const b = slipBets[idx];
    if (!b.player || !b.line) return;
    await onAddPick({
      player: b.player, player_id: null, sport,
      prop_type: b.propType, line: Number(b.line),
      direction: b.direction, odds: b.odds || null,
      reasoning: 'Imported from slip photo', result: b.result,
      date: new Date().toLocaleDateString(), opponent: null,
      home_away: null, match_result: null, score: null,
      actual_stat: null, game_stats: {}, from_slip: true,
    });
    setSlipBets(prev => prev.filter((_, i) => i !== idx));
  }

  const actual = actualStatForLog();

  return (
    <div>
      {/* ── Stats summary ── */}
      {picks.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '16px' }}>
          {[
            { num: picks.length, lbl: 'Total Picks' },
            { num: wins, lbl: 'Wins' },
            { num: winRate !== null ? winRate + '%' : '—', lbl: 'Win Rate' },
          ].map(({ num, lbl }) => (
            <div key={lbl} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: '800' }}>{num}</div>
              <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)', marginTop: '4px' }}>{lbl}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Step 1: Player search ── */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '28px 32px', marginBottom: '16px' }}>
        <label className="field-label" style={{ marginBottom: '10px' }}>Step 1 — Search a player to log their props</label>
        <PlayerSearch
          sport={sport}
          onSelect={selectTrainPlayer}
          inputStyle={{ fontSize: '15px', padding: '13px 16px' }}
        />
      </div>

      {/* ── Slip Upload ── */}
      <div style={{ background: 'var(--card)', border: '1px dashed var(--border2)', borderRadius: '16px', padding: '24px 28px', marginBottom: '16px' }}>
        <div style={{ marginBottom: '12px' }}>
          <label className="field-label" style={{ color: 'var(--green)', marginBottom: '4px' }}>📸 Upload a Slip Photo</label>
          <div style={{ fontSize: '13px', color: 'var(--text3)' }}>Snap or screenshot your bet slip — AI reads it, edit if needed, then save</div>
        </div>

        {!slipPreview ? (
          <div
            {...getRootProps()}
            style={{
              border: `2px dashed ${isDragActive ? 'var(--green)' : 'var(--border2)'}`,
              borderRadius: '12px',
              padding: '28px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'border-color 0.2s',
            }}
          >
            <input {...getInputProps()} />
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🖼️</div>
            <div style={{ fontSize: '14px', color: 'var(--text2)', fontWeight: '500' }}>
              {isDragActive ? 'Drop it here!' : 'Click or drag a slip photo here'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '4px' }}>JPG, PNG, screenshot — any image works</div>
          </div>
        ) : (
          <div style={{ position: 'relative', textAlign: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={slipPreview} alt="slip" style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px' }} />
            <button
              onClick={() => { setSlipPreview(null); setSlipBets([]); setSlipStatus(''); }}
              style={{ marginTop: '12px', background: 'var(--red-dim)', color: 'var(--red)', border: '1px solid var(--red)', borderRadius: '8px', padding: '7px 16px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              🗑 Remove photo
            </button>
          </div>
        )}

        {slipLoading && (
          <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="dots"><span style={{ background: 'var(--green)' }} /><span style={{ background: 'var(--green)' }} /><span style={{ background: 'var(--green)' }} /></span>
            Reading your slip...
          </div>
        )}
        {slipStatus && !slipLoading && (
          <div style={{ marginTop: '12px', fontSize: '13px', color: slipStatus.startsWith('Error') ? 'var(--red)' : 'var(--green)' }}>{slipStatus}</div>
        )}

        {slipBets.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <label className="field-label" style={{ color: 'var(--green)', marginBottom: 0 }}>Bets found — edit if needed, then save:</label>
              <button
                onClick={() => setSlipBets(prev => [...prev, { player: '', propType: 'Shots on Target', line: '', direction: 'Over', odds: '', result: 'pending' }])}
                style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: '7px', padding: '5px 12px', fontSize: '12px', color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                + Add another bet
              </button>
            </div>
            {slipBets.map((b, i) => (
              <div key={i} style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 18px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--green)' }}>Bet {i + 1}</div>
                  <button onClick={() => setSlipBets(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: '18px' }}>✕</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <label className="field-label">Player Name</label>
                    <input type="text" value={b.player} onChange={e => setSlipBets(prev => prev.map((x, j) => j === i ? { ...x, player: e.target.value } : x))} placeholder="Player name" style={{ height: '36px' }} />
                  </div>
                  <div>
                    <label className="field-label">Prop Type</label>
                    <PropSelect sport={sport} value={b.propType} onChange={v => setSlipBets(prev => prev.map((x, j) => j === i ? { ...x, propType: v } : x))} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                  <div>
                    <label className="field-label">Line</label>
                    <input type="number" value={b.line} onChange={e => setSlipBets(prev => prev.map((x, j) => j === i ? { ...x, line: e.target.value as unknown as number } : x))} placeholder="2.5" step="0.5" style={{ height: '36px' }} />
                  </div>
                  <div>
                    <label className="field-label">Direction</label>
                    <select value={b.direction} onChange={e => setSlipBets(prev => prev.map((x, j) => j === i ? { ...x, direction: e.target.value as SlipBetDraft['direction'] } : x))} style={{ height: '36px' }}>
                      <option>Over</option><option>Under</option><option>Yes</option><option>No</option>
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Result</label>
                    <select value={b.result} onChange={e => setSlipBets(prev => prev.map((x, j) => j === i ? { ...x, result: e.target.value as SlipBetDraft['result'] } : x))} style={{ height: '36px' }}>
                      <option value="pending">Pending</option>
                      <option value="win">Win ✓</option>
                      <option value="loss">Loss ✗</option>
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Odds</label>
                    <input type="text" value={b.odds} onChange={e => setSlipBets(prev => prev.map((x, j) => j === i ? { ...x, odds: e.target.value } : x))} placeholder="-115" style={{ height: '36px' }} />
                  </div>
                </div>
                <button onClick={() => saveSlipBet(i)} className="btn-green" style={{ fontSize: '13px', padding: '9px 20px' }}>+ Save to Training Data</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Step 2: Recent games ── */}
      {trainPlayer && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '28px 32px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
            {sport === 'Soccer' && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`https://api.sofascore.com/api/v1/player/${trainPlayer.id}/image`}
                alt=""
                style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border2)' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            <div>
              <div style={{ fontSize: '17px', fontWeight: '700' }}>{trainPlayer.name}{trainPlayer.team ? ' · ' + trainPlayer.team : ''}</div>
              <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>{trainPlayer.position}</div>
            </div>
          </div>
          <label className="field-label" style={{ marginBottom: '10px' }}>Step 2 — Click a game to log a prop result</label>

          {gamesLoading && <div style={{ color: 'var(--text3)', fontSize: '14px', padding: '20px 0' }}>Loading recent games...</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {trainGames.map((g, i) => {
              const resClass = g.result === 'W' ? 'result-w' : g.result === 'L' ? 'result-l' : 'result-d';
              const logged = picks.filter(p => p.opponent === g.opponent && p.date === g.date && p.player === trainPlayer.name).length;
              return (
                <div
                  key={i}
                  onClick={() => openLogger(i)}
                  style={{ cursor: 'pointer', background: 'var(--card2)', border: `1px solid ${logIdx === i ? 'var(--green)' : 'var(--border)'}`, borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'border-color 0.15s' }}
                  onMouseOver={e => { if (logIdx !== i) (e.currentTarget as HTMLElement).style.borderColor = 'var(--green)'; }}
                  onMouseOut={e => { if (logIdx !== i) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ textAlign: 'center', minWidth: '36px' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{g.ha}</div>
                      <span className={resClass} style={{ fontSize: '13px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px' }}>{g.result}</span>
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>vs {g.opponent}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>{g.date} · {g.score}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {logged > 0 && <span style={{ fontSize: '11px', color: 'var(--green)', fontWeight: '600' }}>{logged} logged</span>}
                    <span style={{ color: 'var(--green)', fontSize: '18px', fontWeight: '300' }}>+</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Inline prop logger ── */}
      {logIdx !== null && trainGames[logIdx] && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--green)', borderRadius: '16px', padding: '28px 32px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <label className="field-label" style={{ color: 'var(--green)', marginBottom: '4px' }}>Log Prop Result</label>
              <div style={{ fontSize: '14px', fontWeight: '600' }}>
                vs <strong>{trainGames[logIdx].opponent}</strong>
                &nbsp;
                <span className={trainGames[logIdx].result === 'W' ? 'result-w' : trainGames[logIdx].result === 'L' ? 'result-l' : 'result-d'}
                  style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '13px' }}>
                  {trainGames[logIdx].result} {trainGames[logIdx].score}
                </span>
                &nbsp;
                <span style={{ color: 'var(--text3)', fontSize: '12px' }}>{trainGames[logIdx].date} · {trainGames[logIdx].ha === 'H' ? 'Home' : 'Away'}</span>
              </div>
            </div>
            <button onClick={() => setLogIdx(null)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: '18px' }}>✕</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '14px' }}>
            <div>
              <label className="field-label">Prop Type</label>
              <PropSelect sport={sport} value={logPropType} onChange={setLogPropType} />
            </div>
            <div>
              <label className="field-label">Line</label>
              <input type="number" value={logLine} onChange={e => setLogLine(e.target.value)} placeholder="e.g. 2.5" step="0.5" />
            </div>
            <div>
              <label className="field-label">Direction</label>
              <select value={logDirection} onChange={e => setLogDirection(e.target.value as typeof logDirection)}>
                <option>Over</option><option>Under</option><option>Yes</option><option>No</option>
              </select>
            </div>
          </div>

          {actual && (
            <div style={{ background: 'var(--card2)', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', fontSize: '13px', color: 'var(--text2)' }}>
              <strong style={{ color: 'var(--text)' }}>Actual stat this game:</strong>{' '}
              <span style={{ color: 'var(--green)', fontWeight: '700' }}>{actual.val}</span>
              {logLine && (
                <span> {logPropType} · {actual.val >= parseFloat(logLine) ? '✅ Hit (Over)' : '❌ Missed (Under)'}</span>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '14px' }}>
            <div>
              <label className="field-label">Result</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                {(['win', 'loss', 'pending'] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => setLogResult(r)}
                    style={{
                      padding: '10px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', fontFamily: 'inherit', transition: 'all 0.15s',
                      border: `1px solid ${logResult === r ? (r === 'win' ? 'var(--green)' : r === 'loss' ? 'var(--red)' : 'var(--border2)') : 'var(--border)'}`,
                      background: logResult === r ? (r === 'win' ? 'var(--green-dim)' : r === 'loss' ? 'var(--red-dim)' : 'rgba(255,255,255,0.08)') : 'var(--card2)',
                      color: logResult === r ? (r === 'win' ? 'var(--green)' : r === 'loss' ? 'var(--red)' : 'var(--text)') : 'var(--text2)',
                    }}
                  >
                    {r === 'win' ? '✓ Win' : r === 'loss' ? '✗ Loss' : '⏳ TBD'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="field-label">Odds (optional)</label>
              <input type="text" value={logOdds} onChange={e => setLogOdds(e.target.value)} placeholder="-115" />
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label className="field-label">Why did you take this? (optional — helps AI learn)</label>
            <textarea value={logReasoning} onChange={e => setLogReasoning(e.target.value)} placeholder="e.g. Averaging 4+ shots at home, facing weak defense..." style={{ minHeight: '70px' }} />
          </div>

          <button onClick={saveLoggedPick} disabled={savingLog || !logLine} className="btn-green">
            {savingLog ? '✓ Saving...' : '+ Save to Training Data'}
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
            <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '12px' }}>
              Saved Training Data ({picks.length} picks)
            </div>
            {picks.slice(0, 20).map(p => (
              <div key={p.id} className="pick-item">
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '4px' }}>
                    {p.player} · {p.date}{p.opponent ? ' vs ' + p.opponent : ''}
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: '600' }}>{p.direction} {p.line} {p.prop_type}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text2)', marginTop: '3px' }}>
                    {p.home_away ? p.home_away + ' · ' : ''}{p.match_result ? 'Game: ' + p.match_result + ' · ' : ''}
                    {p.actual_stat != null ? 'Actual: ' + p.actual_stat : ''}{p.odds ? ' · ' + p.odds : ''}
                  </div>
                  {p.reasoning && (
                    <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '6px', lineHeight: '1.5' }}>
                      {p.reasoning.slice(0, 120)}{p.reasoning.length > 120 ? '…' : ''}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', marginLeft: '16px' }}>
                  <span className={`badge ${p.result === 'win' ? 'badge-win' : p.result === 'loss' ? 'badge-loss' : 'badge-pending'}`}>
                    {p.result === 'win' ? 'Win' : p.result === 'loss' ? 'Loss' : 'Pending'}
                  </span>
                  <button onClick={() => onRemovePick(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: '12px', fontFamily: 'inherit', transition: 'color 0.2s' }}
                    onMouseOver={e => (e.currentTarget.style.color = 'var(--red)')}
                    onMouseOut={e => (e.currentTarget.style.color = 'var(--text3)')}>
                    remove
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
