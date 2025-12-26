"use client";

import { useEffect, useState } from "react";
import type { DailyReport } from "../../../../shared/types/Attendance";

export function useDailyReports(year: number, month: number) {
  const [data, setData] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/daily-reports/list?year=${year}&month=${month}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          throw new Error(e.error ?? "Failed to fetch daily reports");
        }

        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [year, month]);

  return { data, loading, error };
}
