"use client";

import { useMemo } from "react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

type Task = {
  id: string;
  title: string;
  minutes: number;
};

type Session = {
  sessionNo?: number;
  session_no?: number;

  plannedMinutes?: number;
  planned_minutes?: number;

  actualMinutes?: number;
  actual_minutes?: number;

  plannedTasks: Task[];
  actualTasks: Task[];

  summary?: string | null;
  troubles?: string | null;
  announcements?: string | null;

  reactions?: Record<string, number>;
  comments?: {
    id: string;
    userId: string | null;
    text: string | null;
    source: string | null;
    createdAt: string;
  }[];
};

const EMOJI_MAP: Record<string, string> = {
  "+1": "👍",
  tada: "🎉",
  clap: "👏",
  white_check_mark: "✅",
  pray: "🙏",
  eyes: "👀",
};

type AttendancePayload = {
  attendanceId: string;
  workSessionId: string | null;
  clockIn: string | null;
  clockOut: string | null;
  breaks: { id: string; start: string | null; end: string | null }[];
  breakMinutes: number;
  workMinutes: number | null;
};

interface Props {
  selectedDate: Date | undefined;
  sessions: Session[];
  selectedYmd: string | null;
  attendance?: AttendancePayload | null;
}

function minutesToHoursText(minutes: number) {
  return `${(minutes / 60).toFixed(1)}h`;
}

function sumMinutes(tasks: Task[]) {
  return tasks.reduce((acc, t) => acc + (t.minutes ?? 0), 0);
}

function formatJpDateTime(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

export function DailyReportSummaryCard({
  selectedDate,
  sessions,
  selectedYmd,
  attendance,
}: Props) {
  // セッション1のみを取得
  const session = useMemo(() => {
    const s = (sessions ?? []).find(
      (s) => s.sessionNo === 1 || s.session_no === 1
    );
    if (!s) return null;

    return {
      ...s,
      plannedMinutes:
        typeof s.plannedMinutes === "number"
          ? s.plannedMinutes
          : typeof s.planned_minutes === "number"
          ? s.planned_minutes
          : undefined,
      actualMinutes:
        typeof s.actualMinutes === "number"
          ? s.actualMinutes
          : typeof s.actual_minutes === "number"
          ? s.actual_minutes
          : undefined,
      plannedTasks: s.plannedTasks ?? [],
      actualTasks: s.actualTasks ?? [],
    };
  }, [sessions]);

  const plannedTasks = session?.plannedTasks ?? [];
  const actualTasks = session?.actualTasks ?? [];

  const plannedMin =
    typeof session?.plannedMinutes === "number"
      ? session.plannedMinutes
      : sumMinutes(plannedTasks);

  const actualMin =
    typeof session?.actualMinutes === "number"
      ? session.actualMinutes
      : sumMinutes(actualTasks);

  const hasAttendance = !!attendance?.attendanceId;

  const hasReactions = session?.reactions && Object.keys(session.reactions).length > 0;
  const hasComments = session?.comments && session.comments.length > 0;

  // 日報データが実質的に空かどうか（タスクもメモも何もない）
  const hasNoContent =
    plannedTasks.length === 0 &&
    actualTasks.length === 0 &&
    !session?.summary?.trim() &&
    !session?.troubles?.trim() &&
    !session?.announcements?.trim();

  // 日報データがない場合、または実質的に空の場合
  if (!session || hasNoContent) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>詳細情報</CardTitle>
          <CardDescription>
            {selectedDate?.toLocaleDateString("ja-JP", {
              year: "numeric",
              month: "long",
              day: "numeric",
              weekday: "long",
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">この日の日報データはありません</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>詳細情報</CardTitle>
        <CardDescription>
          {selectedDate?.toLocaleDateString("ja-JP", {
            year: "numeric",
            month: "long",
            day: "numeric",
            weekday: "long",
          })}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-8">
        {/* --- 勤怠情報 --- */}
        {hasAttendance && (
          <section className="space-y-2">
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">出勤</span>
                <span className="tabular-nums">{formatTime(attendance?.clockIn ?? null)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">退勤</span>
                <span className="tabular-nums">{formatTime(attendance?.clockOut ?? null)}</span>
              </div>

              <div className="pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">休憩合計</span>
                  <span className="tabular-nums">
                    {attendance ? `${attendance.breakMinutes}分` : "-"}
                  </span>
                </div>

                {attendance?.breaks?.length ? (
                  <div className="mt-2 space-y-1 rounded-lg bg-muted/30 p-2">
                    {attendance.breaks.map((b) => (
                      <div key={b.id} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">休憩</span>
                        <span className="tabular-nums">
                          {formatTime(b.start)} - {formatTime(b.end)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        )}

        {/* --- 勤務開始時（planned） --- */}
        <section className="space-y-3 border-l-4 border-blue-500 pl-4">
          <h3 className="font-bold text-blue-600">勤務開始時</h3>

          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">勤務日時</div>
            <div className="text-sm">
              {hasAttendance ? formatJpDateTime(attendance?.clockIn ?? null) : `${selectedYmd ?? ""}`}
            </div>
          </div>

          {plannedTasks.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">今日やること</div>
              <div className="rounded-lg bg-muted/30 p-3">
                <ul className="space-y-2">
                  {plannedTasks.map((t) => (
                    <li key={t.id} className="flex justify-between gap-3">
                      <span className="text-sm">• {t.title}</span>
                      <span className="text-sm">
                        {minutesToHoursText(t.minutes)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>

        {/* --- 勤務終了時（actual + メモ） --- */}
        <section className="space-y-3 border-l-4 border-green-500 pl-4">
          <h3 className="font-bold text-green-600">勤務終了時</h3>

          {actualTasks.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">今日やったこと</div>
              <div className="rounded-lg bg-muted/30 p-3">
                <ul className="space-y-2">
                  {actualTasks.map((t) => (
                    <li key={t.id} className="flex justify-between gap-3">
                      <span className="text-sm">• {t.title}</span>
                      <span className="text-sm">
                        {minutesToHoursText(t.minutes)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {session?.summary?.trim() && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">本日のまとめ</div>
              <div className="rounded-lg bg-muted/30 p-3 text-sm leading-relaxed">
                {session.summary}
              </div>
            </div>
          )}

          {session?.troubles?.trim() && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">困っていること・相談したいこと</div>
              <div className="rounded-lg bg-muted/30 p-3 text-sm leading-relaxed">
                {session.troubles}
              </div>
            </div>
          )}

          {session?.announcements?.trim() && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">連絡事項</div>
              <div className="rounded-lg bg-muted/30 p-3 text-sm leading-relaxed">
                {session.announcements}
              </div>
            </div>
          )}
        </section>

        {/* --- コメント・リアクション --- */}
        {(hasComments || hasReactions) && (
          <div className="flex items-end justify-between gap-4">
            {/* コメント（左側） */}
            {hasComments && (
              <div className="flex-1 space-y-2">
                {session!.comments!.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-lg border bg-muted/30 p-3 text-sm"
                  >
                    <div className="text-xs text-muted-foreground">
                      {new Date(c.createdAt).toLocaleString("ja-JP", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                    <div className="mt-1 whitespace-pre-wrap">{c.text}</div>
                  </div>
                ))}
              </div>
            )}

            {/* リアクション（右側） */}
            {hasReactions && (
              <div className="flex flex-wrap justify-end gap-1">
                {Object.entries(session!.reactions!).map(([emoji, count]) => (
                  <span
                    key={emoji}
                    className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2 py-0.5 text-sm"
                  >
                    {EMOJI_MAP[emoji] ?? emoji} {count}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
