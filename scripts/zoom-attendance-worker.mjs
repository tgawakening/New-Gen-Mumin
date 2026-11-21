const origin = process.env.APP_URL;
const secret = process.env.CRON_SECRET;
const interval = Math.max(2000, Number(process.env.ZOOM_ATTENDANCE_WORKER_INTERVAL_MS) || 5000);
if (!origin || !secret) throw new Error('APP_URL and CRON_SECRET are required.');
let stopped = false;
process.on('SIGTERM', () => { stopped = true; });
process.on('SIGINT', () => { stopped = true; });
while (!stopped) {
  try {
    const response = await fetch(new URL('/api/attendance/process-zoom', origin), { method: 'POST', headers: { Authorization: 'Bearer ' + secret }, signal: AbortSignal.timeout(65_000) });
    console.log('[attendance-worker]', response.status, response.ok ? 'cycle completed' : 'cycle failed; inspect admin attendance queue');
  } catch { console.error('[attendance-worker] cycle unavailable; retrying'); }
  if (process.argv.includes('--once')) break;
  await new Promise(resolve => setTimeout(resolve, interval));
}
