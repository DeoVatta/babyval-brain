/**
 * INIT-DB — Create tables + seed test data for babyval-autopilot dashboard
 * Run: node dashboard/init-db.js
 */
const https = require('https');

const SUPABASE_URL = 'https://qjemyvydivekolywleji.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqZW15dnlkaXZla29seXdsZWppIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDA3NzM0MSwiZXhwIjoyMDk1NjUzMzQxfQ.8lE-bQBODz6bhQahg0zCT9_rO1UG34WfDXLyK5WddAo';

function supabaseFetch(path, method, body, key) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    };
    if (data) {
      headers['Prefer'] = 'return=representation';
      headers['Content-Length'] = Buffer.byteLength(data);
    }
    const options = {
      hostname: 'qjemyvydivekolywleji.supabase.co',
      path,
      method,
      headers,
    };
    const req = https.request(options, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, data: d }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
    if (data) req.write(data);
    req.end();
  });
}

async function rpc(sql) {
  const res = await supabaseFetch('/rest/v1/rpc/exec', 'POST', { query: sql }, SERVICE_KEY);
  if (res.status >= 400) {
    console.log('  RPC Error:', res.status, res.data);
  }
  return res;
}

async function createTables() {
  console.log('Creating tables...');

  const stmts = [
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

  for (const sql of stmts) {
    try {
      await rpc(sql);
    } catch (e) {
      console.log('  Table create error:', e.message);
    }
  }

  // Create indexes
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_content_queue_platform ON content_queue(platform)',
    'CREATE INDEX IF NOT EXISTS idx_content_queue_status ON content_queue(queue_status)',
    'CREATE INDEX IF NOT EXISTS idx_upload_log_platform ON upload_log(platform)',
    'CREATE INDEX IF NOT EXISTS idx_upload_log_uploaded_at ON upload_log(uploaded_at DESC)',
  ];
  for (const sql of indexes) {
    try { await rpc(sql); } catch (e) {}
  }

  console.log('Tables ready.');
}

async function seedScheduleConfig() {
  console.log('Seeding schedule_config...');
  const configs = [
    {
      platform: 'tevi',
      accounts: [{ name: '@cutieval', hour: 0, min: 0 }],
      stagger_minutes: 148,
      interval_hours: 2,
      is_active: true,
    },
    {
      platform: 'tiktok',
      accounts: [
        { name: 'zelda23345', hour: 0, min: 0 },
        { name: 'sora88908', hour: 0, min: 16 },
        { name: 'kira22252', hour: 0, min: 32 },
        { name: 'sukii27290', hour: 0, min: 48 },
        { name: 'miku34456', hour: 1, min: 4 },
        { name: 'aria69144', hour: 1, min: 20 },
        { name: 'emilia11660', hour: 1, min: 36 },
        { name: 'mikasa88319', hour: 1, min: 52 },
        { name: 'temari700', hour: 2, min: 8 },
      ],
      stagger_minutes: 16,
      interval_hours: 2,
      is_active: true,
    },
    {
      platform: 'youtube',
      accounts: [
        { name: 'babyval14', hour: 0, min: 0 },
        { name: 'cutebabyval14', hour: 0, min: 10 },
      ],
      stagger_minutes: 10,
      interval_hours: 2,
      is_active: true,
    },
    {
      platform: 'chatango',
      accounts: [{ name: 'cutieval@poinekopoi', hour: 0, min: 0 }],
      stagger_minutes: 220,
      interval_hours: 3,
      is_active: true,
    },
  ];

  for (const cfg of configs) {
    // Upsert using PATCH with eq filter
    const res = await supabaseFetch(`/rest/v1/schedule_config?platform=eq.${cfg.platform}`, 'GET', null, SERVICE_KEY);
    if (res.data && res.data.length > 0) {
      // Update
      await supabaseFetch(`/rest/v1/schedule_config?platform=eq.${cfg.platform}`, 'PATCH',
        { accounts: cfg.accounts, stagger_minutes: cfg.stagger_minutes, interval_hours: cfg.interval_hours, is_active: cfg.is_active }, SERVICE_KEY);
    } else {
      // Insert
      await supabaseFetch('/rest/v1/schedule_config', 'POST', cfg, SERVICE_KEY);
    }
    console.log(`  ${cfg.platform}: OK`);
  }
}

async function seedTestData() {
  console.log('Seeding test upload_log data...');

  const now = new Date();
  const uploads = [];

  // Tevi: 5 uploads today
  for (let i = 0; i < 5; i++) {
    const t = new Date(now);
    t.setMinutes(t.getMinutes() - i * 45);
    uploads.push({
      platform: 'tevi',
      account_name: '@cutieval',
      content_name: `tevi_exclusive_${i + 1}.mp4`,
      status: 'success',
      duration_ms: 120000 + i * 10000,
      uploaded_at: t.toISOString(),
    });
  }
  // Tevi: 1 failed yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(14, 30, 0, 0);
  uploads.push({
    platform: 'tevi',
    account_name: '@cutieval',
    content_name: 'tevi_failed_upload.mp4',
    status: 'failed',
    duration_ms: 60000,
    error_message: 'Upload timeout - video file corrupt',
    uploaded_at: yesterday.toISOString(),
  });

  // TikTok: 8 uploads today
  const tiktokAccounts = ['zelda23345', 'sora88908', 'kira22252', 'sukii27290', 'miku34456', 'aria69144', 'emilia11660', 'mikasa88319'];
  for (let i = 0; i < 8; i++) {
    const t = new Date(now);
    t.setMinutes(t.getMinutes() - i * 30);
    uploads.push({
      platform: 'tiktok',
      account_name: tiktokAccounts[i],
      content_name: `dance_clip_${i + 1}.mp4`,
      status: 'success',
      duration_ms: 180000 + i * 15000,
      uploaded_at: t.toISOString(),
    });
  }
  // TikTok: 1 failed
  uploads.push({
    platform: 'tiktok',
    account_name: 'temari700',
    content_name: 'tiktok_rejected.mp4',
    status: 'failed',
    duration_ms: 45000,
    error_message: 'Content violates community guidelines',
    uploaded_at: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
  });

  // YouTube: 3 uploads
  for (let i = 0; i < 3; i++) {
    const t = new Date(now);
    t.setHours(t.getHours() - i * 3);
    uploads.push({
      platform: 'youtube',
      account_name: i % 2 === 0 ? 'babyval14' : 'cutebabyval14',
      content_name: `babyval_youtube_${i + 1}.mp4`,
      status: 'success',
      duration_ms: 300000 + i * 20000,
      uploaded_at: t.toISOString(),
    });
  }

  // Chatango: 6 messages today
  for (let i = 0; i < 6; i++) {
    const t = new Date(now);
    t.setMinutes(t.getMinutes() - i * 40);
    uploads.push({
      platform: 'chatango',
      account_name: 'cutieval@poinekopoi',
      content_name: `chatango_msg_${i + 1}`,
      status: 'success',
      duration_ms: 5000,
      uploaded_at: t.toISOString(),
    });
  }

  // Seed content_queue with pending items
  console.log('Seeding content_queue...');
  const queueItems = [
    { platform: 'tevi', account_name: '@cutieval', content_name: 'tevi_next_upload.mp4', queue_status: 'queued', caption: 'Exclusive content babyval.com' },
    { platform: 'tevi', account_name: '@cutieval', content_name: 'tevi_queue_2.mp4', queue_status: 'queued' },
    { platform: 'tiktok', account_name: 'zelda23345', content_name: 'tiktok_pending_1.mp4', queue_status: 'queued', caption: 'Tevi : Cutie Val #babyval' },
    { platform: 'tiktok', account_name: 'sora88908', content_name: 'tiktok_pending_2.mp4', queue_status: 'queued' },
    { platform: 'youtube', account_name: 'babyval14', content_name: 'youtube_pending.mp4', queue_status: 'queued' },
    { platform: 'chatango', account_name: 'cutieval@poinekopoi', content_name: 'chatango_pending', queue_status: 'queued' },
  ];

  for (const item of queueItems) {
    await supabaseFetch('/rest/v1/content_queue', 'POST', item, SERVICE_KEY);
  }
  console.log('  Queue items added.');

  // Upload log entries
  for (const item of uploads) {
    await supabaseFetch('/rest/v1/upload_log', 'POST', item, SERVICE_KEY);
  }
  console.log(`  ${uploads.length} upload log entries added.`);
  console.log('Test data seeded!');
}

async function main() {
  try {
    await createTables();
    await seedScheduleConfig();
    await seedTestData();
    console.log('\nDone! Dashboard should now show data.');
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main();
