"use client";

import { useEffect, useState } from "react";

export function useDailyReportByDate(date: string | null) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // ✅ 未選択なら状態をリセットして終了
    if (!date) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    // ✅ ここで string に確定させる（TS対策）
    const ymd = date;

    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/daily-reports/get-by-date?date=${encodeURIComponent(ymd)}`,
          { cache: "no-store" }
        );

        const raw = await res.text();
        let json: any = null;
        try {
          json = JSON.parse(raw);
        } catch {}

        if (!res.ok) {
          throw new Error(json?.error ?? raw ?? "Failed to fetch daily report");
        }

        if (!cancelled) setData(json);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [date]);

  return { data, loading, error };
}
