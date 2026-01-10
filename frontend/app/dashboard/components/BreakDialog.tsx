"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X } from "lucide-react";
import { Loader } from "@/components/Loader";
import { SuccessDialog } from "@/components/SuccessDialog";
import { Task } from "../../../../shared/types/Attendance";

export const BreakDialog = ({
    open,
    mode,
    onClose,
    onStart,
    onEnd
}: {
    open: boolean;
    mode: "start" | "end";
    onClose: () => void;
    onStart: () => Promise<void>;
    onEnd: (tasks: Task[]) => Promise<void>;
}) => {
    const [status, setStatus] = useState<"form" | "loading" | "success">("form");
    const [additionalTasks, setAdditionalTasks] = useState<{ task: string, hours: string }[]>([
        { task: "", hours: "" },
    ]);

    const handleSubmit = async () => {
        try {
            setStatus("loading");
            if (mode === "start") {
                await onStart();
            } else {
                await onEnd(additionalTasks);
            }
            setStatus("success");
        } catch (e) {
            console.error(e);
            setStatus("form");
        }
    };

    const handleCloseSuccess = () => {
        setStatus("form");
        setAdditionalTasks([{ task: "", hours: "" }]);
        onClose();
    };

    if (status === "loading") {
        return (
            <Dialog open={open} onOpenChange={onClose}>
                <DialogContent className="flex justify-center py-12">
                    <Loader size={50} border={4} />
                </DialogContent>
            </Dialog>
        );
    }

    if (status === "success") {
        return (
            <SuccessDialog open={open} onClose={handleCloseSuccess} />
        );
    }

    // 休憩開始ダイアログ
    if (mode === "start") {
        return (
            <Dialog open={open} onOpenChange={onClose}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>休憩を開始しますか？</DialogTitle>
                    </DialogHeader>
                    <DialogFooter>
                        <Button onClick={handleSubmit}>開始</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    // 休憩終了ダイアログ（タスク追加フォーム付き）
    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="w-[calc(100%-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto p-6">
                <DialogHeader>
                    <DialogTitle>休憩終了・作業再開</DialogTitle>
                    <DialogDescription>追加タスクがあれば入力してください（任意）</DialogDescription>
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
                    <Button onClick={handleSubmit}>作業再開</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
