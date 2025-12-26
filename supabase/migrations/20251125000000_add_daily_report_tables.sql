-- ============================
-- daily_reports (日報テーブル)
-- ============================
CREATE TABLE IF NOT EXISTS public.daily_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  report_date date NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_reports_user_date_unique UNIQUE (user_id, report_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_daily_reports_user_id
  ON public.daily_reports(user_id);

CREATE INDEX IF NOT EXISTS idx_daily_reports_report_date
  ON public.daily_reports(report_date);
