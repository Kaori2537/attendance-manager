// StopOrClockOutDialog.tsx - 中断/退勤選択ダイアログ
"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Pause, LogOut } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelectStop: () => void;
  onSelectClockOut: () => void;
}

export function StopOrClockOutDialog({
  open,
  onClose,
  onSelectStop,
  onSelectClockOut,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>作業を終了しますか？</DialogTitle>
          <DialogDescription>
            中断または退勤を選択してください
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 中断ボタン */}
          <button
            type="button"
            className="w-full h-auto py-4 px-4 flex flex-col items-start gap-1 border-2 border-gray-900 rounded-md hover:bg-gray-50 transition-colors"
            onClick={onSelectStop}
          >
            <div className="flex items-center gap-2 font-semibold">
              <Pause className="h-5 w-5" />
              中断
            </div>
            <p className="text-sm text-muted-foreground font-normal text-left">
              作業を一時中断します。再度出勤ボタンで作業を再開できます。
            </p>
          </button>

          {/* 退勤ボタン */}
          <button
            type="button"
            className="w-full h-auto py-4 px-4 flex flex-col items-start gap-1 border-2 border-red-500 rounded-md hover:bg-red-50 transition-colors"
            onClick={onSelectClockOut}
          >
            <div className="flex items-center gap-2 font-semibold text-red-500">
              <LogOut className="h-5 w-5" />
              退勤
            </div>
            <p className="text-sm text-muted-foreground font-normal text-left">
              本日の勤務を終了します。業務報告を入力してください。
            </p>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
