"use client";

import { useEffect, useMemo, useState } from "react";

type DailyReportsListItem = {
  reportDate: string; // "YYYY-MM-DD"
};

function parseYMD(ymd: string): Date | null {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function useDailyReportsCalendar() {
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const [rawDates, setRawDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // string[] -> Date[]
  const dailyReportDates: Date[] = useMemo(() => {
    return rawDates.map(parseYMD).filter((d): d is Date => d !== null);
  }, [rawDates]);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchMonthlyDates() {
      setLoading(true);
      setError(null);

      try {
        const year = String(currentMonth.getFullYear());
        const month = String(currentMonth.getMonth() + 1);

        const res = await fetch(`/api/daily-reports/list?year=${year}&month=${month}`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `Request failed: ${res.status}`);
        }

        const data = (await res.json()) as DailyReportsListItem[] | { dates?: string[] };

        const dates = Array.isArray(data)
          ? data.map((x) => x.reportDate).filter(Boolean)
          : Array.isArray((data as any)?.dates)
            ? (data as any).dates
            : [];

        setRawDates(dates);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setError(e?.message ?? "Failed to load daily reports");
        setRawDates([]);
      } finally {
        setLoading(false);
      }
    }

    fetchMonthlyDates();
    return () => controller.abort();
  }, [currentMonth]);

  // ✅ 日付選択時：遷移しない（右側の概要表示用に state 更新だけ）
  const handleSelectDate = (d: Date | undefined) => {
    setSelectedDate(d);
  };

  return {
    currentMonth,
    selectedDate,
    dailyReportDates,
    setCurrentMonth,
    setSelectedDate: handleSelectDate, // page.tsx 側はそのまま渡せる
    loading,
    error,
  };
}
