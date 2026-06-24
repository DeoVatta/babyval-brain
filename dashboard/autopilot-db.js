/**
 * AUTOPILOT-DB — Write upload events to Supabase
 * =============================================
 * Require this in each autopilot to log queue + upload status.
 *
 * Usage:
 *   const db = require('./autopilot-db');
 *   await db.logQueue({ platform: 'tevi', content_name: 'video.mp4', ... });
 *   await db.logUpload({ platform: 'tevi', content_name: 'video.mp4', status: 'success' });
 */
const https = require('https');

const SUPABASE_URL = 'https://qjemyvydivekolywleji.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqZW15dnlkaXZla29seXdsZWppIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDA3NzM0MSwiZXhwIjoyMDk1NjUzMzQxfQ.8lE-bQBODz6bhQahg0zCT9_rO1UG34WfDXLyK5WddAo';

function supabaseFetch(table, method, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'qjemyvydivekolywleji.supabase.co',
      path: `/rest/v1/${table}`,
      method,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
    };
    if (data) options.headers['Content-Length'] = Buffer.byteLength(data);
    const req = https.request(options, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, data: d }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Supabase timeout')); });
    if (data) req.write(data);
    req.end();
  });
}

/**
 * Log a queued item (before upload starts)
 */
async function logQueue({ platform, account_name, content_name, content_path, caption, price, scheduled_at }) {
  try {
    const res = await supabaseFetch('content_queue', 'POST', {
      platform,
      account_name: account_name || null,
      content_name,
      content_path: content_path || null,
      caption: caption || null,
      price: price || null,
      scheduled_at: scheduled_at || new Date().toISOString(),
      queue_status: 'queued',
    });
    return res;
  } catch (e) {
    console.error('[DB] logQueue error:', e.message);
    return null;
  }
}

/**
 * Update queue item status
 */
async function updateQueueStatus(id, updates) {
  try {
    return await supabaseFetch(`content_queue?id=eq.${id}`, 'PATCH', updates);
  } catch (e) {
    console.error('[DB] updateQueueStatus error:', e.message);
    return null;
  }
}

/**
 * Log an upload result
 */
async function logUpload({ platform, account_name, content_name, status, duration_ms, error_message, metadata }) {
  try {
    const res = await supabaseFetch('upload_log', 'POST', {
      platform,
      account_name: account_name || null,
      content_name,
      status, // 'success' | 'failed'
      duration_ms: duration_ms || null,
      error_message: error_message || null,
      uploaded_at: new Date().toISOString(),
      metadata: metadata || null,
    });

    // Also update queue status
    if (res && res.data && res.data[0]) {
      await supabaseFetch(`content_queue?id=eq.${res.data[0].id}`, 'PATCH', {
        queue_status: status,
        uploaded_at: status === 'success' ? new Date().toISOString() : null,
        error_message: error_message || null,
        updated_at: new Date().toISOString(),
      }).catch(() => {});
    }
    return res;
  } catch (e) {
    console.error('[DB] logUpload error:', e.message);
    return null;
  }
}

/**
 * Get next scheduled item for a platform (to update queue)
 */
async function getLatestQueueItem(platform, content_name) {
  try {
    const res = await supabaseFetch(
      `content_queue?platform=eq.${platform}&content_name=eq.${encodeURIComponent(content_name)}&queue_status=eq.queued&order=created_at.desc&limit=1`,
      'GET',
      null
    );
    if (res && res.data && res.data[0]) return res.data[0];
    return null;
  } catch (e) {
    return null;
  }
}

module.exports = { logQueue, updateQueueStatus, logUpload, getLatestQueueItem };
