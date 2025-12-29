import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const token = session?.user?.apiToken;

    if (!token) {
      // ✅ 今だけデバッグ。直ったら消してOK
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          debug: {
            hasSession: !!session,
            user: session?.user ?? null,
          },
        }),
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const date = url.searchParams.get("date");
    const userId = url.searchParams.get("userId"); // optional（管理者用）

    if (!date) {
      return new Response(JSON.stringify({ error: "Missing parameters", detail: "date is required" }), {
        status: 400,
      });
    }

    const base = process.env.NEXT_PUBLIC_API_URL;
    if (!base) {
      return new Response(JSON.stringify({ error: "NEXT_PUBLIC_API_URL missing" }), { status: 500 });
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

    return new Response(JSON.stringify(data), { status: res.status });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal error", detail: String(err) }), { status: 500 });
  }
}
