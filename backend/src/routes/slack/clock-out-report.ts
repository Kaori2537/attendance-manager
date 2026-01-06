import { Hono } from "hono";
import { verify } from "hono/jwt";
import { Task } from "../../../../shared/types/Attendance";
import type { Env } from "../../types/env";
import { getSupabaseAdminClient } from "../../../lib/supabase";

interface SlackPostMessageResponse {
  ok: boolean;
  ts?: string;
  error?: string;
}

const slackClockOutReport = new Hono<{ Bindings: Env }>();

slackClockOutReport.post("/", async (c) => {
  // auth
  const authHeader = c.req.header("Authorization") ?? c.req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) return c.json({ ok: false, error: "Unauthorized" }, 401);

  const token = authHeader.split(" ")[1];
  try {
    await verify(token, c.env.JWT_SECRET);
  } catch {
    return c.json({ ok: false, error: "Invalid token" }, 401);
  }

  // body
  const { sessionId, userName, actualTasks, summary, issues, notes } = (await c.req.json()) as {
    sessionId: string;
    userName: string;
    actualTasks: Task[];
    summary?: string;
    issues?: string;
    notes?: string;
  };
  if (!sessionId) return c.json({ ok: false, error: "sessionId is required" }, 400);

  // message
  const now = new Date();
  const timeString = now.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });

  const tasksText = (actualTasks ?? []).map((t) => `• ${t.task}（${t.hours}）`).join("\n");
  let messageText = `${timeString}\n*${userName} さんが退勤しました！*\n\n*本日の業務*\n${tasksText || "（未入力）"}`;

  if (summary) messageText += `\n\n*まとめ*\n${summary}`;
  if (issues) messageText += `\n\n*困っていること*\n${issues}`;
  if (notes) messageText += `\n\n*連絡事項*\n${notes}`;

  // post slack
  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${c.env.SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel: c.env.SLACK_CHANNEL_ID,
      text: messageText,
      username: userName,
      icon_emoji: ":wave:",
    }),
  });

  const slackRes = (await response.json()) as SlackPostMessageResponse;
  if (!slackRes.ok || !slackRes.ts) {
    return c.json({ ok: false, error: "Failed to send Slack message", detail: slackRes }, 500);
  }

  // ✅ link保存（kind は clock_out で統一）
  const sb = getSupabaseAdminClient(c.env);
  const up = await sb.from("daily_report_slack_links").upsert(
    {
      daily_report_session_id: sessionId,
      channel_id: c.env.SLACK_CHANNEL_ID,
      message_ts: slackRes.ts,
      kind: "clock_out",
    },
    { onConflict: "daily_report_session_id,kind" }
  );

  if (up.error) {
    return c.json({ ok: false, error: `daily_report_slack_links upsert: ${up.error.message}` }, 500);
  }

  return c.json({ ok: true, slack_ts: slackRes.ts, sessionId, kind: "clock_out" });
});

export default slackClockOutReport;
