'use client';
import { useRouter } from 'next/navigation';

export default function ComplaintsPage() {
  const router = useRouter();

  return (
    <div className="wrap">
      <header style={{ marginBottom: 22, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn-secondary" style={{ marginTop: 0, width: 'auto', padding: '10px 16px' }} onClick={() => router.push('/dashboard')}>
          → رجوع
        </button>
        <h1 style={{ fontSize: 19, fontWeight: 800, margin: 0 }}>إحصائية البلاغات</h1>
      </header>

      <div className="card">
        <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
          الفلاتر والإحصائيات لهذي الصفحة — قريبًا 🚧
        </div>
      </div>
    </div>
  );
}
