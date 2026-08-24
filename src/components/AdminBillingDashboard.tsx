import React, { useState } from 'react';
import { 
  Building2, 
  Clock, 
  AlertTriangle, 
  DollarSign, 
  FileSpreadsheet, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  X,
  ArrowUpDown, 
  ChevronRight, 
  Download, 
  Eye, 
  RefreshCw,
  Layers,
  FileText,
  User,
  ShieldAlert,
  Calendar,
  Sparkles,
  PieChart as PieIcon
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  Legend, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid 
} from 'recharts';
import { Job, JobPhase, JobComment, StaffUser } from '../types';
import { calculateJobTotalSeconds, calculateJobBillableAmount, formatSecondsToReadable, exportInvoicingCSV } from '../utils/timeUtils';
import { Lock, ShieldCheck } from 'lucide-react';
import { STAFF_USERS } from '../data/mockData';
import { JasonDrafterProjectBoard } from './JasonDrafterProjectBoard';

interface AdminBillingDashboardProps {
  jobs: Job[];
  currentStaff?: StaffUser;
  onUpdateStatus: (jobId: string, newStatus: JobPhase) => void;
  onToggleRoadblock: (jobId: string) => void;
  onSelectJob: (job: Job) => void;
  onUpdateJob: (updatedJob: Job) => void;
  nowTimestamp?: number;
}

const ALL_PHASES: JobPhase[] = [
  'Customer Inquiry',
  'Preliminary Layout',
  'Customer Review',
  'Revisions',
  'Exterior Elevations',
  'Construction Prints',
  'Completed',
];

// Color maps for charts
const PHASE_COLORS: Record<JobPhase, string> = {
  'Customer Inquiry': '#64748b',      // Slate
  'Preliminary Layout': '#3b82f6',    // Blue
  'Customer Review': '#f59e0b',      // Amber
  'Revisions': '#f97316',            // Orange
  'Exterior Elevations': '#a855f7',  // Purple
  'Construction Prints': '#6366f1',   // Indigo
  'Completed': '#10b981',            // Emerald
};

const INVOICE_COLORS = {
  'Uninvoiced': '#64748b',
  'Pending Invoicing': '#f59e0b',
  'Invoiced': '#3b82f6',
  'Paid': '#10b981',
};

// Helper: Calculate days spent in current phase
export function getDaysInPhase(job: Job): number {
  const startDateStr = job.phase_entry_date || job.created_at;
  const startMs = new Date(startDateStr).getTime();
  const diffMs = Math.max(0, Date.now() - startMs);
  return Math.round((diffMs / (1000 * 60 * 60 * 24)) * 10) / 10;
}

// Helper: Determine last activity date & description across audit logs, comments, time logs
export function getLastActivityDetails(job: Job): { timestamp: string; details: string; relativeText: string } {
  let latestMs = new Date(job.created_at).getTime();
  let latestDetails = 'Job Intake Initialized';
  let latestTimeStr = job.created_at;

  // Check audit logs
  if (job.audit_logs && job.audit_logs.length > 0) {
    const topAudit = job.audit_logs[0];
    const ms = new Date(topAudit.timestamp).getTime();
    if (ms > latestMs) {
      latestMs = ms;
      latestDetails = `${topAudit.action}: ${topAudit.details}`;
      latestTimeStr = topAudit.timestamp;
    }
  }

  // Check comments
  if (job.comments && job.comments.length > 0) {
    const topComment = job.comments[job.comments.length - 1];
    const ms = new Date(topComment.timestamp).getTime();
    if (ms > latestMs) {
      latestMs = ms;
      latestDetails = `Comment by ${topComment.author}: "${topComment.text.slice(0, 45)}${topComment.text.length > 45 ? '...' : ''}"`;
      latestTimeStr = topComment.timestamp;
    }
  }

  // Check time logs
  if (job.time_logs && job.time_logs.length > 0) {
    const topTimeLog = job.time_logs[job.time_logs.length - 1];
    const ms = new Date(topTimeLog.endTime || topTimeLog.startTime).getTime();
    if (ms > latestMs) {
      latestMs = ms;
      latestDetails = `Time Logged (${Math.round(topTimeLog.durationSeconds / 60)}m): ${topTimeLog.taskDescription || 'Drafting'}`;
      latestTimeStr = topTimeLog.endTime || topTimeLog.startTime;
    }
  }

  // Format relative time text
  const now = Date.now();
  const diffMinutes = Math.floor((now - latestMs) / (1000 * 60));
  let relativeText = '';
  if (diffMinutes < 1) relativeText = 'Just now';
  else if (diffMinutes < 60) relativeText = `${diffMinutes}m ago`;
  else if (diffMinutes < 1440) relativeText = `${Math.floor(diffMinutes / 60)}h ago`;
  else relativeText = `${Math.floor(diffMinutes / 1440)}d ago`;

  return {
    timestamp: latestTimeStr,
    details: latestDetails,
    relativeText
  };
}

export const AdminBillingDashboard: React.FC<AdminBillingDashboardProps> = ({
  jobs,
  currentStaff,
  onUpdateStatus,
  onToggleRoadblock,
  onSelectJob,
  onUpdateJob,
  nowTimestamp
}) => {
  // If current staff is not authorized for financials, show access restricted screen
  if (currentStaff && !currentStaff.canAccessFinancials) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 border border-amber-300 text-amber-700 flex items-center justify-center mx-auto shadow-sm">
          <Lock className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight font-mono">
            Financial & Invoicing Access Restricted
          </h2>
          <p className="text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
            Per company policy, drafters are restricted from viewing financial numbers, client hourly invoicing values, and Admin & Billing dashboards.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-md mx-auto shadow-sm text-left space-y-3">
          <div className="text-xs uppercase font-mono font-bold tracking-wider text-slate-400">
            Authorized Personnel Only
          </div>
          <div className="space-y-2 text-xs font-semibold text-slate-800">
            <div className="flex items-center gap-2 p-2 bg-emerald-50 text-emerald-900 rounded-lg border border-emerald-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Greg Hyatt (Owner / Principal Architect)</span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-emerald-50 text-emerald-900 rounded-lg border border-emerald-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Jason (Project Manager & Operations)</span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-emerald-50 text-emerald-900 rounded-lg border border-emerald-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Kyle (Lead Project Manager & Senior Drafter)</span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-emerald-50 text-emerald-900 rounded-lg border border-emerald-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Drew Lupkey (Admin & Billing Specialist)</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-100">
            You are currently signed in as <strong>{currentStaff.name}</strong>. Switch identity in the top right menu to access this command center.
          </p>
        </div>
      </div>
    );
  }

  // Filters & State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPhaseFilter, setSelectedPhaseFilter] = useState<string>('ALL');
  const [selectedInvoiceFilter, setSelectedInvoiceFilter] = useState<string>('ALL');
  const [selectedDrafterFilter, setSelectedDrafterFilter] = useState<string>('ALL');
  const [roadblockFilter, setRoadblockFilter] = useState<'ALL' | 'ROADBLOCKS_ONLY' | 'CLEAN_ONLY'>('ALL');
  const [minDaysInPhaseFilter, setMinDaysInPhaseFilter] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'days_desc' | 'activity_newest' | 'cost_desc' | 'job_number'>('days_desc');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // List of all drafters & team members
  const draftersList = Array.from(
    new Set([
      ...STAFF_USERS.map(s => s.name),
      ...jobs.map(j => j.assigned_drafter.split(',')[0].trim()),
      ...jobs.flatMap(j => (j.delegated_tasks || []).map(t => t.assignedTo.trim()))
    ])
  ).filter(Boolean);

  // Roadblock note editor popup state
  const [editingRoadblockJob, setEditingRoadblockJob] = useState<Job | null>(null);
  const [roadblockNoteText, setRoadblockNoteText] = useState('');

  // Update job invoice status handler
  const handleUpdateInvoiceStatus = (job: Job, newInvoiceStatus: Job['invoice_status']) => {
    const updated: Job = {
      ...job,
      invoice_status: newInvoiceStatus,
      audit_logs: [
        {
          id: `a-${Date.now()}`,
          action: 'Invoice Status Updated',
          performedBy: 'Billing Admin',
          timestamp: new Date().toISOString(),
          details: `Changed invoice status to "${newInvoiceStatus}"`
        },
        ...job.audit_logs
      ]
    };
    onUpdateJob(updated);
  };

  // Roadblock modal submit
  const handleSaveRoadblockNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoadblockJob) return;

    const isResolved = !roadblockNoteText.trim();
    const commentToAdd: JobComment = isResolved
      ? {
          id: `c-rb-res-${Date.now()}`,
          author: 'Billing Admin',
          role: 'drafter',
          text: `✅ ROADBLOCK RESOLVED: Cleared active roadblock.`,
          timestamp: new Date().toISOString()
        }
      : {
          id: `c-rb-flag-${Date.now()}`,
          author: 'Billing Admin',
          role: 'drafter',
          text: `🚨 ROADBLOCK FLAGGED: ${roadblockNoteText.trim()}`,
          timestamp: new Date().toISOString()
        };

    const updated: Job = {
      ...editingRoadblockJob,
      roadblock: !isResolved,
      roadblock_note: roadblockNoteText.trim(),
      comments: [...editingRoadblockJob.comments, commentToAdd],
      audit_logs: [
        {
          id: `a-${Date.now()}`,
          action: isResolved ? 'Roadblock Resolved' : 'Roadblock Reason Updated',
          performedBy: 'Billing Admin',
          timestamp: new Date().toISOString(),
          details: isResolved ? 'Cleared roadblock' : `Updated roadblock note: "${roadblockNoteText.trim()}"`
        },
        ...editingRoadblockJob.audit_logs
      ]
    };

    onUpdateJob(updated);
    setEditingRoadblockJob(null);
    setRoadblockNoteText('');
  };

  // Filtered Jobs Computation
  const filteredJobs = jobs.filter(job => {
    // Search query matching by MPS Number, Customer Name, Drafter, House Style, etc.
    const query = searchQuery.toLowerCase().trim();
    if (query) {
      const cleanQuery = query.replace(/[^a-z0-9]/gi, '');
      const cleanJobNum = job.job_number.toLowerCase().replace(/[^a-z0-9]/gi, '');

      const matchNumber = 
        job.job_number.toLowerCase().includes(query) ||
        `mps${job.job_number}`.toLowerCase().includes(query) ||
        `mps-${job.job_number}`.toLowerCase().includes(query) ||
        `mps ${job.job_number}`.toLowerCase().includes(query) ||
        (cleanQuery.length > 0 && cleanJobNum.includes(cleanQuery)) ||
        (cleanQuery.length > 0 && cleanQuery.includes(cleanJobNum));

      const matchCustomer = job.customer_name.toLowerCase().includes(query);
      const matchDrafter = job.assigned_drafter.toLowerCase().includes(query);
      const matchStyle = job.style.toLowerCase().includes(query);
      const matchRoadblock = (job.roadblock_note || '').toLowerCase().includes(query);
      const matchInvoice = (job.invoice_number || '').toLowerCase().includes(query);

      if (!matchNumber && !matchCustomer && !matchDrafter && !matchStyle && !matchRoadblock && !matchInvoice) {
        return false;
      }
    }

    // Phase Filter
    if (selectedPhaseFilter !== 'ALL' && job.current_status !== selectedPhaseFilter) {
      return false;
    }

    // Invoice Status Filter
    const jobInvoiceStatus = job.invoice_status || 'Uninvoiced';
    if (selectedInvoiceFilter !== 'ALL' && jobInvoiceStatus !== selectedInvoiceFilter) {
      return false;
    }

    // Drafter Filter
    if (selectedDrafterFilter !== 'ALL') {
      const drafterLower = selectedDrafterFilter.toLowerCase();
      const isLead = job.assigned_drafter.toLowerCase().includes(drafterLower);
      const hasDelegated = (job.delegated_tasks || []).some(t => t.assignedTo.toLowerCase().includes(drafterLower));
      const hasTimeLogged = (job.time_logs || []).some(tl => (tl.drafterName || '').toLowerCase().includes(drafterLower));
      if (!isLead && !hasDelegated && !hasTimeLogged) {
        return false;
      }
    }

    // Roadblock Filter
    if (roadblockFilter === 'ROADBLOCKS_ONLY' && !job.roadblock) return false;
    if (roadblockFilter === 'CLEAN_ONLY' && job.roadblock) return false;

    // Days in phase filter
    const daysInPhase = getDaysInPhase(job);
    if (minDaysInPhaseFilter > 0 && daysInPhase < minDaysInPhaseFilter) return false;

    return true;
  });

  // Sorted Jobs
  const sortedJobs = [...filteredJobs].sort((a, b) => {
    if (sortBy === 'days_desc') {
      return getDaysInPhase(b) - getDaysInPhase(a);
    }
    if (sortBy === 'activity_newest') {
      const timeA = new Date(getLastActivityDetails(a).timestamp).getTime();
      const timeB = new Date(getLastActivityDetails(b).timestamp).getTime();
      return timeB - timeA;
    }
    if (sortBy === 'cost_desc') {
      return calculateJobBillableAmount(b, nowTimestamp) - calculateJobBillableAmount(a, nowTimestamp);
    }
    if (sortBy === 'job_number') {
      return a.job_number.localeCompare(b.job_number);
    }
    return 0;
  });

  // KPI Calculations
  const totalProjects = jobs.length;
  const activeRoadblocksCount = jobs.filter(j => j.roadblock).length;
  const totalPendingInvoicing = jobs.filter(j => (j.invoice_status || 'Uninvoiced') === 'Pending Invoicing' || (j.invoice_status || 'Uninvoiced') === 'Uninvoiced').reduce((sum, j) => sum + calculateJobBillableAmount(j, nowTimestamp), 0);
  const totalPaidInvoiced = jobs.filter(j => j.invoice_status === 'Paid' || j.invoice_status === 'Invoiced').reduce((sum, j) => sum + calculateJobBillableAmount(j, nowTimestamp), 0);
  const avgDaysInPhase = jobs.length > 0 ? (jobs.reduce((sum, j) => sum + getDaysInPhase(j), 0) / jobs.length).toFixed(1) : '0';

  // Chart Data 1: Phase Distribution
  const phaseChartData = ALL_PHASES.map(phase => {
    const count = jobs.filter(j => j.current_status === phase).length;
    return {
      name: phase,
      value: count,
      color: PHASE_COLORS[phase]
    };
  }).filter(item => item.value > 0);

  // Chart Data 2: Invoicing Status Distribution
  const invoiceStatuses = ['Uninvoiced', 'Pending Invoicing', 'Invoiced', 'Paid'] as const;
  const invoiceChartData = invoiceStatuses.map(status => {
    const count = jobs.filter(j => (j.invoice_status || 'Uninvoiced') === status).length;
    return {
      name: status,
      value: count,
      color: INVOICE_COLORS[status]
    };
  }).filter(item => item.value > 0);

  // Chart Data 3: Roadblock Status Breakdown
  const roadblockChartData = [
    { name: 'Smooth Workflow', value: jobs.filter(j => !j.roadblock).length, color: '#10b981' },
    { name: 'Active Roadblock', value: jobs.filter(j => j.roadblock).length, color: '#ef4444' }
  ].filter(item => item.value > 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-200">
      
      {/* Top Banner & Control Title */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-400" />
            <h1 className="text-xl font-bold font-mono tracking-tight">Admin & Billing Command Center</h1>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-900 text-blue-300 border border-blue-700 px-2 py-0.5 rounded-full">
              Live Operations
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time tracking of architectural phases, turnaround velocity, active roadblocks, and project invoicing statuses.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => exportInvoicingCSV(filteredJobs)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-md flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export Admin Billing Report (CSV)</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1: Total Active Projects */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex justify-between items-start">
          <div>
            <span className="text-[10px] font-mono uppercase font-bold text-slate-400 tracking-wider block">
              Active Projects Portfolio
            </span>
            <span className="text-2xl font-black font-mono text-slate-900 mt-1 block">
              {totalProjects} <span className="text-xs text-slate-500 font-normal">jobs</span>
            </span>
            <span className="text-xs text-slate-500 mt-1 block">
              Avg Turnaround: <strong className="text-slate-800 font-mono">{avgDaysInPhase} days</strong> / phase
            </span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 2: Pending Invoicing Value */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex justify-between items-start">
          <div>
            <span className="text-[10px] font-mono uppercase font-bold text-amber-600 tracking-wider block">
              Unbilled & Pending Invoicing
            </span>
            <span className="text-2xl font-black font-mono text-amber-600 mt-1 block">
              ${totalPendingInvoicing.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-amber-700 mt-1 block">
              {jobs.filter(j => (j.invoice_status || 'Uninvoiced') === 'Pending Invoicing').length} ready for billing team
            </span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 3: Paid & Collected */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex justify-between items-start">
          <div>
            <span className="text-[10px] font-mono uppercase font-bold text-emerald-600 tracking-wider block">
              Invoiced & Collected Revenue
            </span>
            <span className="text-2xl font-black font-mono text-emerald-600 mt-1 block">
              ${totalPaidInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-emerald-700 mt-1 block">
              {jobs.filter(j => j.invoice_status === 'Paid').length} marked as fully paid
            </span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 4: Active Roadblocks Alert */}
        <div className={`p-5 rounded-2xl border shadow-xs flex justify-between items-start ${
          activeRoadblocksCount > 0 ? 'bg-red-50 border-red-200 text-red-950' : 'bg-white border-slate-200'
        }`}>
          <div>
            <span className="text-[10px] font-mono uppercase font-bold tracking-wider block text-red-600">
              Active Workflow Roadblocks
            </span>
            <span className="text-2xl font-black font-mono text-red-600 mt-1 block flex items-center gap-2">
              <span>{activeRoadblocksCount}</span>
              {activeRoadblocksCount > 0 && (
                <span className="text-xs bg-red-600 text-white font-sans font-bold px-2 py-0.5 rounded-full animate-pulse">
                  ATTENTION NEEDED
                </span>
              )}
            </span>
            <button
              onClick={() => setRoadblockFilter(roadblockFilter === 'ROADBLOCKS_ONLY' ? 'ALL' : 'ROADBLOCKS_ONLY')}
              className="text-xs text-red-700 underline font-semibold mt-1 block hover:text-red-900"
            >
              {roadblockFilter === 'ROADBLOCKS_ONLY' ? 'Show All Projects' : 'Filter Roadblocked Jobs →'}
            </button>
          </div>
          <div className="p-3 bg-red-100 text-red-600 rounded-xl border border-red-200">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

      </div>

      {/* CIRCLE GRAPH CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Chart 1: Project Distribution by Phase */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                Phase Breakdown ({jobs.length} Jobs)
              </h3>
            </div>
            <span className="text-[10px] font-mono font-semibold text-slate-400">Architectural Stages</span>
          </div>

          <div className="h-56 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={phaseChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {phaseChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number, name: string) => [`${value} Job(s)`, name]}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px] font-medium border-t border-slate-100 max-h-24 overflow-y-auto">
            {phaseChartData.map((item) => (
              <button
                key={item.name}
                onClick={() => setSelectedPhaseFilter(selectedPhaseFilter === item.name ? 'ALL' : item.name)}
                className={`flex items-center justify-between p-1 rounded transition text-left ${
                  selectedPhaseFilter === item.name ? 'bg-slate-200 font-bold' : 'hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-1.5 truncate">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="truncate">{item.name}</span>
                </span>
                <span className="font-mono font-bold text-slate-800 shrink-0 ml-1">{item.value}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Chart 2: Invoicing Status Distribution */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                Invoicing Status Distribution
              </h3>
            </div>
            <span className="text-[10px] font-mono font-semibold text-slate-400">Billing Lifecycle</span>
          </div>

          <div className="h-56 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={invoiceChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {invoiceChartData.map((entry, index) => (
                    <Cell key={`cell-inv-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number, name: string) => [`${value} Project(s)`, name]}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px] font-medium border-t border-slate-100">
            {invoiceChartData.map((item) => (
              <button
                key={item.name}
                onClick={() => setSelectedInvoiceFilter(selectedInvoiceFilter === item.name ? 'ALL' : item.name)}
                className={`flex items-center justify-between p-1 rounded transition text-left ${
                  selectedInvoiceFilter === item.name ? 'bg-slate-200 font-bold' : 'hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-1.5 truncate">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="truncate">{item.name}</span>
                </span>
                <span className="font-mono font-bold text-slate-800 shrink-0 ml-1">{item.value}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Chart 3: Roadblock & Risk Analysis */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-600" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                Workflow Health & Roadblocks
              </h3>
            </div>
            <span className="text-[10px] font-mono font-semibold text-slate-400">Friction Points</span>
          </div>

          <div className="h-56 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={roadblockChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {roadblockChartData.map((entry, index) => (
                    <Cell key={`cell-rb-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number, name: string) => [`${value} Job(s)`, name]}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Active Roadblock Callout List */}
          <div className="pt-1 border-t border-slate-100 text-[11px] space-y-1.5 max-h-24 overflow-y-auto">
            {activeRoadblocksCount === 0 ? (
              <div className="p-2 text-emerald-700 bg-emerald-50 rounded-lg text-center font-semibold">
                ✅ No active roadblocks in drafting pipeline!
              </div>
            ) : (
              jobs.filter(j => j.roadblock).map(rbJob => (
                <div key={rbJob.id} className="p-1.5 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between text-red-900">
                  <span className="font-bold font-mono">{rbJob.job_number}</span>
                  <span className="truncate mx-2 text-red-700 text-[10px]">{rbJob.roadblock_note || 'Roadblocked'}</span>
                  <button
                    onClick={() => onSelectJob(rbJob)}
                    className="text-[10px] font-bold underline shrink-0 hover:text-red-950"
                  >
                    Open Client Project
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* JASON, KYLE & OPERATIONS DRAFTER WORKLOAD & ACTIVE PROJECT ASSIGNMENTS BOARD */}
      {(currentStaff?.name.toLowerCase().includes('jason') || currentStaff?.name.toLowerCase().includes('kyle') || currentStaff?.name.toLowerCase().includes('greg')) && (
        <div className="my-2">
          <JasonDrafterProjectBoard
            jobs={jobs}
            onSelectJob={onSelectJob}
            onFilterByDrafter={(drafterName) => {
              setSelectedDrafterFilter(drafterName);
            }}
            nowTimestamp={nowTimestamp}
            currentStaff={currentStaff}
          />
        </div>
      )}

      {/* FILTERING & CONTROL TOOLBAR */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Search Bar for MPS Number or Customer Name */}
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-blue-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by MPS Number or Customer Name..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white shadow-2xs transition"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-md transition"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filters & Sorting */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
            
            {/* Drafter Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 px-3 py-1.5 rounded-xl text-xs">
              <span className="text-slate-500 font-medium">Drafter:</span>
              <select
                value={selectedDrafterFilter}
                onChange={(e) => setSelectedDrafterFilter(e.target.value)}
                className="bg-transparent text-slate-900 font-semibold focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Drafters</option>
                {draftersList.map(d => (
                  <option key={`admin-d-${d}`} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* Phase Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 px-3 py-1.5 rounded-xl text-xs">
              <span className="text-slate-500 font-medium">Phase:</span>
              <select
                value={selectedPhaseFilter}
                onChange={(e) => setSelectedPhaseFilter(e.target.value)}
                className="bg-transparent text-slate-900 font-semibold focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Phases ({jobs.length})</option>
                {ALL_PHASES.map(phase => (
                  <option key={phase} value={phase}>{phase}</option>
                ))}
              </select>
            </div>

            {/* Invoice Status Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 px-3 py-1.5 rounded-xl text-xs">
              <span className="text-slate-500 font-medium">Invoice:</span>
              <select
                value={selectedInvoiceFilter}
                onChange={(e) => setSelectedInvoiceFilter(e.target.value)}
                className="bg-transparent text-slate-900 font-semibold focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Invoicing States</option>
                <option value="Uninvoiced">Uninvoiced</option>
                <option value="Pending Invoicing">Pending Invoicing</option>
                <option value="Invoiced">Invoiced</option>
                <option value="Paid">Paid</option>
              </select>
            </div>

            {/* Sorting selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 px-3 py-1.5 rounded-xl text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-slate-900 font-semibold focus:outline-none cursor-pointer"
              >
                <option value="days_desc">Time in Phase (Longest first)</option>
                <option value="activity_newest">Last Activity (Newest first)</option>
                <option value="cost_desc">Billable Amount (High to Low)</option>
                <option value="job_number">Job Number</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  viewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Table
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  viewMode === 'cards' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Cards
              </button>
            </div>

          </div>

        </div>

        {/* Roadblock Quick Filter Pills & Reset Button */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Roadblock Filter:</span>
            <button
              onClick={() => setRoadblockFilter('ALL')}
              className={`px-3 py-1 rounded-lg font-semibold transition ${
                roadblockFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Projects ({jobs.length})
            </button>
            <button
              onClick={() => setRoadblockFilter('ROADBLOCKS_ONLY')}
              className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1.5 ${
                roadblockFilter === 'ROADBLOCKS_ONLY' ? 'bg-red-600 text-white shadow-xs' : 'bg-red-50 text-red-700 hover:bg-red-100'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Roadblocks Only ({activeRoadblocksCount})</span>
            </button>
            <button
              onClick={() => setRoadblockFilter('CLEAN_ONLY')}
              className={`px-3 py-1 rounded-lg font-semibold transition ${
                roadblockFilter === 'CLEAN_ONLY' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              Clean Progress ({jobs.length - activeRoadblocksCount})
            </button>
          </div>

          {(searchQuery || selectedPhaseFilter !== 'ALL' || selectedInvoiceFilter !== 'ALL' || roadblockFilter !== 'ALL' || minDaysInPhaseFilter > 0) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedPhaseFilter('ALL');
                setSelectedInvoiceFilter('ALL');
                setRoadblockFilter('ALL');
                setMinDaysInPhaseFilter(0);
              }}
              className="text-blue-600 font-bold hover:underline flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset All Filters</span>
            </button>
          )}

        </div>

      </div>

      {/* DETAILED PROJECTS LISTING TABLE VIEW */}
      {viewMode === 'table' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="font-bold text-xs uppercase tracking-wider text-slate-800">
              Detailed Project Audit & Invoicing List ({sortedJobs.length} match)
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              Click Invoice badges or Roadblock alerts to update live
            </span>
          </div>

          {sortedJobs.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <AlertTriangle className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold">No architectural projects match your filter criteria.</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedPhaseFilter('ALL');
                  setSelectedInvoiceFilter('ALL');
                  setRoadblockFilter('ALL');
                }}
                className="text-xs text-blue-600 font-bold underline"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-300 font-mono text-[10px] uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">Job & Style</th>
                    <th className="p-3.5">Customer & Drafter</th>
                    <th className="p-3.5">Phase & Time In Phase</th>
                    <th className="p-3.5">Last Activity</th>
                    <th className="p-3.5">Roadblock Status & Reason</th>
                    <th className="p-3.5">Invoice Status & Amount</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {sortedJobs.map((job) => {
                    const daysInPhase = getDaysInPhase(job);
                    const lastAct = getLastActivityDetails(job);
                    const billableAmt = calculateJobBillableAmount(job, nowTimestamp);
                    const invoiceStatus = job.invoice_status || 'Uninvoiced';

                    // Phase age color badge
                    let ageBadgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                    if (daysInPhase >= 7) ageBadgeColor = 'bg-red-50 text-red-800 border-red-300 font-bold animate-pulse';
                    else if (daysInPhase >= 4) ageBadgeColor = 'bg-amber-50 text-amber-800 border-amber-200';

                    return (
                      <tr key={job.id} className="hover:bg-slate-50 transition">
                        
                        {/* 1. Job # & Style */}
                        <td className="p-3.5">
                          <div className="space-y-1">
                            <span className="font-bold text-xs text-blue-600 font-mono block">
                              {job.job_number}
                            </span>
                            <span className="font-semibold text-slate-900 block text-xs">
                              {job.style}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500 block">
                              {job.sq_ft.toLocaleString()} sq ft
                            </span>
                          </div>
                        </td>

                        {/* 2. Customer & Drafter */}
                        <td className="p-3.5">
                          <div className="space-y-1">
                            <span className="font-semibold text-slate-800 block text-xs">
                              {job.customer_name}
                            </span>
                            <span className="text-[11px] text-slate-500 block">
                              Drafter: <strong className="text-slate-700">{job.assigned_drafter.split(',')[0]}</strong>
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono block">
                              {job.customer_phone}
                            </span>
                          </div>
                        </td>

                        {/* 3. Phase & Length of Time Being in Phase */}
                        <td className="p-3.5">
                          <div className="space-y-1.5">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold font-mono text-white" style={{ backgroundColor: PHASE_COLORS[job.current_status] }}>
                              {job.current_status}
                            </span>

                            <div className="flex items-center gap-1.5">
                              <span className={`px-2 py-0.5 rounded border text-[10px] font-mono ${ageBadgeColor}`}>
                                ⏱️ {daysInPhase} days in phase
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 4. Last Activity */}
                        <td className="p-3.5 max-w-xs">
                          <div className="space-y-1">
                            <span className="text-[10px] font-mono font-bold text-slate-500 block">
                              {lastAct.relativeText} ({new Date(lastAct.timestamp).toLocaleDateString()})
                            </span>
                            <span className="text-slate-700 text-[11px] block truncate" title={lastAct.details}>
                              {lastAct.details}
                            </span>
                          </div>
                        </td>

                        {/* 5. Roadblock Status & Reason */}
                        <td className="p-3.5 max-w-xs">
                          {job.roadblock ? (
                            <div className="bg-red-50 border border-red-200 p-2 rounded-xl text-red-950 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-[10px] uppercase text-red-600 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>Active Roadblock</span>
                                </span>
                                <button
                                  onClick={() => {
                                    setEditingRoadblockJob(job);
                                    setRoadblockNoteText(job.roadblock_note || '');
                                  }}
                                  className="text-[10px] font-bold text-red-700 underline hover:text-red-900"
                                >
                                  Edit Reason
                                </button>
                              </div>
                              <p className="text-[11px] text-red-900 font-medium leading-tight">
                                {job.roadblock_note || 'No specific roadblock note entered.'}
                              </p>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>No Roadblocks</span>
                            </div>
                          )}
                        </td>

                        {/* 6. Invoice Status & Financials */}
                        <td className="p-3.5">
                          <div className="space-y-1.5">
                            <span className="font-bold font-mono text-slate-900 block text-sm">
                              ${billableAmt.toFixed(2)}
                            </span>

                            {/* Dropdown to change invoice status */}
                            <select
                              value={invoiceStatus}
                              onChange={(e) => handleUpdateInvoiceStatus(job, e.target.value as any)}
                              className={`text-[10px] font-bold font-mono px-2 py-1 rounded border cursor-pointer focus:outline-none transition ${
                                invoiceStatus === 'Paid' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                                invoiceStatus === 'Invoiced' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                                invoiceStatus === 'Pending Invoicing' ? 'bg-amber-100 text-amber-800 border-amber-300 font-bold' :
                                'bg-slate-100 text-slate-700 border-slate-300'
                              }`}
                            >
                              <option value="Uninvoiced">Uninvoiced</option>
                              <option value="Pending Invoicing">Pending Invoicing</option>
                              <option value="Invoiced">Invoiced</option>
                              <option value="Paid">Paid</option>
                            </select>

                            {job.invoice_number && (
                              <span className="text-[10px] font-mono text-slate-400 block">
                                #{job.invoice_number}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 7. Action Button */}
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => onSelectJob(job)}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition shadow-2xs flex items-center gap-1 ml-auto"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Open Client Project</span>
                          </button>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* CARDS GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedJobs.map((job) => {
            const daysInPhase = getDaysInPhase(job);
            const lastAct = getLastActivityDetails(job);
            const billableAmt = calculateJobBillableAmount(job, nowTimestamp);
            const invoiceStatus = job.invoice_status || 'Uninvoiced';

            return (
              <div key={job.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4 hover:shadow-md transition">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-bold text-xs font-mono text-blue-600">{job.job_number}</span>
                    <h3 className="font-bold text-sm text-slate-900 mt-0.5">{job.customer_name}</h3>
                    <span className="text-xs text-slate-500">{job.style} ({job.sq_ft} sq ft)</span>
                  </div>

                  <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono text-white" style={{ backgroundColor: PHASE_COLORS[job.current_status] }}>
                    {job.current_status}
                  </span>
                </div>

                {/* Phase Age & Last Activity */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Time in Current Phase:</span>
                    <span className="font-mono font-bold text-slate-900 bg-white border px-2 py-0.5 rounded">
                      ⏱️ {daysInPhase} days
                    </span>
                  </div>

                  <div className="flex items-start justify-between text-[11px] pt-1 border-t border-slate-200">
                    <span className="text-slate-400">Last Activity:</span>
                    <span className="text-slate-700 text-right truncate ml-2 max-w-[180px]" title={lastAct.details}>
                      {lastAct.relativeText} - {lastAct.details}
                    </span>
                  </div>
                </div>

                {/* Roadblock Section */}
                {job.roadblock ? (
                  <div className="bg-red-50 border border-red-200 p-3 rounded-xl text-xs space-y-1">
                    <div className="flex items-center justify-between font-bold text-red-600">
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Active Roadblock</span>
                      </span>
                      <button
                        onClick={() => {
                          setEditingRoadblockJob(job);
                          setRoadblockNoteText(job.roadblock_note || '');
                        }}
                        className="text-[10px] underline text-red-800"
                      >
                        Edit Note
                      </button>
                    </div>
                    <p className="text-red-900 text-[11px]">
                      {job.roadblock_note || 'No description provided.'}
                    </p>
                  </div>
                ) : (
                  <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-1.5 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>No active roadblocks</span>
                  </div>
                )}

                {/* Financials & Action */}
                <div className="pt-2 border-t flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-mono">BILLABLE TOTAL</span>
                    <span className="text-sm font-bold font-mono text-slate-900">${billableAmt.toFixed(2)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={invoiceStatus}
                      onChange={(e) => handleUpdateInvoiceStatus(job, e.target.value as any)}
                      className="text-xs font-mono font-bold border rounded p-1"
                    >
                      <option value="Uninvoiced">Uninvoiced</option>
                      <option value="Pending Invoicing">Pending Invoicing</option>
                      <option value="Invoiced">Invoiced</option>
                      <option value="Paid">Paid</option>
                    </select>

                    <button
                      onClick={() => onSelectJob(job)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs p-2 rounded-lg flex items-center gap-1"
                      title="Open Client Project"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: EDIT ROADBLOCK REASON POPUP */}
      {editingRoadblockJob && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xl max-w-md w-full space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-bold text-sm text-slate-900">Manage Roadblock Reason</h3>
              </div>
              <button
                onClick={() => setEditingRoadblockJob(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRoadblockNote} className="space-y-3">
              <div>
                <span className="text-xs text-slate-500 font-mono block">Job #{editingRoadblockJob.job_number} - {editingRoadblockJob.customer_name}</span>
                <label className="block text-xs font-bold text-slate-800 mt-2 mb-1">
                  Roadblock Details & Action Items required
                </label>
                <textarea
                  value={roadblockNoteText}
                  onChange={(e) => setRoadblockNoteText(e.target.value)}
                  placeholder="Explain why this project is currently held up (e.g., County surveyor site survey pending, customer structural layout approval required)..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-900 h-24 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Leaving this text blank will resolve the roadblock flag for this project.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setRoadblockNoteText('');
                  }}
                  className="text-xs text-red-600 font-bold hover:underline"
                >
                  Clear & Resolve Roadblock
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingRoadblockJob(null)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 py-1.5 rounded-lg shadow-2xs"
                  >
                    Save Roadblock Reason
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
