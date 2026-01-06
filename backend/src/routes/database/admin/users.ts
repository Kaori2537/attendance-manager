// backend/src/routes/database/admin/users.ts
import { Hono } from "hono";
import { verify } from "hono/jwt";
import type { Env } from "../../../types/env";
import { getSupabaseAdminClient } from "../../../../lib/supabase";

const route = new Hono<{ Bindings: Env }>();

route.get("/", async (c) => {
  try {
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

    const sb = getSupabaseAdminClient(c.env);

    // ✅ slack_user_id はまだ無い前提で取得しない
    const { data, error } = await sb
      .from("users")
      .select("id, name, email, role")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return c.json({ ok: true, users: data ?? [] });
  } catch (e: any) {
    console.error("[admin/users] error", e);
    return c.json({ ok: false, error: e?.message ?? String(e) }, 500);
  }
});

export default route;
