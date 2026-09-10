import React, { useState, useMemo } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  FileSpreadsheet, 
  ChevronLeft, 
  ChevronRight, 
  Filter, 
  Download, 
  Plus, 
  Trash2, 
  Edit3, 
  Code2, 
  Video, 
  Volume2, 
  Share2, 
  Cpu, 
  DollarSign, 
  Layers,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { GregDevTimeEntry, StaffUser } from '../types';
import { 
  PRESET_DEV_PROJECT_TYPES, 
  filterGregDevEntries, 
  exportGregDevTimeEntriesCSV,
  saveStoredGregDevEntries 
} from '../utils/gregDevTimeService';
import { formatMinutesToReadable, getLocalDateString } from '../utils/timeCardExport';

interface GregDevTimeReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStaff: StaffUser;
  devEntries: GregDevTimeEntry[];
  onUpdateDevEntries: (entries: GregDevTimeEntry[]) => void;
}

export const GregDevTimeReviewModal: React.FC<GregDevTimeReviewModalProps> = ({
  isOpen,
  onClose,
  currentStaff,
  devEntries,
  onUpdateDevEntries
}) => {
  const [periodFilter, setPeriodFilter] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [anchorDate, setAnchorDate] = useState<Date>(new Date());
  const [projectTypeFilter, setProjectTypeFilter] = useState<string>('all');
  
  // Manual Entry Form state
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualProject, setManualProject] = useState<string>('MPS OS Dev');
  const [manualDate, setManualDate] = useState<string>(() => getLocalDateString(new Date()));
  const [manualHours, setManualHours] = useState<string>('1.5');
  const [manualNotes, setManualNotes] = useState<string>('');

  // Filter entries based on period and project type
  const { filtered: filteredEntries, range } = filterGregDevEntries(
    devEntries,
    periodFilter,
    anchorDate,
    projectTypeFilter
  );

  // Totals calculations
  const totalSeconds = filteredEntries.reduce((sum, e) => sum + (e.durationSeconds || 0), 0);
  const totalHours = totalSeconds / 3600;
  const totalGross = filteredEntries.reduce((sum, e) => sum + (e.billableAmount || 0), 0);
  const sessionCount = filteredEntries.length;

  // Breakdown by project type for visual progress bars
  const projectBreakdown = useMemo(() => {
    const map: { [key: string]: number } = {};
    filteredEntries.forEach(e => {
      map[e.projectType] = (map[e.projectType] || 0) + (e.durationSeconds || 0);
    });
    return Object.entries(map).map(([type, seconds]) => ({
      type,
      seconds,
      hours: seconds / 3600,
      percentage: totalSeconds > 0 ? (seconds / totalSeconds) * 100 : 0
    })).sort((a, b) => b.seconds - a.seconds);
  }, [filteredEntries, totalSeconds]);

  if (!isOpen) return null;

  // Navigate Period (Prev / Next)
  const handlePrev = () => {
    const nextDate = new Date(anchorDate);
    if (periodFilter === 'daily') {
      nextDate.setDate(nextDate.getDate() - 1);
    } else if (periodFilter === 'weekly') {
      nextDate.setDate(nextDate.getDate() - 7);
    } else {
      nextDate.setMonth(nextDate.getMonth() - 1);
    }
    setAnchorDate(nextDate);
  };

  const handleNext = () => {
    const nextDate = new Date(anchorDate);
    if (periodFilter === 'daily') {
      nextDate.setDate(nextDate.getDate() + 1);
    } else if (periodFilter === 'weekly') {
      nextDate.setDate(nextDate.getDate() + 7);
    } else {
      nextDate.setMonth(nextDate.getMonth() + 1);
    }
    setAnchorDate(nextDate);
  };

  const handleToday = () => {
    setAnchorDate(new Date());
  };

  // Delete an entry
  const handleDeleteEntry = (id: string) => {
    if (!window.confirm('Delete this dev project time entry?')) return;
    const updated = devEntries.filter(e => e.id !== id);
    onUpdateDevEntries(updated);
    saveStoredGregDevEntries(updated);
  };

  // Save manual entry
  const handleSaveManualEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const hoursNum = parseFloat(manualHours);
    if (isNaN(hoursNum) || hoursNum <= 0) {
      alert('Please enter a valid number of hours.');
      return;
    }

    const durationSeconds = Math.round(hoursNum * 3600);
    const rate = currentStaff.hourlyRate || 150;
    const billableAmount = Number((hoursNum * rate).toFixed(2));

    const newEntry: GregDevTimeEntry = {
      id: `dev-entry-manual-${Date.now()}`,
      staffId: currentStaff.id,
      staffName: currentStaff.name,
      projectType: manualProject,
      date: manualDate,
      startTime: new Date(`${manualDate}T09:00:00`).toISOString(),
      endTime: new Date(new Date(`${manualDate}T09:00:00`).getTime() + durationSeconds * 1000).toISOString(),
      durationSeconds,
      notes: manualNotes.trim() || `Manual dev entry for ${manualProject}`,
      hourlyRate: rate,
      billableAmount,
      createdAt: new Date().toISOString()
    };

    const updated = [newEntry, ...devEntries];
    onUpdateDevEntries(updated);
    saveStoredGregDevEntries(updated);
    setShowManualForm(false);
    setManualNotes('');
  };

  const getProjectIcon = (type: string) => {
    switch (type) {
      case 'MPS OS Dev':
        return <Code2 className="w-3.5 h-3.5 text-indigo-400" />;
      case 'BigX Media Dev':
        return <Video className="w-3.5 h-3.5 text-cyan-400" />;
      case 'Sound Extraction Dev':
        return <Volume2 className="w-3.5 h-3.5 text-purple-400" />;
      case 'FB Media Dev':
        return <Share2 className="w-3.5 h-3.5 text-blue-400" />;
      case 'Other Dev':
      default:
        return <Cpu className="w-3.5 h-3.5 text-amber-400" />;
    }
  };

  const getBadgeClass = (type: string) => {
    switch (type) {
      case 'MPS OS Dev':
        return 'bg-indigo-900/60 text-indigo-300 border-indigo-700/50';
      case 'BigX Media Dev':
        return 'bg-cyan-900/60 text-cyan-300 border-cyan-700/50';
      case 'Sound Extraction Dev':
        return 'bg-purple-900/60 text-purple-300 border-purple-700/50';
      case 'FB Media Dev':
        return 'bg-blue-900/60 text-blue-300 border-blue-700/50';
      case 'Other Dev':
      default:
        return 'bg-amber-900/60 text-amber-300 border-amber-700/50';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fadeIn font-sans">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold tracking-tight">
                  Greg Hyatt • Dev Project Time Review & Export
                </h2>
                <span className="text-[11px] bg-slate-800 text-indigo-300 font-semibold px-2.5 py-0.5 rounded-full border border-slate-700">
                  Daily • Weekly • Monthly
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Review and audit logged engineering hours for MPS OS, BigX Media, Sound Extraction, FB Media, and Other Dev
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Export CSV Action Button */}
            <button
              onClick={() => exportGregDevTimeEntriesCSV(filteredEntries, periodFilter, range.label, projectTypeFilter)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer hover:scale-[1.02]"
              title={`Export filtered ${periodFilter} time entries to CSV`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export {periodFilter.toUpperCase()} CSV</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close review modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Navigation Bar: Daily / Weekly / Monthly & Project Filter */}
        <div className="bg-slate-100 border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
          
          {/* Period Segmented Toggle */}
          <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-xl">
            <button
              onClick={() => setPeriodFilter('daily')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                periodFilter === 'daily'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Daily
            </button>
            <button
              onClick={() => setPeriodFilter('weekly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                periodFilter === 'weekly'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => setPeriodFilter('monthly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                periodFilter === 'monthly'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Monthly
            </button>
          </div>

          {/* Date Navigator */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              className="p-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs transition-colors cursor-pointer"
              title="Previous period"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-xs font-bold text-slate-800 px-2 py-1 bg-white border border-slate-300 rounded-lg min-w-40 text-center font-mono">
              {range.label}
            </span>

            <button
              onClick={handleNext}
              className="p-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs transition-colors cursor-pointer"
              title="Next period"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              onClick={handleToday}
              className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Today
            </button>
          </div>

          {/* Project Type Filter & Add Manual Button */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={projectTypeFilter}
                onChange={(e) => setProjectTypeFilter(e.target.value)}
                className="bg-white border border-slate-300 text-slate-800 text-xs rounded-lg px-2.5 py-1.5 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">All Dev Projects</option>
                {PRESET_DEV_PROJECT_TYPES.map(p => (
                  <option key={p.type} value={p.type}>{p.type}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setShowManualForm(!showManualForm)}
              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Manual</span>
            </button>
          </div>

        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

          {/* Manual Entry Form (Collapsible) */}
          {showManualForm && (
            <form onSubmit={handleSaveManualEntry} className="bg-indigo-50/60 border border-indigo-200 rounded-2xl p-4 animate-fadeIn">
              <div className="flex items-center justify-between pb-3 border-b border-indigo-200/80 mb-3">
                <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Log Past Dev Project Session</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setShowManualForm(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Project Type</label>
                  <select
                    value={manualProject}
                    onChange={(e) => setManualProject(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                  >
                    {PRESET_DEV_PROJECT_TYPES.map(p => (
                      <option key={p.type} value={p.type}>{p.type}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Date</label>
                  <input
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Duration (Hours)</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0.25"
                    max="24"
                    value={manualHours}
                    onChange={(e) => setManualHours(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-mono font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Estimated Value</label>
                  <div className="px-2.5 py-1.5 bg-indigo-100/70 border border-indigo-200 rounded-lg text-xs font-bold text-indigo-900 font-mono">
                    ${(parseFloat(manualHours || '0') * (currentStaff.hourlyRate || 150)).toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Session Description / Task Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Architectural blueprint calculation algorithm optimization"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowManualForm(false)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  Save Entry
                </button>
              </div>
            </form>
          )}

          {/* 4-Stat Metric Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span className="font-semibold uppercase text-[10px] tracking-wider">Total Dev Hours</span>
                <Clock className="w-4 h-4 text-indigo-600" />
              </div>
              <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
                {totalHours.toFixed(1)} <span className="text-xs font-normal text-slate-500">hrs</span>
              </p>
              <span className="text-[10px] text-slate-500">
                {formatMinutesToReadable(totalSeconds / 60)} logged
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span className="font-semibold uppercase text-[10px] tracking-wider">Total Value</span>
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-bold font-mono text-emerald-700 mt-1">
                ${totalGross.toFixed(2)}
              </p>
              <span className="text-[10px] text-slate-500">
                @ ${currentStaff.hourlyRate || 150}/hr standard rate
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span className="font-semibold uppercase text-[10px] tracking-wider">Logged Sessions</span>
                <Layers className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
                {sessionCount} <span className="text-xs font-normal text-slate-500">entries</span>
              </p>
              <span className="text-[10px] text-slate-500">
                Across {projectBreakdown.length} active project{projectBreakdown.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span className="font-semibold uppercase text-[10px] tracking-wider">Top Project Focus</span>
                <Code2 className="w-4 h-4 text-purple-600" />
              </div>
              <p className="text-sm font-bold text-slate-900 mt-1 truncate">
                {projectBreakdown[0]?.type || 'None'}
              </p>
              <span className="text-[10px] text-slate-500 font-mono">
                {projectBreakdown[0] ? `${projectBreakdown[0].hours.toFixed(1)}h (${Math.round(projectBreakdown[0].percentage)}%)` : '--'}
              </span>
            </div>
          </div>

          {/* Visual Distribution Breakdown Bar */}
          {projectBreakdown.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Project Type Distribution ({range.label})
                </span>
                <span className="text-xs text-slate-500 font-mono">{totalHours.toFixed(1)} total hours</span>
              </div>

              {/* Multi-segmented color bar */}
              <div className="h-3 w-full rounded-full bg-slate-200 overflow-hidden flex mb-3">
                {projectBreakdown.map((item) => {
                  let bg = 'bg-indigo-600';
                  if (item.type === 'BigX Media Dev') bg = 'bg-cyan-500';
                  if (item.type === 'Sound Extraction Dev') bg = 'bg-purple-600';
                  if (item.type === 'FB Media Dev') bg = 'bg-blue-600';
                  if (item.type === 'Other Dev') bg = 'bg-amber-500';

                  return (
                    <div
                      key={item.type}
                      className={`${bg} h-full transition-all duration-300`}
                      style={{ width: `${item.percentage}%` }}
                      title={`${item.type}: ${item.hours.toFixed(1)} hrs (${Math.round(item.percentage)}%)`}
                    />
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-3">
                {projectBreakdown.map((item) => (
                  <div key={item.type} className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      item.type === 'MPS OS Dev' ? 'bg-indigo-600' :
                      item.type === 'BigX Media Dev' ? 'bg-cyan-500' :
                      item.type === 'Sound Extraction Dev' ? 'bg-purple-600' :
                      item.type === 'FB Media Dev' ? 'bg-blue-600' : 'bg-amber-500'
                    }`} />
                    <span>{item.type}:</span>
                    <strong className="font-mono text-slate-900">{item.hours.toFixed(1)}h</strong>
                    <span className="text-[10px] text-slate-500">({Math.round(item.percentage)}%)</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Time Entries Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="bg-slate-100 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <span>Detailed Dev Session Log ({filteredEntries.length})</span>
                <span className="text-slate-500 font-normal">for {range.label}</span>
              </h3>
              <span className="text-xs text-slate-500 font-mono font-bold">
                Rate: ${currentStaff.hourlyRate || 150}.00/hr
              </span>
            </div>

            {filteredEntries.length === 0 ? (
              <div className="text-center py-12 px-4 bg-white">
                <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700">No Dev Time Entries Found</p>
                <p className="text-xs text-slate-500 mt-1 mb-4">
                  No sessions were logged for the selected period ({range.label}).
                </p>
                <button
                  onClick={() => setShowManualForm(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Log Past Dev Session</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3.5">Date</th>
                      <th className="py-2.5 px-3.5">Project Type</th>
                      <th className="py-2.5 px-3.5">Time Interval</th>
                      <th className="py-2.5 px-3.5 text-right">Duration</th>
                      <th className="py-2.5 px-3.5 text-right">Hours</th>
                      <th className="py-2.5 px-3.5 text-right">Total ($)</th>
                      <th className="py-2.5 px-3.5">Session Description / Notes</th>
                      <th className="py-2.5 px-3.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {filteredEntries.map((entry) => {
                      const startObj = entry.startTime ? new Date(entry.startTime) : null;
                      const endObj = entry.endTime ? new Date(entry.endTime) : null;
                      const startStr = startObj ? startObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--';
                      const endStr = endObj ? endObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--';
                      
                      const hrsDec = (entry.durationSeconds / 3600).toFixed(2);
                      const hrs = Math.floor(entry.durationSeconds / 3600);
                      const mins = Math.floor((entry.durationSeconds % 3600) / 60);

                      return (
                        <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3.5 font-sans font-medium text-slate-900 whitespace-nowrap">
                            {entry.date}
                          </td>
                          <td className="py-2.5 px-3.5 whitespace-nowrap font-sans">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getBadgeClass(entry.projectType)}`}>
                              {getProjectIcon(entry.projectType)}
                              <span>{entry.projectType}</span>
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5 text-slate-700 whitespace-nowrap font-sans">
                            {startStr} - {endStr}
                          </td>
                          <td className="py-2.5 px-3.5 text-right text-slate-900 font-bold whitespace-nowrap">
                            {hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`}
                          </td>
                          <td className="py-2.5 px-3.5 text-right text-slate-600 whitespace-nowrap">
                            {hrsDec}h
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-bold text-emerald-700 whitespace-nowrap">
                            ${entry.billableAmount.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3.5 font-sans text-slate-700 max-w-sm truncate text-[11px]">
                            {entry.notes || <span className="text-slate-400 italic">No notes</span>}
                          </td>
                          <td className="py-2.5 px-3.5 text-center font-sans">
                            <button
                              onClick={() => handleDeleteEntry(entry.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                              title="Delete entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100 border-t border-slate-200 p-4 px-6 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-600">
            Filtered Report: <strong>{filteredEntries.length} entries</strong> • <strong>{totalHours.toFixed(1)} hrs</strong> • <strong className="text-emerald-700">${totalGross.toFixed(2)}</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => exportGregDevTimeEntriesCSV(filteredEntries, periodFilter, range.label, projectTypeFilter)}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export {periodFilter.toUpperCase()} CSV</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
