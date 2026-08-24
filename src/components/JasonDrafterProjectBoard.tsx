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
  Filter
} from 'lucide-react';
import { Job, JobPhase, StaffUser, DelegatedWorkItem } from '../types';
import { STAFF_USERS } from '../data/mockData';
import { formatSecondsToReadable, calculateJobTotalSeconds } from '../utils/timeUtils';

interface JasonDrafterProjectBoardProps {
  jobs: Job[];
  onSelectJob: (job: Job) => void;
  onFilterByDrafter?: (drafterName: string) => void;
  nowTimestamp?: number;
  currentStaff?: StaffUser;
  onOpenCompleteTaskModal?: (task: DelegatedWorkItem, job: Job) => void;
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

export const JasonDrafterProjectBoard: React.FC<JasonDrafterProjectBoardProps> = ({
  jobs,
  onSelectJob,
  onFilterByDrafter,
  nowTimestamp = Date.now(),
  currentStaff
}) => {
  const [drafterSearch, setDrafterSearch] = useState('');
  const [selectedPhaseFilter, setSelectedPhaseFilter] = useState<string>('ALL');

  // Title formatting based on viewer
  const boardOwnerName = currentStaff?.name 
    ? (currentStaff.name.toLowerCase().includes('kyle') ? 'Kyle' : currentStaff.name.toLowerCase().includes('jason') ? 'Jason' : currentStaff.name)
    : 'Operations & Management';

  // Filter staff list to drafter & project lead personnel
  const drafterStaffList = STAFF_USERS.filter(
    s => s.role === 'drafter' || s.role === 'drafter_lead' || s.name === 'Kyle'
  );

  // Also include any other drafters named in jobs
  const additionalDrafterNames = jobs
    .map(j => j.assigned_drafter.split(',')[0].trim())
    .filter(name => !drafterStaffList.some(s => s.name.toLowerCase() === name.toLowerCase()));

  const allDrafters: { name: string; title: string; email: string; isLead: boolean }[] = [
    ...drafterStaffList.map(s => ({
      name: s.name,
      title: s.title,
      email: s.email,
      isLead: s.role === 'drafter_lead' || s.canDelegate
    })),
    ...additionalDrafterNames.map(name => ({
      name,
      title: 'Architectural Drafter',
      email: `${name.toLowerCase().replace(/\s+/g, '.')}@myplanstore.com`,
      isLead: false
    }))
  ];

  // Map each drafter to their assigned jobs & delegated work items
  const drafterWorkloads = allDrafters.map(drafter => {
    const drafterLower = drafter.name.toLowerCase();

    // Lead assigned projects
    const leadProjects = jobs.filter(j => 
      j.assigned_drafter.toLowerCase().includes(drafterLower)
    );

    // Projects where this drafter has delegated components
    const delegatedProjectsWithTasks: { job: Job; tasks: any[] }[] = [];
    jobs.forEach(j => {
      const matchingTasks = (j.delegated_tasks || []).filter(t => 
        t.assignedTo.toLowerCase().includes(drafterLower)
      );
      if (matchingTasks.length > 0) {
        delegatedProjectsWithTasks.push({ job: j, tasks: matchingTasks });
      }
    });

    // All unique projects involved with this drafter
    const allInvolvedJobIds = new Set([
      ...leadProjects.map(j => j.id),
      ...delegatedProjectsWithTasks.map(d => d.job.id)
    ]);
    const allInvolvedJobs = jobs.filter(j => allInvolvedJobIds.has(j.id));

    // Live timer check
    const activeRunningJob = allInvolvedJobs.find(j => Boolean(j.active_timer_start));

    // Roadblock count
    const roadblockedJobs = allInvolvedJobs.filter(j => j.roadblock);

    // Total logged time across these jobs for this drafter
    let totalSeconds = 0;
    allInvolvedJobs.forEach(j => {
      const logs = (j.time_logs || []).filter(tl => 
        (tl.drafterName || '').toLowerCase().includes(drafterLower)
      );
      totalSeconds += logs.reduce((acc, l) => acc + l.durationSeconds, 0);
      if (j.active_timer_start && j.assigned_drafter.toLowerCase().includes(drafterLower)) {
        totalSeconds += Math.max(0, Math.floor((nowTimestamp - new Date(j.active_timer_start).getTime()) / 1000));
      }
    });

    return {
      drafter,
      leadProjects,
      delegatedProjectsWithTasks,
      allInvolvedJobs,
      activeRunningJob,
      roadblockedJobs,
      totalSeconds
    };
  });

  // Filter based on search & phase
  const filteredDrafterWorkloads = drafterWorkloads.filter(dw => {
    const q = drafterSearch.toLowerCase().trim();
    if (q) {
      const matchesName = dw.drafter.name.toLowerCase().includes(q);
      const matchesTitle = dw.drafter.title.toLowerCase().includes(q);
      const matchesProject = dw.allInvolvedJobs.some(j => 
        j.job_number.toLowerCase().includes(q) || 
        j.customer_name.toLowerCase().includes(q) ||
        j.style.toLowerCase().includes(q)
      );
      if (!matchesName && !matchesTitle && !matchesProject) return false;
    }

    if (selectedPhaseFilter !== 'ALL') {
      const hasMatchingPhase = dw.allInvolvedJobs.some(j => j.current_status === selectedPhaseFilter);
      if (!hasMatchingPhase) return false;
    }

    return true;
  });

  const totalDraftersCount = allDrafters.length;
  const totalAssignedProjectsCount = jobs.filter(j => j.assigned_drafter).length;
  const activeTimersCount = drafterWorkloads.filter(dw => Boolean(dw.activeRunningJob)).length;

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
                {boardOwnerName === 'Kyle' ? 'Project Lead Matrix' : 'Operations Board'}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Live oversight of all architectural drafters, active project allocations, and stage pipeline status.
            </p>
          </div>
        </div>

        {/* Quick Summary KPI Badges */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <div className="bg-slate-800/90 border border-slate-700/80 px-3 py-1.5 rounded-xl flex items-center gap-2">
            <UserCheck className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-slate-400 text-[11px]">Drafters:</span>
            <span className="font-bold text-white">{totalDraftersCount}</span>
          </div>

          <div className="bg-slate-800/90 border border-slate-700/80 px-3 py-1.5 rounded-xl flex items-center gap-2">
            <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-slate-400 text-[11px]">Assigned Plans:</span>
            <span className="font-bold text-white">{totalAssignedProjectsCount}</span>
          </div>

          <div className={`border px-3 py-1.5 rounded-xl flex items-center gap-2 ${
            activeTimersCount > 0 
              ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300' 
              : 'bg-slate-800/90 border-slate-700/80 text-slate-400'
          }`}>
            <Clock className={`w-3.5 h-3.5 ${activeTimersCount > 0 ? 'text-emerald-400 animate-spin' : 'text-slate-400'}`} />
            <span className="text-[11px]">Live Drafting:</span>
            <span className="font-bold">{activeTimersCount} Active</span>
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
            placeholder="Search by Drafter Name or Project Number..."
            className="w-full pl-8 pr-3 py-1.5 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-slate-800 transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-slate-400 text-[11px]">Filter Phase:</span>
          <select
            value={selectedPhaseFilter}
            onChange={(e) => setSelectedPhaseFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white text-xs font-semibold rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="ALL">All Project Phases</option>
            <option value="Customer Inquiry">Customer Inquiry</option>
            <option value="Preliminary Layout">Preliminary Layout</option>
            <option value="Customer Review">Customer Review</option>
            <option value="Revisions">Revisions</option>
            <option value="Exterior Elevations">Exterior Elevations</option>
            <option value="Construction Prints">Construction Prints</option>
            <option value="Completed">Completed</option>
          </select>
        </div>

      </div>

      {/* Drafters Workload Cards Grid */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDrafterWorkloads.map(({ drafter, leadProjects, delegatedProjectsWithTasks, allInvolvedJobs, activeRunningJob, roadblockedJobs, totalSeconds }) => {
          const hasProjects = allInvolvedJobs.length > 0;

          return (
            <div 
              key={drafter.name}
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

                  {/* Active Timer Pill */}
                  {activeRunningJob && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shrink-0 animate-pulse">
                      <Clock className="w-3 h-3 text-emerald-400" />
                      <span>Timer On</span>
                    </span>
                  )}
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
                        const isJobActive = Boolean(job.active_timer_start);

                        return (
                          <div
                            key={job.id}
                            onClick={() => onSelectJob(job)}
                            className="bg-slate-900/80 hover:bg-slate-900 border border-slate-700/80 hover:border-blue-500/60 p-2.5 rounded-xl transition cursor-pointer flex flex-col gap-1.5 shadow-2xs group/card"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-xs text-blue-300 group-hover/card:text-blue-200">
                                  #{job.job_number}
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
                                  <span className="font-mono font-bold text-xs text-indigo-300">
                                    #{job.job_number}
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
