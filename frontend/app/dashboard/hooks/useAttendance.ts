/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect } from "react";
import { AttendanceRecord, WorkSession, Task } from "../../../../shared/types/Attendance";
import { clockInWithTasks } from "@/app/actions/clock-in";
import { clockOutWithTasks } from "@/app/actions/clock-out";
import { breakStart } from "@/app/actions/break-start";
import { resumeWorkWithTasks } from "@/app/actions/resume-work";

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

// 1日1セッション制限のため、常にセッション番号は1
function getSessionNo() {
  return 1;
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
    const sessionNo = getSessionNo();
    const res = await clockInWithTasks(plannedTasks, sessionNo);
    await loadAll();

    if (!res.success) {
      console.error("Clock-in failed:", res.error);
    }
  };

  // 退勤
  const handleClockOut = async (actualTasks: Task[], summary: string, issues: string, notes: string) => {
    const sessionNo = getSessionNo();
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

  // 休憩終了（タスク追加対応）
  const handleBreakEnd = async (additionalTasks: Task[]) => {
    const res = await resumeWorkWithTasks(additionalTasks);
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
