import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const token = session?.user?.apiToken;

    if (!token) {
      return json(
        {
          error: "Unauthorized",
          ...(process.env.NODE_ENV !== "production"
            ? { debug: { hasSession: !!session, user: session?.user ?? null } }
            : {}),
        },
        401
      );
    }

    const url = new URL(request.url);
    const date = url.searchParams.get("date");
    const userId = url.searchParams.get("userId"); // optional（管理者用）

    if (!date) {
      return json({ error: "Missing parameters", detail: "date is required" }, 400);
    }

    const base = process.env.NEXT_PUBLIC_API_URL;
    if (!base) {
      return json({ error: "NEXT_PUBLIC_API_URL missing" }, 500);
    }

    const backendUrl = new URL(`${base}/database/daily-reports/get-by-date`);
    backendUrl.searchParams.set("date", date);
    if (userId) backendUrl.searchParams.set("userId", userId);

    const res = await fetch(backendUrl.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const raw = await res.text();
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      data = { error: "Invalid response from backend", raw };
    }

    return json(data, res.status);
  } catch (err) {
    return json({ error: "Internal error", detail: String(err) }, 500);
  }
}
