'use client';
import { useEffect, useState } from 'react';

// Navy is the product identity and the default everywhere. 'light' is an opt-in
// cream variant that only applies if the user deliberately switched to it.
// THEME_VERSION lets us reset stale preferences after a rebrand.
const THEME_VERSION = '2';

export default function ThemeToggle({ style }) {
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const storedVersion = localStorage.getItem('theme_version');
    if (storedVersion !== THEME_VERSION) {
      // preference predates the navy rebrand — drop it so navy shows by default
      localStorage.removeItem('theme');
      localStorage.setItem('theme_version', THEME_VERSION);
    }
    const saved = localStorage.getItem('theme');
    const next = saved === 'light' ? 'light' : 'dark';
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
