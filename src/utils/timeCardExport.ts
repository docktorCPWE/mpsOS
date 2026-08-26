import { TimeCardShift, StaffUser, Job, EmployeeWeeklySummary } from '../types';

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
  if (!totalMinutes || totalMinutes <= 0) return '0 hrs 0 mins';
  const hrs = Math.floor(totalMinutes / 60);
  const mins = Math.round(totalMinutes % 60);
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

/**
 * Calculate total work seconds for a shift (excluding breaks).
 * If currently clocked in, includes live ticking time.
 */
export function calculateShiftWorkSeconds(shift: TimeCardShift, nowMs: number = Date.now()): number {
  if (!shift.clockInTime) return 0;
  const startMs = new Date(shift.clockInTime).getTime();
  const endMs = shift.clockOutTime ? new Date(shift.clockOutTime).getTime() : nowMs;

  const grossSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000));
  const breakSeconds = calculateShiftBreakSeconds(shift, nowMs);

  return Math.max(0, grossSeconds - breakSeconds);
}

/**
 * Calculate total break seconds for a shift.
 * If currently on break, includes live break time.
 */
export function calculateShiftBreakSeconds(shift: TimeCardShift, nowMs: number = Date.now()): number {
  if (!shift.breaks || shift.breaks.length === 0) return 0;

  return shift.breaks.reduce((sum, b) => {
    if (!b.startTime) return sum;
    const startMs = new Date(b.startTime).getTime();
    const endMs = b.endTime ? new Date(b.endTime).getTime() : (shift.status === 'on_break' ? nowMs : startMs);
    const duration = Math.max(0, Math.floor((endMs - startMs) / 1000));
    return sum + duration;
  }, 0);
}

/**
 * Calculate project hours logged by this staff member on jobs
 */
export function calculateEmployeeProjectSeconds(staffName: string, jobs: Job[]): number {
  const staffLower = staffName.toLowerCase();
  let totalSeconds = 0;

  jobs.forEach(job => {
    (job.time_logs || []).forEach(log => {
      if ((log.drafterName || '').toLowerCase().includes(staffLower) || staffLower.includes((log.drafterName || '').toLowerCase())) {
        totalSeconds += log.durationSeconds || 0;
      }
    });
  });

  return totalSeconds;
}

/**
 * Generate weekly summary for an employee
 */
export function getEmployeeWeeklySummary(
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
  const overtimeHours = Math.max(0, totalShiftHours - 40);
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
 * Export Individual Employee Time Card to CSV
 */
export function exportSingleEmployeeTimeCardCSV(
  staff: StaffUser,
  allShifts: TimeCardShift[],
  jobs: Job[]
) {
  const staffShifts = allShifts
    .filter(s => s.staffId === staff.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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
  dateRangeLabel: string = 'Current Pay Period'
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

  const rows = staffList.map(staff => {
    // Jason is salaried exempt
    const isJason = staff.name.toLowerCase().includes('jason');
    const summary = getEmployeeWeeklySummary(staff, allShifts, jobs);

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
    allShifts.length,
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
