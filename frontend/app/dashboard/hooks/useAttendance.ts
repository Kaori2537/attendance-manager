/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect } from "react";
import { AttendanceRecord, WorkSession, Task } from "../../../../shared/types/Attendance";
import { clockInWithTasks } from "@/app/actions/clock-in";
import { clockOutWithTasks } from "@/app/actions/clock-out";
import { breakStart } from "@/app/actions/break-start";
import { breakEnd } from "@/app/actions/break-end";

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

function clampSessionNo(n: number) {
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.min(3, Math.max(1, Math.trunc(n)));
}

/**
 * 次の clock-in が入る sessionNo
 * - sessions が0 → 1
 * - 最後が open（clockOut なし）→ そのまま（=すでに出勤中なので本来押せないが保険）
 * - 最後が closed → count+1
 */
function nextSessionNoForClockIn(attendance: AttendanceRecord | null) {
  const count = attendance?.sessions?.length ?? 0;
  const current = detectCurrentSession(attendance);
  if (count === 0) return 1;
  if (current) return count; // open があるならそれ
  return count + 1;
}

/**
 * clock-out が入る sessionNo（open セッションの番号）
 * - open がある → sessions.length
 * - open がない → sessions.length（保険。UI的には押せない想定）
 */
function currentSessionNoForClockOut(attendance: AttendanceRecord | null) {
  const count = attendance?.sessions?.length ?? 0;
  const current = detectCurrentSession(attendance);
  if (count === 0) return 1;
  if (current) return count;
  return count;
}

export function useAttendance() {
  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);
  const [currentSession, setCurrentSession] = useState<WorkSession | null>(null);
  const [onBreak, setOnBreak] = useState<boolean>(false);
  const [weekTotalMs, setWeekTotalMs] = useState<number>(0);

  const loadAll = async () => {
    try {
      const todayData: AttendanceRecord = await fetch("/api/attendance/day").then((r) => r.json());
      const weekly = await fetch("/api/attendance/week-total-hours").then((r) => r.json());

      const session = detectCurrentSession(todayData);

      setAttendance(todayData);
      setCurrentSession(session);
      setOnBreak(detectOnBreak(session));
      setWeekTotalMs(weekly.netWorkMs);
    } catch (e) {
      console.error("Failed to load attendance:", e);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // 出勤
  const handleClockIn = async (plannedTasks: Task[]) => {
    const sessionNo = clampSessionNo(nextSessionNoForClockIn(attendance));
    const res = await clockInWithTasks(plannedTasks, sessionNo);
    await loadAll();

    if (!res.success) {
      console.error("Clock-in failed:", res.error);
    }
  };

  // 退勤
  const handleClockOut = async (actualTasks: Task[], summary: string, issues: string, notes: string) => {
    const sessionNo = clampSessionNo(currentSessionNoForClockOut(attendance));
    const res = await clockOutWithTasks(actualTasks, summary, issues, notes, sessionNo);
    await loadAll();

    if (!res.success) {
      console.error("Clock-out failed:", res.error);
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

  // 休憩終了
  const handleBreakEnd = async () => {
    const res = await breakEnd();
    await loadAll();

    if (!res.success) {
      console.error("Break-end failed:", res.error);
    }
  };

  return {
    attendance,
    currentSession,
    onBreak,
    weekTotalMs,
    handleClockIn,
    handleClockOut,
    handleBreakStart,
    handleBreakEnd,
  };
}
