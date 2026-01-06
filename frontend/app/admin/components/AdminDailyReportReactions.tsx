"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const EMOJIS = [
  { key: "+1", label: "👍" },
  { key: "tada", label: "🎉" },
  { key: "clap", label: "👏" },
  { key: "white_check_mark", label: "✅" },
  { key: "pray", label: "🙏" },
  { key: "eyes", label: "👀" },
] as const;

type Kind = "clock_in" | "clock_out";

export default function AdminDailyReportReactions({
  sessionId,
  apiBase,
  apiToken,
  kind,
}: {
  sessionId: string;
  apiBase: string;
  apiToken: string;
  kind: Kind;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const endpoint = useMemo(() => {
    // ✅ kind は query に入れる
    return `${apiBase}/database/daily-reports/add-slack-reaction/${sessionId}/reactions?kind=${kind}`;
  }, [apiBase, sessionId, kind]);

  async function call(method: "POST" | "DELETE", emoji: string) {
    try {
      setBusy(true);

      const res = await fetch(endpoint, {
        method,
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ emoji }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `Failed (${res.status})`);
      }

      router.refresh();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="text-sm text-muted-foreground">
        Admin Reactions（{kind === "clock_in" ? "出勤" : "退勤"}）
      </div>

      <div className="flex flex-wrap gap-2">
        {EMOJIS.map((e) => (
          <button
            key={e.key}
            disabled={busy}
            onClick={() => call("POST", e.key)}
            className="rounded-full border px-3 py-1 text-sm hover:bg-muted disabled:opacity-50"
          >
            {e.label}
          </button>
        ))}

        <button
          disabled={busy}
          onClick={() => call("DELETE", "+1")}
          className="rounded-full border px-3 py-1 text-sm hover:bg-muted disabled:opacity-50"
        >
          👍−
        </button>
      </div>
    </div>
  );
}
