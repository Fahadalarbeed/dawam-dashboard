/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  // متصفح Chromium المستخدم لتحويل الجدول PDF على السيرفر (إرسال الواتساب)
  experimental: { serverComponentsExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'] },
};
