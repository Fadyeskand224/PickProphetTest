'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import AuthModal from './AuthModal';
import { Sport } from '@/types';

interface Props {
  sport: Sport;
  onSportChange: (s: Sport) => void;
}

const SPORTS: Sport[] = ['Soccer', 'NBA', 'NFL'];

const SPORT_ICONS: Record<Sport, string> = {
  Soccer: '⚽',
  NBA: '🏀',
  NFL: '🏈',
};

export default function Nav({ sport, onSportChange }: Props) {
  const { user, signOut } = useAuth();
  const [showAuth, setShowAuth] = useState(false);

  function scrollToApp() {
    document.getElementById('app')?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <>
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '18px 40px',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        background: 'var(--bg)',
        zIndex: 100,
      }}>
        {/* Logo */}
        <a
          href="#"
          style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '18px', fontWeight: '700', color: 'var(--text)', textDecoration: 'none' }}
        >
          <div style={{
            width: '32px', height: '32px',
            background: 'var(--green)',
            borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '16px',
          }}>
            {SPORT_ICONS[sport]}
          </div>
          PickProphet
        </a>

        {/* Sport selector */}
        <div style={{ display: 'flex', gap: '4px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '4px' }}>
          {SPORTS.map(s => (
            <button
              key={s}
              onClick={() => onSportChange(s)}
              style={{
                padding: '6px 16px',
                borderRadius: '7px',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontWeight: '600',
                fontSize: '13px',
                transition: 'all 0.15s',
                background: sport === s ? 'var(--green)' : 'transparent',
                color: sport === s ? '#000' : 'var(--text2)',
              }}
            >
              {SPORT_ICONS[s]} {s}
            </button>
          ))}
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <a
            href="#"
            onClick={scrollToApp}
            style={{ color: 'var(--text2)', fontSize: '14px', textDecoration: 'none' }}
          >
            App
          </a>

          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text3)' }}>{user.email}</span>
              <button
                onClick={signOut}
                style={{
                  background: 'none', border: '1px solid var(--border2)',
                  borderRadius: '8px', padding: '7px 14px',
                  color: 'var(--text2)', fontSize: '13px',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAuth(true)}
              style={{
                background: 'var(--green)', color: '#000', fontWeight: '700',
                fontSize: '14px', padding: '9px 20px', borderRadius: '8px',
                border: 'none', cursor: 'pointer',
              }}
            >
              Sign In →
            </button>
          )}
        </div>
      </nav>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  );
}
