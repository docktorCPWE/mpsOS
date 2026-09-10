import React, { useState, useMemo } from 'react';
import { 
  DollarSign, 
  Calendar, 
  User, 
  Search, 
  Filter, 
  Download, 
  Plus, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  Lock, 
  ShieldCheck, 
  FileSpreadsheet, 
  X, 
  ChevronDown, 
  AlertCircle, 
  ArrowUpDown, 
  Clock, 
  Building2, 
  CreditCard,
  Briefcase,
  Layers,
  HelpCircle,
  Hash
} from 'lucide-react';
import { PayrollEntry, StaffUser } from '../types';
import { canUserAccessPayroll, canUserManageStaff } from '../data/mockData';

interface PayrollTableProps {
  entries: PayrollEntry[];
  staffList: StaffUser[];
  currentStaff: StaffUser;
  onSaveEntry: (entry: PayrollEntry) => Promise<void> | void;
  onDeleteEntry: (entryId: string) => Promise<void> | void;
  onOpenStaffManagement?: () => void;
}

export const PayrollTable: React.FC<PayrollTableProps> = ({
  entries,
  staffList,
  currentStaff,
  onSaveEntry,
  onDeleteEntry,
  onOpenStaffManagement
}) => {
  const isAuthorized = canUserAccessPayroll(currentStaff);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'check_asc'>('date_desc');

  // Modal states for creating or editing entries
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PayrollEntry | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<PayrollEntry | null>(null);

  // Form State
  const [formEmployeeId, setFormEmployeeId] = useState<string>('');
  const [formPeriodStart, setFormPeriodStart] = useState<string>('');
  const [formPeriodEnd, setFormPeriodEnd] = useState<string>('');
  const [formPaymentDate, setFormPaymentDate] = useState<string>('');
  const [formAmount, setFormAmount] = useState<string>('');
  const [formCheckNumber, setFormCheckNumber] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Format date helper: YYYY-MM-DD to readable (e.g. "Sep 5, 2026")
  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '—';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const [year, month, day] = parts.map(Number);
        const d = new Date(year, month - 1, day);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  // Open Create Modal with smart defaults
  const handleOpenCreateModal = () => {
    setEditingEntry(null);
    setFormError(null);

    // Pick first staff or current staff
    const defaultStaff = staffList.find(s => s.id === currentStaff.id) || staffList[0];
    setFormEmployeeId(defaultStaff ? defaultStaff.id : '');

    // Default dates: current date as payment date
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    setFormPaymentDate(todayStr);

    // Set semi-monthly period start and end
    const currentDay = today.getDate();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    const monthPadded = currentMonth < 10 ? `0${currentMonth}` : `${currentMonth}`;

    if (currentDay > 15) {
      setFormPeriodStart(`${currentYear}-${monthPadded}-01`);
      setFormPeriodEnd(`${currentYear}-${monthPadded}-15`);
    } else {
      // Previous month second half
      const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
      const prevMonthPadded = prevMonth < 10 ? `0${prevMonth}` : `${prevMonth}`;
      const lastDay = new Date(prevYear, prevMonth, 0).getDate();
      setFormPeriodStart(`${prevYear}-${prevMonthPadded}-16`);
      setFormPeriodEnd(`${prevYear}-${prevMonthPadded}-${lastDay}`);
    }

    // Suggested check number: max check number + 1
    const checkNums = entries
      .map(e => parseInt(e.checkNumber.replace(/\D/g, ''), 10))
      .filter(n => !isNaN(n));
    const nextCheck = checkNums.length > 0 ? Math.max(...checkNums) + 1 : 1045;
    setFormCheckNumber(String(nextCheck));

    setFormAmount('');
    setFormNotes('');
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (entry: PayrollEntry) => {
    setEditingEntry(entry);
    setFormError(null);
    setFormEmployeeId(entry.employeeId);
    setFormPeriodStart(entry.periodStart);
    setFormPeriodEnd(entry.periodEnd);
    setFormPaymentDate(entry.paymentDate);
    setFormAmount(String(entry.amount));
    setFormCheckNumber(entry.checkNumber);
    setFormNotes(entry.notes || '');
    setIsModalOpen(true);
  };

  // Submit Form (Create or Update)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formEmployeeId) {
      setFormError('Please select a team member from the staff directory.');
      return;
    }

    const selectedEmployee = staffList.find(s => s.id === formEmployeeId);
    if (!selectedEmployee) {
      setFormError('Selected employee is not recognized in the staff roster.');
      return;
    }

    const parsedAmount = parseFloat(formAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError('Please enter a valid positive payment amount (e.g. 3520.00).');
      return;
    }

    if (!formPaymentDate) {
      setFormError('Please select a payment disbursement date.');
      return;
    }

    if (!formPeriodStart || !formPeriodEnd) {
      setFormError('Please provide both the pay period start and end dates.');
      return;
    }

    if (!formCheckNumber.trim()) {
      setFormError('Please specify the payroll check number or payment reference.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: PayrollEntry = {
        id: editingEntry ? editingEntry.id : `pay-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        employeeId: selectedEmployee.id,
        employeeName: selectedEmployee.name,
        employeeEmail: selectedEmployee.email,
        employeeTitle: selectedEmployee.title,
        periodStart: formPeriodStart,
        periodEnd: formPeriodEnd,
        paymentDate: formPaymentDate,
        amount: parsedAmount,
        checkNumber: formCheckNumber.trim(),
        notes: formNotes.trim(),
        createdAt: editingEntry ? editingEntry.createdAt : new Date().toISOString(),
        recordedBy: currentStaff.name,
        recordedById: currentStaff.id
      };

      await onSaveEntry(payload);
      setIsModalOpen(false);
      setEditingEntry(null);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save payroll entry. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!entryToDelete) return;
    try {
      await onDeleteEntry(entryToDelete.id);
      setEntryToDelete(null);
    } catch (err) {
      console.error('Failed to delete payroll entry:', err);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Check Number',
      'Payment Date',
      'Employee Name',
      'Employee Email',
      'Job Title',
      'Pay Period Start',
      'Pay Period End',
      'Disbursement Amount ($)',
      'Notes / Memo',
      'Recorded By',
      'Entry Created At'
    ];

    const rows = sortedEntries.map(e => [
      `"${e.checkNumber}"`,
      `"${e.paymentDate}"`,
      `"${e.employeeName}"`,
      `"${e.employeeEmail || ''}"`,
      `"${e.employeeTitle || ''}"`,
      `"${e.periodStart}"`,
      `"${e.periodEnd}"`,
      e.amount.toFixed(2),
      `"${(e.notes || '').replace(/"/g, '""')}"`,
      `"${e.recordedBy || ''}"`,
      `"${e.createdAt}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `MPS_Payroll_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      // Employee filter
      if (selectedStaffFilter !== 'all' && e.employeeId !== selectedStaffFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = e.employeeName.toLowerCase().includes(q);
        const matchCheck = e.checkNumber.toLowerCase().includes(q);
        const matchNotes = (e.notes || '').toLowerCase().includes(q);
        const matchTitle = (e.employeeTitle || '').toLowerCase().includes(q);
        return matchName || matchCheck || matchNotes || matchTitle;
      }
      return true;
    });
  }, [entries, selectedStaffFilter, searchQuery]);

  // Sorted entries
  const sortedEntries = useMemo(() => {
    return [...filteredEntries].sort((a, b) => {
      if (sortBy === 'date_desc') {
        return new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime();
      }
      if (sortBy === 'date_asc') {
        return new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime();
      }
      if (sortBy === 'amount_desc') {
        return b.amount - a.amount;
      }
      if (sortBy === 'check_asc') {
        const numA = parseInt(a.checkNumber.replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(b.checkNumber.replace(/\D/g, ''), 10) || 0;
        return numA - numB;
      }
      return 0;
    });
  }, [filteredEntries, sortBy]);

  // Aggregated KPIs
  const totalDisbursed = useMemo(() => {
    return entries.reduce((sum, e) => sum + e.amount, 0);
  }, [entries]);

  const uniqueEmployeesPaid = useMemo(() => {
    return new Set(entries.map(e => e.employeeId)).size;
  }, [entries]);

  const averageCheckAmount = useMemo(() => {
    return entries.length > 0 ? totalDisbursed / entries.length : 0;
  }, [entries, totalDisbursed]);

  // ---------------------------------------------------------------------------
  // ACCESS RESTRICTED SCREEN (If current user does not have canAccessPayroll)
  // ---------------------------------------------------------------------------
  if (!isAuthorized) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-6 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-lg">
          <Lock className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono font-semibold">
            <Lock className="w-3.5 h-3.5" />
            <span>Payroll Permissions Gated</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight font-mono">
            Payroll Ledger Access Restricted
          </h2>
          <p className="text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
            Per company privacy protocols, viewing employee compensation checks, salary distributions, and creating payroll ledger records requires explicit payroll authorization.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md mx-auto shadow-xl text-left space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-xs uppercase font-mono font-bold tracking-wider text-slate-400">
              Authorized Payroll Officers
            </span>
            <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950 border border-emerald-800 px-2 py-0.5 rounded">
              Active Privilege
            </span>
          </div>

          <div className="space-y-2 text-xs">
            {staffList.filter(s => canUserAccessPayroll(s)).map((staff) => (
              <div key={staff.id} className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800/80">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-[10px] text-white">
                    {staff.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <span className="font-semibold text-white block">{staff.name}</span>
                    <span className="text-[10px] text-slate-400">{staff.title}</span>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50">
                  Payroll Admin
                </span>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-800/80 flex flex-col gap-2">
            <p className="text-[11px] text-slate-500">
              You are signed in as <strong className="text-slate-300">{currentStaff.name}</strong> ({currentStaff.title}).
            </p>

            {onOpenStaffManagement && canUserManageStaff(currentStaff) && (
              <button
                onClick={onOpenStaffManagement}
                className="w-full py-2.5 px-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md mt-1"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Open Staff & Permissions to Grant Access</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // AUTHORIZED PAYROLL VIEW
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* HEADER CARD */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-white">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold font-mono text-white tracking-tight">
                    Payroll & Team Compensation Ledger
                  </h2>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    Authorized Access
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Record and manage employee compensation checks, track pay periods, and select from existing My Plan Store OS users.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleExportCSV}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3.5 py-2 rounded-xl transition border border-slate-700 flex items-center gap-2 cursor-pointer shadow-sm hover:border-slate-600"
              title="Export all payroll entries to CSV"
            >
              <Download className="w-4 h-4 text-slate-400" />
              <span>Export CSV</span>
            </button>

            {onOpenStaffManagement && canUserManageStaff(currentStaff) && (
              <button
                onClick={onOpenStaffManagement}
                className="bg-purple-900/50 hover:bg-purple-800/50 text-purple-200 border border-purple-700/50 text-xs font-bold px-3.5 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer shadow-sm"
                title="Configure who can view and edit payroll"
              >
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                <span>Payroll Permissions</span>
              </button>
            )}

            <button
              onClick={handleOpenCreateModal}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-md flex items-center gap-2 cursor-pointer border border-emerald-400/30 active:scale-95"
            >
              <Plus className="w-4 h-4 text-white" />
              <span>Record Payroll Entry</span>
            </button>
          </div>
        </div>

        {/* METRICS ROW */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-slate-400 block">
              Total Disbursements
            </span>
            <span className="text-2xl font-black font-mono text-emerald-400 mt-1 block">
              ${totalDisbursed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Across {entries.length} recorded entries
            </span>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-slate-400 block">
              Checks Issued
            </span>
            <span className="text-2xl font-black font-mono text-white mt-1 block">
              {entries.length}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Sequential check records
            </span>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-slate-400 block">
              Staff Paid
            </span>
            <span className="text-2xl font-black font-mono text-blue-400 mt-1 block">
              {uniqueEmployeesPaid} <span className="text-xs font-normal text-slate-500">/ {staffList.length} staff</span>
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Unique team members
            </span>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-slate-400 block">
              Average Check
            </span>
            <span className="text-2xl font-black font-mono text-amber-300 mt-1 block">
              ${averageCheckAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Per disbursement cycle
            </span>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH TOOLBAR */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Employee, Check #, Memo..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2.5 flex-wrap">
          
          {/* Employee Dropdown Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedStaffFilter}
              onChange={(e) => setSelectedStaffFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">All Employees ({staffList.length})</option>
              {staffList.map(staff => (
                <option key={staff.id} value={staff.id}>
                  {staff.name} ({staff.title})
                </option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="date_desc">Payment Date: Newest First</option>
              <option value="date_asc">Payment Date: Oldest First</option>
              <option value="amount_desc">Amount: Highest First</option>
              <option value="check_asc">Check Number: Ascending</option>
            </select>
          </div>

          {/* Result Count */}
          <span className="text-xs text-slate-500 font-mono pl-1">
            Showing <strong>{sortedEntries.length}</strong> of {entries.length}
          </span>
        </div>
      </div>

      {/* MAIN PAYROLL DATA TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="p-4 font-bold text-slate-700 min-w-[110px]">Check #</th>
                <th className="p-4 font-bold text-slate-700 min-w-[130px]">Payment Date</th>
                <th className="p-4 font-bold text-slate-700 min-w-[240px]">Employee Details</th>
                <th className="p-4 font-bold text-slate-700 min-w-[200px]">Pay Period</th>
                <th className="p-4 font-bold text-slate-700 min-w-[140px] text-right">Amount</th>
                <th className="p-4 font-bold text-slate-700 min-w-[200px]">Notes / Memo</th>
                <th className="p-4 font-bold text-slate-700 min-w-[140px]">Recorded By</th>
                <th className="p-4 font-bold text-slate-700 min-w-[100px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedEntries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-500 space-y-3">
                    <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
                      <CreditCard className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">No payroll entries found</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {searchQuery || selectedStaffFilter !== 'all' 
                          ? 'Try clearing your filters or search terms.' 
                          : 'Get started by recording the first payroll compensation check.'}
                      </p>
                    </div>
                    <button
                      onClick={handleOpenCreateModal}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Payroll Entry</span>
                    </button>
                  </td>
                </tr>
              ) : (
                sortedEntries.map((entry) => {
                  const matchedStaff = staffList.find(s => s.id === entry.employeeId);
                  return (
                    <tr key={entry.id} className="hover:bg-slate-50/80 transition group">
                      
                      {/* 1. Check Number */}
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 font-mono">
                          <span className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold flex items-center justify-center text-xs">
                            #{entry.checkNumber}
                          </span>
                        </div>
                      </td>

                      {/* 2. Payment Date */}
                      <td className="p-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-slate-900 font-semibold">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatDate(entry.paymentDate)}</span>
                        </div>
                      </td>

                      {/* 3. Employee Details (Selected from OS Users) */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {entry.employeeName.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{entry.employeeName}</span>
                              {matchedStaff && (
                                <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold uppercase ${
                                  matchedStaff.role === 'admin' 
                                    ? 'bg-purple-100 text-purple-700' 
                                    : matchedStaff.role === 'drafter_lead'
                                    ? 'bg-indigo-100 text-indigo-700'
                                    : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {matchedStaff.role === 'admin' ? 'Admin' : matchedStaff.role === 'drafter_lead' ? 'Lead' : 'Drafter'}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate max-w-[200px]">
                              {entry.employeeTitle || matchedStaff?.title || 'Staff Member'}
                            </div>
                            {entry.employeeEmail && (
                              <div className="text-[10px] text-slate-400 font-mono truncate max-w-[200px]">
                                {entry.employeeEmail}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 4. Pay Period */}
                      <td className="p-4 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-[11px] font-mono text-slate-700">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{formatDate(entry.periodStart)}</span>
                          <span className="text-slate-400">→</span>
                          <span>{formatDate(entry.periodEnd)}</span>
                        </div>
                      </td>

                      {/* 5. Amount */}
                      <td className="p-4 text-right whitespace-nowrap">
                        <span className="font-mono font-extrabold text-sm text-emerald-600">
                          ${entry.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>

                      {/* 6. Notes / Memo */}
                      <td className="p-4">
                        <div className="text-xs text-slate-700 max-w-[240px] truncate" title={entry.notes || 'No description'}>
                          {entry.notes || <span className="text-slate-300 italic">No memo</span>}
                        </div>
                      </td>

                      {/* 7. Recorded By */}
                      <td className="p-4 whitespace-nowrap">
                        <div className="text-xs text-slate-600">
                          <span className="font-medium text-slate-800 block">
                            {entry.recordedBy || 'System Admin'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                          </span>
                        </div>
                      </td>

                      {/* 8. Actions */}
                      <td className="p-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEditModal(entry)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Edit payroll entry"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEntryToDelete(entry)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Delete entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT PAYROLL ENTRY MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden text-white flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm font-mono text-white">
                    {editingEntry ? 'Edit Payroll Disbursement' : 'Record New Payroll Entry'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Select any existing My Plan Store OS user to issue check records.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitForm} className="p-6 space-y-4 overflow-y-auto">
              
              {formError && (
                <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{formError}</span>
                </div>
              )}

              {/* 1. EMPLOYEE SELECTOR (Choose from existing users in OS) */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Team Member (Existing OS Users) <span className="text-emerald-400">*</span>
                </label>
                <select
                  value={formEmployeeId}
                  onChange={(e) => setFormEmployeeId(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="" disabled>Select an employee from directory...</option>
                  {staffList.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name} — {staff.title} ({staff.department || 'Drafting'}) [${staff.hourlyRate || 75}/hr]
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Pulls active team members directly from the organization roster.
                </p>
              </div>

              {/* Row: Check Number & Payment Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Check Number <span className="text-emerald-400">*</span>
                  </label>
                  <div className="relative">
                    <Hash className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={formCheckNumber}
                      onChange={(e) => setFormCheckNumber(e.target.value)}
                      placeholder="e.g. 1045"
                      required
                      className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Payment Date <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={formPaymentDate}
                    onChange={(e) => setFormPaymentDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Row: Pay Period Start & End */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Pay Period Start <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={formPeriodStart}
                    onChange={(e) => setFormPeriodStart(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Pay Period End <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={formPeriodEnd}
                    onChange={(e) => setFormPeriodEnd(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Disbursement Amount ($) <span className="text-emerald-400">*</span>
                </label>
                <div className="relative">
                  <span className="text-xs font-bold text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="e.g. 3520.00"
                    required
                    className="w-full pl-7 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Notes / Memo */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Notes / Description / Memo
                </label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Semi-monthly drafting & senior PM salary, draw distribution..."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Recorded By info */}
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-[11px] text-slate-400 flex items-center justify-between">
                <span>Recorded By: <strong className="text-slate-200">{currentStaff.name}</strong></span>
                <span className="font-mono text-[10px] text-emerald-400">Timestamp: {new Date().toLocaleDateString()}</span>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{editingEntry ? 'Update Payroll Entry' : 'Save Payroll Entry'}</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {entryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl text-white space-y-4">
            <div className="w-10 h-10 rounded-xl bg-red-950 border border-red-800 text-red-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="text-center space-y-1">
              <h4 className="font-bold text-sm text-white">Delete Payroll Entry?</h4>
              <p className="text-xs text-slate-400">
                Are you sure you want to remove check <strong>#{entryToDelete.checkNumber}</strong> for <strong>{entryToDelete.employeeName}</strong> (${entryToDelete.amount.toFixed(2)})? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2.5 pt-2">
              <button
                onClick={() => setEntryToDelete(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
