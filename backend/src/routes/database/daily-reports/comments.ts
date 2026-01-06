import { Hono } from "hono";
import { verify } from "hono/jwt";
import type { Env } from "../../../types/env";
import { getSupabaseAdminClient } from "../../../../lib/supabase";

const route = new Hono<{ Bindings: Env }>();

route.get("/:sessionId", async (c) => {
  try {
    const sessionId = c.req.param("sessionId");
    if (!sessionId) return c.json({ ok: false, error: "sessionId is required" }, 400);

    // --- auth ---
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ ok: false, error: "Unauthorized" }, 401);
    }
    if (!c.env.JWT_SECRET) return c.json({ ok: false, error: "JWT_SECRET missing" }, 500);

    const token = authHeader.split(" ")[1];
    let payload: any;
    try {
      payload = await verify(token, c.env.JWT_SECRET);
    } catch {
      return c.json({ ok: false, error: "Invalid token" }, 401);
    }

    // admin only（今回は管理者画面のため）
    if (payload?.role !== "admin") {
      return c.json({ ok: false, error: "Forbidden" }, 403);
    }

    const sb = getSupabaseAdminClient(c.env);

    // ✅ DBコメント一覧（Slackに投稿済みかどうかは関係なく表示）
    const { data, error } = await sb
      .from("daily_report_comments")
      .select("id, daily_report_session_id, user_id, slack_user_id, text, source, created_at")
      .eq("daily_report_session_id", sessionId)
      .order("created_at", { ascending: true });

    if (error) throw new Error(`daily_report_comments select: ${error.message}`);

    return c.json({ ok: true, comments: data ?? [] });
  } catch (e: any) {
    console.error("[daily-reports/comments] error", e);
    return c.json({ ok: false, error: e?.message ?? String(e) }, 500);
  }
});

export default route;
