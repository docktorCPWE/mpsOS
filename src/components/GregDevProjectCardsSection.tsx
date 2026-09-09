import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Square, 
  Pause, 
  Coffee, 
  Plus, 
  FileSpreadsheet, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  X, 
  ChevronRight, 
  Sparkles, 
  Code2, 
  Video, 
  Volume2, 
  Share2, 
  Cpu,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { GregDevProjectCard, GregDevTimeEntry, StaffUser, StandardGregDevProjectType } from '../types';
import { 
  PRESET_DEV_PROJECT_TYPES, 
  saveStoredGregDevCards, 
  saveStoredGregDevEntries 
} from '../utils/gregDevTimeService';
import { formatSecondsToHHMMSS } from '../utils/timeUtils';
import { formatMinutesToReadable } from '../utils/timeCardExport';

interface GregDevProjectCardsSectionProps {
  currentStaff: StaffUser;
  isClockedIn: boolean;
  isOnBreak: boolean;
  devCards: GregDevProjectCard[];
  devEntries: GregDevTimeEntry[];
  onUpdateDevCards: (cards: GregDevProjectCard[]) => void;
  onUpdateDevEntries: (entries: GregDevTimeEntry[]) => void;
  onOpenReviewModal: () => void;
  activeShiftId?: string;
}

export const GregDevProjectCardsSection: React.FC<GregDevProjectCardsSectionProps> = ({
  currentStaff,
  isClockedIn,
  isOnBreak,
  devCards,
  devEntries,
  onUpdateDevCards,
  onUpdateDevEntries,
  onOpenReviewModal,
  activeShiftId
}) => {
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [customTypeName, setCustomTypeName] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Live second ticker for running project timers
  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Helper for project icon
  const getProjectIcon = (type: string) => {
    switch (type) {
      case 'MPS OS Dev':
        return <Code2 className="w-4 h-4 text-indigo-400" />;
      case 'BigX Media Dev':
        return <Video className="w-4 h-4 text-cyan-400" />;
      case 'Sound Extraction Dev':
        return <Volume2 className="w-4 h-4 text-purple-400" />;
      case 'FB Media Dev':
        return <Share2 className="w-4 h-4 text-blue-400" />;
      case 'Other Dev':
      default:
        return <Cpu className="w-4 h-4 text-amber-400" />;
    }
  };

  const getThemeStyles = (color: string) => {
    switch (color) {
      case 'cyan':
        return {
          bg: 'bg-cyan-950/40',
          border: 'border-cyan-500/40 hover:border-cyan-400',
          activeBorder: 'border-cyan-400 ring-2 ring-cyan-500/30',
          badge: 'bg-cyan-900/60 text-cyan-300 border-cyan-700/50',
          accent: 'text-cyan-400',
          button: 'bg-cyan-600 hover:bg-cyan-500 text-white'
        };
      case 'purple':
        return {
          bg: 'bg-purple-950/40',
          border: 'border-purple-500/40 hover:border-purple-400',
          activeBorder: 'border-purple-400 ring-2 ring-purple-500/30',
          badge: 'bg-purple-900/60 text-purple-300 border-purple-700/50',
          accent: 'text-purple-400',
          button: 'bg-purple-600 hover:bg-purple-500 text-white'
        };
      case 'blue':
        return {
          bg: 'bg-blue-950/40',
          border: 'border-blue-500/40 hover:border-blue-400',
          activeBorder: 'border-blue-400 ring-2 ring-blue-500/30',
          badge: 'bg-blue-900/60 text-blue-300 border-blue-700/50',
          accent: 'text-blue-400',
          button: 'bg-blue-600 hover:bg-blue-500 text-white'
        };
      case 'amber':
        return {
          bg: 'bg-amber-950/40',
          border: 'border-amber-500/40 hover:border-amber-400',
          activeBorder: 'border-amber-400 ring-2 ring-amber-500/30',
          badge: 'bg-amber-900/60 text-amber-300 border-amber-700/50',
          accent: 'text-amber-400',
          button: 'bg-amber-600 hover:bg-amber-500 text-white'
        };
      case 'indigo':
      default:
        return {
          bg: 'bg-indigo-950/40',
          border: 'border-indigo-500/40 hover:border-indigo-400',
          activeBorder: 'border-indigo-400 ring-2 ring-indigo-500/30',
          badge: 'bg-indigo-900/60 text-indigo-300 border-indigo-700/50',
          accent: 'text-indigo-400',
          button: 'bg-indigo-600 hover:bg-indigo-500 text-white'
        };
    }
  };

  // Add new card for project type
  const handleActivateProjectType = (type: string, colorTheme: any = 'indigo') => {
    // Check if card already exists
    const existing = devCards.find(c => c.projectType.toLowerCase() === type.toLowerCase());
    if (existing) {
      triggerToast(`"${type}" card is already active on your board.`);
      setShowAddMenu(false);
      return;
    }

    const newCard: GregDevProjectCard = {
      id: `dev-card-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      projectType: type,
      colorTheme: colorTheme,
      isActive: false,
      isPausedByBreak: false,
      todaySeconds: 0,
      totalSeconds: 0,
      currentNotes: `Development work on ${type}`
    };

    const updated = [...devCards, newCard];
    onUpdateDevCards(updated);
    saveStoredGregDevCards(updated);
    setShowAddMenu(false);
    setCustomTypeName('');
    setShowCustomInput(false);
    triggerToast(`Activated "${type}" time card.`);
  };

  // Start timer on a specific card
  const handleStartTimer = (cardId: string) => {
    if (!isClockedIn) {
      alert('Please clock in on your primary shift time card first before starting a dev project timer.');
      return;
    }
    if (isOnBreak) {
      alert('You are currently on break. Please click "Return From Break" on the shift bar to resume work.');
      return;
    }

    const updated = devCards.map(c => {
      if (c.id === cardId) {
        return {
          ...c,
          isActive: true,
          isPausedByBreak: false,
          activeTimerStart: new Date().toISOString(),
          lastStartedAt: new Date().toISOString()
        };
      }
      return c;
    });

    onUpdateDevCards(updated);
    saveStoredGregDevCards(updated);
    const target = devCards.find(c => c.id === cardId);
    triggerToast(`Started timer on ${target?.projectType || 'project'}.`);
  };

  // Stop timer and log session
  const handleStopTimer = (cardId: string) => {
    const card = devCards.find(c => c.id === cardId);
    if (!card || !card.isActive || !card.activeTimerStart) return;

    const startMs = new Date(card.activeTimerStart).getTime();
    const endMs = Date.now();
    const durationSeconds = Math.max(1, Math.floor((endMs - startMs) / 1000));
    const hours = durationSeconds / 3600;
    const rate = currentStaff.hourlyRate || 150;
    const billableAmount = Number((hours * rate).toFixed(2));
    const todayStr = new Date().toISOString().split('T')[0];

    // Create entry
    const newEntry: GregDevTimeEntry = {
      id: `dev-entry-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      staffId: currentStaff.id,
      staffName: currentStaff.name,
      projectType: card.projectType,
      date: todayStr,
      startTime: card.activeTimerStart,
      endTime: new Date(endMs).toISOString(),
      durationSeconds,
      notes: card.currentNotes || `Dev session on ${card.projectType}`,
      hourlyRate: rate,
      billableAmount,
      shiftId: activeShiftId,
      createdAt: new Date().toISOString()
    };

    const updatedEntries = [newEntry, ...devEntries];
    onUpdateDevEntries(updatedEntries);
    saveStoredGregDevEntries(updatedEntries);

    // Update card
    const updatedCards = devCards.map(c => {
      if (c.id === cardId) {
        return {
          ...c,
          isActive: false,
          isPausedByBreak: false,
          activeTimerStart: undefined,
          todaySeconds: (c.todaySeconds || 0) + durationSeconds,
          totalSeconds: (c.totalSeconds || 0) + durationSeconds,
          lastStoppedAt: new Date(endMs).toISOString()
        };
      }
      return c;
    });

    onUpdateDevCards(updatedCards);
    saveStoredGregDevCards(updatedCards);
    triggerToast(`Logged ${Math.round(durationSeconds / 60)} mins to ${card.projectType}.`);
  };

  // Remove card
  const handleDismissCard = (cardId: string) => {
    const card = devCards.find(c => c.id === cardId);
    if (!card) return;

    if (card.isActive) {
      if (!window.confirm(`Timer is currently running on ${card.projectType}. Stop timer and remove card?`)) {
        return;
      }
      handleStopTimer(cardId);
    }

    const updated = devCards.filter(c => c.id !== cardId);
    onUpdateDevCards(updated);
    saveStoredGregDevCards(updated);
    triggerToast(`Removed ${card.projectType} card.`);
  };

  // Update notes on a card
  const handleUpdateNotes = (cardId: string, notes: string) => {
    const updated = devCards.map(c => c.id === cardId ? { ...c, currentNotes: notes } : c);
    onUpdateDevCards(updated);
    saveStoredGregDevCards(updated);
  };

  // Count active timers
  const activeCount = devCards.filter(c => c.isActive).length;
  const pausedByBreakCount = devCards.filter(c => c.isPausedByBreak).length;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-4 font-sans">
      
      {/* Toast feedback */}
      {toastMessage && (
        <div className="mb-3 p-3 rounded-xl bg-blue-950 border border-blue-500/50 text-blue-200 text-xs flex items-center justify-between shadow-lg animate-fadeIn">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-blue-400 hover:text-white text-xs cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Outer Panel Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        
        {/* Header Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-inner">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Greg Hyatt • Dev Project Time Cards
                </h3>
                <span className="text-[11px] bg-indigo-900/60 text-indigo-300 font-semibold px-2.5 py-0.5 rounded-full border border-indigo-700/50">
                  Independent Project Timers
                </span>
                {activeCount > 0 && (
                  <span className="text-[11px] bg-emerald-950/80 text-emerald-300 font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/40 flex items-center gap-1.5 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    {activeCount} Timer{activeCount > 1 ? 's' : ''} Running
                  </span>
                )}
                {pausedByBreakCount > 0 && isOnBreak && (
                  <span className="text-[11px] bg-amber-950/80 text-amber-300 font-bold px-2.5 py-0.5 rounded-full border border-amber-500/40 flex items-center gap-1.5">
                    <Coffee className="w-3 h-3 text-amber-400" />
                    {pausedByBreakCount} Paused by Break
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Track dedicated hours for MPS OS Dev, BigX Media Dev, Sound Extraction Dev, FB Media Dev & other custom dev projects
              </p>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            
            {/* Add / Activate Project Type Button */}
            <div className="relative">
              <button
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer hover:scale-[1.02]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Activate Project Card</span>
              </button>

              {/* Dropdown Menu */}
              {showAddMenu && (
                <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2 z-30 animate-fadeIn">
                  <div className="px-3 py-2 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Select Project Type to Activate
                  </div>
                  <div className="py-1 space-y-1">
                    {PRESET_DEV_PROJECT_TYPES.map(preset => {
                      const isAlreadyActive = devCards.some(c => c.projectType.toLowerCase() === preset.type.toLowerCase());
                      return (
                        <button
                          key={preset.type}
                          disabled={isAlreadyActive}
                          onClick={() => handleActivateProjectType(preset.type, preset.colorTheme)}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                            isAlreadyActive
                              ? 'opacity-40 cursor-not-allowed bg-slate-800/40 text-slate-500'
                              : 'hover:bg-slate-800 text-slate-200 cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {getProjectIcon(preset.type)}
                            <span className="font-semibold">{preset.type}</span>
                          </div>
                          {isAlreadyActive ? (
                            <span className="text-[10px] text-slate-500">Active</span>
                          ) : (
                            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Type Option */}
                  <div className="pt-2 border-t border-slate-800">
                    {showCustomInput ? (
                      <div className="p-2 space-y-2">
                        <input
                          type="text"
                          placeholder="e.g. Mobile Engine Dev"
                          value={customTypeName}
                          onChange={(e) => setCustomTypeName(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && customTypeName.trim()) {
                              handleActivateProjectType(customTypeName.trim(), 'indigo');
                            }
                          }}
                        />
                        <div className="flex items-center gap-2">
                          <button
                            disabled={!customTypeName.trim()}
                            onClick={() => handleActivateProjectType(customTypeName.trim(), 'indigo')}
                            className="flex-1 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
                          >
                            Add Card
                          </button>
                          <button
                            onClick={() => setShowCustomInput(false)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg text-xs cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowCustomInput(true)}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs text-indigo-400 hover:bg-indigo-950/40 flex items-center justify-between font-semibold transition-colors cursor-pointer"
                      >
                        <span>+ Custom Project Type...</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Review & Export Dev Hours Button */}
            <button
              onClick={onOpenReviewModal}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-800 text-white rounded-xl text-xs font-bold border border-slate-700 shadow-sm transition-colors cursor-pointer"
              title="Review Dev Time Entries filtered by Daily, Weekly, or Monthly and export to CSV"
            >
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              <span>Review & Export Dev Hours</span>
            </button>

          </div>
        </div>

        {/* Card Grid Area */}
        <div className="p-4 sm:p-5">
          {devCards.length === 0 ? (
            <div className="text-center py-8 px-4 bg-slate-950/50 border border-slate-800/80 rounded-2xl">
              <Code2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-300">No Dev Project Cards Activated</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                Activate cards for MPS OS Dev, BigX Media Dev, Sound Extraction Dev, FB Media Dev, or Other Dev to track independent project hours throughout your shift.
              </p>
              <button
                onClick={() => handleActivateProjectType('MPS OS Dev', 'indigo')}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Activate MPS OS Dev Card</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {devCards.map((card) => {
                const styles = getThemeStyles(card.colorTheme);
                
                // Calculate live timer for active running session
                let liveElapsedSec = 0;
                if (card.isActive && card.activeTimerStart) {
                  liveElapsedSec = Math.max(0, Math.floor((nowMs - new Date(card.activeTimerStart).getTime()) / 1000));
                }

                // Total today including live running time
                const todayTotalSec = (card.todaySeconds || 0) + liveElapsedSec;
                const totalHoursDec = (todayTotalSec / 3600).toFixed(2);
                const estimatedValue = (parseFloat(totalHoursDec) * (currentStaff.hourlyRate || 150)).toFixed(2);

                return (
                  <div
                    key={card.id}
                    className={`rounded-2xl border p-4 transition-all duration-200 flex flex-col justify-between ${
                      card.isActive
                        ? `${styles.bg} ${styles.activeBorder} shadow-lg shadow-black/40`
                        : card.isPausedByBreak
                        ? 'bg-amber-950/30 border-amber-500/40'
                        : 'bg-slate-800/60 border-slate-700/70 hover:border-slate-600'
                    }`}
                  >
                    <div>
                      {/* Card Header: Icon, Name & Remove Button */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-slate-800 border border-slate-700">
                            {getProjectIcon(card.projectType)}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-white tracking-tight">
                              {card.projectType}
                            </h4>
                            <span className="text-[10px] text-slate-400">
                              Billing Rate: ${currentStaff.hourlyRate || 150}/hr
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {/* Status Pill */}
                          {card.isActive ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 border border-emerald-500/60 text-emerald-300 flex items-center gap-1 animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                              RUNNING
                            </span>
                          ) : card.isPausedByBreak ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 border border-amber-500/60 text-amber-300 flex items-center gap-1">
                              <Coffee className="w-3 h-3 text-amber-400" />
                              PAUSED (BREAK)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 border border-slate-700 text-slate-400">
                              READY
                            </span>
                          )}

                          <button
                            onClick={() => handleDismissCard(card.id)}
                            className="p-1 text-slate-500 hover:text-slate-300 rounded-md hover:bg-slate-700/50 transition-colors cursor-pointer"
                            title="Remove project card from active board"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Live Timer Display Display */}
                      <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-3 mb-3 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                            {card.isActive ? 'Active Timer' : card.isPausedByBreak ? 'Paused Timer' : 'Session Timer'}
                          </span>
                          <span className={`text-2xl font-mono font-bold tracking-tight ${
                            card.isActive ? 'text-emerald-400' : card.isPausedByBreak ? 'text-amber-400' : 'text-slate-300'
                          }`}>
                            {formatSecondsToHHMMSS(liveElapsedSec)}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                            Today's Total
                          </span>
                          <span className="text-sm font-mono font-bold text-white">
                            {formatMinutesToReadable(todayTotalSec / 60)}
                          </span>
                          <span className="text-[10px] font-mono text-emerald-400 block font-semibold">
                            ${estimatedValue}
                          </span>
                        </div>
                      </div>

                      {/* Task / Work Description Notes Input */}
                      <div className="mb-3">
                        <input
                          type="text"
                          value={card.currentNotes || ''}
                          onChange={(e) => handleUpdateNotes(card.id, e.target.value)}
                          placeholder={`Notes for ${card.projectType}...`}
                          className="w-full px-2.5 py-1.5 bg-slate-950/50 border border-slate-800 focus:border-indigo-500 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition-colors"
                        />
                      </div>
                    </div>

                    {/* Independent Timer Action Controls */}
                    <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between gap-2">
                      {card.isActive ? (
                        <button
                          onClick={() => handleStopTimer(card.id)}
                          className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                          title="Stop timer and log dev session"
                        >
                          <Square className="w-3.5 h-3.5 fill-white" />
                          <span>Stop & Log Dev Hours</span>
                        </button>
                      ) : card.isPausedByBreak ? (
                        <div className="w-full text-center py-1.5 px-2 bg-amber-950/40 border border-amber-500/30 rounded-xl text-[11px] text-amber-300 font-medium">
                          Paused during shift break. Resumes automatically upon return!
                        </div>
                      ) : (
                        <button
                          onClick={() => handleStartTimer(card.id)}
                          disabled={!isClockedIn}
                          className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer ${
                            isClockedIn 
                              ? `${styles.button} hover:scale-[1.01]` 
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                          }`}
                          title={isClockedIn ? `Start independent timer on ${card.projectType}` : 'Clock in on primary time card first'}
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>{isClockedIn ? `Start ${card.projectType} Timer` : 'Clock In to Start'}</span>
                        </button>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
