import { TimeCardShift, StaffUser, Job, EmployeeWeeklySummary, TimeCardBreak } from '../types';

/**
 * Returns a date formatted as YYYY-MM-DD in local time (prevents UTC timezone date jumps)
 */
export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns Monday 00:00:00 of the week containing the given date
 */
export function getStartOfWeek(d: Date = new Date()): Date {
  const date = new Date(d);
  const day = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const diff = date.getDate() - (day === 0 ? 6 : day - 1);
  const monday = new Date(date);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/**
 * Returns Sunday 23:59:59.999 of the week containing the given date
 */
export function getEndOfWeek(d: Date = new Date()): Date {
  const monday = getStartOfWeek(d);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}

/**
 * Returns true if the YYYY-MM-DD date string falls inside the [weekStart, weekEnd] range
 */
export function isDateInWeek(dateStr: string, weekStart: Date, weekEnd: Date): boolean {
  if (!dateStr) return false;
  const parts = dateStr.split('-').map(Number);
  if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) return false;
  // Local noon to avoid DST or midnight edge crossings
  const shiftDate = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
  return shiftDate.getTime() >= weekStart.getTime() && shiftDate.getTime() <= weekEnd.getTime();
}

/**
 * Format date range e.g. "Sep 7 – Sep 13, 2026"
 */
export function getWeekDateRangeLabel(targetDate: Date = new Date()): string {
  const start = getStartOfWeek(targetDate);
  const end = getEndOfWeek(targetDate);
  const sMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const sDay = start.getDate();
  const eMonth = end.toLocaleDateString('en-US', { month: 'short' });
  const eDay = end.getDate();
  const year = end.getFullYear();
  if (sMonth === eMonth) {
    return `${sMonth} ${sDay} – ${eDay}, ${year}`;
  }
  return `${sMonth} ${sDay} – ${eMonth} ${eDay}, ${year}`;
}

/**
 * Format ISO date string into standard time "8:30 AM"
 */
export function formatTimeOnly(isoString?: string): string {
  if (!isoString) return '--:--';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return '--:--';
  }
}

/**
 * Format ISO date string into standard short date "Aug 26, 2026"
 */
export function formatDateOnly(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    if (!year || !month || !day) return dateStr;
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format minutes into readable hours & mins
 */
export function formatMinutesToReadable(totalMinutes: number): string {
  if (!totalMinutes || totalMinutes <= 0) return '0h 0m';
  const hrs = Math.floor(totalMinutes / 60);
  const mins = Math.round(totalMinutes % 60);
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

/**
 * Calculate total work seconds for a shift (excluding breaks).
 * - For completed shifts with recorded totalWorkSeconds, uses recorded value.
 * - For active shifts, protects against runaway timers (caps past-day or >16h shifts).
 */
export function calculateShiftWorkSeconds(shift: TimeCardShift, nowMs: number = Date.now()): number {
  if (!shift.clockInTime) return 0;

  // If already clocked out with a valid recorded total, use it directly
  if (shift.status === 'clocked_out' && typeof shift.totalWorkSeconds === 'number' && shift.totalWorkSeconds >= 0 && shift.clockOutTime) {
    return shift.totalWorkSeconds;
  }

  const startMs = new Date(shift.clockInTime).getTime();
  if (isNaN(startMs)) return 0;

  let endMs: number;
  if (shift.clockOutTime) {
    endMs = new Date(shift.clockOutTime).getTime();
  } else {
    // Active shift (clocked_in or on_break)
    const elapsedMs = Math.max(0, nowMs - startMs);
    // Anti-runaway protection: If shift started over 16 hours ago or on a prior day without clocking out,
    // cap at standard 8-hour shift (28,800 sec) so it never blows out to 300+ hours!
    const maxShiftMs = 16 * 3600 * 1000;
    if (elapsedMs > maxShiftMs) {
      endMs = startMs + (8 * 3600 * 1000);
    } else {
      endMs = nowMs;
    }
  }

  const grossSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000));
  const breakSeconds = calculateShiftBreakSeconds(shift, nowMs);

  return Math.max(0, grossSeconds - breakSeconds);
}

/**
 * Calculate total break seconds for a shift.
 * If currently on break, includes live break time (with safety ceiling).
 */
export function calculateShiftBreakSeconds(shift: TimeCardBreak[] | TimeCardShift, nowMs: number = Date.now()): number {
  const breaks: TimeCardBreak[] = Array.isArray(shift) ? shift : (shift.breaks || []);
  const isShiftOnBreak = !Array.isArray(shift) && shift.status === 'on_break';

  if (!breaks || breaks.length === 0) return 0;

  return breaks.reduce((sum, b) => {
    if (!b.startTime) return sum;
    if (b.endTime && typeof b.durationSeconds === 'number' && b.durationSeconds >= 0) {
      return sum + b.durationSeconds;
    }
    const startMs = new Date(b.startTime).getTime();
    if (isNaN(startMs)) return sum;

    let endMs: number;
    if (b.endTime) {
      endMs = new Date(b.endTime).getTime();
    } else if (isShiftOnBreak) {
      // Break currently in progress: cap runaway breaks at 2 hours
      const elapsedBreak = Math.max(0, nowMs - startMs);
      endMs = elapsedBreak > 4 * 3600 * 1000 ? startMs + (1800 * 1000) : nowMs;
    } else {
      endMs = startMs;
    }

    const duration = Math.max(0, Math.floor((endMs - startMs) / 1000));
    return sum + duration;
  }, 0);
}

/**
 * Calculate project hours logged by this staff member on jobs within a specific week
 */
export function calculateEmployeeProjectSecondsInWeek(
  staffName: string, 
  jobs: Job[], 
  weekStart: Date, 
  weekEnd: Date
): number {
  const staffLower = staffName.toLowerCase();
  let totalSeconds = 0;

  jobs.forEach(job => {
    (job.time_logs || []).forEach(log => {
      const logDrafter = (log.drafterName || '').toLowerCase();
      if (logDrafter.includes(staffLower) || staffLower.includes(logDrafter)) {
        if (log.startTime) {
          const logDate = new Date(log.startTime);
          if (logDate.getTime() >= weekStart.getTime() && logDate.getTime() <= weekEnd.getTime()) {
            totalSeconds += log.durationSeconds || 0;
          }
        }
      }
    });
  });

  return totalSeconds;
}

/**
 * Calculate all-time project hours logged by this staff member on jobs
 */
export function calculateEmployeeProjectSeconds(staffName: string, jobs: Job[]): number {
  const staffLower = staffName.toLowerCase();
  let totalSeconds = 0;

  jobs.forEach(job => {
    (job.time_logs || []).forEach(log => {
      const logDrafter = (log.drafterName || '').toLowerCase();
      if (logDrafter.includes(staffLower) || staffLower.includes(logDrafter)) {
        totalSeconds += log.durationSeconds || 0;
      }
    });
  });

  return totalSeconds;
}

/**
 * Generate weekly summary for an employee for a specific week (defaults to CURRENT calendar week)
 */
export function getEmployeeWeeklySummary(
  staff: StaffUser,
  allShifts: TimeCardShift[],
  jobs: Job[],
  nowMs: number = Date.now(),
  targetDate: Date = new Date(nowMs)
): EmployeeWeeklySummary {
  const weekStart = getStartOfWeek(targetDate);
  const weekEnd = getEndOfWeek(targetDate);

  // CRITICAL FIX: Filter shifts strictly to this employee AND within the specified week!
  const staffShifts = allShifts.filter(s => 
    s.staffId === staff.id && isDateInWeek(s.date, weekStart, weekEnd)
  );

  let totalWorkSec = 0;
  let totalBreakSec = 0;

  staffShifts.forEach(shift => {
    totalWorkSec += calculateShiftWorkSeconds(shift, nowMs);
    totalBreakSec += calculateShiftBreakSeconds(shift, nowMs);
  });

  const totalShiftHours = Math.round((totalWorkSec / 3600) * 100) / 100;
  const totalBreakHours = Math.round((totalBreakSec / 3600) * 100) / 100;
  const projectSec = calculateEmployeeProjectSecondsInWeek(staff.name, jobs, weekStart, weekEnd);
  const totalProjectHours = Math.round((projectSec / 3600) * 100) / 100;

  const regularHours = Math.min(40, totalShiftHours);
  const overtimeHours = Math.max(0, Math.round((totalShiftHours - 40) * 100) / 100);
  const rate = staff.hourlyRate || 75;
  const regularPay = regularHours * rate;
  const overtimePay = overtimeHours * (rate * 1.5);
  const estimatedGrossPay = Math.round((regularPay + overtimePay) * 100) / 100;

  return {
    staffId: staff.id,
    staffName: staff.name,
    title: staff.title,
    department: staff.department || 'Drafting',
    hourlyRate: rate,
    totalShiftHours,
    totalBreakHours,
    totalProjectHours,
    regularHours,
    overtimeHours,
    estimatedGrossPay,
    shifts: staffShifts
  };
}

/**
 * Generate all-time historical summary for an employee across all shifts ever recorded
 */
export function getEmployeeAllTimeSummary(
  staff: StaffUser,
  allShifts: TimeCardShift[],
  jobs: Job[],
  nowMs: number = Date.now()
): EmployeeWeeklySummary {
  const staffShifts = allShifts.filter(s => s.staffId === staff.id);

  let totalWorkSec = 0;
  let totalBreakSec = 0;

  staffShifts.forEach(shift => {
    totalWorkSec += calculateShiftWorkSeconds(shift, nowMs);
    totalBreakSec += calculateShiftBreakSeconds(shift, nowMs);
  });

  const totalShiftHours = Math.round((totalWorkSec / 3600) * 100) / 100;
  const totalBreakHours = Math.round((totalBreakSec / 3600) * 100) / 100;
  const projectSec = calculateEmployeeProjectSeconds(staff.name, jobs);
  const totalProjectHours = Math.round((projectSec / 3600) * 100) / 100;

  const regularHours = Math.min(40, totalShiftHours);
  const overtimeHours = Math.max(0, Math.round((totalShiftHours - 40) * 100) / 100);
  const rate = staff.hourlyRate || 75;
  const regularPay = regularHours * rate;
  const overtimePay = overtimeHours * (rate * 1.5);
  const estimatedGrossPay = Math.round((regularPay + overtimePay) * 100) / 100;

  return {
    staffId: staff.id,
    staffName: staff.name,
    title: staff.title,
    department: staff.department || 'Drafting',
    hourlyRate: rate,
    totalShiftHours,
    totalBreakHours,
    totalProjectHours,
    regularHours,
    overtimeHours,
    estimatedGrossPay,
    shifts: staffShifts
  };
}

export interface AvailableWeekOption {
  id: string;
  label: string;
  weekStart: Date;
  weekEnd: Date;
  isCurrent: boolean;
}

/**
 * Returns available weeks derived from shift records, with the current week always present and first.
 */
export function getAvailableWeeks(allShifts: TimeCardShift[] = []): AvailableWeekOption[] {
  const currentStart = getStartOfWeek(new Date());
  const weekMap = new Map<string, Date>();

  // Always include current week
  weekMap.set(getLocalDateString(currentStart), currentStart);

  // Add all shift dates
  allShifts.forEach(s => {
    if (s.date) {
      const parts = s.date.split('-').map(Number);
      if (parts[0] && parts[1] && parts[2]) {
        const d = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
        const start = getStartOfWeek(d);
        weekMap.set(getLocalDateString(start), start);
      }
    }
  });

  // Sort descending (most recent week first)
  const sortedStarts = Array.from(weekMap.values()).sort((a, b) => b.getTime() - a.getTime());

  return sortedStarts.map(start => {
    const end = getEndOfWeek(start);
    const isCurrent = start.getTime() === currentStart.getTime();
    const rangeLabel = getWeekDateRangeLabel(start);
    const label = isCurrent ? `Current Week (${rangeLabel})` : `Week of ${rangeLabel}`;
    return {
      id: getLocalDateString(start),
      label,
      weekStart: start,
      weekEnd: end,
      isCurrent
    };
  });
}

/**
 * Export Individual Employee Time Card to CSV
 */
export function exportSingleEmployeeTimeCardCSV(
  staff: StaffUser,
  allShifts: TimeCardShift[],
  jobs: Job[],
  weekStart?: Date,
  weekEnd?: Date,
  periodLabel?: string
) {
  let staffShifts = allShifts.filter(s => s.staffId === staff.id);

  if (weekStart && weekEnd) {
    staffShifts = staffShifts.filter(s => isDateInWeek(s.date, weekStart, weekEnd));
  }

  staffShifts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const rate = staff.hourlyRate || 75;
  const headers = [
    'Date',
    'Day',
    'Employee Name',
    'Job Title',
    'Department',
    'Status',
    'Clock In',
    'Breaks Detail',
    'Total Break (Minutes)',
    'Clock Out',
    'Shift Work (Hours)',
    'Hourly Rate ($)',
    'Estimated Gross Pay ($)',
    'Notes'
  ];

  let sumWorkHours = 0;
  let sumBreakMins = 0;
  let sumPay = 0;

  const rows = staffShifts.map(shift => {
    const workSec = calculateShiftWorkSeconds(shift);
    const breakSec = calculateShiftBreakSeconds(shift);
    const workHours = Math.round((workSec / 3600) * 100) / 100;
    const breakMins = Math.round(breakSec / 60);
    const pay = Math.round(workHours * rate * 100) / 100;

    sumWorkHours += workHours;
    sumBreakMins += breakMins;
    sumPay += pay;

    // Format break intervals e.g. "12:00 PM - 12:30 PM (30m)"
    const breakDetails = (shift.breaks || []).map(b => {
      const bStart = formatTimeOnly(b.startTime);
      const bEnd = formatTimeOnly(b.endTime);
      const dur = b.endTime 
        ? `${Math.round((new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / 60000)}m`
        : 'In progress';
      return `${bStart} to ${bEnd} (${dur})`;
    }).join('; ') || 'None';

    const dayName = new Date(shift.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });

    return [
      `"${shift.date}"`,
      `"${dayName}"`,
      `"${staff.name}"`,
      `"${staff.title}"`,
      `"${staff.department || 'Drafting'}"`,
      `"${shift.status === 'clocked_in' ? 'Clocked In' : shift.status === 'on_break' ? 'On Break' : 'Clocked Out'}"`,
      `"${formatTimeOnly(shift.clockInTime)}"`,
      `"${breakDetails}"`,
      breakMins,
      `"${formatTimeOnly(shift.clockOutTime)}"`,
      workHours.toFixed(2),
      rate.toFixed(2),
      pay.toFixed(2),
      `"${(shift.notes || '').replace(/"/g, '""')}"`
    ];
  });

  // Add Totals row
  rows.push([
    '"TOTALS / SUMMARY"',
    '""',
    `"${staff.name}"`,
    `"${staff.title}"`,
    `"${staff.department || 'Drafting'}"`,
    '""',
    '""',
    '""',
    sumBreakMins,
    '""',
    sumWorkHours.toFixed(2),
    rate.toFixed(2),
    sumPay.toFixed(2),
    `"Total Sessions: ${staffShifts.length}"`
  ]);

  const csvContent = [
    `# MY PLAN STORE OS - EMPLOYEE TIME CARD REPORT`,
    `# Employee: ${staff.name} (${staff.title})`,
    `# Period: ${periodLabel || (weekStart ? getWeekDateRangeLabel(weekStart) : 'All History')}`,
    `# Export Date: ${new Date().toLocaleString()}`,
    `# Base Hourly Rate: $${rate}/hr`,
    '',
    headers.join(','),
    ...rows.map(r => r.join(','))
  ].join('\n');

  downloadCSV(csvContent, `MPS_TimeCard_${staff.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
}

/**
 * Export Full Company Team Time Cards to CSV (Used by Jason, Greg Hyatt, Admin)
 */
export function exportTeamTimeCardsSummaryCSV(
  staffList: StaffUser[],
  allShifts: TimeCardShift[],
  jobs: Job[],
  dateRangeLabel: string = 'Current Pay Period',
  weekStart?: Date,
  weekEnd?: Date
) {
  const headers = [
    'Employee ID',
    'Employee Name',
    'Job Title',
    'Department',
    'Status',
    'Hourly Rate ($)',
    'Total Shifts',
    'Total Break (Hours)',
    'Total Shift (Hours)',
    'Regular Hours (<=40)',
    'Overtime Hours (>40)',
    'Project Hours Logged',
    'Estimated Gross Pay ($)'
  ];

  let grandTotalHours = 0;
  let grandTotalBreakHours = 0;
  let grandTotalProjectHours = 0;
  let grandTotalPay = 0;
  let grandTotalShiftsCount = 0;

  const rows = staffList.map(staff => {
    // Jason is salaried exempt
    const isJason = staff.name.toLowerCase().includes('jason');
    const summary = weekStart
      ? getEmployeeWeeklySummary(staff, allShifts, jobs, Date.now(), weekStart)
      : getEmployeeAllTimeSummary(staff, allShifts, jobs, Date.now());

    if (isJason) {
      return [
        `"${staff.id}"`,
        `"${staff.name}"`,
        `"${staff.title}"`,
        `"${staff.department || 'Management'}"`,
        `"Salaried (Exempt)"`,
        `"${staff.hourlyRate || 120}.00"`,
        0,
        '0.00',
        '40.00 (Salaried)',
        '40.00',
        '0.00',
        summary.totalProjectHours.toFixed(2),
        ((staff.hourlyRate || 120) * 40).toFixed(2)
      ];
    }

    grandTotalHours += summary.totalShiftHours;
    grandTotalBreakHours += summary.totalBreakHours;
    grandTotalProjectHours += summary.totalProjectHours;
    grandTotalPay += summary.estimatedGrossPay;
    grandTotalShiftsCount += summary.shifts.length;

    return [
      `"${staff.id}"`,
      `"${staff.name}"`,
      `"${staff.title}"`,
      `"${staff.department || 'Drafting'}"`,
      `"${staff.status === 'inactive' ? 'Inactive' : 'Active'}"`,
      `"${summary.hourlyRate.toFixed(2)}"`,
      summary.shifts.length,
      summary.totalBreakHours.toFixed(2),
      summary.totalShiftHours.toFixed(2),
      summary.regularHours.toFixed(2),
      summary.overtimeHours.toFixed(2),
      summary.totalProjectHours.toFixed(2),
      summary.estimatedGrossPay.toFixed(2)
    ];
  });

  // Grand Totals Summary Row
  rows.push([
    '"GRAND TOTALS"',
    `"ALL STAFF (${staffList.length})"`,
    '""',
    '""',
    '""',
    '""',
    grandTotalShiftsCount,
    grandTotalBreakHours.toFixed(2),
    grandTotalHours.toFixed(2),
    '""',
    '""',
    grandTotalProjectHours.toFixed(2),
    grandTotalPay.toFixed(2)
  ]);

  const csvContent = [
    `# MY PLAN STORE OS - COMPANY-WIDE TIME CARD & PAYROLL SUMMARY`,
    `# Pay Period / Range: ${dateRangeLabel}`,
    `# Generated By: My Plan Store Operations Suite`,
    `# Generated At: ${new Date().toLocaleString()}`,
    '',
    headers.join(','),
    ...rows.map(r => r.join(','))
  ].join('\n');

  downloadCSV(csvContent, `MPS_Team_TimeCards_Summary_${new Date().toISOString().split('T')[0]}.csv`);
}

/**
 * Browser download helper for CSV strings
 */
function downloadCSV(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
