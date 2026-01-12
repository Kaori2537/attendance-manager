import { Hono } from "hono";
import { verify } from "hono/jwt";
import type { Env } from "../../../types/env";
import { getSupabaseAdminClient } from "../../../../lib/supabase";

const route = new Hono<{ Bindings: Env }>();

type Body = { text: string };

type SlackPostMessageResponse = { ok: boolean; ts?: string; error?: string };

async function postSlackThreadReply(c: any, args: { channelId: string; parentTs: string; text: string }) {
  const token = c.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error("Missing env: SLACK_BOT_TOKEN");

  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel: args.channelId,
      thread_ts: args.parentTs,
      text: args.text,
    }),
  });

  const slackRes = (await res.json()) as SlackPostMessageResponse;
  if (!slackRes.ok || !slackRes.ts) {
    throw new Error(`Slack chat.postMessage(thread) failed: ${slackRes.error ?? "unknown"}`);
  }
  return slackRes.ts;
}

route.post("/:sessionId/comments", async (c) => {
  try {
    // --- auth ---
    const authHeader = c.req.header("Authorization") ?? c.req.header("authorization");
    if (!authHeader?.startsWith("Bearer ")) return c.json({ ok: false, error: "Unauthorized" }, 401);
    const token = authHeader.slice("Bearer ".length).trim();

    if (!c.env.JWT_SECRET) return c.json({ ok: false, error: "JWT_SECRET missing" }, 500);

    let payload: any;
    try {
      payload = await verify(token, c.env.JWT_SECRET);
    } catch {
      return c.json({ ok: false, error: "Invalid token" }, 401);
    }

    if (payload?.role !== "admin") return c.json({ ok: false, error: "Forbidden" }, 403);

    const sessionId = c.req.param("sessionId");
    const body = (await c.req.json().catch(() => ({} as any))) as Body;

    const text = String(body?.text ?? "").trim();
    if (!text) return c.json({ ok: false, error: "text required" }, 400);

    const sb = getSupabaseAdminClient(c.env);

    // 1) slack link を引く（sessionId -> channel_id + message_ts）
    const { data: link, error: linkErr } = await sb
      .from("daily_report_slack_links")
      .select("channel_id, message_ts")
      .eq("daily_report_session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (linkErr) return c.json({ ok: false, error: linkErr.message }, 500);
    if (!link?.channel_id || !link?.message_ts) {
      return c.json({ ok: false, error: "Slack link not found for this session" }, 400);
    }

    // 2) Slack thread に投稿（親は message_ts）
    const commentTs = await postSlackThreadReply(c, {
      channelId: link.channel_id,
      parentTs: link.message_ts,
      text,
    });

    // 3) DB 保存（actor は admin の user id + Slack連携情報も保存）
    const { data: insertedComment, error: insErr } = await sb
      .from("daily_report_comments")
      .insert({
        daily_report_session_id: sessionId,
        user_id: payload.id,
        slack_user_id: null,
        text,
        source: "app",
        // Slack連携情報（編集・削除時に必要）
        slack_channel_id: link.channel_id,
        slack_thread_ts: link.message_ts,
        slack_message_ts: commentTs,
      })
      .select("id")
      .single();

    if (insErr) return c.json({ ok: false, error: insErr.message }, 500);

    // 4) 日報のユーザーに通知を作成
    const { data: session } = await sb
      .from("daily_report_sessions")
      .select("daily_report_id")
      .eq("id", sessionId)
      .single();

    if (session?.daily_report_id) {
      const { data: report } = await sb
        .from("daily_reports")
        .select("user_id, report_date")
        .eq("id", session.daily_report_id)
        .single();

      if (report?.user_id && report.user_id !== payload.id) {
        // コメント投稿者と日報の所有者が異なる場合のみ通知
        const [, m, d] = report.report_date.split("-").map(Number);
        const dateLabel = `${m}月${d}日`;
        await sb.from("notifications").insert({
          user_id: report.user_id,
          type: "comment",
          title: `${dateLabel}の日報にコメントがつきました`,
          message: text.length > 50 ? text.slice(0, 50) + "..." : text,
          link: `/daily-reports?date=${report.report_date}`,
        });
      }
    }

    return c.json({ ok: true, slackTs: commentTs, commentId: insertedComment?.id });
  } catch (e: any) {
    console.error("[add-slack-comment] error:", e);
    return c.json({ ok: false, error: e?.message ?? String(e) }, 500);
  }
});

export default route;
