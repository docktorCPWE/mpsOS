import { Job, DelegatedWorkItem } from '../types';

/**
 * Calculate total seconds worked on a specific delegated work item.
 * Combines task.workedSeconds, any time logs explicitly tagged with task.id or matching task title,
 * and any currently running active timer specifically on this task.
 */
export function calculateDelegatedTaskWorkedSeconds(
  task: DelegatedWorkItem,
  job?: Job | null,
  nowTimestamp?: number
): number {
  if (!task) return 0;
  let seconds = task.workedSeconds || 0;

  // If the job has time logs referencing this delegated task
  if (job && job.time_logs && job.time_logs.length > 0) {
    const matchingLogs = job.time_logs.filter(
      tl => tl.delegatedTaskId === task.id ||
      (tl.taskDescription && task.componentTitle && tl.taskDescription.toLowerCase().includes(task.componentTitle.toLowerCase()))
    );
    const logSum = matchingLogs.reduce((acc, l) => acc + (l.durationSeconds || 0), 0);
    // Ensure we don't undercount if time logs exist
    seconds = Math.max(seconds, logSum);
  }

  // Active timer on task directly
  if (task.activeTimerStart) {
    const startMs = new Date(task.activeTimerStart).getTime();
    const currentMs = nowTimestamp || Date.now();
    seconds += Math.max(0, Math.floor((currentMs - startMs) / 1000));
  } else if (
    job &&
    job.active_timer_start &&
    (job.active_timer_delegated_task_id === task.id ||
     (job.active_timer_task && task.componentTitle && job.active_timer_task.toLowerCase().includes(task.componentTitle.toLowerCase())))
  ) {
    const startMs = new Date(job.active_timer_start).getTime();
    const currentMs = nowTimestamp || Date.now();
    seconds += Math.max(0, Math.floor((currentMs - startMs) / 1000));
  }

  return Math.max(0, seconds);
}

/**
 * Format total seconds into human readable format like "2h 45m 12s" or "02:45:10"
 */
export function formatSecondsToHHMMSS(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const pad = (n: number) => n.toString().padStart(2, '0');
  if (h > 0) {
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}

export function formatSecondsToReadable(seconds: number): string {
  if (!seconds || seconds <= 0) return '0 hrs 0 mins';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours === 0) {
    return `${minutes} min${minutes === 1 ? '' : 's'}`;
  }
  return `${hours} hr${hours === 1 ? '' : 's'} ${minutes} min${minutes === 1 ? '' : 's'}`;
}

/**
 * Calculate total logged seconds for a job, including completed logs and currently running timer if active.
 */
export function calculateJobTotalSeconds(job: Job, nowTimestamp?: number): number {
  let completedSeconds = (job.time_logs || []).reduce(
    (sum, log) => sum + (log.durationSeconds || 0),
    0
  );

  // Fallback to sheet duration if time_logs is empty
  if (completedSeconds === 0 && (job.total_duration_minutes || job.total_duration_hours)) {
    completedSeconds = Math.round((job.total_duration_minutes || (job.total_duration_hours! * 60)) * 60);
  }

  let activeSeconds = 0;
  if (job.active_timer_start) {
    const startMs = new Date(job.active_timer_start).getTime();
    const currentMs = nowTimestamp || Date.now();
    activeSeconds = Math.max(0, Math.floor((currentMs - startMs) / 1000));
  }

  return Math.max(0, completedSeconds + activeSeconds);
}

/**
 * Calculate billable hours for additional work / offline drafting / 1-on-1s.
 * Rules:
 * 1. Minimum 1.0 hour for all additional billing entries.
 * 2. After the first hour, calculate in quarter-hour (0.25h) increments (e.g. 1.0, 1.25, 1.5, 1.75, 2.0...).
 */
export function calculateAdditionalBillableHours(rawHours: number): number {
  if (!rawHours || rawHours <= 0) return 0;
  if (rawHours <= 1.0) return 1.0;
  const extra = rawHours - 1.0;
  const roundedExtra = Math.ceil(extra * 4) / 4;
  return Number((1.0 + roundedExtra).toFixed(2));
}

/**
 * Calculate billable total for a job based on all logs (with individual rates & billable hours) and any active timer.
 */
export function calculateJobBillableAmount(job: Job, nowTimestamp?: number): number {
  let completedBillable = 0;
  for (const log of (job.time_logs || [])) {
    const rate = log.hourlyRate || job.hourly_rate || 85;
    if (typeof log.billableAmount === 'number') {
      completedBillable += log.billableAmount;
    } else if (typeof log.billableHours === 'number') {
      completedBillable += log.billableHours * rate;
    } else {
      const hours = (log.durationSeconds || 0) / 3600;
      completedBillable += hours * rate;
    }
  }

  let activeBillable = 0;
  if (job.active_timer_start) {
    const startMs = new Date(job.active_timer_start).getTime();
    const currentMs = nowTimestamp || Date.now();
    const activeSec = Math.max(0, Math.floor((currentMs - startMs) / 1000));
    const rate = job.hourly_rate || 85;
    activeBillable = (activeSec / 3600) * rate;
  }

  return Math.max(0, Math.round((completedBillable + activeBillable) * 100) / 100);
}

/**
 * Get the effective deposit collected amount for a job.
 */
export function calculateJobDepositAmount(job: Job): number {
  if (job.deposit_collected && typeof job.deposit_amount === 'number' && job.deposit_amount > 0) {
    return Math.round(job.deposit_amount * 100) / 100;
  }
  return 0;
}

/**
 * Calculate net amount due for invoicing (Total Billable Amount minus Deposit Collected).
 * If billable time is 0 but estimated_cost exists, it uses estimated_cost as the baseline project total.
 */
export function calculateJobNetInvoiceAmount(job: Job, nowTimestamp?: number): number {
  const loggedBillable = calculateJobBillableAmount(job, nowTimestamp);
  const grossTotal = loggedBillable > 0 ? loggedBillable : (job.estimated_cost || 0);
  const deposit = calculateJobDepositAmount(job);
  return Math.max(0, Math.round((grossTotal - deposit) * 100) / 100);
}

/**
 * Generate & download CSV report for the invoicing team
 */
export function exportInvoicingCSV(jobs: Job[], selectedJobId?: string) {
  const jobsToExport = selectedJobId ? jobs.filter(j => j.id === selectedJobId) : jobs;

  const headers = [
    'Job Number',
    'Customer Name',
    'Customer Email',
    'Assigned Drafter',
    'House Style',
    'Square Footage',
    'Current Phase',
    'Estimated Base Fee ($)',
    'Hourly Rate ($)',
    'Total Seconds Logged',
    'Total Hours Logged',
    'Gross Billable Total ($)',
    'Deposit Collected ($)',
    'Deposit Notes / Ref',
    'Net Balance Due / Invoice Amount ($)',
    'Invoice Status',
    'Total Completed Sessions',
    'Last Activity Date'
  ];

  const rows = jobsToExport.map(job => {
    const totalSec = calculateJobTotalSeconds(job);
    const totalHours = (totalSec / 3600).toFixed(2);
    const grossBillable = calculateJobBillableAmount(job);
    const effectiveGross = grossBillable > 0 ? grossBillable : (job.estimated_cost || 0);
    const deposit = calculateJobDepositAmount(job);
    const netDue = Math.max(0, effectiveGross - deposit).toFixed(2);
    const rate = (job.hourly_rate || 85).toFixed(2);
    const sessionsCount = (job.time_logs || []).length;

    return [
      `"${job.job_number}"`,
      `"${job.customer_name.replace(/"/g, '""')}"`,
      `"${job.customer_email}"`,
      `"${job.assigned_drafter.replace(/"/g, '""')}"`,
      `"${job.style.replace(/"/g, '""')}"`,
      job.sq_ft,
      `"${job.current_status}"`,
      (job.estimated_cost || 0).toFixed(2),
      rate,
      totalSec,
      totalHours,
      effectiveGross.toFixed(2),
      deposit.toFixed(2),
      `"${(job.deposit_notes || (job.deposit_date ? `Paid on ${job.deposit_date}` : '')).replace(/"/g, '""')}"`,
      netDue,
      `"${job.invoice_status || 'Uninvoiced'}"`,
      sessionsCount,
      `"${new Date().toLocaleDateString()}"`
    ];
  });

  // Detailed Sessions Breakdown section at bottom of CSV
  const sessionHeaders = [
    '',
    '--- DETAILED TIME ENTRY LOGS ---',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    ''
  ];

  const sessionSubHeaders = [
    'Job Number',
    'Customer Name',
    'Drafter Name',
    'Billing Category',
    'Task Description / Notes',
    'Start Time',
    'End Time',
    'Raw Duration (HH:MM:SS)',
    'Billable Hours',
    'Hourly Rate ($)',
    'Session Total ($)'
  ];

  const sessionRows: string[][] = [];
  jobsToExport.forEach(job => {
    const defaultRate = job.hourly_rate || 85;
    (job.time_logs || []).forEach(log => {
      const rate = log.hourlyRate || defaultRate;
      const rawHours = (log.durationSeconds / 3600);
      const billableHrs = typeof log.billableHours === 'number' ? log.billableHours : Number(rawHours.toFixed(2));
      const sessionTotal = typeof log.billableAmount === 'number' 
        ? log.billableAmount.toFixed(2) 
        : (billableHrs * rate).toFixed(2);

      sessionRows.push([
        `"${job.job_number}"`,
        `"${job.customer_name.replace(/"/g, '""')}"`,
        `"${log.drafterName.replace(/"/g, '""')}"`,
        `"${(log.billingCategory || 'Standard CAD Drafting').replace(/"/g, '""')}"`,
        `"${(log.taskDescription || 'CAD Drafting & Revisions').replace(/"/g, '""')}"`,
        `"${new Date(log.startTime).toLocaleString()}"`,
        log.endTime ? `"${new Date(log.endTime).toLocaleString()}"` : '"IN PROGRESS"',
        `"${formatSecondsToHHMMSS(log.durationSeconds)}"`,
        billableHrs.toFixed(2),
        rate.toFixed(2),
        sessionTotal
      ]);
    });
  });

  const csvContent = [
    headers.join(','),
    ...rows.map(r => r.join(',')),
    '',
    sessionHeaders.join(','),
    sessionSubHeaders.join(','),
    ...sessionRows.map(r => r.join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const filename = selectedJobId 
    ? `PlanStore_Invoice_Job_${jobsToExport[0]?.job_number || 'export'}_${new Date().toISOString().slice(0, 10)}.csv`
    : `PlanStore_Full_Invoicing_Report_${new Date().toISOString().slice(0, 10)}.csv`;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
