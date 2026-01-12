import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { AttendanceRecord } from "../../../../shared/types/Attendance";
import { SessionItem } from "./SessionItem";
import { formatDurationMs } from "@/lib/time";
import { calculateDayWorkHours } from "@/lib/calculation";

interface Props {
    selectedDate: Date | undefined;
    selectedDayData: AttendanceRecord | null;
}

export function DayDetailCard({
    selectedDate,
    selectedDayData,
}: Props) {
    return (
        <Card className="h-full flex flex-col">
            <CardHeader>
                <CardTitle>詳細情報</CardTitle>
                <CardDescription>
                    {selectedDate?.toLocaleDateString("ja-JP", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        weekday: "long",
                    })}
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 flex-1">
                {selectedDayData ? (
                    <>
                        <div className="flex justify-between items-center pb-2 border-b">
                            <span>総勤務時間</span>
                            <span className="text-xl">
                                {formatDurationMs(calculateDayWorkHours(selectedDayData.sessions))}
                            </span>
                        </div>

                        <div className="pt-2">
                            <SessionItem sessions={selectedDayData.sessions} />
                        </div>
                    </>
                ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                        この日の勤怠データはありません
                    </p>
                )}
            </CardContent>
        </Card>
    );
}