import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://qjemyvydivekolywleji.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqZW15dnlkaXZla29seXdsZWppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNzczNDEsImV4cCI6MjA5NTY1MzM0MX0._MrcyUkfXLIxXaDxcdv5xENbJBYPKTDbrimGrZIcV0s';

export const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface ContentQueueItem {
  id: string;
  platform: 'tevi' | 'tiktok' | 'youtube' | 'chatango';
  account_name: string | null;
  content_name: string;
  content_path: string | null;
  queue_status: 'queued' | 'uploading' | 'success' | 'failed';
  caption: string | null;
  price: number | null;
  scheduled_at: string | null;
  uploaded_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface UploadLogItem {
  id: string;
  platform: string;
  account_name: string | null;
  content_name: string;
  status: 'success' | 'failed';
  duration_ms: number | null;
  error_message: string | null;
  uploaded_at: string;
}

export interface ScheduleAccount {
  name: string;
  hour: number;
  min: number;
}

export interface ScheduleConfig {
  id: string;
  platform: string;
  accounts: ScheduleAccount[];
  stagger_minutes: number;
  interval_hours: number;
  is_active: boolean;
}

// ─── API Functions ─────────────────────────────────────────────────────────────

export async function getQueue(platform: string, limit = 10): Promise<ContentQueueItem[]> {
  const { data, error } = await supabase
    .from('content_queue')
    .select('*')
    .eq('platform', platform)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { console.error('getQueue error:', error); return []; }
  return data || [];
}

export async function getRecentUploads(platform: string, limit = 5): Promise<UploadLogItem[]> {
  const { data, error } = await supabase
    .from('upload_log')
    .select('*')
    .eq('platform', platform)
    .order('uploaded_at', { ascending: false })
    .limit(limit);
  if (error) { console.error('getRecentUploads error:', error); return []; }
  return data || [];
}

export async function getSchedule(platform: string): Promise<ScheduleConfig | null> {
  const { data, error } = await supabase
    .from('schedule_config')
    .select('*')
    .eq('platform', platform)
    .single();
  if (error) { console.error('getSchedule error:', error); return null; }
  return data;
}

export async function getAllSchedules(): Promise<ScheduleConfig[]> {
  const { data, error } = await supabase
    .from('schedule_config')
    .select('*');
  if (error) { console.error('getAllSchedules error:', error); return []; }
  return data || [];
}

export async function getUploadStats(platform: string): Promise<{success: number; failed: number; today: number}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString();

  const [success, failed, todayCount] = await Promise.all([
    supabase.from('upload_log').select('id', { count: 'exact', head: true }).eq('platform', platform).eq('status', 'success'),
    supabase.from('upload_log').select('id', { count: 'exact', head: true }).eq('platform', platform).eq('status', 'failed'),
    supabase.from('upload_log').select('id', { count: 'exact', head: true }).eq('platform', platform).eq('status', 'success').gte('uploaded_at', todayStr),
  ]);

  return {
    success: success.count || 0,
    failed: failed.count || 0,
    today: todayCount.count || 0,
  };
}

// ─── Next.js Cache Tags ───────────────────────────────────────────────────────

export const REVALIDATE = 30; // seconds
