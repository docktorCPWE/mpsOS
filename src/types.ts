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
  role: 'drafter' | 'customer' | 'system';
  text: string;
  timestamp: string;
  attachmentUrl?: string;
  attachmentName?: string;
  pinnedLocation?: PinnedLocation;
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

export interface TimeLog {
  id: string;
  drafterName: string;
  startTime: string; // ISO string
  endTime?: string;  // ISO string (undefined if currently running)
  durationSeconds: number; // completed duration in seconds
  taskDescription?: string;
  hourlyRate?: number;
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
  assignedTo: string; // Drafter name e.g. "Sarah Jenkins", "Alex Rivers", "Elena Rostova"
  assignedToEmail?: string;
  delegatedBy: string; // e.g. "Kyle", "Jason", "Greg Hyatt"
  delegatedAt: string; // ISO string
  dueDate?: string;
  neededWorkDescription: string;
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
}

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  title: string;
  avatar?: string;
  role: 'admin' | 'drafter_lead' | 'drafter';
  canAccessFinancials: boolean; // restricted to Jason, Greg Hyatt, Drew Lupkey
  canDelegate: boolean;         // Kyle, Jason, Greg Hyatt
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole?: string;
  senderAvatar?: string;
  text: string;
  timestamp: string; // ISO string
  mentions?: string[]; // Staff user names mentioned e.g. ["Sarah Jenkins", "Kyle"]
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
  type: 'delegation' | 'status_change' | 'roadblock' | 'comment';
  jobId?: string;
  jobNumber?: string;
  taskId?: string;
  senderName?: string;
}

export interface Job {
  id: string;
  job_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  assigned_drafter: string;
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
  invoice_status?: 'Uninvoiced' | 'Pending Invoicing' | 'Invoiced' | 'Paid';
  invoice_number?: string;
  phase_entry_date?: string; // ISO timestamp when current phase was entered
  time_logs?: TimeLog[];
  delegated_tasks?: DelegatedWorkItem[];
  version_snapshots?: JobVersionSnapshot[];
  active_timer_start?: string; // ISO string if timer is currently running
  active_timer_task?: string;  // Note for current active session
  comments: JobComment[];
  deliverables: DeliverableFile[];
  audit_logs: AuditLog[];
}

export interface EmailTemplate {
  recipientEmail: string;
  recipientName: string;
  subject: string;
  body: string;
  timestamp: string;
  jobId: string;
  jobNumber: string;
}
