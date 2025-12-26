import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const token = session?.user?.apiToken;

    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const url = new URL(request.url);
    const year = url.searchParams.get("year");
    const month = url.searchParams.get("month");

    if (!year || !month) {
      return new Response(JSON.stringify({ error: "Missing parameters" }), { status: 400 });
    }

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/database/daily-reports/list?year=${year}&month=${month}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    let data: unknown;
    try {
      data = await res.json();
    } catch (err) {
      console.error("Failed to parse backend response:", err);
      data = { error: "Invalid response from backend" };
    }

    return new Response(JSON.stringify(data), { status: res.status });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal error", detail: String(err) }), { status: 500 });
  }
}
