// StopConfirmDialog.tsx - 中断確認ダイアログ
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/Loader";
import { SuccessDialog } from "@/components/SuccessDialog";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function StopConfirmDialog({ open, onClose, onConfirm }: Props) {
  const [mode, setMode] = useState<"confirm" | "loading" | "success">("confirm");

  const handleConfirm = async () => {
    try {
      setMode("loading");
      await onConfirm();
      setMode("success");
    } catch (e) {
      console.error(e);
      setMode("confirm");
    }
  };

  const handleClose = () => {
    onClose();
    setMode("confirm");
  };

  // --- Loading UI ---
  if (mode === "loading") {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="flex justify-center py-12">
          <DialogTitle className="sr-only">処理中</DialogTitle>
          <Loader size={50} border={4} />
        </DialogContent>
      </Dialog>
    );
  }

  // --- Success UI ---
  if (mode === "success") {
    return <SuccessDialog open={open} onClose={handleClose} />;
  }

  // --- Confirm UI ---
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>作業を中断しますか？</DialogTitle>
          <DialogDescription>
            現在の作業セッションを終了します。
            <br />
            再度出勤ボタンを押すと、作業を再開できます。
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            キャンセル
          </Button>
          <Button onClick={handleConfirm}>
            中断する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
