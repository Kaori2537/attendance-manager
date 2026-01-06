// frontend/app/daily-reports/[date]/page.tsx
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { DailyReportSummaryCard } from "../components/DailyReportSummaryCard";
import { SessionMemoEditor } from "../components/SessionMemoEditor";

type UiTask = { id: string; title: string; minutes: number };

type UiSession = {
  id: string;
  sessionNo: number;
  plannedMinutes: number;
  actualMinutes: number;
  summary: string | null;
  troubles: string | null;
  announcements: string | null;
  plannedTasks: UiTask[];
  actualTasks: UiTask[];
  // ✅ 追加：Slack由来リアクション集計（例: { "+1": 3, "tada": 1 }）
  reactions: Record<string, number>;
};

function isYmd(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function minutesToHoursText(minutes: number) {
  return `${(minutes / 60).toFixed(1)}h`;
}

// ✅ 表示順を固定（Slackっぽさ）
const REACTION_ORDER = [
  { label: "👍", key: "+1" },
  { label: "🎉", key: "tada" },
  { label: "👏", key: "clap" },
  { label: "✅", key: "white_check_mark" },
  { label: "🙏", key: "pray" },
  { label: "👀", key: "eyes" },
] as const;

function ReactionSummary({ reactions }: { reactions: Record<string, number> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {REACTION_ORDER.map((r) => (
        <span
          key={r.key}
          className="rounded-full border px-2 py-0.5 text-sm text-muted-foreground"
        >
          {r.label} {reactions?.[r.key] ?? 0}
        </span>
      ))}
    </div>
  );
}

/**
 * backend の snake_case を UI用に正規化
 * - 合計は planned_minutes / actual_minutes を採用
 */
function normalizeSessions(sessions: unknown[]): UiSession[] {
  const taskTitle = (t: any) => t.title ?? t.name ?? t.task_name ?? "(no title)";
  const taskMinutes = (t: any) => {
    const v = t.minutes ?? 0;
    return typeof v === "number" ? v : Number(v ?? 0);
  };

  return (sessions as any[])
    .slice()
    .sort((a, b) => (a.session_no ?? 0) - (b.session_no ?? 0))
    .map((s) => ({
      id: s.id,
      sessionNo: s.session_no,
      plannedMinutes: s.planned_minutes ?? 0,
      actualMinutes: s.actual_minutes ?? 0,
      summary: s.summary ?? null,
      troubles: s.troubles ?? null,
      announcements: s.announcements ?? null,
      plannedTasks: (s.plannedTasks ?? []).map(
        (t: any): UiTask => ({ id: t.id, title: taskTitle(t), minutes: taskMinutes(t) })
      ),
      actualTasks: (s.actualTasks ?? []).map(
        (t: any): UiTask => ({ id: t.id, title: taskTitle(t), minutes: taskMinutes(t) })
      ),
      reactions: s.reactions ?? {}, // ✅ 追加
    }));
}

export default async function Page({
  params,
}: {
  params: Promise<{ date: string }> | { date: string };
}) {
  const resolvedParams = await Promise.resolve(params);
  const date = resolvedParams.date;

  if (!isYmd(date)) notFound();

  const session = await getServerSession(authOptions);
  const apiToken = (session?.user as any)?.apiToken as string | undefined;

  if (!apiToken) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/daily-reports/${date}`)}`);
  }

  const backendBase = process.env.NEXT_PUBLIC_API_URL;
  if (!backendBase) {
    throw new Error("NEXT_PUBLIC_API_URL missing");
  }

  const backendUrl = new URL(`${backendBase}/database/daily-reports/get-by-date`);
  backendUrl.searchParams.set("date", date);

  const res = await fetch(backendUrl.toString(), {
    headers: { Authorization: `Bearer ${apiToken}` },
    cache: "no-store",
  });

  const raw = await res.text();
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    data = { ok: false, error: "Invalid JSON from backend", raw };
  }

  if (!res.ok || !data?.ok) {
    if (res.status === 401) {
      redirect(`/login?callbackUrl=${encodeURIComponent(`/daily-reports/${date}`)}`);
    }
    throw new Error(data?.error ?? `Failed to load daily report (HTTP ${res.status})`);
  }

  const sessions = normalizeSessions(data.sessions ?? []);

  // UI側でも 1..3 を保証
  const map = new Map<number, UiSession>();
  for (const s of sessions) map.set(s.sessionNo, s);

  const sessions123: UiSession[] = [1, 2, 3].map((no) => {
    const existing = map.get(no);
    return (
      existing ?? {
        id: "",
        sessionNo: no,
        plannedMinutes: 0,
        actualMinutes: 0,
        summary: null,
        troubles: null,
        announcements: null,
        plannedTasks: [],
        actualTasks: [],
        reactions: {}, // ✅ 追加
      }
    );
  });

  const selectedDate = new Date(`${date}T00:00:00`);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      {/* 左：セッション詳細 */}
      <div className="space-y-6">
        <header>
          <h1 className="text-lg font-semibold">日報</h1>
          <p className="text-muted-foreground mt-4">{date}</p>
        </header>

        <div className="space-y-6">
          {sessions123.map((s) => (
            <section key={s.sessionNo} className="rounded-xl border p-4 space-y-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-semibold">Session {s.sessionNo}</h2>
                <div className="text-sm text-muted-foreground tabular-nums">
                  Planned {minutesToHoursText(s.plannedMinutes)} · Actual{" "}
                  {minutesToHoursText(s.actualMinutes)}
                </div>
              </div>

              {/* メモ編集 + 保存 */}
              {s.id ? (
                <>
                  <SessionMemoEditor
                    sessionId={s.id}
                    summary={s.summary}
                    troubles={s.troubles}
                    announcements={s.announcements}
                  />

                  {/* ✅ Slack由来リアクション（表示のみ） */}
                  <ReactionSummary reactions={s.reactions} />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Session ID が取得できませんでした</p>
              )}

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Planned</p>
                {s.plannedTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No planned tasks</p>
                ) : (
                  <ul className="space-y-2">
                    {s.plannedTasks.map((t) => (
                      <li key={t.id} className="flex justify-between gap-4">
                        <span className="text-sm">{t.title}</span>
                        <span className="text-sm tabular-nums text-muted-foreground">
                          {minutesToHoursText(t.minutes)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Actual</p>
                {s.actualTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No actual tasks</p>
                ) : (
                  <ul className="space-y-2">
                    {s.actualTasks.map((t) => (
                      <li key={t.id} className="flex justify-between gap-4">
                        <span className="text-sm">{t.title}</span>
                        <span className="text-sm tabular-nums text-muted-foreground">
                          {minutesToHoursText(t.minutes)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* 右：Summary */}
      <DailyReportSummaryCard selectedDate={selectedDate} selectedYmd={date} sessions={sessions123} />
    </div>
  );
}
