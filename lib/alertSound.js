// Plays a distinctive alert tone using the Web Audio API (no external audio file needed).
export function playAlertTone(kind = 'new') {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // 'new' (new complaint for driver): rising two-tone chime
    // 'closed' (driver closed a complaint): short double-beep
    const notes = kind === 'closed'
      ? [{ freq: 880, start: 0, dur: 0.12 }, { freq: 880, start: 0.18, dur: 0.12 }]
      : [{ freq: 660, start: 0, dur: 0.15 }, { freq: 990, start: 0.16, dur: 0.22 }];

    notes.forEach((n) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.freq, now + n.start);
      gain.gain.setValueAtTime(0, now + n.start);
      gain.gain.linearRampToValueAtTime(0.35, now + n.start + 0.02);
      gain.gain.linearRampToValueAtTime(0, now + n.start + n.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + n.start);
      osc.stop(now + n.start + n.dur + 0.02);
    });

    setTimeout(() => ctx.close(), 700);
  } catch (e) {
    console.error('alert tone failed', e);
  }
}

export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function showBrowserNotification(title, body) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon: '/logo.png' });
  } catch (e) {
    console.error('notification failed', e);
  }
}
