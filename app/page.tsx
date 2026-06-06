'use client';
import { useState, useEffect } from 'react';
import Nav from '@/components/Nav';
import TrainTab from '@/components/tabs/TrainTab';
import PredictTab from '@/components/tabs/PredictTab';
import HistoryTab from '@/components/tabs/HistoryTab';
import ChatTab from '@/components/tabs/ChatTab';
import SportTheme, { getSportTheme } from '@/components/SportTheme';
import { useAuth } from '@/lib/auth';
import { Pick, Sport } from '@/types';
import { apiGetPicks, apiSavePick, apiDeletePick, localGetPicks, localSavePicks } from '@/lib/picks';

type Tab = 'train' | 'predict' | 'history' | 'chat';

export default function Home() {
  const { user } = useAuth();
  const [sport, setSport] = useState<Sport>('Soccer');
  const [activeTab, setActiveTab] = useState<Tab>('train');
  const [picks, setPicks] = useState<Pick[]>([]);
  const [picksLoading, setPicksLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setPicksLoading(true);
      apiGetPicks(user.id)
        .then(setPicks)
        .finally(() => setPicksLoading(false));
    } else {
      setPicks(localGetPicks());
    }
  }, [user]);

  useEffect(() => {
    if (!user) localSavePicks(picks);
  }, [picks, user]);

  async function addPick(pick: Omit<Pick, 'id' | 'user_id' | 'created_at'>) {
    if (user) {
      const saved = await apiSavePick(user.id, pick);
      if (saved) setPicks(prev => [saved, ...prev]);
    } else {
      const newPick: Pick = { ...pick, id: String(Date.now()) };
      setPicks(prev => [newPick, ...prev]);
    }
  }

  async function removePick(id: string) {
    if (user) await apiDeletePick(user.id, id);
    setPicks(prev => prev.filter(p => p.id !== id));
  }

  const theme = getSportTheme(sport);

  return (
    <>
      <SportTheme sport={sport} />
      <Nav sport={sport} onSportChange={setSport} />

      {/* Hero */}
      <div style={{ padding: '56px 40px 40px', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ fontSize: '12px', fontWeight: '600', letterSpacing: '0.12em', color: 'var(--green)', marginBottom: '16px', textTransform: 'uppercase' }}>
          // The Engine
        </div>
        <h1 style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: '800', lineHeight: '1.1' }}>
          Your AI <span style={{ color: 'var(--green)' }}>{theme.label} Analyst</span>
        </h1>
        <p style={{ marginTop: '16px', fontSize: '16px', color: 'var(--text2)', maxWidth: '560px', lineHeight: '1.6' }}>
          Real-time stats &amp; live odds from PrizePicks, DraftKings, FanDuel and more —
          combined with your personal pick history to generate sharp AI predictions.
        </p>
      </div>

      {/* App */}
      <div id="app" style={{ maxWidth: '900px', margin: '0 auto 60px', padding: '0 40px' }}>

        {!user && (
          <div style={{ background: 'var(--yellow-dim)', border: '1px solid var(--yellow)', borderRadius: '12px', padding: '12px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '16px' }}>💡</span>
            <span style={{ fontSize: '13px', color: 'var(--text2)' }}>
              Sign in to sync your picks across devices. Currently saving locally to this browser.
            </span>
          </div>
        )}

        {/* Sport banner */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', background: 'var(--green-dim)', border: '1px solid var(--green)', borderRadius: '10px', marginBottom: '20px' }}>
          <span style={{ fontSize: '20px' }}>{theme.icon}</span>
          <span style={{ fontSize: '13px', fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--green)' }}>{theme.label}</span>
          <span style={{ fontSize: '12px', color: 'var(--text3)', marginLeft: 'auto' }}>Switch sport in the nav above</span>
        </div>

        {/* Tabs */}
        <div className="tab-bar">
          {([
            { id: 'train', label: 'Train the Model' },
            { id: 'predict', label: 'Get Prediction' },
            { id: 'history', label: 'Pick History' },
            { id: 'chat', label: '✦ Ask AI', green: true },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`tab-btn${activeTab === t.id ? ' active' : ''}`}
              style={'green' in t && t.green && activeTab !== t.id ? { color: 'var(--green)' } : undefined}
            >
              {t.label}
            </button>
          ))}
        </div>

        {picksLoading && <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '12px' }}>Loading picks...</div>}

        {activeTab === 'train' && <TrainTab sport={sport} picks={picks} onAddPick={addPick} onRemovePick={removePick} />}
        {activeTab === 'predict' && <PredictTab sport={sport} picks={picks} />}
        {activeTab === 'history' && <HistoryTab picks={picks} />}
        {activeTab === 'chat' && <ChatTab picks={picks} />}
      </div>
    </>
  );
}
