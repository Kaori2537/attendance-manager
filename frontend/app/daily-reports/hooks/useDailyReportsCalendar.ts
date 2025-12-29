"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type DailyReportsListItem = {
  date: string; // "YYYY-MM-DD"
};

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYMD(ymd: string): Date | null {
  // "YYYY-MM-DD" を Date に（ローカル日付として扱う）
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function useDailyReportsCalendar() {
  const router = useRouter();

  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const [rawDates, setRawDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // string[] -> Date[]
  const dailyReportDates: Date[] = useMemo(() => {
    return rawDates
      .map(parseYMD)
      .filter((d): d is Date => d !== null);
  }, [rawDates]);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchMonthlyDates() {
      setLoading(true);
      setError(null);

      try {
        const year = String(currentMonth.getFullYear());
        const month = String(currentMonth.getMonth() + 1);

        // ここはあなたの実装に合わせて /api/daily-reports/list を叩く
        const res = await fetch(`/api/daily-reports/list?year=${year}&month=${month}`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          // 401のとき等
          const text = await res.text().catch(() => "");
          throw new Error(text || `Request failed: ${res.status}`);
        }

        const data = (await res.json()) as DailyReportsListItem[] | { dates?: string[] };

        // 返却形式が [{date:"..."}] の場合と、{dates:["..."]} の場合どっちでも拾う
        const dates =
          Array.isArray(data)
            ? data.map((x) => x.date).filter(Boolean)
            : Array.isArray(data?.dates)
              ? data.dates
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

  // 日付選択時：その日の日報ページへ遷移（必要なければこの処理は消してOK）
  const handleSelectDate = (d: Date | undefined) => {
    setSelectedDate(d);
    if (d) {
      router.push(`/daily-reports/${toYMD(d)}`);
    }
  };

  return {
    currentMonth,
    selectedDate,
    dailyReportDates, // ✅ Date[]
    setCurrentMonth,
    setSelectedDate: handleSelectDate, // page.tsx 側はそのまま渡せる
    loading,
    error,
  };
}
