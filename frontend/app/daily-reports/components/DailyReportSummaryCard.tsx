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

          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">今日やること</div>

            <div className="rounded-lg bg-muted/30 p-3">
              {plannedTasks.length === 0 ? (
                <p className="text-sm">未入力</p>
              ) : (
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
              )}
            </div>
          </div>
        </section>

        {/* --- 勤務終了時（actual + メモ） --- */}
        <section className="space-y-3 border-l-4 border-green-500 pl-4">
          <h3 className="font-bold text-green-600">勤務終了時</h3>

          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">今日やったこと</div>
            <div className="rounded-lg bg-muted/30 p-3">
              {actualTasks.length === 0 ? (
                <p className="text-sm">未入力</p>
              ) : (
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
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">本日のまとめ</div>
            <div className="rounded-lg bg-muted/30 p-3 text-sm leading-relaxed">
              {session?.summary?.trim() ? session.summary : "未入力"}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">困っていること・相談したいこと</div>
            <div className="rounded-lg bg-muted/30 p-3 text-sm leading-relaxed">
              {session?.troubles?.trim() ? session.troubles : "未入力"}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">連絡事項</div>
            <div className="rounded-lg bg-muted/30 p-3 text-sm leading-relaxed">
              {session?.announcements?.trim() ? session.announcements : "未入力"}
            </div>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
