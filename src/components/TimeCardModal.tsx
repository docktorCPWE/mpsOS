import React, { useState, useMemo } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  FileSpreadsheet, 
  Coffee, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  TrendingUp, 
  DollarSign, 
  Layers, 
  Users, 
  ShieldCheck,
  Search,
  Filter,
  Plus,
  Briefcase
} from 'lucide-react';
import { StaffUser, TimeCardShift, Job } from '../types';
import { isStaffExemptFromClock } from '../data/mockData';
import { 
  formatTimeOnly, 
  formatDateOnly, 
  formatMinutesToReadable,
  calculateShiftWorkSeconds,
  calculateShiftBreakSeconds,
  getEmployeeWeeklySummary,
  exportSingleEmployeeTimeCardCSV,
  exportTeamTimeCardsSummaryCSV
} from '../utils/timeCardExport';

interface TimeCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStaff: StaffUser;
  staffList: StaffUser[];
  timeCards: TimeCardShift[];
  jobs: Job[];
  initialSelectedStaffId?: string;
  onAddManualShift?: (shift: TimeCardShift) => void;
}

export const TimeCardModal: React.FC<TimeCardModalProps> = ({
  isOpen,
  onClose,
  currentStaff,
  staffList,
  timeCards,
  jobs,
  initialSelectedStaffId,
  onAddManualShift
}) => {
  const isJason = isStaffExemptFromClock(currentStaff);
  const isManagerOrAdmin = isJason || currentStaff.role === 'admin' || currentStaff.canAccessFinancials || currentStaff.canManageStaff;

  // View tab: 'single_employee' or 'team_matrix' (for managers/Jason)
  const [activeTab, setActiveTab] = useState<'single_employee' | 'team_matrix'>(
    isJason ? 'team_matrix' : 'single_employee'
  );

  // Selected employee for detailed single view
  const [selectedStaffId, setSelectedStaffId] = useState<string>(() => {
    if (initialSelectedStaffId) return initialSelectedStaffId;
    if (isJason) {
      const firstNonJason = staffList.find(s => !isStaffExemptFromClock(s));
      return firstNonJason ? firstNonJason.id : staffList[0]?.id || currentStaff.id;
    }
    return currentStaff.id;
  });

  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const targetStaff = staffList.find(s => s.id === selectedStaffId) || currentStaff;
  const isTargetJason = isStaffExemptFromClock(targetStaff);

  // Shifts for selected employee sorted by date descending
  const selectedStaffShifts = timeCards
    .filter(s => s.staffId === targetStaff.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Weekly calculations for the selected staff
  const staffSummary = getEmployeeWeeklySummary(targetStaff, timeCards, jobs);

  // Find project logs associated with this employee
  const employeeProjectLogs = jobs.flatMap(j => 
    (j.time_logs || []).filter(l => 
      l.drafterName.toLowerCase().includes(targetStaff.name.toLowerCase()) ||
      targetStaff.name.toLowerCase().includes(l.drafterName.toLowerCase())
    ).map(l => ({ ...l, job: j }))
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight">
                  Employee Time Cards & Work Shift Reports
                </h2>
                <span className="text-[11px] bg-slate-800 text-blue-300 font-semibold px-2.5 py-0.5 rounded-full border border-slate-700">
                  v2.4 Timesheet Engine
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isJason 
                  ? 'Operations Manager Portal • Auditing & CSV Export for all staff hours'
                  : `Reviewing shift punches, breaks, project time correlation, and CSV records`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* CSV Export Action Button */}
            {activeTab === 'single_employee' ? (
              <button
                onClick={() => exportSingleEmployeeTimeCardCSV(targetStaff, timeCards, jobs)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                title="Export this employee's time card to CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Export {targetStaff.name.split(' ')[0]}'s CSV</span>
              </button>
            ) : (
              <button
                onClick={() => exportTeamTimeCardsSummaryCSV(staffList, timeCards, jobs)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                title="Export company-wide timesheet to CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Export Company Summary (CSV)</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close time card view"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab & Filter Bar (if Manager/Jason has access to both views) */}
        {isManagerOrAdmin && (
          <div className="bg-slate-100 border-b border-slate-200 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('team_matrix')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'team_matrix'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Company Weekly Hours Matrix</span>
              </button>

              <button
                onClick={() => setActiveTab('single_employee')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'single_employee'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Individual Employee Time Card</span>
              </button>
            </div>

            {/* Employee Switcher (when on single employee view or manager) */}
            {activeTab === 'single_employee' && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Select Staff:</span>
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="bg-white border border-slate-300 text-slate-800 text-xs rounded-lg px-2.5 py-1.5 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.title}) {isStaffExemptFromClock(s) ? '• Exempt' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

          {/* VIEW 1: SINGLE EMPLOYEE DETAILED TIME CARD */}
          {activeTab === 'single_employee' && (
            <div className="space-y-6">
              
              {/* Employee Summary Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 border border-blue-200 flex items-center justify-center font-bold text-lg">
                      {targetStaff.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900">{targetStaff.name}</h3>
                        {isTargetJason ? (
                          <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">
                            Salaried Exempt
                          </span>
                        ) : (
                          <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-semibold">
                            {targetStaff.department || 'Drafting'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">{targetStaff.title} • {targetStaff.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-right">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-slate-500">Base Hourly Rate</span>
                      <p className="text-base font-bold font-mono text-slate-900">
                        ${targetStaff.hourlyRate || 75}.00<span className="text-xs text-slate-500 font-normal">/hr</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4 Metrics Metric Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 text-xs">
                      <span>Total Shift Work</span>
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <p className="text-lg font-bold font-mono text-slate-900 mt-1">
                      {staffSummary.totalShiftHours.toFixed(1)} <span className="text-xs font-normal text-slate-500">hrs</span>
                    </p>
                    <span className="text-[10px] text-slate-500">
                      Regular: {staffSummary.regularHours.toFixed(1)}h {staffSummary.overtimeHours > 0 && `• OT: ${staffSummary.overtimeHours.toFixed(1)}h`}
                    </span>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 text-xs">
                      <span>Break Time</span>
                      <Coffee className="w-3.5 h-3.5 text-amber-600" />
                    </div>
                    <p className="text-lg font-bold font-mono text-slate-900 mt-1">
                      {staffSummary.totalBreakHours.toFixed(1)} <span className="text-xs font-normal text-slate-500">hrs</span>
                    </p>
                    <span className="text-[10px] text-slate-500">
                      Unpaid meal/rest periods
                    </span>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 text-xs">
                      <span>Project Time</span>
                      <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    </div>
                    <p className="text-lg font-bold font-mono text-slate-900 mt-1">
                      {staffSummary.totalProjectHours.toFixed(1)} <span className="text-xs font-normal text-slate-500">hrs</span>
                    </p>
                    <span className="text-[10px] text-slate-500">
                      Direct drafting on CAD jobs
                    </span>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 text-xs">
                      <span>Estimated Gross</span>
                      <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <p className="text-lg font-bold font-mono text-emerald-700 mt-1">
                      ${staffSummary.estimatedGrossPay.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                    <span className="text-[10px] text-slate-500">
                      Pay period accrual
                    </span>
                  </div>
                </div>
              </div>

              {/* Shift History Punches Table */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>Shift Logs & Punch Records</span>
                    <span className="text-xs text-slate-500 font-normal">
                      ({selectedStaffShifts.length} recorded {selectedStaffShifts.length === 1 ? 'shift' : 'shifts'})
                    </span>
                  </h4>

                  <button
                    onClick={() => exportSingleEmployeeTimeCardCSV(targetStaff, timeCards, jobs)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Download CSV for this time card</span>
                  </button>
                </div>

                {isTargetJason ? (
                  <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl text-slate-500 text-xs space-y-2">
                    <ShieldCheck className="w-8 h-8 text-blue-500 mx-auto" />
                    <p className="font-semibold text-slate-700 text-sm">
                      Jason is an Operations Manager on Salaried Exempt Status
                    </p>
                    <p className="max-w-md mx-auto">
                      Daily clock punch tracking is not required for Jason. Jason can monitor, audit, and export timesheets for all architectural drafters and team members.
                    </p>
                  </div>
                ) : selectedStaffShifts.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl text-slate-500 text-xs">
                    No time card shifts recorded for this employee yet. Clock in to generate shift records.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3">Clock In</th>
                            <th className="py-2.5 px-3">Breaks & Meals</th>
                            <th className="py-2.5 px-3">Clock Out</th>
                            <th className="py-2.5 px-3 text-right">Work Hours</th>
                            <th className="py-2.5 px-3 text-right">Pay Est.</th>
                            <th className="py-2.5 px-3">Shift Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {selectedStaffShifts.map((shift) => {
                            const workSec = calculateShiftWorkSeconds(shift);
                            const breakSec = calculateShiftBreakSeconds(shift);
                            const workHours = (workSec / 3600).toFixed(2);
                            const breakMins = Math.round(breakSec / 60);
                            const rate = targetStaff.hourlyRate || 75;
                            const pay = (parseFloat(workHours) * rate).toFixed(2);

                            return (
                              <tr key={shift.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-2.5 px-3 font-sans font-medium text-slate-900 whitespace-nowrap">
                                  {formatDateOnly(shift.date)}
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap font-sans">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    shift.status === 'clocked_in'
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                      : shift.status === 'on_break'
                                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                                  }`}>
                                    {shift.status === 'clocked_in' ? 'Clocked In' : shift.status === 'on_break' ? 'On Break' : 'Completed'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-slate-800 whitespace-nowrap">
                                  {formatTimeOnly(shift.clockInTime)}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap font-sans">
                                  {shift.breaks && shift.breaks.length > 0 ? (
                                    <div className="flex flex-col gap-0.5">
                                      {shift.breaks.map((b, idx) => (
                                        <span key={idx} className="text-[11px]">
                                          {formatTimeOnly(b.startTime)} - {formatTimeOnly(b.endTime)}{' '}
                                          <span className="text-amber-700 font-mono text-[10px]">
                                            ({b.endTime 
                                              ? `${Math.round((new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / 60000)}m` 
                                              : 'in progress'})
                                          </span>
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 italic">No breaks taken</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-slate-800 whitespace-nowrap">
                                  {shift.status === 'clocked_out' ? formatTimeOnly(shift.clockOutTime) : <span className="text-emerald-600 font-sans italic">In Progress</span>}
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                                  {workHours} <span className="text-[10px] font-normal text-slate-500 font-sans">hrs</span>
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-emerald-700 whitespace-nowrap">
                                  ${pay}
                                </td>
                                <td className="py-2.5 px-3 font-sans text-slate-600 max-w-xs truncate text-[11px]">
                                  {shift.notes || '--'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Project Time Logs Comparison */}
              {employeeProjectLogs.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                    <span>Associated Project Blueprint Timers ({employeeProjectLogs.length} Sessions)</span>
                  </h4>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {employeeProjectLogs.map((log) => (
                      <div key={log.id} className="bg-white border border-slate-200 rounded-lg p-2 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-blue-700 mr-2">{log.job.job_number}</span>
                          <span className="text-slate-800">{log.job.customer_name}</span>
                          <span className="text-slate-500 text-[11px] ml-2">({log.taskDescription || 'CAD Drafting'})</span>
                        </div>
                        <div className="font-mono font-bold text-slate-900">
                          {formatMinutesToReadable((log.durationSeconds || 0) / 60)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* VIEW 2: TEAM WEEKLY HOURS MATRIX (For Jason, Greg Hyatt, Admins) */}
          {activeTab === 'team_matrix' && (
            <div className="space-y-6">
              
              {/* Manager Header Banner */}
              <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-400" />
                    <h3 className="text-base font-bold text-white">Company-Wide Timesheet & Weekly Hours Matrix</h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Real-time status of all architectural drafters, active shifts, break durations, and estimated payroll calculations.
                  </p>
                </div>

                <button
                  onClick={() => exportTeamTimeCardsSummaryCSV(staffList, timeCards, jobs)}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition-colors cursor-pointer shrink-0"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Export Full Payroll (CSV)</span>
                </button>
              </div>

              {/* Team Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Staff Member</th>
                        <th className="py-2.5 px-3">Title & Dept</th>
                        <th className="py-2.5 px-3">Current Status</th>
                        <th className="py-2.5 px-3 text-right">Hourly Rate</th>
                        <th className="py-2.5 px-3 text-right">Shifts</th>
                        <th className="py-2.5 px-3 text-right">Total Break</th>
                        <th className="py-2.5 px-3 text-right">Shift Hours</th>
                        <th className="py-2.5 px-3 text-right">Project Hours</th>
                        <th className="py-2.5 px-3 text-right">Estimated Gross</th>
                        <th className="py-2.5 px-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {staffList.map((staff) => {
                        const isThisJason = isStaffExemptFromClock(staff);
                        const summary = getEmployeeWeeklySummary(staff, timeCards, jobs);
                        
                        // Check active status
                        const activeShift = timeCards.find(
                          s => s.staffId === staff.id && (s.status === 'clocked_in' || s.status === 'on_break')
                        );
                        const statusLabel = isThisJason 
                          ? 'Salaried (Exempt)'
                          : activeShift 
                          ? (activeShift.status === 'clocked_in' ? 'Clocked In' : 'On Break')
                          : 'Clocked Out';

                        return (
                          <tr key={staff.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-3 px-3 font-semibold text-slate-900">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                                  {staff.name.split(' ').map(n => n[0]).join('')}
                                </div>
                                <span>{staff.name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-slate-600">
                              <div className="text-[11px] font-medium text-slate-800">{staff.title}</div>
                              <div className="text-[10px] text-slate-500">{staff.department || 'Drafting'}</div>
                            </td>
                            <td className="py-3 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isThisJason
                                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                  : statusLabel === 'Clocked In'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 animate-pulse'
                                  : statusLabel === 'On Break'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-slate-100 text-slate-600'
                              }`}>
                                {statusLabel}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-medium text-slate-800">
                              ${staff.hourlyRate || 75}.00
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-slate-700">
                              {isThisJason ? '--' : summary.shifts.length}
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-slate-600">
                              {isThisJason ? '--' : `${summary.totalBreakHours.toFixed(1)}h`}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                              {isThisJason ? '40.0h (Sal)' : `${summary.totalShiftHours.toFixed(1)}h`}
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-blue-700 font-semibold">
                              {summary.totalProjectHours.toFixed(1)}h
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">
                              ${summary.estimatedGrossPay.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => {
                                    setSelectedStaffId(staff.id);
                                    setActiveTab('single_employee');
                                  }}
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-semibold transition-colors cursor-pointer"
                                  title="View individual time card"
                                >
                                  View
                                </button>
                                <button
                                  onClick={() => exportSingleEmployeeTimeCardCSV(staff, timeCards, jobs)}
                                  className="p-1 text-slate-500 hover:text-emerald-700 transition-colors cursor-pointer"
                                  title="Download employee CSV"
                                >
                                  <FileSpreadsheet className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100 border-t border-slate-200 p-3 sm:p-4 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div>
            My Plan Store Operating System • Mandatory Timesheet Logging
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
