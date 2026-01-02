import { Hono } from "hono";
import { verify } from "hono/jwt";
import { cors } from "hono/cors";
import type { Env } from "../../../types/env";
import { createClient } from "@supabase/supabase-js";

const route = new Hono<{ Bindings: Env }>();

// ✅ CORS: ブラウザから Authorization ヘッダーを送れるようにする
route.use(
  "*",
  cors({
    origin: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      // 必要なら本番フロントのURLを追加
      // "https://your-frontend-domain.com",
    ],
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    maxAge: 86400,
  })
);

function isValidDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function getSupabase(c: any) {
  const url = c.env?.SUPABASE_URL;
  const key = c.env?.SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      `Missing env: SUPABASE_URL or SERVICE_ROLE_KEY (SUPABASE_URL=${!!url}, SERVICE_ROLE_KEY=${!!key})`
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * ✅ 1..3 セッションを保証（UNIQUE(daily_report_id, session_no) を onConflict で吸収）
 */
async function ensureThreeSessions(sb: any, dailyReportId: string) {
  const { data: sessions, error } = await sb
    .from("daily_report_sessions")
    .select("*")
    .eq("daily_report_id", dailyReportId)
    .order("session_no", { ascending: true });

  if (error) throw new Error(`sessions select: ${error.message}`);

  const rows = [1, 2, 3].map((no) => ({
    daily_report_id: dailyReportId,
    session_no: no,
    planned_minutes: 0,
    actual_minutes: 0,
  }));

  const up = await sb
    .from("daily_report_sessions")
    .upsert(rows, { onConflict: "daily_report_id,session_no" });

  if (up.error) throw new Error(`sessions upsert: ${up.error.message}`);

  const again = await sb
    .from("daily_report_sessions")
    .select("*")
    .eq("daily_report_id", dailyReportId)
    .order("session_no", { ascending: true });

  if (again.error) throw new Error(`sessions re-select: ${again.error.message}`);
  return again.data ?? (sessions ?? []);
}

type AttendanceSessionPayload = {
  workSessionId: string;
  clockIn: string | null;
  clockOut: string | null;
  breaks: { id: string; start: string | null; end: string | null }[];
  breakMinutes: number;
  workMinutes: number | null;
};

type AttendancePayload = {
  attendanceId: string;
  sessions: AttendanceSessionPayload[];
  breakMinutesTotal: number;
  workMinutesTotal: number;
};

/**
 * GET /database/daily-reports/get-by-date?date=YYYY-MM-DD[&userId=uuid]
 */
route.get("/", async (c) => {
  try {
    // --- auth ---
    const authHeader =
      c.req.header("authorization") ?? c.req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ ok: false, error: "Unauthorized" }, 401);
    }
    const token = authHeader.slice("Bearer ".length).trim();

    const jwtSecret = c.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error("JWT_SECRET missing");
      return c.json({ ok: false, error: "Server configuration error" }, 500);
    }

    let raw: any;
    try {
      raw = await verify(token, jwtSecret);
    } catch (e) {
      return c.json({ ok: false, error: "Invalid token" }, 401);
    }

    // ✅ Supabase JWT は通常 sub に user id が入る
    const payload = {
      id: raw?.id ?? raw?.sub,
      role: raw?.role ?? "user",
    } as { id: string; role: "admin" | "user" };

    if (!payload.id) {
      return c.json({ ok: false, error: "Invalid token payload" }, 401);
    }

    // --- params ---
    const date = c.req.query("date");
    if (!date || !isValidDate(date)) {
      return c.json({ ok: false, error: "date is required (YYYY-MM-DD)" }, 400);
    }

    const requestedUserId = c.req.query("userId");
    const userId =
      payload.role === "admin" && requestedUserId ? requestedUserId : payload.id;

    const sb = getSupabase(c);

    // 1) daily_reports を取得（なければ作成）
    // ✅ 重複していても落ちないように list→最後を採用
    const { data: reports, error: reportErr } = await sb
      .from("daily_reports")
      .select("*")
      .eq("user_id", userId)
      .eq("report_date", date)
      .order("created_at", { ascending: true });

    if (reportErr) {
      console.error("daily_reports select error:", reportErr);
      return c.json(
        { ok: false, error: reportErr.message, detail: reportErr },
        500
      );
    }

    let report =
      reports && reports.length > 0 ? reports[reports.length - 1] : null;

    if (!report) {
      const ins = await sb
        .from("daily_reports")
        .insert({ user_id: userId, report_date: date, content: "" })
        .select("*")
        .single();

      if (ins.error) {
        console.error("daily_reports insert error:", ins.error);
        return c.json(
          { ok: false, error: ins.error.message, detail: ins.error },
          500
        );
      }
      report = ins.data;
    }

    // 2) sessions（必ず1〜3）
    const sessions = await ensureThreeSessions(sb, report.id);
    const sessionIds = sessions.map((s: any) => s.id);

    // 3) tasks
    const tasksRes =
      sessionIds.length === 0
        ? { data: [], error: null as any }
        : await sb
            .from("daily_report_tasks")
            .select("*")
            .in("session_id", sessionIds)
            .order("kind", { ascending: true })
            .order("sort_order", { ascending: true });

    if (tasksRes.error) {
      console.error("tasks select error:", tasksRes.error);
      return c.json(
        { ok: false, error: tasksRes.error.message, detail: tasksRes.error },
        500
      );
    }

    const tasks = tasksRes.data ?? [];
    const tasksBySession = new Map<string, { planned: any[]; actual: any[] }>();
    for (const t of tasks) {
      const bucket = tasksBySession.get(t.session_id) ?? { planned: [], actual: [] };
      if (t.kind === "planned") bucket.planned.push(t);
      else bucket.actual.push(t);
      tasksBySession.set(t.session_id, bucket);
    }

    const sessionsWithTasks = sessions.map((s: any) => ({
      ...s,
      plannedTasks: tasksBySession.get(s.id)?.planned ?? [],
      actualTasks: tasksBySession.get(s.id)?.actual ?? [],
    }));

    // 4) attendance（勤怠）を取得して組み立て（複数work_sessions対応）
    const { data: attendanceList, error: attErr } = await sb
      .from("attendance_records")
      .select("id, user_id, date, created_at")
      .eq("user_id", userId)
      .eq("date", date)
      .order("created_at", { ascending: true });

    if (attErr) {
      console.error("attendance_records select error:", attErr);
      return c.json({ ok: false, error: attErr.message, detail: attErr }, 500);
    }

    const attendance =
      attendanceList && attendanceList.length > 0
        ? attendanceList[attendanceList.length - 1]
        : null;

    let attendancePayload: AttendancePayload | null = null;

    if (attendance?.id) {
      const { data: wsList, error: wsErr } = await sb
        .from("work_sessions")
        .select("id, clock_in, clock_out, created_at")
        .eq("attendance_id", attendance.id)
        .order("clock_in", { ascending: true });

      if (wsErr) {
        console.error("work_sessions select error:", wsErr);
        return c.json({ ok: false, error: wsErr.message, detail: wsErr }, 500);
      }

      const workSessionIds = (wsList ?? []).map((w: any) => w.id);

      const { data: breaksAll, error: brErr } =
        workSessionIds.length > 0
          ? await sb
              .from("breaks")
              .select("id, session_id, break_start, break_end")
              .in("session_id", workSessionIds)
              .order("break_start", { ascending: true })
          : { data: [], error: null as any };

      if (brErr) {
        console.error("breaks select error:", brErr);
        return c.json({ ok: false, error: brErr.message, detail: brErr }, 500);
      }

      const breaksBySession = new Map<string, any[]>();
      for (const b of breaksAll ?? []) {
        const arr = breaksBySession.get(b.session_id) ?? [];
        arr.push(b);
        breaksBySession.set(b.session_id, arr);
      }

      const calcBreakMinutes = (breaks: any[]) =>
        (breaks ?? []).reduce((acc: number, b: any) => {
          if (!b.break_start || !b.break_end) return acc;
          const ms = new Date(b.break_end).getTime() - new Date(b.break_start).getTime();
          return acc + Math.max(0, Math.round(ms / 60000));
        }, 0);

      const attendanceSessions: AttendanceSessionPayload[] = (wsList ?? []).map((ws: any) => {
        const bs = breaksBySession.get(ws.id) ?? [];
        const breakMinutes = calcBreakMinutes(bs);

        let workMinutes: number | null = null;
        if (ws.clock_in && ws.clock_out) {
          const ms = new Date(ws.clock_out).getTime() - new Date(ws.clock_in).getTime();
          const total = Math.max(0, Math.round(ms / 60000));
          workMinutes = Math.max(0, total - breakMinutes);
        }

        return {
          workSessionId: ws.id,
          clockIn: ws.clock_in ?? null,
          clockOut: ws.clock_out ?? null,
          breaks: (bs ?? []).map((b: any) => ({
            id: b.id,
            start: b.break_start ?? null,
            end: b.break_end ?? null,
          })),
          breakMinutes,
          workMinutes,
        };
      });

      const breakMinutesTotal = attendanceSessions.reduce((a, s) => a + (s.breakMinutes ?? 0), 0);
      const workMinutesTotal = attendanceSessions.reduce((a, s) => a + (s.workMinutes ?? 0), 0);

      attendancePayload = {
        attendanceId: attendance.id,
        sessions: attendanceSessions,
        breakMinutesTotal,
        workMinutesTotal,
      };
    }

    return c.json({
      ok: true,
      userId,
      date,
      dailyReport: report,
      sessions: sessionsWithTasks,
      attendance: attendancePayload,
    });
  } catch (e: any) {
    console.error("get-by-date uncaught:", e);
    return c.json({ ok: false, error: e?.message ?? String(e) }, 500);
  }
});

export default route;
