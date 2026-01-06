import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

function isAdmin(session: any) {
  return (session?.user as any)?.role === "admin";
}

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ date?: string }> | { date?: string };
}) {
  const sp = await Promise.resolve(searchParams ?? {});
  const date = sp.date ?? todayYmd();

  const session = await getServerSession(authOptions);
  const apiToken = (session?.user as any)?.apiToken as string | undefined;

  if (!apiToken) redirect(`/login?callbackUrl=${encodeURIComponent(`/admin/daily-reports`)}`);
  if (!isAdmin(session)) redirect(`/daily-reports/${date}`);

  const backendBase = process.env.NEXT_PUBLIC_API_URL;
  if (!backendBase) throw new Error("NEXT_PUBLIC_API_URL missing");

  const res = await fetch(`${backendBase}/database/admin/users`, {
    headers: { Authorization: `Bearer ${apiToken}` },
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({} as any));
  if (!res.ok || !data?.ok) throw new Error(data?.error ?? "Failed to load users");

  const users: Array<{ id: string; name: string; email: string; role: string }> = data.users ?? [];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-lg font-semibold">Admin / 日報閲覧</h1>
        <p className="text-sm text-muted-foreground">
          管理者は任意ユーザーの日報を閲覧・リアクション・コメントできます
        </p>
      </header>

      <div className="flex items-center gap-3">
        <form className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">日付</label>
          <input
            name="date"
            type="date"
            defaultValue={date}
            className="rounded-md border px-3 py-1 text-sm"
          />
          <button className="rounded-md border px-3 py-1 text-sm">表示</button>
        </form>
      </div>

      <div className="rounded-xl border">
        <div className="border-b px-4 py-2 text-sm font-medium">ユーザー</div>
        <ul className="divide-y">
          {users.map((u) => (
            <li key={u.id} className="px-4 py-3 flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-sm font-medium">{u.name}</div>
                <div className="text-xs text-muted-foreground">{u.email}</div>
              </div>
              <Link
                className="text-sm underline"
                href={`/admin/daily-reports/${u.id}/${date}`}
              >
                開く
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
