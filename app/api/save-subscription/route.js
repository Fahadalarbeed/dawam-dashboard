import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request) {
  try {
    const { driver, subscription } = await request.json();
    if (!driver || !subscription) {
      return Response.json({ error: 'missing driver or subscription' }, { status: 400 });
    }
    const { error } = await supabase.from('push_subscriptions').insert({
      driver,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    });
    if (error && !error.message.includes('duplicate')) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
