"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  MessageSquareIcon,
  CheckIcon,
  AlertCircleIcon,
  EyeIcon,
  UserIcon,
  ClockIcon,
  SendIcon,
  PencilIcon,
  TrashIcon,
  XIcon,
  CheckIcon as CheckIconLucide,
  SmilePlusIcon,
  MessageCircleIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { Input } from "@/components/ui/input";

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
  apiToken: string;
};

// 時系列ビュー用: セッション + ユーザー情報をフラット化
type FlatSession = Session & {
  userName: string;
  userEmail: string;
  reportDate: string;
  reportId: string;
  sessionCount: number;
};

// 固定の6種類の絵文字（仕様通り）
const EMOJIS = [
  { key: "+1", label: "👍" },
  { key: "tada", label: "🎉" },
  { key: "clap", label: "👏" },
  { key: "white_check_mark", label: "✅" },
  { key: "pray", label: "🙏" },
  { key: "eyes", label: "👀" },
] as const;

type Reaction = {
  id: string;
  emoji: string;
  kind: "clock_in" | "clock_out";
  source: string;
  created_at: string;
};

type Comment = {
  id: string;
  daily_report_session_id: string;
  user_id: string | null;
  slack_user_id: string | null;
  text: string;
  source: string;
  created_at: string;
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
  apiToken,
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
      // 日モードでは「ユーザーごと」が使えないので、選択中なら「全ユーザー」にリセット
      if (filterUserId && filterUserId !== "by-user") {
        params.set("userId", filterUserId);
      }
    } else {
      params.set("view", "month");
      if (filterUserId) params.set("userId", filterUserId);
    }
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

  // 日付フィルタを適用し、日報がある人のみ表示（ユーザー別ビュー用）
  const filteredUsersWithReports = usersWithReports
    .map((user) => ({
      ...user,
      reports: viewMode === "day" && filterDate
        ? user.reports.filter((r) => r.reportDate === filterDate)
        : user.reports,
    }))
    .filter((user) => user.reports.length > 0);

  // 時系列ビュー用: セッション単位でフラット化して出勤時間順にソート
  const timelineSessions: FlatSession[] = usersWithReports
    .flatMap((user) =>
      user.reports
        .filter((r) => {
          // 日モードの場合は選択日でフィルタ
          if (viewMode === "day" && filterDate) {
            return r.reportDate === filterDate;
          }
          return true;
        })
        .flatMap((report) =>
          report.sessions
            .filter((s) => s.summary || s.troubles || s.tasks.some((t) => t.kind === "actual"))
            .map((session) => ({
              ...session,
              userName: user.name,
              userEmail: user.email,
              reportDate: report.reportDate,
              reportId: report.id,
              sessionCount: report.sessionCount,
            }))
        )
    )
    .sort((a, b) => {
      // 日付の新しい順、同日なら出勤時間の早い順
      const dateCompare = b.reportDate.localeCompare(a.reportDate);
      if (dateCompare !== 0) return dateCompare;
      if (a.clock_in && b.clock_in) {
        return new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime();
      }
      return 0;
    });

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
                <Button variant="outline" className="min-w-[220px] justify-start gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {format(currentDate, "yyyy年M月d日（E）", { locale: ja })}
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

        {/* User Filter - 日ごとの場合は「ユーザーごと」を非表示 */}
        <Select value={filterUserId || "all"} onValueChange={handleUserChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="全ユーザー" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全ユーザー</SelectItem>
            {viewMode === "month" && (
              <SelectItem value="by-user">ユーザーごと</SelectItem>
            )}
            <div className="h-px bg-border my-1" />
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content based on filter selection */}
      {filterUserId === "by-user" ? (
        /* ユーザーごとビュー: 全ユーザーをグループ化して表示 */
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
                  <ReportCard key={report.id} report={report} userName={user.name} apiToken={apiToken} showDate={viewMode === "month"} />
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
      ) : !filterUserId || filterUserId === "all" ? (
        /* 時系列ビュー: セッション単位で出勤時間順に表示 */
        <div className="space-y-4">
          {timelineSessions.map((session) => (
            <TimelineSessionCard
              key={session.id}
              session={session}
              apiToken={apiToken}
              showDate={viewMode === "month"}
            />
          ))}

          {timelineSessions.length === 0 && (
            <div className="rounded-xl border p-12 text-center text-muted-foreground">
              この期間に日報を投稿したユーザーはいません
            </div>
          )}
        </div>
      ) : viewMode === "day" ? (
        /* 特定ユーザー・日ごとビュー: セッション単位で表示（全ユーザー時系列と同じUI） */
        (() => {
          // 選択ユーザーのセッションをフラット化
          const userSessions: FlatSession[] = filteredUsersWithReports
            .flatMap((user) =>
              user.reports
                .filter((r) => !filterDate || r.reportDate === filterDate)
                .flatMap((report) =>
                  report.sessions
                    .filter((s) => s.summary || s.troubles || s.tasks.some((t) => t.kind === "actual"))
                    .map((session) => ({
                      ...session,
                      userName: user.name,
                      userEmail: user.email,
                      reportDate: report.reportDate,
                      reportId: report.id,
                      sessionCount: report.sessionCount,
                    }))
                )
            )
            .sort((a, b) => {
              // 出勤時間の早い順
              if (a.clock_in && b.clock_in) {
                return new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime();
              }
              return 0;
            });

          return (
            <div className="space-y-4">
              {userSessions.map((session) => (
                <TimelineSessionCard
                  key={session.id}
                  session={session}
                  apiToken={apiToken}
                  showDate={false}
                />
              ))}

              {userSessions.length === 0 && (
                <div className="rounded-xl border p-12 text-center text-muted-foreground">
                  この期間に日報を投稿したユーザーはいません
                </div>
              )}
            </div>
          );
        })()
      ) : (
        /* 特定ユーザー・月ごとビュー: ユーザーごとにまとめて表示 */
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
                  <ReportCard key={report.id} report={report} userName={user.name} apiToken={apiToken} showDate={true} />
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
      )}
    </div>
  );
}

function ReportCard({
  report,
  userName,
  apiToken,
  showUserName = false,
  showDate = false,
}: {
  report: Report;
  userName: string;
  apiToken: string;
  showUserName?: boolean;
  showDate?: boolean;
}) {
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
          {/* Left: Date/User Info */}
          <div className="min-w-[140px] space-y-1">
            {showUserName && (
              <div className="flex items-center gap-2 text-sm font-medium">
                <UserIcon className="h-4 w-4" />
                {userName}
              </div>
            )}
            {(showDate || !showUserName) && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarIcon className="h-4 w-4" />
                {report.reportDate}
              </div>
            )}
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
                apiToken={apiToken}
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
        apiToken={apiToken}
      />
    </>
  );
}

// 時系列ビュー用: セッション単位のカード
function TimelineSessionCard({
  session,
  apiToken,
  showDate = false,
}: {
  session: FlatSession;
  apiToken: string;
  showDate?: boolean;
}) {
  const plannedTasks = session.tasks.filter((t) => t.kind === "planned");
  const actualTasks = session.tasks.filter((t) => t.kind === "actual");
  const totalMinutes = actualTasks.reduce((sum, t) => sum + t.minutes, 0);
  const totalPlannedMinutes = plannedTasks.reduce((sum, t) => sum + t.minutes, 0);

  // セッションが1回だけかどうか
  const isSingleSession = session.sessionCount === 1;

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

  const dayOfWeek = getDayOfWeek(session.reportDate);

  // リアクション・コメント機能
  const interactions = useSessionInteractions(session.id, apiToken);

  // 詳細ダイアログ
  const [dialogOpen, setDialogOpen] = useState(false);
  // 折りたたみ状態（セッション1回の場合のみ使用）
  const [isExpanded, setIsExpanded] = useState(false);

  // 折りたたみ内に表示するコンテンツがあるか
  const hasCollapsibleContent = actualTasks.length > 0 || session.summary || session.troubles || session.announcements;

  return (
    <>
    <div className="rounded-xl border bg-card p-6">
      {/* Header: ユーザー名 + セッション情報を横並び */}
      <div className="flex items-start gap-8">
        {/* 左: ユーザー名（固定幅で縦並びを揃える）+ 月ごと時は日付も表示 */}
        <div className="shrink-0 w-[120px]">
          <div className="flex items-center gap-2 text-sm font-medium h-8">
            <UserIcon className="h-4 w-4 shrink-0" />
            <span className="truncate">{session.userName}</span>
          </div>
          {showDate && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <CalendarIcon className="h-3 w-3" />
              {session.reportDate}（{dayOfWeek}）
            </div>
          )}
        </div>

        {/* 右: セッション情報 + コンテンツ */}
        <div className="flex-1 min-w-0">
          {/* セッションヘッダー */}
          <div className="flex items-center gap-3 mb-3 h-8">
            {/* セッションが1回の場合は「セッション1」を非表示、時間のみ表示 */}
            {isSingleSession ? (
              <span className="text-sm text-muted-foreground">
                {sessionTimeLabel ?? "--:--"}{sessionWorkMinutes > 0 && `（${formatMinutesToHours(sessionWorkMinutes)}）`}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">
                セッション{session.session_no}（{sessionTimeLabel ?? "--:--"}）{sessionWorkMinutes > 0 && `（${formatMinutesToHours(sessionWorkMinutes)}）`}
              </span>
            )}
            <div className="flex-1" />
            <ReactionCommentButtonsInline {...interactions} />
            {!isSingleSession && (
              <Button variant="ghost" size="icon" onClick={() => setDialogOpen(true)}>
                <EyeIcon className="h-5 w-5" />
              </Button>
            )}
          </div>

          {/* Content */}
          <div className="space-y-3">
            {/* Planned Tasks - 常に表示 */}
            {plannedTasks.length > 0 && (
              <div className="space-y-1">
                <span className="text-sm font-medium">
                  今日の予定（{formatMinutesToHours(totalPlannedMinutes)}）
                </span>
                <ul className="space-y-1 pl-1">
                  {plannedTasks.map((task) => (
                    <li key={task.id} className="flex items-center justify-between text-sm">
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

            {/* 折りたたみトグル */}
            {hasCollapsibleContent && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDownIcon className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                {isExpanded ? "折りたたむ" : "詳細を見る"}
              </button>
            )}

            {/* 折りたたみ内容 */}
            {isExpanded && (
              <div className="space-y-3 pt-2 border-t">
                {/* Actual Tasks */}
                {actualTasks.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-sm font-medium">
                      今日の実績（{formatMinutesToHours(totalMinutes)}）
                    </span>
                    <ul className="space-y-1 pl-1">
                      {actualTasks.map((task) => (
                        <li key={task.id} className="flex items-center justify-between text-sm">
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

                {/* Memo */}
                {session.summary && (
                  <div className="space-y-1">
                    <span className="text-sm font-medium">本日のまとめ</span>
                    <p className="text-sm pl-1">{session.summary}</p>
                  </div>
                )}

                {/* Trouble */}
                {session.troubles && (
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-red-500">困っていること</span>
                    <p className="text-sm pl-1 text-red-600">{session.troubles}</p>
                  </div>
                )}

                {/* Announcements */}
                {session.announcements && (
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-blue-500">周知事項</span>
                    <p className="text-sm pl-1 text-blue-600">{session.announcements}</p>
                  </div>
                )}
              </div>
            )}

            {/* Comments */}
            {interactions.comments.length > 0 && (
              <div className="space-y-2">
                {interactions.comments.map((c) => (
                  <div key={c.id} className="bg-muted/50 rounded-md px-3 py-2 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(c.created_at), "M/d HH:mm")}
                          {c.source === "slack" && " (Slack)"}
                        </p>
                        <p className="mt-1">{c.text}</p>
                      </div>
                      {c.source !== "slack" && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => interactions.handleStartEdit(c)}
                            className="p-1 rounded hover:bg-muted transition-colors"
                            title="編集"
                          >
                            <PencilIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => interactions.setDeleteConfirmId(c.id)}
                            className="p-1 rounded hover:bg-muted transition-colors"
                            title="削除"
                          >
                            <TrashIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* コメント入力欄（コンテンツエリア内に表示） */}
            {interactions.showCommentInput && (
              <div className="flex items-center gap-2 pt-2 border-t">
                <Input
                  placeholder="コメントを入力..."
                  value={interactions.newComment}
                  onChange={(e) => interactions.setNewComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      interactions.handleSendComment();
                      interactions.setShowCommentInput(false);
                    }
                    if (e.key === "Escape") {
                      interactions.setShowCommentInput(false);
                      interactions.setNewComment("");
                    }
                  }}
                  disabled={interactions.sendingComment}
                  className="flex-1"
                  autoFocus
                />
                <Button
                  size="icon"
                  onClick={() => {
                    interactions.handleSendComment();
                    interactions.setShowCommentInput(false);
                  }}
                  disabled={!interactions.newComment.trim() || interactions.sendingComment}
                >
                  <SendIcon className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    interactions.setShowCommentInput(false);
                    interactions.setNewComment("");
                  }}
                >
                  <XIcon className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* Session Detail Dialog */}
    <SessionDetailDialog
      open={dialogOpen}
      onClose={() => setDialogOpen(false)}
      session={session}
      apiToken={apiToken}
    />

    {/* 削除確認ダイアログ */}
    <Dialog open={!!interactions.deleteConfirmId} onOpenChange={(open) => !open && interactions.setDeleteConfirmId(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>コメントを削除しますか？</DialogTitle>
          <DialogDescription>この操作は取り消せません。</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => interactions.setDeleteConfirmId(null)}>キャンセル</Button>
          <Button variant="destructive" onClick={() => interactions.deleteConfirmId && interactions.handleDeleteComment(interactions.deleteConfirmId)}>削除</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* 編集ダイアログ */}
    <Dialog open={interactions.editingCommentId !== null} onOpenChange={(open) => !open && interactions.handleCancelEdit()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>コメントを編集</DialogTitle>
        </DialogHeader>
        <Input
          value={interactions.editingText}
          onChange={(e) => interactions.setEditingText(e.target.value)}
          placeholder="コメント"
        />
        <DialogFooter>
          <Button variant="outline" onClick={interactions.handleCancelEdit}>キャンセル</Button>
          <Button onClick={() => interactions.editingCommentId && interactions.handleSaveEdit(interactions.editingCommentId)} disabled={!interactions.editingText.trim()}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

// セッション単体の詳細ダイアログ
function SessionDetailDialog({
  open,
  onClose,
  session,
  apiToken,
}: {
  open: boolean;
  onClose: () => void;
  session: FlatSession;
  apiToken: string;
}) {
  const dayOfWeek = getDayOfWeek(session.reportDate);
  const plannedTasks = session.tasks.filter((t) => t.kind === "planned");
  const actualTasks = session.tasks.filter((t) => t.kind === "actual");

  const sessionTimeLabel = session.clock_in
    ? `${formatTime(session.clock_in)}～${formatTime(session.clock_out)}`
    : null;

  let sessionWorkMinutes = 0;
  if (session.clock_in && session.clock_out) {
    const ms = new Date(session.clock_out).getTime() - new Date(session.clock_in).getTime();
    sessionWorkMinutes = Math.max(0, Math.round(ms / 60000));
  }

  const interactions = useSessionInteractions(session.id, apiToken);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle>{session.userName}さんの日報</DialogTitle>
          <DialogDescription>
            {session.reportDate}（{dayOfWeek}曜日）
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Session Header with Reaction/Comment buttons */}
          <div className="flex items-center gap-2">
            <ClockIcon className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">セッション{session.session_no}</span>
            {sessionTimeLabel && (
              <span className="text-sm text-muted-foreground">（{sessionTimeLabel}）</span>
            )}
            <span className="text-sm text-muted-foreground">{formatMinutesToHours(sessionWorkMinutes)}</span>
            <div className="flex-1" />
            <ReactionCommentButtonsInline {...interactions} />
          </div>

          {/* Planned Tasks */}
          {plannedTasks.length > 0 && (
            <div>
              <Label className="text-base">今日やること</Label>
              <ul className="mt-2 space-y-1 pl-1">
                {plannedTasks.map((task) => (
                  <li key={task.id} className="flex items-center justify-between text-sm">
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

          {/* Actual Tasks */}
          {actualTasks.length > 0 && (
            <div>
              <Label className="text-base">今日の実績</Label>
              <ul className="mt-2 space-y-1 pl-1">
                {actualTasks.map((task) => (
                  <li key={task.id} className="flex items-center justify-between text-sm">
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

          {/* Summary */}
          {session.summary && (
            <div>
              <Label className="text-base">本日のまとめ（感想・気づき）</Label>
              <p className="mt-2 pl-1 text-sm whitespace-pre-wrap">{session.summary}</p>
            </div>
          )}

          {/* Troubles */}
          {session.troubles && (
            <div>
              <Label className="text-base text-red-500">困っていること・相談したいこと</Label>
              <p className="mt-2 pl-1 text-sm whitespace-pre-wrap text-red-600">{session.troubles}</p>
            </div>
          )}

          {/* Announcements */}
          {session.announcements && (
            <div>
              <Label className="text-base">連絡事項</Label>
              <p className="mt-2 pl-1 text-sm whitespace-pre-wrap">{session.announcements}</p>
            </div>
          )}

          {/* Comments */}
          {interactions.comments.length > 0 && (
            <div className="space-y-2">
              {interactions.comments.map((c) => (
                <div key={c.id} className="bg-muted/50 rounded-md px-3 py-2 text-sm">
                  {interactions.editingCommentId === c.id ? (
                    <div className="space-y-2">
                      <Input
                        value={interactions.editingText}
                        onChange={(e) => interactions.setEditingText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            interactions.handleSaveEdit(c.id);
                          }
                          if (e.key === "Escape") {
                            interactions.handleCancelEdit();
                          }
                        }}
                        className="text-sm"
                        autoFocus
                      />
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => interactions.handleSaveEdit(c.id)}
                          disabled={!interactions.editingText.trim()}
                          className="h-7 px-2"
                        >
                          <CheckIconLucide className="h-3 w-3 mr-1" />
                          保存
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={interactions.handleCancelEdit}
                          className="h-7 px-2"
                        >
                          <XIcon className="h-3 w-3 mr-1" />
                          キャンセル
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p>{c.text}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(c.created_at), "M/d HH:mm")}
                          {c.source === "slack" && " (Slack)"}
                        </p>
                      </div>
                      {c.source !== "slack" && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => interactions.handleStartEdit(c)}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="編集"
                          >
                            <PencilIcon className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => interactions.setDeleteConfirmId(c.id)}
                            className="p-1 rounded hover:bg-red-100 text-muted-foreground hover:text-red-600 transition-colors"
                            title="削除"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Comment Input */}
          {interactions.showCommentInput && (
            <div className="flex items-center gap-2">
              <Input
                placeholder="コメントを入力..."
                value={interactions.newComment}
                onChange={(e) => interactions.setNewComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    interactions.handleSendComment();
                    interactions.setShowCommentInput(false);
                  }
                  if (e.key === "Escape") {
                    interactions.setShowCommentInput(false);
                    interactions.setNewComment("");
                  }
                }}
                disabled={interactions.sendingComment}
                className="flex-1"
                autoFocus
              />
              <Button
                size="icon"
                onClick={() => {
                  interactions.handleSendComment();
                  interactions.setShowCommentInput(false);
                }}
                disabled={!interactions.newComment.trim() || interactions.sendingComment}
              >
                <SendIcon className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  interactions.setShowCommentInput(false);
                  interactions.setNewComment("");
                }}
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* 削除確認ダイアログ */}
        <Dialog open={!!interactions.deleteConfirmId} onOpenChange={(open) => !open && interactions.setDeleteConfirmId(null)}>
          <DialogContent className="flex flex-col items-center text-center py-10">
            <TrashIcon className="h-12 w-12 text-red-500 mb-4" />
            <DialogHeader className="text-center">
              <DialogTitle className="text-center">コメントの削除</DialogTitle>
              <DialogDescription className="text-center">このコメントを削除しますか？</DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-6 flex gap-2 justify-center">
              <Button variant="outline" onClick={() => interactions.setDeleteConfirmId(null)}>キャンセル</Button>
              <Button variant="destructive" onClick={() => interactions.deleteConfirmId && interactions.handleDeleteComment(interactions.deleteConfirmId)}>削除</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

function ReportDetailDialog({
  open,
  onClose,
  report,
  userName,
  sessions,
  apiToken,
}: {
  open: boolean;
  onClose: () => void;
  report: Report;
  userName: string;
  sessions: Session[];
  apiToken: string;
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
            <DialogSessionSection key={session.id} session={session} isLast={idx === sessions.length - 1} apiToken={apiToken} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DialogSessionSection({ session, isLast, apiToken }: { session: Session; isLast: boolean; apiToken: string }) {
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

  // リアクション・コメント機能（共通フック使用）
  const interactions = useSessionInteractions(session.id, apiToken);

  return (
    <div className={`space-y-4 ${!isLast ? "border-b pb-6" : ""}`}>
      {/* Session Header with Reaction/Comment buttons */}
      <div className="flex items-center gap-2">
        <ClockIcon className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">セッション{session.session_no}</span>
        {sessionTimeLabel && (
          <span className="text-sm text-muted-foreground">（{sessionTimeLabel}）</span>
        )}
        <span className="text-sm text-muted-foreground">{formatMinutesToHours(sessionWorkMinutes)}</span>
        <div className="flex-1" />
        <ReactionCommentButtonsInline {...interactions} />
      </div>

      {/* Planned Tasks - 今日やること */}
      {plannedTasks.length > 0 && (
        <div>
          <Label className="text-base">今日やること</Label>
          <ul className="mt-2 space-y-1 pl-1">
            {plannedTasks.map((task) => (
              <li key={task.id} className="flex items-center justify-between text-sm">
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

      {/* Actual Tasks - 今日の実績 */}
      {actualTasks.length > 0 && (
        <div>
          <Label className="text-base">今日の実績</Label>
          <ul className="mt-2 space-y-1 pl-1">
            {actualTasks.map((task) => (
              <li key={task.id} className="flex items-center justify-between text-sm">
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

      {/* Summary - 本日のまとめ */}
      {session.summary && (
        <div>
          <Label className="text-base">本日のまとめ（感想・気づき）</Label>
          <p className="mt-2 pl-1 text-sm whitespace-pre-wrap">
            {session.summary}
          </p>
        </div>
      )}

      {/* Troubles - 困っていること */}
      {session.troubles && (
        <div>
          <Label className="text-base text-red-500">困っていること・相談したいこと</Label>
          <p className="mt-2 pl-1 text-sm whitespace-pre-wrap text-red-600">
            {session.troubles}
          </p>
        </div>
      )}

      {/* Announcements - 連絡事項 */}
      {session.announcements && (
        <div>
          <Label className="text-base">連絡事項</Label>
          <p className="mt-2 pl-1 text-sm whitespace-pre-wrap">
            {session.announcements}
          </p>
        </div>
      )}

      {/* Comments - セッション内容の一番下 */}
      {interactions.comments.length > 0 && (
        <div className="space-y-2">
          {interactions.comments.map((c) => (
            <div key={c.id} className="bg-muted/50 rounded-md px-3 py-2 text-sm">
              {interactions.editingCommentId === c.id ? (
                <div className="space-y-2">
                  <Input
                    value={interactions.editingText}
                    onChange={(e) => interactions.setEditingText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        interactions.handleSaveEdit(c.id);
                      }
                      if (e.key === "Escape") {
                        interactions.handleCancelEdit();
                      }
                    }}
                    className="text-sm"
                    autoFocus
                  />
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => interactions.handleSaveEdit(c.id)}
                      disabled={!interactions.editingText.trim()}
                      className="h-7 px-2"
                    >
                      <CheckIconLucide className="h-3 w-3 mr-1" />
                      保存
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={interactions.handleCancelEdit}
                      className="h-7 px-2"
                    >
                      <XIcon className="h-3 w-3 mr-1" />
                      キャンセル
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p>{c.text}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(c.created_at), "M/d HH:mm")}
                      {c.source === "slack" && " (Slack)"}
                    </p>
                  </div>
                  {c.source !== "slack" && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => interactions.handleStartEdit(c)}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="編集"
                      >
                        <PencilIcon className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => interactions.setDeleteConfirmId(c.id)}
                        className="p-1 rounded hover:bg-red-100 text-muted-foreground hover:text-red-600 transition-colors"
                        title="削除"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* コメント入力欄 */}
      {interactions.showCommentInput && (
        <div className="flex items-center gap-2">
          <Input
            placeholder="コメントを入力..."
            value={interactions.newComment}
            onChange={(e) => interactions.setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                interactions.handleSendComment();
                interactions.setShowCommentInput(false);
              }
              if (e.key === "Escape") {
                interactions.setShowCommentInput(false);
                interactions.setNewComment("");
              }
            }}
            disabled={interactions.sendingComment}
            className="flex-1"
            autoFocus
          />
          <Button
            size="icon"
            onClick={() => {
              interactions.handleSendComment();
              interactions.setShowCommentInput(false);
            }}
            disabled={!interactions.newComment.trim() || interactions.sendingComment}
          >
            <SendIcon className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              interactions.setShowCommentInput(false);
              interactions.setNewComment("");
            }}
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* 削除確認ダイアログ */}
      <Dialog open={!!interactions.deleteConfirmId} onOpenChange={(open) => !open && interactions.setDeleteConfirmId(null)}>
        <DialogContent className="flex flex-col items-center text-center py-10">
          <TrashIcon className="h-12 w-12 text-red-500 mb-4" />
          <DialogHeader className="text-center">
            <DialogTitle className="text-center">コメントの削除</DialogTitle>
            <DialogDescription className="text-center">このコメントを削除しますか？</DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 flex gap-2 justify-center">
            <Button variant="outline" onClick={() => interactions.setDeleteConfirmId(null)}>キャンセル</Button>
            <Button variant="destructive" onClick={() => interactions.deleteConfirmId && interactions.handleDeleteComment(interactions.deleteConfirmId)}>削除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// リアクション・コメント機能のカスタムフック
function useSessionInteractions(sessionId: string, apiToken: string) {
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [sendingReaction, setSendingReaction] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [showCommentInput, setShowCommentInput] = useState(false);

  const fetchReactions = async () => {
    if (!apiToken) return;
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/database/daily-reports/add-slack-reaction/${sessionId}/reactions`,
        { headers: { Authorization: `Bearer ${apiToken}` } }
      );
      const data = await res.json();
      if (data.ok) {
        setReactions(data.reactions ?? []);
      }
    } catch (e) {
      console.error("Failed to fetch reactions:", e);
    }
  };

  const fetchComments = async () => {
    if (!apiToken) return;
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/database/daily-reports/comments/${sessionId}`,
        { headers: { Authorization: `Bearer ${apiToken}` } }
      );
      const data = await res.json();
      if (data.ok) {
        setComments(data.comments ?? []);
      }
    } catch (e) {
      console.error("Failed to fetch comments:", e);
    }
  };

  const reactionCounts = reactions
    .filter((r) => r.kind === "clock_out")
    .reduce((acc, r) => {
      acc[r.emoji] = (acc[r.emoji] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const handleReactionToggle = async (emoji: string) => {
    if (!apiToken || sendingReaction) return;
    const hasReaction = reactionCounts[emoji] > 0;
    setSendingReaction(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/database/daily-reports/add-slack-reaction/${sessionId}/reactions`,
        {
          method: hasReaction ? "DELETE" : "POST",
          headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ emoji, kind: "clock_out" }),
        }
      );
      const data = await res.json();
      if (data.ok) {
        fetchReactions();
      } else {
        console.error("Reaction failed:", data.error);
      }
    } catch (e) {
      console.error("Reaction error:", e);
    } finally {
      setSendingReaction(false);
    }
  };

  const handleSendComment = async () => {
    if (!apiToken || !newComment.trim() || sendingComment) return;
    setSendingComment(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/database/daily-reports/add-slack-comment/${sessionId}/comments`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ text: newComment.trim() }),
        }
      );
      const data = await res.json();
      if (data.ok) {
        setNewComment("");
        fetchComments();
      }
    } catch (e) {
      console.error("Comment error:", e);
    } finally {
      setSendingComment(false);
    }
  };

  const handleStartEdit = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditingText(comment.text);
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditingText("");
  };

  const handleSaveEdit = async (commentId: string) => {
    if (!apiToken || !editingText.trim()) return;
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/database/daily-reports/comments/${commentId}`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ text: editingText.trim() }),
        }
      );
      const data = await res.json();
      if (data.ok) {
        setEditingCommentId(null);
        setEditingText("");
        fetchComments();
      }
    } catch (e) {
      console.error("Edit comment error:", e);
    }
  };

  // 削除確認ダイアログ用のstate
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDeleteComment = async (commentId: string) => {
    if (!apiToken) return;
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/database/daily-reports/comments/${commentId}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${apiToken}` } }
      );
      const data = await res.json();
      if (data.ok) {
        fetchComments();
      }
    } catch (e) {
      console.error("Delete comment error:", e);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  useEffect(() => {
    fetchReactions();
    fetchComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, apiToken]);

  return {
    reactions,
    reactionCounts,
    sendingReaction,
    handleReactionToggle,
    comments,
    newComment,
    setNewComment,
    sendingComment,
    handleSendComment,
    editingCommentId,
    editingText,
    setEditingText,
    handleStartEdit,
    handleCancelEdit,
    handleSaveEdit,
    handleDeleteComment,
    deleteConfirmId,
    setDeleteConfirmId,
    showCommentInput,
    setShowCommentInput,
  };
}

// インライン用リアクション・コメントボタン（セッションヘッダー横に表示）
function ReactionCommentButtonsInline({
  reactionCounts,
  sendingReaction,
  handleReactionToggle,
  comments,
  showCommentInput,
  setShowCommentInput,
  newComment,
  setNewComment,
  sendingComment,
  handleSendComment,
  handleStartEdit,
  handleDeleteComment,
  setDeleteConfirmId,
}: {
  reactionCounts: Record<string, number>;
  sendingReaction: boolean;
  handleReactionToggle: (emoji: string) => void;
  comments: Comment[];
  showCommentInput: boolean;
  setShowCommentInput: (v: boolean) => void;
  newComment: string;
  setNewComment: (v: string) => void;
  sendingComment: boolean;
  handleSendComment: () => void;
  handleStartEdit: (c: Comment) => void;
  handleDeleteComment: (id: string) => void;
  setDeleteConfirmId: (id: string | null) => void;
}) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const hasComments = comments.length > 0;

  return (
    <div className="flex items-center gap-1.5">
      {/* 既存のリアクション */}
      {EMOJIS.filter((e) => reactionCounts[e.key] > 0).map((e) => (
        <button
          key={e.key}
          onClick={() => handleReactionToggle(e.key)}
          disabled={sendingReaction}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs bg-muted hover:bg-muted/80 transition-colors disabled:opacity-50"
        >
          <span>{e.label}</span>
          <span className="text-muted-foreground">{reactionCounts[e.key]}</span>
        </button>
      ))}

      {/* リアクション追加ボタン */}
      <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
        <PopoverTrigger asChild>
          <button
            className="flex items-center justify-center w-6 h-6 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
            title="リアクションを追加"
          >
            <SmilePlusIcon className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="flex items-center gap-1">
            {EMOJIS.map((e) => (
              <button
                key={e.key}
                onClick={() => {
                  handleReactionToggle(e.key);
                  setShowEmojiPicker(false);
                }}
                disabled={sendingReaction}
                className="p-1.5 rounded hover:bg-muted transition-colors text-lg disabled:opacity-50"
                title={e.key}
              >
                {e.label}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* コメントボタン（コメント数バッジ付き） - クリックで入力欄をカード下部に表示 */}
      <button
        onClick={() => setShowCommentInput(!showCommentInput)}
        className="flex items-center justify-center gap-1 h-6 px-1.5 rounded-md transition-colors bg-muted hover:bg-muted/80 text-muted-foreground"
        title="コメント"
      >
        <MessageCircleIcon className="h-3.5 w-3.5" />
        {hasComments && <span className="text-xs">{comments.length}</span>}
      </button>
    </div>
  );
}

// リアクション・コメントUI（詳細ダイアログ用）- ボタンは右端、入力は幅広
function ReactionCommentSectionDialog({
  reactionCounts,
  sendingReaction,
  handleReactionToggle,
  comments,
  newComment,
  setNewComment,
  sendingComment,
  handleSendComment,
  editingCommentId,
  editingText,
  setEditingText,
  handleStartEdit,
  handleCancelEdit,
  handleSaveEdit,
  handleDeleteComment,
  deleteConfirmId,
  setDeleteConfirmId,
}: {
  reactionCounts: Record<string, number>;
  sendingReaction: boolean;
  handleReactionToggle: (emoji: string) => void;
  comments: Comment[];
  newComment: string;
  setNewComment: (v: string) => void;
  sendingComment: boolean;
  handleSendComment: () => void;
  editingCommentId: string | null;
  editingText: string;
  setEditingText: (v: string) => void;
  handleStartEdit: (c: Comment) => void;
  handleCancelEdit: () => void;
  handleSaveEdit: (id: string) => void;
  handleDeleteComment: (id: string) => void;
  deleteConfirmId: string | null;
  setDeleteConfirmId: (id: string | null) => void;
}) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);

  const handleSendAndClose = () => {
    handleSendComment();
    setShowCommentInput(false);
  };

  return (
    <div className="space-y-3 pt-3 border-t">
      {/* コメント一覧 - ボタンの上 */}
      {comments.length > 0 && (
        <div className="space-y-2">
          {comments.map((c) => (
            <div key={c.id} className="bg-muted/50 rounded-md px-3 py-2">
              {editingCommentId === c.id ? (
                <div className="space-y-2">
                  <Input
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSaveEdit(c.id);
                      }
                      if (e.key === "Escape") handleCancelEdit();
                    }}
                    className="text-sm"
                    autoFocus
                  />
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSaveEdit(c.id)}
                      disabled={!editingText.trim()}
                      className="h-7 px-2"
                    >
                      <CheckIconLucide className="h-3 w-3 mr-1" />
                      保存
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCancelEdit}
                      className="h-7 px-2"
                    >
                      <XIcon className="h-3 w-3 mr-1" />
                      キャンセル
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm">{c.text}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(c.created_at), "M/d HH:mm")}
                      {c.source === "slack" && " (Slack)"}
                    </p>
                  </div>
                  {c.source !== "slack" && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleStartEdit(c)}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="編集"
                      >
                        <PencilIcon className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(c.id)}
                        className="p-1 rounded hover:bg-red-100 text-muted-foreground hover:text-red-600 transition-colors"
                        title="削除"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 削除確認ダイアログ */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="flex flex-col items-center text-center py-10">
          <TrashIcon className="h-12 w-12 text-red-500 mb-4" />
          <DialogHeader className="text-center">
            <DialogTitle className="text-center">コメントの削除</DialogTitle>
            <DialogDescription className="text-center">このコメントを削除しますか？</DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 flex gap-2 justify-center">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>キャンセル</Button>
            <Button variant="destructive" onClick={() => deleteConfirmId && handleDeleteComment(deleteConfirmId)}>削除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ボタン行 - 右端 */}
      <div className="flex items-center justify-end gap-1.5">
        {/* Existing Reactions */}
        {EMOJIS.filter((e) => reactionCounts[e.key] > 0).map((e) => (
          <button
            key={e.key}
            onClick={() => handleReactionToggle(e.key)}
            disabled={sendingReaction}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-sm bg-muted hover:bg-muted/80 transition-colors disabled:opacity-50"
          >
            <span>{e.label}</span>
            <span className="text-xs text-muted-foreground">{reactionCounts[e.key]}</span>
          </button>
        ))}

        {/* リアクション追加ボタン */}
        <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
          <PopoverTrigger asChild>
            <button
              className="flex items-center justify-center w-7 h-7 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
              title="リアクションを追加"
            >
              <SmilePlusIcon className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="end">
            <div className="flex items-center gap-1">
              {EMOJIS.map((e) => (
                <button
                  key={e.key}
                  onClick={() => {
                    handleReactionToggle(e.key);
                    setShowEmojiPicker(false);
                  }}
                  disabled={sendingReaction}
                  className="p-1.5 rounded hover:bg-muted transition-colors text-lg disabled:opacity-50"
                  title={e.key}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* コメントボタン */}
        <button
          onClick={() => setShowCommentInput(!showCommentInput)}
          className={`flex items-center justify-center gap-1 h-7 px-2 rounded-md transition-colors ${
            showCommentInput
              ? "bg-muted/80"
              : "bg-muted hover:bg-muted/80"
          } text-muted-foreground`}
          title="コメント"
        >
          <MessageCircleIcon className="h-4 w-4" />
          {comments.length > 0 && <span className="text-xs">{comments.length}</span>}
        </button>
      </div>

      {/* コメント入力 - 幅広 */}
      {showCommentInput && (
        <div className="flex items-center gap-2">
          <Input
            placeholder="コメントを入力..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendAndClose();
              }
              if (e.key === "Escape") {
                setShowCommentInput(false);
                setNewComment("");
              }
            }}
            disabled={sendingComment}
            className="flex-1"
            autoFocus
          />
          <Button
            size="icon"
            onClick={handleSendAndClose}
            disabled={!newComment.trim() || sendingComment}
          >
            <SendIcon className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              setShowCommentInput(false);
              setNewComment("");
            }}
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

// リアクション・コメントUI（共通コンポーネント）- Slack風ホバーツールバー
function ReactionCommentSection({
  reactionCounts,
  sendingReaction,
  handleReactionToggle,
  comments,
  newComment,
  setNewComment,
  sendingComment,
  handleSendComment,
  editingCommentId,
  editingText,
  setEditingText,
  handleStartEdit,
  handleCancelEdit,
  handleSaveEdit,
  handleDeleteComment,
  compact = false,
}: {
  reactionCounts: Record<string, number>;
  sendingReaction: boolean;
  handleReactionToggle: (emoji: string) => void;
  comments: Comment[];
  newComment: string;
  setNewComment: (v: string) => void;
  sendingComment: boolean;
  handleSendComment: () => void;
  editingCommentId: string | null;
  editingText: string;
  setEditingText: (v: string) => void;
  handleStartEdit: (c: Comment) => void;
  handleCancelEdit: () => void;
  handleSaveEdit: (id: string) => void;
  handleDeleteComment: (id: string) => void;
  compact?: boolean;
}) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);

  // リアクションがあるかどうか
  const hasReactions = Object.values(reactionCounts).some((count) => count > 0);

  return (
    <div className={`space-y-2 ${compact ? "pt-2 pl-6" : "pt-3 border-t"}`}>
      {/* Reactions & Actions Row - コメントがない場合のみ表示 */}
      {comments.length === 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Existing Reactions */}
          {EMOJIS.filter((e) => reactionCounts[e.key] > 0).map((e) => {
            const count = reactionCounts[e.key];
            return (
              <button
                key={e.key}
                onClick={() => handleReactionToggle(e.key)}
                disabled={sendingReaction}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-sm bg-muted hover:bg-muted/80 transition-colors disabled:opacity-50"
              >
                <span>{e.label}</span>
                <span className="text-xs text-muted-foreground">{count}</span>
              </button>
            );
          })}

          {/* リアクション追加ボタン */}
          <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
            <PopoverTrigger asChild>
              <button
                className="flex items-center justify-center w-7 h-7 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                title="リアクションを追加"
              >
                <SmilePlusIcon className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="start">
              <div className="flex items-center gap-1">
                {EMOJIS.map((e) => (
                  <button
                    key={e.key}
                    onClick={() => {
                      handleReactionToggle(e.key);
                      setShowEmojiPicker(false);
                    }}
                    disabled={sendingReaction}
                    className="p-1.5 rounded hover:bg-muted transition-colors text-lg disabled:opacity-50"
                    title={e.key}
                  >
                    {e.label}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* コメントボタン（コメント入力が非表示の場合に表示） */}
          {!showCommentInput && (
            <button
              onClick={() => setShowCommentInput(true)}
              className="flex items-center justify-center w-7 h-7 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
              title="コメントを追加"
            >
              <MessageCircleIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Existing Reactions - コメントがある場合は上部に表示 */}
      {comments.length > 0 && hasReactions && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {EMOJIS.filter((e) => reactionCounts[e.key] > 0).map((e) => {
            const count = reactionCounts[e.key];
            return (
              <button
                key={e.key}
                onClick={() => handleReactionToggle(e.key)}
                disabled={sendingReaction}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-sm bg-muted hover:bg-muted/80 transition-colors disabled:opacity-50"
              >
                <span>{e.label}</span>
                <span className="text-xs text-muted-foreground">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Comment Input - クリックで表示 */}
      {showCommentInput && (
        <div className="flex items-center gap-2">
          <Input
            placeholder="コメントを入力..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendComment();
                setShowCommentInput(false);
              }
              if (e.key === "Escape") {
                setShowCommentInput(false);
                setNewComment("");
              }
            }}
            disabled={sendingComment}
            className="flex-1"
            autoFocus
          />
          <Button
            size="icon"
            onClick={() => {
              handleSendComment();
              setShowCommentInput(false);
            }}
            disabled={!newComment.trim() || sendingComment}
          >
            <SendIcon className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              setShowCommentInput(false);
              setNewComment("");
            }}
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Comment List */}
      {comments.length > 0 && (
        <div className="space-y-2">
          {comments.map((c) => (
            <div key={c.id} className="bg-muted/50 rounded-md px-3 py-2">
              {editingCommentId === c.id ? (
                <div className="space-y-2">
                  <Input
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSaveEdit(c.id);
                      }
                      if (e.key === "Escape") {
                        handleCancelEdit();
                      }
                    }}
                    className="text-sm"
                    autoFocus
                  />
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSaveEdit(c.id)}
                      disabled={!editingText.trim()}
                      className="h-7 px-2"
                    >
                      <CheckIconLucide className="h-3 w-3 mr-1" />
                      保存
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCancelEdit}
                      className="h-7 px-2"
                    >
                      <XIcon className="h-3 w-3 mr-1" />
                      キャンセル
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm">{c.text}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(c.created_at), "M/d HH:mm")}
                      {c.source === "slack" && " (Slack)"}
                    </p>
                  </div>
                  {c.source !== "slack" && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleStartEdit(c)}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="編集"
                      >
                        <PencilIcon className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteComment(c.id)}
                        className="p-1 rounded hover:bg-red-100 text-muted-foreground hover:text-red-600 transition-colors"
                        title="削除"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* コメント一覧の下にリアクション・コメント追加ボタン */}
          {!showCommentInput && (
            <div className="flex items-center gap-1.5 pt-1">
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="flex items-center justify-center w-7 h-7 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                    title="リアクションを追加"
                  >
                    <SmilePlusIcon className="h-4 w-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" align="start">
                  <div className="flex items-center gap-1">
                    {EMOJIS.map((e) => (
                      <button
                        key={e.key}
                        onClick={() => handleReactionToggle(e.key)}
                        disabled={sendingReaction}
                        className="p-1.5 rounded hover:bg-muted transition-colors text-lg disabled:opacity-50"
                        title={e.key}
                      >
                        {e.label}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              <button
                onClick={() => setShowCommentInput(true)}
                className="flex items-center justify-center w-7 h-7 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                title="コメントを追加"
              >
                <MessageCircleIcon className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SessionSection({ session, isLast, apiToken }: { session: Session; isLast: boolean; apiToken: string }) {
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

  // リアクション・コメント機能
  const interactions = useSessionInteractions(session.id, apiToken);

  return (
    <div className={`${!isLast ? "border-b pb-4 mb-4" : ""}`}>
      <div className="space-y-3">
        {/* Session Header with Reaction/Comment buttons */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            セッション{session.session_no}
            {sessionTimeLabel && `（${sessionTimeLabel}）`}
            {sessionWorkMinutes > 0 && ` ${formatMinutesToHours(sessionWorkMinutes)}`}
          </span>
          <ReactionCommentButtonsInline {...interactions} />
        </div>

        {/* Actual Tasks */}
        {actualTasks.length > 0 && (
          <div className="space-y-1">
            <span className="text-sm font-medium">
              今日の実績（{formatMinutesToHours(totalMinutes)}）
            </span>
            <ul className="space-y-1 pl-1">
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

        {/* Memo */}
        {session.summary && (
          <div className="space-y-1">
            <span className="text-sm font-medium">本日のまとめ</span>
            <p className="text-sm pl-1">
              {session.summary}
            </p>
          </div>
        )}

        {/* Trouble */}
        {session.troubles && (
          <div className="space-y-1">
            <span className="text-sm font-medium text-red-500">
              困っていること
            </span>
            <p className="text-sm pl-1 text-red-600">{session.troubles}</p>
          </div>
        )}

        {/* Comments */}
        {interactions.comments.length > 0 && (
          <div className="space-y-2 pl-6">
            {interactions.comments.map((c) => (
              <div key={c.id} className="bg-muted/50 rounded-md px-3 py-2 text-sm">
                {interactions.editingCommentId === c.id ? (
                  <div className="space-y-2">
                    <Input
                      value={interactions.editingText}
                      onChange={(e) => interactions.setEditingText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          interactions.handleSaveEdit(c.id);
                        }
                        if (e.key === "Escape") {
                          interactions.handleCancelEdit();
                        }
                      }}
                      className="text-sm"
                      autoFocus
                    />
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => interactions.handleSaveEdit(c.id)}
                        disabled={!interactions.editingText.trim()}
                        className="h-7 px-2"
                      >
                        <CheckIconLucide className="h-3 w-3 mr-1" />
                        保存
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={interactions.handleCancelEdit}
                        className="h-7 px-2"
                      >
                        <XIcon className="h-3 w-3 mr-1" />
                        キャンセル
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p>{c.text}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(c.created_at), "M/d HH:mm")}
                        {c.source === "slack" && " (Slack)"}
                      </p>
                    </div>
                    {c.source !== "slack" && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => interactions.handleStartEdit(c)}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="編集"
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => interactions.setDeleteConfirmId(c.id)}
                          className="p-1 rounded hover:bg-red-100 text-muted-foreground hover:text-red-600 transition-colors"
                          title="削除"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* コメント入力欄 */}
        {interactions.showCommentInput && (
          <div className="flex items-center gap-2 pl-6">
            <Input
              placeholder="コメントを入力..."
              value={interactions.newComment}
              onChange={(e) => interactions.setNewComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  interactions.handleSendComment();
                  interactions.setShowCommentInput(false);
                }
                if (e.key === "Escape") {
                  interactions.setShowCommentInput(false);
                  interactions.setNewComment("");
                }
              }}
              disabled={interactions.sendingComment}
              className="flex-1"
              autoFocus
            />
            <Button
              size="icon"
              onClick={() => {
                interactions.handleSendComment();
                interactions.setShowCommentInput(false);
              }}
              disabled={!interactions.newComment.trim() || interactions.sendingComment}
            >
              <SendIcon className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                interactions.setShowCommentInput(false);
                interactions.setNewComment("");
              }}
            >
              <XIcon className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* 削除確認ダイアログ */}
        <Dialog open={!!interactions.deleteConfirmId} onOpenChange={(open) => !open && interactions.setDeleteConfirmId(null)}>
          <DialogContent className="flex flex-col items-center text-center py-10">
            <TrashIcon className="h-12 w-12 text-red-500 mb-4" />
            <DialogHeader className="text-center">
              <DialogTitle className="text-center">コメントの削除</DialogTitle>
              <DialogDescription className="text-center">このコメントを削除しますか？</DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-6 flex gap-2 justify-center">
              <Button variant="outline" onClick={() => interactions.setDeleteConfirmId(null)}>キャンセル</Button>
              <Button variant="destructive" onClick={() => interactions.deleteConfirmId && interactions.handleDeleteComment(interactions.deleteConfirmId)}>削除</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
