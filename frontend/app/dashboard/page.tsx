// frontend/app/dashboard/page.tsx
"use client";

import { WeeklyAlert } from "./components/WeeklyAlert";
import { ClockCard } from "./components/ClockCard";
import { PunchButtons } from "./components/PunchButtons";
import { SessionList } from "./components/SessionList";
import { SummaryCard } from "./components/SummaryCard";
import { BreakDialog } from "./components/BreakDialog";
import { ClockInDialog } from "./components/ClockInDialog";
import { ClockOutDialog } from "./components/ClockOutDialog";

import { useAttendance } from "./hooks/useAttendance";
import { useClockDialogs } from "./hooks/useClockDialogs";

export default function Page() {
  const {
    attendance,
    currentSession,
    onBreak,
    weekTotalMs,
    handleClockIn,
    handleClockOut,
    handleBreakStart,
    handleBreakEnd,
  } = useAttendance();

  const {
    showClockInDialog,
    showClockOutDialog,
    showBreakDialog,
    breakMode,
    openClockIn,
    openClockOut,
    openBreakStart,
    openBreakEnd,
    closeDialogs,
  } = useClockDialogs();

  const isWorking = currentSession !== null;
  const sessionCount = attendance?.sessions?.length ?? 0;

  return (
    <div className="space-y-6">
      <ClockCard />

      <PunchButtons
        onClockIn={openClockIn}
        onClockOut={openClockOut}
        onBreakStart={openBreakStart}
        onBreakEnd={openBreakEnd}
        onBreak={onBreak}
        isWorking={isWorking}
        sessionCount={sessionCount}
      />

      <SummaryCard attendance={attendance} />

      <SessionList
        attendance={attendance}
        currentSession={currentSession}
        onBreak={onBreak}
      />

      <WeeklyAlert weeklyMs={weekTotalMs} />

      {/* dialogs */}
      <ClockInDialog open={showClockInDialog} onClose={closeDialogs} onSubmit={handleClockIn} />

      <ClockOutDialog open={showClockOutDialog} onClose={closeDialogs} onSubmit={handleClockOut} sessionNo={sessionCount || 1} />

      <BreakDialog
        open={showBreakDialog}
        mode={breakMode}
        onClose={closeDialogs}
        // ✅ props名を合わせる
        onStart={handleBreakStart}
        onEnd={handleBreakEnd}
      />
    </div>
  );
}
