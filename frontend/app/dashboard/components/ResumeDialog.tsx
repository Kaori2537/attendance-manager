// ResumeDialog.tsx - 再出勤ダイアログ（追加タスク入力付き）
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, X } from "lucide-react";
import { Loader } from "@/components/Loader";
import { SuccessDialog } from "@/components/SuccessDialog";
import { Task } from "../../../../shared/types/Attendance";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (additionalTasks: Task[]) => Promise<void>;
}

export function ResumeDialog({ open, onClose, onSubmit }: Props) {
  const [additionalTasks, setAdditionalTasks] = useState<{ task: string; hours: string }[]>([
    { task: "", hours: "" },
  ]);
  const [mode, setMode] = useState<"form" | "loading" | "success">("form");

  const handleSubmit = async () => {
    try {
      setMode("loading");
      await onSubmit(additionalTasks);
      setMode("success");
    } catch (e) {
      console.error(e);
      setMode("form");
    }
  };

  const handleCloseSuccess = () => {
    onClose();
    setAdditionalTasks([{ task: "", hours: "" }]);
    setMode("form");
  };

  // --- Loading UI ---
  if (mode === "loading") {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="flex justify-center py-12">
          <DialogTitle className="sr-only">処理中</DialogTitle>
          <Loader size={50} border={4} />
        </DialogContent>
      </Dialog>
    );
  }

  // --- Success UI ---
  if (mode === "success") {
    return <SuccessDialog open={open} onClose={handleCloseSuccess} />;
  }

  // --- Form UI ---
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle>再出勤</DialogTitle>
          <DialogDescription>
            追加の予定タスクがあれば入力してください（任意）
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label className="text-base">追加タスクと予定工数（時間）</Label>
            <div className="space-y-3 mt-3">
              {additionalTasks.map((task, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <div className="flex-1">
                    <Input
                      placeholder="タスク名"
                      value={task.task}
                      onChange={(e) => {
                        const newList = [...additionalTasks];
                        newList[index].task = e.target.value;
                        setAdditionalTasks(newList);
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="1"
                      value={task.hours}
                      onChange={(e) => {
                        const newList = [...additionalTasks];
                        newList[index].hours = e.target.value;
                        setAdditionalTasks(newList);
                      }}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">h</span>
                  </div>
                  {additionalTasks.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setAdditionalTasks(additionalTasks.filter((_, i) => i !== index))
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAdditionalTasks([...additionalTasks, { task: "", hours: "" }])}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                タスクを追加
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit}>再出勤</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
