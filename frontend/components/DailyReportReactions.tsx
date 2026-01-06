'use client';

import { useState } from 'react';

const REACTIONS = [
  { label: '👍', emoji: '+1' },
  { label: '🎉', emoji: 'tada' },
  { label: '👏', emoji: 'clap' },
  { label: '✅', emoji: 'white_check_mark' },
  { label: '🙏', emoji: 'pray' },
  { label: '👀', emoji: 'eyes' },
] as const;

type Props = {
  sessionId: string;
  initialCounts?: Record<string, number>;
  apiBase: string;
};

export function DailyReportReactions({
  sessionId,
  initialCounts = {},
  apiBase,
}: Props) {
  const [counts, setCounts] = useState<Record<string, number>>(initialCounts);
  const [mine, setMine] = useState<Set<string>>(new Set());

  async function toggle(emoji: string) {
    const isOn = mine.has(emoji);

    // 楽観的更新（UIを先に動かす）
    setMine((prev) => {
      const next = new Set(prev);
      isOn ? next.delete(emoji) : next.add(emoji);
      return next;
    });
    setCounts((prev) => ({
      ...prev,
      [emoji]: (prev[emoji] ?? 0) + (isOn ? -1 : 1),
    }));

    await fetch(
      `${apiBase}/database/daily-reports/add-slack-reaction/${sessionId}/reactions`,
      {
        method: isOn ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // ← ログイン済み前提
        body: JSON.stringify({ emoji }),
      }
    );
  }

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {REACTIONS.map((r) => (
        <button
          key={r.emoji}
          onClick={() => toggle(r.emoji)}
          style={{
            padding: '4px 8px',
            borderRadius: 12,
            border: mine.has(r.emoji) ? '2px solid #4f46e5' : '1px solid #ccc',
            background: 'white',
            cursor: 'pointer',
          }}
        >
          {r.label} {counts[r.emoji] ?? 0}
        </button>
      ))}
    </div>
  );
}
