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
  SendIcon,
  PencilIcon,
  TrashIcon,
  XIcon,
  CheckIcon as CheckIconLucide,
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
                <ReportCard key={report.id} report={report} userName={user.name} apiToken={apiToken} />
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

function ReportCard({ report, userName, apiToken }: { report: Report; userName: string; apiToken: string }) {
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
        apiToken={apiToken}
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

  // リアクション用の状態
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [sendingReaction, setSendingReaction] = useState(false);

  // コメント用の状態
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

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

  // リアクション取得
  const fetchReactions = async () => {
    if (!apiToken) return;
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/database/daily-reports/add-slack-reaction/${session.id}/reactions`,
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

  // コメント取得
  const fetchComments = async () => {
    if (!apiToken) return;
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/database/daily-reports/comments/${session.id}`,
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

  // コメント送信
  const handleSendComment = async () => {
    if (!apiToken || !newComment.trim() || sendingComment) return;
    setSendingComment(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/database/daily-reports/add-slack-comment/${session.id}/comments`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text: newComment.trim() }),
        }
      );
      const data = await res.json();
      if (data.ok) {
        setNewComment("");
        fetchComments();
      } else {
        console.error("Comment failed:", data.error);
      }
    } catch (e) {
      console.error("Comment error:", e);
    } finally {
      setSendingComment(false);
    }
  };

  // コメント編集開始
  const handleStartEdit = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditingText(comment.text);
  };

  // コメント編集キャンセル
  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditingText("");
  };

  // コメント編集保存
  const handleSaveEdit = async (commentId: string) => {
    if (!apiToken || !editingText.trim()) return;
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/database/daily-reports/comments/${commentId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text: editingText.trim() }),
        }
      );
      const data = await res.json();
      if (data.ok) {
        setEditingCommentId(null);
        setEditingText("");
        fetchComments();
      } else {
        console.error("Edit comment failed:", data.error);
      }
    } catch (e) {
      console.error("Edit comment error:", e);
    }
  };

  // コメント削除
  const handleDeleteComment = async (commentId: string) => {
    if (!apiToken) return;
    if (!confirm("このコメントを削除しますか？")) return;
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/database/daily-reports/comments/${commentId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${apiToken}` },
        }
      );
      const data = await res.json();
      if (data.ok) {
        fetchComments();
      } else {
        console.error("Delete comment failed:", data.error);
      }
    } catch (e) {
      console.error("Delete comment error:", e);
    }
  };

  // 初回マウント時にデータ取得
  useEffect(() => {
    fetchReactions();
    fetchComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id, apiToken]);

  // リアクションのカウントを集計（clock_out のみ）
  const reactionCounts = reactions
    .filter((r) => r.kind === "clock_out")
    .reduce((acc, r) => {
      acc[r.emoji] = (acc[r.emoji] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  // リアクショントグル（追加/削除）
  const handleReactionToggle = async (emoji: string) => {
    if (!apiToken || sendingReaction) return;

    const hasReaction = reactionCounts[emoji] > 0;
    setSendingReaction(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/database/daily-reports/add-slack-reaction/${session.id}/reactions`,
        {
          method: hasReaction ? "DELETE" : "POST",
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ emoji, kind: "clock_out" }),
        }
      );
      const data = await res.json();
      if (data.ok) {
        fetchReactions();
      } else {
        // 詳細なエラー情報をログ出力
        console.error("Reaction failed:", {
          error: data.error,
          slack_error: data.slack_error,
          slack_status: data.slack_status,
          sessionId: session.id,
        });
        // Slack link not found の場合は静かに失敗（まだSlackに投稿されていないセッション）
        if (data.error?.includes("Slack link not found")) {
          console.info("This session has not been posted to Slack yet.");
        }
      }
    } catch (e) {
      console.error("Reaction error:", e);
    } finally {
      setSendingReaction(false);
    }
  };

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

      {/* Reaction & Comment Section */}
      <div className="pt-3 border-t space-y-3">
        {/* Reactions */}
        <div className="flex items-center gap-2 flex-wrap">
          {EMOJIS.map((e) => {
            const count = reactionCounts[e.key] || 0;
            const isActive = count > 0;
            return (
              <button
                key={e.key}
                onClick={() => handleReactionToggle(e.key)}
                disabled={sendingReaction}
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm transition-colors ${
                  isActive
                    ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                } disabled:opacity-50`}
              >
                <span>{e.label}</span>
                {count > 0 && <span className="text-xs">{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Comment Input */}
        <div className="flex items-center gap-2">
          <Input
            placeholder="コメントを入力..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendComment();
              }
            }}
            disabled={sendingComment}
            className="flex-1"
          />
          <Button
            size="icon"
            onClick={handleSendComment}
            disabled={!newComment.trim() || sendingComment}
          >
            <SendIcon className="h-4 w-4" />
          </Button>
        </div>

        {/* Comment List */}
        {comments.length > 0 && (
          <div className="space-y-2">
            {comments.map((c) => (
              <div key={c.id} className="bg-muted/50 rounded-md px-3 py-2">
                {editingCommentId === c.id ? (
                  /* 編集モード */
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
                  /* 表示モード */
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm">{c.text}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(c.created_at), "M/d HH:mm")}
                        {c.source === "slack" && " (Slack)"}
                      </p>
                    </div>
                    {/* app由来のコメントのみ編集・削除可能 */}
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
          </div>
        )}
      </div>
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
