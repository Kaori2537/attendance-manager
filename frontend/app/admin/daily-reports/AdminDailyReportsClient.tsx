"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MessageSquareIcon,
  CheckIcon,
  AlertCircleIcon,
  EyeIcon,
  UserIcon,
  ClockIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type Task = {
  id: string;
  session_id: string;
  kind: "planned" | "actual";
  title: string;
  minutes: number;
  sort_order: number;
};

type Session = {
  id: string;
  daily_report_id: string;
  session_no: number;
  summary: string;
  troubles: string;
  announcements: string;
  tasks: Task[];
  clock_in: string | null;
  clock_out: string | null;
};

type Report = {
  id: string;
  userId: string;
  reportDate: string;
  sessionCount: number;
  clockIn: string | null;
  clockOut: string | null;
  totalWorkMinutes: number;
  memo: string;
  trouble: string;
  actualTasks: Task[];
  totalActualMinutes: number;
  sessions: Session[];
};

type UserWithReports = User & {
  reports: Report[];
};

type Props = {
  year: number;
  month: number;
  users: User[];
  usersWithReports: UserWithReports[];
  filterUserId: string;
  filterDate: string;
  viewMode: "day" | "month";
};

function formatTime(isoString: string | null): string {
  if (!isoString) return "--:--";
  const d = new Date(isoString);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatMinutesToHours(minutes: number): string {
  const h = minutes / 60;
  return `${h.toFixed(1)}h`;
}

function getDayOfWeek(dateStr: string): string {
  const d = new Date(dateStr);
  return format(d, "EEEE", { locale: ja }).replace("曜日", "");
}

export default function AdminDailyReportsClient({
  year,
  month,
  users,
  usersWithReports,
  filterUserId,
  filterDate,
  viewMode,
}: Props) {
  const router = useRouter();
  const [calendarOpen, setCalendarOpen] = useState(false);

  // 現在選択されている日付（デフォルトは今日）
  const currentDate = filterDate ? new Date(filterDate) : new Date();
  const [calendarMonth, setCalendarMonth] = useState<Date>(currentDate);

  // filterDateが変わったらカレンダーの表示月も更新
  useEffect(() => {
    if (filterDate) {
      setCalendarMonth(new Date(filterDate));
    }
  }, [filterDate]);

  // 日モード: 前日
  const handlePrevDay = () => {
    const prev = new Date(currentDate);
    prev.setDate(prev.getDate() - 1);
    const params = new URLSearchParams();
    params.set("year", String(prev.getFullYear()));
    params.set("month", String(prev.getMonth() + 1));
    params.set("date", format(prev, "yyyy-MM-dd"));
    if (filterUserId) params.set("userId", filterUserId);
    router.push(`/admin/daily-reports?${params.toString()}`);
  };

  // 日モード: 翌日
  const handleNextDay = () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 1);
    const params = new URLSearchParams();
    params.set("year", String(next.getFullYear()));
    params.set("month", String(next.getMonth() + 1));
    params.set("date", format(next, "yyyy-MM-dd"));
    if (filterUserId) params.set("userId", filterUserId);
    router.push(`/admin/daily-reports?${params.toString()}`);
  };

  // 月モード: 前月
  const handlePrevMonth = () => {
    const prev = new Date(year, month - 2, 1);
    const params = new URLSearchParams();
    params.set("year", String(prev.getFullYear()));
    params.set("month", String(prev.getMonth() + 1));
    params.set("view", "month");
    if (filterUserId) params.set("userId", filterUserId);
    router.push(`/admin/daily-reports?${params.toString()}`);
  };

  // 月モード: 翌月
  const handleNextMonth = () => {
    const next = new Date(year, month, 1);
    const params = new URLSearchParams();
    params.set("year", String(next.getFullYear()));
    params.set("month", String(next.getMonth() + 1));
    params.set("view", "month");
    if (filterUserId) params.set("userId", filterUserId);
    router.push(`/admin/daily-reports?${params.toString()}`);
  };

  // 表示モード切替
  const handleViewModeChange = (mode: "day" | "month") => {
    const params = new URLSearchParams();
    params.set("year", String(year));
    params.set("month", String(month));
    if (mode === "day") {
      // 日モードに切り替え時は今日の日付を設定
      const now = new Date();
      params.set("date", format(now, "yyyy-MM-dd"));
    } else {
      params.set("view", "month");
    }
    if (filterUserId) params.set("userId", filterUserId);
    router.push(`/admin/daily-reports?${params.toString()}`);
  };

  const handleUserChange = (value: string) => {
    const params = new URLSearchParams();
    params.set("year", String(year));
    params.set("month", String(month));
    if (value !== "all") params.set("userId", value);
    if (viewMode === "day" && filterDate) {
      params.set("date", filterDate);
    } else if (viewMode === "month") {
      params.set("view", "month");
    }
    router.push(`/admin/daily-reports?${params.toString()}`);
  };

  const handleDateSelect = (date: Date | undefined) => {
    setCalendarOpen(false);
    if (!date) return;

    const params = new URLSearchParams();
    params.set("year", String(date.getFullYear()));
    params.set("month", String(date.getMonth() + 1));
    params.set("date", format(date, "yyyy-MM-dd"));
    if (filterUserId) params.set("userId", filterUserId);
    router.push(`/admin/daily-reports?${params.toString()}`);
  };

  // 日付フィルタを適用し、日報がある人のみ表示
  const filteredUsersWithReports = usersWithReports
    .map((user) => ({
      ...user,
      reports: viewMode === "day" && filterDate
        ? user.reports.filter((r) => r.reportDate === filterDate)
        : user.reports,
    }))
    .filter((user) => user.reports.length > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <h2 className="text-xl font-semibold">日報履歴</h2>
      <p className="text-muted-foreground">カレンダーから日付を選択して詳細を表示</p>

      {/* Filters */}
      <div className="flex items-center justify-between rounded-xl border p-4">
        <div className="flex items-center gap-4">
          {/* Previous */}
          <Button
            variant="outline"
            size="icon"
            onClick={viewMode === "day" ? handlePrevDay : handlePrevMonth}
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>

          {viewMode === "day" ? (
            /* Calendar Popover for Day Mode */
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="min-w-[180px] justify-start gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {format(currentDate, "yyyy年M月d日", { locale: ja })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={currentDate}
                  onSelect={handleDateSelect}
                  month={calendarMonth}
                  onMonthChange={setCalendarMonth}
                />
              </PopoverContent>
            </Popover>
          ) : (
            /* Month Display for Month Mode */
            <Button variant="outline" className="min-w-[140px] justify-start gap-2">
              <CalendarIcon className="h-4 w-4" />
              {year}年{month}月
            </Button>
          )}

          {/* Next */}
          <Button
            variant="outline"
            size="icon"
            onClick={viewMode === "day" ? handleNextDay : handleNextMonth}
          >
            <ChevronRightIcon className="h-4 w-4" />
          </Button>

          {/* Day/Month Toggle */}
          <div className="flex rounded-lg bg-muted p-1">
            <button
              onClick={() => handleViewModeChange("day")}
              className={`px-4 py-1.5 text-sm font-medium transition-colors rounded-md ${
                viewMode === "day"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-foreground hover:bg-background/50"
              }`}
            >
              日ごと
            </button>
            <button
              onClick={() => handleViewModeChange("month")}
              className={`px-4 py-1.5 text-sm font-medium transition-colors rounded-md ${
                viewMode === "month"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-foreground hover:bg-background/50"
              }`}
            >
              月ごと
            </button>
          </div>
        </div>

        {/* User Filter */}
        <Select value={filterUserId || "all"} onValueChange={handleUserChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="全ユーザー" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全ユーザー</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Users and Reports */}
      <div className="space-y-8">
        {filteredUsersWithReports.map((user) => (
          <div key={user.id} className="space-y-4">
            {/* User Header */}
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarFallback>
                  <UserIcon className="h-6 w-6" />
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">{user.name}</div>
                <div className="text-sm text-muted-foreground">{user.email}</div>
              </div>
            </div>

            {/* Reports */}
            <div className="space-y-4">
              {user.reports.map((report) => (
                <ReportCard key={report.id} report={report} userName={user.name} />
              ))}
            </div>
          </div>
        ))}

        {filteredUsersWithReports.length === 0 && (
          <div className="rounded-xl border p-12 text-center text-muted-foreground">
            この期間に日報を投稿したユーザーはいません
          </div>
        )}
      </div>
    </div>
  );
}

function ReportCard({ report, userName }: { report: Report; userName: string }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const dayOfWeek = getDayOfWeek(report.reportDate);

  // 内容があるセッションのみ表示
  const activeSessions = report.sessions.filter(
    (s) => s.summary || s.troubles || s.tasks.some((t) => t.kind === "actual")
  );

  return (
    <>
      <div className="rounded-xl border bg-card">
        <div className="flex items-start gap-6 p-6">
          {/* Left: Date Info */}
          <div className="min-w-[140px] space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarIcon className="h-4 w-4" />
              {report.reportDate}
            </div>
            <div className="text-sm text-muted-foreground">
              {dayOfWeek}曜日・{report.sessionCount}セッション
            </div>
          </div>

          {/* Right: Content - セッションごとに表示 */}
          <div className="flex-1">
            {activeSessions.map((session, sessionIndex) => (
              <SessionSection
                key={session.id}
                session={session}
                isLast={sessionIndex === activeSessions.length - 1}
              />
            ))}
          </div>

          {/* Action */}
          <div>
            <Button variant="ghost" size="icon" onClick={() => setDialogOpen(true)}>
              <EyeIcon className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Detail Dialog */}
      <ReportDetailDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        report={report}
        userName={userName}
        sessions={activeSessions}
      />
    </>
  );
}

function ReportDetailDialog({
  open,
  onClose,
  report,
  userName,
  sessions,
}: {
  open: boolean;
  onClose: () => void;
  report: Report;
  userName: string;
  sessions: Session[];
}) {
  const dayOfWeek = getDayOfWeek(report.reportDate);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle>{userName}さんの日報</DialogTitle>
          <DialogDescription>
            {report.reportDate}（{dayOfWeek}曜日）・{report.sessionCount}セッション
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {sessions.map((session, idx) => (
            <DialogSessionSection key={session.id} session={session} isLast={idx === sessions.length - 1} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DialogSessionSection({ session, isLast }: { session: Session; isLast: boolean }) {
  const plannedTasks = session.tasks.filter((t) => t.kind === "planned");
  const actualTasks = session.tasks.filter((t) => t.kind === "actual");

  // セッションの出退勤時間を表示
  const sessionTimeLabel = session.clock_in
    ? `${formatTime(session.clock_in)}～${formatTime(session.clock_out)}`
    : null;

  // セッションの勤務時間を計算
  let sessionWorkMinutes = 0;
  if (session.clock_in && session.clock_out) {
    const ms = new Date(session.clock_out).getTime() - new Date(session.clock_in).getTime();
    sessionWorkMinutes = Math.max(0, Math.round(ms / 60000));
  }

  return (
    <div className={`space-y-4 ${!isLast ? "border-b pb-6" : ""}`}>
      {/* Session Header */}
      <div className="flex items-center gap-2">
        <ClockIcon className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">セッション{session.session_no}</span>
        {sessionTimeLabel && (
          <span className="text-sm text-muted-foreground">（{sessionTimeLabel}）</span>
        )}
        <span className="text-sm text-muted-foreground">{formatMinutesToHours(sessionWorkMinutes)}</span>
      </div>

      {/* Planned Tasks - 今日やること */}
      {plannedTasks.length > 0 && (
        <div>
          <Label className="text-base">今日やること</Label>
          <div className="space-y-2 mt-3">
            {plannedTasks.map((task) => (
              <div key={task.id} className="flex gap-2 items-center">
                <div className="flex-1 px-3 py-2 bg-muted rounded-md text-sm">
                  {task.title}
                </div>
                <div className="w-24 px-3 py-2 bg-muted rounded-md text-sm text-center">
                  {formatMinutesToHours(task.minutes)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actual Tasks - 今日やったこと */}
      {actualTasks.length > 0 && (
        <div>
          <Label className="text-base">今日やったこと</Label>
          <div className="space-y-2 mt-3">
            {actualTasks.map((task) => (
              <div key={task.id} className="flex gap-2 items-center">
                <div className="flex-1 px-3 py-2 bg-muted rounded-md text-sm">
                  {task.title}
                </div>
                <div className="w-24 px-3 py-2 bg-muted rounded-md text-sm text-center">
                  {formatMinutesToHours(task.minutes)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary - 本日のまとめ */}
      {session.summary && (
        <div>
          <Label className="text-base">本日のまとめ（感想・気づき）</Label>
          <div className="mt-2 px-3 py-3 bg-muted rounded-md text-sm whitespace-pre-wrap">
            {session.summary}
          </div>
        </div>
      )}

      {/* Troubles - 困っていること */}
      {session.troubles && (
        <div>
          <Label className="text-base text-red-500">困っていること・相談したいこと</Label>
          <div className="mt-2 px-3 py-3 bg-red-50 border border-red-200 rounded-md text-sm whitespace-pre-wrap">
            {session.troubles}
          </div>
        </div>
      )}

      {/* Announcements - 連絡事項 */}
      {session.announcements && (
        <div>
          <Label className="text-base">連絡事項</Label>
          <div className="mt-2 px-3 py-3 bg-muted rounded-md text-sm whitespace-pre-wrap">
            {session.announcements}
          </div>
        </div>
      )}
    </div>
  );
}

function SessionSection({ session, isLast }: { session: Session; isLast: boolean }) {
  const actualTasks = session.tasks.filter((t) => t.kind === "actual");
  const totalMinutes = actualTasks.reduce((sum, t) => sum + t.minutes, 0);

  // セッションの出退勤時間を表示
  const sessionTimeLabel = session.clock_in
    ? `${formatTime(session.clock_in)}～${formatTime(session.clock_out)}`
    : null;

  // セッションの勤務時間を計算
  let sessionWorkMinutes = 0;
  if (session.clock_in && session.clock_out) {
    const ms = new Date(session.clock_out).getTime() - new Date(session.clock_in).getTime();
    sessionWorkMinutes = Math.max(0, Math.round(ms / 60000));
  }

  return (
    <div className={`${!isLast ? "border-b pb-4 mb-4" : ""}`}>
      <div className="space-y-3">
        {/* Memo */}
        {session.summary && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <MessageSquareIcon className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium text-blue-500">本日のまとめ</span>
              <span className="text-xs text-muted-foreground">セッション{session.session_no}</span>
              {sessionTimeLabel && <span className="text-xs text-muted-foreground">（{sessionTimeLabel}）</span>}
              {sessionWorkMinutes > 0 && <span className="text-xs text-muted-foreground">{formatMinutesToHours(sessionWorkMinutes)}</span>}
            </div>
            <p className="text-sm pl-6">
              {session.summary}
            </p>
          </div>
        )}

        {/* Actual Tasks */}
        {actualTasks.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CheckIcon className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-green-500">
                今日の実績（{formatMinutesToHours(totalMinutes)}）
              </span>
            </div>
            <ul className="space-y-1 pl-6">
              {actualTasks.map((task) => (
                <li
                  key={task.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground">•</span>
                    {task.title}
                  </span>
                  <span className="text-muted-foreground">
                    {formatMinutesToHours(task.minutes)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Trouble */}
        {session.troubles && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <AlertCircleIcon className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium text-red-500">
                困っていること
              </span>
            </div>
            <p className="text-sm pl-6">{session.troubles}</p>
          </div>
        )}
      </div>
    </div>
  );
}
