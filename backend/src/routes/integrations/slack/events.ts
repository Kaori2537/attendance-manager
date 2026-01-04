// backend/src/routes/integrations/slack/events.ts
//
// Slack Events API endpoint (Cloudflare Workers + Hono)
// - URL verification
// - Signature verification (SLACK_SIGNING_SECRET)
// - Reactions (added/removed) -> daily_report_reactions
//   - Also supports reactions added to thread replies by resolving to parent thread_ts
// - Thread replies (comments) + edit + delete -> daily_report_comments
//
// Route mounting (expected):
//   app.route("/integrations/slack", slackRouter)
//   slackRouter.route("/events", eventsRouter)
// => This file should use relative path: POST "/"
//
// Required env bindings:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY  (or map to this in your env layer)
// - SLACK_SIGNING_SECRET
// - SLACK_BOT_TOKEN   (used to resolve parent ts when reaction is on a reply)
//
// Notes:
// - Slack "message" events include many variants; we only mirror *thread replies*
//   where thread_ts exists AND ts !== thread_ts.
// - We ignore bot messages to avoid mirroring our own posts.

import { Hono } from "hono";
import { createClient } from "@supabase/supabase-js";

type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SLACK_SIGNING_SECRET: string;
  SLACK_BOT_TOKEN: string;
};

type SlackEnvelope = {
  type: "url_verification" | "event_callback";
  challenge?: string;
  event?: SlackEvent;
  event_id?: string;
  event_time?: number;
  team_id?: string;
  api_app_id?: string;
  token?: string;
};

type SlackEvent =
  | SlackReactionAdded
  | SlackReactionRemoved
  | SlackMessage
  | SlackMessageChanged
  | SlackMessageDeleted
  | Record<string, any>;

type SlackReactionAdded = {
  type: "reaction_added";
  user: string;
  reaction: string;
  item: { type: "message"; channel: string; ts: string };
  event_ts: string;
};

type SlackReactionRemoved = {
  type: "reaction_removed";
  user: string;
  reaction: string;
  item: { type: "message"; channel: string; ts: string };
  event_ts: string;
};

type SlackMessage = {
  type: "message";
  subtype?: string;
  channel: string;
  user?: string;
  bot_id?: string;
  text?: string;
  ts: string;
  thread_ts?: string;
  event_ts?: string;
  client_msg_id?: string;
};

type SlackMessageChanged = {
  type: "message";
  subtype: "message_changed";
  channel: string;
  ts: string;
  message?: {
    user?: string;
    bot_id?: string;
    subtype?: string;
    text?: string;
    ts: string;
    thread_ts?: string;
  };
  event_ts?: string;
};

type SlackMessageDeleted = {
  type: "message";
  subtype: "message_deleted";
  channel: string;
  deleted_ts: string;
  previous_message?: {
    ts?: string;
    thread_ts?: string;
    text?: string;
    user?: string;
    bot_id?: string;
    subtype?: string;
  };
  event_ts?: string;
};

function getSupabase(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

/**
 * Slack signing verification (v0)
 * https://api.slack.com/authentication/verifying-requests-from-slack
 */
async function verifySlackSignature(
  req: Request,
  signingSecret: string,
  rawBodyText: string
): Promise<boolean> {
  const ts = req.headers.get("x-slack-request-timestamp");
  const sig = req.headers.get("x-slack-signature");
  if (!ts || !sig) return false;

  // replay mitigation (5 minutes)
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - tsNum) > 60 * 5) return false;

  const base = `v0:${ts}:${rawBodyText}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(base)
  );
  const hex = [...new Uint8Array(mac)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const expected = `v0=${hex}`;

  return timingSafeEqual(expected, sig);
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

type SessionLink = {
  daily_report_session_id: string;
};

async function getSessionIdBySlackParentMessage(
  supabase: ReturnType<typeof getSupabase>,
  channelId: string,
  parentMessageTs: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("daily_report_slack_links")
    .select("daily_report_session_id")
    .eq("channel_id", channelId)
    .eq("message_ts", parentMessageTs)
    .maybeSingle<SessionLink>();

  if (error) {
    console.error("[slack] failed to lookup session link", {
      channelId,
      parentMessageTs,
      error,
    });
    return null;
  }
  return data?.daily_report_session_id ?? null;
}

function isThreadReplyMessage(msg: SlackMessage) {
  return Boolean(msg.thread_ts && msg.ts && msg.thread_ts !== msg.ts);
}

function isBotMessageLike(obj: { bot_id?: string; subtype?: string }) {
  return Boolean(obj.bot_id) || obj.subtype === "bot_message";
}

function getPgErrorCode(err: unknown): string | undefined {
  const code = (err as { code?: unknown })?.code;
  return typeof code === "string" ? code : undefined;
}

/**
 * Resolve "parent ts" for any message:
 * - If the message is a thread reply, return thread_ts
 * - If it's a parent message, return its own ts
 *
 * Uses Slack API (conversations.replies) for correctness.
 */
async function resolveParentTsForAnyMessage(params: {
  env: Env;
  channelId: string;
  messageTs: string;
}): Promise<string> {
  const { env, channelId, messageTs } = params;

  // If no token, fallback to current behavior (treat the reacted message as parent)
  if (!env.SLACK_BOT_TOKEN) return messageTs;

  const url = new URL("https://slack.com/api/conversations.replies");
  url.searchParams.set("channel", channelId);
  url.searchParams.set("ts", messageTs);
  url.searchParams.set("limit", "1");

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${env.SLACK_BOT_TOKEN}`,
    },
  });

  const json = (await res.json()) as {
    ok: boolean;
    error?: string;
    messages?: Array<{ ts: string; thread_ts?: string }>;
  };

  if (!json.ok) {
    console.warn("[slack] conversations.replies failed; fallback to messageTs", {
      channelId,
      messageTs,
      error: json.error,
    });
    return messageTs;
  }

  const msg = json.messages?.[0];
  if (!msg) return messageTs;

  // Reply => thread_ts is parent, otherwise ts itself is parent
  return msg.thread_ts && msg.thread_ts !== msg.ts ? msg.thread_ts : msg.ts;
}

async function upsertSlackComment(params: {
  supabase: ReturnType<typeof getSupabase>;
  dailyReportSessionId: string;
  channelId: string;
  threadTs: string;
  messageTs: string;
  slackUserId: string | null;
  body: string;
}) {
  const {
    supabase,
    dailyReportSessionId,
    channelId,
    threadTs,
    messageTs,
    slackUserId,
    body,
  } = params;

  const { error } = await supabase.from("daily_report_comments").upsert(
    {
      daily_report_session_id: dailyReportSessionId,
      source: "slack",
      slack_channel_id: channelId,
      slack_thread_ts: threadTs,
      slack_message_ts: messageTs,
      slack_user_id: slackUserId,
      body,
      is_deleted: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "slack_channel_id,slack_message_ts" }
  );

  if (error) {
    console.error("[slack] upsert comment failed", {
      dailyReportSessionId,
      channelId,
      threadTs,
      messageTs,
      error,
    });
    throw error;
  }
}

async function markSlackCommentDeleted(params: {
  supabase: ReturnType<typeof getSupabase>;
  channelId: string;
  messageTs: string;
}) {
  const { supabase, channelId, messageTs } = params;

  const { error } = await supabase
    .from("daily_report_comments")
    .update({
      is_deleted: true,
      updated_at: new Date().toISOString(),
    })
    .eq("slack_channel_id", channelId)
    .eq("slack_message_ts", messageTs);

  if (error) {
    console.error("[slack] delete comment update failed", {
      channelId,
      messageTs,
      error,
    });
    throw error;
  }
}

async function insertReaction(params: {
  supabase: ReturnType<typeof getSupabase>;
  dailyReportSessionId: string;
  emoji: string;
  slackUserId: string;
  source: string;
}) {
  const { supabase, dailyReportSessionId, emoji, slackUserId, source } = params;

  const { error } = await supabase.from("daily_report_reactions").insert({
    daily_report_session_id: dailyReportSessionId,
    emoji,
    slack_user_id: slackUserId,
    source,
  });

  if (error) {
    const code = getPgErrorCode(error);
    if (code === "23505") return; // duplicate
    console.error("[slack] insert reaction failed", {
      dailyReportSessionId,
      emoji,
      slackUserId,
      source,
      error,
    });
    throw error;
  }
}

async function deleteReaction(params: {
  supabase: ReturnType<typeof getSupabase>;
  dailyReportSessionId: string;
  emoji: string;
  slackUserId: string;
}) {
  const { supabase, dailyReportSessionId, emoji, slackUserId } = params;

  const { error } = await supabase
    .from("daily_report_reactions")
    .delete()
    .eq("daily_report_session_id", dailyReportSessionId)
    .eq("emoji", emoji)
    .eq("slack_user_id", slackUserId);

  if (error) {
    console.error("[slack] delete reaction failed", {
      dailyReportSessionId,
      emoji,
      slackUserId,
      error,
    });
    throw error;
  }
}

export const slackEventsRoute = new Hono<{ Bindings: Env }>();

slackEventsRoute.post("/", async (c) => {
  const rawBody = await c.req.text();

  // Guard: missing env should not crash into 500 without logs.
  if (!c.env.SLACK_SIGNING_SECRET) {
    console.error("[slack] SLACK_SIGNING_SECRET is missing");
    return c.json({ ok: false, error: "SLACK_SIGNING_SECRET is missing" }, 500);
  }
  if (!c.env.SUPABASE_URL || !c.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[slack] Supabase env is missing", {
      hasUrl: Boolean(c.env.SUPABASE_URL),
      hasKey: Boolean(c.env.SUPABASE_SERVICE_ROLE_KEY),
    });
    return c.json({ ok: false, error: "Supabase env is missing" }, 500);
  }

  // Verify signature (and keep handler stable even if crypto throws)
  let ok = false;
  try {
    ok = await verifySlackSignature(
      c.req.raw,
      c.env.SLACK_SIGNING_SECRET,
      rawBody
    );
  } catch (err) {
    console.error("[slack] signature verification crashed", err);
    return c.json({ ok: false, error: "signature verification crashed" }, 500);
  }

  if (!ok) {
    console.warn("[slack] signature verification failed");
    return c.json({ ok: false }, 401);
  }

  // Parse JSON
  let payload: SlackEnvelope;
  try {
    payload = JSON.parse(rawBody) as SlackEnvelope;
  } catch {
    console.warn("[slack] invalid json body");
    return c.json({ ok: false }, 400);
  }

  // URL verification
  if (payload.type === "url_verification") {
    return c.json({ challenge: payload.challenge });
  }

  // Event callback
  if (payload.type !== "event_callback" || !payload.event) {
    return c.json({ ok: true });
  }

  console.log(
    "[slack] event received",
    payload.event.type,
    "subtype" in payload.event ? (payload.event as any).subtype : undefined
  );

  const supabase = getSupabase(c.env);

  try {
    const event = payload.event;

    // --- Reactions ---
    if (event.type === "reaction_added") {
      const e = event as SlackReactionAdded;
      if (e.item?.type !== "message") return c.json({ ok: true });

      const channelId = e.item.channel;
      const messageTs = e.item.ts;

      // Normalize to parent ts (supports reactions on replies)
      const parentTs = await resolveParentTsForAnyMessage({
        env: c.env,
        channelId,
        messageTs,
      });

      const sessionId = await getSessionIdBySlackParentMessage(
        supabase,
        channelId,
        parentTs
      );
      if (!sessionId) {
        console.log("[slack] reaction_added ignored (no session link)", {
          channelId,
          messageTs,
          parentTs,
        });
        return c.json({ ok: true });
      }

      await insertReaction({
        supabase,
        dailyReportSessionId: sessionId,
        emoji: e.reaction,
        slackUserId: e.user,
        source: "slack",
      });

      return c.json({ ok: true });
    }

    if (event.type === "reaction_removed") {
      const e = event as SlackReactionRemoved;
      if (e.item?.type !== "message") return c.json({ ok: true });

      const channelId = e.item.channel;
      const messageTs = e.item.ts;

      // Normalize to parent ts (supports reactions on replies)
      const parentTs = await resolveParentTsForAnyMessage({
        env: c.env,
        channelId,
        messageTs,
      });

      const sessionId = await getSessionIdBySlackParentMessage(
        supabase,
        channelId,
        parentTs
      );
      if (!sessionId) {
        console.log("[slack] reaction_removed ignored (no session link)", {
          channelId,
          messageTs,
          parentTs,
        });
        return c.json({ ok: true });
      }

      await deleteReaction({
        supabase,
        dailyReportSessionId: sessionId,
        emoji: e.reaction,
        slackUserId: e.user,
      });

      return c.json({ ok: true });
    }

    // --- Comments: thread replies (create) ---
    // Slack thread reply: type=message, no subtype, has thread_ts and ts != thread_ts
    if (event.type === "message" && !("subtype" in event)) {
      const e = event as SlackMessage;

      if (isBotMessageLike(e)) return c.json({ ok: true });
      if (!isThreadReplyMessage(e)) return c.json({ ok: true });

      const channelId = e.channel;
      const threadTs = e.thread_ts!;
      const messageTs = e.ts;

      const sessionId = await getSessionIdBySlackParentMessage(
        supabase,
        channelId,
        threadTs
      );
      if (!sessionId) {
        console.log("[slack] thread reply ignored (no session link)", {
          channelId,
          threadTs,
          messageTs,
        });
        return c.json({ ok: true });
      }

      await upsertSlackComment({
        supabase,
        dailyReportSessionId: sessionId,
        channelId,
        threadTs,
        messageTs,
        slackUserId: e.user ?? null,
        body: e.text ?? "",
      });

      return c.json({ ok: true });
    }

    // --- Comments: edit (message_changed) ---
    if (event.type === "message" && (event as any).subtype === "message_changed") {
      const e = event as SlackMessageChanged;
      const msg = e.message;
      if (!msg) return c.json({ ok: true });

      if (isBotMessageLike(msg)) return c.json({ ok: true });
      if (!msg.thread_ts || msg.thread_ts === msg.ts) return c.json({ ok: true });

      const channelId = e.channel;
      const threadTs = msg.thread_ts;
      const messageTs = msg.ts;

      const sessionId = await getSessionIdBySlackParentMessage(
        supabase,
        channelId,
        threadTs
      );
      if (!sessionId) {
        console.log("[slack] message_changed ignored (no session link)", {
          channelId,
          threadTs,
          messageTs,
        });
        return c.json({ ok: true });
      }

      await upsertSlackComment({
        supabase,
        dailyReportSessionId: sessionId,
        channelId,
        threadTs,
        messageTs,
        slackUserId: msg.user ?? null,
        body: msg.text ?? "",
      });

      return c.json({ ok: true });
    }

    // --- Comments: delete (message_deleted) ---
    if (event.type === "message" && (event as any).subtype === "message_deleted") {
      const e = event as SlackMessageDeleted;

      const channelId = e.channel;
      const deletedTs = e.deleted_ts;
      const prev = e.previous_message;

      if (prev && isBotMessageLike(prev)) return c.json({ ok: true });

      const threadTs = prev?.thread_ts;

      // ignore parent message deletion (session post)
      if (threadTs && threadTs === deletedTs) return c.json({ ok: true });

      // If thread_ts exists, ensure it belongs to a known session thread; otherwise ignore
      if (threadTs) {
        const sessionId = await getSessionIdBySlackParentMessage(
          supabase,
          channelId,
          threadTs
        );
        if (!sessionId) {
          console.log("[slack] message_deleted ignored (no session link)", {
            channelId,
            threadTs,
            deletedTs,
          });
          return c.json({ ok: true });
        }
      }

      await markSlackCommentDeleted({
        supabase,
        channelId,
        messageTs: deletedTs,
      });

      return c.json({ ok: true });
    }

    // Unhandled events are acknowledged
    return c.json({ ok: true });
  } catch (err) {
    console.error("[slack] events handler error", err);
    // Return 200 to avoid Slack retry storms; logs are the source of truth.
    return c.json({ ok: true });
  }
});

export default slackEventsRoute;
