-- Supabase schema for babyval-autopilot dashboard
-- Run this in Supabase SQL editor

-- Content queue per platform
CREATE TABLE IF NOT EXISTS content_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL, -- 'tevi', 'tiktok', 'youtube', 'chatango'
  account_name TEXT,
  content_name TEXT NOT NULL,
  content_path TEXT,
  queue_status TEXT NOT NULL DEFAULT 'queued', -- 'queued', 'uploading', 'success', 'failed'
  caption TEXT,
  price INTEGER,
  scheduled_at TIMESTAMPTZ,
  uploaded_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Upload log per platform
CREATE TABLE IF NOT EXISTS upload_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL,
  account_name TEXT,
  content_name TEXT NOT NULL,
  status TEXT NOT NULL, -- 'success', 'failed'
  duration_ms INTEGER,
  error_message TEXT,
  metadata JSONB, -- { follower_count, post_count, prev_follower_count, prev_post_count, delta_followers, delta_posts, fetched_at }
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add metadata column if table already exists (migration)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'upload_log' AND column_name = 'metadata') THEN
    ALTER TABLE upload_log ADD COLUMN metadata JSONB;
  END IF;
END $$;

-- Schedule config per platform
CREATE TABLE IF NOT EXISTS schedule_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL UNIQUE,
  accounts JSONB NOT NULL, -- [{name, hour, min}]
  stagger_minutes INTEGER DEFAULT 10,
  interval_hours NUMERIC DEFAULT 2,
  is_active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE content_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_config ENABLE ROW LEVEL SECURITY;

-- Allow anon read/write (dashboard + autopilots use same project)
CREATE POLICY "Allow all on content_queue" ON content_queue FOR ALL USING (true);
CREATE POLICY "Allow all on upload_log" ON upload_log FOR ALL USING (true);
CREATE POLICY "Allow all on schedule_config" ON schedule_config FOR ALL USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_content_queue_platform ON content_queue(platform);
CREATE INDEX IF NOT EXISTS idx_content_queue_status ON content_queue(queue_status);
CREATE INDEX IF NOT EXISTS idx_upload_log_platform ON upload_log(platform);
CREATE INDEX IF NOT EXISTS idx_upload_log_uploaded_at ON upload_log(uploaded_at DESC);

-- Insert default schedule config
INSERT INTO schedule_config (platform, accounts, stagger_minutes, interval_hours, is_active)
VALUES
  ('tevi', '[{"name":"@cutieval","hour":0,"min":0}]', 148, 2, true),
  ('tiktok', '[{"name":"zelda23345","hour":0,"min":0},{"name":"sora88908","hour":0,"min":16},{"name":"kira22252","hour":0,"min":32},{"name":"sukii27290","hour":0,"min":48},{"name":"miku34456","hour":1,"min":4},{"name":"aria69144","hour":1,"min":20},{"name":"emilia11660","hour":1,"min":36},{"name":"mikasa88319","hour":1,"min":52},{"name":"temari700","hour":2,"min":8}]', 16, 2, true),
  ('youtube', '[{"name":"babyval14","hour":0,"min":0},{"name":"cutebabyval14","hour":0,"min":10}]', 10, 2, true),
  ('chatango', '[{"name":"cutieval@poinekopoi","hour":0,"min":0}]', 220, 3, true)
ON CONFLICT (platform) DO NOTHING;
