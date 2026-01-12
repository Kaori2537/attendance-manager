//dashbaord/hooks/useClockDialogs.ts
"use client";

import { useState } from "react";

export function useClockDialogs() {
    const [showClockInDialog, setClockIn] = useState(false);
    const [showClockOutDialog, setClockOut] = useState(false);
    const [showBreakDialog, setShowBreakDialog] = useState(false);
    const [breakMode, setBreakMode] = useState<"start" | "end">("start");
    // 中断・退勤選択ダイアログ
    const [showStopOrClockOutDialog, setStopOrClockOut] = useState(false);
    // 中断確認ダイアログ
    const [showStopConfirmDialog, setStopConfirm] = useState(false);
    // 再出勤ダイアログ
    const [showResumeDialog, setResume] = useState(false);

    return {
        showClockInDialog,
        showClockOutDialog,
        showBreakDialog,
        breakMode,
        showStopOrClockOutDialog,
        showStopConfirmDialog,
        showResumeDialog,
        openClockIn: () => setClockIn(true),
        openResume: () => setResume(true),
        // 「中断・退勤」ボタンを押したときは選択ダイアログを開く
        openStopOrClockOut: () => setStopOrClockOut(true),
        // 選択ダイアログから「退勤」を選んだ場合
        openClockOut: () => {
            setStopOrClockOut(false);
            setClockOut(true);
        },
        // 選択ダイアログから「中断」を選んだ場合
        openStopConfirm: () => {
            setStopOrClockOut(false);
            setStopConfirm(true);
        },
        openBreakStart: () => {
            setBreakMode("start");
            setShowBreakDialog(true);
        },
        openBreakEnd: () => {
            setBreakMode("end");
            setShowBreakDialog(true);
        },
        closeDialogs: () => {
            setClockIn(false);
            setClockOut(false);
            setShowBreakDialog(false);
            setStopOrClockOut(false);
            setStopConfirm(false);
            setResume(false);
        },
    };
}