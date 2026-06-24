'use client';

import { createClient } from '@supabase/supabase-js';
import { useEffect, useState, useCallback } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { Component, type ReactNode } from 'react';

// ─── Error Boundary ──────────────────────────────────────────────────────────

class ErrorBoundary extends Component<{ children: ReactNode; name?: string }, { hasError: boolean; error: string }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: '' };
  }
  static getDerivedStateFromError(e: Error) {
    return { hasError: true, error: `${e.message}\n${e.stack || ''}` };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          background: '#1a0000', border: '1px solid #ff4444', borderRadius: '8px',
          padding: '12px', margin: '8px 0', fontFamily: 'monospace', fontSize: '11px',
          color: '#ff8888', whiteSpace: 'pre-wrap', maxHeight: '300px', overflow: 'auto'
        }}>
          <strong>💥 Error{this.props.name ? ` in ${this.props.name}` : ''}:</strong>
          {'\n'}{this.state.error}
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Icons (inline SVG) ────────────────────────────────────────────────────────

function IconTevi() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}
function IconTikTok() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.77 1.52V6.12a4.85 4.85 0 01-1-.43z"/>
    </svg>
  );
}
function IconYoutube() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 00.5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 002.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 002.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"/>
    </svg>
  );
}
function IconChatango() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  );
}
function IconRefresh() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M23 4v6h-6M1 20v-6h6"/>
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
    </svg>
  );
}
function IconClock() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
    </svg>
  );
}
function IconCheck() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <path d="M20 6L9 17l-5-5"/>
    </svg>
  );
}
function IconX() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12"/>
    </svg>
  );
}
function IconArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M5 12h14M12 5l7 7-7 7"/>
    </svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface QueueItem {
  id: string;
  platform: string;
  content_name: string;
  queue_status: 'queued' | 'uploading' | 'success' | 'failed';
  account_name: string | null;
  caption: string | null;
  price: number | null;
  scheduled_at: string | null;
  uploaded_at: string | null;
  error_message: string | null;
  created_at: string;
}

interface UploadItem {
  id: string;
  platform: string;
  content_name: string;
  status: 'success' | 'failed';
  account_name: string | null;
  error_message: string | null;
  uploaded_at: string;
  duration_ms: number | null;
}

interface ScheduleAccount {
  name: string;
  hour: number;
  min: number;
}

interface ScheduleInfo {
  accounts: ScheduleAccount[];
  stagger_minutes: number;
  interval_hours: number;
  is_active: boolean;
}

interface PlatformData {
  queue: QueueItem[];
  uploads: UploadItem[];
  schedule: ScheduleInfo | null;
  stats: { success: number; failed: number; today: number };
}

// ─── API fetcher (serverless, no CORS issues) ─────────────────────────────────

async function fetchAllData() {
  const res = await fetch('/api/data');
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json(); // { queue, uploads, schedules }
}

async function fetchPlatformData(_platform: string): Promise<PlatformData> {
  // Data is now fetched via /api/data in loadAll() — this is called only
  // when we have the full dataset already in memory
  throw new Error('fetchPlatformData is deprecated — use fetchAllData + filter');
}

interface AllApiData {
  queue: QueueItem[];
  uploads: UploadItem[];
  schedules: ScheduleInfoRaw[];
}

interface ScheduleInfoRaw {
  platform: string;
  accounts: ScheduleAccount[];
  stagger_minutes: number;
  interval_hours: number;
  is_active: boolean;
}

// ─── Next Schedule Helper ────────────────────────────────────────────────────

function getNextScheduleTime(accounts: ScheduleAccount[]): { time: Date; account: ScheduleAccount } | null {
  if (!accounts.length) return null;
  const now = new Date();
  const candidates: { time: Date; account: ScheduleAccount }[] = [];

  for (const acct of accounts) {
    const t = new Date(now);
    t.setHours(acct.hour, acct.min, 0, 0);
    if (t <= now) t.setDate(t.getDate() + 1);
    candidates.push({ time: t, account: acct });
  }
  candidates.sort((a, b) => a.time.getTime() - b.time.getTime());
  return candidates[0];
}

// ─── Countdown helpers ────────────────────────────────────────────────────────

function getNextN(accounts: ScheduleAccount[], staggerMinutes: number, count: number): { time: Date; label: string; secondsLeft: number }[] {
  if (!accounts || !accounts.length) return [];
  const now = new Date();
  // Use UTC hours/minutes so schedule times are consistent with DB UTC times
  const nowUTCHours = now.getUTCHours();
  const nowUTCMins = now.getMinutes() + now.getUTCSeconds() / 60;
  const totalUTCMins = nowUTCHours * 60 + nowUTCMins;
  const baseMins = Math.ceil(totalUTCMins / staggerMinutes) * staggerMinutes;
  const results: { time: Date; label: string; secondsLeft: number }[] = [];

  for (let i = 0; i < count; i++) {
    const mins = baseMins + i * staggerMinutes;
    const t = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
      Math.floor(mins / 60), mins % 60, 0, 0
    ));
    if (t.getTime() <= now.getTime()) {
      t.setUTCDate(t.getUTCDate() + 1);
    }
    const secondsLeft = Math.max(0, Math.floor((t.getTime() - now.getTime()) / 1000));
    const utcH = t.getUTCHours();
    const utcM = t.getUTCMinutes();
    const label = accounts.length === 1
      ? `${String(utcH).padStart(2,'0')}:${String(utcM).padStart(2,'0')} (${i === 0 ? 'NEXT' : '+'+(i*staggerMinutes)+'m'})`
      : `${accounts[i % accounts.length].name} @ ${String(utcH).padStart(2,'0')}:${String(utcM).padStart(2,'0')}`;
    results.push({ time: t, label, secondsLeft });
  }
  return results;
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return 'NOW';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function Tooltip({ children, tip }: { children: React.ReactNode; tip: string }) {
  return (
    <div className="relative group inline-block">
      {children}
      {tip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 pointer-events-none">
          <div className="bg-gray-900 border border-gray-700 text-gray-100 text-[10px] leading-tight rounded px-2 py-1.5 whitespace-pre-wrap max-w-[220px] shadow-xl">
            {tip}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Flow Step ────────────────────────────────────────────────────────────────

type FlowStep = 'scheduled' | 'queued' | 'picking' | 'uploading' | 'success' | 'failed';

function getCurrentStep(item: QueueItem | null): FlowStep {
  if (!item) return 'scheduled';
  if (item.queue_status === 'queued') return 'queued';
  if (item.queue_status === 'uploading') return 'uploading';
  if (item.queue_status === 'failed') return 'failed';
  if (item.queue_status === 'success') return 'success';
  return 'scheduled';
}

function FlowNode({ label, status, countdown }: { label: string; status: 'done' | 'active' | 'pending' | 'success' | 'error'; countdown?: number }) {
  const colors: Record<string, string> = {
    done: 'bg-brand-600 border-brand-600 text-white',
    active: 'border-brand-400 bg-brand-900/50 text-brand-300 animate-pulse-slow',
    pending: 'border-[var(--border)] bg-transparent text-[var(--text-muted)]',
    success: 'border-[var(--success)] bg-[rgba(16,185,129,0.15)] text-[var(--success)]',
    error: 'border-[var(--error)] bg-[rgba(239,68,68,0.15)] text-[var(--error)]',
  };

  return (
    <div className="flex flex-col items-center gap-1.5">
      <Tooltip tip={countdown !== undefined && countdown > 0 ? `Jadwal berikutnya dalam ${formatCountdown(countdown)}` : ''}>
        <div className={`w-11 h-11 rounded-full border-2 flex items-center justify-center transition-all relative ${colors[status]}`}>
          {countdown !== undefined && countdown > 0 ? (
            <span className="text-[10px] font-mono font-bold leading-none text-brand-300">
              {countdown <= 3600 ? Math.ceil(countdown / 60) + 'm' : Math.floor(countdown / 3600) + 'h'}
            </span>
          ) : (
            <span className="text-xs font-bold">
              {status === 'success' || status === 'done' ? '✓' : status === 'error' ? '✗' : ''}
            </span>
          )}
          {status === 'active' && <span className="absolute inset-0 rounded-full border-2 border-brand-400 animate-ping opacity-60" />}
        </div>
      </Tooltip>
      <span className="text-[9px] text-center leading-tight font-mono uppercase tracking-wide" style={{ color: status === 'pending' ? 'var(--text-muted)' : status === 'active' ? 'var(--accent)' : status === 'success' ? 'var(--success)' : status === 'error' ? 'var(--error)' : 'var(--text-dim)' }}>
        {label}
      </span>
    </div>
  );
}

function FlowArrow({ status }: { status: 'done' | 'active' | 'pending' }) {
  const color = status === 'done' ? 'text-[var(--success)]' : status === 'active' ? 'text-brand-400' : 'text-[var(--text-muted)]';
  return (
    <div className={`flex items-center ${color} transition-colors`}>
      <IconArrow />
    </div>
  );
}

// ─── Platform Cards ───────────────────────────────────────────────────────────

const PLATFORM_CONFIG: Record<string, {
  label: string;
  icon: React.ReactNode;
  bgColor: string;
  steps: { key: FlowStep; label: string }[];
}> = {
  tevi: {
    label: 'Tevi',
    icon: <IconTevi />,
    bgColor: 'bg-gradient-to-br from-brand-900/30 to-brand-600/10',
    steps: [
      { key: 'queued', label: 'List Jadwal' },
      { key: 'picking', label: 'Pick Content' },
      { key: 'uploading', label: 'Upload Tevi' },
      { key: 'success', label: 'Success' },
    ],
  },
  tiktok: {
    label: 'TikTok',
    icon: <IconTikTok />,
    bgColor: 'bg-gradient-to-br from-pink-900/30 to-pink-600/10',
    steps: [
      { key: 'queued', label: 'List Jadwal' },
      { key: 'picking', label: 'Pick Content' },
      { key: 'uploading', label: 'Upload TikTok' },
      { key: 'success', label: 'Success' },
    ],
  },
  youtube: {
    label: 'YouTube',
    icon: <IconYoutube />,
    bgColor: 'bg-gradient-to-br from-red-900/30 to-red-600/10',
    steps: [
      { key: 'queued', label: 'List Jadwal' },
      { key: 'uploading', label: 'API Upload' },
      { key: 'success', label: 'Success' },
    ],
  },
  chatango: {
    label: 'Chatango',
    icon: <IconChatango />,
    bgColor: 'bg-gradient-to-br from-blue-900/30 to-blue-600/10',
    steps: [
      { key: 'queued', label: 'List Jadwal' },
      { key: 'picking', label: 'Pick CTA' },
      { key: 'uploading', label: 'Send CTA' },
      { key: 'success', label: 'Success' },
    ],
  },
};

function FlowDiagram({ platform, currentStep, currentItem, accounts, stagger }: { platform: string; currentStep: FlowStep; currentItem: QueueItem | null; accounts?: ScheduleAccount[]; stagger?: number }) {
  const config = PLATFORM_CONFIG[platform];
  if (!config) return null;

  const steps = config.steps;
  const [nowSecs, setNowSecs] = useState(0);

  useEffect(() => {
    const tick = () => setNowSecs(Math.floor(Date.now() / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  let highlightIdx = -1;
  if (currentStep === 'scheduled') highlightIdx = -1;
  else if (currentStep === 'queued') highlightIdx = 0;
  else if (currentStep === 'picking') highlightIdx = 1;
  else if (currentStep === 'uploading') highlightIdx = 2;
  else if (currentStep === 'success') highlightIdx = steps.length - 1;
  else if (currentStep === 'failed') highlightIdx = steps.length - 1;

  // Countdown for first step using stagger-based rolling schedule
  const countdownSecs = (() => {
    if (!accounts || accounts.length === 0) return undefined;
    const upcoming = getNextN(accounts, stagger ?? 80, 1);
    return upcoming[0]?.secondsLeft;
  })();

  return (
    <div className="flex items-center gap-2 px-4 py-3 overflow-x-auto">
      {steps.map((step, i) => {
        let status: 'done' | 'active' | 'pending' | 'success' | 'error' = 'pending';
        if (currentStep === 'failed' && i === steps.length - 1) {
          status = 'error';
        } else if (currentStep === 'success' && i === steps.length - 1) {
          status = 'success';
        } else if (highlightIdx > i) {
          status = 'done';
        } else if (highlightIdx === i) {
          status = 'active';
        }

        const showCountdown = i === 0 && countdownSecs !== undefined && highlightIdx <= 0;

        return (
          <div key={step.key} className="flex items-center">
            <FlowNode label={step.label} status={status} countdown={showCountdown ? countdownSecs : undefined} />
            {i < steps.length - 1 && <FlowArrow status={highlightIdx > i ? 'done' : highlightIdx === i ? 'active' : 'pending'} />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Schedule Info ────────────────────────────────────────────────────────────

function ScheduleInfo({ schedule }: { schedule: ScheduleInfo | null }) {
  // Hooks MUST be called unconditionally at the top
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  if (!schedule || !schedule.accounts || schedule.accounts.length === 0) {
    return <span className="text-[var(--text-muted)] text-xs">No schedule</span>;
  }

  const stagger = schedule.stagger_minutes || 80;
  const upcoming = getNextN(schedule.accounts, stagger, 4);
  const nextTime = upcoming[0];

  return (
    <div className="flex flex-col gap-1">
      {/* Next countdown pill */}
      {nextTime && (
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-brand-900/60 border border-brand-600/50">
            <span className="text-[9px] font-mono text-brand-400 uppercase tracking-wide">Next</span>
            <span className="text-[11px] font-mono font-bold text-brand-300">
              {formatCountdown(nextTime.secondsLeft)}
            </span>
          </div>
          <span className="text-[9px] text-[var(--text-muted)] font-mono">
            {schedule.interval_hours ? `· every ${schedule.interval_hours}h` : ''} · {schedule.accounts[0]?.name || ''}
          </span>
        </div>
      )}
      {/* Next 4 uploads list */}
      <div className="flex flex-col gap-0.5">
        {upcoming.map((item, i) => (
          <div key={i} className={`flex items-center gap-1.5 text-[9px] font-mono px-1.5 py-0.5 rounded ${
            i === 0 ? 'text-brand-300 bg-brand-900/20' : 'text-[var(--text-dim)]'
          }`}>
            <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[8px] ${
              i === 0 ? 'border-brand-400 bg-brand-900/40 text-brand-300' : 'border-[var(--border)] text-[var(--text-muted)]'
            }`}>
              {i + 1}
            </span>
            <span className="flex-1 truncate">{item.label}</span>
            <span className={i === 0 ? 'text-brand-400' : 'opacity-60'}>
              {formatCountdown(item.secondsLeft)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Content List ─────────────────────────────────────────────────────────────

function buildUploadTip(item: UploadItem): string {
  const lines = [`📤 ${item.content_name}`];
  if (item.account_name) lines.push(`👤 ${item.account_name}`);
  if (item.duration_ms) {
    const s = Math.floor(item.duration_ms / 1000);
    lines.push(`⏱ ${s}s`);
  }
  if (item.error_message) lines.push(`❌ ${item.error_message}`);
  lines.push(`🕐 ${item.uploaded_at ? new Date(item.uploaded_at).toLocaleString('id-ID') : '?'}`);
  return lines.join('\n');
}

function ContentList({ items, queue, type }: {
  items: (QueueItem | UploadItem)[];
  queue: QueueItem[];
  type: 'upcoming' | 'recent';
}) {
  const displayItems = items.slice(0, 4);

  if (!displayItems.length) {
    return (
      <div className="py-6 text-center text-[var(--text-muted)] text-xs">
        {type === 'upcoming' ? 'Tidak ada konten di queue' : 'Belum ada upload'}
      </div>
    );
  }

  return (
    <div className="divide-y divide-[var(--border)]">
      {displayItems.map((item) => {
        const isQueue = 'queue_status' in item;
        const isUpload = !isQueue;
        const uploadItem = isUpload ? (item as UploadItem) : null;
        const queueItem = isQueue ? (item as QueueItem) : null;
        const status = isQueue ? queueItem!.queue_status : uploadItem!.status;
        const uploadedAt = isQueue ? queueItem!.uploaded_at : uploadItem!.uploaded_at;
        const account = item.account_name;
        const contentName = item.content_name;
        const caption = isQueue ? queueItem!.caption : null;
        const errorMsg = isUpload ? uploadItem!.error_message : null;
        const price = isQueue ? queueItem!.price : null;

        const badgeClass = status === 'success' ? 'badge-success' : status === 'queued' ? 'badge-queued' : status === 'uploading' ? 'badge-uploading' : 'badge-failed';
        const dotClass = status === 'success' ? 'dot-success' : 'dot-failed';

        const tip = isUpload ? buildUploadTip(uploadItem!) : [
          `📋 ${contentName}`,
          account ? `👤 ${account}` : null,
          caption ? `💬 ${caption}` : null,
          price ? `⭐ ${price}` : null,
          uploadedAt ? `🕐 ${new Date(uploadedAt).toLocaleString('id-ID')}` : null,
        ].filter(Boolean).join('\n');

        return (
          <div key={item.id} className="content-item">
            <div className={`timeline-dot ${dotClass}`} />
            <div className="flex-1 min-w-0">
              <Tooltip tip={tip}>
                <div className="flex flex-col gap-0.5">
                  {/* Account name — primary */}
                  {account ? (
                    <div className="text-[11px] font-semibold text-[var(--text)] truncate">{account}</div>
                  ) : null}
                  {/* Time / schedule */}
                  <div className="flex items-center gap-1.5">
                    {isQueue && queueItem!.scheduled_at ? (
                      <span className="text-[10px] font-mono text-brand-400">
                        {format(new Date(queueItem!.scheduled_at), 'HH:mm', { locale: id })}
                      </span>
                    ) : uploadedAt ? (
                      <span className="text-[10px] font-mono text-[var(--text-dim)]">
                        {formatDistanceToNow(new Date(uploadedAt), { addSuffix: true, locale: id })}
                      </span>
                    ) : null}
                    {/* Short extras */}
                    {caption && <span className="text-[9px] text-[var(--text-muted)] truncate max-w-[80px]">{caption.slice(0,20)}</span>}
                    {price && <span className="text-[9px] text-yellow-400">⭐{price}</span>}
                    {errorMsg && <span className="text-[9px] text-[var(--error)] truncate max-w-[80px]">{errorMsg.slice(0,20)}</span>}
                  </div>
                  {/* Content name — secondary, only if no account */}
                  {!account && (
                    <div className="text-[10px] text-[var(--text-muted)] truncate">{contentName}</div>
                  )}
                </div>
              </Tooltip>
            </div>
            <span className={`badge shrink-0 ${badgeClass}`}>
              {status === 'uploading' && <span className="animate-pulse">●</span>}
              {status}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Platform Card ────────────────────────────────────────────────────────────

function PlatformCard({ platform, data }: { platform: string; data: PlatformData | null }) {
  const config = PLATFORM_CONFIG[platform];
  if (!config) return null;

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [localData, setLocalData] = useState<PlatformData | null>(data);

  const currentItem = localData?.queue.find(i => i.queue_status === 'queued' || i.queue_status === 'uploading') || null;
  const currentStep = getCurrentStep(currentItem);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/data');
      if (!res.ok) throw new Error('API error');
      const api = await res.json();
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString();
      const queue = (api.queue || []).filter((q: QueueItem) => q.platform === platform);
      const uploads = (api.uploads || []).filter((u: UploadItem) => u.platform === platform);
      const sched = (api.schedules || []).find((s: ScheduleInfoRaw) => s.platform === platform) || null;
      const stats = {
        success: uploads.filter((u: UploadItem) => u.status === 'success').length,
        failed: uploads.filter((u: UploadItem) => u.status === 'failed').length,
        today: uploads.filter((u: UploadItem) => u.status === 'success' && u.uploaded_at >= todayStr).length,
      };
      setLocalData({ queue, uploads, schedule: sched, stats });
    } catch (e) { console.error(e); }
    setIsRefreshing(false);
  }, [platform]);

  const upcoming = localData?.queue.filter(i => i.queue_status === 'queued') || [];
  const recent = (localData?.uploads || []).slice(0, 4);
  const activeItem = localData?.queue.find(i => i.queue_status === 'uploading') || null;
  const lastUpload = recent[0] || null;
  const accounts = localData?.schedule?.accounts ?? [];
  const stagger = localData?.schedule?.stagger_minutes ?? 80;

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className={`platform-header ${config.bgColor}`}>
        <div className="platform-icon bg-[var(--bg-card)] border border-[var(--border)]">
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm text-[var(--text)]">{config.label}</div>
          <div className="mt-1">
            <ScheduleInfo schedule={localData?.schedule || null} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Stats */}
          {localData?.stats && (
            <div className="flex gap-3 text-xs">
              <span className="text-[var(--success)]">{localData.stats.today}✅</span>
              <span className="text-[var(--error)]">{localData.stats.failed}❌</span>
              <span className="text-[var(--text-dim)]">{localData.stats.success} total</span>
            </div>
          )}
          {/* Refresh */}
          <button
            onClick={refresh}
            className="text-[var(--text-dim)] hover:text-[var(--text)] transition-colors p-1 rounded"
            title="Refresh"
          >
            <span className={isRefreshing ? 'refresh-ring inline-block' : ''}>
              <IconRefresh />
            </span>
          </button>
        </div>
      </div>

      {/* Flow Diagram */}
      <div className="border-b border-[var(--border)] bg-[var(--bg-dark)]/50">
        <FlowDiagram platform={platform} currentStep={currentStep} currentItem={currentItem} accounts={accounts} stagger={stagger} />
      </div>

      {/* Active / Last upload */}
      {(activeItem || lastUpload) && (
        <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-dark)]/30">
          {activeItem ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-brand-400 animate-pulse">●</span>
              <span className="text-[var(--text-dim)]">Sedang:</span>
              <span className="text-[var(--text)] truncate flex-1">{activeItem.content_name}</span>
              <span className="badge badge-uploading">uploading</span>
            </div>
          ) : lastUpload ? (
            <Tooltip tip={buildUploadTip(lastUpload)}>
              <div className="flex items-center gap-2 text-xs">
                <span className={lastUpload.status === 'success' ? 'text-[var(--success)]' : 'text-[var(--error)]'}>
                  {lastUpload.status === 'success' ? <IconCheck /> : <IconX />}
                </span>
                <span className="text-[var(--text-dim)]">Terakhir:</span>
                <span className="text-[var(--text)] truncate flex-1">{lastUpload.content_name}</span>
                {lastUpload.account_name && (
                  <span className="text-[var(--text-muted)] text-[10px] font-mono">{lastUpload.account_name}</span>
                )}
                <span className={lastUpload.status === 'success' ? 'text-[var(--success)]' : 'text-[var(--error)]'}>{lastUpload.status}</span>
              </div>
            </Tooltip>
          ) : null}
        </div>
      )}

      {/* Content Lists */}
      <div className="grid grid-cols-2 divide-x divide-[var(--border)]">
        <div>
          <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border)] bg-[var(--bg-dark)]/20">
            📋 Queue ({upcoming.length} ready)
          </div>
          {upcoming.length === 0 ? (
            <div className="py-4 text-center text-[var(--text-muted)] text-xs">Queue kosong</div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {upcoming.slice(0, 4).map((item, idx) => {
                const nextUp = getNextN(
                  accounts.length ? accounts : [{ name: accounts[0]?.name ?? '', hour: 0, min: 0 }],
                  stagger,
                  idx + 1,
                );
                const pickTime = nextUp[idx];
                return (
                  <div key={item.id} className="content-item">
                    <div className="timeline-dot dot-queued" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-semibold text-[var(--text)] truncate">
                        {item.account_name || accounts[0]?.name || '—'}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {pickTime ? (
                          <>
                            <span className="text-[10px] font-mono text-brand-400">
                              {String(pickTime.time.getHours()).padStart(2, '0')}:{String(pickTime.time.getMinutes()).padStart(2, '0')}
                            </span>
                            <span className="text-[9px] text-[var(--text-muted)]">
                              {formatCountdown(pickTime.secondsLeft)}
                            </span>
                          </>
                        ) : null}
                        <Tooltip
                          tip={[
                            `📋 ${item.content_name}`,
                            item.caption ? `💬 ${item.caption}` : null,
                            item.price ? `⭐ ${item.price}` : null,
                          ]
                            .filter(Boolean)
                            .join('\n')}
                        >
                          <span className="text-[9px] text-[var(--text-dim)] truncate max-w-[80px] cursor-help underline decoration-dotted">
                            {item.content_name.length > 22 ? item.content_name.slice(0, 22) + '…' : item.content_name}
                          </span>
                        </Tooltip>
                      </div>
                    </div>
                    <span className={`badge shrink-0 ${idx === 0 ? 'bg-brand-700 border-brand-500 text-brand-200' : 'badge-queued'}`}>
                      {idx === 0 ? 'NEXT' : `#${idx + 1}`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div>
          <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border)] bg-[var(--bg-dark)]/20">
            ✅ Terakhir Upload
          </div>
          <ContentList items={recent} queue={[]} type="recent" />
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ platform }: { platform: string }) {
  const config = PLATFORM_CONFIG[platform];
  return (
    <div className="card p-8 text-center">
      <div className="platform-icon mx-auto mb-3 bg-[var(--bg-dark)] border border-[var(--border)]">
        {config?.icon}
      </div>
      <div className="text-sm text-[var(--text)]">{config?.label} — Belum ada data</div>
      <div className="text-xs text-[var(--text-muted)] mt-1">Autopilot belum menulis data ke dashboard</div>
    </div>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────

function Header({ lastUpdate }: { lastUpdate: Date | null }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg-dark)]/95 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center">
            <span className="text-white text-sm font-bold">B</span>
          </div>
          <div>
            <div className="font-bold text-sm text-[var(--text)]">BabyVal Autopilot</div>
            <div className="text-[10px] text-[var(--text-muted)] font-mono">
              {now ? format(now, "EEE, dd MMM yyyy · HH:mm:ss", { locale: id }) : 'Connecting…'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-dim)]">
            <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
            <span>All Systems Online</span>
          </div>
          {lastUpdate && (
            <div className="text-[10px] text-[var(--text-muted)] font-mono">
              Updated {formatDistanceToNow(lastUpdate, { locale: id })}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const PLATFORMS = ['tevi', 'tiktok', 'youtube', 'chatango'];

export default function DashboardPage() {
  const [allData, setAllData] = useState<Record<string, PlatformData>>({});
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const loadAll = useCallback(async () => {
    try {
      const api: AllApiData = await fetchAllData();

      const results: Record<string, PlatformData> = {};
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString();

      for (const p of PLATFORMS) {
        const queue = (api.queue || []).filter(q => q.platform === p).slice(0, 20);
        const uploads = (api.uploads || []).filter(u => u.platform === p).slice(0, 10);
        const sched = (api.schedules || []).find(s => s.platform === p) || null;

        const stats = {
          success: uploads.filter(u => u.status === 'success').length,
          failed: uploads.filter(u => u.status === 'failed').length,
          today: uploads.filter(u => u.status === 'success' && u.uploaded_at >= todayStr).length,
        };

        results[p] = { queue, uploads, schedule: sched, stats };
      }

      setAllData(results);
      setLastUpdate(new Date());
    } catch (e) {
      console.error('loadAll failed:', e);
    } finally {
      setIsLoading(false);
    }
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    loadAll();
    const t = setInterval(loadAll, 30_000);
    return () => clearInterval(t);
  }, [mounted, loadAll]);

  // Prevent SSR — render skeleton on server, real content after client mount
  if (!mounted) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg-dark)' }}>
        <Header lastUpdate={null} />
        <main className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card p-0 overflow-hidden">
                <div className="skeleton h-14" />
                <div className="skeleton h-12" />
                <div className="skeleton h-24" />
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-dark)' }}>
      <Header lastUpdate={lastUpdate} />

      <main className="max-w-7xl mx-auto px-4 py-6">
        {isLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card p-0 overflow-hidden">
                <div className="skeleton h-14" />
                <div className="skeleton h-12" />
                <div className="skeleton h-24" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && Object.keys(allData).length === 0 && (
          <div className="text-center py-20">
            <div className="text-2xl mb-2">📡</div>
            <div className="text-[var(--text)] font-medium mb-2">Connecting to Supabase…</div>
            <div className="text-xs text-[var(--text-muted)]">
              Pastikan schema sudah di-run di Supabase SQL editor
            </div>
          </div>
        )}

        {!isLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {PLATFORMS.map((platform) => (
              <ErrorBoundary key={platform} name={platform}>
                <PlatformCard
                  platform={platform}
                  data={allData[platform] || null}
                />
              </ErrorBoundary>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-[var(--text-muted)] text-xs font-mono">
          babyval-autopilot · Auto-refresh 30s · Data from Supabase
        </div>
      </main>
    </div>
  );
}
