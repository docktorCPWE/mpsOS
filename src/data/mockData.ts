import { Job, JobPhase, StaffUser, DelegatedWorkItem, AppNotification, ChatMessage } from '../types';

export const STAFF_USERS: StaffUser[] = [
  {
    id: 'staff-greg',
    name: 'Greg Hyatt',
    email: 'greg.hyatt@myplanstore.com',
    title: 'Owner & Principal Architect',
    role: 'admin',
    canAccessFinancials: true, // Jason, Greg Hyatt, Drew Lupkey
    canDelegate: true          // Kyle, Jason, Greg Hyatt
  },
  {
    id: 'staff-jason',
    name: 'Jason',
    email: 'jason@myplanstore.com',
    title: 'Project Manager & Operations',
    role: 'admin',
    canAccessFinancials: true, // Jason, Greg Hyatt, Drew Lupkey
    canDelegate: true          // Kyle, Jason, Greg Hyatt
  },
  {
    id: 'staff-drew',
    name: 'Drew Lupkey',
    email: 'drew.lupkey@myplanstore.com',
    title: 'Admin & Billing Specialist',
    role: 'admin',
    canAccessFinancials: true, // Jason, Greg Hyatt, Drew Lupkey
    canDelegate: false
  },
  {
    id: 'staff-kyle',
    name: 'Kyle',
    email: 'kyle@myplanstore.com',
    title: 'Lead Project Manager & Senior Drafter',
    role: 'drafter_lead',
    canAccessFinancials: true,  // Kyle, Jason, Greg Hyatt, Drew Lupkey (full Admin & Ops overview access)
    canDelegate: true           // Kyle, Jason, Greg Hyatt
  },
  {
    id: 'staff-sarah',
    name: 'Sarah Jenkins',
    email: 'sarah.jenkins@myplanstore.com',
    title: 'Senior Architect',
    role: 'drafter',
    canAccessFinancials: false, // RESTRICTED from financials
    canDelegate: false
  },
  {
    id: 'staff-alex',
    name: 'Alex Rivers',
    email: 'alex.rivers@myplanstore.com',
    title: 'CAD Designer',
    role: 'drafter',
    canAccessFinancials: false, // RESTRICTED from financials
    canDelegate: false
  },
  {
    id: 'staff-elena',
    name: 'Elena Rostova',
    email: 'elena.rostova@myplanstore.com',
    title: 'Structural Specialist',
    role: 'drafter',
    canAccessFinancials: false, // RESTRICTED from financials
    canDelegate: false
  },
  {
    id: 'staff-james',
    name: 'James',
    email: 'james@myplanstore.com',
    title: 'Architectural Drafter',
    role: 'drafter',
    canAccessFinancials: false, // Drafter (only): STRICTLY NO access to financial, billing, or hourly rate data
    canDelegate: false          // Drafter (only): No delegation authority
  },
  {
    id: 'staff-aaron',
    name: 'Aaron',
    email: 'aaron@myplanstore.com',
    title: 'Architectural Drafter',
    role: 'drafter',
    canAccessFinancials: false, // Drafter (only): STRICTLY NO access to financial, billing, or hourly rate data
    canDelegate: false          // Drafter (only): No delegation authority
  },
  {
    id: 'staff-ethan',
    name: 'Ethan',
    email: 'ethan@myplanstore.com',
    title: 'Operations & Project Manager',
    role: 'admin',
    canAccessFinancials: true,
    canDelegate: true
  }
];

export const AUTHORIZED_FINANCIAL_NAMES = ['Greg Hyatt', 'Jason', 'Drew Lupkey', 'Ethan'];
export const AUTHORIZED_DELEGATOR_NAMES = ['Kyle', 'Jason', 'Greg Hyatt', 'Ethan'];
export const AUTHORIZED_ALL_PROJECTS_NAMES = ['Kyle', 'Jason', 'Drew', 'Ethan', 'Greg Hyatt'];

export function canViewAllProjectCards(userNameOrStaff?: string | StaffUser): boolean {
  if (!userNameOrStaff) return false;
  const name = typeof userNameOrStaff === 'string' ? userNameOrStaff : userNameOrStaff.name;
  return AUTHORIZED_ALL_PROJECTS_NAMES.some(n => name.toLowerCase().includes(n.toLowerCase()));
}

export function isJobArchived(job: Job): boolean {
  return Boolean(job.is_archived || job.invoice_status === 'Paid');
}

export function canUserAccessFinancials(userNameOrStaff?: string | StaffUser): boolean {
  if (!userNameOrStaff) return false;
  const name = typeof userNameOrStaff === 'string' ? userNameOrStaff : userNameOrStaff.name;
  return AUTHORIZED_FINANCIAL_NAMES.some(n => name.toLowerCase().includes(n.toLowerCase()));
}

export function canUserDelegate(userNameOrStaff?: string | StaffUser): boolean {
  if (!userNameOrStaff) return false;
  const name = typeof userNameOrStaff === 'string' ? userNameOrStaff : userNameOrStaff.name;
  return AUTHORIZED_DELEGATOR_NAMES.some(n => name.toLowerCase().includes(n.toLowerCase()));
}

/**
 * Determines whether a chat message is specifically relevant to the currently logged in staff user.
 * A message is displayed for a staff profile if:
 * 1. The message was sent by the staff member
 * 2. The staff member is @mentioned in the message
 * 3. The message is a reply to the staff member's message
 * 4. The message directly references an active job/plan the staff member is assigned to or involved with
 */
export function isMessageRelevantForUser(msg: ChatMessage, staff?: StaffUser, jobs: Job[] = []): boolean {
  if (!staff) return false;
  const staffLower = staff.name.toLowerCase();
  
  // 1. Sent by current staff
  if (msg.senderId === staff.id || msg.senderName.toLowerCase().includes(staffLower) || staffLower.includes(msg.senderName.toLowerCase())) {
    return true;
  }
  
  // 2. Mentions current staff
  if (msg.mentions && msg.mentions.some(m => m.toLowerCase().includes(staffLower) || staffLower.includes(m.toLowerCase()))) {
    return true;
  }

  // 3. Replied to message sent by current staff
  if (msg.replyToMessage && (
    msg.replyToMessage.senderName.toLowerCase().includes(staffLower) || 
    staffLower.includes(msg.replyToMessage.senderName.toLowerCase())
  )) {
    return true;
  }

  // 4. Message directly references a job number that this staff member is involved with
  if (msg.referencedJobNumbers && msg.referencedJobNumbers.length > 0 && jobs.length > 0) {
    const isUserOnReferencedJob = jobs.some(j => {
      const isMatchingJob = (msg.referencedJobNumbers || []).some(rjn => {
        const cleanR = rjn.replace(/^#/, '').toLowerCase();
        const cleanJ = j.job_number.replace(/^#/, '').toLowerCase();
        return cleanR === cleanJ || cleanR.includes(cleanJ) || cleanJ.includes(cleanR);
      });
      if (!isMatchingJob) return false;

      // Check if current user is involved in this job
      const isLead = (j.assigned_drafter || '').toLowerCase().includes(staffLower);
      const isPM = (j.project_manager || '').toLowerCase().includes(staffLower);
      const isDelegated = (j.delegated_tasks || []).some(t => 
        (t.assignedTo || '').toLowerCase().includes(staffLower) ||
        (t.delegatedBy || '').toLowerCase().includes(staffLower)
      );
      const isTimeLogger = (j.time_logs || []).some(tl => 
        (tl.drafterName || '').toLowerCase().includes(staffLower)
      );

      return isLead || isPM || isDelegated || isTimeLogger;
    });

    if (isUserOnReferencedJob) {
      return true;
    }
  }

  return false;
}

export const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif-ethan-1',
    recipientName: 'Ethan',
    recipientEmail: 'ethan@myplanstore.com',
    title: 'Truss Calculation Review Request',
    message: 'Jason requested review of structural truss calculations on #MPS-2024-002 before sending client invoice.',
    timestamp: new Date(Date.now() - 3600000 * 2.5).toISOString(),
    read: false,
    type: 'comment',
    jobId: 'job-2',
    jobNumber: 'MPS-2024-002',
    senderName: 'Jason'
  },
  {
    id: 'notif-ethan-2',
    recipientName: 'Ethan',
    recipientEmail: 'ethan@myplanstore.com',
    title: 'Operations Schedule: Farmhouse Intake',
    message: 'Greg Hyatt flagged 5 modern farmhouse submissions for ops scheduling in current sprint.',
    timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
    read: false,
    type: 'comment',
    senderName: 'Greg Hyatt'
  },
  {
    id: 'notif-kyle-1',
    recipientName: 'Kyle',
    recipientEmail: 'kyle@myplanstore.com',
    title: 'Revision Completed: Garage Header Heights',
    message: 'Sarah Jenkins completed garage ceiling clearance to 10\'-4" for Job #MPS-2024-001.',
    timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
    read: false,
    type: 'review_ready',
    jobId: 'job-1',
    jobNumber: 'MPS-2024-001',
    senderName: 'Sarah Jenkins'
  },
  {
    id: 'notif-kyle-2',
    recipientName: 'Kyle',
    recipientEmail: 'kyle@myplanstore.com',
    title: 'Setback Verified: #MPS-test',
    message: 'Aaron verified 25ft front and 10ft side county setbacks on #MPS-test.',
    timestamp: new Date(Date.now() - 3600000 * 1).toISOString(),
    read: false,
    type: 'comment',
    jobNumber: 'MPS-test',
    senderName: 'Aaron'
  },
  {
    id: 'notif-jason-1',
    recipientName: 'Jason',
    recipientEmail: 'jason@myplanstore.com',
    title: 'Engineering Sign-Off: Permit Packet',
    message: 'Structural engineering permit packet for #MPS-2024-003 is signed off and ready for review.',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    read: false,
    type: 'comment',
    jobId: 'job-3',
    jobNumber: 'MPS-2024-003',
    senderName: 'Engineering'
  },
  {
    id: 'notif-jason-2',
    recipientName: 'Jason',
    recipientEmail: 'jason@myplanstore.com',
    title: '3D Render Uploaded',
    message: 'Alex Rivers uploaded 3D exterior perspective for #MPS-2024-002.',
    timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
    read: false,
    type: 'deliverable_uploaded',
    jobId: 'job-2',
    jobNumber: 'MPS-2024-002',
    senderName: 'Alex Rivers'
  },
  {
    id: 'notif-1',
    recipientName: 'Sarah Jenkins',
    recipientEmail: 'sarah.jenkins@myplanstore.com',
    title: 'New Component Delegated: Foundation & Slab Detail',
    message: 'Kyle delegated "Foundation & Slab Structural Detail" for Job #M26-195 with 2 attached files.',
    timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
    read: false,
    type: 'delegation',
    jobId: 'job-1',
    jobNumber: 'M26-195',
    senderName: 'Kyle'
  },
  {
    id: 'notif-2',
    recipientName: 'Alex Rivers',
    recipientEmail: 'alex.rivers@myplanstore.com',
    title: 'New Component Delegated: 3D Exterior Elevation Render',
    message: 'Jason delegated "3D Exterior Perspective & Siding Detailing" for Job #M26-198 with CAD dwg attachment.',
    timestamp: new Date(Date.now() - 3600000 * 6).toISOString(),
    read: false,
    type: 'delegation',
    jobId: 'job-2',
    jobNumber: 'M26-198',
    senderName: 'Jason'
  },
  {
    id: 'notif-3',
    recipientName: 'James',
    recipientEmail: 'james@myplanstore.com',
    title: 'New Component Delegated: Hidden Pantry Millwork CAD',
    message: 'Jason delegated "Hidden Pantry Millwork & Kitchen Island CAD Detail" for Job #M26-195 with concept sketches.',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    read: false,
    type: 'delegation',
    jobId: 'job-1',
    jobNumber: 'M26-195',
    senderName: 'Jason'
  },
  {
    id: 'notif-aaron-1',
    recipientName: 'Aaron',
    recipientEmail: 'aaron@myplanstore.com',
    title: 'Setback Boundary Check Request',
    message: 'Kyle requested setback verification and zoning review for #MPS-test.',
    timestamp: new Date(Date.now() - 3600000 * 1.5).toISOString(),
    read: false,
    type: 'comment',
    jobNumber: 'MPS-test',
    senderName: 'Kyle'
  },
  {
    id: 'notif-drew-1',
    recipientName: 'Drew Lupkey',
    recipientEmail: 'drew@myplanstore.com',
    title: 'Weekly Invoicing Audit Request',
    message: 'Greg Hyatt requested weekly billing reconciliation for completed drafter packages.',
    timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
    read: false,
    type: 'comment',
    senderName: 'Greg Hyatt'
  },
  {
    id: 'notif-greg-1',
    recipientName: 'Greg Hyatt',
    recipientEmail: 'greg@myplanstore.com',
    title: 'Engineering Sign-Off: #MPS-2024-003',
    message: 'Jason completed engineering review and marked preliminary structural permit ready.',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    read: false,
    type: 'comment',
    jobNumber: 'MPS-2024-003',
    senderName: 'Jason'
  }
];

export const INITIAL_JOBS: Job[] = [
  {
    id: 'job-1',
    job_number: 'M26-195',
    customer_name: 'Marcus & Elena Vance',
    customer_email: 'marcus.vance@example.com',
    customer_phone: '(555) 234-5678',
    assigned_drafter: 'Sarah Jenkins, Senior Architect',
    sq_ft: 2850,
    style: 'Modern Farmhouse',
    lot_details: 'Sloped 0.75 acre lot with north rear orientation, 35ft set back requirement.',
    current_status: 'Preliminary Layout',
    roadblock: false,
    layout_reviews_count: 1,
    max_reviews_included: 3,
    last_customer_contact: new Date(Date.now() - 3600000 * 4).toISOString(),
    next_step: 'Reviewing Room Location, Master Suite Flow & Vaulted Great Room',
    created_at: '2026-07-10T09:00:00Z',
    target_completion_date: '2026-08-15',
    estimated_cost: 3400,
    hourly_rate: 85,
    invoice_status: 'Invoiced',
    invoice_number: 'INV-2026-001',
    phase_entry_date: new Date(Date.now() - 3600000 * 72).toISOString(), // 3 days in current phase
    delegated_tasks: [
      {
        id: 'del-1',
        jobId: 'job-1',
        jobNumber: 'M26-195',
        customerName: 'Marcus & Elena Vance',
        componentTitle: 'Foundation & Stem Wall Structural Detail',
        category: 'Foundation Plan',
        priority: 'High',
        assignedTo: 'Sarah Jenkins',
        assignedToEmail: 'sarah.jenkins@myplanstore.com',
        delegatedBy: 'Kyle',
        delegatedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
        dueDate: '2026-08-18',
        neededWorkDescription: 'Engineer stem wall footing depth for 4ft slope on North boundary. Coordinate with civil grade report.',
        notes: 'Customer specifically requested walkout basement access on northeast quadrant. Ensure 8ft clear headroom.',
        status: 'In Progress',
        attachments: [
          {
            id: 'att-1',
            name: 'Civil_Slope_Topography_Survey.pdf',
            size: '2.4 MB',
            type: 'application/pdf',
            url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80'
          },
          {
            id: 'att-2',
            name: 'Foundation_Redlines_Kyle.dwg',
            size: '5.1 MB',
            type: 'application/acad',
            url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80'
          }
        ]
      },
      {
        id: 'del-2',
        jobId: 'job-1',
        jobNumber: 'M26-195',
        customerName: 'Marcus & Elena Vance',
        componentTitle: 'Hidden Pantry Millwork & Kitchen Island CAD Detail',
        category: 'Floor Plan',
        priority: 'Normal',
        assignedTo: 'James',
        assignedToEmail: 'james@myplanstore.com',
        delegatedBy: 'Jason',
        delegatedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
        dueDate: '2026-08-20',
        neededWorkDescription: 'Draft cabinet elevations showing integrated refrigerator panel and concealed pantry entry door.',
        notes: 'Check client comment #c2 requesting 10ft ceiling matching millwork.',
        status: 'Pending',
        attachments: [
          {
            id: 'att-3',
            name: 'Pantry_Millwork_Concept_Sketches.pdf',
            size: '1.8 MB',
            type: 'application/pdf',
            url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80'
          }
        ]
      }
    ],
    version_snapshots: [
      {
        id: 'snap-101',
        versionLabel: 'v1.0 - Customer Inquiry',
        timestamp: '2026-07-10T09:30:00Z',
        phase: 'Customer Inquiry',
        createdByName: 'Sarah Jenkins',
        note: 'Initial intake snapshot before layout drafting.',
        comments: [
          {
            id: 'c0',
            author: 'Marcus Vance',
            role: 'customer',
            text: 'Submitted request for 2,850 sq ft Modern Farmhouse floor plan.',
            timestamp: '2026-07-10T09:15:00Z'
          }
        ]
      },
      {
        id: 'snap-102',
        versionLabel: 'v1.1 - Preliminary Layout Pass',
        timestamp: new Date(Date.now() - 3600000 * 20).toISOString(),
        phase: 'Preliminary Layout',
        createdByName: 'Sarah Jenkins',
        note: 'First CAD pass with 10ft ceilings and open kitchen concept.',
        comments: [
          {
            id: 'c1',
            author: 'Sarah Jenkins',
            role: 'drafter',
            text: 'Initial layout complete! Sent primary floorplan with open concept kitchen/dining and 10ft ceiling height across the main living area.',
            timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
          }
        ]
      }
    ],
    time_logs: [
      {
        id: 'tl-1',
        drafterName: 'Sarah Jenkins',
        startTime: new Date(Date.now() - 3600000 * 48).toISOString(),
        endTime: new Date(Date.now() - 3600000 * 45).toISOString(),
        durationSeconds: 10800, // 3 hours
        taskDescription: 'Initial floorplan drafting & room layout scaling',
        hourlyRate: 85
      },
      {
        id: 'tl-2',
        drafterName: 'Sarah Jenkins',
        startTime: new Date(Date.now() - 3600000 * 24).toISOString(),
        endTime: new Date(Date.now() - 3600000 * 21.5).toISOString(),
        durationSeconds: 9000, // 2.5 hours
        taskDescription: 'Vaulted ceiling trusses & kitchen island placement',
        hourlyRate: 85
      }
    ],
    comments: [
      {
        id: 'c1',
        author: 'Sarah Jenkins',
        role: 'drafter',
        text: 'Initial layout complete! Sent primary floorplan with open concept kitchen/dining and 10ft ceiling height across the main living area.',
        timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
      },
      {
        id: 'c2',
        author: 'Marcus Vance',
        role: 'customer',
        text: 'We love the island layout! Could we check if the pantry can be converted to a hidden walk-in pantry behind cabinet doors?',
        timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
        pinnedLocation: { x: 42, y: 35 }
      }
    ],
    deliverables: [
      {
        id: 'd1',
        title: 'Preliminary Floor Plan - Main Level',
        category: 'Floor Plan',
        version: 'v1.1',
        uploadedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
        fileSize: '4.2 MB',
        previewType: 'canvas_floorplan',
        fileUrl: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80',
        fileName: 'Main_Level_Floorplan_v1.1.png',
        changeNotes: 'Revised kitchen island footprint to 10ft length, added hidden walk-in pantry doorway concealed behind custom millwork cabinets.',
        authorDrafter: 'Sarah Jenkins'
      },
      {
        id: 'd2',
        title: 'Front & Rear Exterior Concept Render',
        category: '3D Render',
        version: 'v1.0',
        uploadedAt: new Date(Date.now() - 3600000 * 18).toISOString(),
        fileSize: '12.8 MB',
        previewType: 'render_image',
        fileUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
        fileName: 'Modern_Farmhouse_Exterior_3D_Concept.jpg',
        changeNotes: 'Initial 3D exterior perspective showcasing board-and-batten siding, dark bronze standing seam metal roof accents, and timber truss front porch.',
        authorDrafter: 'Sarah Jenkins'
      }
    ],
    audit_logs: [
      {
        id: 'a1',
        action: 'Job Initialized',
        performedBy: 'Sarah Jenkins',
        timestamp: '2026-07-10T09:00:00Z',
        details: 'Created job M26-195 for Marcus & Elena Vance (Modern Farmhouse 2,850 sq ft)'
      },
      {
        id: 'a2',
        action: 'Status Changed',
        performedBy: 'Sarah Jenkins',
        timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
        details: 'Advanced phase from Customer Inquiry to Preliminary Layout'
      }
    ]
  },
  {
    id: 'job-2',
    job_number: 'M26-198',
    customer_name: 'David & Rachel Sterling',
    customer_email: 'david.sterling@example.com',
    customer_phone: '(555) 876-5432',
    assigned_drafter: 'Alex Rivers, CAD Designer',
    sq_ft: 3400,
    style: 'Barndominium with RV Garage',
    lot_details: '5.2 acre rural lot in Hill Country, no HOA restrictions, well & septic.',
    current_status: 'Customer Review',
    roadblock: true,
    roadblock_note: 'Awaiting updated septic drain field location from County Surveyor before final foundation engineering.',
    layout_reviews_count: 2,
    max_reviews_included: 3,
    last_customer_contact: new Date(Date.now() - 3600000 * 14).toISOString(),
    next_step: 'Awaiting customer feedback on Review #2 regarding RV bay clearance and exterior board & batten finish.',
    created_at: '2026-06-28T10:30:00Z',
    target_completion_date: '2026-08-01',
    estimated_cost: 4200,
    hourly_rate: 90,
    invoice_status: 'Pending Invoicing',
    invoice_number: 'INV-2026-002',
    phase_entry_date: new Date(Date.now() - 3600000 * 216).toISOString(), // 9 days in phase
    delegated_tasks: [
      {
        id: 'del-3',
        jobId: 'job-2',
        jobNumber: 'M26-198',
        customerName: 'David & Rachel Sterling',
        componentTitle: 'RV Bay Clearance & Steel Beam Framing Calculation',
        category: 'Structural Details',
        priority: 'High',
        assignedTo: 'Alex Rivers',
        assignedToEmail: 'alex.rivers@myplanstore.com',
        delegatedBy: 'Kyle',
        delegatedAt: new Date(Date.now() - 3600000 * 8).toISOString(),
        dueDate: '2026-08-22',
        neededWorkDescription: 'Calculate clear span for 14ft overhead garage door. Determine beam size (W-shape steel vs LVL) for 24ft open span.',
        notes: 'Client wants minimum vertical clearance of 15ft 6in inside the shop area. Reference engineering handbook.',
        status: 'In Progress',
        attachments: [
          {
            id: 'att-201',
            name: 'Barndominium_Framing_Section_Kyle.pdf',
            size: '3.4 MB',
            type: 'application/pdf',
            url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80'
          }
        ]
      }
    ],
    comments: [
      {
        id: 'c3',
        author: 'Alex Rivers',
        role: 'drafter',
        text: 'Uploaded Revision 2 incorporating the enlarged 14ft tall RV garage door and guest suite above shop.',
        timestamp: new Date(Date.now() - 3600000 * 16).toISOString()
      },
      {
        id: 'c4',
        author: 'Alex Rivers',
        role: 'drafter',
        text: '🚨 ROADBLOCK FLAGGED: Awaiting updated septic drain field location from County Surveyor before final foundation engineering.',
        timestamp: new Date(Date.now() - 3600000 * 14).toISOString()
      }
    ],
    deliverables: [
      {
        id: 'd3',
        title: 'Floor Plan Rev 2 - Barndominium Shop & Living',
        category: 'Floor Plan',
        version: 'v2.0',
        uploadedAt: new Date(Date.now() - 3600000 * 16).toISOString(),
        fileSize: '5.6 MB',
        previewType: 'canvas_floorplan'
      },
      {
        id: 'd4',
        title: 'Exterior Elevations - Board & Batten',
        category: 'Exterior Elevations',
        version: 'v1.2',
        uploadedAt: new Date(Date.now() - 3600000 * 20).toISOString(),
        fileSize: '3.9 MB',
        previewType: 'canvas_elevation'
      }
    ],
    audit_logs: [
      {
        id: 'a3',
        action: 'Roadblock Flagged',
        performedBy: 'Alex Rivers',
        timestamp: new Date(Date.now() - 3600000 * 14).toISOString(),
        details: 'Marked roadblock active due to septic survey hold.'
      }
    ]
  },
  {
    id: 'job-3',
    job_number: 'M26-201',
    customer_name: 'Horizon Custom Builders (Ref: Oakridge)',
    customer_email: 'projects@horizonbuilders.com',
    customer_phone: '(555) 444-9911',
    assigned_drafter: 'Elena Rostova, Structural Specialist',
    sq_ft: 2200,
    style: 'Craftsman Bungalow',
    lot_details: 'Corner urban lot with strict 20ft front setback and garage side entry requirement.',
    current_status: 'Exterior Elevations',
    roadblock: false,
    layout_reviews_count: 3,
    max_reviews_included: 3,
    last_customer_contact: new Date(Date.now() - 3600000 * 2).toISOString(),
    next_step: 'Drafting roof pitch angles, stone wainscoting details, and porch column structural callouts.',
    created_at: '2026-06-15T14:00:00Z',
    target_completion_date: '2026-07-30',
    estimated_cost: 2950,
    hourly_rate: 85,
    invoice_status: 'Invoiced',
    invoice_number: 'INV-2026-003',
    phase_entry_date: new Date(Date.now() - 3600000 * 96).toISOString(), // 4 days in phase
    delegated_tasks: [
      {
        id: 'del-4',
        jobId: 'job-3',
        jobNumber: 'M26-201',
        customerName: 'Horizon Custom Builders (Ref: Oakridge)',
        componentTitle: 'Front Craftsman Porch Tapered Column & Stone Pier Detail',
        category: 'Exterior Elevations',
        priority: 'Normal',
        assignedTo: 'Elena Rostova',
        assignedToEmail: 'elena.rostova@myplanstore.com',
        delegatedBy: 'Kyle',
        delegatedAt: new Date(Date.now() - 3600000 * 16).toISOString(),
        dueDate: '2026-08-25',
        neededWorkDescription: 'Provide 1/2"=1\'-0" architectural detail of Craftsman square tapered columns resting on battered stone piers.',
        notes: 'Include flashing details and Simpson Strong-Tie post base connection callout for building inspector.',
        status: 'In Progress',
        attachments: [
          {
            id: 'att-301',
            name: 'Craftsman_Porch_Inspiration_Kyle.jpg',
            size: '2.1 MB',
            type: 'image/jpeg',
            url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80'
          }
        ]
      }
    ],
    comments: [
      {
        id: 'c5',
        author: 'Elena Rostova',
        role: 'drafter',
        text: 'Layout reviews approved by Horizon team! Moving forward with exterior elevation sheets and timber truss callouts.',
        timestamp: new Date(Date.now() - 3600000 * 24).toISOString()
      }
    ],
    deliverables: [
      {
        id: 'd5',
        title: 'Approved Main Floor Plan',
        category: 'Floor Plan',
        version: 'v3.0 (Final Approved)',
        uploadedAt: new Date(Date.now() - 3600000 * 30).toISOString(),
        fileSize: '4.8 MB',
        previewType: 'canvas_floorplan'
      },
      {
        id: 'd6',
        title: 'Exterior Elevation Draft - Front & Side',
        category: 'Exterior Elevations',
        version: 'v1.0',
        uploadedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
        fileSize: '6.1 MB',
        previewType: 'canvas_elevation'
      }
    ],
    audit_logs: [
      {
        id: 'a4',
        action: 'Phase Advanced',
        performedBy: 'Elena Rostova',
        timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
        details: 'Moved to Exterior Elevations after layout sign-off.'
      }
    ]
  },
  {
    id: 'job-4',
    job_number: 'M26-204',
    customer_name: 'Dr. Gregory & Cynthia Hayes',
    customer_email: 'g.hayes@medcenter.org',
    customer_phone: '(555) 901-2345',
    assigned_drafter: 'Sarah Jenkins, Senior Architect',
    sq_ft: 4100,
    style: 'Modern Luxury Villa',
    lot_details: 'Golf course waterfront lot with pool deck zoning requirements and glass cantilever structural loads.',
    current_status: 'Construction Prints',
    roadblock: false,
    layout_reviews_count: 2,
    max_reviews_included: 3,
    last_customer_contact: new Date(Date.now() - 3600000 * 8).toISOString(),
    next_step: 'Finalizing electrical plan, HVAC duct layout, and structural engineer wet stamp review.',
    created_at: '2026-05-20T11:00:00Z',
    target_completion_date: '2026-07-28',
    estimated_cost: 5800,
    hourly_rate: 110,
    invoice_status: 'Paid',
    invoice_number: 'INV-2026-004',
    is_archived: true,
    archived_at: '2026-06-25T14:30:00Z',
    archived_by: 'Ethan',
    phase_entry_date: new Date(Date.now() - 3600000 * 48).toISOString(), // 2 days in phase
    delegated_tasks: [
      {
        id: 'del-5',
        jobId: 'job-4',
        jobNumber: 'M26-204',
        customerName: 'Dr. Gregory & Cynthia Hayes',
        componentTitle: 'Cantilevered Glass Wall Framing & Steel Lintel Detailing',
        category: 'Structural Details',
        priority: 'High',
        assignedTo: 'Alex Rivers',
        assignedToEmail: 'alex.rivers@myplanstore.com',
        delegatedBy: 'Kyle',
        delegatedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
        dueDate: '2026-08-20',
        neededWorkDescription: 'Engineer 18ft rear cantilevered glass wall framing connection and steel column base anchorage.',
        notes: 'Please double-check load calculations with local building code wind uplift specifications.',
        status: 'Completed',
        completedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        completedBy: 'Alex Rivers',
        completionNotes: 'Completed cantilever framing calculations and drafted Sheet S2.1 with Simpson Strong-Tie connections and W-beam moment connections. Uploaded DWG and PDF stamp package ready for your sign-off.',
        attachments: [
          {
            id: 'att-501',
            name: 'Cantilever_Glass_Wall_Detail_S2.1.pdf',
            size: '4.2 MB',
            type: 'application/pdf',
            url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80'
          },
          {
            id: 'att-502',
            name: 'Deck_Steel_Anchorage_Revision.dwg',
            size: '6.8 MB',
            type: 'application/acad',
            url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80'
          }
        ]
      }
    ],
    comments: [
      {
        id: 'c6',
        author: 'Sarah Jenkins',
        role: 'drafter',
        text: 'Structural engineer approved the 18ft rear glass wall lintels. Assembly sheets are being formatted for municipal building permit submission.',
        timestamp: new Date(Date.now() - 3600000 * 8).toISOString()
      }
    ],
    deliverables: [
      {
        id: 'd7',
        title: 'Architectural Construction Set (Sheet A1-A8)',
        category: 'PDF Specs',
        version: 'v1.0 Ready for Permit',
        uploadedAt: new Date(Date.now() - 3600000 * 10).toISOString(),
        fileSize: '18.4 MB',
        previewType: 'pdf_spec'
      }
    ],
    audit_logs: [
      {
        id: 'a5',
        action: 'Phase Advanced',
        performedBy: 'Sarah Jenkins',
        timestamp: new Date(Date.now() - 3600000 * 48).toISOString(),
        details: 'Advanced to Construction Prints.'
      }
    ]
  },
  {
    id: 'job-5',
    job_number: 'M26-209',
    customer_name: 'Samantha Thorne',
    customer_email: 'sthorne.design@gmail.com',
    customer_phone: '(555) 321-7654',
    assigned_drafter: 'James, Architectural Drafter',
    sq_ft: 1850,
    style: 'Coastal Cottage',
    lot_details: 'Elevated pilings on coastal flood plain zone V-12.',
    current_status: 'Customer Inquiry',
    roadblock: false,
    layout_reviews_count: 0,
    max_reviews_included: 3,
    last_customer_contact: new Date(Date.now() - 3600000 * 1).toISOString(),
    next_step: 'Initial intake interview & collecting site boundary survey map.',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    target_completion_date: '2026-08-30',
    estimated_cost: 2600,
    hourly_rate: 85,
    invoice_status: 'Uninvoiced',
    phase_entry_date: new Date(Date.now() - 3600000 * 2).toISOString(), // 2 hours in phase
    comments: [
      {
        id: 'c7',
        author: 'Samantha Thorne',
        role: 'customer',
        text: 'Hi James! Just sent over the site plan from the surveyor with tidal boundary lines.',
        timestamp: new Date(Date.now() - 3600000 * 1).toISOString()
      }
    ],
    deliverables: [],
    audit_logs: [
      {
        id: 'a6',
        action: 'Job Created',
        performedBy: 'System Intake',
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
        details: 'Customer inquiry created via website intake form.'
      }
    ]
  },
  {
    id: 'job-6',
    job_number: 'M26-212',
    customer_name: 'Nathan & Chloe Miller',
    customer_email: 'nathan.miller@example.com',
    customer_phone: '(555) 789-0123',
    assigned_drafter: 'Aaron, Architectural Drafter',
    sq_ft: 2650,
    style: 'Scandinavian Modern Timber',
    lot_details: 'Wooded 1.2 acre lot with steep southern hillside exposure.',
    current_status: 'Preliminary Layout',
    roadblock: false,
    layout_reviews_count: 1,
    max_reviews_included: 3,
    last_customer_contact: new Date(Date.now() - 3600000 * 3).toISOString(),
    next_step: 'Drafting open timber post & beam grid and cathedral ceiling glass wall.',
    created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
    target_completion_date: '2026-09-10',
    estimated_cost: 3100,
    hourly_rate: 85,
    invoice_status: 'Pending Invoicing',
    invoice_number: 'INV-2026-006',
    phase_entry_date: new Date(Date.now() - 3600000 * 24).toISOString(),
    delegated_tasks: [
      {
        id: 'del-aaron-1',
        jobId: 'job-6',
        jobNumber: 'M26-212',
        customerName: 'Nathan & Chloe Miller',
        componentTitle: 'Cathedral Ceiling Timber Beam Detail',
        category: 'Structural Details',
        priority: 'High',
        assignedTo: 'Aaron',
        assignedToEmail: 'aaron@myplanstore.com',
        delegatedBy: 'Kyle',
        delegatedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
        dueDate: '2026-08-25',
        neededWorkDescription: 'Structural connection detail for exposed Douglas Fir glulam ridge beam.',
        notes: 'Check slope calculations for 8:12 cathedral pitch.',
        status: 'In Progress',
        attachments: []
      }
    ],
    time_logs: [
      {
        id: 'tl-aaron-1',
        drafterName: 'Aaron',
        startTime: new Date(Date.now() - 3600000 * 6).toISOString(),
        endTime: new Date(Date.now() - 3600000 * 3.5).toISOString(),
        durationSeconds: 9000,
        taskDescription: 'Preliminary timber grid & master layout drafting',
        hourlyRate: 85
      }
    ],
    comments: [
      {
        id: 'c8',
        author: 'Aaron',
        role: 'drafter',
        text: 'Initial post and beam layout draft completed. Preparing preliminary elevation sketches.',
        timestamp: new Date(Date.now() - 3600000 * 3).toISOString()
      }
    ],
    deliverables: [
      {
        id: 'd8',
        title: 'Timber Layout Concept Draft',
        category: 'Floor Plan',
        version: 'v1.0',
        uploadedAt: new Date(Date.now() - 3600000 * 3.5).toISOString(),
        fileSize: '3.4 MB',
        previewType: 'canvas_floorplan'
      }
    ],
    audit_logs: [
      {
        id: 'a7',
        action: 'Layout Started',
        performedBy: 'Aaron',
        timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
        details: 'Aaron commenced preliminary timber layout.'
      }
    ]
  }
];

export const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
  // Ethan (Operations & Project Manager) Messages
  {
    id: 'msg-ethan-1',
    senderId: 'staff-jason',
    senderName: 'Jason',
    senderRole: 'Project Manager & Operations',
    text: 'Hey @Ethan, can you review the Truss calculations and structural sign-off on #MPS-2024-002 before we send the customer invoice?',
    timestamp: new Date(Date.now() - 3600000 * 2.5).toISOString(),
    mentions: ['Ethan'],
    referencedJobNumbers: ['MPS-2024-002'],
    readByStaffIds: ['staff-jason'],
    channelId: 'general'
  },
  {
    id: 'msg-ethan-2',
    senderId: 'staff-ethan',
    senderName: 'Ethan',
    senderRole: 'Operations & Project Manager',
    text: 'Checked #MPS-2024-002. Truss layouts and engineering stamps look solid. Permitting packet is good to go for customer invoicing!',
    timestamp: new Date(Date.now() - 3600000 * 1.8).toISOString(),
    mentions: ['Jason'],
    referencedJobNumbers: ['MPS-2024-002'],
    replyToId: 'msg-ethan-1',
    replyToMessage: {
      id: 'msg-ethan-1',
      senderName: 'Jason',
      text: 'Hey @Ethan, can you review the Truss calculations and structural sign-off on #MPS-2024-002 before we send the customer invoice?'
    },
    readByStaffIds: ['staff-ethan', 'staff-jason'],
    channelId: 'general'
  },
  {
    id: 'msg-ethan-3',
    senderId: 'staff-greg',
    senderName: 'Greg Hyatt',
    senderRole: 'Owner & Founder',
    text: '@Ethan please check the operations schedule for the upcoming 5 modern farmhouse submissions.',
    timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
    mentions: ['Ethan'],
    readByStaffIds: ['staff-greg'],
    channelId: 'general'
  },
  {
    id: 'msg-ethan-4',
    senderId: 'staff-ethan',
    senderName: 'Ethan',
    senderRole: 'Operations & Project Manager',
    text: '@Greg Hyatt scheduled Aaron and Sarah on the primary intake queues. We are on track for this sprint.',
    timestamp: new Date(Date.now() - 3600000 * 4.2).toISOString(),
    mentions: ['Greg Hyatt'],
    replyToId: 'msg-ethan-3',
    replyToMessage: {
      id: 'msg-ethan-3',
      senderName: 'Greg Hyatt',
      text: '@Ethan please check the operations schedule for the upcoming 5 modern farmhouse submissions.'
    },
    readByStaffIds: ['staff-ethan', 'staff-greg'],
    channelId: 'general'
  },

  // Kyle & Sarah Jenkins
  {
    id: 'msg-1',
    senderId: 'staff-kyle',
    senderName: 'Kyle',
    senderRole: 'Lead Project Manager & Senior Drafter',
    text: 'Hey @Sarah Jenkins, can you double check the garage header heights on #MPS-2024-001? Customer asked if we can raise ceiling clearance to 10ft.',
    timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
    mentions: ['Sarah Jenkins'],
    referencedJobNumbers: ['MPS-2024-001'],
    readByStaffIds: ['staff-kyle', 'staff-sarah', 'staff-jason'],
    channelId: 'general'
  },
  {
    id: 'msg-2',
    senderId: 'staff-sarah',
    senderName: 'Sarah Jenkins',
    senderRole: 'Senior Architect',
    text: 'Checked #MPS-2024-001, updated the header spans and raised clearance to 10\'-4" clearance! Deliverables are uploaded for review.',
    timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
    mentions: ['Kyle'],
    referencedJobNumbers: ['MPS-2024-001'],
    replyToId: 'msg-1',
    replyToMessage: {
      id: 'msg-1',
      senderName: 'Kyle',
      text: 'Hey @Sarah Jenkins, can you double check the garage header heights on #MPS-2024-001?...'
    },
    readByStaffIds: ['staff-sarah', 'staff-kyle'],
    channelId: 'general'
  },

  // Jason & Greg Hyatt
  {
    id: 'msg-3',
    senderId: 'staff-jason',
    senderName: 'Jason',
    senderRole: 'Project Manager & Operations',
    text: '@Greg Hyatt the preliminary structural permit packet for #MPS-2024-003 is signed off by engineering. Ready for customer review stage.',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    mentions: ['Greg Hyatt'],
    referencedJobNumbers: ['MPS-2024-003'],
    readByStaffIds: ['staff-jason', 'staff-kyle'],
    channelId: 'general'
  },
  {
    id: 'msg-greg-resp',
    senderId: 'staff-greg',
    senderName: 'Greg Hyatt',
    senderRole: 'Owner & Founder',
    text: '@Jason verified and approved for customer review delivery.',
    timestamp: new Date(Date.now() - 3600000 * 1.6).toISOString(),
    mentions: ['Jason'],
    referencedJobNumbers: ['MPS-2024-003'],
    replyToId: 'msg-3',
    readByStaffIds: ['staff-greg', 'staff-jason'],
    channelId: 'general'
  },

  // Kyle & Aaron
  {
    id: 'msg-4',
    senderId: 'staff-kyle',
    senderName: 'Kyle',
    senderRole: 'Lead Project Manager & Senior Drafter',
    text: 'Hey @Aaron, please check the setback boundary on #MPS-test when you have a moment.',
    timestamp: new Date(Date.now() - 3600000 * 1.5).toISOString(),
    mentions: ['Aaron'],
    referencedJobNumbers: ['MPS-test'],
    readByStaffIds: ['staff-kyle', 'staff-aaron'],
    channelId: 'general'
  },
  {
    id: 'msg-5',
    senderId: 'staff-aaron',
    senderName: 'Aaron',
    senderRole: 'Architectural Drafter',
    text: 'Took a look at #MPS-test, 25ft front setback and 10ft side setbacks are all verified with local county code.',
    timestamp: new Date(Date.now() - 3600000 * 0.5).toISOString(),
    mentions: ['Kyle'],
    referencedJobNumbers: ['MPS-test'],
    replyToId: 'msg-4',
    replyToMessage: {
      id: 'msg-4',
      senderName: 'Kyle',
      text: 'Hey @Aaron, please check the setback boundary on #MPS-test when you have a moment.'
    },
    readByStaffIds: ['staff-aaron', 'staff-kyle'],
    channelId: 'general'
  },

  // Alex Rivers & Jason
  {
    id: 'msg-al-1',
    senderId: 'staff-jason',
    senderName: 'Jason',
    senderRole: 'Project Manager & Operations',
    text: 'Hey @Alex Rivers, can you upload the 3D exterior rendering for #MPS-2024-002 when ready?',
    timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
    mentions: ['Alex Rivers'],
    referencedJobNumbers: ['MPS-2024-002'],
    readByStaffIds: ['staff-jason', 'staff-alex'],
    channelId: 'general'
  },
  {
    id: 'msg-al-2',
    senderId: 'staff-alex',
    senderName: 'Alex Rivers',
    senderRole: 'CAD Designer',
    text: 'Rendering v2 is uploaded in deliverables for #MPS-2024-002! Let me know if the trim colors need tweaking.',
    timestamp: new Date(Date.now() - 3600000 * 3.2).toISOString(),
    mentions: ['Jason'],
    referencedJobNumbers: ['MPS-2024-002'],
    replyToId: 'msg-al-1',
    readByStaffIds: ['staff-alex', 'staff-jason'],
    channelId: 'general'
  },

  // James & Jason
  {
    id: 'msg-jm-1',
    senderId: 'staff-jason',
    senderName: 'Jason',
    senderRole: 'Project Manager & Operations',
    text: 'Hey @James, I delegated the hidden pantry CAD detail for #M26-195. Let me know if you need the sketch reference.',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    mentions: ['James'],
    referencedJobNumbers: ['M26-195'],
    readByStaffIds: ['staff-jason', 'staff-james'],
    channelId: 'general'
  },
  {
    id: 'msg-jm-2',
    senderId: 'staff-james',
    senderName: 'James',
    senderRole: 'Architectural Drafter',
    text: '@Jason got the concept sketches, drafting the millwork elevations and detail sections now.',
    timestamp: new Date(Date.now() - 3600000 * 1.2).toISOString(),
    mentions: ['Jason'],
    referencedJobNumbers: ['M26-195'],
    replyToId: 'msg-jm-1',
    readByStaffIds: ['staff-james', 'staff-jason'],
    channelId: 'general'
  },

  // Elena Rostova & Kyle
  {
    id: 'msg-el-1',
    senderId: 'staff-kyle',
    senderName: 'Kyle',
    senderRole: 'Lead Project Manager & Senior Drafter',
    text: 'Hey @Elena Rostova, can you review the shear wall placement and anchor spacing on #MPS-2024-004?',
    timestamp: new Date(Date.now() - 3600000 * 3.5).toISOString(),
    mentions: ['Elena Rostova'],
    referencedJobNumbers: ['MPS-2024-004'],
    readByStaffIds: ['staff-kyle', 'staff-elena'],
    channelId: 'general'
  },
  {
    id: 'msg-el-2',
    senderId: 'staff-elena',
    senderName: 'Elena Rostova',
    senderRole: 'Structural Specialist',
    text: '@Kyle shear wall calcs and anchor bolt spacing updated on sheet S-101 for #MPS-2024-004.',
    timestamp: new Date(Date.now() - 3600000 * 2.8).toISOString(),
    mentions: ['Kyle'],
    referencedJobNumbers: ['MPS-2024-004'],
    replyToId: 'msg-el-1',
    readByStaffIds: ['staff-elena', 'staff-kyle'],
    channelId: 'general'
  },

  // Drew Lupkey & Greg Hyatt
  {
    id: 'msg-dr-1',
    senderId: 'staff-greg',
    senderName: 'Greg Hyatt',
    senderRole: 'Owner & Founder',
    text: '@Drew Lupkey can you run the weekly invoicing audit for the closed and pending projects?',
    timestamp: new Date(Date.now() - 3600000 * 4.5).toISOString(),
    mentions: ['Drew Lupkey'],
    readByStaffIds: ['staff-greg', 'staff-drew'],
    channelId: 'general'
  },
  {
    id: 'msg-dr-2',
    senderId: 'staff-drew',
    senderName: 'Drew Lupkey',
    senderRole: 'Finance & Project Admin',
    text: '@Greg Hyatt billing audit complete and invoice summaries exported. Ready for distribution.',
    timestamp: new Date(Date.now() - 3600000 * 3.8).toISOString(),
    mentions: ['Greg Hyatt'],
    replyToId: 'msg-dr-1',
    readByStaffIds: ['staff-drew', 'staff-greg'],
    channelId: 'general'
  }
];

export const STORAGE_KEY = 'my_plan_store_os_jobs_v10';
export const NOTIFS_STORAGE_KEY = 'my_plan_store_os_notifs_v10';
export const CHAT_STORAGE_KEY = 'my_plan_store_os_chat_v10';

export function getStoredJobs(): Job[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_JOBS));
      return INITIAL_JOBS;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load stored jobs:', err);
    return INITIAL_JOBS;
  }
}

export function saveStoredJobs(jobs: Job[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  } catch (err) {
    console.error('Failed to save jobs:', err);
  }
}

export function getStoredNotifications(): AppNotification[] {
  try {
    const raw = localStorage.getItem(NOTIFS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(NOTIFS_STORAGE_KEY, JSON.stringify(INITIAL_NOTIFICATIONS));
      return INITIAL_NOTIFICATIONS;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load notifications:', err);
    return INITIAL_NOTIFICATIONS;
  }
}

export function saveStoredNotifications(notifs: AppNotification[]) {
  try {
    localStorage.setItem(NOTIFS_STORAGE_KEY, JSON.stringify(notifs));
  } catch (err) {
    console.error('Failed to save notifications:', err);
  }
}

export function getStoredChatMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(INITIAL_CHAT_MESSAGES));
      return INITIAL_CHAT_MESSAGES;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load chat messages:', err);
    return INITIAL_CHAT_MESSAGES;
  }
}

export function saveStoredChatMessages(messages: ChatMessage[]) {
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
  } catch (err) {
    console.error('Failed to save chat messages:', err);
  }
}

export function resetStoredJobs(): Job[] {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_JOBS));
  localStorage.setItem(NOTIFS_STORAGE_KEY, JSON.stringify(INITIAL_NOTIFICATIONS));
  localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(INITIAL_CHAT_MESSAGES));
  return INITIAL_JOBS;
}
