// إرسال جدول المولدات PDF لقروب واتساب عن طريق WaAPI
// يشتغل تلقائياً ٣ مرات يومياً (٧ص، ٣ع، ١١ل بتوقيت الكويت) من جدولة قاعدة البيانات (pg_cron)
//
// المتغيرات المطلوبة في Vercel:
//   WAAPI_TOKEN        مفتاح API من waapi.app
//   WAAPI_INSTANCE_ID  رقم الـ instance
//   WAAPI_CHAT_ID      معرّف القروب (ينتهي بـ @g.us)
//   CRON_SECRET        كلمة سر تحمي هالرابط
//
// الاستخدام (كلها تحتاج: Authorization: Bearer CRON_SECRET  أو  ?key=CRON_SECRET):
//   ?groups=1   قائمة القروبات بالرقم المربوط (عشان تاخذ معرّف القروب)
//   ?preview=1  يرجّع ملف الـ PDF بدون إرسال
//   ?test=1     يرسل مع عبارة "رسالة تجربة" فوق الوصف
//   (بدون شي)   يجهز الـ PDF ويرسله للقروب
process.env.TZ = 'Asia/Kuwait';

import { createClient } from '@supabase/supabase-js';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { buildGeneratorsDoc } from '../../../lib/generatorsReport';
import { DOC_STYLES } from '../../../lib/templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jjpkwejkgnhrgjmioshh.supabase.co';
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_862A-N6ABCamX5MbLA1NDQ_z78kH9UI';
const WAAPI = 'https://waapi.app/api/v1';
const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const h = req.headers.get('authorization') || '';
  return h === `Bearer ${secret}` || req.nextUrl.searchParams.get('key') === secret;
}

function pad(n) { return String(n).padStart(2, '0'); }

function periodLabel(d) {
  const h = d.getHours();
  if (h >= 5 && h < 12) return 'صباحي';
  if (h >= 12 && h < 19) return 'عصري';
  return 'ليلي';
}

async function waapi(action, body) {
  const id = process.env.WAAPI_INSTANCE_ID;
  const token = process.env.WAAPI_TOKEN;
  if (!id || !token) throw new Error('WAAPI_TOKEN / WAAPI_INSTANCE_ID غير مضبوطة في Vercel');
  const res = await fetch(`${WAAPI}/instances/${id}/client/action/${action}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const json = await res.json().catch(() => ({}));
  // WaAPI ممكن يرد 200 والعملية فاشلة من الداخل (data.status = error)
  const inner = json?.data?.status;
  if (!res.ok || (json.status && json.status !== 'success') || (inner && inner !== 'success')) {
    throw new Error(`WaAPI ${action} فشل (${res.status}): ${JSON.stringify(json).slice(0, 400)}`);
  }
  return json;
}

async function activeGenerators() {
  const supabase = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from('generators').select('*').is('removed_at', null)
    .order('connected_on', { ascending: true }).order('installed_at', { ascending: true, nullsFirst: true }).order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function renderPdf(origin, rows) {
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/>
    <base href="${origin}/"/>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap"/>
    <style>${DOC_STYLES} html,body{margin:0;background:#fff;} .doc.gen-doc{zoom:0.565;box-sizing:border-box;} tr{break-inside:avoid;} thead{display:table-header-group;}</style>
    </head><body>${buildGeneratorsDoc(rows)}</body></html>`;
  const local = process.env.CHROME_PATH; // للتجربة المحلية فقط
  const browser = await puppeteer.launch(local
    ? { executablePath: local, headless: true, args: ['--no-sandbox'] }
    : { args: puppeteer.defaultArgs({ args: chromium.args, headless: 'shell' }), executablePath: await chromium.executablePath(), headless: 'shell' });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1990, height: 1200 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    return await page.pdf({
      format: 'A4', landscape: true, printBackground: true,
      margin: { top: '8mm', bottom: '8mm', left: '6mm', right: '6mm' },
    });
  } finally {
    await browser.close();
  }
}

export async function GET(req) {
  if (!authorized(req)) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const params = req.nextUrl.searchParams;
  try {
    if (params.get('groups')) {
      const res = await waapi('get-chats', { limit: 500 });
      const chats = res?.data?.data || res?.data || [];
      const groups = (Array.isArray(chats) ? chats : [])
        .filter((c) => c?.isGroup || String(c?.id?._serialized || c?.id || '').endsWith('@g.us'))
        .map((c) => ({ id: c?.id?._serialized || c?.id, name: c?.name }));
      return Response.json({ ok: true, groups });
    }

    const now = new Date();
    const rows = await activeGenerators();
    const pdf = Buffer.from(await renderPdf(req.nextUrl.origin, rows));
    const date = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}`;
    const fileName = `Farwaniya-Generators-${date}-${pad(now.getHours())}${pad(now.getMinutes())}.pdf`; // اسم إنجليزي عشان ما يتلخبط بالواتساب

    if (params.get('preview')) {
      return new Response(pdf, { headers: { 'content-type': 'application/pdf', 'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(fileName)}` } });
    }

    const chatId = params.get('chat') || process.env.WAAPI_CHAT_ID;
    if (!chatId || !chatId.endsWith('@g.us') && !chatId.endsWith('@c.us')) throw new Error('WAAPI_CHAT_ID غير مضبوط أو صيغته غلط (لازم ينتهي بـ @g.us)');
    const count = (list) => list.reduce((s, g) => s + (g.gen_count || 1), 0);
    const ht = count(rows.filter((g) => g.gen_type === 'HT'));
    const lt = count(rows.filter((g) => g.gen_type === 'LT'));
    const standby = count(rows.filter((g) => g.status === 'standby'));
    const caption = [
      ...(params.get('test') ? ['🧪 *رسالة تجربة — TEST*'] : []),
      `⚡ جدول مولدات محافظة الفروانية — التقرير ال${periodLabel(now)}`,
      `📅 ${DAYS_AR[now.getDay()]} ${date.replace(/-/g, '/')} — ${pad(now.getHours())}:${pad(now.getMinutes())}`,
      `المجموع: ${count(rows)}  |  H.T: ${ht}  |  L.T: ${lt}${standby ? `  |  ستاند باي: ${standby}` : ''}`,
    ].join('\n');

    await waapi('send-media', {
      chatId,
      mediaBase64: pdf.toString('base64'),
      mediaName: fileName,
      mediaCaption: caption,
      asDocument: true,
    });
    return Response.json({ ok: true, sent: true, chatId, generators: count(rows), bytes: pdf.length });
  } catch (e) {
    console.error('whatsapp-report', e);
    return Response.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

export const POST = GET;
