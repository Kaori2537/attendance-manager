"use client";

import { useToast } from "@/app/daily-reports/hooks/use-toast";
import { cn } from "@/lib/utils";

type ToastItem = {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
};

export function Toaster() {
  const { toasts } = useToast() as { toasts: ToastItem[] };

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "w-[320px] rounded-lg border bg-background p-4 shadow",
            t.variant === "destructive" && "border-destructive"
          )}
        >
          {t.title ? <div className="font-semibold">{t.title}</div> : null}
          {t.description ? (
            <div className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
              {t.description}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
