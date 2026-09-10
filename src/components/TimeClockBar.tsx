import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Square, 
  Coffee, 
  Clock, 
  FileSpreadsheet, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  PauseCircle, 
  Users, 
  ShieldCheck,
  ChevronRight,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { StaffUser, TimeCardShift, Job } from '../types';
import { isStaffExemptFromClock } from '../data/mockData';
import { 
  calculateShiftWorkSeconds, 
  calculateShiftBreakSeconds, 
  formatTimeOnly, 
  formatMinutesToReadable,
  exportSingleEmployeeTimeCardCSV,
  exportTeamTimeCardsSummaryCSV,
  getEmployeeWeeklySummary,
  getLocalDateString,
  getWeekDateRangeLabel
} from '../utils/timeCardExport';
import { formatSecondsToHHMMSS } from '../utils/timeUtils';

interface TimeClockBarProps {
  currentStaff: StaffUser;
  staffList: StaffUser[];
  timeCards: TimeCardShift[];
  jobs: Job[];
  onClockIn: (notes?: string) => void;
  onStartBreak: () => void;
  onResumeFromBreak: () => void;
  onClockOut: (notes?: string) => void;
  onOpenTimeCardModal: (initialStaffId?: string) => void;
  pausedJobsNotice?: { jobNumbers: string[]; type: 'paused' | 'resumed' | 'clock_out_stopped' } | null;
  onClearPausedNotice?: () => void;
}

export const TimeClockBar: React.FC<TimeClockBarProps> = ({
  currentStaff,
  staffList,
  timeCards,
  jobs,
  onClockIn,
  onStartBreak,
  onResumeFromBreak,
  onClockOut,
  onOpenTimeCardModal,
  pausedJobsNotice,
  onClearPausedNotice
}) => {
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [confirmClockOut, setConfirmClockOut] = useState(false);

  // Live second ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const isJason = isStaffExemptFromClock(currentStaff);
  const todayStr = getLocalDateString(new Date(nowMs));

  // Find active shift for current staff (regardless of date in case shift crossed midnight)
  const staffShifts = timeCards.filter(s => s.staffId === currentStaff.id);
  const activeShift = staffShifts.find(s => 
    s.status === 'clocked_in' || s.status === 'on_break'
  );
  const todayCompletedShifts = staffShifts.filter(s => s.date === todayStr && s.status === 'clocked_out');

  // Compute shift status
  const currentStatus = activeShift ? activeShift.status : 'clocked_out';

  // Calculate live work duration & break duration
  const activeShiftWorkSec = activeShift ? calculateShiftWorkSeconds(activeShift, nowMs) : 0;
  const activeShiftBreakSec = activeShift ? calculateShiftBreakSeconds(activeShift, nowMs) : 0;

  // Active break interval (if currently on break)
  const currentOpenBreak = activeShift?.breaks.find(b => !b.endTime);
  const currentBreakElapsedSec = currentOpenBreak 
    ? Math.max(0, Math.floor((nowMs - new Date(currentOpenBreak.startTime).getTime()) / 1000))
    : 0;

  // Today's total work seconds
  const todayWorkSec = todayCompletedShifts.reduce((sum, s) => sum + (s.totalWorkSeconds || 0), 0) + activeShiftWorkSec;
  const todayBreakSec = todayCompletedShifts.reduce((sum, s) => sum + (s.totalBreakSeconds || 0), 0) + activeShiftBreakSec;

  // Weekly stats
  const weeklySummary = getEmployeeWeeklySummary(currentStaff, timeCards, jobs, nowMs);

  // Team summary counts for manager/Jason view
  const teamClockedIn = timeCards.filter(s => s.status === 'clocked_in').length;
  const teamOnBreak = timeCards.filter(s => s.status === 'on_break').length;
  const teamActiveCount = teamClockedIn + teamOnBreak;

  // Check if current user has any active project timer running on jobs
  const curName = currentStaff.name.toLowerCase();
  const userRunningJobTimer = jobs.find(j => {
    if (!j.active_timer_start) return false;
    if (j.active_timer_drafter_id === currentStaff.id) return true;
    if (j.active_timer_drafter_name && j.active_timer_drafter_name.toLowerCase() === curName) return true;
    const assigned = (j.assigned_drafter || '').toLowerCase();
    return assigned.includes(curName) || curName.includes(assigned.split(',')[0].trim());
  });

  // Check if current user has any job timer paused on break
  const userPausedJobTimer = jobs.find(j => {
    if (!j.paused_by_break) return false;
    if (j.paused_timer_drafter_id === currentStaff.id) return true;
    if (j.paused_timer_drafter_name && j.paused_timer_drafter_name.toLowerCase() === curName) return true;
    const assigned = (j.assigned_drafter || '').toLowerCase();
    return assigned.includes(curName) || curName.includes(assigned.split(',')[0].trim());
  });

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2 font-sans">
      {/* Toast Notice for Project Timers Auto-Paused / Resumed on Break / Stopped on Clock Out */}
      {pausedJobsNotice && (
        <div className={`mb-3 p-3 rounded-xl border flex items-center justify-between text-xs font-medium animate-fadeIn ${
          pausedJobsNotice.type === 'paused'
            ? 'bg-amber-50 border-amber-300 text-amber-900'
            : pausedJobsNotice.type === 'clock_out_stopped'
            ? 'bg-blue-50 border-blue-300 text-blue-950'
            : 'bg-emerald-50 border-emerald-300 text-emerald-900'
        }`}>
          <div className="flex items-center gap-2.5">
            {pausedJobsNotice.type === 'paused' ? (
              <PauseCircle className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" />
            ) : pausedJobsNotice.type === 'clock_out_stopped' ? (
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span>
              {pausedJobsNotice.type === 'paused' ? (
                <>
                  <strong>Project Timer Auto-Paused:</strong> Running timer on plan(s){' '}
                  <span className="font-mono font-bold underline">{pausedJobsNotice.jobNumbers.join(', ')}</span> was automatically paused while you are on break.
                </>
              ) : pausedJobsNotice.type === 'clock_out_stopped' ? (
                <>
                  <strong>Shift Ended & Clocked Out:</strong> Active drafting timer on plan(s){' '}
                  <span className="font-mono font-bold underline">{pausedJobsNotice.jobNumbers.join(', ')}</span> was automatically stopped & saved to job history.
                </>
              ) : (
                <>
                  <strong>Welcome Back:</strong> Project timer on plan(s){' '}
                  <span className="font-mono font-bold underline">{pausedJobsNotice.jobNumbers.join(', ')}</span> has automatically resumed!
                </>
              )}
            </span>
          </div>
          {onClearPausedNotice && (
            <button
              onClick={onClearPausedNotice}
              className="text-slate-500 hover:text-slate-800 ml-4 text-[11px] underline"
            >
              Dismiss
            </button>
          )}
        </div>
      )}

      {/* Main Time Clock Strip Container */}
      <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-md p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        
        {/* Left: Punch Status & Live Ticker / Jason Exemption Info */}
        {isJason ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2.5 bg-slate-800/90 border border-slate-700/80 px-3 py-2 rounded-xl">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-400"></div>
              <div>
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Operations Manager
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">Salaried Exempt (No Punch Required)</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-300">
              <div className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  Team Active: <strong className="text-emerald-400">{teamClockedIn} Clocked In</strong>
                  {teamOnBreak > 0 && <span className="text-amber-400 ml-1">({teamOnBreak} on break)</span>}
                </span>
              </div>
              <span className="text-slate-500 hidden sm:inline">•</span>
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                Track and export all employee time cards below
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            
            {/* Status Pulse Badge */}
            <div className="flex items-center gap-3">
              <div className={`px-3 py-2 rounded-xl border flex items-center gap-2.5 ${
                currentStatus === 'clocked_in' 
                  ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300' 
                  : currentStatus === 'on_break'
                  ? 'bg-amber-950/80 border-amber-500/40 text-amber-300'
                  : 'bg-slate-800/90 border-slate-700 text-slate-300'
              }`}>
                <div className={`w-2.5 h-2.5 rounded-full ${
                  currentStatus === 'clocked_in'
                    ? 'bg-emerald-400 animate-pulse'
                    : currentStatus === 'on_break'
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-slate-500'
                }`} />
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                    {currentStatus === 'clocked_in' && 'Clocked In'}
                    {currentStatus === 'on_break' && 'On Break'}
                    {currentStatus === 'clocked_out' && 'Clocked Out'}
                  </div>
                  <div className="text-[11px] opacity-80 flex items-center gap-1.5">
                    <span>
                      {activeShift 
                        ? `Since ${formatTimeOnly(currentStatus === 'on_break' && currentOpenBreak ? currentOpenBreak.startTime : activeShift.clockInTime, true)}`
                        : 'Shift not started'}
                    </span>
                    <span className="text-[9px] bg-slate-700/80 text-blue-300 font-mono px-1 py-0.5 rounded">Arkansas (CT)</span>
                  </div>
                </div>
              </div>

              {/* Live Ticker Clock */}
              {activeShift && (
                <div className="bg-slate-800/80 border border-slate-700/80 px-3 py-1.5 rounded-xl flex flex-col justify-center">
                  <span className="text-[10px] uppercase font-semibold text-slate-400">
                    {currentStatus === 'on_break' ? 'Break Elapsed' : 'Active Shift Elapsed'}
                  </span>
                  <span className={`text-base font-mono font-bold tracking-tight ${
                    currentStatus === 'on_break' ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    {currentStatus === 'on_break' 
                      ? formatSecondsToHHMMSS(currentBreakElapsedSec)
                      : formatSecondsToHHMMSS(activeShiftWorkSec)}
                  </span>
                </div>
              )}
            </div>

            {/* Quick Shift Accumulators */}
            <div className="flex items-center gap-2 text-xs">
              <div className="bg-slate-800/50 border border-slate-700/50 px-2.5 py-1.5 rounded-lg text-slate-300">
                <span className="text-slate-400 text-[11px]">Today: </span>
                <strong className="text-white font-mono">{formatMinutesToReadable(todayWorkSec / 60)}</strong>
                {todayBreakSec > 0 && (
                  <span className="text-amber-400 text-[10px] ml-1 font-mono">({Math.round(todayBreakSec / 60)}m brk)</span>
                )}
              </div>

              <div className="bg-slate-800/50 border border-slate-700/50 px-2.5 py-1.5 rounded-lg text-slate-300">
                <span className="text-slate-400 text-[11px]">This Week: </span>
                <strong className="text-white font-mono">{weeklySummary.totalShiftHours.toFixed(1)} hrs</strong>
              </div>

              {userRunningJobTimer && (
                <div className="bg-blue-950/60 border border-blue-600/40 text-blue-300 px-2.5 py-1 rounded-lg text-[11px] flex items-center gap-1.5 animate-pulse">
                  <Clock className="w-3 h-3 text-blue-400 animate-spin" />
                  <span>Drafting Timer: <strong>{userRunningJobTimer.job_number}</strong></span>
                </div>
              )}

              {userPausedJobTimer && currentStatus === 'on_break' && (
                <div className="bg-amber-950/60 border border-amber-500/50 text-amber-300 px-2.5 py-1 rounded-lg text-[11px] flex items-center gap-1.5">
                  <Coffee className="w-3 h-3 text-amber-400" />
                  <span>Paused Timer: <strong>{userPausedJobTimer.job_number}</strong> (Resumes on return)</span>
                </div>
              )}
            </div>

          </div>
        )}

        {/* Right: Actions (Clock In, Break, Clock Out, Time Card Modal, CSV) */}
        <div className="flex flex-wrap items-center gap-2.5">
          
          {isJason ? (
            /* Jason Operations Manager Actions */
            <>
              <button
                onClick={() => onOpenTimeCardModal()}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Team Time Cards & Hours</span>
              </button>

              <button
                onClick={() => exportTeamTimeCardsSummaryCSV(staffList, timeCards, jobs)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                title="Export company-wide employee time cards to CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Export All Time Cards (CSV)</span>
              </button>
            </>
          ) : (
            /* Standard Employee Actions */
            <>
              {/* CLOCK IN BUTTON */}
              {currentStatus === 'clocked_out' && (
                <button
                  onClick={() => onClockIn()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer hover:scale-[1.02]"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Clock In</span>
                </button>
              )}

              {/* START BREAK BUTTON */}
              {currentStatus === 'clocked_in' && (
                <button
                  onClick={onStartBreak}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                  title="Pause shift and any active project timers for break"
                >
                  <Coffee className="w-3.5 h-3.5" />
                  <span>Start Break</span>
                </button>
              )}

              {/* RETURN FROM BREAK BUTTON */}
              {currentStatus === 'on_break' && (
                <button
                  onClick={onResumeFromBreak}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer animate-pulse"
                  title="Return from break and resume shift and project timers"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Return From Break</span>
                </button>
              )}

              {/* CLOCK OUT BUTTON */}
              {currentStatus !== 'clocked_out' && (
                confirmClockOut ? (
                  <div className="flex items-center gap-1.5 bg-rose-950 border border-rose-600 px-2 py-1 rounded-xl animate-fadeIn">
                    <span className="text-[11px] text-rose-300 font-semibold">
                      {userRunningJobTimer ? `Stop MPS #${userRunningJobTimer.job_number} & Clock Out?` : 'End Shift?'}
                    </span>
                    <button
                      onClick={() => {
                        setConfirmClockOut(false);
                        onClockOut();
                      }}
                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Yes, Clock Out
                    </button>
                    <button
                      onClick={() => setConfirmClockOut(false)}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmClockOut(true)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-rose-600/90 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
                    title="Finish work and clock out"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>Clock Out</span>
                  </button>
                )
              )}

              {/* TIME CARD MODAL TRIGGER */}
              <button
                onClick={() => onOpenTimeCardModal(currentStaff.id)}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
                title="View full time card history and shift breakdowns"
              >
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                <span>My Time Card</span>
              </button>

              {/* QUICK CSV EXPORT */}
              <button
                onClick={() => exportSingleEmployeeTimeCardCSV(currentStaff, timeCards, jobs)}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-emerald-600/90 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
                title="Export personal time card to CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>
            </>
          )}

        </div>

      </div>
    </div>
  );
};
