"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Coffee, LogOut, LogIn, Pause, Play, RotateCcw, CheckCircle } from "lucide-react";

interface Props {
    onClockIn: () => void;
    onResume: () => void;
    onStopOrClockOut: () => void;

    onBreakStart: () => void;
    onBreakEnd: () => void;

    onBreak: boolean;
    isWorking: boolean;
    hasPreviousSession: boolean;
    isClockedOut: boolean;
}

export function PunchButtons({
    onClockIn,
    onResume,
    onStopOrClockOut,
    onBreakStart,
    onBreakEnd,
    onBreak,
    isWorking,
    hasPreviousSession,
    isClockedOut,
}: Props) {
    // 中断済み（再出勤待ち）状態
    const isResumeMode = !isWorking && hasPreviousSession;

    return (
        <div className="space-y-4">
            {/* 状態バッジ - 上部に配置 */}
            <div className="flex justify-center">
                {isClockedOut && (
                    <Badge variant="outline" className="px-4 py-2 text-sm border-green-500 text-green-600">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        退勤済み
                    </Badge>
                )}
                {!isClockedOut && !isWorking && !onBreak && !hasPreviousSession && (
                    <Badge variant="outline" className="px-4 py-2 text-sm">
                        <Clock className="h-4 w-4 mr-2" />
                        未出勤
                    </Badge>
                )}
                {!isClockedOut && isResumeMode && (
                    <Badge variant="outline" className="px-4 py-2 text-sm border-amber-500 text-amber-600">
                        <Pause className="h-4 w-4 mr-2" />
                        中断中
                    </Badge>
                )}
                {!isClockedOut && isWorking && !onBreak && (
                    <Badge variant="default" className="px-4 py-2 text-sm">
                        <Clock className="h-4 w-4 mr-2" />
                        出勤中
                    </Badge>
                )}
                {!isClockedOut && onBreak && (
                    <Badge variant="secondary" className="px-4 py-2 text-sm">
                        <Pause className="h-4 w-4 mr-2" />
                        休憩中
                    </Badge>
                )}
            </div>

            {/* ボタンエリア */}
            <div className="space-y-4">
                {/* 1行目: 出勤/再出勤・退勤ボタン - 中央配置 */}
                <div className="flex justify-center gap-4">
                    {/* 出勤/再出勤ボタン */}
                    {isResumeMode && !isClockedOut ? (
                        <Button
                            onClick={onResume}
                            size="lg"
                            className="h-24 flex-col gap-2 w-[400px] text-xl font-semibold bg-emerald-600 text-white hover:bg-emerald-700"
                        >
                            <RotateCcw className="h-12 w-12" />
                            再出勤
                        </Button>
                    ) : (
                        <Button
                            onClick={onClockIn}
                            disabled={isWorking || isClockedOut}
                            size="lg"
                            className={`h-24 flex-col gap-2 w-[400px] text-xl font-semibold ${!isWorking && !onBreak && !isClockedOut
                                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                : "bg-gray-300 text-gray-500"
                                }`}
                        >
                            <LogIn className="h-12 w-12" />
                            出勤
                        </Button>
                    )}

                    {/* 中断・退勤ボタン → 選択ダイアログ表示 */}
                    <Button
                        onClick={onStopOrClockOut}
                        disabled={!isWorking || onBreak || isResumeMode || isClockedOut}
                        size="lg"
                        className={`h-24 flex-col gap-2 w-[400px] text-xl font-semibold ${isWorking && !onBreak && !isClockedOut
                            ? "bg-red-500 text-white hover:bg-red-600"
                            : "bg-gray-200 text-gray-400"
                            }`}
                    >
                        <LogOut className="h-12 w-12" />
                        中断・退勤
                    </Button>
                </div>

                {/* 2行目: 休憩ボタン（中央配置） */}
                <div className="flex justify-center">
                    {/* 休憩開始・終了 */}
                    {!onBreak ? (
                        <Button
                            onClick={() => onBreakStart()}
                            disabled={!isWorking || isResumeMode || isClockedOut}
                            size="lg"
                            className={`h-24 flex-col gap-2 w-[400px] text-xl font-semibold ${isWorking && !isResumeMode && !isClockedOut
                                ? "bg-gray-900 text-white hover:bg-gray-800"
                                : "bg-gray-200 text-gray-400"
                                }`}
                        >
                            <Coffee className="h-12 w-12" />
                            休憩開始
                        </Button>
                    ) : (
                        <Button
                            onClick={() => onBreakEnd()}
                            disabled={isClockedOut}
                            size="lg"
                            className={`h-24 flex-col gap-2 w-[400px] text-xl font-semibold ${!isClockedOut
                                ? "bg-gray-900 text-white hover:bg-gray-800"
                                : "bg-gray-200 text-gray-400"
                                }`}
                        >
                            <Play className="h-12 w-12" />
                            休憩終了
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}