import './globals.css';
import { LangProvider } from '../lib/i18n';

export const metadata = {
  title: 'مولدات محافظة الفروانية',
  description: 'جدول المولدات — مراقبة الفروانية',
};

export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#16233F' };

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" data-theme="light">
      <body><LangProvider>{children}</LangProvider></body>
    </html>
  );
}
