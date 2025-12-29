"use client";

import { useEffect, useState } from "react";
import type { DailyReport } from "../../../../shared/types/Attendance";

export function useDailyReports(year: number, month: number) {
  const [data, setData] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // ガード：変な year/month で叩かない
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      setData([]);
      setLoading(false);
      setError(`Invalid params: year=${year}, month=${month}`);
      return;
    }

    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/daily-reports/list?year=${year}&month=${month}`, {
          cache: "no-store",
        });

        const raw = await res.text();
        let json: any = null;
        try {
          json = JSON.parse(raw);
        } catch {
          // JSONじゃない場合はそのまま
        }

        if (!res.ok) {
          throw new Error(json?.error ?? raw ?? "Failed to fetch daily reports");
        }

        if (!cancelled) {
          setData(json as DailyReport[]);
        }
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
  }, [year, month]);

  return { data, loading, error };
}
