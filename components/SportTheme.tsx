'use client';
import { useEffect } from 'react';
import { Sport } from '@/types';

const THEMES: Record<Sport, { accent: string; accentDim: string; accentHover: string; label: string; icon: string }> = {
  Soccer: {
    accent: '#3DFF8F',
    accentDim: 'rgba(61, 255, 143, 0.12)',
    accentHover: 'rgba(61, 255, 143, 0.2)',
    label: 'Soccer',
    icon: '⚽',
  },
  NBA: {
    accent: '#FF6B2C',
    accentDim: 'rgba(255, 107, 44, 0.12)',
    accentHover: 'rgba(255, 107, 44, 0.2)',
    label: 'NBA Basketball',
    icon: '🏀',
  },
  NFL: {
    accent: '#7C5CBF',
    accentDim: 'rgba(124, 92, 191, 0.12)',
    accentHover: 'rgba(124, 92, 191, 0.2)',
    label: 'NFL Football',
    icon: '🏈',
  },
};

export function getSportTheme(sport: Sport) {
  return THEMES[sport];
}

export default function SportTheme({ sport }: { sport: Sport }) {
  useEffect(() => {
    const theme = THEMES[sport];
    const root = document.documentElement;
    root.style.setProperty('--green', theme.accent);
    root.style.setProperty('--green-dim', theme.accentDim);
    root.style.setProperty('--green-hover', theme.accentHover);
  }, [sport]);
  return null;
}
