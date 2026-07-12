'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError('فشل تسجيل الدخول: تأكد من البريد وكلمة المرور');
      return;
    }
    router.replace('/dashboard');
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form onSubmit={handleSubmit} className="card" style={{ maxWidth: 360, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>مراقبة الفروانية</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>تسجيل الدخول</h1>
        </div>

        <div className="field">
          <label>البريد الإلكتروني</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label>كلمة المرور</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>

        {error && (
          <div style={{ color: 'var(--danger)', fontSize: 12.5, marginTop: 12 }}>{error}</div>
        )}

        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? 'جارٍ الدخول...' : 'دخول'}
        </button>

        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 14, textAlign: 'center' }}>
          الحسابات تُنشأ من قِبل مدير النظام عبر لوحة Supabase.
        </div>
      </form>
    </div>
  );
  }
