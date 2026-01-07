import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import AdminDailyReportsClient from "./AdminDailyReportsClient";

function isAdmin(session: any) {
  return (session?.user as any)?.role === "admin";
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ year?: string; month?: string; userId?: string; date?: string; view?: string }> | { year?: string; month?: string; userId?: string; date?: string; view?: string };
}) {
  const sp = await Promise.resolve(searchParams ?? {});

  const session = await getServerSession(authOptions);
  const apiToken = (session?.user as any)?.apiToken as string | undefined;

  if (!apiToken) redirect(`/login?callbackUrl=${encodeURIComponent(`/admin/daily-reports`)}`);
  if (!isAdmin(session)) redirect(`/daily-reports`);

  const backendBase = process.env.NEXT_PUBLIC_API_URL;
  if (!backendBase) throw new Error("NEXT_PUBLIC_API_URL missing");

  // 表示モード: day(日ごと) or month(月ごと)
  const viewMode = sp.view === "month" ? "month" : "day";

  // デフォルトは今日の日付
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const year = sp.year ? Number(sp.year) : now.getFullYear();
  const month = sp.month ? Number(sp.month) : now.getMonth() + 1;
  const filterUserId = sp.userId ?? "";
  // 日モードの場合のみ日付フィルタを適用
  const filterDate = viewMode === "day" ? (sp.date ?? todayStr) : "";

  // ユーザー一覧を取得
  const usersRes = await fetch(`${backendBase}/database/admin/users`, {
    headers: { Authorization: `Bearer ${apiToken}` },
    cache: "no-store",
  });

  const usersData = await usersRes.json().catch(() => ({} as any));
  if (!usersRes.ok || !usersData?.ok) throw new Error(usersData?.error ?? "Failed to load users");

  const users: Array<{ id: string; name: string; email: string; role: string }> = usersData.users ?? [];

  // 日報一覧を取得
  const reportsUrl = new URL(`${backendBase}/database/admin/daily-reports`);
  reportsUrl.searchParams.set("year", String(year));
  reportsUrl.searchParams.set("month", String(month));
  // "by-user" は表示モード指定なので、APIには渡さない
  if (filterUserId && filterUserId !== "by-user") {
    reportsUrl.searchParams.set("userId", filterUserId);
  }

  const reportsRes = await fetch(reportsUrl.toString(), {
    headers: { Authorization: `Bearer ${apiToken}` },
    cache: "no-store",
  });

  const reportsData = await reportsRes.json().catch(() => ({} as any));
  if (!reportsRes.ok || !reportsData?.ok) throw new Error(reportsData?.error ?? "Failed to load reports");

  return (
    <AdminDailyReportsClient
      year={year}
      month={month}
      users={users}
      usersWithReports={reportsData.users ?? []}
      filterUserId={filterUserId}
      filterDate={filterDate}
      viewMode={viewMode}
      apiToken={apiToken}
    />
  );
}
