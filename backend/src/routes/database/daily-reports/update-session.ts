import { Hono } from "hono";
import { verify } from "hono/jwt";
import type { Env } from "../../../types/env";
import { createClient } from "@supabase/supabase-js";

const route = new Hono<{ Bindings: Env }>();

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
 * PATCH /database/daily-reports/update-session
 * body: { sessionId, summary, troubles, announcements }
 *
 * - user: 自分の session のみ更新
 * - admin: 何でも更新OK
 */
route.patch("/", async (c) => {
  try {
    // --- auth ---
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ ok: false, error: "Unauthorized" }, 401);
    }
    const token = authHeader.split(" ")[1];

    if (!c.env.JWT_SECRET) {
      return c.json({ ok: false, error: "Server configuration error" }, 500);
    }

    let payload: { id: string; role: "admin" | "user" };
    try {
      payload = (await verify(token, c.env.JWT_SECRET)) as any;
    } catch {
      return c.json({ ok: false, error: "Invalid token" }, 401);
    }

    // --- body ---
    const body = (await c.req.json().catch(() => null)) as
      | {
          sessionId?: string;
          summary?: string;
          troubles?: string;
          announcements?: string;
        }
      | null;

    if (!body?.sessionId) {
      return c.json({ ok: false, error: "sessionId is required" }, 400);
    }

    const sb = getSupabase(c);

    // --- permission check (user は自分の daily_report のみ) ---
    if (payload.role !== "admin") {
      // session -> daily_report_id を辿って user_id を確認
      const sessionRes = await sb
        .from("daily_report_sessions")
        .select("id, daily_report_id")
        .eq("id", body.sessionId)
        .maybeSingle();

      if (sessionRes.error) {
        return c.json({ ok: false, error: sessionRes.error.message }, 500);
      }
      if (!sessionRes.data) {
        return c.json({ ok: false, error: "Session not found" }, 404);
      }

      const reportRes = await sb
        .from("daily_reports")
        .select("id, user_id")
        .eq("id", sessionRes.data.daily_report_id)
        .maybeSingle();

      if (reportRes.error) {
        return c.json({ ok: false, error: reportRes.error.message }, 500);
      }
      if (!reportRes.data) {
        return c.json({ ok: false, error: "Daily report not found" }, 404);
      }

      if (reportRes.data.user_id !== payload.id) {
        return c.json({ ok: false, error: "Forbidden" }, 403);
      }
    }

    // --- update ---
    const updateRes = await sb
      .from("daily_report_sessions")
      .update({
        summary: body.summary ?? "",
        troubles: body.troubles ?? "",
        announcements: body.announcements ?? "",
      })
      .eq("id", body.sessionId)
      .select("*")
      .single();

    if (updateRes.error) {
      return c.json({ ok: false, error: updateRes.error.message, detail: updateRes.error }, 500);
    }

    return c.json({ ok: true, session: updateRes.data });
  } catch (e: any) {
    console.error("update-session uncaught:", e);
    return c.json({ ok: false, error: e?.message ?? String(e) }, 500);
  }
});

export default route;
