import './globals.css';

export const metadata = {
  title: 'لوحة متابعة الدوام',
  description: 'نظام متابعة الأعطال والعدادات — مراقبة الفروانية',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
