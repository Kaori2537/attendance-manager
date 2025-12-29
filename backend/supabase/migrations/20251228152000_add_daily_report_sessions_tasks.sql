-- ============================================================
-- Daily Reports v2: sessions (max 3/day) + tasks + categories
-- Existing table: public.daily_reports (id, user_id, report_date, content, ...)
-- ============================================================

-- 1) Categories (for weekly report / pie chart)
create table if not exists public.task_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2) Sessions (セッション1/2/3)
create table if not exists public.daily_report_sessions (
  id uuid primary key default gen_random_uuid(),
  daily_report_id uuid not null references public.daily_reports(id) on delete cascade,

  -- max 3 sessions/day
  session_no int not null check (session_no between 1 and 3),

  status text not null default 'draft'
    check (status in ('draft','in_progress','completed')),

  start_at timestamptz,
  end_at timestamptz,

  -- minutes in DB
  planned_minutes int not null default 0 check (planned_minutes >= 0),
  actual_minutes int not null default 0 check (actual_minutes >= 0),

  -- end-of-work text blocks
  summary text,        -- 本日のまとめ
  troubles text,       -- 困っていること・相談したいこと
  announcements text,  -- 連絡事項

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- prevent duplicate session_no per day
  unique (daily_report_id, session_no)
);

create index if not exists idx_daily_report_sessions_daily_report_id
  on public.daily_report_sessions (daily_report_id);

create index if not exists idx_daily_report_sessions_start_end
  on public.daily_report_sessions (start_at, end_at);

-- 3) Tasks (planned/actual)
create table if not exists public.daily_report_tasks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.daily_report_sessions(id) on delete cascade,

  kind text not null check (kind in ('planned','actual')),
  title text not null,

  -- minutes in DB
  minutes int not null default 0 check (minutes >= 0),

  category_id uuid references public.task_categories(id),
  sort_order int not null default 0,

  created_at timestamptz not null default now()
);

create index if not exists idx_daily_report_tasks_session_kind_sort
  on public.daily_report_tasks (session_id, kind, sort_order);

create index if not exists idx_daily_report_tasks_category
  on public.daily_report_tasks (category_id);
