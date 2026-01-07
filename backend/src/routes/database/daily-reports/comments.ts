import { Hono } from "hono";
import { verify } from "hono/jwt";
import type { Env } from "../../../types/env";
import { getSupabaseAdminClient } from "../../../../lib/supabase";

const route = new Hono<{ Bindings: Env }>();

type SlackApiResponse = { ok: boolean; error?: string };

// Slack chat.update - メッセージを編集
async function updateSlackMessage(
  token: string,
  channelId: string,
  messageTs: string,
  text: string
): Promise<SlackApiResponse> {
  const res = await fetch("https://slack.com/api/chat.update", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel: channelId,
      ts: messageTs,
      text,
    }),
  });
  return (await res.json()) as SlackApiResponse;
}

// Slack chat.delete - メッセージを削除
async function deleteSlackMessage(
  token: string,
  channelId: string,
  messageTs: string
): Promise<SlackApiResponse> {
  const res = await fetch("https://slack.com/api/chat.delete", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel: channelId,
      ts: messageTs,
    }),
  });
  return (await res.json()) as SlackApiResponse;
}

async function requireAdmin(c: any) {
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
  if (payload.role !== "admin") {
    return { ok: false as const, res: c.json({ ok: false, error: "Forbidden (admin only)" }, 403) };
  }
  return { ok: true as const, payload };
}

// コメント一覧取得
route.get("/:sessionId", async (c) => {
  try {
    const sessionId = c.req.param("sessionId");
    if (!sessionId) return c.json({ ok: false, error: "sessionId is required" }, 400);

    const guard = await requireAdmin(c);
    if (!guard.ok) return guard.res;

    const sb = getSupabaseAdminClient(c.env);

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

// コメント編集
route.put("/:commentId", async (c) => {
  try {
    const commentId = c.req.param("commentId");
    if (!commentId) return c.json({ ok: false, error: "commentId is required" }, 400);

    const guard = await requireAdmin(c);
    if (!guard.ok) return guard.res;

    const body = (await c.req.json().catch(() => ({}))) as { text?: string };
    const text = String(body?.text ?? "").trim();
    if (!text) return c.json({ ok: false, error: "text is required" }, 400);

    const sb = getSupabaseAdminClient(c.env);

    // アプリから投稿したコメントのみ編集可能（Slackからのコメントは編集不可）
    const { data: existing, error: existErr } = await sb
      .from("daily_report_comments")
      .select("id, source, slack_channel_id, slack_message_ts")
      .eq("id", commentId)
      .maybeSingle();

    if (existErr) return c.json({ ok: false, error: existErr.message }, 500);
    if (!existing) return c.json({ ok: false, error: "Comment not found" }, 404);
    if (existing.source === "slack") {
      return c.json({ ok: false, error: "Cannot edit Slack comments" }, 400);
    }

    // Slackのメッセージも編集（slack_channel_id と slack_message_ts がある場合）
    if (existing.slack_channel_id && existing.slack_message_ts && c.env.SLACK_BOT_TOKEN) {
      const slackRes = await updateSlackMessage(
        c.env.SLACK_BOT_TOKEN,
        existing.slack_channel_id,
        existing.slack_message_ts,
        text
      );
      if (!slackRes.ok) {
        console.warn("[daily-reports/comments] Slack chat.update failed:", slackRes.error);
        // Slackの編集失敗はDBの更新を止めない（ログだけ残す）
      }
    }

    const { error: updateErr } = await sb
      .from("daily_report_comments")
      .update({ text, updated_at: new Date().toISOString() })
      .eq("id", commentId);

    if (updateErr) return c.json({ ok: false, error: updateErr.message }, 500);

    return c.json({ ok: true, commentId });
  } catch (e: any) {
    console.error("[daily-reports/comments] PUT error", e);
    return c.json({ ok: false, error: e?.message ?? String(e) }, 500);
  }
});

// コメント削除
route.delete("/:commentId", async (c) => {
  try {
    const commentId = c.req.param("commentId");
    if (!commentId) return c.json({ ok: false, error: "commentId is required" }, 400);

    const guard = await requireAdmin(c);
    if (!guard.ok) return guard.res;

    const sb = getSupabaseAdminClient(c.env);

    // アプリから投稿したコメントのみ削除可能（Slackからのコメントは削除不可）
    const { data: existing, error: existErr } = await sb
      .from("daily_report_comments")
      .select("id, source, slack_channel_id, slack_message_ts")
      .eq("id", commentId)
      .maybeSingle();

    if (existErr) return c.json({ ok: false, error: existErr.message }, 500);
    if (!existing) return c.json({ ok: false, error: "Comment not found" }, 404);
    if (existing.source === "slack") {
      return c.json({ ok: false, error: "Cannot delete Slack comments" }, 400);
    }

    // Slackのメッセージも削除（slack_channel_id と slack_message_ts がある場合）
    if (existing.slack_channel_id && existing.slack_message_ts && c.env.SLACK_BOT_TOKEN) {
      const slackRes = await deleteSlackMessage(
        c.env.SLACK_BOT_TOKEN,
        existing.slack_channel_id,
        existing.slack_message_ts
      );
      if (!slackRes.ok && slackRes.error !== "message_not_found") {
        console.warn("[daily-reports/comments] Slack chat.delete failed:", slackRes.error);
        // Slackの削除失敗はDBの削除を止めない（ログだけ残す）
      }
    }

    const { error: deleteErr } = await sb
      .from("daily_report_comments")
      .delete()
      .eq("id", commentId);

    if (deleteErr) return c.json({ ok: false, error: deleteErr.message }, 500);

    return c.json({ ok: true, commentId });
  } catch (e: any) {
    console.error("[daily-reports/comments] DELETE error", e);
    return c.json({ ok: false, error: e?.message ?? String(e) }, 500);
  }
});

export default route;
