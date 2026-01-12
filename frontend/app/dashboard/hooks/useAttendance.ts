/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect } from "react";
import { AttendanceRecord, WorkSession, Task } from "../../../../shared/types/Attendance";
import { clockInWithTasks } from "@/app/actions/clock-in";
import { clockOutWithTasks } from "@/app/actions/clock-out";
import { breakStart } from "@/app/actions/break-start";
import { resumeWorkWithTasks } from "@/app/actions/resume-work";
import { resumeClockIn } from "@/app/actions/resume-clock-in";

// セッション検出（出勤中かどうか）
function detectCurrentSession(attendance: AttendanceRecord | null): WorkSession | null {
  if (!attendance?.sessions?.length) return null;
  const lastSession = attendance.sessions[attendance.sessions.length - 1];
  return lastSession.clockOut ? null : lastSession;
}

// 休憩中かどうか検出
function detectOnBreak(currentSession: WorkSession | null): boolean {
  if (!currentSession?.breaks?.length) return false;
  const lastBreak = currentSession.breaks[currentSession.breaks.length - 1];
  return !lastBreak.end;
}

// 中断済み（今日既にセッションがあり、終了しているが退勤完了ではない）かどうか検出
function detectHasPreviousSession(attendance: AttendanceRecord | null, isClockedOut: boolean): boolean {
  if (!attendance?.sessions?.length) return false;
  // 退勤完了している場合は中断状態ではない
  if (isClockedOut) return false;
  // 最後のセッションが終了している = 中断済み
  const lastSession = attendance.sessions[attendance.sessions.length - 1];
  return !!lastSession.clockOut;
}

// 次のセッション番号を取得
function getNextSessionNo(attendance: AttendanceRecord | null): number {
  if (!attendance?.sessions?.length) return 1;
  return attendance.sessions.length + 1;
}

export function useAttendance() {
  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);
  const [currentSession, setCurrentSession] = useState<WorkSession | null>(null);
  const [onBreak, setOnBreak] = useState<boolean>(false);
  const [weekTotalMs, setWeekTotalMs] = useState<number>(0);
  // 中断済みかどうか（再出勤可能状態）
  const [hasPreviousSession, setHasPreviousSession] = useState<boolean>(false);
  // 退勤完了済みかどうか（日報入力済み）
  const [isClockedOut, setIsClockedOut] = useState<boolean>(false);

  const loadAll = async () => {
    try {
      const todayData: AttendanceRecord = await fetch("/api/attendance/day").then((r) => r.json());
      const weekly = await fetch("/api/attendance/week-total-hours").then((r) => r.json());

      const session = detectCurrentSession(todayData);

      // 退勤完了済みかどうか（日報のsummaryがあれば退勤済みとみなす）
      const clockedOut = !!(todayData as any)?.summary;

      setAttendance(todayData);
      setCurrentSession(session);
      setOnBreak(detectOnBreak(session));
      setIsClockedOut(clockedOut);
      setHasPreviousSession(detectHasPreviousSession(todayData, clockedOut));
      setWeekTotalMs(weekly.netWorkMs);
    } catch (e) {
      console.error("Failed to load attendance:", e);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // 出勤（初回）
  const handleClockIn = async (plannedTasks: Task[]) => {
    const sessionNo = getNextSessionNo(attendance);
    const res = await clockInWithTasks(plannedTasks, sessionNo);
    await loadAll();

    if (!res.success) {
      console.error("Clock-in failed:", res.error);
    }
  };

  // 再出勤（中断後）- 追加タスク入力付き、セッション1として扱う
  const handleResume = async (additionalTasks: Task[]) => {
    const res = await resumeClockIn(additionalTasks);
    await loadAll();

    if (!res.success) {
      console.error("Resume failed:", res.error);
    }
  };

  // 退勤（常にセッション1として扱う）
  const handleClockOut = async (actualTasks: Task[], summary: string, issues: string, notes: string) => {
    const res = await clockOutWithTasks(actualTasks, summary, issues, notes, 1);
    await loadAll();

    if (!res.success) {
      console.error("Clock-out failed:", res.error);
    }
  };

  // 中断（日報入力なしでセッション終了）
  const handleStop = async () => {
    const res = await fetch("/api/attendance/clock-out", { method: "POST" });
    await loadAll();

    if (!res.ok) {
      console.error("Stop failed:", await res.text());
    }
  };

  // 休憩開始
  const handleBreakStart = async () => {
    const res = await breakStart();
    await loadAll();

    if (!res.success) {
      console.error("Break-start failed:", res.error);
    }
  };

  // 休憩終了（タスク入力なし）
  const handleBreakEnd = async () => {
    const res = await resumeWorkWithTasks([]);
    await loadAll();

    if (!res.success) {
      console.error("Break-end failed:", res.error);
    }
  };

  return {
    attendance,
    currentSession,
    onBreak,
    hasPreviousSession,
    isClockedOut,
    weekTotalMs,
    handleClockIn,
    handleResume,
    handleClockOut,
    handleStop,
    handleBreakStart,
    handleBreakEnd,
  };
}
