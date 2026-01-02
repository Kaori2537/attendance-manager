"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "../hooks/use-toast";

interface Props {
  sessionId: string;
  summary: string | null;
  troubles: string | null;
  announcements: string | null;
}

type SaveStatus = "idle" | "dirty" | "saving" | "saved";

export function SessionMemoEditor({
  sessionId,
  summary,
  troubles,
  announcements,
}: Props) {
  const [s, setS] = useState(summary ?? "");
  const [t, setT] = useState(troubles ?? "");
  const [a, setA] = useState(announcements ?? "");

  const [status, setStatus] = useState<SaveStatus>("idle");

  // 初期値（props）からの比較用スナップショット
  const initialSnapshot = useMemo(
    () =>
      JSON.stringify({
        summary: summary ?? "",
        troubles: troubles ?? "",
        announcements: announcements ?? "",
      }),
    [summary, troubles, announcements]
  );

  // 最後に保存した内容（同じなら保存しない）
  const lastSavedSnapshotRef = useRef<string>(initialSnapshot);

  // 初期表示時に lastSaved を初期値へ
  useEffect(() => {
    lastSavedSnapshotRef.current = initialSnapshot;
    setStatus("idle");
    // props が更新されたら入力欄も同期したい場合は以下を有効化
    // setS(summary ?? "");
    // setT(troubles ?? "");
    // setA(announcements ?? "");
  }, [initialSnapshot]);

  const currentSnapshot = useMemo(
    () =>
      JSON.stringify({
        summary: s,
        troubles: t,
        announcements: a,
      }),
    [s, t, a]
  );

  // 変更があれば dirty にする
  useEffect(() => {
    if (currentSnapshot !== lastSavedSnapshotRef.current) {
      setStatus((prev) => (prev === "saving" ? prev : "dirty"));
    } else {
      setStatus((prev) => (prev === "saving" ? prev : "idle"));
    }
  }, [currentSnapshot]);

  async function saveCore({ showToast }: { showToast: boolean }) {
    // 同じなら何もしない
    if (currentSnapshot === lastSavedSnapshotRef.current) return;

    setStatus("saving");

    try {
      const res = await fetch("/api/daily-reports/update-session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          summary: s,
          troubles: t,
          announcements: a,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);

        setStatus("dirty");
        toast({
          variant: "destructive",
          title: "保存に失敗しました",
          description: data?.error ?? `HTTP ${res.status}`,
        });
        return;
      }

      lastSavedSnapshotRef.current = currentSnapshot;
      setStatus("saved");

      if (showToast) {
        toast({
          title: "下書き保存しました",
          description: "変更を保存しました。",
        });
      }
    } catch (e: any) {
      setStatus("dirty");
      toast({
        variant: "destructive",
        title: "保存に失敗しました",
        description: e?.message ?? String(e),
      });
    }
  }

  // ✅ 自動保存（debounce）
  useEffect(() => {
    if (status !== "dirty") return;

    const timer = window.setTimeout(() => {
      // 自動保存は控えめに（toastは出さない）
      void saveCore({ showToast: false });
    }, 1200);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, currentSnapshot]);

  const statusText =
    status === "saving"
      ? "保存中…"
      : status === "saved"
      ? "保存済み"
      : status === "dirty"
      ? "未保存"
      : "";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{statusText}</p>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void saveCore({ showToast: true })}
          disabled={status === "saving" || status === "idle"}
        >
          {status === "saving" ? "保存中…" : "下書き保存"}
        </Button>
      </div>

      <Textarea value={s} onChange={(e) => setS(e.target.value)} placeholder="Summary" />
      <Textarea value={t} onChange={(e) => setT(e.target.value)} placeholder="Troubles" />
      <Textarea value={a} onChange={(e) => setA(e.target.value)} placeholder="Announcements" />
    </div>
  );
}
