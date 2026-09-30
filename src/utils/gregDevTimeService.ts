import { GregDevProjectCard, GregDevTimeEntry, StaffUser, StandardGregDevProjectType } from '../types';
import { getLocalDateString } from './timeCardExport';

export const GREG_DEV_STORAGE_CARDS_KEY = 'myplanstore_greg_dev_cards_v1';
export const GREG_DEV_STORAGE_ENTRIES_KEY = 'myplanstore_greg_dev_entries_v1';

export interface ProjectTypeMeta {
  type: StandardGregDevProjectType;
  colorTheme: 'indigo' | 'cyan' | 'purple' | 'blue' | 'amber' | 'emerald' | 'rose';
  shortDesc: string;
  badgeBg: string;
  badgeText: string;
  borderClass: string;
  accentClass: string;
}

export const PRESET_DEV_PROJECT_TYPES: ProjectTypeMeta[] = [
  {
    type: 'MPS OS Dev',
    colorTheme: 'indigo',
    shortDesc: 'Plan Store OS core engine, automated drafting tools & app ecosystem',
    badgeBg: 'bg-indigo-900/60',
    badgeText: 'text-indigo-300',
    borderClass: 'border-indigo-500/40',
    accentClass: 'text-indigo-400'
  },
  {
    type: 'BigX Media Dev',
    colorTheme: 'cyan',
    shortDesc: 'Media rendering, high-res video assets, branding & dynamic content',
    badgeBg: 'bg-cyan-900/60',
    badgeText: 'text-cyan-300',
    borderClass: 'border-cyan-500/40',
    accentClass: 'text-cyan-400'
  },
  {
    type: 'Sound Extraction Dev',
    colorTheme: 'purple',
    shortDesc: 'Audio extraction algorithms, frequency isolating & stem processing',
    badgeBg: 'bg-purple-900/60',
    badgeText: 'text-purple-300',
    borderClass: 'border-purple-500/40',
    accentClass: 'text-purple-400'
  },
  {
    type: 'FB Media Dev',
    colorTheme: 'blue',
    shortDesc: 'Facebook/Meta media integrations, automated advertising & social pipelines',
    badgeBg: 'bg-blue-900/60',
    badgeText: 'text-blue-300',
    borderClass: 'border-blue-500/40',
    accentClass: 'text-blue-400'
  },
  {
    type: 'Other Dev',
    colorTheme: 'amber',
    shortDesc: 'Experimental modules, R&D scripts, sound & system utility integrations',
    badgeBg: 'bg-amber-900/60',
    badgeText: 'text-amber-300',
    borderClass: 'border-amber-500/40',
    accentClass: 'text-amber-400'
  }
];

export function isUserGregHyatt(user?: StaffUser | null): boolean {
  if (!user) return false;
  if (user.email && user.email.toLowerCase() === 'arkcwd@gmail.com') return true;
  if (user.name && user.name.toLowerCase().includes('greg hyatt')) return true;
  if (user.id === 'staff-greg') return true;
  return false;
}

// Initial starter cards for Greg so when he clocks in, he has instant access to his preferred project types
export const INITIAL_GREG_DEV_CARDS: GregDevProjectCard[] = [
  {
    id: 'dev-card-mps-os',
    projectType: 'MPS OS Dev',
    colorTheme: 'indigo',
    isActive: false,
    isPausedByBreak: false,
    todaySeconds: 0,
    totalSeconds: 54000,
    currentNotes: 'Time card sync & drafter workload optimization'
  },
  {
    id: 'dev-card-bigx-media',
    projectType: 'BigX Media Dev',
    colorTheme: 'cyan',
    isActive: false,
    isPausedByBreak: false,
    todaySeconds: 0,
    totalSeconds: 28800,
    currentNotes: 'Video clip render pipeline & compression'
  },
  {
    id: 'dev-card-sound-extraction',
    projectType: 'Sound Extraction Dev',
    colorTheme: 'purple',
    isActive: false,
    isPausedByBreak: false,
    todaySeconds: 0,
    totalSeconds: 32400,
    currentNotes: 'Stem separation DSP testing'
  }
];

// Seed realistic initial entries for Greg for past days so Weekly and Monthly reports are full, while today starts clean
export const INITIAL_GREG_DEV_ENTRIES: GregDevTimeEntry[] = [
  {
    id: 'dev-log-prev-1',
    staffId: 'staff-greg',
    staffName: 'Greg Hyatt',
    projectType: 'MPS OS Dev',
    date: '2026-09-08',
    startTime: '2026-09-08T13:30:00.000Z',
    endTime: '2026-09-08T15:00:00.000Z',
    durationSeconds: 5400, // 1.5 hrs
    notes: 'MPS OS Dev: Multi-card time clock architecture & Firestore synchronization',
    hourlyRate: 150,
    billableAmount: 225,
    createdAt: '2026-09-08T15:00:00.000Z'
  },
  {
    id: 'dev-log-prev-2',
    staffId: 'staff-greg',
    staffName: 'Greg Hyatt',
    projectType: 'BigX Media Dev',
    date: '2026-09-08',
    startTime: '2026-09-08T10:00:00.000Z',
    endTime: '2026-09-08T11:00:00.000Z',
    durationSeconds: 3600, // 1.0 hr
    notes: 'BigX Media Dev: Video encoding queue & thumbnail extraction automation',
    hourlyRate: 150,
    billableAmount: 150,
    createdAt: '2026-09-08T11:00:00.000Z'
  },
  {
    id: 'dev-log-prev-3',
    staffId: 'staff-greg',
    staffName: 'Greg Hyatt',
    projectType: 'Sound Extraction Dev',
    date: '2026-09-07',
    startTime: '2026-09-07T14:00:00.000Z',
    endTime: '2026-09-07T14:45:00.000Z',
    durationSeconds: 2700, // 0.75 hr
    notes: 'Sound Extraction Dev: WAV stem splitting and frequency curve isolation',
    hourlyRate: 150,
    billableAmount: 112.5,
    createdAt: '2026-09-07T14:45:00.000Z'
  },
  // Yesterday entry
  {
    id: 'dev-log-yesterday-1',
    staffId: 'staff-greg',
    staffName: 'Greg Hyatt',
    projectType: 'FB Media Dev',
    date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    startTime: new Date(Date.now() - 93600000).toISOString(),
    endTime: new Date(Date.now() - 86400000).toISOString(),
    durationSeconds: 7200, // 2.0 hrs
    notes: 'FB Media Dev: Ad creative asset synchronization and campaign tracking API',
    hourlyRate: 150,
    billableAmount: 300,
    createdAt: new Date(Date.now() - 86400000).toISOString()
  },
  // Earlier this week
  {
    id: 'dev-log-earlier-week-1',
    staffId: 'staff-greg',
    staffName: 'Greg Hyatt',
    projectType: 'MPS OS Dev',
    date: new Date(Date.now() - 172800000).toISOString().split('T')[0],
    startTime: new Date(Date.now() - 183600000).toISOString(),
    endTime: new Date(Date.now() - 172800000).toISOString(),
    durationSeconds: 10800, // 3.0 hrs
    notes: 'MPS OS Dev: Plan package viewer rendering speeds and CAD scale overlays',
    hourlyRate: 150,
    billableAmount: 450,
    createdAt: new Date(Date.now() - 172800000).toISOString()
  },
  {
    id: 'dev-log-earlier-week-2',
    staffId: 'staff-greg',
    staffName: 'Greg Hyatt',
    projectType: 'Other Dev',
    date: new Date(Date.now() - 259200000).toISOString().split('T')[0],
    startTime: new Date(Date.now() - 266400000).toISOString(),
    endTime: new Date(Date.now() - 259200000).toISOString(),
    durationSeconds: 7200, // 2.0 hrs
    notes: 'Other Dev: Cloud backup integration and database indexing benchmarks',
    hourlyRate: 150,
    billableAmount: 300,
    createdAt: new Date(Date.now() - 259200000).toISOString()
  },
  // Earlier this month
  {
    id: 'dev-log-earlier-month-1',
    staffId: 'staff-greg',
    staffName: 'Greg Hyatt',
    projectType: 'Sound Extraction Dev',
    date: new Date(Date.now() - 604800000).toISOString().split('T')[0],
    startTime: new Date(Date.now() - 619200000).toISOString(),
    endTime: new Date(Date.now() - 604800000).toISOString(),
    durationSeconds: 14400, // 4.0 hrs
    notes: 'Sound Extraction Dev: Noise cancellation algorithms & spectral gating filter',
    hourlyRate: 150,
    billableAmount: 600,
    createdAt: new Date(Date.now() - 604800000).toISOString()
  },
  {
    id: 'dev-log-earlier-month-2',
    staffId: 'staff-greg',
    staffName: 'Greg Hyatt',
    projectType: 'BigX Media Dev',
    date: new Date(Date.now() - 777600000).toISOString().split('T')[0],
    startTime: new Date(Date.now() - 792000000).toISOString(),
    endTime: new Date(Date.now() - 777600000).toISOString(),
    durationSeconds: 12600, // 3.5 hrs
    notes: 'BigX Media Dev: Audio-reactive video generator and resolution scaling',
    hourlyRate: 150,
    billableAmount: 525,
    createdAt: new Date(Date.now() - 777600000).toISOString()
  }
];

/**
 * Reconciles project cards so their todaySeconds accurately reflects ONLY entries
 * completed today, preventing multi-day inflation or runaway numbers.
 */
export function reconcileGregDevCardsWithEntries(
  cards: GregDevProjectCard[],
  entries: GregDevTimeEntry[],
  todayStr: string = getLocalDateString(new Date())
): GregDevProjectCard[] {
  return cards.map(card => {
    const todaySec = entries
      .filter(e => {
        if (e.projectType !== card.projectType) return false;
        const entryDate = e.date || (e.startTime ? getLocalDateString(new Date(e.startTime)) : '');
        return entryDate === todayStr;
      })
      .reduce((sum, e) => sum + (e.durationSeconds || 0), 0);

    const allTimeSec = entries
      .filter(e => e.projectType === card.projectType)
      .reduce((sum, e) => sum + (e.durationSeconds || 0), 0);

    return {
      ...card,
      todaySeconds: todaySec,
      totalSeconds: Math.max(card.totalSeconds || 0, allTimeSec)
    };
  });
}

export function getStoredGregDevCards(): GregDevProjectCard[] {
  try {
    const raw = localStorage.getItem(GREG_DEV_STORAGE_CARDS_KEY);
    let cards = INITIAL_GREG_DEV_CARDS;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          cards = parsed;
        }
      } catch {
        cards = INITIAL_GREG_DEV_CARDS;
      }
    }

    // Auto-reconcile with stored entries so today's total is strictly accurate for today
    const entries = getStoredGregDevEntries();
    const reconciled = reconcileGregDevCardsWithEntries(cards, entries);
    localStorage.setItem(GREG_DEV_STORAGE_CARDS_KEY, JSON.stringify(reconciled));
    return reconciled;
  } catch (err) {
    console.warn('Error reading stored Greg dev cards:', err);
    return INITIAL_GREG_DEV_CARDS;
  }
}

export function saveStoredGregDevCards(cards: GregDevProjectCard[]) {
  try {
    localStorage.setItem(GREG_DEV_STORAGE_CARDS_KEY, JSON.stringify(cards));
  } catch (err) {
    console.warn('Error saving Greg dev cards:', err);
  }
}

export function getStoredGregDevEntries(): GregDevTimeEntry[] {
  try {
    const raw = localStorage.getItem(GREG_DEV_STORAGE_ENTRIES_KEY);
    if (!raw) {
      localStorage.setItem(GREG_DEV_STORAGE_ENTRIES_KEY, JSON.stringify(INITIAL_GREG_DEV_ENTRIES));
      return INITIAL_GREG_DEV_ENTRIES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    return INITIAL_GREG_DEV_ENTRIES;
  } catch (err) {
    console.warn('Error reading stored Greg dev entries:', err);
    return INITIAL_GREG_DEV_ENTRIES;
  }
}

export function saveStoredGregDevEntries(entries: GregDevTimeEntry[]) {
  try {
    localStorage.setItem(GREG_DEV_STORAGE_ENTRIES_KEY, JSON.stringify(entries));
  } catch (err) {
    console.warn('Error saving Greg dev entries:', err);
  }
}

// Date and Time range calculation helpers for Daily, Weekly, and Monthly filtering
export function getPeriodDateRange(period: 'daily' | 'weekly' | 'monthly', anchorDate: Date): { start: Date; end: Date; label: string } {
  const target = new Date(anchorDate);

  if (period === 'daily') {
    const start = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 0, 0, 0, 0);
    const end = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 23, 59, 59, 999);
    const label = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    return { start, end, label };
  }

  if (period === 'weekly') {
    // Week starting Monday
    const day = target.getDay();
    const diff = target.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(target.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const label = `Week of ${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    return { start: monday, end: sunday, label };
  }

  // Monthly
  const start = new Date(target.getFullYear(), target.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(target.getFullYear(), target.getMonth() + 1, 0, 23, 59, 59, 999);
  const label = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  return { start, end, label };
}

export function filterGregDevEntries(
  entries: GregDevTimeEntry[],
  period: 'daily' | 'weekly' | 'monthly',
  anchorDate: Date,
  selectedProjectType?: string
): { filtered: GregDevTimeEntry[]; range: { start: Date; end: Date; label: string } } {
  const range = getPeriodDateRange(period, anchorDate);

  const filtered = entries.filter(entry => {
    const entryDate = new Date(entry.startTime || entry.date);
    if (entryDate < range.start || entryDate > range.end) return false;
    if (selectedProjectType && selectedProjectType !== 'all') {
      if (entry.projectType.toLowerCase() !== selectedProjectType.toLowerCase()) return false;
    }
    return true;
  }).sort((a, b) => new Date(b.startTime || b.date).getTime() - new Date(a.startTime || a.date).getTime());

  return { filtered, range };
}

// CSV Export Generator
export function exportGregDevTimeEntriesCSV(
  entries: GregDevTimeEntry[],
  period: 'daily' | 'weekly' | 'monthly',
  rangeLabel: string,
  projectTypeFilter?: string
) {
  if (!entries || entries.length === 0) {
    alert(`No dev time entries found for ${rangeLabel} to export.`);
    return;
  }

  const safe = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;

  const headers = [
    'Date',
    'Staff Name',
    'Project Type',
    'Start Time',
    'End Time',
    'Duration (HH:MM:SS)',
    'Duration Hours (Dec)',
    'Hourly Rate ($)',
    'Gross Incurred ($)',
    'Session Description / Notes',
    'Created At'
  ];

  const rows = entries.map(e => {
    const startObj = e.startTime ? new Date(e.startTime) : null;
    const endObj = e.endTime ? new Date(e.endTime) : null;

    const startFormatted = startObj ? startObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--';
    const endFormatted = endObj ? endObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--';
    
    const totalHours = (e.durationSeconds / 3600).toFixed(2);
    const hrs = Math.floor(e.durationSeconds / 3600);
    const mins = Math.floor((e.durationSeconds % 3600) / 60);
    const secs = e.durationSeconds % 60;
    const hhmmss = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    return [
      safe(e.date),
      safe(e.staffName || 'Greg Hyatt'),
      safe(e.projectType),
      safe(startFormatted),
      safe(endFormatted),
      safe(hhmmss),
      safe(totalHours),
      safe(`$${e.hourlyRate || 150}.00`),
      safe(`$${e.billableAmount.toFixed(2)}`),
      safe(e.notes || ''),
      safe(e.createdAt || '')
    ].join(',');
  });

  // Calculate totals row
  const totalSec = entries.reduce((sum, e) => sum + (e.durationSeconds || 0), 0);
  const totalGross = entries.reduce((sum, e) => sum + (e.billableAmount || 0), 0);
  const totalHrsDec = (totalSec / 3600).toFixed(2);
  const tHrs = Math.floor(totalSec / 3600);
  const tMins = Math.floor((totalSec % 3600) / 60);
  const tSecs = totalSec % 60;
  const totalHhmmss = `${String(tHrs).padStart(2, '0')}:${String(tMins).padStart(2, '0')}:${String(tSecs).padStart(2, '0')}`;

  const summaryRow = [
    safe('TOTALS'),
    safe(''),
    safe(`${entries.length} Sessions`),
    safe(''),
    safe(''),
    safe(totalHhmmss),
    safe(totalHrsDec),
    safe(''),
    safe(`$${totalGross.toFixed(2)}`),
    safe(`Filter: ${period.toUpperCase()} (${rangeLabel})`),
    safe('')
  ].join(',');

  const csvContent = [
    `# MY PLAN STORE OS - GREG HYATT DEV PROJECT TIME CARDS`,
    `# Report Period: ${rangeLabel} (${period.toUpperCase()})`,
    `# Filtered Project Type: ${projectTypeFilter || 'All Projects'}`,
    `# Generated: ${new Date().toLocaleString()}`,
    headers.join(','),
    ...rows,
    summaryRow
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  const cleanLabel = rangeLabel.replace(/[^a-zA-Z0-9]/g, '_');
  link.setAttribute('href', url);
  link.setAttribute('download', `Greg_Hyatt_Dev_Hours_${period}_${cleanLabel}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export type GregDevLayoutMode = 'grid' | 'kanban' | 'list';
export const GREG_DEV_LAYOUT_STORAGE_KEY = 'mps_greg_dev_layout_preference';

export function getStoredGregDevLayout(): GregDevLayoutMode {
  try {
    const saved = localStorage.getItem(GREG_DEV_LAYOUT_STORAGE_KEY);
    if (saved === 'grid' || saved === 'kanban' || saved === 'list') {
      return saved;
    }
  } catch {
    // ignore
  }
  return 'grid';
}

export function saveStoredGregDevLayout(layout: GregDevLayoutMode): void {
  try {
    localStorage.setItem(GREG_DEV_LAYOUT_STORAGE_KEY, layout);
  } catch {
    // ignore
  }
}
