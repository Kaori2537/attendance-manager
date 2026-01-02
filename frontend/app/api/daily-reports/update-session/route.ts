import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const token = session?.user?.apiToken;

    if (!token) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401,
      });
    }

    const body = (await request.json().catch(() => null)) as
      | {
          sessionId?: string;
          summary?: string;
          troubles?: string;
          announcements?: string;
        }
      | null;

    if (!body?.sessionId) {
      return new Response(
        JSON.stringify({ ok: false, error: "sessionId is required" }),
        { status: 400 }
      );
    }

    const base = process.env.NEXT_PUBLIC_API_URL;
    if (!base) {
      return new Response(
        JSON.stringify({ ok: false, error: "NEXT_PUBLIC_API_URL missing" }),
        { status: 500 }
      );
    }

    const backendUrl = new URL(`${base}/database/daily-reports/update-session`);

    const res = await fetch(backendUrl.toString(), {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId: body.sessionId,
        summary: body.summary ?? "",
        troubles: body.troubles ?? "",
        announcements: body.announcements ?? "",
      }),
      cache: "no-store",
    });

    const raw = await res.text();
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      data = { ok: false, error: "Invalid response from backend", raw };
    }

    return new Response(JSON.stringify(data), { status: res.status });
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: "Internal error", detail: String(err) }),
      { status: 500 }
    );
  }
}
