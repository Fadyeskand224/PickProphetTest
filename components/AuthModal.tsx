'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';

interface Props {
  onClose: () => void;
}

export default function AuthModal({ onClose }: Props) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    const { error } = mode === 'signin'
      ? await signIn(email, password)
      : await signUp(email, password);

    setLoading(false);

    if (error) {
      setError(error);
    } else if (mode === 'signup') {
      setSuccessMsg('Account created! Check your email to confirm, then sign in.');
      setMode('signin');
    } else {
      onClose();
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '20px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '400px',
      }}>
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '20px', fontWeight: '800', marginBottom: '6px' }}>
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text2)' }}>
            {mode === 'signin'
              ? 'Your picks sync across all devices.'
              : 'Save your training data and picks to the cloud.'}
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="field-label">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label className="field-label">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          {error && (
            <div style={{ fontSize: '13px', color: 'var(--red)', background: 'var(--red-dim)', padding: '10px 14px', borderRadius: '8px' }}>
              {error}
            </div>
          )}
          {successMsg && (
            <div style={{ fontSize: '13px', color: 'var(--green)', background: 'var(--green-dim)', padding: '10px 14px', borderRadius: '8px' }}>
              {successMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-green"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {loading
              ? <span className="dots"><span style={{ background: '#000' }} /><span style={{ background: '#000' }} /><span style={{ background: '#000' }} /></span>
              : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--text2)' }}>
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setError(''); setSuccessMsg(''); }}
            style={{ color: 'var(--green)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px', fontFamily: 'inherit' }}
          >
            {mode === 'signin' ? 'Sign Up' : 'Sign In'}
          </button>
        </div>

        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: '16px', right: '16px',
            background: 'none', border: 'none', color: 'var(--text3)',
            cursor: 'pointer', fontSize: '20px',
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
