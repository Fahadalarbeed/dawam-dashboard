/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  // نموذج التركيب/الإزالة انشال — الإدخال من زر "إدخال مولد جديد" بالصفحة الرئيسية
  async redirects() {
    return [{ source: '/new', destination: '/', permanent: false }];
  },
};
