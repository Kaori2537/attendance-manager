// backend/src/routes/database/daily-reports/add-slack-reaction.ts
import { Hono } from "hono";
import { verify } from "hono/jwt";
import type { Env } from "../../../types/env";
import { getSupabaseAdminClient } from "../../../../lib/supabase";

type Kind = "clock_in" | "clock_out";
type Body = { emoji?: string; kind?: Kind };

type SlackApiResponse = {
  ok: boolean;
  error?: string;
  needed?: string;
  provided?: string;
};

function normalizeEmojiName(input: string) {
  const s = String(input ?? "").trim();
  return s.replace(/^:/, "").replace(/:$/, "");
}

function normalizeKind(input: unknown): Kind | null {
  const k = String(input ?? "").trim().toLowerCase();
  if (k === "clock_in") return "clock_in";
  if (k === "clock_out") return "clock_out";
  return null;
}

async function requireAdmin(c: any) {
  const authHeader = c.req.header("Authorization") ?? c.req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) return { ok: false as const, res: c.json({ ok: false, error: "Unauthorized" }, 401) };
  if (!c.env.JWT_SECRET) return { ok: false as const, res: c.json({ ok: false, error: "JWT_SECRET missing" }, 500) };

  const token = authHeader.split(" ")[1];
  let payload: { id: string; role: "admin" | "user" };
  try {
    payload = (await verify(token, c.env.JWT_SECRET)) as any;
  } catch {
    return { ok: false as const, res: c.json({ ok: false, error: "Invalid token" }, 401) };
  }
  if (payload.role !== "admin") return { ok: false as const, res: c.json({ ok: false, error: "Forbidden (admin only)" }, 403) };
  return { ok: true as const, payload };
}

export default new Hono<{ Bindings: Env }>()
  // リアクション一覧を取得
  .get("/:sessionId/reactions", async (c) => {
    const sessionId = c.req.param("sessionId");

    const guard = await requireAdmin(c);
    if (!guard.ok) return guard.res;

    const sb = getSupabaseAdminClient(c.env);

    const { data, error } = await sb
      .from("daily_report_reactions")
      .select("id, emoji, kind, source, created_at")
      .eq("daily_report_session_id", sessionId)
      .order("created_at", { ascending: true });

    if (error) return c.json({ ok: false, error: `daily_report_reactions select: ${error.message}` }, 500);

    return c.json({ ok: true, reactions: data ?? [] });
  })
  .post("/:sessionId/reactions", async (c) => {
    const sessionId = c.req.param("sessionId");

    const guard = await requireAdmin(c);
    if (!guard.ok) return guard.res;

    const body = (await c.req.json().catch(() => ({}))) as Body;

    // body.kind 優先、なければ query.kind を見る（どっちでも動く）
    const kind = normalizeKind(body.kind ?? c.req.query("kind"));
    if (!kind) return c.json({ ok: false, error: "kind is required (clock_in|clock_out)" }, 400);

    const emoji = normalizeEmojiName(body.emoji ?? "");
    if (!emoji) return c.json({ ok: false, error: "emoji is required" }, 400);

    const slackToken = c.env.SLACK_BOT_TOKEN;
    if (!slackToken) return c.json({ ok: false, error: "Missing env: SLACK_BOT_TOKEN" }, 500);

    const sb = getSupabaseAdminClient(c.env);

    const { data: link, error: linkErr } = await sb
      .from("daily_report_slack_links")
      .select("channel_id,message_ts,kind")
      .eq("daily_report_session_id", sessionId)
      .eq("kind", kind)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (linkErr) return c.json({ ok: false, error: `daily_report_slack_links select: ${linkErr.message}` }, 500);
    if (!link?.channel_id || !link?.message_ts) {
      return c.json({ ok: false, error: `Slack link not found (kind=${kind})`, sessionId, kind }, 404);
    }

    const slackRes = await fetch("https://slack.com/api/reactions.add", {
      method: "POST",
      headers: { Authorization: `Bearer ${slackToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ channel: link.channel_id, timestamp: link.message_ts, name: emoji }),
    });

    const slackJson = (await slackRes.json().catch(() => ({}))) as SlackApiResponse;
    // already_reacted は「すでにリアクション済み」なので成功扱い
    const isAlreadyReacted = slackJson.error === "already_reacted";
    if (!slackRes.ok || (!slackJson.ok && !isAlreadyReacted)) {
      return c.json(
        {
          ok: false,
          error: "Slack reactions.add failed",
          slack_status: slackRes.status,
          slack_error: slackJson.error ?? "unknown",
          needed: slackJson.needed,
          provided: slackJson.provided,
        },
        502
      );
    }

    // DBログ（任意。重複は無視してOK）
    const ins = await sb.from("daily_report_reactions").insert({
      daily_report_session_id: sessionId,
      emoji,
      kind,
      source: "app",
    });
    if (ins.error && (ins.error as any).code !== "23505") {
      return c.json({ ok: false, error: `daily_report_reactions insert: ${ins.error.message}` }, 500);
    }

    // 日報のユーザーに通知を作成
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

      if (report?.user_id && report.user_id !== guard.payload.id) {
        // リアクション投稿者と日報の所有者が異なる場合のみ通知
        const emojiMap: Record<string, string> = {
          "+1": "👍",
          "tada": "🎉",
          "clap": "👏",
          "white_check_mark": "✅",
          "pray": "🙏",
          "eyes": "👀",
        };
        const emojiLabel = emojiMap[emoji] ?? emoji;
        const [, m, d] = report.report_date.split("-").map(Number);
        const dateLabel = `${m}月${d}日`;
        await sb.from("notifications").insert({
          user_id: report.user_id,
          type: "reaction",
          title: `${dateLabel}の日報にリアクションがつきました`,
          message: emojiLabel,
          link: `/daily-reports?date=${report.report_date}`,
        });
      }
    }

    return c.json({ ok: true, sessionId, kind, emoji });
  })
  .delete("/:sessionId/reactions", async (c) => {
    const sessionId = c.req.param("sessionId");

    const guard = await requireAdmin(c);
    if (!guard.ok) return guard.res;

    const body = (await c.req.json().catch(() => ({}))) as Body;

    const kind = normalizeKind(body.kind ?? c.req.query("kind"));
    if (!kind) return c.json({ ok: false, error: "kind is required (clock_in|clock_out)" }, 400);

    const emoji = normalizeEmojiName(body.emoji ?? "");
    if (!emoji) return c.json({ ok: false, error: "emoji is required" }, 400);

    const slackToken = c.env.SLACK_BOT_TOKEN;
    if (!slackToken) return c.json({ ok: false, error: "Missing env: SLACK_BOT_TOKEN" }, 500);

    const sb = getSupabaseAdminClient(c.env);

    const { data: link, error: linkErr } = await sb
      .from("daily_report_slack_links")
      .select("channel_id,message_ts,kind")
      .eq("daily_report_session_id", sessionId)
      .eq("kind", kind)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (linkErr) return c.json({ ok: false, error: `daily_report_slack_links select: ${linkErr.message}` }, 500);
    if (!link?.channel_id || !link?.message_ts) {
      return c.json({ ok: false, error: `Slack link not found (kind=${kind})`, sessionId, kind }, 404);
    }

    const slackRes = await fetch("https://slack.com/api/reactions.remove", {
      method: "POST",
      headers: { Authorization: `Bearer ${slackToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ channel: link.channel_id, timestamp: link.message_ts, name: emoji }),
    });

    const slackJson = (await slackRes.json().catch(() => ({}))) as SlackApiResponse;
    // no_reaction は「リアクションが存在しない」なので成功扱い
    const isNoReaction = slackJson.error === "no_reaction";
    if (!slackRes.ok || (!slackJson.ok && !isNoReaction)) {
      return c.json(
        {
          ok: false,
          error: "Slack reactions.remove failed",
          slack_status: slackRes.status,
          slack_error: slackJson.error ?? "unknown",
          needed: slackJson.needed,
          provided: slackJson.provided,
        },
        502
      );
    }

    const del = await sb
      .from("daily_report_reactions")
      .delete()
      .eq("daily_report_session_id", sessionId)
      .eq("emoji", emoji)
      .eq("kind", kind);

    if (del.error) return c.json({ ok: false, error: `daily_report_reactions delete: ${del.error.message}` }, 500);

    return c.json({ ok: true, sessionId, kind, emoji });
  });
