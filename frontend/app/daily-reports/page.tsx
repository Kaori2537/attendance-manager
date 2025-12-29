"use client";

import { useRouter } from "next/navigation";
import { DailyReportsCalendarPanel } from "@/app/daily-reports/components/DailyReportsCalendarPanel";
import { useDailyReportsCalendar } from "@/app/daily-reports/hooks/useDailyReportsCalendar";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

function formatDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function DailyReportsPage() {
  const router = useRouter();

  const {
    currentMonth,
    selectedDate,
    dailyReportDates,
    setCurrentMonth,
    setSelectedDate,
  } = useDailyReportsCalendar();

  const handleSelectDate = (d: Date | undefined) => {
    setSelectedDate(d);
    if (d) router.push(`/daily-reports/${formatDate(d)}`);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">日報履歴</h2>
      <p className="text-muted-foreground">
        カレンダーから日付を選択して詳細を表示
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        <DailyReportsCalendarPanel
          selectedDate={selectedDate}
          currentMonth={currentMonth}
          dailyReportDates={dailyReportDates}
          onSelectDate={handleSelectDate}
          onMonthChange={setCurrentMonth}
        />

        <div className="lg:col-span-2 h-full">
          {/* ✅ 勤怠履歴の DayDetailCard と同じ “Card構造” に揃える */}
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle>選択日の概要</CardTitle>
              <CardDescription>
                左のカレンダーから日付を選んでください。
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 flex-1">
              {/* ここは将来、日報のサマリーなどを表示 */}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
