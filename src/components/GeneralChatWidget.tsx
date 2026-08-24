import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Send, 
  MessageSquare, 
  AtSign, 
  Hash, 
  Reply, 
  ExternalLink, 
  Search, 
  ChevronDown, 
  Maximize2, 
  Minimize2, 
  Users, 
  Trash2,
  AlertCircle,
  FileText, 
  Check, 
  CheckCheck, 
  Sparkles,
  Paperclip,
  Clock,
  Filter
} from 'lucide-react';
import { ChatMessage, Job, StaffUser } from '../types';
import { STAFF_USERS } from '../data/mockData';

interface GeneralChatWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  currentStaff: StaffUser;
  jobs: Job[];
  onSendMessage: (text: string, mentions?: string[], referencedJobNumbers?: string[], replyToId?: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onSelectJob: (job: Job) => void;
  onMarkAsRead: () => void;
}

export const GeneralChatWidget: React.FC<GeneralChatWidgetProps> = ({
  isOpen,
  onClose,
  messages,
  currentStaff,
  jobs,
  onSendMessage,
  onDeleteMessage,
  onSelectJob,
  onMarkAsRead
}) => {
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'mentions' | 'plans'>('all');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [showJobPicker, setShowJobPicker] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [jobQuery, setJobQuery] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const jobSearchInputRef = useRef<HTMLInputElement>(null);
  const mentionSearchInputRef = useRef<HTMLInputElement>(null);

  // Auto scroll to bottom on new messages or when opened
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      onMarkAsRead();
    }
  }, [isOpen, messages.length]);

  // Focus plan search input when plan picker opens
  useEffect(() => {
    if (showJobPicker) {
      setTimeout(() => {
        jobSearchInputRef.current?.focus();
      }, 50);
    }
  }, [showJobPicker]);

  // Focus mention search input when mention picker opens
  useEffect(() => {
    if (showMentionPicker) {
      setTimeout(() => {
        mentionSearchInputRef.current?.focus();
      }, 50);
    }
  }, [showMentionPicker]);

  if (!isOpen) return null;

  // Handle detecting '@' and '#' in typing
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputText(val);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    const words = textBeforeCursor.split(/\s/);
    const lastWord = words[words.length - 1];

    if (lastWord.startsWith('@')) {
      setShowMentionPicker(true);
      setShowJobPicker(false);
      setMentionQuery(lastWord.slice(1).toLowerCase());
    } else if (lastWord.startsWith('#')) {
      setShowJobPicker(true);
      setShowMentionPicker(false);
      setJobQuery(lastWord.slice(1).toLowerCase());
    } else {
      setShowMentionPicker(false);
      setShowJobPicker(false);
    }
  };

  // Insert a staff mention
  const handleInsertMention = (staffName: string) => {
    if (!inputRef.current) return;
    const cursorPos = inputRef.current.selectionStart;
    const textBeforeCursor = inputText.slice(0, cursorPos);
    const textAfterCursor = inputText.slice(cursorPos);

    // Replace the trailing @query with @StaffName
    const updatedBefore = textBeforeCursor.replace(/@[^@\s]*$/, `@${staffName} `);
    setInputText(updatedBefore + textAfterCursor);
    setShowMentionPicker(false);
    
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  // Insert an MPS Job link
  const handleInsertJob = (jobNumber: string) => {
    if (!inputRef.current) return;
    const cursorPos = inputRef.current.selectionStart;
    const textBeforeCursor = inputText.slice(0, cursorPos);
    const textAfterCursor = inputText.slice(cursorPos);

    const updatedBefore = textBeforeCursor.replace(/#[^#\s]*$/, `#${jobNumber} `);
    setInputText(updatedBefore + textAfterCursor);
    setShowJobPicker(false);

    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  // Submit message
  const handleSend = () => {
    if (!inputText.trim()) return;

    // Detect mentions from text
    const foundMentions: string[] = [];
    STAFF_USERS.forEach(s => {
      const regex = new RegExp(`@${s.name}`, 'i');
      if (regex.test(inputText)) {
        foundMentions.push(s.name);
      }
    });

    // Detect referenced jobs from text
    const foundJobNumbers: string[] = [];
    jobs.forEach(j => {
      const cleanNum = j.job_number.replace(/^#/, '');
      const regex = new RegExp(`(#?${cleanNum})`, 'i');
      if (regex.test(inputText)) {
        foundJobNumbers.push(j.job_number);
      }
    });

    onSendMessage(
      inputText.trim(),
      foundMentions.length > 0 ? foundMentions : undefined,
      foundJobNumbers.length > 0 ? foundJobNumbers : undefined,
      replyingTo?.id
    );

    setInputText('');
    setReplyingTo(null);
    setShowMentionPicker(false);
    setShowJobPicker(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Filter messages
  const filteredMessages = messages.filter(msg => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchText = msg.text.toLowerCase().includes(q);
      const matchSender = msg.senderName.toLowerCase().includes(q);
      const matchJob = (msg.referencedJobNumbers || []).some(j => j.toLowerCase().includes(q));
      if (!matchText && !matchSender && !matchJob) return false;
    }

    if (activeTab === 'mentions') {
      const mentionsMe = (msg.mentions || []).some(m => m.toLowerCase().includes(currentStaff.name.toLowerCase()));
      const repliedToMe = msg.replyToMessage && msg.replyToMessage.senderName.toLowerCase().includes(currentStaff.name.toLowerCase());
      return mentionsMe || repliedToMe;
    }

    if (activeTab === 'plans') {
      return (msg.referencedJobNumbers && msg.referencedJobNumbers.length > 0);
    }

    return true;
  });

  // Filtered staff for @ autocomplete
  const filteredStaff = STAFF_USERS.filter(s => {
    if (!mentionQuery) return true;
    const q = mentionQuery.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.title.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
  });

  // Filtered jobs for # autocomplete
  const filteredJobs = jobs.filter(j => {
    if (!jobQuery) return true;
    const q = jobQuery.toLowerCase();
    return (
      j.job_number.toLowerCase().includes(q) || 
      j.customer_name.toLowerCase().includes(q) ||
      (j.style || '').toLowerCase().includes(q) ||
      (j.current_status || '').toLowerCase().includes(q) ||
      (j.assigned_drafter || '').toLowerCase().includes(q) ||
      (j.project_manager || '').toLowerCase().includes(q)
    );
  });

  // Render message text with interactive @ mentions and clickable #MPS-numbers
  const renderMessageContent = (text: string) => {
    // Regex matches either @Name or #MPS-... or #101
    const parts = text.split(/(@[A-Za-z\s]+|#?[A-Za-z0-9_-]+)/g);

    return parts.map((part, index) => {
      // Check if this part matches an @Staff
      if (part.startsWith('@')) {
        const staffNameTrimmed = part.slice(1).trim();
        const isMatchedStaff = STAFF_USERS.some(s => s.name.toLowerCase() === staffNameTrimmed.toLowerCase());
        const isMe = staffNameTrimmed.toLowerCase() === currentStaff.name.toLowerCase();

        if (isMatchedStaff) {
          return (
            <span
              key={index}
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-xs font-bold border transition ${
                isMe 
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 ring-1 ring-amber-500/30' 
                  : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
              }`}
            >
              <AtSign className="w-2.5 h-2.5 inline" />
              {staffNameTrimmed}
            </span>
          );
        }
      }

      // Check if this part matches an existing Job Number
      const normalizedPart = part.replace(/^#/, '');
      const matchedJob = jobs.find(j => {
        const jNum = j.job_number.replace(/^#/, '');
        return jNum.toLowerCase() === normalizedPart.toLowerCase() || j.job_number.toLowerCase() === part.toLowerCase();
      });

      if (matchedJob) {
        return (
          <button
            key={index}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectJob(matchedJob);
            }}
            className="inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 my-0.5 bg-blue-950/80 hover:bg-blue-900 text-blue-300 hover:text-blue-200 border border-blue-500/40 hover:border-blue-400 rounded-md text-xs font-mono font-bold transition shadow-xs cursor-pointer group"
            title={`Click to open Plan ${matchedJob.job_number} (${matchedJob.customer_name})`}
          >
            <FileText className="w-3 h-3 text-blue-400 group-hover:scale-110 transition-transform" />
            <span>{matchedJob.job_number}</span>
            <ExternalLink className="w-2.5 h-2.5 text-blue-400 opacity-70 group-hover:opacity-100" />
          </button>
        );
      }

      return <span key={index}>{part}</span>;
    });
  };

  const getStaffAvatarColor = (name: string) => {
    if (name.toLowerCase().includes('greg')) return 'bg-amber-600 text-amber-100';
    if (name.toLowerCase().includes('jason')) return 'bg-blue-600 text-blue-100';
    if (name.toLowerCase().includes('kyle')) return 'bg-emerald-600 text-emerald-100';
    if (name.toLowerCase().includes('sarah')) return 'bg-purple-600 text-purple-100';
    if (name.toLowerCase().includes('alex')) return 'bg-cyan-600 text-cyan-100';
    if (name.toLowerCase().includes('elena')) return 'bg-rose-600 text-rose-100';
    if (name.toLowerCase().includes('drew')) return 'bg-indigo-600 text-indigo-100';
    return 'bg-slate-700 text-slate-200';
  };

  const getStaffInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div
      className={`fixed right-4 bg-slate-900/98 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden transition-all duration-200 ${
        isExpanded
          ? 'top-16 bottom-4 w-[600px] max-w-[calc(100vw-2rem)] ring-4 ring-blue-500/20'
          : 'top-16 w-[440px] max-w-[calc(100vw-2rem)] h-[620px] max-h-[calc(100vh-5rem)]'
      }`}
    >
      {/* Top Header */}
      <div className="p-3.5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-wide">Studio Team Chat</h3>
              <span className="flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded-full font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Live
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Logged in as <span className="text-slate-200 font-semibold">{currentStaff.name}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            title={isExpanded ? "Collapse width" : "Expand width"}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
            title="Close chat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="px-3 pt-2.5 pb-2 bg-slate-900/90 border-b border-slate-800/80 space-y-2">
        <div className="flex items-center justify-between gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`flex-1 text-xs font-semibold py-1 px-2 rounded-lg transition ${
              activeTab === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Messages
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('mentions')}
            className={`flex-1 text-xs font-semibold py-1 px-2 rounded-lg transition flex items-center justify-center gap-1 ${
              activeTab === 'mentions'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <AtSign className="w-3 h-3" />
            <span>My Mentions</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('plans')}
            className={`flex-1 text-xs font-semibold py-1 px-2 rounded-lg transition flex items-center justify-center gap-1 ${
              activeTab === 'plans'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Hash className="w-3 h-3" />
            <span>Plans</span>
          </button>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search chat text, drafter name, or #MPS..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 bg-slate-900/60">
        {filteredMessages.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 mx-auto flex items-center justify-center text-slate-500 mb-3">
              <MessageSquare className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-300">No messages in this view</p>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              {activeTab === 'mentions'
                ? "You don't have any @mentions or replies yet."
                : "Type below to start chatting with drafters and project managers."}
            </p>
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const isMe = msg.senderId === currentStaff.id || msg.senderName === currentStaff.name;
            const mentionsMe = (msg.mentions || []).some(m => m.toLowerCase().includes(currentStaff.name.toLowerCase()));

            return (
              <div
                key={msg.id}
                className={`group relative flex flex-col gap-1 rounded-xl p-2.5 transition ${
                  mentionsMe
                    ? 'bg-amber-500/10 border border-amber-500/30'
                    : isMe
                    ? 'bg-blue-600/10 border border-blue-500/20'
                    : 'bg-slate-950/60 border border-slate-800/80 hover:border-slate-700'
                }`}
              >
                {/* Replying To snippet */}
                {msg.replyToMessage && (
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-950/80 border-l-2 border-blue-500 px-2 py-1 rounded mb-1">
                    <Reply className="w-3 h-3 text-blue-400 shrink-0" />
                    <span className="font-semibold text-slate-300">@{msg.replyToMessage.senderName}:</span>
                    <span className="truncate max-w-[280px]">{msg.replyToMessage.text}</span>
                  </div>
                )}

                {/* Message Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-extrabold shadow-xs ${getStaffAvatarColor(
                        msg.senderName
                      )}`}
                    >
                      {getStaffInitials(msg.senderName)}
                    </div>
                    <span className="text-xs font-bold text-slate-200">{msg.senderName}</span>
                    {msg.senderRole && (
                      <span className="text-[10px] text-slate-400 truncate max-w-[140px] font-mono">
                        {msg.senderRole.split('&')[0]}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>

                    {/* Quick Action Buttons on Hover */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Reply Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingTo(msg);
                          inputRef.current?.focus();
                        }}
                        className="text-[11px] text-slate-400 hover:text-blue-300 flex items-center gap-1 bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded transition cursor-pointer"
                        title="Reply to this message"
                      >
                        <Reply className="w-3 h-3" />
                        <span>Reply</span>
                      </button>

                      {/* Delete Button */}
                      {onDeleteMessage && (
                        deletingMessageId === msg.id ? (
                          <div className="flex items-center gap-1 bg-red-950/90 border border-red-500/40 rounded px-1.5 py-0.5 animate-fadeIn">
                            <span className="text-[10px] text-red-300 font-bold">Delete?</span>
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteMessage(msg.id);
                                setDeletingMessageId(null);
                              }}
                              className="text-[10px] font-bold bg-red-600 hover:bg-red-500 text-white px-1.5 py-0.2 rounded transition cursor-pointer"
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingMessageId(null)}
                              className="text-[10px] text-slate-400 hover:text-white px-1 py-0.2 rounded transition cursor-pointer"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeletingMessageId(msg.id)}
                            className="text-[11px] text-slate-400 hover:text-red-400 p-1 hover:bg-red-500/10 rounded transition cursor-pointer"
                            title="Delete message"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>

                {/* Message Body */}
                <div className="text-xs text-slate-300 leading-relaxed pl-8 break-words">
                  {renderMessageContent(msg.text)}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Autocomplete Dropdown Popovers */}
      {showMentionPicker && (
        <div className="bg-slate-950 border border-blue-500/50 rounded-xl mx-3 mb-2 shadow-2xl z-20 overflow-hidden flex flex-col max-h-64 ring-2 ring-blue-500/20">
          <div className="p-2 bg-slate-900 border-b border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
              <span className="flex items-center gap-1.5 text-blue-400">
                <AtSign className="w-3.5 h-3.5" />
                Tag a Drafter / Manager
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {filteredStaff.length} of {STAFF_USERS.length} staff
              </span>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={mentionSearchInputRef}
                type="text"
                value={mentionQuery}
                onChange={(e) => setMentionQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filteredStaff.length > 0) {
                    e.preventDefault();
                    handleInsertMention(filteredStaff[0].name);
                  } else if (e.key === 'Escape') {
                    setShowMentionPicker(false);
                  }
                }}
                placeholder="Search staff by name or role..."
                className="w-full pl-8 pr-7 py-1.5 bg-slate-950 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-400"
              />
              {mentionQuery && (
                <button
                  type="button"
                  onClick={() => setMentionQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div className="overflow-y-auto max-h-44 p-1 divide-y divide-slate-800/40">
            {filteredStaff.length === 0 ? (
              <div className="text-center py-4 px-2 text-slate-400 text-xs">
                <p>No staff matching "{mentionQuery}"</p>
                <button
                  type="button"
                  onClick={() => setMentionQuery('')}
                  className="mt-1 text-[11px] text-blue-400 hover:underline cursor-pointer"
                >
                  Clear search
                </button>
              </div>
            ) : (
              filteredStaff.map((staff) => (
                <button
                  key={staff.id}
                  type="button"
                  onClick={() => handleInsertMention(staff.name)}
                  className="w-full text-left p-1.5 hover:bg-blue-600/20 rounded-lg flex items-center justify-between gap-2 transition cursor-pointer group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold shrink-0 ${getStaffAvatarColor(staff.name)}`}>
                      {getStaffInitials(staff.name)}
                    </div>
                    <div className="truncate">
                      <span className="text-xs font-semibold text-white group-hover:text-blue-300 block leading-tight truncate">{staff.name}</span>
                      <span className="text-[10px] text-slate-400 block truncate">{staff.title}</span>
                    </div>
                  </div>
                  <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono shrink-0">
                    @{staff.name}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {showJobPicker && (
        <div className="bg-slate-950 border border-indigo-500/50 rounded-xl mx-3 mb-2 shadow-2xl z-20 overflow-hidden flex flex-col max-h-72 ring-2 ring-indigo-500/20">
          {/* Dedicated Plan Search Box Header */}
          <div className="p-2 bg-slate-900 border-b border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
              <span className="flex items-center gap-1.5 text-indigo-400">
                <FileText className="w-3.5 h-3.5" />
                Link an Architectural Plan (#)
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {filteredJobs.length} of {jobs.length} plans
              </span>
            </div>
            
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={jobSearchInputRef}
                type="text"
                value={jobQuery}
                onChange={(e) => setJobQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filteredJobs.length > 0) {
                    e.preventDefault();
                    handleInsertJob(filteredJobs[0].job_number);
                  } else if (e.key === 'Escape') {
                    setShowJobPicker(false);
                  }
                }}
                placeholder="Search by job #, customer name, style, or phase..."
                className="w-full pl-8 pr-7 py-1.5 bg-slate-950 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400"
              />
              {jobQuery && (
                <button
                  type="button"
                  onClick={() => setJobQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Plan List */}
          <div className="overflow-y-auto max-h-48 p-1 divide-y divide-slate-800/40">
            {filteredJobs.length === 0 ? (
              <div className="text-center py-6 px-3 text-slate-400 text-xs">
                <FileText className="w-6 h-6 mx-auto text-slate-600 mb-1.5" />
                <p className="font-semibold text-slate-300">No architectural plans found</p>
                <p className="text-[11px] text-slate-500 mt-0.5">No match for "{jobQuery}"</p>
                <button
                  type="button"
                  onClick={() => setJobQuery('')}
                  className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer inline-flex items-center gap-1"
                >
                  <span>Show all active plans</span>
                </button>
              </div>
            ) : (
              filteredJobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => handleInsertJob(job.job_number)}
                  className="w-full text-left p-2 hover:bg-indigo-600/20 rounded-lg flex items-center justify-between gap-2.5 transition cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-indigo-950/80 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 group-hover:scale-105 transition-transform">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 truncate">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-blue-300 group-hover:text-blue-200">{job.job_number}</span>
                        <span className="text-[10px] text-slate-400 truncate">• {job.customer_name}</span>
                      </div>
                      <span className="text-[11px] text-slate-400 truncate block">{job.style || 'Custom Architectural Plan'}</span>
                    </div>
                  </div>
                  <span className="text-[10px] bg-slate-800/90 group-hover:bg-indigo-950 text-slate-300 group-hover:text-indigo-200 border border-slate-700/50 group-hover:border-indigo-500/40 px-2 py-0.5 rounded-md font-mono shrink-0">
                    {job.current_status}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-3 bg-slate-950 border-t border-slate-800">
        {/* Active Reply Banner */}
        {replyingTo && (
          <div className="flex items-center justify-between gap-2 bg-blue-950/60 border border-blue-500/30 px-2.5 py-1.5 rounded-lg mb-2 text-xs">
            <div className="flex items-center gap-1.5 text-blue-300 truncate">
              <Reply className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>Replying to <strong className="text-white">@{replyingTo.senderName}</strong>:</span>
              <span className="text-slate-300 truncate max-w-[200px]">"{replyingTo.text}"</span>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
              title="Cancel reply"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Quick Helper Action Buttons */}
        <div className="flex items-center gap-2 mb-2">
          <button
            type="button"
            onClick={() => {
              setShowMentionPicker(!showMentionPicker);
              setShowJobPicker(false);
              setMentionQuery('');
              setInputText(prev => prev + '@');
              inputRef.current?.focus();
            }}
            className="flex items-center gap-1 px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold rounded-md border border-slate-700 transition cursor-pointer"
          >
            <AtSign className="w-3 h-3 text-amber-400" />
            <span>Tag Drafter</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowJobPicker(!showJobPicker);
              setShowMentionPicker(false);
              setJobQuery('');
              setInputText(prev => prev + '#');
              inputRef.current?.focus();
            }}
            className="flex items-center gap-1 px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold rounded-md border border-slate-700 transition cursor-pointer"
          >
            <Hash className="w-3 h-3 text-blue-400" />
            <span>Link Plan #</span>
          </button>

          <span className="text-[10px] text-slate-500 ml-auto font-mono hidden sm:inline">
            Enter ↵ to send
          </span>
        </div>

        {/* Message Textarea & Send Button */}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            rows={2}
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={`Message team (type @ to tag, # for plan)...`}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={!inputText.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white p-2.5 rounded-xl transition shadow-xs cursor-pointer flex items-center justify-center shrink-0 active:scale-95"
            title="Send Message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
