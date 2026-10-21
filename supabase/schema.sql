-- Supabase 任务表结构（按你的要求：id 为 bigint 自增主键，priority 使用中文）
-- 在 Supabase SQL Editor 中执行后，即可通过 REST API 访问

CREATE TABLE IF NOT EXISTS public.tasks (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL CHECK (char_length(trim(title)) > 0),
  priority TEXT NOT NULL CHECK (priority IN ('高', '中', '低')) DEFAULT '中',
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON public.tasks (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks (priority);

-- 允许匿名用户（anon）对 tasks 表进行读写，使用 ANON_KEY 时需要此策略
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_anon_all" ON public.tasks;
CREATE POLICY "allow_anon_all"
  ON public.tasks
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);
