export type JobPhase = 
  | 'Customer Inquiry'
  | 'Preliminary Layout'
  | 'Customer Review'
  | 'Revisions'
  | 'Exterior Elevations'
  | 'Construction Prints'
  | 'Completed';

export interface PinnedLocation {
  x: number;
  y: number;
  page?: string;
}

export interface JobComment {
  id: string;
  author: string;
  authorId?: string;
  role: 'drafter' | 'customer' | 'system';
  text: string;
  timestamp: string;
  attachmentUrl?: string;
  attachmentName?: string;
  pinnedLocation?: PinnedLocation;
  taggedStaff?: string[]; // Staff user names tagged e.g. ["Jason", "Drew", "Kyle"]
  replyToCommentId?: string;
  replyToAuthor?: string;
  replyToText?: string;
  isJobNote?: boolean;
}

export interface DeliverableFile {
  id: string;
  title: string;
  category: 'Floor Plan' | 'Exterior Elevations' | 'Foundation Plan' | 'Electrical & Reflected Ceiling' | '3D Render' | 'PDF Specs' | 'CAD / DWG File';
  version: string;
  uploadedAt: string;
  fileSize: string;
  previewType: 'canvas_floorplan' | 'canvas_elevation' | 'pdf_spec' | 'render_image' | 'cad_file';
  fileUrl?: string;
  fileName?: string;
  changeNotes?: string;
  authorDrafter?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  performedBy: string;
  timestamp: string;
  details: string;
}

export type AdditionalBillingCategory =
  | 'Revisions Exceeded Plan Scope'
  | '1-on-1 Consultation with Jason'
  | '1-on-1 Consultation with Kyle'
  | 'Out-of-Scope Custom Work'
  | 'Standard Offline CAD Drafting'
  | 'Other Additional Work';

export interface TimeLog {
  id: string;
  drafterName: string;
  startTime: string; // ISO string
  endTime?: string;  // ISO string (undefined if currently running)
  durationSeconds: number; // completed duration in seconds
  taskDescription?: string;
  hourlyRate?: number;
  billingCategory?: string;
  billableHours?: number;
  billableAmount?: number;
  rawInputHours?: number;
  delegatedTaskId?: string;
  delegatedTaskTitle?: string;
}

export interface JobVersionSnapshot {
  id: string;
  versionLabel: string; // e.g. "v1.0 - Customer Inquiry", "v1.1 - Preliminary Draft"
  timestamp: string;    // ISO string
  phase: JobPhase;
  createdByName: string;
  note?: string;
  comments: JobComment[];
  deliverables?: DeliverableFile[];
}

export interface TaskAttachment {
  id: string;
  name: string;
  size: string;
  type: string;
  url?: string;
}

export interface DelegatedWorkItem {
  id: string;
  jobId: string;
  jobNumber: string;
  customerName: string;
  componentTitle: string; // e.g. "Foundation & Slab Structural Detail", "Kitchen Island & Cabinetry Revisions", "Truss Layout Elevation"
  category: 'Floor Plan' | 'Exterior Elevations' | 'Foundation Plan' | 'Electrical & Reflected Ceiling' | '3D Render' | 'Structural Details' | 'Site Plan' | 'CAD Modeling' | 'Revisions' | 'General';
  priority: 'Normal' | 'High' | 'Urgent';
  assignedTo: string; // Drafter name e.g. "Kyle", "James Barnett"
  assignedToEmail?: string;
  delegatedBy: string; // e.g. "Kyle", "Jason", "Greg Hyatt"
  delegatedAt: string; // ISO string
  dueDate?: string;
  neededWorkDescription?: string;
  notes?: string;
  status: 'Pending' | 'In Progress' | 'Under Review' | 'Completed' | 'Revision Requested';
  completedAt?: string;
  completedBy?: string;
  completionNotes?: string;
  attachments?: TaskAttachment[];
  isReviewed?: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  revisionRequested?: boolean;
  revisionRequestedBy?: string;
  revisionRequestedAt?: string;
  revisionNotes?: string;
  revisionCount?: number;
  workedSeconds?: number;
  activeTimerStart?: string;
  activeTimerDrafterName?: string;
}

export type StaffDepartment = 
  | 'Architecture'
  | 'Drafting'
  | 'Management'
  | 'Engineering'
  | 'Operations'
  | 'Finance';

export type ShiftStatus = 'clocked_out' | 'clocked_in' | 'on_break';

export interface TimeCardBreak {
  id: string;
  startTime: string; // ISO string
  endTime?: string;  // ISO string
  durationSeconds?: number;
}

export interface TimeCardShift {
  id: string;
  staffId: string;
  staffName: string;
  date: string; // 'YYYY-MM-DD'
  clockInTime: string; // ISO string
  clockOutTime?: string; // ISO string
  status: ShiftStatus;
  breaks: TimeCardBreak[];
  totalWorkSeconds: number;
  totalBreakSeconds: number;
  notes?: string;
  pausedProjectJobIds?: string[];
  missedClockOut?: boolean;
}

export interface EmployeeWeeklySummary {
  staffId: string;
  staffName: string;
  title: string;
  department: string;
  hourlyRate: number;
  totalShiftHours: number;
  totalBreakHours: number;
  totalProjectHours: number;
  regularHours: number;
  overtimeHours: number;
  estimatedGrossPay: number;
  shifts: TimeCardShift[];
}

export type StandardGregDevProjectType = 
  | 'MPS OS Dev' 
  | 'BigX Media Dev' 
  | 'Sound Extraction Dev' 
  | 'FB Media Dev' 
  | 'Other Dev';

export type GregDevProjectType = StandardGregDevProjectType | string;

export interface GregDevProjectCard {
  id: string;
  projectType: GregDevProjectType;
  colorTheme: 'indigo' | 'cyan' | 'purple' | 'blue' | 'amber' | 'emerald' | 'rose';
  isActive: boolean;
  isPausedByBreak: boolean;
  activeTimerStart?: string; // ISO timestamp
  todaySeconds: number;
  totalSeconds: number;
  currentNotes?: string;
  lastStartedAt?: string;
  lastStoppedAt?: string;
}

export interface GregDevTimeEntry {
  id: string;
  staffId: string;
  staffName: string;
  projectType: GregDevProjectType;
  date: string; // 'YYYY-MM-DD'
  startTime: string; // ISO string
  endTime: string; // ISO string
  durationSeconds: number;
  notes?: string;
  hourlyRate: number;
  billableAmount: number;
  shiftId?: string;
  createdAt: string; // ISO string
}

export type DevEntryPeriodFilter = 'daily' | 'weekly' | 'monthly';

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  title: string;
  phone?: string;
  avatar?: string;
  role: 'admin' | 'drafter_lead' | 'drafter';
  department?: StaffDepartment;
  hourlyRate?: number;
  status?: 'active' | 'inactive';
  joinedDate?: string;
  
  // Granular OS Permissions
  canAccessFinancials: boolean;  // Access invoices, drafter rates, billing stats
  canDelegate: boolean;          // Assign tasks, review completed tasks, QA signoff & revisions
  canViewAllProjects?: boolean;  // View all projects across team vs only assigned board
  canManageStaff?: boolean;      // Superadmin / Owner privilege: Add/Edit/Delete staff & adjust permissions
  canManageInvoices?: boolean;   // Change invoice status (Uninvoiced, Pending, Invoiced, Paid/Archive)
  canEditJobPhases?: boolean;    // Advance or rewind job workflow phases
  canManageRoadblocks?: boolean; // Flag and resolve roadblocks on jobs
  canAccessPayroll?: boolean;    // Access payroll table, record payments, view employee compensation checks
  preferredLayout?: 'grid' | 'board' | 'list' | 'table'; // User's default preferred layout view (Grid Cards, Kanban, Lists, Table)
}

export interface PayrollEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail?: string;
  employeeTitle?: string;
  periodStart: string; // 'YYYY-MM-DD'
  periodEnd: string;   // 'YYYY-MM-DD'
  paymentDate: string; // 'YYYY-MM-DD'
  amount: number;      // Dollar payment e.g. 2500.00
  checkNumber: string; // Check number e.g. "1042"
  notes?: string;      // Optional notes / description
  createdAt: string;   // ISO timestamp
  recordedBy?: string; // e.g. "Jason Barnett" or "Greg Hyatt"
  recordedById?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole?: string;
  senderAvatar?: string;
  text: string;
  timestamp: string; // ISO string
  mentions?: string[]; // Staff user names mentioned e.g. ["Kyle", "Jason"]
  referencedJobNumbers?: string[]; // e.g. ["MPS-2024-001", "MPS-test"]
  replyToId?: string;
  replyToMessage?: {
    id: string;
    senderName: string;
    text: string;
  };
  readByStaffIds: string[]; // staff IDs who have read this message
  channelId?: string;
}

export interface AppNotification {
  id: string;
  recipientName: string;
  recipientEmail: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'delegation' | 'status_change' | 'roadblock' | 'comment' | 'review_ready' | 'deliverable_uploaded' | 'tag_mention' | 'tag_reply';
  jobId?: string;
  jobNumber?: string;
  taskId?: string;
  senderName?: string;
  commentId?: string;
  projectDetails?: {
    customerName?: string;
    style?: string;
    phase?: string;
    sqFt?: number;
  };
}

export type InvoiceStatus = 'Uninvoiced' | 'Pending Invoicing' | 'Jason Approved' | 'Invoiced' | 'Paid';

export interface Job {
  id: string;
  job_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  assigned_drafter: string;
  project_manager?: string;
  owner?: string; // e.g. "JB"
  project_name?: string; // e.g. "Ceci McFee", "Peggy Thompson - Remodel"
  sq_ft_goal?: string; // e.g. "1800-1900", "remodel", "1800"
  project_address?: string; // e.g. "203 Tom Miller Lane, Bismarck"
  builder?: string; // e.g. "Zach Ritter", "CCI"
  sheet_status?: string; // e.g. "Customer Review", "Changes", "No Status"
  status_note?: string;
  completed?: boolean;
  completed_at?: string;
  due_date?: string;
  total_time_entries?: number;
  total_duration_minutes?: number;
  total_duration_hours?: number;
  phase_name?: string; // e.g. "Layout", "Prelim", "No Phase", "Final Review"
  sq_ft: number;
  style: string;
  lot_details: string;
  current_status: JobPhase;
  roadblock: boolean;
  roadblock_note?: string;
  layout_reviews_count: number;
  max_reviews_included: number;
  last_customer_contact: string;
  next_step: string;
  created_at: string;
  target_completion_date: string;
  estimated_cost: number;
  hourly_rate?: number; // e.g. $85/hr for drafting calculation
  deposit_collected?: boolean; // Whether an upfront retainer/deposit was collected
  deposit_amount?: number; // Dollar amount of deposit collected e.g. $1500
  deposit_date?: string; // Date deposit was received e.g. "2026-08-20"
  deposit_notes?: string; // Payment reference or notes (e.g. "Check #1042 / Stripe 50% retainer")
  invoice_status?: InvoiceStatus;
  invoice_number?: string;
  invoice_date?: string; // e.g. "2026-08-27"
  invoice_due_date?: string; // e.g. "2026-09-08"
  online_payment_link?: string; // Custom or default URL e.g. "https://pay.myplanstore.com/inv/MPS-1042"
  invoice_terms?: string; // e.g. "Net 7 Business Days"
  invoice_notes?: string;
  jason_approved?: boolean; // True when Jason has approved the item for invoicing
  jason_approved_at?: string; // Timestamp when Jason approved
  jason_approved_by?: string; // Staff member who approved as/for Jason
  is_archived?: boolean;
  archived_at?: string;
  archived_by?: string;
  archive_notes?: string;
  phase_entry_date?: string; // ISO timestamp when current phase was entered
  time_logs?: TimeLog[];
  delegated_tasks?: DelegatedWorkItem[];
  version_snapshots?: JobVersionSnapshot[];
  active_timer_start?: string; // ISO string if timer is currently running
  active_timer_task?: string;  // Note for current active session
  active_timer_drafter_id?: string;
  active_timer_drafter_name?: string;
  active_timer_delegated_task_id?: string; // Currently running delegated task ID
  paused_by_break?: boolean;   // Flagged if timer was auto-paused due to employee going on break
  paused_timer_task?: string;  // Preserved task label while paused
  paused_timer_drafter_id?: string;
  paused_timer_drafter_name?: string;
  paused_elapsed_seconds?: number;
  comments: JobComment[];
  deliverables: DeliverableFile[];
  audit_logs: AuditLog[];
}

export interface EmailAttachment {
  name: string;
  type: string; // e.g. "application/pdf"
  sizeBytes?: number;
  dataUrl?: string; // base64 or blob URL
  downloadUrl?: string;
}

export interface EmailTemplate {
  recipientEmail: string;
  recipientName: string;
  subject: string;
  body: string;
  timestamp: string;
  jobId: string;
  jobNumber: string;
  attachments?: EmailAttachment[];
}
