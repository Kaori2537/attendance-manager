"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import type { Task } from "../../../shared/types/Attendance";

type TaskInput = { title: string; minutes: number };

function todayYmdJst() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" }); // YYYY-MM-DD
}

function toMinutes(hoursLike: unknown): number {
  const n = typeof hoursLike === "string" ? parseFloat(hoursLike) : Number(hoursLike);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 60);
}

function mapTasks(tasks: Task[]): TaskInput[] {
  return (tasks ?? [])
    .map((t: any) => ({
      title: String(t?.task ?? t?.title ?? "").trim(),
      minutes: toMinutes(t?.hours ?? t?.minutes),
    }))
    .filter((x) => x.title.length > 0 && x.minutes > 0);
}

export async function clockInWithTasks(plannedTasks: Task[], sessionNo: number) {
  const session = await getServerSession(authOptions);
  const token = (session?.user as any)?.apiToken as string | undefined;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!token) return { success: false, error: "Unauthorized" };
  if (!apiUrl) return { success: false, error: "NEXT_PUBLIC_API_URL is missing" };

  try {
    const ymd = todayYmdJst();

    // 1) DB: clock-in（勤怠）
    const dbRes = await fetch(`${apiUrl}/database/attendance/clock-in`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!dbRes.ok) {
      const text = await dbRes.text().catch(() => "");
      throw new Error(`Database clock-in failed: ${dbRes.status} ${text}`);
    }

    // 2) DB: daily-reports upsert（予定タスク）
    const planned = mapTasks(plannedTasks);

    const upsertRes = await fetch(`${apiUrl}/database/daily-reports/upsert-from-dashboard`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        date: ymd,
        mode: "checkin",
        sessionNo,
        userName: session?.user?.name, // ★ Slack用（backendで使用）
        plannedTasks: planned,
      }),
    });

    if (!upsertRes.ok) {
      const text = await upsertRes.text().catch(() => "");
      throw new Error(`DailyReports upsert(checkin) failed: ${upsertRes.status} ${text}`);
    }

    // ★ Slack通知は backend が担当するため、ここでは何もしない
    return { success: true };
  } catch (err) {
    console.error("clockInWithTasks Error:", err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
