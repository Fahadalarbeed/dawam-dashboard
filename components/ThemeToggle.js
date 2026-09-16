'use client';
import { useEffect, useState } from 'react';

// Applies the saved theme on every page and renders the toggle button.
// Navy ('dark') is the default identity; 'light' is the cream variant.
export default function ThemeToggle({ style }) {
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    const next = saved === 'light' || saved === 'dark' ? saved : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  }

  return (
    <button
      onClick={toggle}
      title="تبديل الوضع الليلي/النهاري"
      style={{
        background: 'transparent', border: '1px solid var(--border)', borderRadius: '50%',
        width: 38, height: 38, fontSize: 15, cursor: 'pointer', opacity: 0.75, flexShrink: 0,
        ...style,
      }}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
