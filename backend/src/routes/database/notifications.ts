import { Hono } from "hono";
import { verify } from "hono/jwt";
import type { Env } from "../../types/env";
import { getSupabaseAdminClient } from "../../../lib/supabase";

const route = new Hono<{ Bindings: Env }>();

async function requireAuth(c: any) {
  const authHeader = c.req.header("Authorization") ?? c.req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false as const, res: c.json({ ok: false, error: "Unauthorized" }, 401) };
  }
  if (!c.env.JWT_SECRET) {
    return { ok: false as const, res: c.json({ ok: false, error: "JWT_SECRET missing" }, 500) };
  }

  const token = authHeader.split(" ")[1];
  let payload: { id: string; role: "admin" | "user" };
  try {
    payload = (await verify(token, c.env.JWT_SECRET)) as any;
  } catch {
    return { ok: false as const, res: c.json({ ok: false, error: "Invalid token" }, 401) };
  }
  return { ok: true as const, payload };
}

// 通知一覧取得
route.get("/", async (c) => {
  try {
    const guard = await requireAuth(c);
    if (!guard.ok) return guard.res;

    const sb = getSupabaseAdminClient(c.env);

    const { data, error } = await sb
      .from("notifications")
      .select("id, type, title, message, link, read, created_at")
      .eq("user_id", guard.payload.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw new Error(`notifications select: ${error.message}`);

    // 未読数も返す
    const unreadCount = (data ?? []).filter((n) => !n.read).length;

    return c.json({ ok: true, notifications: data ?? [], unreadCount });
  } catch (e: any) {
    console.error("[notifications] GET error:", e);
    return c.json({ ok: false, error: e?.message ?? String(e) }, 500);
  }
});

// 未読数のみ取得（軽量）
route.get("/unread-count", async (c) => {
  try {
    const guard = await requireAuth(c);
    if (!guard.ok) return guard.res;

    const sb = getSupabaseAdminClient(c.env);

    const { count, error } = await sb
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", guard.payload.id)
      .eq("read", false);

    if (error) throw new Error(`notifications count: ${error.message}`);

    return c.json({ ok: true, unreadCount: count ?? 0 });
  } catch (e: any) {
    console.error("[notifications] unread-count error:", e);
    return c.json({ ok: false, error: e?.message ?? String(e) }, 500);
  }
});

// 通知を既読にする
route.put("/:notificationId/read", async (c) => {
  try {
    const notificationId = c.req.param("notificationId");
    if (!notificationId) return c.json({ ok: false, error: "notificationId is required" }, 400);

    const guard = await requireAuth(c);
    if (!guard.ok) return guard.res;

    const sb = getSupabaseAdminClient(c.env);

    const { error } = await sb
      .from("notifications")
      .update({ read: true })
      .eq("id", notificationId)
      .eq("user_id", guard.payload.id); // 自分の通知のみ更新可能

    if (error) throw new Error(`notifications update: ${error.message}`);

    return c.json({ ok: true });
  } catch (e: any) {
    console.error("[notifications] PUT read error:", e);
    return c.json({ ok: false, error: e?.message ?? String(e) }, 500);
  }
});

// すべての通知を既読にする
route.put("/read-all", async (c) => {
  try {
    const guard = await requireAuth(c);
    if (!guard.ok) return guard.res;

    const sb = getSupabaseAdminClient(c.env);

    const { error } = await sb
      .from("notifications")
      .update({ read: true })
      .eq("user_id", guard.payload.id)
      .eq("read", false);

    if (error) throw new Error(`notifications update: ${error.message}`);

    return c.json({ ok: true });
  } catch (e: any) {
    console.error("[notifications] PUT read-all error:", e);
    return c.json({ ok: false, error: e?.message ?? String(e) }, 500);
  }
});

export default route;
