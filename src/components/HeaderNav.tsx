import React, { useState } from 'react';
import { Compass, Users, LayoutDashboard, UserCheck, Plus, RefreshCw, AlertTriangle, Layers, Ruler, Building2, DollarSign, Bell, Lock, ShieldCheck, Share2, Check, ExternalLink, X, Mail, MessageSquare, AtSign, Database, LogOut } from 'lucide-react';
import { Job, StaffUser, AppNotification } from '../types';
import { STAFF_USERS, canViewAllProjectCards, isJobArchived, canUserManageStaff, canUserCreateJob } from '../data/mockData';
import { formatTimeOnly } from '../utils/timeCardExport';
import { User as FirebaseUser } from 'firebase/auth';

interface HeaderNavProps {
  userRole: 'drafter' | 'admin' | 'customer';
  setUserRole: (role: 'drafter' | 'admin' | 'customer') => void;
  currentStaff: StaffUser;
  setCurrentStaff: (staff: StaffUser) => void;
  staffList?: StaffUser[];
  selectedCustomerId: string;
  setSelectedCustomerId: (id: string) => void;
  jobs: Job[];
  notifications: AppNotification[];
  onMarkNotificationRead: (id: string) => void;
  onSelectJob: (job: Job, options?: { initialTab?: 'overview' | 'canvas' | 'deliverables' | 'comments' | 'audit' | 'time'; highlightCommentId?: string }) => void;
  onOpenNewJobModal: () => void;
  onOpenStaffManagement?: () => void;
  onResetData: () => void;
  onOpenKyleInbox?: () => void;
  onToggleChat?: () => void;
  isChatOpen?: boolean;
  unreadChatCount?: number;
  isCloudConnected?: boolean;
  authUser?: FirebaseUser | null;
  onSignOut?: () => void;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  userRole,
  setUserRole,
  currentStaff,
  setCurrentStaff,
  staffList = [],
  selectedCustomerId,
  setSelectedCustomerId,
  jobs,
  notifications,
  onMarkNotificationRead,
  onSelectJob,
  onOpenNewJobModal,
  onOpenStaffManagement,
  onResetData,
  onOpenKyleInbox,
  onToggleChat,
  isChatOpen = false,
  unreadChatCount = 0,
  isCloudConnected = true,
  authUser = null,
  onSignOut
}) => {
  const [showStaffDropdown, setShowStaffDropdown] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [restrictedModalOpen, setRestrictedModalOpen] = useState(false);

  const activeRoadblocksCount = jobs.filter(j => j.roadblock).length;
  const pendingInvoicingCount = jobs.filter(j => (j.invoice_status || 'Uninvoiced') === 'Pending Invoicing').length;

  // Delegated tasks completed and waiting for Kyle to review
  const allDelegated = jobs.flatMap(j => j.delegated_tasks || []);
  const tasksWaitingForKyle = allDelegated.filter(
    t => (t.delegatedBy || '').toLowerCase().includes('kyle') && (t.status === 'Completed' || t.status === 'Under Review') && !t.isReviewed
  );
  const waitingForKyleCount = tasksWaitingForKyle.length;

  // Filter notifications for the current active staff user
  const userNotifications = notifications.filter(
    n => n.recipientName.toLowerCase().includes(currentStaff.name.toLowerCase()) ||
         currentStaff.name.toLowerCase().includes(n.recipientName.toLowerCase())
  );
  const unreadCount = userNotifications.filter(n => !n.read).length;

  const isAuthorizedForAdmin = currentStaff.canAccessFinancials || currentStaff.role === 'drafter_lead' || currentStaff.name === 'Kyle' || currentStaff.canAccessPayroll;

  const handleAdminTabClick = () => {
    if (isAuthorizedForAdmin) {
      setUserRole('admin');
    } else {
      setRestrictedModalOpen(true);
    }
  };

  const handleStaffChange = (staff: StaffUser) => {
    setCurrentStaff(staff);
    setShowStaffDropdown(false);
    // If switching to an unauthorized user while in admin view, switch back to drafter view
    const targetIsAuthorized = staff.canAccessFinancials || staff.role === 'drafter_lead' || staff.name === 'Kyle' || staff.canAccessPayroll;
    if (!targetIsAuthorized && userRole === 'admin') {
      setUserRole('drafter');
    }
  };

  const handleNotificationClick = (notif: AppNotification) => {
    onMarkNotificationRead(notif.id);
    const targetJob = jobs.find(j => (notif.jobId && j.id === notif.jobId) || (notif.jobNumber && j.job_number === notif.jobNumber));
    if (targetJob) {
      const targetTab = (notif.type === 'tag_mention' || notif.type === 'tag_reply' || notif.type === 'comment')
        ? 'comments'
        : notif.type === 'deliverable_uploaded'
        ? 'deliverables'
        : 'overview';
      onSelectJob(targetJob, { initialTab: targetTab, highlightCommentId: notif.commentId });
    }
    setShowNotifDropdown(false);
  };

  return (
    <>
      <header className="bg-slate-900 text-slate-100 border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between py-3.5 sm:py-4 gap-4">
            
            {/* Logo & OS Branding - Spacious, Prominent & Unsqueezed */}
            <div className="flex items-center gap-4 shrink-0">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-600/30 ring-1 ring-white/20 shrink-0">
                <Compass className="w-7 h-7 sm:w-8 sm:h-8 animate-spin-slow shrink-0 text-white" />
              </div>
              <div className="flex flex-col justify-center shrink-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white font-sans">
                    My Plan Store
                  </h1>
                  <span className="text-xs sm:text-sm font-mono font-bold text-sky-300 px-2 py-0.5 rounded-lg bg-sky-950/90 border border-sky-800/80 uppercase shadow-xs">
                    OS
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-full hidden sm:inline-block">
                    v2.4 Pro
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 font-medium tracking-normal mt-0.5">
                  Architectural Drafting & Customer Workflow Engine
                </p>
              </div>
            </div>

            {/* Center: Live Stats Pill */}
            {userRole !== 'customer' && (
              (() => {
                const isAllAuthorized = canViewAllProjectCards(currentStaff);
                const activeJobs = jobs.filter(j => !isJobArchived(j));
                const relevantCount = isAllAuthorized
                  ? activeJobs.length
                  : activeJobs.filter(j => 
                      j.assigned_drafter.toLowerCase().includes(currentStaff.name.toLowerCase()) ||
                      (j.delegated_tasks || []).some(t => t.assignedTo.toLowerCase().includes(currentStaff.name.toLowerCase())) ||
                      (j.time_logs || []).some(tl => (tl.drafterName || '').toLowerCase().includes(currentStaff.name.toLowerCase()))
                    ).length;

                return (
                  <div className="hidden 2xl:flex items-center gap-4 bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-300 shrink-0 shadow-inner">
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-blue-400" />
                      <span>{isAllAuthorized ? 'Active Plans' : `${currentStaff.name.split(' ')[0]}'s Plans`}: <strong className="text-white">{relevantCount}</strong></span>
                    </div>
                    <span className="text-slate-700">|</span>
                    
                    {currentStaff.canAccessFinancials ? (
                      <>
                        <div className="flex items-center gap-1.5">
                          <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Pending Billing: <strong className="text-amber-300">{pendingInvoicingCount}</strong></span>
                        </div>
                        <span className="text-slate-700">|</span>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5">
                          <Share2 className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Delegated Tasks Active</span>
                        </div>
                        <span className="text-slate-700">|</span>
                      </>
                    )}

                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className={`w-3.5 h-3.5 ${activeRoadblocksCount > 0 ? 'text-red-400 animate-pulse' : 'text-slate-500'}`} />
                      <span>Roadblocks: <strong className={activeRoadblocksCount > 0 ? 'text-red-400' : 'text-slate-400'}>{activeRoadblocksCount}</strong></span>
                    </div>

                    <span className="text-slate-700">|</span>

                    {/* Firestore Cloud Database Indicator */}
                    <div className="flex items-center gap-1.5 font-mono text-[11px] text-emerald-300" title="Connected to Google Cloud Firestore">
                      <Database className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Cloud DB</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    </div>
                  </div>
                );
              })()
            )}

            {/* Right Controls: Staff Switcher, Notifications & Role Switcher */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 justify-start lg:justify-end">
              
              {/* Active Staff User Switcher */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowStaffDropdown(!showStaffDropdown);
                    setShowNotifDropdown(false);
                  }}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 px-3 py-1.5 rounded-xl text-xs transition cursor-pointer shadow-xs relative"
                  title="Switch Staff Identity (Test Financial & Delegation Access)"
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] relative ${
                    currentStaff.canAccessFinancials ? 'bg-amber-500 text-slate-950 font-mono' : 'bg-blue-600 text-white'
                  }`}>
                    {currentStaff.name.split(' ').map(n => n[0]).join('')}
                    {currentStaff.name.toLowerCase().includes('kyle') && waitingForKyleCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full border border-slate-900 animate-ping"></span>
                    )}
                  </div>
                  
                  <div className="text-left hidden sm:block">
                    <div className="font-bold text-white leading-tight flex items-center gap-1">
                      <span>{currentStaff.name}</span>
                      {currentStaff.name.toLowerCase().includes('kyle') && waitingForKyleCount > 0 && (
                        <span className="text-[9px] bg-amber-500 text-slate-950 font-extrabold px-1.5 py-0.2 rounded-full font-mono">
                          {waitingForKyleCount} TO REVIEW
                        </span>
                      )}
                      {currentStaff.canAccessFinancials && (
                        <span className="text-[9px] bg-amber-400/20 text-amber-300 border border-amber-400/30 px-1 py-0.2 rounded font-mono">
                          FINANCE
                        </span>
                      )}
                      {currentStaff.canDelegate && (
                        <span className="text-[9px] bg-indigo-400/20 text-indigo-300 border border-indigo-400/30 px-1 py-0.2 rounded font-mono">
                          LEAD
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 leading-tight truncate max-w-[130px]">
                      {currentStaff.title}
                    </div>
                  </div>
                </button>

                {/* Staff Dropdown Menu */}
                {showStaffDropdown && (
                  <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden py-1">
                    <div className="px-3 py-2 border-b border-slate-800 bg-slate-950/60">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                        Switch Active Staff Identity
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Test role-based permissions & delegation workflows:
                      </p>
                    </div>

                    <div className="divide-y divide-slate-800 max-h-80 overflow-y-auto">
                      {(staffList.length > 0 ? staffList : [currentStaff]).map((staff) => {
                        const isCurrent = staff.id === currentStaff.id;
                        return (
                          <button
                            key={staff.id}
                            onClick={() => handleStaffChange(staff)}
                            className={`w-full text-left p-2.5 transition flex items-start justify-between cursor-pointer ${
                              isCurrent ? 'bg-blue-950/80 text-white' : 'hover:bg-slate-800/80 text-slate-300'
                            }`}
                          >
                            <div className="space-y-0.5">
                              <div className="font-bold text-xs flex items-center gap-1.5 text-white">
                                <span>{staff.name}</span>
                                {isCurrent && <Check className="w-3.5 h-3.5 text-blue-400" />}
                                {staff.name.toLowerCase().includes('greg hyatt') && (
                                  <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 py-0.2 rounded font-mono">
                                    OWNER
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400">{staff.title}</div>
                              <div className="flex flex-wrap items-center gap-1 pt-1">
                                {staff.canAccessFinancials ? (
                                  <span className="text-[9px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800 px-1.5 py-0.5 rounded">
                                    💰 Financial
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-mono bg-slate-800 text-slate-400 border border-slate-700 px-1.5 py-0.5 rounded">
                                    🔒 No Financials
                                  </span>
                                )}
                                {staff.canDelegate && (
                                  <span className="text-[9px] font-mono bg-indigo-950 text-indigo-300 border border-indigo-800 px-1.5 py-0.5 rounded">
                                    ⚡ Delegator
                                  </span>
                                )}
                                {staff.canManageStaff && (
                                  <span className="text-[9px] font-mono bg-purple-950 text-purple-300 border border-purple-800 px-1.5 py-0.5 rounded">
                                    🛡️ Admin
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Manage Staff Action Button in Dropdown */}
                    {onOpenStaffManagement && canUserManageStaff(currentStaff) && (
                      <div className="p-2 border-t border-slate-800 bg-slate-950">
                        <button
                          onClick={() => {
                            setShowStaffDropdown(false);
                            onOpenStaffManagement();
                          }}
                          className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Manage Staff & Permissions</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Kyle's Review Inbox Button - Visible strictly to Kyle */}
              {onOpenKyleInbox && currentStaff.name.toLowerCase().includes('kyle') && (
                <button
                  onClick={onOpenKyleInbox}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
                  title="Open Kyle's Delegation Review Inbox"
                >
                  <Mail className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Kyle's Review Inbox</span>
                  {waitingForKyleCount > 0 && (
                    <span className="bg-amber-500 text-slate-950 text-[10px] font-extrabold px-1.5 py-0.2 rounded-full font-mono">
                      {waitingForKyleCount}
                    </span>
                  )}
                </button>
              )}

              {/* General Studio Chat Button (Available to everyone) */}
              {onToggleChat && (
                <button
                  type="button"
                  onClick={onToggleChat}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer relative shadow-xs ${
                    isChatOpen
                      ? 'bg-blue-600 text-white border border-blue-400 shadow-blue-500/20'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600'
                  }`}
                  title="Open Team Studio Chat (@mentions & #MPS-plans)"
                >
                  <MessageSquare className={`w-3.5 h-3.5 ${isChatOpen ? 'text-white' : 'text-blue-400'}`} />
                  <span className="hidden sm:inline">Studio Chat</span>
                  {unreadChatCount > 0 && (
                    <span className="bg-blue-500 text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full font-mono animate-pulse">
                      {unreadChatCount}
                    </span>
                  )}
                </button>
              )}

              {/* Notification Bell Dropdown */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowNotifDropdown(!showNotifDropdown);
                    setShowStaffDropdown(false);
                  }}
                  className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition relative cursor-pointer"
                  title="View Notifications & Delegated Tasks"
                >
                  <Bell className="w-4 h-4 text-slate-300" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown Panel */}
                {showNotifDropdown && (
                  <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden py-1">
                    <div className="p-3 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-white block">
                          Notifications for {currentStaff.name.split(' ')[0]}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">{unreadCount} unread alerts</span>
                      </div>
                      <button
                        onClick={() => setShowNotifDropdown(false)}
                        className="text-slate-400 hover:text-white p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-800">
                      {userNotifications.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400 italic">
                          No active notifications for {currentStaff.name}.
                        </div>
                      ) : (
                        userNotifications.map((notif) => (
                          <div
                            key={notif.id}
                            onClick={() => handleNotificationClick(notif)}
                            className={`p-3 text-xs transition cursor-pointer hover:bg-slate-800 space-y-1.5 ${
                              notif.read ? 'opacity-75 bg-slate-900' : 'bg-slate-850 border-l-3 border-blue-500'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-1.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {notif.type === 'tag_mention' ? (
                                  <span className="bg-blue-600/90 text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                    <AtSign className="w-2.5 h-2.5" /> MENTION
                                  </span>
                                ) : notif.type === 'tag_reply' ? (
                                  <span className="bg-indigo-600/90 text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                    ↩️ FOLLOW-UP
                                  </span>
                                ) : notif.type === 'delegated_task' ? (
                                  <span className="bg-amber-600/90 text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                                    ⚡ TASK
                                  </span>
                                ) : null}

                                <span className="font-bold text-white text-[11px] leading-tight">
                                  {notif.title}
                                </span>
                              </div>
                              {!notif.read && (
                                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-0.5 animate-pulse" />
                              )}
                            </div>

                            <p className="text-[11px] text-slate-300 leading-snug">
                              {notif.message}
                            </p>

                            {/* Project details pill preview if carried over */}
                            {notif.projectDetails && (
                              <div className="bg-slate-950/80 border border-slate-800 rounded-md p-1.5 text-[10px] text-slate-300 font-mono flex items-center justify-between">
                                <span>📋 {notif.projectDetails.customerName} ({notif.projectDetails.phase})</span>
                                <span className="text-blue-400 font-bold hover:underline">Open ↗</span>
                              </div>
                            )}

                            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                              <span>From: <strong className="text-slate-300">{notif.senderName || 'System'}</strong></span>
                              <span>{formatTimeOnly(notif.timestamp, true)}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Customer Switcher Dropdown (If Customer Mode) */}
              {userRole === 'customer' && (
                <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700 px-2.5 py-1 rounded-lg text-xs">
                  <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-slate-400 font-medium">Select Portal:</span>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="bg-slate-900 text-white text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 py-1 px-2 rounded border border-slate-700 cursor-pointer"
                  >
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.job_number} - {job.customer_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Staff Management Button for Greg Hyatt & Authorized Managers */}
              {onOpenStaffManagement && canUserManageStaff(currentStaff) && (
                <button
                  onClick={onOpenStaffManagement}
                  className="flex items-center gap-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-200 border border-purple-500/40 text-xs font-semibold px-3 py-1.5 rounded-lg transition shadow-xs active:scale-95 cursor-pointer"
                  title="Manage Staff Directory & Permission Levels"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                  <span className="hidden sm:inline">Staff & Perms</span>
                </button>
              )}

              {/* Job Creation Action: Strictly Kyle or Jason Barnett */}
              {userRole !== 'customer' && (
                canUserCreateJob(currentStaff) ? (
                  <button
                    onClick={onOpenNewJobModal}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition shadow-sm border border-blue-400/20 active:scale-95 cursor-pointer"
                    title="Create new project (Authorized for Kyle & Jason Barnett)"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Job</span>
                  </button>
                ) : (
                  <div
                    className="flex items-center gap-1.5 bg-slate-800/80 text-slate-500 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-700/60 cursor-not-allowed select-none"
                    title="Creation Restricted: Only Kyle or Jason Barnett can create a new job"
                  >
                    <Lock className="w-3.5 h-3.5 text-slate-500" />
                    <span className="hidden md:inline">New Job</span>
                    <span className="text-[10px] text-amber-400 font-mono bg-amber-500/10 px-1 py-0.2 rounded">Kyle / Jason only</span>
                  </div>
                )
              )}

              {/* Reset Demo Data Button */}
              <button
                onClick={onResetData}
                title="Reset to default mock data"
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition border border-transparent hover:border-slate-700 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              {/* Role Switcher Navigation Pills */}
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setUserRole('drafter')}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    userRole === 'drafter'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>Drafter Studio</span>
                </button>

                <button
                  onClick={handleAdminTabClick}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer relative ${
                    userRole === 'admin'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : !isAuthorizedForAdmin
                      ? 'text-slate-500 hover:text-amber-300 hover:bg-slate-900/60'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                  title={
                    isAuthorizedForAdmin
                      ? (currentStaff.name === 'Kyle' ? 'Admin & Project Management Center' : 'Admin & Billing Center')
                      : 'Restricted: Financial & Admin Access limited to Jason, Greg Hyatt, Drew Lupkey, and Kyle'
                  }
                >
                  {isAuthorizedForAdmin ? (
                    <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span>{currentStaff.name === 'Kyle' ? 'Admin & Ops' : 'Admin & Billing'}</span>
                  {!isAuthorizedForAdmin && (
                    <span className="text-[9px] bg-slate-800 text-amber-400 px-1 rounded font-mono">
                      Locked
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setUserRole('customer')}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    userRole === 'customer'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Customer View</span>
                </button>
              </div>

              {/* Authenticated User Sign Out Button */}
              {onSignOut && (
                <button
                  onClick={onSignOut}
                  title={authUser ? `Signed in as ${authUser.email}. Click to Sign Out` : 'Sign Out'}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-850 hover:bg-red-950/60 text-slate-400 hover:text-red-300 border border-slate-700 hover:border-red-800/60 rounded-xl text-xs font-medium transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 text-slate-400 group-hover:text-red-300" />
                  <span className="hidden xl:inline">Sign Out</span>
                </button>
              )}

            </div>

          </div>
        </div>
      </header>

      {/* Restricted Access Information Modal */}
      {restrictedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 border border-amber-300 text-amber-700 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-bold text-slate-900 text-base">Financial & Billing Access Restricted</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                As a standard security protocol, invoicing values, financials, and the Admin & Billing dashboard are restricted to:
              </p>
              
              <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-3 text-left space-y-1.5 text-xs font-semibold text-slate-800">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Greg Hyatt (Owner & Principal Architect)</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Jason (Project Manager & Operations)</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Kyle (Lead Project Manager & Senior Drafter)</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Drew Lupkey (Admin & Billing Specialist)</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 mt-3">
                Currently logged in as <strong>{currentStaff.name}</strong>. To view Admin & Billing, switch identity to Greg Hyatt, Jason, Kyle, or Drew Lupkey in the top bar.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setRestrictedModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const greg = STAFF_USERS.find(s => s.name === 'Greg Hyatt');
                  if (greg) handleStaffChange(greg);
                  setUserRole('admin');
                  setRestrictedModalOpen(false);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition shadow-xs"
              >
                Switch to Greg Hyatt & Open
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
