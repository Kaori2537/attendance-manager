import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function POST() {
    try {
        const session = await getServerSession(authOptions);
        const token = session?.user?.apiToken;

        if (!token) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/database/attendance/clock-out`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
        });

        let data = null;
        try {
            data = await res.json();
        } catch {
            data = { ok: res.ok };
        }

        return Response.json(data, { status: res.status });

    } catch (err) {
        return Response.json({ error: "Internal error", detail: String(err) }, { status: 500 });
    }
}
