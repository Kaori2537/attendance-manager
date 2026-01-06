// frontend/app/admin/daily-reports/[userId]/[date]/page.tsx
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { SessionMemoEditor } from "@/app/daily-reports/components/SessionMemoEditor";
import AdminDailyReportReactions from "@/app/admin/components/AdminDailyReportReactions";
import AdminDailyReportComments from "@/app/admin/components/AdminDailyReportComments";

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
  // reactions は今後表示に使うなら残してOK（でも Reactionsコンポーネントには渡さない）
  reactions: Record<string, number>;
};

function isYmd(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function minutesToHoursText(minutes: number) {
  return `${(minutes / 60).toFixed(1)}h`;
}

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
      reactions: s.reactions ?? {},
    }));
}

function isAdmin(session: any) {
  return (session?.user as any)?.role === "admin";
}

export default async function Page({
  params,
}: {
  params: Promise<{ userId: string; date: string }> | { userId: string; date: string };
}) {
  const resolved = await Promise.resolve(params);
  const userId = resolved.userId;
  const date = resolved.date;

  if (!userId) notFound();
  if (!isYmd(date)) notFound();

  const session = await getServerSession(authOptions);
  const apiToken = (session?.user as any)?.apiToken as string | undefined;

  if (!apiToken) {
    redirect(
      `/login?callbackUrl=${encodeURIComponent(`/admin/daily-reports/${userId}/${date}`)}`
    );
  }
  if (!isAdmin(session)) {
    redirect(`/daily-reports/${date}`);
  }

  const backendBase = process.env.NEXT_PUBLIC_API_URL;
  if (!backendBase) throw new Error("NEXT_PUBLIC_API_URL missing");

  const backendUrl = new URL(`${backendBase}/database/daily-reports/get-by-date`);
  backendUrl.searchParams.set("date", date);
  backendUrl.searchParams.set("userId", userId);

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
      redirect(
        `/login?callbackUrl=${encodeURIComponent(`/admin/daily-reports/${userId}/${date}`)}`
      );
    }
    throw new Error(data?.error ?? `Failed to load daily report (HTTP ${res.status})`);
  }

  const sessions = normalizeSessions(data.sessions ?? []);

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
        reactions: {},
      }
    );
  });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold">Admin / 日報</h1>
        <p className="text-sm text-muted-foreground">
          userId: <span className="font-mono text-xs">{userId}</span> / date:{" "}
          <span className="font-mono text-xs">{date}</span>
        </p>
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

            {s.id ? (
              <>
                <SessionMemoEditor
                  sessionId={s.id}
                  summary={s.summary}
                  troubles={s.troubles}
                  announcements={s.announcements}
                />

                {/* ✅ 出勤メッセージ用リアクション */}
               <AdminDailyReportReactions
  sessionId={s.id}
  apiBase={backendBase}
  apiToken={apiToken}
  kind="clock_in"
/>

<AdminDailyReportReactions
  sessionId={s.id}
  apiBase={backendBase}
  apiToken={apiToken}
  kind="clock_out"
/>


                <AdminDailyReportComments
                  sessionId={s.id}
                  apiBase={backendBase}
                  apiToken={apiToken}
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                このセッションはまだ作成されていません（Session ID が取得できませんでした）
              </p>
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
  );
}
