import React, { useState } from 'react';
import { 
  Users, 
  Briefcase, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  ExternalLink, 
  Layers, 
  FileText, 
  Sparkles, 
  UserCheck, 
  ChevronRight,
  ListTodo,
  Shield,
  Search,
  Filter,
  Coffee,
  Code2,
  Terminal,
  Cpu,
  Calendar,
  FileSpreadsheet,
  Tag,
  ArrowUpRight
} from 'lucide-react';
import { Job, JobPhase, StaffUser, DelegatedWorkItem, GregDevProjectCard, GregDevTimeEntry, StandardGregDevProjectType } from '../types';
import { STAFF_USERS, isJobArchived } from '../data/mockData';
import { formatSecondsToReadable, calculateJobTotalSeconds } from '../utils/timeUtils';
import { isUserGregHyatt, getStoredGregDevCards, getStoredGregDevEntries, PRESET_DEV_PROJECT_TYPES } from '../utils/gregDevTimeService';

interface JasonDrafterProjectBoardProps {
  jobs: Job[];
  onSelectJob: (job: Job) => void;
  onFilterByDrafter?: (drafterName: string) => void;
  nowTimestamp?: number;
  currentStaff?: StaffUser;
  staffList?: StaffUser[];
  onOpenCompleteTaskModal?: (task: DelegatedWorkItem, job: Job) => void;
  devCards?: GregDevProjectCard[];
  devEntries?: GregDevTimeEntry[];
  onOpenDevReviewModal?: () => void;
}

const PHASE_BADGE_STYLES: Record<JobPhase, { bg: string; text: string; border: string; dot: string }> = {
  'Customer Inquiry': { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', dot: 'bg-slate-500' },
  'Preliminary Layout': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  'Customer Review': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  'Revisions': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
  'Exterior Elevations': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' },
  'Construction Prints': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' },
  'Completed': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
};

const DEV_THEME_BADGES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  'MPS OS Dev': { bg: 'bg-indigo-950/80', text: 'text-indigo-200', border: 'border-indigo-500/50', dot: 'bg-indigo-400' },
  'BigX Media Dev': { bg: 'bg-cyan-950/80', text: 'text-cyan-200', border: 'border-cyan-500/50', dot: 'bg-cyan-400' },
  'Sound Extraction Dev': { bg: 'bg-purple-950/80', text: 'text-purple-200', border: 'border-purple-500/50', dot: 'bg-purple-400' },
  'FB Media Dev': { bg: 'bg-blue-950/80', text: 'text-blue-200', border: 'border-blue-500/50', dot: 'bg-blue-400' },
  'Other Dev': { bg: 'bg-amber-950/80', text: 'text-amber-200', border: 'border-amber-500/50', dot: 'bg-amber-400' },
};

function formatEntryDateLabel(dateStr: string): string {
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (dateStr === todayStr) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  } catch (e) {}
  return dateStr;
}

function formatTimeOnly(isoString?: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch (e) {
    return '';
  }
}

export const JasonDrafterProjectBoard: React.FC<JasonDrafterProjectBoardProps> = ({
  jobs,
  onSelectJob,
  onFilterByDrafter,
  nowTimestamp = Date.now(),
  currentStaff,
  staffList,
  devCards,
  devEntries,
  onOpenDevReviewModal
}) => {
  const [drafterSearch, setDrafterSearch] = useState('');
  const [selectedPhaseFilter, setSelectedPhaseFilter] = useState<string>('ALL');

  // Local filtering states for Greg's Dev Card
  const [gregTimeFilter, setGregTimeFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [gregProjectFilter, setGregProjectFilter] = useState<string>('ALL');

  // Title formatting based on viewer: Jason, Kyle, Drew, Greg
  const boardOwnerName = currentStaff?.name 
    ? (currentStaff.name.toLowerCase().includes('kyle') ? 'Kyle' 
      : currentStaff.name.toLowerCase().includes('jason') ? 'Jason' 
      : currentStaff.name.toLowerCase().includes('drew') ? 'Drew' 
      : currentStaff.name.toLowerCase().includes('greg') ? 'Greg' 
      : currentStaff.name)
    : 'Operations & Management';

  const effectiveStaffList = staffList && staffList.length > 0 ? staffList : STAFF_USERS;

  // Filter staff list to drafter & project lead personnel, PLUS Greg Hyatt (lead dev & owner)
  const drafterStaffList = effectiveStaffList.filter(
    s => s.role === 'drafter' || 
         s.role === 'drafter_lead' || 
         s.name.toLowerCase().includes('kyle') || 
         s.name.toLowerCase().includes('jason') ||
         isUserGregHyatt(s) ||
         s.name.toLowerCase().includes('greg')
  );

  // Guarantee Greg Hyatt is present if not already in effectiveStaffList
  const gregFromStaff = effectiveStaffList.find(s => isUserGregHyatt(s) || s.name.toLowerCase().includes('greg'));
  const gregFromCurrent = (currentStaff && (isUserGregHyatt(currentStaff) || currentStaff.name.toLowerCase().includes('greg'))) ? currentStaff : null;
  const gregProfile = gregFromCurrent || gregFromStaff || STAFF_USERS.find(s => isUserGregHyatt(s)) || STAFF_USERS[0];
  const gregActualTitle = gregProfile?.title || 'Owner & Principal Architect';

  if (!drafterStaffList.some(s => isUserGregHyatt(s) || s.name.toLowerCase().includes('greg'))) {
    drafterStaffList.unshift({
      id: gregProfile?.id || 'staff-greg',
      name: gregProfile?.name || 'Greg Hyatt',
      email: gregProfile?.email || 'arkcwd@gmail.com',
      role: 'admin',
      title: gregActualTitle,
      hourlyRate: gregProfile?.hourlyRate || 150,
      status: 'active',
      canAccessFinancials: true,
      canDelegate: true,
      canViewAllProjects: true,
      canManageStaff: true,
      canManageInvoices: true,
      canEditJobPhases: true,
      canManageRoadblocks: true,
      canAccessPayroll: true
    });
  }

  // Resolve Greg's dev project cards and time entries with fallback to local store
  const effectiveDevCards = (devCards && devCards.length > 0) ? devCards : getStoredGregDevCards();
  const effectiveDevEntries = (devEntries && devEntries.length > 0) ? devEntries : getStoredGregDevEntries();

  // Helper to check if a drafter name string corresponds to someone already in drafterStaffList
  const isRepresentedInStaff = (rawName: string) => {
    const clean = rawName.trim().toLowerCase();
    if (!clean) return true;
    return drafterStaffList.some(s => {
      const sLower = s.name.toLowerCase();
      const sFirst = sLower.split(' ')[0];
      return sLower === clean || sFirst === clean || sLower.includes(clean) || clean.includes(sLower);
    });
  };

  // Find additional unique drafters named in jobs that are not already in staff list
  const uniqueAdditionalNames: string[] = Array.from(
    new Set<string>(
      jobs
        .map(j => j.assigned_drafter.split(',')[0].trim())
        .filter(name => Boolean(name) && !isRepresentedInStaff(name))
    )
  );

  // Build canonical, strictly unique drafters list using a Map
  const drafterMap = new Map<string, { id?: string; name: string; title: string; email: string; isLead: boolean; isDevLead: boolean }>();

  drafterStaffList.forEach(s => {
    const key = s.name.toLowerCase().trim();
    if (!drafterMap.has(key)) {
      const isGreg = isUserGregHyatt(s) || s.name.toLowerCase().includes('greg');
      // For Greg or any team member, strictly respect the title configured in their user profile
      const staffTitle = isGreg 
        ? (gregActualTitle || s.title || 'Owner & Principal Architect')
        : (s.title || 'Architectural Drafter');

      drafterMap.set(key, {
        id: s.id,
        name: s.name,
        title: staffTitle,
        email: s.email,
        isLead: isGreg || s.role === 'drafter_lead' || s.canDelegate,
        isDevLead: isGreg
      });
    }
  });

  uniqueAdditionalNames.forEach(name => {
    const key = name.toLowerCase().trim();
    if (!drafterMap.has(key)) {
      drafterMap.set(key, {
        id: `drafter-${key.replace(/[^a-z0-9]/g, '-')}`,
        name,
        title: 'Architectural Drafter',
        email: `${key.replace(/\s+/g, '.')}@myplanstore.com`,
        isLead: false,
        isDevLead: false
      });
    }
  });

  // Sort so Greg, Kyle, and Jason appear at the forefront, followed by drafters
  const allDrafters = Array.from(drafterMap.values()).sort((a, b) => {
    const aLower = a.name.toLowerCase();
    const bLower = b.name.toLowerCase();
    const getWeight = (n: string) => {
      if (n.includes('greg')) return 1;
      if (n.includes('kyle')) return 2;
      if (n.includes('jason')) return 3;
      return 10;
    };
    const diff = getWeight(aLower) - getWeight(bLower);
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name);
  });

  // Active live dev project check
  const activeDevCard = effectiveDevCards.find(c => c.isActive);
  const liveDevElapsed = (activeDevCard && activeDevCard.activeTimerStart)
    ? Math.max(0, Math.floor((nowTimestamp - new Date(activeDevCard.activeTimerStart).getTime()) / 1000))
    : 0;
  const liveDevTodaySeconds = (activeDevCard?.todaySeconds || 0) + liveDevElapsed;

  const todayStr = new Date().toISOString().split('T')[0];
  const todayDevEntries = effectiveDevEntries.filter(e => e.date === todayStr);
  const totalDevSeconds = effectiveDevEntries.reduce((acc, e) => acc + (e.durationSeconds || 0), 0) + liveDevElapsed;
  const todayDevSeconds = todayDevEntries.reduce((acc, e) => acc + (e.durationSeconds || 0), 0) + liveDevElapsed;

  // Map each drafter to their active assigned jobs & delegated work items (excluding paid/archived)
  const activeJobs = jobs.filter(j => !isJobArchived(j));
  const drafterWorkloads = allDrafters.map(drafter => {
    const drafterLower = drafter.name.toLowerCase();
    const drafterFirst = drafterLower.split(' ')[0];
    const isGreg = drafter.isDevLead || drafterLower.includes('greg');

    // Helper to check if a drafter name string matches this drafter
    const matchesThisDrafter = (target?: string) => {
      if (!target) return false;
      const t = target.toLowerCase().trim();
      return t === drafterLower || t === drafterFirst || t.includes(drafterLower) || drafterLower.includes(t);
    };

    // Lead assigned active projects
    const leadProjects = activeJobs.filter(j => 
      matchesThisDrafter(j.assigned_drafter)
    );

    // Projects where this drafter has delegated components
    const delegatedProjectsWithTasks: { job: Job; tasks: any[] }[] = [];
    activeJobs.forEach(j => {
      const matchingTasks = (j.delegated_tasks || []).filter(t => 
        matchesThisDrafter(t.assignedTo)
      );
      if (matchingTasks.length > 0) {
        delegatedProjectsWithTasks.push({ job: j, tasks: matchingTasks });
      }
    });

    // All unique active projects involved with this drafter
    const allInvolvedJobIds = new Set([
      ...leadProjects.map(j => j.id),
      ...delegatedProjectsWithTasks.map(d => d.job.id)
    ]);
    const allInvolvedJobs = activeJobs.filter(j => allInvolvedJobIds.has(j.id));

    // Live timer check
    const activeRunningJob = allInvolvedJobs.find(j => 
      Boolean(j.active_timer_start) && 
      (matchesThisDrafter(j.active_timer_drafter_name) || (!j.active_timer_drafter_name && matchesThisDrafter(j.assigned_drafter)))
    );

    // Paused by break timer check
    const pausedBreakJob = allInvolvedJobs.find(j =>
      Boolean(j.paused_by_break) &&
      (matchesThisDrafter(j.paused_timer_drafter_name) || (!j.paused_timer_drafter_name && matchesThisDrafter(j.assigned_drafter)))
    );

    // Roadblock count
    const roadblockedJobs = allInvolvedJobs.filter(j => j.roadblock);

    // Total logged time across these jobs for this drafter
    let totalSeconds = 0;
    allInvolvedJobs.forEach(j => {
      const logs = (j.time_logs || []).filter(tl => 
        matchesThisDrafter(tl.drafterName)
      );
      totalSeconds += logs.reduce((acc, l) => acc + l.durationSeconds, 0);
      if (j.active_timer_start && (matchesThisDrafter(j.active_timer_drafter_name) || (!j.active_timer_drafter_name && matchesThisDrafter(j.assigned_drafter)))) {
        totalSeconds += Math.max(0, Math.floor((nowTimestamp - new Date(j.active_timer_start).getTime()) / 1000));
      }
    });

    return {
      drafter,
      isGreg,
      leadProjects,
      delegatedProjectsWithTasks,
      allInvolvedJobs,
      activeRunningJob,
      pausedBreakJob,
      roadblockedJobs,
      totalSeconds
    };
  });

  // Filter based on search & phase / dev workstream
  const filteredDrafterWorkloads = drafterWorkloads.filter(dw => {
    const q = drafterSearch.toLowerCase().trim();

    // If searching, check drafter name, title, CAD jobs, or dev cards/entries for Greg
    if (q) {
      const matchesName = dw.drafter.name.toLowerCase().includes(q);
      const matchesTitle = dw.drafter.title.toLowerCase().includes(q);
      const matchesProject = dw.allInvolvedJobs.some(j => 
        j.job_number.toLowerCase().includes(q) || 
        j.customer_name.toLowerCase().includes(q) ||
        j.style.toLowerCase().includes(q)
      );

      let matchesDev = false;
      if (dw.isGreg) {
        matchesDev = q.includes('dev') || 
          q.includes('greg') || 
          q.includes('lead') || 
          effectiveDevCards.some(c => c.projectType.toLowerCase().includes(q) || (c.currentNotes && c.currentNotes.toLowerCase().includes(q))) ||
          effectiveDevEntries.some(e => e.projectType.toLowerCase().includes(q) || (e.notes && e.notes.toLowerCase().includes(q)));
      }

      if (!matchesName && !matchesTitle && !matchesProject && !matchesDev) return false;
    }

    // Phase / Workstream filtering
    if (selectedPhaseFilter !== 'ALL') {
      if (selectedPhaseFilter.startsWith('DEV_')) {
        // Only Greg matches dev filters
        if (!dw.isGreg) return false;
        if (selectedPhaseFilter === 'DEV_MPS') {
          return effectiveDevEntries.some(e => e.projectType === 'MPS OS Dev') || effectiveDevCards.some(c => c.projectType === 'MPS OS Dev');
        }
        if (selectedPhaseFilter === 'DEV_BIGX') {
          return effectiveDevEntries.some(e => e.projectType === 'BigX Media Dev') || effectiveDevCards.some(c => c.projectType === 'BigX Media Dev');
        }
        if (selectedPhaseFilter === 'DEV_SOUND') {
          return effectiveDevEntries.some(e => e.projectType === 'Sound Extraction Dev') || effectiveDevCards.some(c => c.projectType === 'Sound Extraction Dev');
        }
        if (selectedPhaseFilter === 'DEV_FB') {
          return effectiveDevEntries.some(e => e.projectType === 'FB Media Dev') || effectiveDevCards.some(c => c.projectType === 'FB Media Dev');
        }
        if (selectedPhaseFilter === 'DEV_OTHER') {
          return effectiveDevEntries.some(e => e.projectType === 'Other Dev') || effectiveDevCards.some(c => c.projectType === 'Other Dev');
        }
        return true;
      } else {
        // Architectural phase filter
        const hasMatchingPhase = dw.allInvolvedJobs.some(j => j.current_status === selectedPhaseFilter);
        if (!hasMatchingPhase) return false;
      }
    }

    return true;
  });

  const totalDraftersCount = allDrafters.length;
  const totalAssignedProjectsCount = jobs.filter(j => j.assigned_drafter).length;
  const activeCADTimersCount = drafterWorkloads.filter(dw => Boolean(dw.activeRunningJob)).length;
  const totalActiveTimers = activeCADTimersCount + (activeDevCard ? 1 : 0);

  // Compute filtered dev entries for Greg's card based on local and global filters
  const getFilteredGregEntries = () => {
    let list = [...effectiveDevEntries];

    // Global phase filter check
    if (selectedPhaseFilter === 'DEV_MPS') list = list.filter(e => e.projectType === 'MPS OS Dev');
    else if (selectedPhaseFilter === 'DEV_BIGX') list = list.filter(e => e.projectType === 'BigX Media Dev');
    else if (selectedPhaseFilter === 'DEV_SOUND') list = list.filter(e => e.projectType === 'Sound Extraction Dev');
    else if (selectedPhaseFilter === 'DEV_FB') list = list.filter(e => e.projectType === 'FB Media Dev');
    else if (selectedPhaseFilter === 'DEV_OTHER') list = list.filter(e => e.projectType === 'Other Dev');

    // Local project type filter
    if (gregProjectFilter !== 'ALL') {
      list = list.filter(e => e.projectType === gregProjectFilter);
    }

    // Time filter
    const now = Date.now();
    if (gregTimeFilter === 'today') {
      list = list.filter(e => e.date === todayStr);
    } else if (gregTimeFilter === 'week') {
      const sevenDaysAgo = new Date(now - 7 * 86400000).toISOString().split('T')[0];
      list = list.filter(e => e.date >= sevenDaysAgo);
    } else if (gregTimeFilter === 'month') {
      const thirtyDaysAgo = new Date(now - 30 * 86400000).toISOString().split('T')[0];
      list = list.filter(e => e.date >= thirtyDaysAgo);
    }

    // Search filter
    const q = drafterSearch.toLowerCase().trim();
    if (q && !['greg', 'hyatt', 'dev'].includes(q)) {
      list = list.filter(e => 
        e.projectType.toLowerCase().includes(q) || 
        (e.notes && e.notes.toLowerCase().includes(q)) ||
        e.date.includes(q)
      );
    }

    // Sort newest first
    list.sort((a, b) => new Date(b.startTime || b.date).getTime() - new Date(a.startTime || a.date).getTime());
    return list;
  };

  const filteredGregEntries = getFilteredGregEntries();

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-indigo-950 rounded-2xl border border-indigo-900/60 shadow-xl overflow-hidden text-white font-sans">
      
      {/* Top Banner Header */}
      <div className="px-6 py-4 border-b border-indigo-800/40 bg-slate-900/80 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-500/20 border border-blue-400/40 text-blue-400 flex items-center justify-center shadow-inner shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-white tracking-tight">
                {boardOwnerName}'s Workspace • Drafter Workload & Project Assignment Matrix
              </h3>
              <span className="text-[10px] font-mono font-bold uppercase bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2.5 py-0.5 rounded-full">
                {boardOwnerName === 'Kyle' ? 'Project Lead Matrix' : boardOwnerName === 'Drew' ? 'Finance & Operations Matrix' : 'Operations Board'}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Live oversight of architectural drafters, active project allocations, and Greg's dev project workload.
            </p>
          </div>
        </div>

        {/* Quick Summary KPI Badges */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <div className="bg-slate-800/90 border border-slate-700/80 px-3 py-1.5 rounded-xl flex items-center gap-2">
            <UserCheck className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-slate-400 text-[11px]">Team Members:</span>
            <span className="font-bold text-white">{totalDraftersCount}</span>
          </div>

          <div className="bg-slate-800/90 border border-slate-700/80 px-3 py-1.5 rounded-xl flex items-center gap-2">
            <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-slate-400 text-[11px]">Assigned Plans:</span>
            <span className="font-bold text-white">{totalAssignedProjectsCount}</span>
          </div>

          <div className="bg-slate-800/90 border border-slate-700/80 px-3 py-1.5 rounded-xl flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-slate-400 text-[11px]">Dev Cards:</span>
            <span className="font-bold text-purple-300">{effectiveDevEntries.length} logged</span>
          </div>

          <div className={`border px-3 py-1.5 rounded-xl flex items-center gap-2 ${
            totalActiveTimers > 0 
              ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300' 
              : 'bg-slate-800/90 border-slate-700/80 text-slate-400'
          }`}>
            <Clock className={`w-3.5 h-3.5 ${totalActiveTimers > 0 ? 'text-emerald-400 animate-spin' : 'text-slate-400'}`} />
            <span className="text-[11px]">Live Drafting & Dev:</span>
            <span className="font-bold">{totalActiveTimers} Active</span>
          </div>
        </div>

      </div>

      {/* Filter / Search Bar inside Jason's Drafter Board */}
      <div className="px-6 py-3 bg-slate-900/60 border-b border-indigo-950/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={drafterSearch}
            onChange={(e) => setDrafterSearch(e.target.value)}
            placeholder="Search by Drafter, Project Number, or Dev Notes..."
            className="w-full pl-8 pr-3 py-1.5 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-slate-800 transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
          <span className="text-slate-400 text-[11px] flex items-center gap-1">
            <Filter className="w-3 h-3 text-slate-400" />
            <span>Filter Phase / Workstream:</span>
          </span>
          <select
            value={selectedPhaseFilter}
            onChange={(e) => setSelectedPhaseFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white text-xs font-semibold rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="ALL">All Project Phases & Dev Workstreams</option>
            <optgroup label="💻 Greg's Dev Projects">
              <option value="DEV_ALL">All Dev Time Cards & Sprints</option>
              <option value="DEV_MPS">MPS OS Dev</option>
              <option value="DEV_BIGX">BigX Media Dev</option>
              <option value="DEV_SOUND">Sound Extraction Dev</option>
              <option value="DEV_FB">FB Media Dev</option>
              <option value="DEV_OTHER">Other Dev</option>
            </optgroup>
            <optgroup label="📐 Architectural CAD Phases">
              <option value="Customer Inquiry">Customer Inquiry</option>
              <option value="Preliminary Layout">Preliminary Layout</option>
              <option value="Customer Review">Customer Review</option>
              <option value="Revisions">Revisions</option>
              <option value="Exterior Elevations">Exterior Elevations</option>
              <option value="Construction Prints">Construction Prints</option>
              <option value="Completed">Completed</option>
            </optgroup>
          </select>
        </div>

      </div>

      {/* Drafters & Dev Workload Cards Grid */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDrafterWorkloads.map(({ drafter, isGreg, leadProjects, delegatedProjectsWithTasks, allInvolvedJobs, activeRunningJob, pausedBreakJob, roadblockedJobs, totalSeconds }) => {
          
          // ===================================================================
          // GREG HYATT DEV PROJECT TIME CARDS & WORKLOAD CARD
          // ===================================================================
          if (isGreg) {
            return (
              <div 
                key={drafter.id || 'drafter-greg-hyatt'}
                className="bg-gradient-to-b from-slate-850 to-slate-900 border-2 border-purple-500/40 hover:border-purple-400/70 rounded-2xl p-4.5 flex flex-col justify-between transition duration-200 shadow-lg group relative overflow-hidden"
              >
                {/* Subtle top ambient indicator */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-500" />

                <div>
                  {/* Drafter Profile Header for Greg */}
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-700/70">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-700 text-white font-bold text-sm flex items-center justify-center shadow-md shrink-0">
                          G
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-slate-900 border border-purple-400 flex items-center justify-center text-purple-300">
                          <Code2 className="w-2.5 h-2.5" />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-white text-sm tracking-tight">{drafter.name}</h4>
                          <span className="text-[9px] font-bold uppercase bg-purple-500/20 text-purple-300 border border-purple-400/30 px-1.5 py-0.2 rounded font-mono">
                            Dev Lead
                          </span>
                          <span className="text-[9px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-400/30 px-1.5 py-0.2 rounded font-mono">
                            Owner
                          </span>
                        </div>
                        <p className="text-[11px] text-purple-300/90 font-medium">{drafter.title}</p>
                      </div>
                    </div>

                    {/* Active Dev Sprint Timer Pill */}
                    {activeDevCard ? (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/50 px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 shrink-0 animate-pulse shadow-xs">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        <Clock className="w-3 h-3 text-emerald-400 animate-spin" />
                        <span>Live: {activeDevCard.projectType.replace(' Dev', '')}</span>
                      </span>
                    ) : (
                      <span className="text-[10px] bg-slate-800/90 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 shrink-0">
                        <Terminal className="w-3 h-3 text-purple-400" />
                        <span>{effectiveDevEntries.length} Time Cards</span>
                      </span>
                    )}
                  </div>

                  {/* Greg Dev Stats Bar */}
                  <div className="grid grid-cols-3 gap-2 py-3 text-center border-b border-slate-700/70 text-[11px]">
                    <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-700/50">
                      <span className="text-slate-400 text-[10px] block">Dev Types</span>
                      <span className="font-bold text-purple-300 text-sm">{effectiveDevCards.length} Projects</span>
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-700/50">
                      <span className="text-slate-400 text-[10px] block">Logged Today</span>
                      <span className="font-bold text-emerald-400 text-xs font-mono">
                        {todayDevSeconds > 0 ? formatSecondsToReadable(todayDevSeconds) : '0h 0m'}
                      </span>
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-700/50">
                      <span className="text-slate-400 text-[10px] block">Total Dev Time</span>
                      <span className="font-bold text-cyan-300 text-xs font-mono">
                        {totalDevSeconds > 0 ? formatSecondsToReadable(totalDevSeconds) : '0h 0m'}
                      </span>
                    </div>
                  </div>

                  {/* ACTIVE DEV SPRINT (WHAT HE IS CURRENTLY WORKING ON) */}
                  {activeDevCard && (
                    <div className="mt-3 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/50 shadow-inner">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                          <span className="text-[10px] font-black uppercase text-emerald-300 tracking-wider">
                            Currently Working On:
                          </span>
                        </div>
                        <span className="font-mono font-bold text-xs text-emerald-300 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-emerald-400 animate-spin" />
                          {formatSecondsToReadable(liveDevTodaySeconds)}
                        </span>
                      </div>
                      
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${DEV_THEME_BADGES[activeDevCard.projectType]?.bg || 'bg-purple-950/80'} ${DEV_THEME_BADGES[activeDevCard.projectType]?.text || 'text-purple-200'} ${DEV_THEME_BADGES[activeDevCard.projectType]?.border || 'border-purple-500/50'}`}>
                          {activeDevCard.projectType}
                        </span>
                        {activeDevCard.currentNotes && (
                          <p className="text-xs text-slate-200 font-medium truncate flex-1" title={activeDevCard.currentNotes}>
                            {activeDevCard.currentNotes}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Assigned Dev Project Time Cards & Internal Filter Controls */}
                  <div className="pt-3 space-y-2.5">
                    
                    {/* Header with Local Filters */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1">
                          <Terminal className="w-3 h-3 text-purple-400" />
                          <span>Dev Project Time Cards:</span>
                        </span>
                        <span className="text-slate-400 font-mono text-[10px]">
                          {filteredGregEntries.length} {filteredGregEntries.length === 1 ? 'item' : 'items'}
                        </span>
                      </div>

                      {/* Quick Filter Bar (Time Period & Project Type) */}
                      <div className="flex items-center justify-between gap-1.5 pt-0.5 text-[10px]">
                        
                        {/* Time period pills */}
                        <div className="flex items-center gap-1 bg-slate-900/80 p-0.5 rounded-lg border border-slate-700/60">
                          <button
                            onClick={() => setGregTimeFilter('all')}
                            className={`px-1.5 py-0.5 rounded font-medium transition cursor-pointer ${
                              gregTimeFilter === 'all' 
                                ? 'bg-purple-600 text-white font-bold' 
                                : 'text-slate-400 hover:text-white'
                            }`}
                            title="All Time Cards"
                          >
                            All ({effectiveDevEntries.length})
                          </button>
                          <button
                            onClick={() => setGregTimeFilter('today')}
                            className={`px-1.5 py-0.5 rounded font-medium transition cursor-pointer ${
                              gregTimeFilter === 'today' 
                                ? 'bg-purple-600 text-white font-bold' 
                                : 'text-slate-400 hover:text-white'
                            }`}
                            title="Logged Today"
                          >
                            Today ({todayDevEntries.length})
                          </button>
                          <button
                            onClick={() => setGregTimeFilter('week')}
                            className={`px-1.5 py-0.5 rounded font-medium transition cursor-pointer ${
                              gregTimeFilter === 'week' 
                                ? 'bg-purple-600 text-white font-bold' 
                                : 'text-slate-400 hover:text-white'
                            }`}
                            title="This Week"
                          >
                            Week
                          </button>
                        </div>

                        {/* Project Type Filter dropdown */}
                        <select
                          value={gregProjectFilter}
                          onChange={(e) => setGregProjectFilter(e.target.value)}
                          className="bg-slate-900/90 border border-slate-700 text-purple-200 text-[10px] font-semibold rounded-lg px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-purple-400 cursor-pointer max-w-[130px]"
                        >
                          <option value="ALL">All Dev Types</option>
                          <option value="MPS OS Dev">MPS OS Dev</option>
                          <option value="BigX Media Dev">BigX Media Dev</option>
                          <option value="Sound Extraction Dev">Sound Ext. Dev</option>
                          <option value="FB Media Dev">FB Media Dev</option>
                          <option value="Other Dev">Other Dev</option>
                        </select>
                      </div>
                    </div>

                    {/* Scrollable list of Greg's Dev Time Cards (supporting multiple items per day!) */}
                    {filteredGregEntries.length === 0 ? (
                      <div className="p-3.5 rounded-xl bg-slate-900/40 border border-dashed border-slate-700/60 text-center">
                        <p className="text-xs text-slate-400 font-medium">No dev time cards found</p>
                        <span className="text-[10px] text-purple-400 font-semibold block mt-0.5">
                          Try clearing filter or searching another term
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {filteredGregEntries.map((entry, idx) => {
                          const theme = DEV_THEME_BADGES[entry.projectType] || DEV_THEME_BADGES['Other Dev'];
                          const isToday = entry.date === todayStr;
                          const dateLabel = formatEntryDateLabel(entry.date);
                          const startTimeFormatted = formatTimeOnly(entry.startTime);
                          const endTimeFormatted = formatTimeOnly(entry.endTime);

                          return (
                            <div
                              key={entry.id || `dev-entry-${idx}`}
                              className="bg-slate-900/80 hover:bg-slate-900 border border-slate-700/80 hover:border-purple-500/60 p-2.5 rounded-xl transition flex flex-col gap-1.5 shadow-2xs group/entry"
                            >
                              {/* Row 1: Project Type Pill + Date & Duration */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-1 ${theme.bg} ${theme.text} ${theme.border} shrink-0`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${theme.dot}`} />
                                    <span>{entry.projectType}</span>
                                  </span>

                                  {isToday && (
                                    <span className="text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-1.5 py-0.2 rounded font-mono">
                                      Today
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="font-mono font-bold text-xs text-emerald-400">
                                    {formatSecondsToReadable(entry.durationSeconds)}
                                  </span>
                                </div>
                              </div>

                              {/* Row 2: What he worked on (notes) */}
                              <p className="text-xs text-slate-200 font-medium line-clamp-2 leading-relaxed" title={entry.notes}>
                                {entry.notes || 'Development sprint progress'}
                              </p>

                              {/* Row 3: Timestamp & Entry Metadata */}
                              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5 border-t border-slate-800/80">
                                <span className="flex items-center gap-1 font-mono text-slate-400">
                                  <Calendar className="w-3 h-3 text-slate-500" />
                                  <span>{dateLabel}</span>
                                  {startTimeFormatted && endTimeFormatted && (
                                    <span className="text-slate-500 text-[9px]">
                                      • {startTimeFormatted} - {endTimeFormatted}
                                    </span>
                                  )}
                                </span>

                                <span className="text-[10px] text-purple-400 font-mono">
                                  Item #{filteredGregEntries.length - idx}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                  </div>

                </div>

                {/* Bottom Quick Action: Full Dev Timesheet Breakdown */}
                <div className="pt-3 mt-3 border-t border-slate-700/50 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-purple-300 font-medium">
                    {effectiveDevCards.length} dev types • {effectiveDevEntries.length} total logged
                  </span>
                  {onOpenDevReviewModal ? (
                    <button
                      onClick={onOpenDevReviewModal}
                      className="text-xs text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1 cursor-pointer transition group/btn"
                      title="Inspect Greg's full dev timesheet & CSV export"
                    >
                      <span>Timesheet Breakdown</span>
                      <ArrowUpRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
                    </button>
                  ) : onFilterByDrafter ? (
                    <button
                      onClick={() => onFilterByDrafter(drafter.name)}
                      className="text-xs text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1 cursor-pointer transition"
                    >
                      <span>Filter Dashboard</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  ) : null}
                </div>

              </div>
            );
          }

          // ===================================================================
          // STANDARD DRAFTER CARD (CAD Architectural Plans & Delegated Tasks)
          // ===================================================================
          const hasProjects = allInvolvedJobs.length > 0;

          return (
            <div 
              key={drafter.id || `drafter-${drafter.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
              className="bg-slate-800/70 hover:bg-slate-800/90 border border-slate-700/80 hover:border-indigo-500/50 rounded-2xl p-4.5 flex flex-col justify-between transition duration-200 shadow-md group"
            >
              <div>
                
                {/* Drafter Profile Header */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-700/70">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-sm flex items-center justify-center shadow-sm shrink-0">
                      {drafter.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-bold text-white text-sm tracking-tight">{drafter.name}</h4>
                        {drafter.isLead && (
                          <span className="text-[9px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-400/30 px-1.5 py-0.2 rounded font-mono">
                            Lead
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">{drafter.title}</p>
                    </div>
                  </div>

                  {/* Active Timer / Paused on Break Pill */}
                  {activeRunningJob ? (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shrink-0 animate-pulse">
                      <Clock className="w-3 h-3 text-emerald-400" />
                      <span>Timer On</span>
                    </span>
                  ) : pausedBreakJob ? (
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-400/40 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shrink-0">
                      <Coffee className="w-3 h-3 text-amber-400" />
                      <span>On Break (Paused)</span>
                    </span>
                  ) : null}
                </div>

                {/* Drafter Stats Bar */}
                <div className="grid grid-cols-3 gap-2 py-3 text-center border-b border-slate-700/70 text-[11px]">
                  <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-700/50">
                    <span className="text-slate-400 text-[10px] block">Lead Projects</span>
                    <span className="font-bold text-white text-sm">{leadProjects.length}</span>
                  </div>
                  <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-700/50">
                    <span className="text-slate-400 text-[10px] block">Delegated Tasks</span>
                    <span className="font-bold text-indigo-300 text-sm">
                      {delegatedProjectsWithTasks.reduce((acc, d) => acc + d.tasks.length, 0)}
                    </span>
                  </div>
                  <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-700/50">
                    <span className="text-slate-400 text-[10px] block">Logged CAD</span>
                    <span className="font-bold text-emerald-400 text-xs font-mono">
                      {totalSeconds > 0 ? formatSecondsToReadable(totalSeconds) : '0h 0m'}
                    </span>
                  </div>
                </div>

                {/* Assigned Projects & Phase List */}
                <div className="pt-3 space-y-2.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <Briefcase className="w-3 h-3 text-blue-400" />
                      <span>Assigned Project(s) & Status:</span>
                    </span>
                    <span className="text-slate-500 font-mono text-[10px]">
                      {allInvolvedJobs.length} active
                    </span>
                  </div>

                  {!hasProjects ? (
                    <div className="p-3.5 rounded-xl bg-slate-900/40 border border-dashed border-slate-700/60 text-center">
                      <p className="text-xs text-slate-400 font-medium">No projects currently assigned</p>
                      <span className="text-[10px] text-emerald-400 font-semibold block mt-0.5">
                        ✓ Available for new drafting assignments
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      
                      {/* Lead Projects */}
                      {leadProjects.map(job => {
                        const phaseStyle = PHASE_BADGE_STYLES[job.current_status] || PHASE_BADGE_STYLES['Customer Inquiry'];

                        return (
                          <div
                            key={job.id}
                            onClick={() => onSelectJob(job)}
                            className="bg-slate-900/80 hover:bg-slate-900 border border-slate-700/80 hover:border-blue-500/60 p-2.5 rounded-xl transition cursor-pointer flex flex-col gap-1.5 shadow-2xs group/card"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-black text-xs bg-black text-white px-2 py-0.5 rounded border border-slate-700 shadow-xs tracking-wide">
                                  #{job.job_number.replace(/^#/, '')}
                                </span>
                                <span className="text-white font-semibold text-xs truncate max-w-[130px]" title={job.customer_name}>
                                  {job.customer_name}
                                </span>
                              </div>

                              {/* Phase Status Badge */}
                              <div className={`px-2 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-1 ${phaseStyle.bg} ${phaseStyle.text} ${phaseStyle.border} shrink-0`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${phaseStyle.dot}`} />
                                <span className="truncate max-w-[105px]">{job.current_status}</span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                              <span className="truncate max-w-[160px]">
                                {job.style} • {job.sq_ft} sq ft
                              </span>
                              
                              <div className="flex items-center gap-1.5">
                                {job.roadblock && (
                                  <span className="text-red-400 font-bold flex items-center gap-0.5" title={job.roadblock_note || 'Roadblock'}>
                                    <AlertTriangle className="w-3 h-3 text-red-400" />
                                    <span>Hold</span>
                                  </span>
                                )}
                                <span className="text-blue-400 font-semibold group-hover/card:underline flex items-center gap-0.5">
                                  Open <ChevronRight className="w-3 h-3" />
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Delegated Components (if not lead on this job) */}
                      {delegatedProjectsWithTasks
                        .filter(d => !leadProjects.some(lp => lp.id === d.job.id))
                        .map(({ job, tasks }) => {
                          const phaseStyle = PHASE_BADGE_STYLES[job.current_status] || PHASE_BADGE_STYLES['Customer Inquiry'];

                          return (
                            <div
                              key={`del-proj-${job.id}`}
                              onClick={() => onSelectJob(job)}
                              className="bg-indigo-950/40 hover:bg-indigo-950/70 border border-indigo-800/50 hover:border-indigo-500/70 p-2.5 rounded-xl transition cursor-pointer flex flex-col gap-1.5 shadow-2xs group/card"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-black text-xs bg-black text-white px-2 py-0.5 rounded border border-slate-700 shadow-xs tracking-wide">
                                    #{job.job_number.replace(/^#/, '')}
                                  </span>
                                  <span className="text-white font-semibold text-xs truncate max-w-[130px]">
                                    {job.customer_name}
                                  </span>
                                </div>

                                <div className={`px-2 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-1 ${phaseStyle.bg} ${phaseStyle.text} ${phaseStyle.border} shrink-0`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${phaseStyle.dot}`} />
                                  <span className="truncate max-w-[105px]">{job.current_status}</span>
                                </div>
                              </div>

                              <div className="space-y-1 pt-0.5">
                                {tasks.map(t => (
                                  <div key={t.id} className="text-[10px] bg-indigo-900/50 text-indigo-200 border border-indigo-700/50 px-2 py-0.5 rounded flex items-center justify-between">
                                    <span className="truncate font-medium flex items-center gap-1">
                                      <ListTodo className="w-3 h-3 text-indigo-400 shrink-0" />
                                      {t.componentTitle}
                                    </span>
                                    <span className="font-bold font-mono text-[9px] text-indigo-300 ml-1">
                                      {t.status}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}

                    </div>
                  )}

                </div>

              </div>

              {/* Bottom Quick Action */}
              {onFilterByDrafter && (
                <div className="pt-3 mt-3 border-t border-slate-700/50 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-400 font-medium">
                    {allInvolvedJobs.length} plan{allInvolvedJobs.length === 1 ? '' : 's'} assigned
                  </span>
                  <button
                    onClick={() => onFilterByDrafter(drafter.name)}
                    className="text-xs text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 cursor-pointer transition"
                  >
                    <span>Filter Dashboard</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              )}

            </div>
          );
        })}
      </div>

    </div>
  );
};
