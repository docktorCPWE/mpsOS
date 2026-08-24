import { Job } from '../types';

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
  const completedSeconds = (job.time_logs || []).reduce(
    (sum, log) => sum + (log.durationSeconds || 0),
    0
  );

  let activeSeconds = 0;
  if (job.active_timer_start) {
    const startMs = new Date(job.active_timer_start).getTime();
    const currentMs = nowTimestamp || Date.now();
    activeSeconds = Math.max(0, Math.floor((currentMs - startMs) / 1000));
  }

  return completedSeconds + activeSeconds;
}

/**
 * Calculate billable total for a job.
 */
export function calculateJobBillableAmount(job: Job, nowTimestamp?: number): number {
  const totalSeconds = calculateJobTotalSeconds(job, nowTimestamp);
  const rate = job.hourly_rate || 85; // Default $85/hr rate for CAD drafting
  const hours = totalSeconds / 3600;
  return Math.round(hours * rate * 100) / 100;
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
    'Hourly Rate ($)',
    'Total Seconds Logged',
    'Total Hours Logged',
    'Billable Total ($)',
    'Total Completed Sessions',
    'Last Activity Date'
  ];

  const rows = jobsToExport.map(job => {
    const totalSec = calculateJobTotalSeconds(job);
    const totalHours = (totalSec / 3600).toFixed(2);
    const billable = calculateJobBillableAmount(job).toFixed(2);
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
      rate,
      totalSec,
      totalHours,
      billable,
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
    ''
  ];

  const sessionSubHeaders = [
    'Job Number',
    'Customer Name',
    'Drafter Name',
    'Task Description',
    'Start Time',
    'End Time',
    'Duration (HH:MM:SS)',
    'Duration (Hours)',
    'Hourly Rate ($)',
    'Session Total ($)'
  ];

  const sessionRows: string[][] = [];
  jobsToExport.forEach(job => {
    const rate = job.hourly_rate || 85;
    (job.time_logs || []).forEach(log => {
      const durHours = (log.durationSeconds / 3600).toFixed(2);
      const sessionTotal = ((log.durationSeconds / 3600) * (log.hourlyRate || rate)).toFixed(2);

      sessionRows.push([
        `"${job.job_number}"`,
        `"${job.customer_name.replace(/"/g, '""')}"`,
        `"${log.drafterName.replace(/"/g, '""')}"`,
        `"${(log.taskDescription || 'CAD Drafting & Revisions').replace(/"/g, '""')}"`,
        `"${new Date(log.startTime).toLocaleString()}"`,
        log.endTime ? `"${new Date(log.endTime).toLocaleString()}"` : '"IN PROGRESS"',
        `"${formatSecondsToHHMMSS(log.durationSeconds)}"`,
        durHours,
        (log.hourlyRate || rate).toFixed(2),
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
