"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Comment = {
  id: string;
  daily_report_session_id: string;
  // テーブルにある列だけに寄せる（あなたの実装に合わせて）
  source: string | null;
  message_ts: string | null;
  text: string | null; // ← 実DBが body/content ならここを変える
  created_at: string;
};

function safeText(x: any) {
  const v = typeof x === "string" ? x : x == null ? "" : String(x);
  return v;
}

export default function AdminDailyReportComments({
  sessionId,
  apiBase,
  apiToken,
}: {
  sessionId: string;
  apiBase: string;
  apiToken: string;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const listUrl = useMemo(
    () => `${apiBase}/database/daily-reports/comments/${sessionId}`,
    [apiBase, sessionId]
  );

  const postUrl = useMemo(
    () => `${apiBase}/database/daily-reports/add-slack-comment/${sessionId}/comments`,
    [apiBase, sessionId]
  );

  async function load() {
    try {
      setLoadErr(null);

      const res = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${apiToken}` },
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? `Failed (${res.status})`);

      const rows: Comment[] = (data.comments ?? []).slice();
      // created_at desc を一応保証
      rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

      setComments(rows);
    } catch (e: any) {
      setLoadErr(e?.message ?? String(e));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listUrl, apiToken]);

  async function submit() {
    const v = text.trim();
    if (!v) return;

    try {
      setBusy(true);

      const res = await fetch(postUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: v }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? `Failed (${res.status})`);

      setText("");
      await load();
      router.refresh();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">Admin Comments (Slack thread)</div>

      <div className="rounded-lg border p-3 space-y-2">
        {loadErr ? (
          <div className="text-xs text-red-600">{loadErr}</div>
        ) : comments.length === 0 ? (
          <div className="text-xs text-muted-foreground">コメントはまだありません</div>
        ) : (
          <ul className="space-y-3">
            {comments.map((c) => (
              <li key={c.id} className="text-sm">
                <div className="text-xs text-muted-foreground">
                  {new Date(c.created_at).toLocaleString()} / {c.source ?? "app"}
                </div>
                <div className="whitespace-pre-wrap">{safeText(c.text)}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex gap-2">
        <input
          className="flex-1 rounded-md border px-3 py-2 text-sm"
          placeholder="Slackスレッドにコメントを投稿"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy}
        />
        <button
          className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
          onClick={submit}
          disabled={busy || !text.trim()}
        >
          送信
        </button>
      </div>
    </div>
  );
}
