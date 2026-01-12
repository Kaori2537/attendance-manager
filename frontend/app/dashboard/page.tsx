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
import { StopOrClockOutDialog } from "./components/StopOrClockOutDialog";
import { StopConfirmDialog } from "./components/StopConfirmDialog";
import { ResumeDialog } from "./components/ResumeDialog";

import { useAttendance } from "./hooks/useAttendance";
import { useClockDialogs } from "./hooks/useClockDialogs";

export default function Page() {
  const {
    attendance,
    currentSession,
    onBreak,
    hasPreviousSession,
    isClockedOut,
    weekTotalMs,
    handleClockIn,
    handleResume,
    handleClockOut,
    handleStop,
    handleBreakStart,
    handleBreakEnd,
  } = useAttendance();

  const {
    showClockInDialog,
    showClockOutDialog,
    showBreakDialog,
    breakMode,
    showStopOrClockOutDialog,
    showStopConfirmDialog,
    showResumeDialog,
    openClockIn,
    openResume,
    openStopOrClockOut,
    openClockOut,
    openStopConfirm,
    openBreakStart,
    openBreakEnd,
    closeDialogs,
  } = useClockDialogs();

  const isWorking = currentSession !== null;

  return (
    <div className="space-y-6">
      <ClockCard />

      <PunchButtons
        onClockIn={openClockIn}
        onResume={openResume}
        onStopOrClockOut={openStopOrClockOut}
        onBreakStart={openBreakStart}
        onBreakEnd={openBreakEnd}
        onBreak={onBreak}
        isWorking={isWorking}
        hasPreviousSession={hasPreviousSession}
        isClockedOut={isClockedOut}
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

      <ClockOutDialog open={showClockOutDialog} onClose={closeDialogs} onSubmit={handleClockOut} sessionNo={1} />

      <BreakDialog
        open={showBreakDialog}
        mode={breakMode}
        onClose={closeDialogs}
        onStart={handleBreakStart}
        onEnd={handleBreakEnd}
      />

      {/* 中断・退勤選択ダイアログ */}
      <StopOrClockOutDialog
        open={showStopOrClockOutDialog}
        onClose={closeDialogs}
        onSelectStop={openStopConfirm}
        onSelectClockOut={openClockOut}
      />

      {/* 中断確認ダイアログ */}
      <StopConfirmDialog
        open={showStopConfirmDialog}
        onClose={closeDialogs}
        onConfirm={handleStop}
      />

      {/* 再出勤ダイアログ */}
      <ResumeDialog
        open={showResumeDialog}
        onClose={closeDialogs}
        onSubmit={handleResume}
      />
    </div>
  );
}
