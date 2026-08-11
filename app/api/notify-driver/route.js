import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

webpush.setVapidDetails(
  'mailto:admin@example.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export async function POST(request) {
  try {
    const { driver, title, body } = await request.json();
    if (!driver) return Response.json({ error: 'missing driver' }, { status: 400 });

    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('driver', driver);

    if (error) return Response.json({ error: error.message }, { status: 500 });
    if (!subs || subs.length === 0) return Response.json({ ok: true, sent: 0 });

    const payload = JSON.stringify({
      title: title || '🚨 بلاغ جديد',
      body: body || `عندك بلاغ جديد`,
      url: '/drivers',
    });

    let sent = 0;
    await Promise.all(subs.map(async (sub) => {
      try {
        await webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        }, payload);
        sent++;
      } catch (e) {
        // subscription expired/invalid — remove it
        if (e.statusCode === 404 || e.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        }
      }
    }));

    return Response.json({ ok: true, sent });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
