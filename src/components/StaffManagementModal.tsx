import React, { useState } from 'react';
import { 
  X, 
  UserPlus, 
  ShieldCheck, 
  ShieldAlert, 
  Users, 
  DollarSign, 
  Share2, 
  Eye, 
  Lock, 
  Check, 
  Edit3, 
  Trash2, 
  Search, 
  Filter, 
  Building2, 
  FileText, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  Compass, 
  Phone, 
  Mail, 
  Layers, 
  Grid, 
  List,
  RotateCcw,
  Sliders,
  Shield,
  HelpCircle,
  Clock,
  Briefcase
} from 'lucide-react';
import { StaffUser, StaffDepartment, Job } from '../types';
import { isStaffDeleted } from '../data/mockData';

interface StaffManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffList: StaffUser[];
  currentStaff: StaffUser;
  jobs: Job[];
  onAddStaff: (newStaff: StaffUser) => void;
  onUpdateStaff: (updatedStaff: StaffUser) => void;
  onDeleteStaff: (staffId: string) => void;
  onResetStaff: () => void;
}

const DEPARTMENTS: StaffDepartment[] = [
  'Architecture',
  'Drafting',
  'Management',
  'Engineering',
  'Operations',
  'Finance'
];

interface RolePreset {
  id: string;
  name: string;
  badge: string;
  description: string;
  role: 'admin' | 'drafter_lead' | 'drafter';
  department: StaffDepartment;
  permissions: {
    canAccessFinancials: boolean;
    canDelegate: boolean;
    canViewAllProjects: boolean;
    canManageStaff: boolean;
    canManageInvoices: boolean;
    canEditJobPhases: boolean;
    canManageRoadblocks: boolean;
    canAccessPayroll: boolean;
  };
}

const ROLE_PRESETS: RolePreset[] = [
  {
    id: 'owner_superadmin',
    name: 'Super Admin / Owner',
    badge: '👑 Owner / Super Admin',
    description: 'Unrestricted master access to all OS tools, financial billing, staff management, payroll, and workflows.',
    role: 'admin',
    department: 'Architecture',
    permissions: {
      canAccessFinancials: true,
      canDelegate: true,
      canViewAllProjects: true,
      canManageStaff: true,
      canManageInvoices: true,
      canEditJobPhases: true,
      canManageRoadblocks: true,
      canAccessPayroll: true
    }
  },
  {
    id: 'pm_operations',
    name: 'Project Manager & Operations',
    badge: '👔 PM & Operations',
    description: 'Manages all project queues, delegates tasks, monitors finances, payroll entries, and client invoices.',
    role: 'admin',
    department: 'Management',
    permissions: {
      canAccessFinancials: true,
      canDelegate: true,
      canViewAllProjects: true,
      canManageStaff: false,
      canManageInvoices: true,
      canEditJobPhases: true,
      canManageRoadblocks: true,
      canAccessPayroll: true
    }
  },
  {
    id: 'lead_drafter_reviewer',
    name: 'Lead Project Manager & Reviewer',
    badge: '📐 Lead Reviewer',
    description: 'Coordinates drafting team, assigns component tasks, performs QA review sign-offs & revisions.',
    role: 'drafter_lead',
    department: 'Management',
    permissions: {
      canAccessFinancials: true,
      canDelegate: true,
      canViewAllProjects: true,
      canManageStaff: false,
      canManageInvoices: false,
      canEditJobPhases: true,
      canManageRoadblocks: true,
      canAccessPayroll: false
    }
  },
  {
    id: 'finance_admin',
    name: 'Billing & Finance Admin',
    badge: '💳 Billing Admin',
    description: 'Oversees time logs, hourly billing calculations, invoice generation, payroll compensation checks, and revenue exports.',
    role: 'admin',
    department: 'Finance',
    permissions: {
      canAccessFinancials: true,
      canDelegate: false,
      canViewAllProjects: true,
      canManageStaff: false,
      canManageInvoices: true,
      canEditJobPhases: false,
      canManageRoadblocks: false,
      canAccessPayroll: true
    }
  },
  {
    id: 'cad_drafter',
    name: 'Architectural Drafter',
    badge: '✏️ Drafter',
    description: 'Focuses on assigned drafting cards and delegated tasks. Financial and admin controls locked.',
    role: 'drafter',
    department: 'Drafting',
    permissions: {
      canAccessFinancials: false,
      canDelegate: false,
      canViewAllProjects: false,
      canManageStaff: false,
      canManageInvoices: false,
      canEditJobPhases: false,
      canManageRoadblocks: false,
      canAccessPayroll: false
    }
  }
];

export const StaffManagementModal: React.FC<StaffManagementModalProps> = ({
  isOpen,
  onClose,
  staffList,
  currentStaff,
  jobs,
  onAddStaff,
  onUpdateStaff,
  onDeleteStaff,
  onResetStaff
}) => {
  const [viewMode, setViewMode] = useState<'cards' | 'matrix'>('cards');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'drafter_lead' | 'drafter'>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<StaffUser | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Form State for Add / Edit
  const [formData, setFormData] = useState<{
    id: string;
    name: string;
    email: string;
    title: string;
    phone: string;
    role: 'admin' | 'drafter_lead' | 'drafter';
    department: StaffDepartment;
    hourlyRate: number;
    status: 'active' | 'inactive';
    preferredLayout: 'grid' | 'board' | 'table';
    canAccessFinancials: boolean;
    canDelegate: boolean;
    canViewAllProjects: boolean;
    canManageStaff: boolean;
    canManageInvoices: boolean;
    canEditJobPhases: boolean;
    canManageRoadblocks: boolean;
    canAccessPayroll: boolean;
  }>({
    id: '',
    name: '',
    email: '',
    title: '',
    phone: '',
    role: 'drafter',
    department: 'Drafting',
    hourlyRate: 75,
    status: 'active',
    preferredLayout: 'grid',
    canAccessFinancials: false,
    canDelegate: false,
    canViewAllProjects: false,
    canManageStaff: false,
    canManageInvoices: false,
    canEditJobPhases: false,
    canManageRoadblocks: false,
    canAccessPayroll: false
  });

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  // Open Create New Staff Form
  const handleOpenCreate = () => {
    setEditingStaff(null);
    setFormData({
      id: `staff-${Date.now()}`,
      name: '',
      email: '',
      title: 'Architectural Drafter',
      phone: '(555) 000-0000',
      role: 'drafter',
      department: 'Drafting',
      hourlyRate: 75,
      status: 'active',
      preferredLayout: 'grid',
      canAccessFinancials: false,
      canDelegate: false,
      canViewAllProjects: false,
      canManageStaff: false,
      canManageInvoices: false,
      canEditJobPhases: false,
      canManageRoadblocks: false,
      canAccessPayroll: false
    });
    setIsCreatingNew(true);
  };

  // Open Edit Existing Staff Form
  const handleOpenEdit = (staff: StaffUser) => {
    setIsCreatingNew(false);
    setEditingStaff(staff);
    setFormData({
      id: staff.id,
      name: staff.name,
      email: staff.email,
      title: staff.title,
      phone: staff.phone || '(555) 000-0000',
      role: staff.role,
      department: staff.department || 'Drafting',
      hourlyRate: staff.hourlyRate || 75,
      status: staff.status || 'active',
      preferredLayout: staff.preferredLayout || 'grid',
      canAccessFinancials: staff.canAccessFinancials,
      canDelegate: staff.canDelegate,
      canViewAllProjects: Boolean(staff.canViewAllProjects),
      canManageStaff: Boolean(staff.canManageStaff),
      canManageInvoices: Boolean(staff.canManageInvoices),
      canEditJobPhases: Boolean(staff.canEditJobPhases),
      canManageRoadblocks: Boolean(staff.canManageRoadblocks),
      canAccessPayroll: Boolean(staff.canAccessPayroll)
    });
  };

  // Apply Role Preset to Form
  const handleApplyPreset = (preset: RolePreset) => {
    setFormData(prev => ({
      ...prev,
      role: preset.role,
      department: preset.department,
      ...preset.permissions
    }));
    showToast(`Applied preset: ${preset.name}`);
  };

  // Save Form (Create or Update)
  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      alert('Please provide both staff name and email.');
      return;
    }

    const payload: StaffUser = {
      id: formData.id || `staff-${Date.now()}`,
      name: formData.name.trim(),
      email: formData.email.trim().toLowerCase(),
      title: formData.title.trim() || 'Staff Member',
      phone: formData.phone.trim(),
      role: formData.role,
      department: formData.department,
      hourlyRate: Number(formData.hourlyRate) || 0,
      status: formData.status,
      joinedDate: isCreatingNew ? new Date().toISOString().split('T')[0] : (editingStaff?.joinedDate || '2023-01-01'),
      canAccessFinancials: formData.canAccessFinancials,
      canDelegate: formData.canDelegate,
      canViewAllProjects: formData.canViewAllProjects,
      canManageStaff: formData.name.toLowerCase().includes('greg hyatt') ? true : formData.canManageStaff,
      canManageInvoices: formData.canManageInvoices,
      canEditJobPhases: formData.canEditJobPhases,
      canManageRoadblocks: formData.canManageRoadblocks,
      canAccessPayroll: formData.canAccessPayroll,
      preferredLayout: formData.preferredLayout || 'grid'
    };

    if (isCreatingNew) {
      onAddStaff(payload);
      showToast(`Added ${payload.name} to My Plan Store OS staff roster.`);
    } else {
      onUpdateStaff(payload);
      showToast(`Updated permissions & profile for ${payload.name}.`);
    }

    setIsCreatingNew(false);
    setEditingStaff(null);
  };

  // Quick Permission Toggle from Matrix View
  const handleQuickTogglePermission = (
    staff: StaffUser, 
    permKey: keyof Pick<StaffUser, 'canAccessFinancials' | 'canDelegate' | 'canViewAllProjects' | 'canManageStaff' | 'canManageInvoices' | 'canEditJobPhases' | 'canManageRoadblocks' | 'canAccessPayroll'>
  ) => {
    // Prevent locking out Greg Hyatt
    if (staff.name.toLowerCase().includes('greg hyatt') && permKey === 'canManageStaff') {
      alert('Greg Hyatt is the Owner and primary Super Admin. His staff management permission cannot be disabled.');
      return;
    }

    const updated: StaffUser = {
      ...staff,
      [permKey]: !staff[permKey]
    };
    onUpdateStaff(updated);
    showToast(`Updated ${permKey} for ${staff.name}`);
  };

  // Quick Status Toggle (Active/Inactive)
  const handleToggleStatus = (staff: StaffUser) => {
    if (staff.name.toLowerCase().includes('greg hyatt')) {
      alert('Cannot deactivate the Owner / Founder account.');
      return;
    }
    const newStatus = staff.status === 'inactive' ? 'active' : 'inactive';
    onUpdateStaff({ ...staff, status: newStatus });
    showToast(`${staff.name} is now ${newStatus}`);
  };

  // Confirm Delete
  const handleConfirmDelete = () => {
    if (!staffToDelete) return;
    if (staffToDelete.name.toLowerCase().includes('greg hyatt')) {
      alert('Greg Hyatt (Owner & Founder) cannot be deleted.');
      setStaffToDelete(null);
      return;
    }

    onDeleteStaff(staffToDelete.id);
    showToast(`Removed ${staffToDelete.name} from staff directory.`);
    setStaffToDelete(null);
  };

  // Filtered staff list
  const filteredStaff = staffList.filter(s => {
    if (isStaffDeleted(s)) return false;
    if (filterRole !== 'all' && s.role !== filterRole) return false;
    if (filterDepartment !== 'all' && s.department !== filterDepartment) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = s.name.toLowerCase().includes(q);
      const matchEmail = s.email.toLowerCase().includes(q);
      const matchTitle = s.title.toLowerCase().includes(q);
      const matchDept = (s.department || '').toLowerCase().includes(q);
      return matchName || matchEmail || matchTitle || matchDept;
    }
    return true;
  });

  // Calculate high-level stats
  const activeValidStaff = staffList.filter(s => !isStaffDeleted(s));
  const totalStaffCount = activeValidStaff.length;
  const activeStaffCount = activeValidStaff.filter(s => s.status !== 'inactive').length;
  const financialStaffCount = activeValidStaff.filter(s => s.canAccessFinancials).length;
  const delegatorStaffCount = staffList.filter(s => s.canDelegate).length;
  const adminStaffCount = staffList.filter(s => s.role === 'admin').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-6xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header Bar */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">Staff & Permissions Management</h2>
                <span className="text-[10px] font-mono uppercase bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-full font-bold">
                  Owner Level Control
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Logged in as <strong>{currentStaff.name}</strong> • Configure team members, access roles, and OS feature permissions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Reset to Default Staff Button */}
            <button
              onClick={() => {
                if (confirm('Reset staff directory to original default profiles? Any custom staff will be refreshed.')) {
                  onResetStaff();
                  showToast('Staff roster reset to system defaults.');
                }
              }}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition border border-slate-800"
              title="Reset Staff Directory to Defaults"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Add New Staff Button */}
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-lg shadow-blue-600/20 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Staff Member</span>
            </button>

            {/* Close Modal Button */}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Metrics Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 bg-slate-950/60 border-b border-slate-800 text-xs">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
            <div className="text-slate-400 text-[11px] flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span>Total Roster</span>
            </div>
            <div className="text-lg font-bold text-white mt-1">
              {totalStaffCount} <span className="text-xs font-normal text-emerald-400">({activeStaffCount} active)</span>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
            <div className="text-slate-400 text-[11px] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
              <span>Administrators</span>
            </div>
            <div className="text-lg font-bold text-purple-300 mt-1 font-mono">
              {adminStaffCount}
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
            <div className="text-slate-400 text-[11px] flex items-center gap-1.5">
              <Share2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Task Delegators</span>
            </div>
            <div className="text-lg font-bold text-indigo-300 mt-1 font-mono">
              {delegatorStaffCount}
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
            <div className="text-slate-400 text-[11px] flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              <span>Financial Access</span>
            </div>
            <div className="text-lg font-bold text-emerald-400 mt-1 font-mono">
              {financialStaffCount}
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-slate-900/90 border border-slate-800 rounded-xl p-3">
            <div className="text-slate-400 text-[11px] flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-amber-400" />
              <span>Production Drafters</span>
            </div>
            <div className="text-lg font-bold text-amber-300 mt-1 font-mono">
              {staffList.filter(s => s.role === 'drafter').length}
            </div>
          </div>
        </div>

        {/* Toolbar & Filter Bar */}
        <div className="px-6 py-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            {/* Search */}
            <div className="relative min-w-[220px] flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search staff by name, title, email..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Role Filter */}
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value as any)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin / Operations</option>
              <option value="drafter_lead">Lead Project Manager</option>
              <option value="drafter">Architectural Drafter</option>
            </select>

            {/* Department Filter */}
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All Departments</option>
              {DEPARTMENTS.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* View Mode Toggle: Cards vs Matrix Table */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                viewMode === 'cards' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Staff Cards</span>
            </button>
            <button
              onClick={() => setViewMode('matrix')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                viewMode === 'matrix' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Permissions Matrix</span>
            </button>
          </div>
        </div>

        {/* Success Toast Notice */}
        {successToast && (
          <div className="mx-6 mt-3 bg-emerald-950/80 border border-emerald-700/80 text-emerald-300 text-xs px-4 py-2 rounded-xl flex items-center gap-2 animate-fade-in shadow-lg">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {filteredStaff.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <Users className="w-12 h-12 mx-auto text-slate-600 mb-3" />
              <p className="text-sm font-semibold text-slate-400">No staff members found matching criteria.</p>
              <p className="text-xs text-slate-500 mt-1">Try changing your search terms or filters.</p>
            </div>
          ) : viewMode === 'cards' ? (
            
            /* CARDS ROSTER VIEW */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStaff.map((staff) => {
                const isOwner = staff.name.toLowerCase().includes('greg hyatt');
                const isCurrent = staff.id === currentStaff.id;

                // Count active assigned jobs
                const assignedJobCount = jobs.filter(j => 
                  j.assigned_drafter.toLowerCase().includes(staff.name.toLowerCase()) && !j.is_archived
                ).length;

                return (
                  <div
                    key={staff.id}
                    className={`bg-slate-950/70 border rounded-2xl p-4 flex flex-col justify-between transition hover:border-slate-600 ${
                      staff.status === 'inactive' ? 'opacity-60 border-slate-800' : 'border-slate-800 shadow-lg'
                    } ${isCurrent ? 'ring-1 ring-blue-500/50' : ''}`}
                  >
                    <div>
                      {/* Top Row: Avatar & Badges */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-slate-950 shadow-md ${
                            staff.role === 'admin' 
                              ? 'bg-amber-400' 
                              : staff.role === 'drafter_lead' 
                              ? 'bg-indigo-400' 
                              : 'bg-blue-400'
                          }`}>
                            {staff.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h3 className="font-bold text-sm text-white">{staff.name}</h3>
                              {isOwner && (
                                <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded font-mono font-bold">
                                  OWNER
                                </span>
                              )}
                              {isCurrent && (
                                <span className="text-[9px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.2 rounded font-mono">
                                  YOU
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 leading-tight mt-0.5">{staff.title}</p>
                          </div>
                        </div>

                        {/* Status Switch Badge */}
                        <button
                          onClick={() => handleToggleStatus(staff)}
                          disabled={isOwner}
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border transition cursor-pointer ${
                            staff.status === 'inactive'
                              ? 'bg-red-950 text-red-400 border-red-800 hover:bg-red-900'
                              : 'bg-emerald-950 text-emerald-300 border-emerald-800 hover:bg-emerald-900'
                          }`}
                          title={isOwner ? 'Owner account is permanently active' : 'Click to toggle Active/Inactive'}
                        >
                          {staff.status === 'inactive' ? 'INACTIVE' : 'ACTIVE'}
                        </button>
                      </div>

                      {/* Contact & Meta info */}
                      <div className="space-y-1 text-xs text-slate-400 bg-slate-900/60 rounded-xl p-2.5 border border-slate-850 mb-3">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-slate-400 truncate">
                            <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                            <span className="truncate">{staff.email}</span>
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded">
                            {staff.department || 'Drafting'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[11px]">
                          <span className="flex items-center gap-1 text-slate-400">
                            <Phone className="w-3 h-3 text-slate-500" />
                            <span>{staff.phone || '(555) 000-0000'}</span>
                          </span>
                          <span className="font-mono text-emerald-400 font-bold">
                            ${staff.hourlyRate || 75}/hr
                          </span>
                        </div>
                      </div>

                      {/* Active Permissions Chips */}
                      <div className="space-y-1.5 mb-3">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                          Granted OS Capabilities
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {staff.canAccessFinancials ? (
                            <span className="text-[9px] font-mono bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <DollarSign className="w-2.5 h-2.5" /> Financials
                            </span>
                          ) : (
                            <span className="text-[9px] font-mono bg-slate-900 text-slate-600 border border-slate-800 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5" /> No Financials
                            </span>
                          )}

                          {staff.canDelegate && (
                            <span className="text-[9px] font-mono bg-indigo-950/80 text-indigo-300 border border-indigo-800/80 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <Share2 className="w-2.5 h-2.5" /> Delegator & QA
                            </span>
                          )}

                          {staff.canViewAllProjects && (
                            <span className="text-[9px] font-mono bg-blue-950/80 text-blue-300 border border-blue-800/80 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <Layers className="w-2.5 h-2.5" /> All Boards
                            </span>
                          )}

                          {staff.canManageStaff && (
                            <span className="text-[9px] font-mono bg-purple-950/80 text-purple-300 border border-purple-800/80 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <Shield className="w-2.5 h-2.5" /> Staff Admin
                            </span>
                          )}

                          {staff.canManageInvoices && (
                            <span className="text-[9px] font-mono bg-amber-950/80 text-amber-300 border border-amber-800/80 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <FileText className="w-2.5 h-2.5" /> Invoices
                            </span>
                          )}

                          {staff.canEditJobPhases && (
                            <span className="text-[9px] font-mono bg-teal-950/80 text-teal-300 border border-teal-800/80 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <Compass className="w-2.5 h-2.5" /> Job Phases
                            </span>
                          )}

                          {staff.canAccessPayroll && (
                            <span className="text-[9px] font-mono bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <DollarSign className="w-2.5 h-2.5" /> Payroll Admin
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card Actions Footer */}
                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 font-mono">
                        {assignedJobCount} active assigned {assignedJobCount === 1 ? 'plan' : 'plans'}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(staff)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition border border-slate-700 text-xs flex items-center gap-1 cursor-pointer"
                          title="Edit Profile & Permissions"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                          <span>Edit</span>
                        </button>

                        {!isOwner && (
                          <button
                            onClick={() => setStaffToDelete(staff)}
                            className="p-1.5 bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-300 rounded-lg transition border border-slate-700 hover:border-red-800 cursor-pointer"
                            title="Delete Staff Member"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            
            /* PERMISSIONS MATRIX TABLE VIEW */
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-3 bg-slate-900 border-b border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                <span>
                  💡 <strong>Instant Matrix Toggles:</strong> Click any permission box below to instantly enable or revoke access for that staff member across the OS.
                </span>
                <span className="text-[10px] text-slate-500 font-mono">8 Configurable Access Levels</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      <th className="p-3.5 font-bold text-white min-w-[200px]">Staff Member</th>
                      <th className="p-3.5 text-center min-w-[110px]" title="View billing rates, job costs, and financial analytics">
                        💰 Financials
                      </th>
                      <th className="p-3.5 text-center min-w-[110px]" title="Delegate component tasks & QA sign-off review">
                        ⚡ Delegator
                      </th>
                      <th className="p-3.5 text-center min-w-[110px]" title="View all team plans vs only assigned board">
                        🌐 All Boards
                      </th>
                      <th className="p-3.5 text-center min-w-[110px]" title="Add/Edit/Delete staff and configure system permissions">
                        🛡️ Staff Admin
                      </th>
                      <th className="p-3.5 text-center min-w-[110px]" title="Mark jobs as Uninvoiced, Pending, Invoiced, or Paid">
                        🧾 Invoices
                      </th>
                      <th className="p-3.5 text-center min-w-[110px]" title="Advance phases like Customer Inquiry to Construction Prints">
                        📐 Job Phases
                      </th>
                      <th className="p-3.5 text-center min-w-[110px]" title="Flag and clear roadblock alerts">
                        🚧 Roadblocks
                      </th>
                      <th className="p-3.5 text-center min-w-[110px]" title="Access and record employee payroll entries and compensation checks">
                        💵 Payroll
                      </th>
                      <th className="p-3.5 text-right min-w-[90px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {filteredStaff.map((staff) => {
                      const isOwner = staff.name.toLowerCase().includes('greg hyatt');
                      return (
                        <tr key={staff.id} className="hover:bg-slate-900/60 transition">
                          <td className="p-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-white">
                                {staff.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <div>
                                <div className="font-bold text-white flex items-center gap-1.5">
                                  <span>{staff.name}</span>
                                  {isOwner && (
                                    <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 py-0.2 rounded font-mono">
                                      OWNER
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400">{staff.title}</div>
                              </div>
                            </div>
                          </td>

                          {/* 1. Financial Access */}
                          <td className="p-3.5 text-center">
                            <button
                              onClick={() => handleQuickTogglePermission(staff, 'canAccessFinancials')}
                              className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition border cursor-pointer ${
                                staff.canAccessFinancials
                                  ? 'bg-emerald-950 text-emerald-300 border-emerald-700 hover:bg-emerald-900'
                                  : 'bg-slate-900 text-slate-600 border-slate-800 hover:border-slate-600'
                              }`}
                              title={staff.canAccessFinancials ? 'Financial Access: Enabled (Click to toggle)' : 'Financial Access: Disabled'}
                            >
                              {staff.canAccessFinancials ? <Check className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />}
                            </button>
                          </td>

                          {/* 2. Task Delegation */}
                          <td className="p-3.5 text-center">
                            <button
                              onClick={() => handleQuickTogglePermission(staff, 'canDelegate')}
                              className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition border cursor-pointer ${
                                staff.canDelegate
                                  ? 'bg-indigo-950 text-indigo-300 border-indigo-700 hover:bg-indigo-900'
                                  : 'bg-slate-900 text-slate-600 border-slate-800 hover:border-slate-600'
                              }`}
                              title={staff.canDelegate ? 'Delegation & QA: Enabled' : 'Delegation: Disabled'}
                            >
                              {staff.canDelegate ? <Check className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />}
                            </button>
                          </td>

                          {/* 3. View All Boards */}
                          <td className="p-3.5 text-center">
                            <button
                              onClick={() => handleQuickTogglePermission(staff, 'canViewAllProjects')}
                              className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition border cursor-pointer ${
                                staff.canViewAllProjects
                                  ? 'bg-blue-950 text-blue-300 border-blue-700 hover:bg-blue-900'
                                  : 'bg-slate-900 text-slate-600 border-slate-800 hover:border-slate-600'
                              }`}
                              title={staff.canViewAllProjects ? 'View All Boards: Enabled' : 'Assigned Only'}
                            >
                              {staff.canViewAllProjects ? <Check className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />}
                            </button>
                          </td>

                          {/* 4. Staff Management */}
                          <td className="p-3.5 text-center">
                            <button
                              onClick={() => handleQuickTogglePermission(staff, 'canManageStaff')}
                              disabled={isOwner}
                              className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition border cursor-pointer ${
                                staff.canManageStaff
                                  ? 'bg-purple-950 text-purple-300 border-purple-700 hover:bg-purple-900'
                                  : 'bg-slate-900 text-slate-600 border-slate-800 hover:border-slate-600'
                              } ${isOwner ? 'opacity-80 cursor-not-allowed' : ''}`}
                              title={isOwner ? 'Owner has permanent staff admin rights' : (staff.canManageStaff ? 'Staff Admin: Enabled' : 'Staff Admin: Disabled')}
                            >
                              {staff.canManageStaff ? <Check className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />}
                            </button>
                          </td>

                          {/* 5. Invoicing & Paid Status */}
                          <td className="p-3.5 text-center">
                            <button
                              onClick={() => handleQuickTogglePermission(staff, 'canManageInvoices')}
                              className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition border cursor-pointer ${
                                staff.canManageInvoices
                                  ? 'bg-amber-950 text-amber-300 border-amber-700 hover:bg-amber-900'
                                  : 'bg-slate-900 text-slate-600 border-slate-800 hover:border-slate-600'
                              }`}
                              title={staff.canManageInvoices ? 'Invoice Status Management: Enabled' : 'Invoice Status: Disabled'}
                            >
                              {staff.canManageInvoices ? <Check className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />}
                            </button>
                          </td>

                          {/* 6. Job Phases */}
                          <td className="p-3.5 text-center">
                            <button
                              onClick={() => handleQuickTogglePermission(staff, 'canEditJobPhases')}
                              className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition border cursor-pointer ${
                                staff.canEditJobPhases
                                  ? 'bg-teal-950 text-teal-300 border-teal-700 hover:bg-teal-900'
                                  : 'bg-slate-900 text-slate-600 border-slate-800 hover:border-slate-600'
                              }`}
                              title={staff.canEditJobPhases ? 'Phase Advance Authority: Enabled' : 'Phase Edit: Disabled'}
                            >
                              {staff.canEditJobPhases ? <Check className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />}
                            </button>
                          </td>

                          {/* 7. Roadblocks */}
                          <td className="p-3.5 text-center">
                            <button
                              onClick={() => handleQuickTogglePermission(staff, 'canManageRoadblocks')}
                              className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition border cursor-pointer ${
                                staff.canManageRoadblocks
                                  ? 'bg-orange-950 text-orange-300 border-orange-700 hover:bg-orange-900'
                                  : 'bg-slate-900 text-slate-600 border-slate-800 hover:border-slate-600'
                              }`}
                              title={staff.canManageRoadblocks ? 'Roadblock Toggle: Enabled' : 'Roadblocks: Disabled'}
                            >
                              {staff.canManageRoadblocks ? <Check className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />}
                            </button>
                          </td>

                          {/* 8. Payroll Access */}
                          <td className="p-3.5 text-center">
                            <button
                              onClick={() => handleQuickTogglePermission(staff, 'canAccessPayroll')}
                              className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition border cursor-pointer ${
                                staff.canAccessPayroll
                                  ? 'bg-emerald-950 text-emerald-300 border-emerald-700 hover:bg-emerald-900'
                                  : 'bg-slate-900 text-slate-600 border-slate-800 hover:border-slate-600'
                              }`}
                              title={staff.canAccessPayroll ? 'Payroll Access: Enabled (Click to toggle)' : 'Payroll Access: Disabled'}
                            >
                              {staff.canAccessPayroll ? <Check className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />}
                            </button>
                          </td>

                          {/* Actions */}
                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenEdit(staff)}
                                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                                title="Edit Full Profile"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              {!isOwner && (
                                <button
                                  onClick={() => setStaffToDelete(staff)}
                                  className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
                                  title="Delete Staff Member"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
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

        {/* Footer info */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>
            Changes made here are permanently preserved in the backend local database and immediately reflected across all OS modules.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* DRAWER / SUB-MODAL: ADD OR EDIT STAFF MEMBER */}
      {/* ========================================================================= */}
      {(isCreatingNew || editingStaff) && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            
            {/* Drawer Header */}
            <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    {isCreatingNew ? 'Add New Team Member' : `Edit Profile: ${editingStaff?.name}`}
                  </h3>
                  <p className="text-xs text-slate-400">Configure personal credentials, department & granular OS access</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsCreatingNew(false);
                  setEditingStaff(null);
                }}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body Form */}
            <form onSubmit={handleSaveForm} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
              
              {/* Quick Role Presets */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Quick Permission Presets</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ROLE_PRESETS.map(preset => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className="text-left p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl transition cursor-pointer"
                    >
                      <div className="font-bold text-[11px] text-white leading-tight">{preset.badge}</div>
                      <div className="text-[10px] text-slate-400 line-clamp-2 mt-0.5">{preset.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Personal Credentials */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Marcus Vance"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="marcus@myplanstore.com"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Job Title / Designation</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Senior Architectural Drafter"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(555) 000-0000"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Department</label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value as StaffDepartment })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Hourly Billing Rate ($/hr)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono">$</span>
                    <input
                      type="number"
                      min="0"
                      step="5"
                      value={formData.hourlyRate}
                      onChange={(e) => setFormData({ ...formData, hourlyRate: Number(e.target.value) })}
                      className="w-full pl-7 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Status & Base Role */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Base System Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="admin">Administrator / Executive</option>
                    <option value="drafter_lead">Lead Project Manager / QA Lead</option>
                    <option value="drafter">Architectural & CAD Drafter</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Account Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="active">Active (Full Studio Access)</option>
                    <option value="inactive">Inactive (Suspended)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Default Dashboard View</label>
                  <select
                    value={formData.preferredLayout || 'grid'}
                    onChange={(e) => setFormData({ ...formData, preferredLayout: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="grid">Grid Cards View (Recommended)</option>
                    <option value="board">Kanban Phase Columns</option>
                    <option value="table">Tabular Project Records</option>
                  </select>
                </div>
              </div>

              {/* Granular Permission Toggles */}
              <div className="pt-3 border-t border-slate-800 space-y-3">
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Granular OS Permissions Matrix
                </label>

                {/* 1. Financials */}
                <label className="flex items-start gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl hover:border-slate-700 transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.canAccessFinancials}
                    onChange={(e) => setFormData({ ...formData, canAccessFinancials: e.target.checked })}
                    className="mt-0.5 rounded border-slate-700 text-blue-600 focus:ring-0"
                  />
                  <div>
                    <span className="font-bold text-white block">💰 Invoicing & Financial Rates Access</span>
                    <span className="text-[11px] text-slate-400">
                      Can access Admin & Billing view, view job costs, hourly drafter billing rates, and export itemized invoicing CSV sheets.
                    </span>
                  </div>
                </label>

                {/* 2. Delegation */}
                <label className="flex items-start gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl hover:border-slate-700 transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.canDelegate}
                    onChange={(e) => setFormData({ ...formData, canDelegate: e.target.checked })}
                    className="mt-0.5 rounded border-slate-700 text-blue-600 focus:ring-0"
                  />
                  <div>
                    <span className="font-bold text-white block">⚡ Task Delegation & QA Sign-off</span>
                    <span className="text-[11px] text-slate-400">
                      Authority to delegate work items to drafters, perform quality control reviews, approve submissions, and request revisions.
                    </span>
                  </div>
                </label>

                {/* 3. All Boards */}
                <label className="flex items-start gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl hover:border-slate-700 transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.canViewAllProjects}
                    onChange={(e) => setFormData({ ...formData, canViewAllProjects: e.target.checked })}
                    className="mt-0.5 rounded border-slate-700 text-blue-600 focus:ring-0"
                  />
                  <div>
                    <span className="font-bold text-white block">🌐 View All Team Project Boards</span>
                    <span className="text-[11px] text-slate-400">
                      Can view all customer plans across the entire organization (otherwise restricted strictly to their assigned cards).
                    </span>
                  </div>
                </label>

                {/* 4. Staff Admin */}
                <label className="flex items-start gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl hover:border-slate-700 transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.canManageStaff}
                    onChange={(e) => setFormData({ ...formData, canManageStaff: e.target.checked })}
                    className="mt-0.5 rounded border-slate-700 text-blue-600 focus:ring-0"
                  />
                  <div>
                    <span className="font-bold text-white block">🛡️ Staff & Permissions Administration</span>
                    <span className="text-[11px] text-slate-400">
                      Owner-level privilege to add, edit, or delete staff and reconfigure system permissions.
                    </span>
                  </div>
                </label>

                {/* 5. Invoices */}
                <label className="flex items-start gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl hover:border-slate-700 transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.canManageInvoices}
                    onChange={(e) => setFormData({ ...formData, canManageInvoices: e.target.checked })}
                    className="mt-0.5 rounded border-slate-700 text-blue-600 focus:ring-0"
                  />
                  <div>
                    <span className="font-bold text-white block">🧾 Manage Invoice Status & Paid Archive</span>
                    <span className="text-[11px] text-slate-400">
                      Can change invoice statuses from Pending to Invoiced and Paid (auto-archiving completed jobs).
                    </span>
                  </div>
                </label>

                {/* 6. Phases */}
                <label className="flex items-start gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl hover:border-slate-700 transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.canEditJobPhases}
                    onChange={(e) => setFormData({ ...formData, canEditJobPhases: e.target.checked })}
                    className="mt-0.5 rounded border-slate-700 text-blue-600 focus:ring-0"
                  />
                  <div>
                    <span className="font-bold text-white block">📐 Job Phase & Workflow Transitions</span>
                    <span className="text-[11px] text-slate-400">
                      Authority to advance jobs through workflow stages and trigger automatic customer notification emails.
                    </span>
                  </div>
                </label>

                {/* 7. Roadblocks */}
                <label className="flex items-start gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl hover:border-slate-700 transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.canManageRoadblocks}
                    onChange={(e) => setFormData({ ...formData, canManageRoadblocks: e.target.checked })}
                    className="mt-0.5 rounded border-slate-700 text-blue-600 focus:ring-0"
                  />
                  <div>
                    <span className="font-bold text-white block">🚧 Roadblock Flagging & Resolution</span>
                    <span className="text-[11px] text-slate-400">
                      Can flag project blockers and clear roadblock holds on jobs.
                    </span>
                  </div>
                </label>

                {/* 8. Payroll & Compensation */}
                <label className="flex items-start gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl hover:border-slate-700 transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.canAccessPayroll}
                    onChange={(e) => setFormData({ ...formData, canAccessPayroll: e.target.checked })}
                    className="mt-0.5 rounded border-slate-700 text-emerald-600 focus:ring-0"
                  />
                  <div>
                    <span className="font-bold text-white block">💵 Manage & View Payroll</span>
                    <span className="text-[11px] text-slate-400">
                      Authorize access to the payroll ledger, select existing users to issue compensation checks, record payment entries, and view disbursement logs.
                    </span>
                  </div>
                </label>
              </div>

              {/* Form Buttons */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingNew(false);
                    setEditingStaff(null);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition shadow-lg shadow-blue-600/30 cursor-pointer"
                >
                  {isCreatingNew ? 'Create Staff Profile' : 'Save Changes'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DELETE CONFIRMATION */}
      {/* ========================================================================= */}
      {staffToDelete && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-950/80 border border-red-800 text-red-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="font-bold text-white text-base">
                Delete Staff Member: {staffToDelete.name}?
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Are you sure you want to permanently remove <strong>{staffToDelete.name}</strong> ({staffToDelete.email}) from My Plan Store OS?
              </p>

              {jobs.some(j => j.assigned_drafter.toLowerCase().includes(staffToDelete.name.toLowerCase())) && (
                <div className="mt-3 p-3 bg-amber-950/50 border border-amber-800/60 rounded-xl text-left text-xs text-amber-300">
                  ⚠️ Note: {staffToDelete.name} has active plans assigned. Deleting this account will require reassigning their active jobs.
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-2.5 pt-2">
              <button
                onClick={() => setStaffToDelete(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-red-600/30"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
