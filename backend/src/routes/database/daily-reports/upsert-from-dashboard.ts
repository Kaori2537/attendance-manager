import { Hono } from "hono";
import { verify } from "hono/jwt";
import { createClient } from "@supabase/supabase-js";
import type { Env } from "../../../types/env";

type DashboardTask = {
  task?: string;
  title?: string;
  hours?: number | string;   // string も吸収
  minutes?: number | string; // string も吸収
};

type Body = {
  date: string; // YYYY-MM-DD
  mode: "checkin" | "checkout";
  plannedTasks?: DashboardTask[];
  actualTasks?: DashboardTask[];
  summary?: string | null;
  troubles?: string | null;
  announcements?: string | null;
  sessionNo?: number; // 任意（未指定なら1）
};

const route = new Hono<{ Bindings: Env }>();

function isValidDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function clampSessionNo(n: unknown) {
  const v = Number(n ?? 1);
  if (!Number.isFinite(v)) return 1;
  return Math.min(3, Math.max(1, Math.trunc(v)));
}

function getSupabase(c: any) {
  const url = c.env?.SUPABASE_URL;
  const key = c.env?.SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

function toNumber(x: unknown): number {
  const n = typeof x === "string" ? Number(x) : Number(x);
  return Number.isFinite(n) ? n : 0;
}

function toMinutes(t: DashboardTask): number {
  const minutes = toNumber(t.minutes);
  if (minutes > 0) return Math.max(0, Math.round(minutes));

  const hours = toNumber(t.hours);
  if (hours > 0) return Math.max(0, Math.round(hours * 60));

  return 0;
}

function toTitle(t: DashboardTask): string {
  return (t.title ?? t.task ?? "").trim() || "(no title)";
}

// session_id + kind を“入れ替え”する（delete→insert）
async function replaceTasks(
  sb: any,
  sessionId: string,
  kind: "planned" | "actual",
  tasks: DashboardTask[]
) {
  const del = await sb
    .from("daily_report_tasks")
    .delete()
    .eq("session_id", sessionId)
    .eq("kind", kind);

  if (del.error) throw new Error(`tasks delete: ${del.error.message}`);

  if (!tasks?.length) return;

  const rows = tasks
    .map((t, idx) => ({
      session_id: sessionId,
      kind,
      title: toTitle(t),
      minutes: toMinutes(t),
      sort_order: idx,
    }))
    .filter((r) => r.title && r.minutes > 0);

  if (rows.length === 0) return;

  const ins = await sb.from("daily_report_tasks").insert(rows);
  if (ins.error) throw new Error(`tasks insert: ${ins.error.message}`);
}

async function upsertDailyReport(sb: any, userId: string, date: string) {
  // upsert 自体は OKだが、過去に重複があると .single() が死ぬので安全に取る
  const up = await sb
    .from("daily_reports")
    .upsert({ user_id: userId, report_date: date, content: "" }, { onConflict: "user_id,report_date" });

  if (up.error) throw new Error(`daily_reports upsert: ${up.error.message}`);

  const { data: list, error } = await sb
    .from("daily_reports")
    .select("*")
    .eq("user_id", userId)
    .eq("report_date", date)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`daily_reports re-select: ${error.message}`);
  if (!list || list.length === 0) throw new Error("daily_reports not found after upsert");

  return list[list.length - 1];
}

async function upsertDailyReportSession(
  sb: any,
  dailyReportId: string,
  sessionNo: number,
  patch: { summary?: string | null; troubles?: string | null; announcements?: string | null }
) {
  const up = await sb
    .from("daily_report_sessions")
    .upsert(
      {
        daily_report_id: dailyReportId,
        session_no: sessionNo,
        ...patch,
      },
      { onConflict: "daily_report_id,session_no" }
    );

  if (up.error) throw new Error(`daily_report_sessions upsert: ${up.error.message}`);

  const { data: list, error } = await sb
    .from("daily_report_sessions")
    .select("*")
    .eq("daily_report_id", dailyReportId)
    .eq("session_no", sessionNo)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`daily_report_sessions re-select: ${error.message}`);
  if (!list || list.length === 0) throw new Error("daily_report_sessions not found after upsert");

  return list[list.length - 1];
}

route.post("/", async (c) => {
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
    let payload: { id: string; role: "admin" | "user" };
    try {
      payload = (await verify(token, c.env.JWT_SECRET)) as any;
    } catch {
      return c.json({ ok: false, error: "Invalid token" }, 401);
    }

    const userId = payload.id;

    const body = (await c.req.json()) as Body;

    if (!body?.date || !isValidDate(body.date)) {
      return c.json({ ok: false, error: "date is required (YYYY-MM-DD)" }, 400);
    }
    if (body.mode !== "checkin" && body.mode !== "checkout") {
      return c.json({ ok: false, error: "mode must be checkin | checkout" }, 400);
    }

    const sessionNo = clampSessionNo(body.sessionNo);

    const sb = getSupabase(c);

    // 1) daily_reports upsert（耐性あり）
    const report = await upsertDailyReport(sb, userId, body.date);

    // 2) daily_report_sessions upsert（耐性あり）
    const patch =
      body.mode === "checkout"
        ? {
            summary: body.summary ?? null,
            troubles: body.troubles ?? null,
            announcements: body.announcements ?? null,
          }
        : {};

    const session = await upsertDailyReportSession(sb, report.id, sessionNo, patch);

    // 3) tasks 反映
    if (body.mode === "checkin") {
      await replaceTasks(sb, session.id, "planned", body.plannedTasks ?? []);
    } else {
      await replaceTasks(sb, session.id, "actual", body.actualTasks ?? []);
    }

    return c.json({ ok: true, reportId: report.id, sessionId: session.id, sessionNo });
  } catch (e: any) {
    console.error("upsert-from-dashboard error:", e);
    return c.json({ ok: false, error: e?.message ?? String(e) }, 500);
  }
});

export default route;
