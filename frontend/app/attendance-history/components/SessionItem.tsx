import { WorkSession } from "../../../../shared/types/Attendance";
import { formatClockTime } from "@/lib/time";

interface Props {
    sessions: WorkSession[];
}

export function SessionItem({ sessions }: Props) {
    if (sessions.length === 0) return null;

    // セッションを時刻順にソート
    const sortedSessions = [...sessions].sort(
        (a, b) => (a.clockIn ?? 0) - (b.clockIn ?? 0)
    );

    // 最初の出勤と最後の退勤
    const firstClockIn = sortedSessions[0].clockIn;
    const lastClockOut = sortedSessions[sortedSessions.length - 1].clockOut;

    // 全ての休憩を集約
    const allBreaks = sortedSessions.flatMap((s) => s.breaks);

    // 中断・再開のペアを作成（2つ以上のセッションがある場合）
    const interruptions: { stop: number | undefined; resume: number | undefined }[] = [];
    for (let i = 0; i < sortedSessions.length - 1; i++) {
        interruptions.push({
            stop: sortedSessions[i].clockOut,
            resume: sortedSessions[i + 1].clockIn,
        });
    }

    return (
        <div className="bg-muted/30 rounded-lg p-3 space-y-2">
            <div className="space-y-1">
                {/* 出勤 */}
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">出勤</span>
                    <span className="text-lg">{formatClockTime(firstClockIn)}</span>
                </div>

                {/* 退勤 */}
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">退勤</span>
                    <span className="text-lg">{formatClockTime(lastClockOut)}</span>
                </div>

                {/* 中断回数 */}
                {interruptions.length > 0 && (
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">中断</span>
                        <span>{interruptions.length}回</span>
                    </div>
                )}

                {/* 休憩回数 */}
                {allBreaks.length > 0 && (
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">休憩</span>
                        <span>{allBreaks.length}回</span>
                    </div>
                )}
            </div>

            {/* 中断詳細 */}
            {interruptions.length > 0 && (
                <div className="pt-2 border-t space-y-1">
                    {interruptions.map((int, idx) => (
                        <div
                            key={idx}
                            className="flex justify-between text-xs text-muted-foreground"
                        >
                            <span>中断{idx + 1}</span>
                            <span>
                                {formatClockTime(int.stop)} - {formatClockTime(int.resume)}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* 休憩詳細 */}
            {allBreaks.length > 0 && (
                <div className={`space-y-1 ${interruptions.length > 0 ? "" : "pt-2 border-t"}`}>
                    {allBreaks.map((brk, brkIdx) => (
                        <div
                            key={brkIdx}
                            className="flex justify-between text-xs text-muted-foreground"
                        >
                            <span>休憩{brkIdx + 1}</span>
                            <span>
                                {formatClockTime(brk.start)} - {formatClockTime(brk.end)}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
