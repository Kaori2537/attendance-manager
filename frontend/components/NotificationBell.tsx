"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
};

export function NotificationBell({ apiToken }: { apiToken: string }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  // クライアントサイドでのみマウント（ハイドレーションミスマッチ回避）
  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!apiToken) return;
    try {
      setLoading(true);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/database/notifications`,
        {
          headers: { Authorization: `Bearer ${apiToken}` },
          cache: "no-store",
        }
      );
      const data = await res.json();
      if (data.ok) {
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch (e) {
      console.error("Failed to fetch notifications:", e);
    } finally {
      setLoading(false);
    }
  }, [apiToken]);

  const fetchUnreadCount = useCallback(async () => {
    if (!apiToken) return;
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/database/notifications/unread-count`,
        {
          headers: { Authorization: `Bearer ${apiToken}` },
          cache: "no-store",
        }
      );
      const data = await res.json();
      if (data.ok) {
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch (e) {
      console.error("Failed to fetch unread count:", e);
    }
  }, [apiToken]);

  const markAllRead = useCallback(async () => {
    if (!apiToken) return;
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/database/notifications/read-all`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${apiToken}` },
        }
      );
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (e) {
      console.error("Failed to mark all as read:", e);
    }
  }, [apiToken]);

  // 初回とポーリング
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // 30秒ごと
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Popoverを開いたときに通知一覧を取得、閉じたときに既読にする
  useEffect(() => {
    if (open) {
      fetchNotifications();
    } else if (unreadCount > 0) {
      // 閉じたときに未読があれば全て既読にする
      markAllRead();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fetchNotifications, markAllRead]);

  const handleNotificationClick = async (notification: Notification) => {
    // 既読にする
    if (!notification.read) {
      try {
        await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/database/notifications/${notification.id}/read`,
          {
            method: "PUT",
            headers: { Authorization: `Bearer ${apiToken}` },
          }
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
        );
      } catch (e) {
        console.error("Failed to mark notification as read:", e);
      }
    }

    // リンク先に遷移
    if (notification.link) {
      setOpen(false);
      router.push(notification.link);
    }
  };

  const handleDeleteNotification = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation(); // 親のクリックイベントを防ぐ
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/database/notifications/${notificationId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${apiToken}` },
        }
      );
      // 削除した通知が未読だった場合はカウントも減らす
      const deletedNotification = notifications.find((n) => n.id === notificationId);
      if (deletedNotification && !deletedNotification.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } catch (e) {
      console.error("Failed to delete notification:", e);
    }
  };

  // SSRではプレースホルダーを表示（ハイドレーションミスマッチ回避）
  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="relative">
        <Bell className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="border-b px-4 py-3">
          <h3 className="font-medium">通知</h3>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              読み込み中...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              通知はありません
            </div>
          ) : (
            <ul>
              {notifications.map((n) => (
                <li key={n.id}>
                  <div
                    className={`relative group px-4 py-3 hover:bg-muted/50 transition-colors border-b last:border-b-0 cursor-pointer ${
                      !n.read ? "bg-blue-50" : ""
                    }`}
                    onClick={() => handleNotificationClick(n)}
                  >
                    <button
                      onClick={(e) => handleDeleteNotification(e, n.id)}
                      className="absolute top-2 right-2 p-1 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                      title="削除"
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <div className="flex items-start gap-2 pr-6">
                      {!n.read && (
                        <span className="mt-1.5 h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                      )}
                      <div className={!n.read ? "" : "pl-4"}>
                        <p className="text-sm font-medium">{n.title}</p>
                        {n.message && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {n.message}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(n.created_at), {
                            addSuffix: true,
                            locale: ja,
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
