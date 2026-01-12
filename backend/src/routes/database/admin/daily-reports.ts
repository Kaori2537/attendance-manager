// backend/src/routes/database/admin/daily-reports.ts
import { Hono } from "hono";
import { verify } from "hono/jwt";
import { createClient } from "@supabase/supabase-js";
import type { Env } from "../../../types/env";

const route = new Hono<{ Bindings: Env }>();

function getSupabase(c: any) {
  const url = c.env?.SUPABASE_URL;
  const key = c.env?.SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing env: SUPABASE_URL or SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * GET /database/admin/daily-reports?year=2026&month=1[&userId=xxx]
 * 管理者が月単位で全ユーザー（またはフィルタ）の日報一覧を取得
 */
route.get("/", async (c) => {
  try {
    // --- auth ---
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ ok: false, error: "Unauthorized" }, 401);
    }
    if (!c.env.JWT_SECRET) {
      return c.json({ ok: false, error: "JWT_SECRET missing" }, 500);
    }

    const token = authHeader.split(" ")[1];
    let payload: any;
    try {
      payload = await verify(token, c.env.JWT_SECRET);
    } catch {
      return c.json({ ok: false, error: "Invalid token" }, 401);
    }

    if (payload?.role !== "admin") {
      return c.json({ ok: false, error: "Forbidden" }, 403);
    }

    // --- params ---
    const year = c.req.query("year");
    const month = c.req.query("month");
    const filterUserId = c.req.query("userId"); // optional

    if (!year || !month) {
      return c.json({ ok: false, error: "year and month are required" }, 400);
    }

    const startDate = `${year}-${month.padStart(2, "0")}-01`;
    const endDay = new Date(Number(year), Number(month), 0).getDate();
    const endDate = `${year}-${month.padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;

    const sb = getSupabase(c);

    // 1) ユーザー一覧を取得
    const { data: users, error: usersErr } = await sb
      .from("users")
      .select("id, name, email, role")
      .order("created_at", { ascending: false });

    if (usersErr) throw new Error(usersErr.message);

    const filteredUsers = filterUserId
      ? (users ?? []).filter((u: any) => u.id === filterUserId)
      : users ?? [];

    const userIds = filteredUsers.map((u: any) => u.id);
    if (userIds.length === 0) {
      return c.json({ ok: true, users: [], reports: [] });
    }

    // 2) daily_reports を取得
    const { data: reports, error: reportsErr } = await sb
      .from("daily_reports")
      .select("id, user_id, report_date, content, created_at, updated_at")
      .in("user_id", userIds)
      .gte("report_date", startDate)
      .lte("report_date", endDate)
      .order("report_date", { ascending: false });

    if (reportsErr) throw new Error(reportsErr.message);

    const reportIds = (reports ?? []).map((r: any) => r.id);

    // 3) daily_report_sessions を取得
    let sessions: any[] = [];
    if (reportIds.length > 0) {
      const { data: sessionsData, error: sessionsErr } = await sb
        .from("daily_report_sessions")
        .select("id, daily_report_id, session_no, summary, planned_minutes, actual_minutes, troubles, announcements")
        .in("daily_report_id", reportIds)
        .order("session_no", { ascending: true });

      if (sessionsErr) throw new Error(sessionsErr.message);
      sessions = sessionsData ?? [];
    }

    const sessionIds = sessions.map((s: any) => s.id);

    // 4) daily_report_tasks を取得
    let tasks: any[] = [];
    if (sessionIds.length > 0) {
      const { data: tasksData, error: tasksErr } = await sb
        .from("daily_report_tasks")
        .select("id, session_id, kind, title, minutes, sort_order")
        .in("session_id", sessionIds)
        .order("sort_order", { ascending: true });

      if (tasksErr) throw new Error(tasksErr.message);
      tasks = tasksData ?? [];
    }

    // 5) attendance を取得（勤務時間計算用）
    const { data: attendances, error: attErr } = await sb
      .from("attendance_records")
      .select("id, user_id, date")
      .in("user_id", userIds)
      .gte("date", startDate)
      .lte("date", endDate);

    if (attErr) throw new Error(attErr.message);

    const attendanceIds = (attendances ?? []).map((a: any) => a.id);

    let workSessions: any[] = [];
    if (attendanceIds.length > 0) {
      const { data: wsData, error: wsErr } = await sb
        .from("work_sessions")
        .select("id, attendance_id, clock_in, clock_out")
        .in("attendance_id", attendanceIds)
        .order("clock_in", { ascending: true });

      if (wsErr) throw new Error(wsErr.message);
      workSessions = wsData ?? [];
    }

    // --- 組み立て ---
    // tasks を session_id でグループ化
    const tasksBySessionId = new Map<string, any[]>();
    for (const t of tasks) {
      const arr = tasksBySessionId.get(t.session_id) ?? [];
      arr.push(t);
      tasksBySessionId.set(t.session_id, arr);
    }

    // workSessions を attendance_id でグループ化し、session_no で分類
    const wsByAttendanceId = new Map<string, any[]>();
    for (const ws of workSessions) {
      const arr = wsByAttendanceId.get(ws.attendance_id) ?? [];
      arr.push(ws);
      wsByAttendanceId.set(ws.attendance_id, arr);
    }

    // attendance を user_id + date でマップ化（workSessionsも含む）
    const attendanceMap = new Map<string, any>();
    for (const att of attendances ?? []) {
      const key = `${att.user_id}_${att.date}`;
      const ws = wsByAttendanceId.get(att.id) ?? [];
      // clock_in でソート
      ws.sort((a: any, b: any) => new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime());
      attendanceMap.set(key, {
        ...att,
        workSessions: ws,
      });
    }

    // sessions を daily_report_id でグループ化
    // 各セッションに対応するworkSessionのclock_in/clock_outを紐づけ
    const sessionsByReportId = new Map<string, any[]>();
    for (const s of sessions) {
      const arr = sessionsByReportId.get(s.daily_report_id) ?? [];

      // このセッションの report を見つけて、対応する workSession を取得
      const report = (reports ?? []).find((r: any) => r.id === s.daily_report_id);
      let clockIn: string | null = null;
      let clockOut: string | null = null;
      let workMinutes = 0;
      let timeRanges: { clockIn: string; clockOut: string | null }[] = [];

      if (report) {
        const attKey = `${report.user_id}_${report.report_date}`;
        const attendance = attendanceMap.get(attKey);
        if (attendance?.workSessions?.length > 0) {
          // セッション1の場合は全てのwork_sessionsを集約
          // それ以外の場合は対応するwork_sessionのみ
          if (s.session_no === 1) {
            // 全てのwork_sessionsの最初のclock_inと最後のclock_outを取得
            const sorted = [...attendance.workSessions].sort(
              (a: any, b: any) => new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime()
            );
            clockIn = sorted[0]?.clock_in ?? null;
            clockOut = sorted[sorted.length - 1]?.clock_out ?? null;

            // 各work_sessionの時間範囲と実働時間を計算
            for (const ws of sorted) {
              if (ws.clock_in) {
                timeRanges.push({
                  clockIn: ws.clock_in,
                  clockOut: ws.clock_out,
                });
              }
              if (ws.clock_in && ws.clock_out) {
                const ms = new Date(ws.clock_out).getTime() - new Date(ws.clock_in).getTime();
                workMinutes += Math.max(0, Math.round(ms / 60000));
              }
            }
          } else {
            // session_no に対応する workSession を取得（1-indexed）
            const wsIndex = s.session_no - 1;
            const ws = attendance.workSessions[wsIndex];
            if (ws) {
              clockIn = ws.clock_in;
              clockOut = ws.clock_out;
              if (ws.clock_in) {
                timeRanges.push({
                  clockIn: ws.clock_in,
                  clockOut: ws.clock_out,
                });
              }
              if (ws.clock_in && ws.clock_out) {
                const ms = new Date(ws.clock_out).getTime() - new Date(ws.clock_in).getTime();
                workMinutes = Math.max(0, Math.round(ms / 60000));
              }
            }
          }
        }
      }

      arr.push({
        ...s,
        tasks: tasksBySessionId.get(s.id) ?? [],
        clock_in: clockIn,
        clock_out: clockOut,
        work_minutes: workMinutes,
        time_ranges: timeRanges,
      });
      sessionsByReportId.set(s.daily_report_id, arr);
    }

    // reports を組み立て
    const enrichedReports = (reports ?? []).map((r: any) => {
      const reportSessions = sessionsByReportId.get(r.id) ?? [];
      const attKey = `${r.user_id}_${r.report_date}`;
      const attendance = attendanceMap.get(attKey);

      // セッション数（実際に利用されているもの）
      const activeSessionCount = reportSessions.filter(
        (s: any) => s.summary || s.troubles || (s.tasks && s.tasks.length > 0)
      ).length || reportSessions.length;

      // 勤務時間の計算
      let clockInFirst: string | null = null;
      let clockOutLast: string | null = null;
      let totalWorkMinutes = 0;

      if (attendance?.workSessions?.length > 0) {
        const sorted = [...attendance.workSessions].sort(
          (a: any, b: any) => new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime()
        );
        clockInFirst = sorted[0]?.clock_in ?? null;
        clockOutLast = sorted[sorted.length - 1]?.clock_out ?? null;

        for (const ws of attendance.workSessions) {
          if (ws.clock_in && ws.clock_out) {
            const ms = new Date(ws.clock_out).getTime() - new Date(ws.clock_in).getTime();
            totalWorkMinutes += Math.max(0, Math.round(ms / 60000));
          }
        }
      }

      // 実績タスクの集計
      const actualTasks: any[] = [];
      let totalActualMinutes = 0;
      for (const sess of reportSessions) {
        for (const t of sess.tasks ?? []) {
          if (t.kind === "actual") {
            actualTasks.push(t);
            totalActualMinutes += t.minutes ?? 0;
          }
        }
      }

      // メモと困っていることを結合
      const memos = reportSessions
        .map((s: any) => s.summary)
        .filter(Boolean)
        .join(" ");
      const troubles = reportSessions
        .map((s: any) => s.troubles)
        .filter(Boolean)
        .join(" ");

      return {
        id: r.id,
        userId: r.user_id,
        reportDate: r.report_date,
        sessionCount: activeSessionCount,
        clockIn: clockInFirst,
        clockOut: clockOutLast,
        totalWorkMinutes,
        memo: memos,
        trouble: troubles,
        actualTasks,
        totalActualMinutes,
        sessions: reportSessions,
      };
    })
    // 日報の内容が空のものは除外（まとめ、困っていること、タスクが全て空）
    .filter((r: any) => r.memo || r.trouble || r.actualTasks.length > 0);

    // user ごとにグループ化
    const reportsByUserId = new Map<string, any[]>();
    for (const r of enrichedReports) {
      const arr = reportsByUserId.get(r.userId) ?? [];
      arr.push(r);
      reportsByUserId.set(r.userId, arr);
    }

    const usersWithReports = filteredUsers.map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      reports: reportsByUserId.get(u.id) ?? [],
    }));

    return c.json({
      ok: true,
      year: Number(year),
      month: Number(month),
      users: usersWithReports,
    });
  } catch (e: any) {
    console.error("[admin/daily-reports] error", e);
    return c.json({ ok: false, error: e?.message ?? String(e) }, 500);
  }
});

export default route;
