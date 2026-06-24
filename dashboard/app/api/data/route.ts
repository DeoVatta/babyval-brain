/**
 * POST /api/init-db — Creates tables + seeds data
 * Uses Supabase REST API (works from Vercel server env)
 * GET  /api/data  — Returns all dashboard data
 */
import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://qjemyvydivekolywleji.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqZW15dnlkaXZla29seXdsZWppIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDA3NzM0MSwiZXhwIjoyMDk1NjUzMzQxfQ.8lE-bQBODz6bhQahg0zCT9_rO1UG34WfDXLyK5WddAo';

async function sfetch(path: string, method = 'GET', body?: object) {
  const data = body ? JSON.stringify(body) : null;
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(data ? { 'Prefer': 'return=representation', 'Content-Length': String(data.length) } : {}),
    },
    body: data ?? undefined,
  });
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; }
  catch { return { status: res.status, data: text }; }
}

export async function GET() {
  try {
    const [queue, uploads, schedules] = await Promise.all([
      sfetch('/rest/v1/content_queue?select=*&order=created_at.desc&limit=50'),
      sfetch('/rest/v1/upload_log?select=*&order=uploaded_at.desc&limit=50'),
      sfetch('/rest/v1/schedule_config?select=*'),
    ]);
    return NextResponse.json({
      queue: queue.data || [],
      uploads: uploads.data || [],
      schedules: schedules.data || [],
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST() {
  try {
    // 1. Create tables
    const createSQL = [
      `CREATE TABLE IF NOT EXISTS content_queue (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        platform TEXT NOT NULL, account_name TEXT, content_name TEXT NOT NULL,
        content_path TEXT, queue_status TEXT NOT NULL DEFAULT 'queued',
        caption TEXT, price INTEGER, scheduled_at TIMESTAMPTZ,
        uploaded_at TIMESTAMPTZ, error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS upload_log (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        platform TEXT NOT NULL, account_name TEXT, content_name TEXT NOT NULL,
        status TEXT NOT NULL, duration_ms INTEGER, error_message TEXT,
        uploaded_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS schedule_config (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        platform TEXT NOT NULL UNIQUE, accounts JSONB NOT NULL,
        stagger_minutes INTEGER DEFAULT 10, interval_hours NUMERIC DEFAULT 2,
        is_active BOOLEAN DEFAULT TRUE, updated_at TIMESTAMPTZ DEFAULT NOW()
      )`,
    ];
    const indexSQL = [
      `CREATE INDEX IF NOT EXISTS idx_cq_platform ON content_queue(platform)`,
      `CREATE INDEX IF NOT EXISTS idx_ul_platform ON upload_log(platform)`,
      `CREATE INDEX IF NOT EXISTS idx_ul_time ON upload_log(uploaded_at DESC)`,
    ];

    for (const sql of [...createSQL, ...indexSQL]) {
      await sfetch('/rest/v1/rpc/exec', 'POST', { query_sql: sql });
    }

    // 2. Seed schedule_config
    const configs = [
      { platform: 'tevi', accounts: [{ name: '@cutieval', hour: 0, min: 0 }], stagger_minutes: 148, interval_hours: 2, is_active: true },
      { platform: 'tiktok', accounts: [
        { name: 'zelda23345', hour: 0, min: 0 }, { name: 'sora88908', hour: 0, min: 16 },
        { name: 'kira22252', hour: 0, min: 32 }, { name: 'sukii27290', hour: 0, min: 48 },
        { name: 'miku34456', hour: 1, min: 4 }, { name: 'aria69144', hour: 1, min: 20 },
        { name: 'emilia11660', hour: 1, min: 36 }, { name: 'mikasa88319', hour: 1, min: 52 },
        { name: 'temari700', hour: 2, min: 8 },
      ], stagger_minutes: 16, interval_hours: 2, is_active: true },
      { platform: 'youtube', accounts: [{ name: 'babyval14', hour: 0, min: 0 }, { name: 'cutebabyval14', hour: 0, min: 10 }], stagger_minutes: 10, interval_hours: 2, is_active: true },
      { platform: 'chatango', accounts: [{ name: 'cutieval@poinekopoi', hour: 0, min: 0 }], stagger_minutes: 220, interval_hours: 3, is_active: true },
    ];
    for (const cfg of configs) {
      const ex = await sfetch(`/rest/v1/schedule_config?platform=eq.${cfg.platform}&select=id`);
      if (ex.data?.length > 0) {
        await sfetch(`/rest/v1/schedule_config?platform=eq.${cfg.platform}`, 'PATCH', cfg);
      } else {
        await sfetch('/rest/v1/schedule_config', 'POST', cfg);
      }
    }

    // 3. Seed test data
    const now = new Date();
    const uploads = [
      { platform: 'tevi', account_name: '@cutieval', content_name: 'tevi_exclusive_1.mp4', status: 'success', duration_ms: 120000, uploaded_at: new Date(now.getTime() - 0 * 3600000).toISOString() },
      { platform: 'tevi', account_name: '@cutieval', content_name: 'tevi_exclusive_2.mp4', status: 'success', duration_ms: 130000, uploaded_at: new Date(now.getTime() - 1 * 3600000).toISOString() },
      { platform: 'tevi', account_name: '@cutieval', content_name: 'tevi_exclusive_3.mp4', status: 'success', duration_ms: 115000, uploaded_at: new Date(now.getTime() - 2 * 3600000).toISOString() },
      { platform: 'tevi', account_name: '@cutieval', content_name: 'tevi_exclusive_4.mp4', status: 'success', duration_ms: 140000, uploaded_at: new Date(now.getTime() - 3 * 3600000).toISOString() },
      { platform: 'tevi', account_name: '@cutieval', content_name: 'tevi_exclusive_5.mp4', status: 'success', duration_ms: 125000, uploaded_at: new Date(now.getTime() - 4 * 3600000).toISOString() },
      { platform: 'tevi', account_name: '@cutieval', content_name: 'tevi_failed.mp4', status: 'failed', duration_ms: 60000, error_message: 'Upload timeout', uploaded_at: new Date(now.getTime() - 26 * 3600000).toISOString() },
      ...['zelda23345', 'sora88908', 'kira22252', 'sukii27290', 'miku34456', 'aria69144', 'emilia11660', 'mikasa88319'].map((a, i) => ({ platform: 'tiktok', account_name: a, content_name: `tiktok_${i + 1}.mp4`, status: 'success', duration_ms: 180000 + i * 10000, uploaded_at: new Date(now.getTime() - i * 40 * 60000).toISOString() })),
      { platform: 'tiktok', account_name: 'temari700', content_name: 'tiktok_rejected.mp4', status: 'failed', duration_ms: 45000, error_message: 'Community guidelines', uploaded_at: new Date(now.getTime() - 3 * 3600000).toISOString() },
      { platform: 'youtube', account_name: 'babyval14', content_name: 'babyval_yt_1.mp4', status: 'success', duration_ms: 300000, uploaded_at: new Date(now.getTime() - 1 * 3600000).toISOString() },
      { platform: 'youtube', account_name: 'cutebabyval14', content_name: 'babyval_yt_2.mp4', status: 'success', duration_ms: 320000, uploaded_at: new Date(now.getTime() - 4 * 3600000).toISOString() },
      { platform: 'youtube', account_name: 'babyval14', content_name: 'babyval_yt_3.mp4', status: 'success', duration_ms: 280000, uploaded_at: new Date(now.getTime() - 7 * 3600000).toISOString() },
      ...Array.from({ length: 6 }, (_, i) => ({ platform: 'chatango', account_name: 'cutieval@poinekopoi', content_name: `msg_${i + 1}`, status: 'success', duration_ms: 5000, uploaded_at: new Date(now.getTime() - i * 45 * 60000).toISOString() })),
    ];

    for (const item of uploads) {
      await sfetch('/rest/v1/upload_log', 'POST', item);
    }

    // 4. Seed queue items
    const queue = [
      { platform: 'tevi', account_name: '@cutieval', content_name: 'tevi_next_upload.mp4', queue_status: 'queued', caption: 'Exclusive babyval.com' },
      { platform: 'tevi', account_name: '@cutieval', content_name: 'tevi_queue_2.mp4', queue_status: 'queued' },
      { platform: 'tiktok', account_name: 'zelda23345', content_name: 'tiktok_pending_1.mp4', queue_status: 'queued' },
      { platform: 'tiktok', account_name: 'sora88908', content_name: 'tiktok_pending_2.mp4', queue_status: 'queued' },
      { platform: 'youtube', account_name: 'babyval14', content_name: 'youtube_pending.mp4', queue_status: 'queued' },
      { platform: 'chatango', account_name: 'cutieval@poinekopoi', content_name: 'chatango_pending', queue_status: 'queued' },
    ];
    for (const item of queue) {
      await sfetch('/rest/v1/content_queue', 'POST', item);
    }

    return NextResponse.json({ ok: true, message: 'Tables created and data seeded!' });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
