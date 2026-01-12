"use client";

import { useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { DailyReportsCalendarPanel } from "./components/DailyReportsCalendarPanel";
import { DailyReportSummaryCard } from "./components/DailyReportSummaryCard";
import { useDailyReportsCalendar } from "./hooks/useDailyReportsCalendar";
import { useDailyReportByDate } from "./hooks/useDailyReportByDate";

function toYmd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseYmd(ymd: string): Date | null {
  const match = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d));
}

export default function Page() {
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");
  const initializedRef = useRef(false);

  const {
    currentMonth,
    setCurrentMonth,
    selectedDate,
    setSelectedDate,
    dailyReportDates,
  } = useDailyReportsCalendar();

  // URLのdateパラメータからカレンダーの日付を設定（初回のみ）
  useEffect(() => {
    if (initializedRef.current) return;
    if (dateParam) {
      const parsedDate = parseYmd(dateParam);
      if (parsedDate) {
        initializedRef.current = true;
        setSelectedDate(parsedDate);
        // カレンダーの月も合わせる
        setCurrentMonth(new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1));
      }
    }
  }, [dateParam, setSelectedDate, setCurrentMonth]);

  const selectedYmd = useMemo(
    () => (selectedDate ? toYmd(selectedDate) : null),
    [selectedDate]
  );

  const { data, loading, error } = useDailyReportByDate(selectedYmd);

  const sessions = data?.ok ? (data.sessions ?? []) : [];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">日報履歴</h2>
      <p className="text-muted-foreground">カレンダーから日付を選択して詳細を表示</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        <DailyReportsCalendarPanel
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          dailyReportDates={dailyReportDates}
        />

        <div className="lg:col-span-2 h-full">
          {!selectedYmd ? (
            <div className="rounded-xl border p-6 text-sm text-muted-foreground h-full flex items-center justify-center">
              左のカレンダーから日付を選んでください。
            </div>
          ) : loading ? (
            <div className="rounded-xl border p-6 text-sm text-muted-foreground h-full flex items-center justify-center">
              読み込み中...
            </div>
          ) : error ? (
            <div className="rounded-xl border p-6 text-sm text-destructive h-full flex items-center justify-center">
              読み込みに失敗しました: {error}
            </div>
          ) : (
            <DailyReportSummaryCard 
              selectedDate={selectedDate!} 
              sessions={sessions}
              selectedYmd={selectedYmd}
            />
          )}
        </div>
      </div>
    </div>
  );
}
