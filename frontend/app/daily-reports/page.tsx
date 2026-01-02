"use client";

import { useMemo } from "react";
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

export default function Page() {
  const {
    currentMonth,
    setCurrentMonth,
    selectedDate,
    setSelectedDate,
    dailyReportDates,
  } = useDailyReportsCalendar();

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
