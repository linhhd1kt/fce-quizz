'use client';
import { useState, useEffect } from 'react';

export function useTheme(): { theme: 'light' | 'dark'; toggleTheme: () => void } {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const stored = localStorage.getItem('fce-theme');
    const resolved: 'light' | 'dark' = stored === 'light' ? 'light' : 'dark';
    setTheme(resolved);
    if (resolved === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const next: 'light' | 'dark' = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('fce-theme', next);
    document.documentElement.classList.toggle('dark', next === 'dark');
  };

  return { theme, toggleTheme };
}
