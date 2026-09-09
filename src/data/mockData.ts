import { Job, JobPhase, StaffUser, DelegatedWorkItem, AppNotification, ChatMessage, TimeCardShift } from '../types';

export function isStaffExemptFromClock(userNameOrStaff?: string | StaffUser): boolean {
  // No one is hardcoded exempt; all staff including Greg use the shift timeclock bar
  return false;
}

export const STAFF_USERS: StaffUser[] = [
  {
    id: 'staff-greg',
    name: 'Greg Hyatt',
    email: 'arkcwd@gmail.com',
    title: 'Owner & Principal Architect',
    phone: '(555) 234-5678',
    role: 'admin',
    department: 'Architecture',
    hourlyRate: 150,
    status: 'active',
    joinedDate: '2021-01-15',
    canAccessFinancials: true,
    canDelegate: true,
    canViewAllProjects: true,
    canManageStaff: true,      // Superadmin / Owner
    canManageInvoices: true,
    canEditJobPhases: true,
    canManageRoadblocks: true
  }
];

export const AUTHORIZED_FINANCIAL_NAMES = ['Greg Hyatt'];
export const AUTHORIZED_DELEGATOR_NAMES = ['Greg Hyatt'];
export const AUTHORIZED_ALL_PROJECTS_NAMES = ['Greg Hyatt'];

export function canViewAllProjectCards(userNameOrStaff?: string | StaffUser): boolean {
  if (!userNameOrStaff) return false;
  if (typeof userNameOrStaff === 'object') {
    if (typeof userNameOrStaff.canViewAllProjects === 'boolean') {
      return userNameOrStaff.canViewAllProjects;
    }
    const name = userNameOrStaff.name;
    return AUTHORIZED_ALL_PROJECTS_NAMES.some(n => name.toLowerCase().includes(n.toLowerCase()));
  }
  const name = userNameOrStaff;
  return AUTHORIZED_ALL_PROJECTS_NAMES.some(n => name.toLowerCase().includes(n.toLowerCase()));
}

export function isJobArchived(job: Job): boolean {
  return Boolean(job.is_archived || job.invoice_status === 'Paid');
}

export function canUserAccessFinancials(userNameOrStaff?: string | StaffUser): boolean {
  if (!userNameOrStaff) return false;
  if (typeof userNameOrStaff === 'object') {
    if (typeof userNameOrStaff.canAccessFinancials === 'boolean') {
      return userNameOrStaff.canAccessFinancials;
    }
    const name = userNameOrStaff.name;
    return AUTHORIZED_FINANCIAL_NAMES.some(n => name.toLowerCase().includes(n.toLowerCase()));
  }
  const name = userNameOrStaff;
  return AUTHORIZED_FINANCIAL_NAMES.some(n => name.toLowerCase().includes(n.toLowerCase()));
}

export function canUserDelegate(userNameOrStaff?: string | StaffUser): boolean {
  if (!userNameOrStaff) return false;
  if (typeof userNameOrStaff === 'object') {
    if (typeof userNameOrStaff.canDelegate === 'boolean') {
      return userNameOrStaff.canDelegate;
    }
    const name = userNameOrStaff.name;
    return AUTHORIZED_DELEGATOR_NAMES.some(n => name.toLowerCase().includes(n.toLowerCase()));
  }
  const name = userNameOrStaff;
  return AUTHORIZED_DELEGATOR_NAMES.some(n => name.toLowerCase().includes(n.toLowerCase()));
}

export function canUserManageStaff(userNameOrStaff?: string | StaffUser): boolean {
  if (!userNameOrStaff) return false;
  if (typeof userNameOrStaff === 'object') {
    if (typeof userNameOrStaff.canManageStaff === 'boolean') {
      return userNameOrStaff.canManageStaff;
    }
    return userNameOrStaff.name.toLowerCase().includes('greg hyatt') || userNameOrStaff.role === 'admin';
  }
  return userNameOrStaff.toLowerCase().includes('greg hyatt');
}

export function canUserManageInvoices(userNameOrStaff?: string | StaffUser): boolean {
  if (!userNameOrStaff) return false;
  if (typeof userNameOrStaff === 'object') {
    if (typeof userNameOrStaff.canManageInvoices === 'boolean') {
      return userNameOrStaff.canManageInvoices;
    }
    return userNameOrStaff.canAccessFinancials;
  }
  return canUserAccessFinancials(userNameOrStaff);
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
    id: 'notif-greg-welcome',
    recipientName: 'Greg Hyatt',
    recipientEmail: 'arkcwd@gmail.com',
    title: 'Workspace Ready for Staff Onboarding',
    message: 'All mock staff profiles removed. When staff sign up, you can configure their permissions in Staff Management.',
    timestamp: new Date().toISOString(),
    read: false,
    type: 'comment',
    senderName: 'System'
  }
];

export const INITIAL_JOBS: Job[] = [
  {
    id: 'job-1',
    job_number: 'M26-195',
    customer_name: 'Testing Dummy',
    customer_email: 'testing.dummy@example.com',
    customer_phone: '(555) 234-5678',
    assigned_drafter: 'Kyle, Lead Project Manager & Senior Drafter',
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
    deposit_collected: true,
    deposit_amount: 1500,
    deposit_date: '2026-07-10',
    deposit_notes: 'Initial 50% retainer paid via Stripe',
    invoice_status: 'Invoiced',
    invoice_number: 'INV-2026-001',
    phase_entry_date: new Date(Date.now() - 3600000 * 72).toISOString(), // 3 days in current phase
    delegated_tasks: [
      {
        id: 'del-1',
        jobId: 'job-1',
        jobNumber: 'M26-195',
        customerName: 'Testing Dummy',
        componentTitle: 'Foundation & Stem Wall Structural Detail',
        category: 'Foundation Plan',
        priority: 'High',
        assignedTo: 'James',
        assignedToEmail: 'james@myplanstore.com',
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
        customerName: 'Testing Dummy',
        componentTitle: 'Hidden Pantry Millwork & Kitchen Island CAD Detail',
        category: 'Floor Plan',
        priority: 'Normal',
        assignedTo: 'Aaron',
        assignedToEmail: 'aaron@myplanstore.com',
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
        createdByName: 'Kyle',
        note: 'Initial intake snapshot before layout drafting.',
        comments: [
          {
            id: 'c0',
            author: 'Testing Dummy',
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
        createdByName: 'Kyle',
        note: 'First CAD pass with 10ft ceilings and open kitchen concept.',
        comments: [
          {
            id: 'c1',
            author: 'Kyle',
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
        drafterName: 'Kyle',
        startTime: new Date(Date.now() - 3600000 * 48).toISOString(),
        endTime: new Date(Date.now() - 3600000 * 45).toISOString(),
        durationSeconds: 10800, // 3 hours
        taskDescription: 'Initial floorplan drafting & room layout scaling',
        hourlyRate: 85
      },
      {
        id: 'tl-2',
        drafterName: 'James',
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
        author: 'Kyle',
        role: 'drafter',
        text: 'Initial layout complete! Sent primary floorplan with open concept kitchen/dining and 10ft ceiling height across the main living area.',
        timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
      },
      {
        id: 'c2',
        author: 'Testing Dummy',
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
        authorDrafter: 'Kyle'
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
        authorDrafter: 'James'
      }
    ],
    audit_logs: [
      {
        id: 'a1',
        action: 'Job Initialized',
        performedBy: 'Kyle',
        timestamp: '2026-07-10T09:00:00Z',
        details: 'Created job M26-195 for Testing Dummy (Modern Farmhouse 2,850 sq ft)'
      },
      {
        id: 'a2',
        action: 'Status Changed',
        performedBy: 'Kyle',
        timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
        details: 'Advanced phase from Customer Inquiry to Preliminary Layout'
      }
    ]
  },
  {
    id: 'job-m26-214',
    job_number: 'M26-214',
    owner: 'JB',
    project_name: 'Ceci McFee',
    customer_name: 'Ceci McFee',
    sq_ft_goal: '1800-1900',
    sq_ft: 1850,
    style: 'Custom Residential',
    lot_details: '203 Tom Miller Lane, Bismarck. Front orientation, standard setbacks.',
    project_address: '203 Tom Miller Lane, Bismarck',
    customer_email: 'ceci.mcfee@live.com',
    customer_phone: '501-538-9862',
    builder: 'Zach Ritter',
    sheet_status: 'Customer Review',
    status_note: '',
    completed: false,
    phase_name: 'Layout',
    current_status: 'Customer Review',
    roadblock: false,
    layout_reviews_count: 1,
    max_reviews_included: 3,
    last_customer_contact: '2026-09-06T10:00:00.000Z',
    next_step: 'Customer review of layout package in coordination with Zach Ritter',
    created_at: '2026-08-10T08:03:02.000Z',
    target_completion_date: '2026-09-18',
    estimated_cost: 2250,
    hourly_rate: 85,
    deposit_collected: true,
    deposit_amount: 1125,
    deposit_date: '2026-08-10',
    deposit_notes: '50% retainer paid on intake',
    invoice_status: 'Pending Invoicing',
    invoice_number: 'INV-2026-M26214',
    total_time_entries: 7,
    total_duration_minutes: 552,
    total_duration_hours: 9.2,
    assigned_drafter: 'Kyle',
    project_manager: 'Jason',
    time_logs: [
      {
        id: 't-214-1',
        drafterName: 'Kyle',
        startTime: '2026-08-11T09:00:00.000Z',
        durationSeconds: 5400, // 90 min (1.50h)
        taskDescription: 'Initial CAD Floor Plan Layout & Dimensioning',
        billingCategory: 'Standard Offline CAD Drafting',
        hourlyRate: 85,
        billableHours: 1.5,
        billableAmount: 127.50
      },
      {
        id: 't-214-2',
        drafterName: 'Kyle',
        startTime: '2026-08-14T10:30:00.000Z',
        durationSeconds: 4500, // 75 min (1.25h)
        taskDescription: 'Master Suite Flow & Kitchen Island Space Optimization',
        billingCategory: 'Standard Offline CAD Drafting',
        hourlyRate: 85,
        billableHours: 1.25,
        billableAmount: 106.25
      },
      {
        id: 't-214-3',
        drafterName: 'James',
        startTime: '2026-08-18T13:00:00.000Z',
        durationSeconds: 3600, // 60 min (1.00h)
        taskDescription: 'Roofline Geometry & Exterior Elevations Drafting',
        billingCategory: 'Standard Offline CAD Drafting',
        hourlyRate: 85,
        billableHours: 1.0,
        billableAmount: 85.00
      },
      {
        id: 't-214-4',
        drafterName: 'James',
        startTime: '2026-08-22T09:30:00.000Z',
        durationSeconds: 5400, // 90 min (1.50h)
        taskDescription: 'Foundation & Footing Structural Coordination',
        billingCategory: 'Standard Offline CAD Drafting',
        hourlyRate: 85,
        billableHours: 1.5,
        billableAmount: 127.50
      },
      {
        id: 't-214-5',
        drafterName: 'Aaron',
        startTime: '2026-08-26T11:00:00.000Z',
        durationSeconds: 3600, // 60 min (1.00h)
        taskDescription: 'Electrical Schematics & Reflected Ceiling Layout',
        billingCategory: 'Standard Offline CAD Drafting',
        hourlyRate: 85,
        billableHours: 1.0,
        billableAmount: 85.00
      },
      {
        id: 't-214-6',
        drafterName: 'Kyle',
        startTime: '2026-09-01T14:00:00.000Z',
        durationSeconds: 5400, // 90 min (1.50h)
        taskDescription: 'Customer Review Markup Adjustments & Window Schedule',
        billingCategory: 'Standard Offline CAD Drafting',
        hourlyRate: 85,
        billableHours: 1.5,
        billableAmount: 127.50
      },
      {
        id: 't-214-7',
        drafterName: 'Kyle',
        startTime: '2026-09-05T10:00:00.000Z',
        durationSeconds: 5220, // 87 min (1.45h) -> 90+75+60+90+60+90+87 = 552 mins = 9.20 hrs
        taskDescription: 'Layout Package Assembly & Review Sheet Export',
        billingCategory: 'Standard Offline CAD Drafting',
        hourlyRate: 85,
        billableHours: 1.45,
        billableAmount: 123.25
      }
    ],
    delegated_tasks: [],
    deliverables: [
      {
        id: 'deliv-214-1',
        title: 'Floor Plan Review Set (1,850 sq ft)',
        category: 'Floor Plan',
        version: 'v1.0',
        uploadedAt: '2026-09-05T11:30:00.000Z',
        fileSize: '3.8 MB',
        previewType: 'canvas_floorplan',
        authorDrafter: 'Kyle'
      }
    ],
    comments: [
      {
        id: 'c-214-1',
        author: 'Kyle',
        role: 'drafter',
        text: 'Layout package exported and sent to Ceci McFee and Zach Ritter for preliminary review.',
        timestamp: '2026-09-05T12:00:00.000Z'
      }
    ],
    audit_logs: [
      {
        id: 'a-214-1',
        action: 'Job Initialized',
        performedBy: 'Jason',
        timestamp: '2026-08-10T08:03:02.000Z',
        details: 'Intake created from sheet. Builder: Zach Ritter. Target: 1800-1900 sq ft.'
      }
    ]
  },
  {
    id: 'job-m26-218',
    job_number: 'M26-218',
    owner: 'JB',
    project_name: 'Peggy Thompson - Remodel',
    customer_name: 'Peggy Thompson',
    sq_ft_goal: '1800-2200',
    sq_ft: 2000,
    style: 'Remodel',
    lot_details: '1820 N Tyler St, LR. Existing residential footprint remodel.',
    project_address: '1820 N Tyler St, LR',
    customer_email: 'brock@thompsondriving.com; peggytdrv@sbcglobal.net',
    customer_phone: '501-626-9200; 501-350-7758',
    builder: '',
    sheet_status: 'Changes',
    status_note: '',
    completed: false,
    phase_name: 'Prelim',
    current_status: 'Revisions',
    roadblock: false,
    layout_reviews_count: 2,
    max_reviews_included: 3,
    last_customer_contact: '2026-09-07T11:30:00.000Z',
    next_step: 'Implementing customer changes on living room and master bath remodel',
    created_at: '2026-08-20T14:02:52.000Z',
    target_completion_date: '2026-09-25',
    estimated_cost: 2600,
    hourly_rate: 85,
    deposit_collected: true,
    deposit_amount: 1200,
    deposit_date: '2026-08-20',
    deposit_notes: 'Initial retainer paid',
    invoice_status: 'Uninvoiced',
    invoice_number: 'INV-2026-M26218',
    total_time_entries: 10,
    total_duration_minutes: 593,
    total_duration_hours: 9.88,
    assigned_drafter: 'James',
    project_manager: 'Jason',
    time_logs: [
      {
        id: 't-218-1',
        drafterName: 'James',
        startTime: '2026-08-21T09:00:00.000Z',
        durationSeconds: 3600, // 60m
        taskDescription: 'As-Built Existing Measurements & Wall Verification',
        billingCategory: 'Standard Offline CAD Drafting',
        hourlyRate: 85,
        billableHours: 1.0,
        billableAmount: 85.00
      },
      {
        id: 't-218-2',
        drafterName: 'James',
        startTime: '2026-08-22T10:00:00.000Z',
        durationSeconds: 3600, // 60m
        taskDescription: 'Demolition Plan & Load-Bearing Wall Check',
        billingCategory: 'Standard Offline CAD Drafting',
        hourlyRate: 85,
        billableHours: 1.0,
        billableAmount: 85.00
      },
      {
        id: 't-218-3',
        drafterName: 'James',
        startTime: '2026-08-25T13:00:00.000Z',
        durationSeconds: 3600, // 60m
        taskDescription: 'Proposed Remodel Main Living & Kitchen Concept',
        billingCategory: 'Standard Offline CAD Drafting',
        hourlyRate: 85,
        billableHours: 1.0,
        billableAmount: 85.00
      },
      {
        id: 't-218-4',
        drafterName: 'James',
        startTime: '2026-08-27T11:00:00.000Z',
        durationSeconds: 3600, // 60m
        taskDescription: 'Master Bath Expansion & Plumbing Reroute Layout',
        billingCategory: 'Standard Offline CAD Drafting',
        hourlyRate: 85,
        billableHours: 1.0,
        billableAmount: 85.00
      },
      {
        id: 't-218-5',
        drafterName: 'Aaron',
        startTime: '2026-08-29T14:00:00.000Z',
        durationSeconds: 2700, // 45m
        taskDescription: 'Electrical & Lighting Plan for Remodel Zones',
        billingCategory: 'Standard Offline CAD Drafting',
        hourlyRate: 85,
        billableHours: 0.75,
        billableAmount: 63.75
      },
      {
        id: 't-218-6',
        drafterName: 'James',
        startTime: '2026-09-01T09:30:00.000Z',
        durationSeconds: 3600, // 60m
        taskDescription: 'Structural Header & Beam Framing Specs',
        billingCategory: 'Standard Offline CAD Drafting',
        hourlyRate: 85,
        billableHours: 1.0,
        billableAmount: 85.00
      },
      {
        id: 't-218-7',
        drafterName: 'James',
        startTime: '2026-09-02T13:30:00.000Z',
        durationSeconds: 3600, // 60m
        taskDescription: 'Window & Door Alterations Schedule',
        billingCategory: 'Standard Offline CAD Drafting',
        hourlyRate: 85,
        billableHours: 1.0,
        billableAmount: 85.00
      },
      {
        id: 't-218-8',
        drafterName: 'James',
        startTime: '2026-09-03T10:00:00.000Z',
        durationSeconds: 3600, // 60m
        taskDescription: 'Elevation Changes for Rear Addition',
        billingCategory: 'Standard Offline CAD Drafting',
        hourlyRate: 85,
        billableHours: 1.0,
        billableAmount: 85.00
      },
      {
        id: 't-218-9',
        drafterName: 'James',
        startTime: '2026-09-04T15:00:00.000Z',
        durationSeconds: 4080, // 68m (1.13h)
        taskDescription: 'Client Changes & Kitchen Island Revision',
        billingCategory: 'Standard Offline CAD Drafting',
        hourlyRate: 85,
        billableHours: 1.13,
        billableAmount: 96.33
      },
      {
        id: 't-218-10',
        drafterName: 'James',
        startTime: '2026-09-06T11:00:00.000Z',
        durationSeconds: 3600, // 60m -> Sum: 60*7 + 45 + 68 + 60 = 593 mins = 9.88 hrs
        taskDescription: 'Prelim Set Assembly & Construction Note Callouts',
        billingCategory: 'Standard Offline CAD Drafting',
        hourlyRate: 85,
        billableHours: 1.0,
        billableAmount: 85.00
      }
    ],
    delegated_tasks: [],
    deliverables: [
      {
        id: 'deliv-218-1',
        title: 'Remodel Floor Plan & Demolition Schedule',
        category: 'Floor Plan',
        version: 'v1.1',
        uploadedAt: '2026-09-04T16:00:00.000Z',
        fileSize: '4.2 MB',
        previewType: 'canvas_floorplan',
        authorDrafter: 'James'
      }
    ],
    comments: [
      {
        id: 'c-218-1',
        author: 'James',
        role: 'drafter',
        text: 'Received customer notes regarding kitchen pantry expansion. Updating preliminary drawings now.',
        timestamp: '2026-09-04T16:30:00.000Z'
      }
    ],
    audit_logs: [
      {
        id: 'a-218-1',
        action: 'Job Initialized',
        performedBy: 'Jason',
        timestamp: '2026-08-20T14:02:52.000Z',
        details: 'Intake created from sheet. Goal: 1800-2200 sq ft remodel.'
      }
    ]
  },
  {
    id: 'job-m26-236',
    job_number: 'M26-236',
    owner: 'JB',
    project_name: 'Mary Cole',
    customer_name: 'Mary Cole',
    sq_ft_goal: 'remodel',
    sq_ft: 0,
    style: 'Remodel',
    lot_details: '9 Covey Lane, Sherwood. Residential remodel assessment.',
    project_address: '9 Covey Lane, Sherwood',
    customer_email: 'mary.vadalma@gmail.com; jcfryar@outlook.com; chenin.doiron@gmail.com',
    customer_phone: '559-359-8370',
    builder: '',
    sheet_status: 'No Status',
    status_note: '',
    completed: false,
    phase_name: 'No Phase',
    current_status: 'Customer Inquiry',
    roadblock: false,
    layout_reviews_count: 0,
    max_reviews_included: 3,
    last_customer_contact: '2026-08-31T09:51:17.000Z',
    next_step: 'Awaiting customer confirmation on remodel scope and measurements',
    created_at: '2026-08-31T09:51:17.000Z',
    target_completion_date: '2026-10-05',
    estimated_cost: 1600,
    hourly_rate: 85,
    deposit_collected: false,
    deposit_amount: 0,
    invoice_status: 'Uninvoiced',
    invoice_number: 'INV-2026-M26236',
    total_time_entries: 4,
    total_duration_minutes: 313,
    total_duration_hours: 5.22,
    assigned_drafter: 'Aaron',
    project_manager: 'Jason',
    time_logs: [
      {
        id: 't-236-1',
        drafterName: 'Aaron',
        startTime: '2026-09-01T09:00:00.000Z',
        durationSeconds: 4800, // 80 min
        taskDescription: 'Remodel Intake & Site Photo Dimension Conversion',
        billingCategory: 'Standard Offline CAD Drafting',
        hourlyRate: 85,
        billableHours: 1.33,
        billableAmount: 113.33
      },
      {
        id: 't-236-2',
        drafterName: 'Aaron',
        startTime: '2026-09-02T10:30:00.000Z',
        durationSeconds: 4800, // 80 min
        taskDescription: 'Existing Footprint CAD Tracing & As-Built Walls',
        billingCategory: 'Standard Offline CAD Drafting',
        hourlyRate: 85,
        billableHours: 1.33,
        billableAmount: 113.33
      },
      {
        id: 't-236-3',
        drafterName: 'Aaron',
        startTime: '2026-09-03T13:00:00.000Z',
        durationSeconds: 4800, // 80 min
        taskDescription: 'Conceptual Kitchen & Living Room Reconfiguration',
        billingCategory: 'Standard Offline CAD Drafting',
        hourlyRate: 85,
        billableHours: 1.33,
        billableAmount: 113.33
      },
      {
        id: 't-236-4',
        drafterName: 'Aaron',
        startTime: '2026-09-04T15:00:00.000Z',
        durationSeconds: 4380, // 73 min -> 80+80+80+73 = 313 mins = 5.22 hrs
        taskDescription: 'Client Review Intake Notes & Wall Opening Callouts',
        billingCategory: 'Standard Offline CAD Drafting',
        hourlyRate: 85,
        billableHours: 1.22,
        billableAmount: 103.42
      }
    ],
    delegated_tasks: [],
    deliverables: [],
    comments: [
      {
        id: 'c-236-1',
        author: 'Aaron',
        role: 'drafter',
        text: 'Initial as-built dimensions converted into CAD. Ready for customer scope review.',
        timestamp: '2026-09-04T16:00:00.000Z'
      }
    ],
    audit_logs: [
      {
        id: 'a-236-1',
        action: 'Job Initialized',
        performedBy: 'Jason',
        timestamp: '2026-08-31T09:51:17.000Z',
        details: 'Intake created from sheet. 9 Covey Lane, Sherwood.'
      }
    ]
  },
  {
    id: 'job-m26-249',
    job_number: 'M26-249',
    owner: 'JB',
    project_name: 'REVEST - 4617 Crestwood Dr',
    customer_name: 'REVEST',
    sq_ft_goal: '',
    sq_ft: 0,
    style: 'Custom Residential',
    lot_details: '4617 Crestwood Dr, LR. Investor remodel / new build study.',
    project_address: '4617 Crestwood Dr, LR',
    customer_email: '',
    customer_phone: '',
    builder: '',
    sheet_status: 'Changes',
    status_note: '',
    completed: false,
    phase_name: 'Layout',
    current_status: 'Preliminary Layout',
    roadblock: false,
    layout_reviews_count: 1,
    max_reviews_included: 3,
    last_customer_contact: '2026-09-04T14:00:00.000Z',
    next_step: 'Drafting preliminary layout modifications for REVEST team',
    created_at: '2026-09-02T15:02:03.000Z',
    target_completion_date: '2026-09-28',
    estimated_cost: 2100,
    hourly_rate: 85,
    deposit_collected: false,
    deposit_amount: 0,
    invoice_status: 'Uninvoiced',
    invoice_number: 'INV-2026-M26249',
    total_time_entries: 2,
    total_duration_minutes: 313,
    total_duration_hours: 5.22,
    assigned_drafter: 'Kyle',
    project_manager: 'Jason',
    time_logs: [
      {
        id: 't-249-1',
        drafterName: 'Kyle',
        startTime: '2026-09-03T09:00:00.000Z',
        durationSeconds: 9600, // 160 min (2.67h)
        taskDescription: 'Initial Architectural CAD Layout & Spatial Planning',
        billingCategory: 'Standard Offline CAD Drafting',
        hourlyRate: 85,
        billableHours: 2.67,
        billableAmount: 226.67
      },
      {
        id: 't-249-2',
        drafterName: 'Kyle',
        startTime: '2026-09-04T13:00:00.000Z',
        durationSeconds: 9180, // 153 min (2.55h) -> 160+153 = 313 mins = 5.22 hrs
        taskDescription: 'Preliminary Floor Plan Adjustments & Changes',
        billingCategory: 'Standard Offline CAD Drafting',
        hourlyRate: 85,
        billableHours: 2.55,
        billableAmount: 216.75
      }
    ],
    delegated_tasks: [],
    deliverables: [
      {
        id: 'deliv-249-1',
        title: 'Crestwood Dr Preliminary Layout Concept',
        category: 'Floor Plan',
        version: 'v1.0',
        uploadedAt: '2026-09-04T16:00:00.000Z',
        fileSize: '3.1 MB',
        previewType: 'canvas_floorplan',
        authorDrafter: 'Kyle'
      }
    ],
    comments: [],
    audit_logs: [
      {
        id: 'a-249-1',
        action: 'Job Initialized',
        performedBy: 'Jason',
        timestamp: '2026-09-02T15:02:03.000Z',
        details: 'Intake created from sheet. REVEST - 4617 Crestwood Dr.'
      }
    ]
  },
  {
    id: 'job-m26-252',
    job_number: 'M26-252',
    owner: 'JB',
    project_name: 'CCI - 34 Pleasant Cove',
    customer_name: 'CCI - AJ & Gwen',
    sq_ft_goal: '1800',
    sq_ft: 1800,
    style: 'Custom Residential',
    lot_details: '34 Pleasant Cove. Builder lot package.',
    project_address: '34 Pleasant Cove',
    customer_email: '',
    customer_phone: '',
    builder: 'CCI',
    sheet_status: 'Changes',
    status_note: '',
    completed: false,
    phase_name: 'Final Review',
    current_status: 'Construction Prints',
    roadblock: false,
    layout_reviews_count: 2,
    max_reviews_included: 3,
    last_customer_contact: '2026-09-06T15:00:00.000Z',
    next_step: 'Final QA review on construction prints for builder CCI',
    created_at: '2026-09-04T12:19:45.000Z',
    target_completion_date: '2026-09-16',
    estimated_cost: 2000,
    hourly_rate: 85,
    deposit_collected: true,
    deposit_amount: 1000,
    deposit_date: '2026-09-04',
    deposit_notes: 'Builder account deposit',
    invoice_status: 'Pending Invoicing',
    invoice_number: 'INV-2026-M26252',
    total_time_entries: 1,
    total_duration_minutes: 20,
    total_duration_hours: 0.33,
    assigned_drafter: 'James',
    project_manager: 'Jason',
    time_logs: [
      {
        id: 't-252-1',
        drafterName: 'James',
        startTime: '2026-09-05T14:00:00.000Z',
        durationSeconds: 1200, // 20 min (0.33h)
        taskDescription: 'Final Review Changes & Construction Print QA Check',
        billingCategory: 'Standard Offline CAD Drafting',
        hourlyRate: 85,
        billableHours: 0.33,
        billableAmount: 28.33
      }
    ],
    delegated_tasks: [],
    deliverables: [
      {
        id: 'deliv-252-1',
        title: 'Full Construction Print Set (1,800 sq ft)',
        category: 'Construction Prints' as any,
        version: 'v2.0',
        uploadedAt: '2026-09-05T15:00:00.000Z',
        fileSize: '8.4 MB',
        previewType: 'pdf_spec',
        authorDrafter: 'James'
      }
    ],
    comments: [
      {
        id: 'c-252-1',
        author: 'James',
        role: 'drafter',
        text: 'Applied final review edits requested by CCI (AJ & Gwen). Ready for final invoicing and print delivery.',
        timestamp: '2026-09-05T15:15:00.000Z'
      }
    ],
    audit_logs: [
      {
        id: 'a-252-1',
        action: 'Job Initialized',
        performedBy: 'Jason',
        timestamp: '2026-09-04T12:19:45.000Z',
        details: 'Intake created from sheet. Builder: CCI (AJ & Gwen).'
      }
    ]
  }
];

export const RESERVED_JOB_NUMBERS: string[] = [
  'M26-254', 'M26-255', 'M26-256', 'M26-257', 'M26-258', 'M26-259',
  'M26-260', 'M26-261', 'M26-262', 'M26-263', 'M26-264', 'M26-265',
  'M26-266', 'M26-267', 'M26-268', 'M26-269', 'M26-270', 'M26-271',
  'M26-272', 'M26-273', 'M26-274', 'M26-275', 'M26-276', 'M26-277',
  'M26-278', 'M26-279', 'M26-280', 'M26-281', 'M26-282', 'M26-283',
  'M26-284', 'M26-285', 'M26-286', 'M26-287', 'M26-288', 'M26-289',
  'M26-290', 'M26-291', 'M26-292', 'M26-293', 'M26-294', 'M26-295',
  'M26-296', 'M26-297', 'M26-298', 'M26-299', 'M26-300'
];

export const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
  // Ethan (Operations & Project Manager) Messages
  {
    id: 'msg-ethan-1',
    senderId: 'staff-jason',
    senderName: 'Jason',
    senderRole: 'Project Manager & Operations',
    text: 'Hey @Ethan, can you review the Truss calculations and structural sign-off on #M26-195 before we send the customer invoice?',
    timestamp: new Date(Date.now() - 3600000 * 2.5).toISOString(),
    mentions: ['Ethan'],
    referencedJobNumbers: ['M26-195'],
    readByStaffIds: ['staff-jason'],
    channelId: 'general'
  },
  {
    id: 'msg-ethan-2',
    senderId: 'staff-ethan',
    senderName: 'Ethan',
    senderRole: 'Operations & Project Manager',
    text: 'Checked #M26-195. Truss layouts and engineering stamps look solid. Permitting packet is good to go for customer invoicing!',
    timestamp: new Date(Date.now() - 3600000 * 1.8).toISOString(),
    mentions: ['Jason'],
    referencedJobNumbers: ['M26-195'],
    replyToId: 'msg-ethan-1',
    replyToMessage: {
      id: 'msg-ethan-1',
      senderName: 'Jason',
      text: 'Hey @Ethan, can you review the Truss calculations and structural sign-off on #M26-195 before we send the customer invoice?'
    },
    readByStaffIds: ['staff-ethan', 'staff-jason'],
    channelId: 'general'
  },
  {
    id: 'msg-ethan-3',
    senderId: 'staff-greg',
    senderName: 'Greg Hyatt',
    senderRole: 'Owner & Founder',
    text: '@Ethan please check the operations schedule for the upcoming plan submissions.',
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
    text: '@Greg Hyatt scheduled Aaron and James on the primary drafting queues. We are on track for this sprint.',
    timestamp: new Date(Date.now() - 3600000 * 4.2).toISOString(),
    mentions: ['Greg Hyatt'],
    replyToId: 'msg-ethan-3',
    replyToMessage: {
      id: 'msg-ethan-3',
      senderName: 'Greg Hyatt',
      text: '@Ethan please check the operations schedule for the upcoming plan submissions.'
    },
    readByStaffIds: ['staff-ethan', 'staff-greg'],
    channelId: 'general'
  },

  // Kyle & James
  {
    id: 'msg-1',
    senderId: 'staff-kyle',
    senderName: 'Kyle',
    senderRole: 'Lead Project Manager & Senior Drafter',
    text: 'Hey @James, can you double check the garage header heights on #M26-195? Customer asked if we can raise ceiling clearance to 10ft.',
    timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
    mentions: ['James'],
    referencedJobNumbers: ['M26-195'],
    readByStaffIds: ['staff-kyle', 'staff-james', 'staff-jason'],
    channelId: 'general'
  },
  {
    id: 'msg-2',
    senderId: 'staff-james',
    senderName: 'James',
    senderRole: 'Architectural Drafter',
    text: 'Checked #M26-195, updated the header spans and raised clearance to 10\'-4" clearance! Deliverables are uploaded for review.',
    timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
    mentions: ['Kyle'],
    referencedJobNumbers: ['M26-195'],
    replyToId: 'msg-1',
    replyToMessage: {
      id: 'msg-1',
      senderName: 'Kyle',
      text: 'Hey @James, can you double check the garage header heights on #M26-195? Customer asked if we can raise ceiling clearance to 10ft.'
    },
    readByStaffIds: ['staff-james', 'staff-kyle'],
    channelId: 'general'
  },

  // Jason & Greg Hyatt
  {
    id: 'msg-3',
    senderId: 'staff-jason',
    senderName: 'Jason',
    senderRole: 'Project Manager & Operations',
    text: '@Greg Hyatt the preliminary structural permit packet for #M26-195 is signed off by engineering. Ready for customer review stage.',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    mentions: ['Greg Hyatt'],
    referencedJobNumbers: ['M26-195'],
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
    referencedJobNumbers: ['M26-195'],
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
    text: 'Hey @Aaron, please check the setback boundary on #M26-195 when you have a moment.',
    timestamp: new Date(Date.now() - 3600000 * 1.5).toISOString(),
    mentions: ['Aaron'],
    referencedJobNumbers: ['M26-195'],
    readByStaffIds: ['staff-kyle', 'staff-aaron'],
    channelId: 'general'
  },
  {
    id: 'msg-5',
    senderId: 'staff-aaron',
    senderName: 'Aaron',
    senderRole: 'Architectural Drafter',
    text: 'Took a look at #M26-195, 35ft rear setback and 10ft side setbacks are all verified with local county code.',
    timestamp: new Date(Date.now() - 3600000 * 0.5).toISOString(),
    mentions: ['Kyle'],
    referencedJobNumbers: ['M26-195'],
    replyToId: 'msg-4',
    replyToMessage: {
      id: 'msg-4',
      senderName: 'Kyle',
      text: 'Hey @Aaron, please check the setback boundary on #M26-195 when you have a moment.'
    },
    readByStaffIds: ['staff-aaron', 'staff-kyle'],
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

export const STORAGE_KEY = 'my_plan_store_os_jobs_v14';
export const NOTIFS_STORAGE_KEY = 'my_plan_store_os_notifs_v14';
export const CHAT_STORAGE_KEY = 'my_plan_store_os_chat_v14';
export const STAFF_STORAGE_KEY = 'my_plan_store_os_staff_v14';

export const REMOVED_MOCK_STAFF_IDS = ['staff-jason', 'staff-drew', 'staff-kyle', 'staff-james', 'staff-aaron', 'staff-ethan'];

export function getStoredStaff(): StaffUser[] {
  try {
    const raw = localStorage.getItem(STAFF_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(STAFF_USERS));
      return STAFF_USERS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const filtered = parsed.filter((s: StaffUser) => {
        if (REMOVED_MOCK_STAFF_IDS.includes(s.id)) return false;
        const nameLower = (s.name || '').toLowerCase();
        if (['jason', 'drew lupkey', 'kyle', 'james', 'aaron', 'ethan'].includes(nameLower) && (s.email?.includes('myplanstore.com') || !s.email)) {
          return false;
        }
        return true;
      });
      const hasGreg = filtered.some((s: StaffUser) => s.name.toLowerCase().includes('greg hyatt') || s.id === 'staff-greg');
      if (!hasGreg) {
        filtered.unshift(STAFF_USERS[0]);
      }
      localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(filtered));
      return filtered;
    }
    return STAFF_USERS;
  } catch (err) {
    console.error('Failed to load stored staff:', err);
    return STAFF_USERS;
  }
}

export function saveStoredStaff(staff: StaffUser[]) {
  try {
    localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(staff));
  } catch (err) {
    console.error('Failed to save staff:', err);
  }
}

export function resetStoredStaff(): StaffUser[] {
  localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(STAFF_USERS));
  return STAFF_USERS;
}

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

export const TIME_CARDS_STORAGE_KEY = 'my_plan_store_os_timecards_v15';

const ALL_RAW_TIME_CARDS: TimeCardShift[] = [
  // Kyle (Lead Drafter) - Previous Week (Aug 24-28, 2026)
  {
    id: 'shift-kyle-mon-prev',
    staffId: 'staff-kyle',
    staffName: 'Kyle',
    date: '2026-08-24',
    clockInTime: '2026-08-24T07:45:00.000Z',
    clockOutTime: '2026-08-24T16:45:00.000Z',
    status: 'clocked_out',
    breaks: [
      {
        id: 'brk-kyle-mon-1',
        startTime: '2026-08-24T12:00:00.000Z',
        endTime: '2026-08-24T12:30:00.000Z',
        durationSeconds: 1800
      }
    ],
    totalWorkSeconds: 30600, // 8.5 hrs
    totalBreakSeconds: 1800,
    notes: 'Workload delegation and QA review of completed sheets'
  },
  {
    id: 'shift-kyle-tue-prev',
    staffId: 'staff-kyle',
    staffName: 'Kyle',
    date: '2026-08-25',
    clockInTime: '2026-08-25T07:40:00.000Z',
    clockOutTime: '2026-08-25T16:50:00.000Z',
    status: 'clocked_out',
    breaks: [
      {
        id: 'brk-kyle-tue-1',
        startTime: '2026-08-25T12:15:00.000Z',
        endTime: '2026-08-25T12:45:00.000Z',
        durationSeconds: 1800
      }
    ],
    totalWorkSeconds: 31200, // 8.66 hrs
    totalBreakSeconds: 1800,
    notes: 'Customer design consultation & revision signoffs'
  },
  {
    id: 'shift-kyle-wed-prev',
    staffId: 'staff-kyle',
    staffName: 'Kyle',
    date: '2026-08-26',
    clockInTime: '2026-08-26T07:50:00.000Z',
    clockOutTime: '2026-08-26T16:20:00.000Z',
    status: 'clocked_out',
    breaks: [
      {
        id: 'brk-kyle-wed-1',
        startTime: '2026-08-26T12:00:00.000Z',
        endTime: '2026-08-26T12:30:00.000Z',
        durationSeconds: 1800
      }
    ],
    totalWorkSeconds: 28800, // 8.0 hrs
    totalBreakSeconds: 1800,
    notes: 'CAD drafting & team coordination'
  },

  // Kyle - CURRENT WEEK (Sep 7 – Sep 13, 2026)
  {
    id: 'shift-kyle-cur-mon',
    staffId: 'staff-kyle',
    staffName: 'Kyle',
    date: '2026-09-07',
    clockInTime: '2026-09-07T07:45:00.000Z',
    clockOutTime: '2026-09-07T16:15:00.000Z',
    status: 'clocked_out',
    breaks: [
      {
        id: 'brk-kyle-cur-mon-1',
        startTime: '2026-09-07T12:00:00.000Z',
        endTime: '2026-09-07T12:30:00.000Z',
        durationSeconds: 1800
      }
    ],
    totalWorkSeconds: 28800, // 8.0 hrs
    totalBreakSeconds: 1800,
    notes: 'Floor plan layouts and draft review'
  },
  {
    id: 'shift-kyle-cur-tue',
    staffId: 'staff-kyle',
    staffName: 'Kyle',
    date: '2026-09-08',
    clockInTime: '2026-09-08T07:45:00.000Z',
    clockOutTime: '2026-09-08T16:15:00.000Z',
    status: 'clocked_out',
    breaks: [
      {
        id: 'brk-kyle-cur-tue-1',
        startTime: '2026-09-08T12:00:00.000Z',
        endTime: '2026-09-08T12:30:00.000Z',
        durationSeconds: 1800
      }
    ],
    totalWorkSeconds: 28800, // 8.0 hrs
    totalBreakSeconds: 1800,
    notes: 'Structural revisions and customer redlines'
  },

  // James (Drafter) - Previous & Current Week
  {
    id: 'shift-james-prev-mon',
    staffId: 'staff-james',
    staffName: 'James',
    date: '2026-08-24',
    clockInTime: '2026-08-24T08:00:00.000Z',
    clockOutTime: '2026-08-24T16:30:00.000Z',
    status: 'clocked_out',
    breaks: [
      {
        id: 'brk-james-mon-1',
        startTime: '2026-08-24T12:00:00.000Z',
        endTime: '2026-08-24T12:30:00.000Z',
        durationSeconds: 1800
      }
    ],
    totalWorkSeconds: 28800,
    totalBreakSeconds: 1800,
    notes: 'Initial blueprint setup and dimensional stringing'
  },
  {
    id: 'shift-james-cur-mon',
    staffId: 'staff-james',
    staffName: 'James',
    date: '2026-09-07',
    clockInTime: '2026-09-07T08:00:00.000Z',
    clockOutTime: '2026-09-07T16:30:00.000Z',
    status: 'clocked_out',
    breaks: [
      {
        id: 'brk-james-cur-mon-1',
        startTime: '2026-09-07T12:00:00.000Z',
        endTime: '2026-09-07T12:30:00.000Z',
        durationSeconds: 1800
      }
    ],
    totalWorkSeconds: 28800,
    totalBreakSeconds: 1800,
    notes: 'Section cuts and roof details'
  },
  {
    id: 'shift-james-cur-tue',
    staffId: 'staff-james',
    staffName: 'James',
    date: '2026-09-08',
    clockInTime: '2026-09-08T08:00:00.000Z',
    clockOutTime: '2026-09-08T16:30:00.000Z',
    status: 'clocked_out',
    breaks: [
      {
        id: 'brk-james-cur-tue-1',
        startTime: '2026-09-08T12:00:00.000Z',
        endTime: '2026-09-08T12:30:00.000Z',
        durationSeconds: 1800
      }
    ],
    totalWorkSeconds: 28800,
    totalBreakSeconds: 1800,
    notes: 'Framing geometry & wall schedule updates'
  },

  // Aaron (Drafter) - Previous & Current Week
  {
    id: 'shift-aaron-prev-mon',
    staffId: 'staff-aaron',
    staffName: 'Aaron',
    date: '2026-08-24',
    clockInTime: '2026-08-24T08:15:00.000Z',
    clockOutTime: '2026-08-24T16:45:00.000Z',
    status: 'clocked_out',
    breaks: [
      {
        id: 'brk-aaron-mon-1',
        startTime: '2026-08-24T12:00:00.000Z',
        endTime: '2026-08-24T12:30:00.000Z',
        durationSeconds: 1800
      }
    ],
    totalWorkSeconds: 28800,
    totalBreakSeconds: 1800,
    notes: 'Electrical layouts and ceiling plan layers'
  },
  {
    id: 'shift-aaron-cur-mon',
    staffId: 'staff-aaron',
    staffName: 'Aaron',
    date: '2026-09-07',
    clockInTime: '2026-09-07T08:15:00.000Z',
    clockOutTime: '2026-09-07T16:45:00.000Z',
    status: 'clocked_out',
    breaks: [
      {
        id: 'brk-aaron-cur-mon-1',
        startTime: '2026-09-07T12:00:00.000Z',
        endTime: '2026-09-07T12:30:00.000Z',
        durationSeconds: 1800
      }
    ],
    totalWorkSeconds: 28800,
    totalBreakSeconds: 1800,
    notes: 'Reflected ceiling plans and plumbing runs'
  },
  {
    id: 'shift-aaron-cur-tue',
    staffId: 'staff-aaron',
    staffName: 'Aaron',
    date: '2026-09-08',
    clockInTime: '2026-09-08T08:10:00.000Z',
    clockOutTime: '2026-09-08T16:40:00.000Z',
    status: 'clocked_out',
    breaks: [
      {
        id: 'brk-aaron-cur-tue-1',
        startTime: '2026-09-08T12:00:00.000Z',
        endTime: '2026-09-08T12:30:00.000Z',
        durationSeconds: 1800
      }
    ],
    totalWorkSeconds: 28800,
    totalBreakSeconds: 1800,
    notes: 'Window and door schedule coordination'
  },

  // Drew Lupkey (Finance) - Previous & Current Week
  {
    id: 'shift-drew-prev-mon',
    staffId: 'staff-drew',
    staffName: 'Drew Lupkey',
    date: '2026-08-24',
    clockInTime: '2026-08-24T08:30:00.000Z',
    clockOutTime: '2026-08-24T17:00:00.000Z',
    status: 'clocked_out',
    breaks: [
      {
        id: 'brk-drew-mon-1',
        startTime: '2026-08-24T12:30:00.000Z',
        endTime: '2026-08-24T13:00:00.000Z',
        durationSeconds: 1800
      }
    ],
    totalWorkSeconds: 28800,
    totalBreakSeconds: 1800,
    notes: 'Invoice reconciliations and time log audits'
  },
  {
    id: 'shift-drew-cur-mon',
    staffId: 'staff-drew',
    staffName: 'Drew Lupkey',
    date: '2026-09-07',
    clockInTime: '2026-09-07T08:30:00.000Z',
    clockOutTime: '2026-09-07T17:00:00.000Z',
    status: 'clocked_out',
    breaks: [
      {
        id: 'brk-drew-cur-mon-1',
        startTime: '2026-09-07T12:30:00.000Z',
        endTime: '2026-09-07T13:00:00.000Z',
        durationSeconds: 1800
      }
    ],
    totalWorkSeconds: 28800,
    totalBreakSeconds: 1800,
    notes: 'Accounts receivable tracking and customer retainers'
  },
  {
    id: 'shift-drew-cur-tue',
    staffId: 'staff-drew',
    staffName: 'Drew Lupkey',
    date: '2026-09-08',
    clockInTime: '2026-09-08T08:30:00.000Z',
    clockOutTime: '2026-09-08T17:00:00.000Z',
    status: 'clocked_out',
    breaks: [
      {
        id: 'brk-drew-cur-tue-1',
        startTime: '2026-09-08T12:30:00.000Z',
        endTime: '2026-09-08T13:00:00.000Z',
        durationSeconds: 1800
      }
    ],
    totalWorkSeconds: 28800,
    totalBreakSeconds: 1800,
    notes: 'Customer payment processing and contractor timesheets'
  },

  // Greg Hyatt (Owner & Principal Architect)
  // Previous Week (Aug 24-28, 2026)
  {
    id: 'shift-greg-prev-mon',
    staffId: 'staff-greg',
    staffName: 'Greg Hyatt',
    date: '2026-08-24',
    clockInTime: '2026-08-24T07:30:00.000Z',
    clockOutTime: '2026-08-24T17:30:00.000Z',
    status: 'clocked_out',
    breaks: [
      {
        id: 'brk-greg-mon-1',
        startTime: '2026-08-24T12:00:00.000Z',
        endTime: '2026-08-24T12:30:00.000Z',
        durationSeconds: 1800
      }
    ],
    totalWorkSeconds: 34200, // 9.5 hrs
    totalBreakSeconds: 1800,
    notes: 'Principal architect reviews and client onboarding meetings'
  },
  {
    id: 'shift-greg-prev-tue',
    staffId: 'staff-greg',
    staffName: 'Greg Hyatt',
    date: '2026-08-25',
    clockInTime: '2026-08-25T07:30:00.000Z',
    clockOutTime: '2026-08-25T17:00:00.000Z',
    status: 'clocked_out',
    breaks: [
      {
        id: 'brk-greg-tue-1',
        startTime: '2026-08-25T12:00:00.000Z',
        endTime: '2026-08-25T12:30:00.000Z',
        durationSeconds: 1800
      }
    ],
    totalWorkSeconds: 32400, // 9.0 hrs
    totalBreakSeconds: 1800,
    notes: 'Plan approval reviews and operations coordination'
  },
  {
    id: 'shift-greg-prev-wed',
    staffId: 'staff-greg',
    staffName: 'Greg Hyatt',
    date: '2026-08-26',
    clockInTime: '2026-08-26T07:30:00.000Z',
    clockOutTime: '2026-08-26T16:00:00.000Z',
    status: 'clocked_out',
    breaks: [
      {
        id: 'brk-greg-wed-1',
        startTime: '2026-08-26T12:00:00.000Z',
        endTime: '2026-08-26T12:30:00.000Z',
        durationSeconds: 1800
      }
    ],
    totalWorkSeconds: 28800, // 8.0 hrs
    totalBreakSeconds: 1800,
    notes: 'Architectural specifications & design reviews'
  },

  // Greg Hyatt - CURRENT WEEK (Sep 7 – Sep 13, 2026)
  {
    id: 'shift-greg-cur-mon',
    staffId: 'staff-greg',
    staffName: 'Greg Hyatt',
    date: '2026-09-07',
    clockInTime: '2026-09-07T07:30:00.000Z',
    clockOutTime: '2026-09-07T16:00:00.000Z',
    status: 'clocked_out',
    breaks: [
      {
        id: 'brk-greg-cur-mon-1',
        startTime: '2026-09-07T12:00:00.000Z',
        endTime: '2026-09-07T12:30:00.000Z',
        durationSeconds: 1800
      }
    ],
    totalWorkSeconds: 28800, // 8.0 hrs
    totalBreakSeconds: 1800,
    notes: 'MPS OS system architecture review & project intake'
  },
  {
    id: 'shift-greg-cur-tue',
    staffId: 'staff-greg',
    staffName: 'Greg Hyatt',
    date: '2026-09-08',
    clockInTime: '2026-09-08T07:30:00.000Z',
    clockOutTime: '2026-09-08T16:00:00.000Z',
    status: 'clocked_out',
    breaks: [
      {
        id: 'brk-greg-cur-tue-1',
        startTime: '2026-09-08T12:00:00.000Z',
        endTime: '2026-09-08T12:30:00.000Z',
        durationSeconds: 1800
      }
    ],
    totalWorkSeconds: 28800, // 8.0 hrs
    totalBreakSeconds: 1800,
    notes: 'Quality control reviews and preliminary plan approvals'
  }
];

export const INITIAL_TIME_CARDS: TimeCardShift[] = ALL_RAW_TIME_CARDS;

/**
 * Automatically inspects and reconciles shifts to prevent runaway timers or missed clock-outs from corrupting data.
 * Closes any shift that was left clocked in on a past date or exceeded 16 continuous hours.
 */
export function sanitizeAndReconcileTimeCards(shifts: TimeCardShift[], nowMs: number = Date.now()): { shifts: TimeCardShift[]; wasReconciled: boolean } {
  const d = new Date(nowMs);
  const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  let wasReconciled = false;

  const reconciled = shifts.map(shift => {
    // If shift is marked clocked_in or on_break but belongs to a past date or is runaway (>16 hrs)
    if (shift.status === 'clocked_in' || shift.status === 'on_break') {
      const isPastDate = shift.date && shift.date < todayStr;
      const startMs = shift.clockInTime ? new Date(shift.clockInTime).getTime() : 0;
      const elapsedHours = startMs ? (nowMs - startMs) / (3600 * 1000) : 0;

      if (isPastDate || elapsedHours > 16) {
        wasReconciled = true;
        const standardWorkSec = 28800; // 8.0 hrs standard capped shift
        const standardBreakSec = 1800; // 30 min lunch break
        const autoOutMs = startMs ? startMs + (8.5 * 3600 * 1000) : nowMs;

        const fixedBreaks = (shift.breaks && shift.breaks.length > 0)
          ? shift.breaks.map(b => ({
              ...b,
              endTime: b.endTime || (startMs ? new Date(startMs + 4 * 3600 * 1000).toISOString() : new Date().toISOString()),
              durationSeconds: b.durationSeconds || standardBreakSec
            }))
          : [
              {
                id: `brk-auto-${shift.id}`,
                startTime: startMs ? new Date(startMs + 4 * 3600 * 1000).toISOString() : new Date().toISOString(),
                endTime: startMs ? new Date(startMs + 4.5 * 3600 * 1000).toISOString() : new Date().toISOString(),
                durationSeconds: standardBreakSec
              }
            ];

        return {
          ...shift,
          status: 'clocked_out' as const,
          clockOutTime: shift.clockOutTime || new Date(autoOutMs).toISOString(),
          breaks: fixedBreaks,
          totalWorkSeconds: standardWorkSec,
          totalBreakSeconds: standardBreakSec,
          notes: shift.notes && shift.notes !== 'Active shift'
            ? `${shift.notes} (Auto-closed: Missed clock out)`
            : 'Regular Shift (Auto-closed: Missed clock out)',
          missedClockOut: true
        };
      }
    }
    return shift;
  });

  return { shifts: reconciled, wasReconciled };
}

export function getStoredTimeCards(): TimeCardShift[] {
  try {
    const raw = localStorage.getItem(TIME_CARDS_STORAGE_KEY);
    if (!raw) {
      // Check if previous version v14 exists to migrate custom punches smoothly
      const oldRaw = localStorage.getItem('my_plan_store_os_timecards_v14');
      let baseCards: TimeCardShift[] = INITIAL_TIME_CARDS;
      if (oldRaw) {
        try {
          const oldParsed = JSON.parse(oldRaw);
          if (Array.isArray(oldParsed) && oldParsed.length > 0) {
            baseCards = oldParsed;
          }
        } catch {
          baseCards = INITIAL_TIME_CARDS;
        }
      }
      const { shifts: cleanCards } = sanitizeAndReconcileTimeCards(baseCards);
      localStorage.setItem(TIME_CARDS_STORAGE_KEY, JSON.stringify(cleanCards));
      return cleanCards;
    }

    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const { shifts: cleanCards, wasReconciled } = sanitizeAndReconcileTimeCards(parsed);
      if (wasReconciled) {
        localStorage.setItem(TIME_CARDS_STORAGE_KEY, JSON.stringify(cleanCards));
      }
      return cleanCards;
    }

    const { shifts: initialClean } = sanitizeAndReconcileTimeCards(INITIAL_TIME_CARDS);
    localStorage.setItem(TIME_CARDS_STORAGE_KEY, JSON.stringify(initialClean));
    return initialClean;
  } catch (err) {
    console.error('Failed to load stored time cards:', err);
    return INITIAL_TIME_CARDS;
  }
}

export function saveStoredTimeCards(shifts: TimeCardShift[]) {
  try {
    localStorage.setItem(TIME_CARDS_STORAGE_KEY, JSON.stringify(shifts));
  } catch (err) {
    console.error('Failed to save time cards:', err);
  }
}

export function resetStoredTimeCards(): TimeCardShift[] {
  localStorage.setItem(TIME_CARDS_STORAGE_KEY, JSON.stringify(INITIAL_TIME_CARDS));
  return INITIAL_TIME_CARDS;
}

export function resetStoredJobs(): Job[] {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_JOBS));
  localStorage.setItem(NOTIFS_STORAGE_KEY, JSON.stringify(INITIAL_NOTIFICATIONS));
  localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(INITIAL_CHAT_MESSAGES));
  localStorage.setItem(TIME_CARDS_STORAGE_KEY, JSON.stringify(INITIAL_TIME_CARDS));
  return INITIAL_JOBS;
}

