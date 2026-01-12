"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/Loader";
import { SuccessDialog } from "@/components/SuccessDialog";

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
    onEnd: () => Promise<void>;
}) => {
    const [status, setStatus] = useState<"form" | "loading" | "success">("form");

    const handleSubmit = async () => {
        try {
            setStatus("loading");
            if (mode === "start") {
                await onStart();
            } else {
                await onEnd();
            }
            setStatus("success");
        } catch (e) {
            console.error(e);
            setStatus("form");
        }
    };

    const handleCloseSuccess = () => {
        setStatus("form");
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

    // 休憩終了ダイアログ（シンプルな確認のみ）
    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>休憩を終了しますか？</DialogTitle>
                </DialogHeader>
                <DialogFooter>
                    <Button onClick={handleSubmit}>作業再開</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
