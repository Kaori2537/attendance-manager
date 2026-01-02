import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

type Body =
  | {
      mode: "checkin";
      sessionNo?: number;
      plannedTasks: { title: string; minutes: number }[];
    }
  | {
      mode: "checkout";
      sessionNo?: number;
      actualTasks: { title: string; minutes: number }[];
      summary?: string;
      troubles?: string;
      announcements?: string;
    };

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const token = session?.user?.apiToken;

    if (!token) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401 });
    }

    const base = process.env.NEXT_PUBLIC_API_URL;
    if (!base) {
      return new Response(JSON.stringify({ ok: false, error: "NEXT_PUBLIC_API_URL missing" }), { status: 500 });
    }

    const body = (await req.json()) as Body;
    const sessionNo = body.sessionNo ?? 1;

    const backendUrl = new URL(`${base}/database/daily-reports/upsert-from-dashboard`);

    const res = await fetch(backendUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ...body, sessionNo }),
      cache: "no-store",
    });

    const raw = await res.text();
    let json: any;
    try {
      json = JSON.parse(raw);
    } catch {
      json = { ok: false, error: "Invalid response from backend", raw };
    }

    return new Response(JSON.stringify(json), { status: res.status });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message ?? String(e) }), { status: 500 });
  }
}
