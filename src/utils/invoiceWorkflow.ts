import { Job, InvoiceStatus, AppNotification, StaffUser } from '../types';

/**
 * Checks whether an item has received Jason's explicit approval for invoicing
 */
export function isJasonApproved(job: Job): boolean {
  return Boolean(job.jason_approved || job.invoice_status === 'Jason Approved');
}

/**
 * Checks if the current staff user has authority to approve items for invoicing.
 * Authority is strictly granted to Jason, Kyle, and Drew.
 */
export function canUserApproveAsJason(staff?: StaffUser): boolean {
  if (!staff) return false;
  const name = staff.name.toLowerCase();
  return name.includes('jason') || name.includes('kyle') || name.includes('drew');
}

/**
 * Centralized invoice status state-machine & notification dispatcher:
 * - When set to "Pending Invoicing": Dispatches notification to Jason for approval.
 * - When set to "Jason Approved": Sets jason_approved to true (checkmark appears) & dispatches notifications to Ethan & Drew.
 * - When set to "Paid": Auto-archives the project while keeping it retrievable.
 */
export function applyInvoiceStatusTransition(
  job: Job,
  newStatus: InvoiceStatus,
  staffUser?: StaffUser | string
): { updatedJob: Job; newNotifications: AppNotification[] } {
  const staffName = typeof staffUser === 'string' ? staffUser : staffUser?.name || 'Operations';
  const nowIso = new Date().toISOString();
  const newNotifications: AppNotification[] = [];

  const isPaid = newStatus === 'Paid';
  const wasPreviouslyApproved = Boolean(job.jason_approved);

  let jasonApproved = job.jason_approved;
  let jasonApprovedAt = job.jason_approved_at;
  let jasonApprovedBy = job.jason_approved_by;

  let auditAction = 'Invoice Status Updated';
  let auditDetails = `Changed invoice status to "${newStatus}".`;

  if (newStatus === 'Pending Invoicing') {
    // Queued for Jason's approval
    jasonApproved = false;
    jasonApprovedAt = undefined;
    jasonApprovedBy = undefined;
    auditAction = 'Routed to Jason for Invoicing Approval';
    auditDetails = `Item marked as "Pending Invoicing" by ${staffName}. Queued for Jason's sign-off before invoicing.`;

    // Dispatch direct notification to Jason
    newNotifications.push({
      id: `notif-jason-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      recipientName: 'Jason',
      recipientEmail: 'jason@myplanstore.com',
      title: `Invoice Approval Request: ${job.job_number}`,
      message: `${job.job_number} (${job.customer_name}) has been submitted for invoicing by ${staffName} and is waiting for your review and approval.`,
      timestamp: nowIso,
      read: false,
      type: 'review_ready',
      jobId: job.id,
      jobNumber: job.job_number,
      senderName: staffName
    });
  } else if (newStatus === 'Jason Approved') {
    // Approved by Jason
    jasonApproved = true;
    jasonApprovedAt = nowIso;
    jasonApprovedBy = staffName;
    auditAction = 'Approved for Invoicing by Jason';
    auditDetails = `${staffName} approved project for invoicing. Automated alerts dispatched to Ethan and Drew to begin invoicing.`;

    // Dispatch notifications to Ethan & Drew
    newNotifications.push(
      {
        id: `notif-ethan-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        recipientName: 'Ethan',
        recipientEmail: 'ethan@myplanstore.com',
        title: `Ready for Invoicing: ${job.job_number}`,
        message: `Jason has approved ${job.job_number} (${job.customer_name}) for invoicing. Please start the invoicing process.`,
        timestamp: nowIso,
        read: false,
        type: 'status_change',
        jobId: job.id,
        jobNumber: job.job_number,
        senderName: staffName
      },
      {
        id: `notif-drew-${Date.now() + 1}-${Math.random().toString(36).substring(2, 6)}`,
        recipientName: 'Drew Lupkey',
        recipientEmail: 'drew.lupkey@myplanstore.com',
        title: `Ready for Invoicing: ${job.job_number}`,
        message: `Jason has approved ${job.job_number} (${job.customer_name}) for invoicing. Please start the invoicing process.`,
        timestamp: nowIso,
        read: false,
        type: 'status_change',
        jobId: job.id,
        jobNumber: job.job_number,
        senderName: staffName
      }
    );
  } else if (isPaid) {
    auditAction = 'Project Paid & Archived';
    auditDetails = `Marked as Paid by ${staffName}. Project archived and removed from active drafter boards. Retrievable via search by Kyle, Jason, Drew, and Ethan.`;
  } else if (newStatus === 'Uninvoiced') {
    jasonApproved = false;
    jasonApprovedAt = undefined;
    jasonApprovedBy = undefined;
    auditAction = 'Invoice Status Reset';
    auditDetails = `Reset invoice status to "Uninvoiced" by ${staffName}.`;
  }

  const updatedJob: Job = {
    ...job,
    invoice_status: newStatus,
    jason_approved: jasonApproved,
    jason_approved_at: jasonApprovedAt,
    jason_approved_by: jasonApprovedBy,
    is_archived: isPaid,
    archived_at: isPaid ? (job.archived_at || nowIso) : undefined,
    archived_by: isPaid ? (job.archived_by || staffName) : undefined,
    audit_logs: [
      {
        id: `a-${Date.now()}`,
        action: auditAction,
        performedBy: staffName,
        timestamp: nowIso,
        details: auditDetails
      },
      ...(job.audit_logs || [])
    ]
  };

  return { updatedJob, newNotifications };
}
