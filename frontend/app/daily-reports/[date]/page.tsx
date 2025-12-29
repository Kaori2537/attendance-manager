"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useDailyReportByDate } from "../hooks/useDailyReportByDate";

type SessionDraft = {
  id: string;
  session_no: number;
  planned_minutes: number;
  actual_minutes: number;
  // 使ってるカラムが他にもあれば増やしてOK
};

function minutesToHours(m: number) {
  // 小数1桁で表示（例: 90min -> 1.5）
  return Math.round((m / 60) * 10) / 10;
}

function hoursToMinutes(h: number) {
  if (!Number.isFinite(h)) return 0;
  // 0.1h = 6min なので10分単位にしたいならここを調整
  return Math.round(h * 60);
}

export default function DailyReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const date = params.date as string;

  const { data, loading, error } = useDailyReportByDate(date);

  // APIデータを元にローカル編集用stateを持つ
  const [sessions, setSessions] = useState<SessionDraft[]>([]);
  const [dirty, setDirty] = useState(false);

  // 初回ロード or date切替時に同期
  useEffect(() => {
    if (data?.ok && Array.isArray(data.sessions)) {
      const base: SessionDraft[] = data.sessions.map((s: any) => ({
        id: s.id,
        session_no: s.session_no,
        planned_minutes: s.planned_minutes ?? 0,
        actual_minutes: s.actual_minutes ?? 0,
      }));
      setSessions(base);
      setDirty(false);
    }
  }, [data?.ok, date]);

  const header = useMemo(() => {
    if (!dirty) return "";
    return "（未保存）";
  }, [dirty]);

  if (loading) return <p style={{ padding: 24 }}>Loading...</p>;
  if (error) return <p style={{ padding: 24, color: "red" }}>Error: {error}</p>;
  if (!data?.ok) return <p style={{ padding: 24 }}>No data</p>;

  function updateSession(sessionId: string, patch: Partial<SessionDraft>) {
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, ...patch } : s))
    );
    setDirty(true);
  }

  return (
    <div style={{ padding: 24 }}>
      <button onClick={() => router.back()}>&larr; 戻る</button>

      <h1 style={{ marginTop: 16 }}>
        日報 {date} {header}
      </h1>

      <hr style={{ margin: "16px 0" }} />

      {sessions.map((s) => (
        <div
          key={s.id}
          style={{
            border: "1px solid #ccc",
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <h3 style={{ marginTop: 0 }}>セッション {s.session_no}</h3>

          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span>予定（hours）</span>
              <input
                type="number"
                step="0.1"
                min="0"
                value={minutesToHours(s.planned_minutes)}
                onChange={(e) => {
                  const h = Number(e.target.value);
                  updateSession(s.id, { planned_minutes: hoursToMinutes(h) });
                }}
                style={{ width: 140, padding: 8 }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span>実績（hours）</span>
              <input
                type="number"
                step="0.1"
                min="0"
                value={minutesToHours(s.actual_minutes)}
                onChange={(e) => {
                  const h = Number(e.target.value);
                  updateSession(s.id, { actual_minutes: hoursToMinutes(h) });
                }}
                style={{ width: 140, padding: 8 }}
              />
            </label>

            <div style={{ marginLeft: "auto", opacity: 0.8 }}>
              <div>予定: {s.planned_minutes} min</div>
              <div>実績: {s.actual_minutes} min</div>
            </div>
          </div>

          {/* 後で summary / tasks をここに増やす */}
        </div>
      ))}

      {/* 次ステップで保存APIを繋ぐ場所 */}
      <div style={{ marginTop: 24, opacity: 0.7 }}>
        ※ いまは入力だけ（保存は次のステップで実装）
      </div>
    </div>
  );
}
