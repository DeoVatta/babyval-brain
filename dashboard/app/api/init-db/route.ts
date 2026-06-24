/**
 * POST /api/init-db
 * Creates tables and seeds test data on Supabase.
 * Run once from browser: fetch('/api/init-db', {method:'POST'})
 */
import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqZW15dnlkaXZla29seXdsZWppIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDA3NzM0MSwiZXhwIjoyMDk1NjUzMzQxfQ.8lE-bQBODz6bhQahg0zCT9_rO1UG34WfDXLyK5WddAo';

async function supabaseFetch(path: string, method: string, body?: object) {
  const data = body ? JSON.stringify(body) : null;
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(data ? { 'Prefer': 'return=representation', 'Content-Length': String(Buffer.byteLength(data)) } : {}),
    },
    body: data ?? undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, data: json };
}

const TABLES_SQL = [
  `CREATE TABLE IF NOT EXISTS content_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    platform TEXT NOT NULL,
    account_name TEXT,
    content_name TEXT NOT NULL,
    content_path TEXT,
    queue_status TEXT NOT NULL DEFAULT 'queued',
    caption TEXT,
    price INTEGER,
    scheduled_at TIMESTAMPTZ,
    uploaded_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS upload_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    platform TEXT NOT NULL,
    account_name TEXT,
    content_name TEXT NOT NULL,
    status TEXT NOT NULL,
    duration_ms INTEGER,
    error_message TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS schedule_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    platform TEXT NOT NULL UNIQUE,
    accounts JSONB NOT NULL,
    stagger_minutes INTEGER DEFAULT 10,
    interval_hours NUMERIC DEFAULT 2,
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
];

const INDEXES_SQL = [
  `CREATE INDEX IF NOT EXISTS idx_content_queue_platform ON content_queue(platform)`,
  `CREATE INDEX IF NOT EXISTS idx_content_queue_status ON content_queue(queue_status)`,
  `CREATE INDEX IF NOT EXISTS idx_upload_log_platform ON upload_log(platform)`,
  `CREATE INDEX IF NOT EXISTS idx_upload_log_uploaded_at ON upload_log(uploaded_at DESC)`,
];

export async function POST() {
  try {
    // Create tables via RPC
    for (const sql of [...TABLES_SQL, ...INDEXES_SQL]) {
      await supabaseFetch('/rest/v1/rpc/exec_sql', 'POST', { query_sql: sql });
    }

    // Seed schedule_config
    const scheduleConfigs = [
      { platform: 'tevi', accounts: [{ name: '@cutieval', hour: 0, min: 0 }], stagger_minutes: 148, interval_hours: 2, is_active: true },
      { platform: 'tiktok', accounts: [{ name: 'zelda23345' }, { name: 'sora88908' }, { name: 'kira22252' }, { name: 'sukii27290' }, { name: 'miku34456' }, { name: 'aria69144' }, { name: 'emilia11660' }, { name: 'mikasa88319' }, { name: 'temari700' }], stagger_minutes: 15.56, interval_hours: 2.33, is_active: true },
      { platform: 'youtube', accounts: [{ name: 'babyval14', hour: 0, min: 0 }, { name: 'cutebabyval14', hour: 0, min: 10 }], stagger_minutes: 10, interval_hours: 2, is_active: true },
      { platform: 'chatango', accounts: [{ name: 'cutieval@poinekopoi', hour: 0, min: 0 }], stagger_minutes: 220, interval_hours: 3, is_active: true },
    ];

    for (const cfg of scheduleConfigs) {
      const existing = await supabaseFetch(`/rest/v1/schedule_config?platform=eq.${cfg.platform}&select=id`, 'GET');
      if (existing.data && existing.data.length > 0) {
        await supabaseFetch(`/rest/v1/schedule_config?platform=eq.${cfg.platform}`, 'PATCH', cfg);
      } else {
        await supabaseFetch('/rest/v1/schedule_config', 'POST', cfg);
      }
    }

    // Seed upload_log
    const now = new Date();
    const uploads = [
      // Tevi: 5 success today
      { platform: 'tevi', account_name: '@cutieval', content_name: 'tevi_exclusive_1.mp4', status: 'success', duration_ms: 120000, uploaded_at: new Date(now.getTime() - 0 * 60 * 60 * 1000).toISOString() },
      { platform: 'tevi', account_name: '@cutieval', content_name: 'tevi_exclusive_2.mp4', status: 'success', duration_ms: 130000, uploaded_at: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString() },
      { platform: 'tevi', account_name: '@cutieval', content_name: 'tevi_exclusive_3.mp4', status: 'success', duration_ms: 115000, uploaded_at: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString() },
      { platform: 'tevi', account_name: '@cutieval', content_name: 'tevi_exclusive_4.mp4', status: 'success', duration_ms: 140000, uploaded_at: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString() },
      { platform: 'tevi', account_name: '@cutieval', content_name: 'tevi_exclusive_5.mp4', status: 'success', duration_ms: 125000, uploaded_at: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString() },
      { platform: 'tevi', account_name: '@cutieval', content_name: 'tevi_failed_upload.mp4', status: 'failed', duration_ms: 60000, error_message: 'Upload timeout - video file corrupt', uploaded_at: new Date(now.getTime() - 26 * 60 * 60 * 1000).toISOString() },
      // TikTok: 8 success today
      ...['zelda23345', 'sora88908', 'kira22252', 'sukii27290', 'miku34456', 'aria69144', 'emilia11660', 'mikasa88319'].map((acct, i) => ({
        platform: 'tiktok', account_name: acct, content_name: `dance_clip_${i + 1}.mp4`, status: 'success' as const, duration_ms: 180000 + i * 10000, uploaded_at: new Date(now.getTime() - i * 40 * 60 * 1000).toISOString(),
      })),
      { platform: 'tiktok', account_name: 'temari700', content_name: 'tiktok_rejected.mp4', status: 'failed', duration_ms: 45000, error_message: 'Content violates community guidelines', uploaded_at: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString() },
      // YouTube
      { platform: 'youtube', account_name: 'babyval14', content_name: 'babyval_youtube_1.mp4', status: 'success', duration_ms: 300000, uploaded_at: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString() },
      { platform: 'youtube', account_name: 'cutebabyval14', content_name: 'babyval_youtube_2.mp4', status: 'success', duration_ms: 320000, uploaded_at: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString() },
      { platform: 'youtube', account_name: 'babyval14', content_name: 'babyval_youtube_3.mp4', status: 'success', duration_ms: 280000, uploaded_at: new Date(now.getTime() - 7 * 60 * 60 * 1000).toISOString() },
      // Chatango: 6 today
      ...Array.from({ length: 6 }, (_, i) => ({
        platform: 'chatango', account_name: 'cutieval@poinekopoi', content_name: `chatango_msg_${i + 1}`, status: 'success' as const, duration_ms: 5000, uploaded_at: new Date(now.getTime() - i * 45 * 60 * 1000).toISOString(),
      })),
    ];

    for (const item of uploads) {
      await supabaseFetch('/rest/v1/upload_log', 'POST', item);
    }

    // Seed queue items
    const queueItems = [
      { platform: 'tevi', account_name: '@cutieval', content_name: 'tevi_next_upload.mp4', queue_status: 'queued', caption: 'Exclusive content babyval.com' },
      { platform: 'tevi', account_name: '@cutieval', content_name: 'tevi_queue_2.mp4', queue_status: 'queued' },
      { platform: 'tiktok', account_name: 'zelda23345', content_name: 'tiktok_pending_1.mp4', queue_status: 'queued', caption: 'Tevi : Cutie Val #babyval' },
      { platform: 'tiktok', account_name: 'sora88908', content_name: 'tiktok_pending_2.mp4', queue_status: 'queued' },
      { platform: 'youtube', account_name: 'babyval14', content_name: 'youtube_pending.mp4', queue_status: 'queued' },
      { platform: 'chatango', account_name: 'cutieval@poinekopoi', content_name: 'chatango_pending', queue_status: 'queued' },
    ];

    for (const item of queueItems) {
      await supabaseFetch('/rest/v1/content_queue', 'POST', item);
    }

    return NextResponse.json({ ok: true, message: 'Tables created and data seeded!' });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
