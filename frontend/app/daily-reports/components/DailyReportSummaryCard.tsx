"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  clockIn: string | null; // ISO
  clockOut: string | null; // ISO
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

// ✅ 「セッションがある」判定：入力が何か1つでもあれば true
function hasAnyInput(s: Session | undefined | null) {
  if (!s) return false;

  const hasText =
    (s.summary?.trim()?.length ?? 0) > 0 ||
    (s.troubles?.trim()?.length ?? 0) > 0 ||
    (s.announcements?.trim()?.length ?? 0) > 0;

  const hasTasks =
    (s.plannedTasks?.length ?? 0) > 0 || (s.actualTasks?.length ?? 0) > 0;

  // minutes を “入力済み” と扱いたい場合はここをON（必要なら）
  // const hasMinutes =
  //   (typeof s.plannedMinutes === "number" && s.plannedMinutes > 0) ||
  //   (typeof s.actualMinutes === "number" && s.actualMinutes > 0);

  return hasText || hasTasks;
}

export function DailyReportSummaryCard({
  selectedDate,
  sessions,
  selectedYmd,
  attendance,
}: Props) {
  // 1) sessions 正規化（snake_case → camelCase）
  const normalizedSessions = useMemo(() => {
    return (sessions ?? []).map((s) => {
      const sessionNo =
        typeof s.sessionNo === "number"
          ? s.sessionNo
          : typeof s.session_no === "number"
          ? s.session_no
          : undefined;

      const plannedMinutes =
        typeof s.plannedMinutes === "number"
          ? s.plannedMinutes
          : typeof s.planned_minutes === "number"
          ? s.planned_minutes
          : undefined;

      const actualMinutes =
        typeof s.actualMinutes === "number"
          ? s.actualMinutes
          : typeof s.actual_minutes === "number"
          ? s.actual_minutes
          : undefined;

      return {
        ...s,
        sessionNo,
        plannedMinutes,
        actualMinutes,
        plannedTasks: s.plannedTasks ?? [],
        actualTasks: s.actualTasks ?? [],
      };
    });
  }, [sessions]);

  // 2) sessionNo → Session のMap（重複は最後を採用）
  const sessionMap = useMemo(() => {
    const m = new Map<number, Session>();
    for (const s of normalizedSessions) {
      if (typeof s.sessionNo === "number") m.set(s.sessionNo, s);
    }
    return m;
  }, [normalizedSessions]);

  // 3) UI は 1..3 を固定表示
  const tabNos = [1, 2, 3] as const;

  // ✅ “入力があるセッション” の集合
  const enabledSet = useMemo(() => {
    const set = new Set<number>();
    for (const no of tabNos) {
      const s = sessionMap.get(no);
      if (hasAnyInput(s)) set.add(no);
    }
    return set;
  }, [sessionMap]);

  // ✅ 初期選択：入力があるセッションの先頭。なければ 1
  const defaultSessionNo = useMemo(() => {
    for (const no of tabNos) if (enabledSet.has(no)) return no;
    return 1;
  }, [enabledSet]);

  const [selectedSessionNo, setSelectedSessionNo] = useState<number>(defaultSessionNo);

  // 日付 or sessions が変わったら、選択が無効なら寄せる
  useEffect(() => {
    if (!enabledSet.has(selectedSessionNo)) {
      setSelectedSessionNo(defaultSessionNo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYmd, sessions]);

  const selectedSession = sessionMap.get(selectedSessionNo) ?? null;

  const plannedTasks = selectedSession?.plannedTasks ?? [];
  const actualTasks = selectedSession?.actualTasks ?? [];

  const plannedMin =
    typeof selectedSession?.plannedMinutes === "number"
      ? selectedSession.plannedMinutes
      : sumMinutes(plannedTasks);

  const actualMin =
    typeof selectedSession?.actualMinutes === "number"
      ? selectedSession.actualMinutes
      : sumMinutes(actualTasks);

  const hasAttendance = !!attendance?.attendanceId;

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>詳細情報</CardTitle>
            <CardDescription className="truncate">
              {selectedDate?.toLocaleDateString("ja-JP", {
                year: "numeric",
                month: "long",
                day: "numeric",
                weekday: "long",
              })}
            </CardDescription>
          </div>

          {/* ✅ セッション切替：1..3固定。空セッションは disabled & グレー */}
          <div className="max-w-[60%] overflow-x-auto">
            <Tabs value={String(selectedSessionNo)} onValueChange={(v) => setSelectedSessionNo(Number(v))}>
              <TabsList className="w-max rounded-full bg-muted/40 p-1">
                {tabNos.map((no) => {
                  const s = sessionMap.get(no);
                  const enabled = enabledSet.has(no);

                  // 緑点：入力あり（enabled）なら緑、無ければ薄グレー
                  const dotClass = enabled ? "bg-green-500" : "bg-muted-foreground/30";

                  return (
                    <TabsTrigger
                      key={`session-${no}`}
                      value={String(no)}
                      disabled={!enabled}
                      className={[
                        "relative rounded-full px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm",
                        !enabled ? "cursor-not-allowed text-muted-foreground" : "",
                      ].join(" ")}
                    >
                      セッション{no}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-8">
        {/* --- 勤怠（上段：日単位のまま表示） --- */}
        <section className="space-y-2">
          <div className="flex items-center justify-between border-b pb-2" />

          {!hasAttendance ? (
            <p className="text-sm text-muted-foreground"></p>
          ) : (
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">出勤</span>
                <span className="tabular-nums">{formatTime(attendance?.clockIn ?? null)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">退勤</span>
                <span className="tabular-nums">{formatTime(attendance?.clockOut ?? null)}</span>
              </div>

              {/* 休憩 */}
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
          )}
        </section>

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
                      <span className="text-sm tabular-nums text-muted-foreground">
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
            <div className="text-sm text-muted-foreground">本日のまとめ</div>
            <div className="rounded-lg bg-muted/30 p-3 text-sm leading-relaxed">
              {selectedSession?.summary?.trim() ? selectedSession.summary : "未入力"}
            </div>
          </div>

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
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {minutesToHoursText(t.minutes)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">困っていること・相談したいこと</div>
            <div className="rounded-lg bg-muted/30 p-3 text-sm leading-relaxed">
              {selectedSession?.troubles?.trim() ? selectedSession.troubles : "未入力"}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">連絡事項</div>
            <div className="rounded-lg bg-muted/30 p-3 text-sm leading-relaxed">
              {selectedSession?.announcements?.trim()
                ? selectedSession.announcements
                : "未入力"}
            </div>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
