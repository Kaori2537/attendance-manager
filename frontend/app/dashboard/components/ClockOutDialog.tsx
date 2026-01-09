// ClockOutDialog.tsx
"use client"

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, X } from "lucide-react";
import { Loader } from "@/components/Loader";
import { SuccessDialog } from "@/components/SuccessDialog";
import { Task } from "../../../../shared/types/Attendance";

type PlannedTask = {
    title: string;
    minutes: number;
};

export const ClockOutDialog = ({ open, onClose, onSubmit, sessionNo }: { open: boolean; onClose: () => void; onSubmit: (actualTasks: Task[], summary: string, issues: string, notes: string) => Promise<void>; sessionNo: number; }) => {

    const [actualTasks, setActualTasks] = useState<{ task: string, hours: string }[]>([{ task: "", hours: "" }]);
    const [summary, setSummary] = useState<string>("");
    const [issues, setIssues] = useState<string>("");
    const [notes, setNotes] = useState<string>("");
    const [mode, setMode] = useState<"form" | "loading" | "success">("form");
    const [initialLoading, setInitialLoading] = useState(false);

    // 出勤時に入力したタスクを取得して初期値に設定
    useEffect(() => {
        if (!open) return;

        const fetchPlannedTasks = async () => {
            setInitialLoading(true);
            try {
                const today = new Date();
                const yyyy = today.getFullYear();
                const mm = String(today.getMonth() + 1).padStart(2, "0");
                const dd = String(today.getDate()).padStart(2, "0");
                const dateStr = `${yyyy}-${mm}-${dd}`;

                const res = await fetch(`/api/daily-reports/get-by-date?date=${dateStr}`);
                if (!res.ok) {
                    console.error("Failed to fetch planned tasks");
                    return;
                }

                const data = await res.json();
                if (!data.ok || !data.sessions) return;

                // sessionNoに対応するセッションを探す（session_noは1-indexed）
                const targetSession = data.sessions.find((s: any) => s.session_no === sessionNo);
                if (!targetSession?.plannedTasks?.length) return;

                // plannedTasksをactualTasksの形式に変換
                const converted = targetSession.plannedTasks.map((t: PlannedTask) => ({
                    task: t.title,
                    hours: `${t.minutes / 60}`, // 分を時間に変換
                }));

                setActualTasks(converted);
            } catch (e) {
                console.error("Error fetching planned tasks:", e);
            } finally {
                setInitialLoading(false);
            }
        };

        fetchPlannedTasks();
    }, [open, sessionNo]);

    const handleSubmit = async () => {
        try {
            setMode("loading");
            await onSubmit(actualTasks, summary, issues, notes);
            setMode("success");

        } catch (e) {
            console.error(e);
            setMode("form");
        }
    };

    const handleCloseSuccess = () => {
        onClose();
        setActualTasks([{ task: "", hours: "" }]);
        setSummary("");
        setIssues("");
        setNotes("");
        setMode("form");
    };

    // --- Initial Loading UI ---
    if (initialLoading) {
        return (
            <Dialog open={open} onOpenChange={onClose}>
                <DialogContent className="flex justify-center py-12">
                    <DialogTitle className="sr-only">読み込み中</DialogTitle>
                    <Loader size={50} border={4} />
                </DialogContent>
            </Dialog>
        );
    }

    // --- Loading UI ---
    if (mode === "loading") {
        return (
            <Dialog open={open} onOpenChange={onClose}>
                <DialogContent className="flex justify-center py-12">
                    <DialogTitle className="sr-only">送信中</DialogTitle>
                    <Loader size={50} border={4} />
                </DialogContent>
            </Dialog>
        );
    }

    // --- Success UI ---
    if (mode === "success") {
        return (
            <SuccessDialog
                open={open}
                onClose={handleCloseSuccess}
            />
        );
    }

    // --- Form UI ---
    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="w-[calc(100%-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto p-6">
                <DialogHeader>
                    <DialogTitle>退勤登録</DialogTitle>
                    <DialogDescription>本日の業務報告を入力してください</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div>
                        <Label className="text-base">実施タスクと実工数</Label>
                        <div className="space-y-3 mt-3">
                            {actualTasks.map((task, index) => (
                                <div key={index} className="flex gap-2 items-start">
                                    <div className="flex-1">
                                        <Input
                                            placeholder="タスク名"
                                            value={task.task}
                                            onChange={(e) => {
                                                const newList = [...actualTasks];
                                                newList[index].task = e.target.value;
                                                setActualTasks(newList);
                                            }}
                                        />
                                    </div>
                                    <div className="w-24">
                                        <div className="relative">
                                            <Input
                                                placeholder="1"
                                                value={task.hours}
                                                onChange={(e) => {
                                                    const newList = [...actualTasks];
                                                    newList[index].hours = e.target.value;
                                                    setActualTasks(newList);
                                                }}
                                                className="pr-8"
                                            />
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">h</span>
                                        </div>
                                    </div>
                                    {actualTasks.length > 1 && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() =>
                                                setActualTasks(actualTasks.filter((_, i) => i !== index))
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
                                onClick={() => setActualTasks([...actualTasks, { task: "", hours: "" }])}
                                className="w-full"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                タスクを追加
                            </Button>
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="summary">本日のまとめ（感想・気づき）</Label>
                        <Textarea
                            id="summary"
                            placeholder="本日の業務についての感想や気づきを入力..."
                            value={summary}
                            onChange={(e) => setSummary(e.target.value)}
                            className="mt-2 min-h-24"
                        />
                    </div>

                    <div>
                        <Label htmlFor="issues">困っていること・相談したいこと</Label>
                        <Textarea
                            id="issues"
                            placeholder="困っていることや相談したいことがあれば入力..."
                            value={issues}
                            onChange={(e) => setIssues(e.target.value)}
                            className="mt-2 min-h-24"
                        />
                    </div>

                    <div>
                        <Label htmlFor="notes">連絡事項</Label>
                        <Textarea
                            id="notes"
                            placeholder="連絡事項があれば入力..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="mt-2 min-h-24"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button onClick={handleSubmit}>送信</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};