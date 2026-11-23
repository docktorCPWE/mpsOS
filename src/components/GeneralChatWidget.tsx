import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  ChevronRight,
  CornerDownRight,
  Maximize2, 
  Minimize2, 
  Trash2,
  FileText, 
  CheckCheck, 
  CheckSquare,
  Square
} from 'lucide-react';
import { ChatMessage, Job, StaffUser } from '../types';
import { STAFF_USERS, isMessageRelevantForUser } from '../data/mockData';

interface GeneralChatWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  currentStaff: StaffUser;
  staffList?: StaffUser[];
  jobs: Job[];
  onSendMessage: (text: string, mentions?: string[], referencedJobNumbers?: string[], replyToId?: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onDeleteMultipleMessages?: (messageIds: string[]) => void;
  onSelectJob: (job: Job) => void;
  onMarkAsRead: (messageIds?: string[]) => void;
}

interface ChatThread {
  root: ChatMessage;
  replies: ChatMessage[];
  allMessages: ChatMessage[];
  latestTimestampMs: number;
  unreadIds: string[];
  unreadReplyCount: number;
  isRootUnread: boolean;
  hasUnread: boolean;
}

export const GeneralChatWidget: React.FC<GeneralChatWidgetProps> = ({
  isOpen,
  onClose,
  messages,
  currentStaff,
  staffList,
  jobs,
  onSendMessage,
  onDeleteMessage,
  onDeleteMultipleMessages,
  onSelectJob,
  onMarkAsRead
}) => {
  const effectiveStaffList = staffList && staffList.length > 0 ? staffList : STAFF_USERS;
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'mentions' | 'plans'>('all');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [showJobPicker, setShowJobPicker] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [jobQuery, setJobQuery] = useState('');
  const [collapsedThreadIds, setCollapsedThreadIds] = useState<Record<string, boolean>>({});
  const [confirmDeleteAllRead, setConfirmDeleteAllRead] = useState(false);

  // Multi-message select and bulk delete state
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const jobSearchInputRef = useRef<HTMLInputElement>(null);
  const mentionSearchInputRef = useRef<HTMLInputElement>(null);

  // Auto scroll to bottom on new messages or when opened (without wiping unread green dots!)
  useEffect(() => {
    if (isOpen && !searchQuery) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  // Filter messages visible to current staff user (passes full messages list so nested thread chains stay intact)
  const userRelevantMessages = useMemo(
    () => messages.filter(msg => isMessageRelevantForUser(msg, currentStaff, jobs, messages)),
    [messages, currentStaff, jobs]
  );

  // Build nested conversation threads (parent + all associated nested replies)
  const threads: ChatThread[] = useMemo(() => {
    const byId = new Map<string, ChatMessage>(userRelevantMessages.map(m => [m.id, m]));

    // Trace any reply chain (including replies-to-replies) back to the root message in the thread
    const resolveRootId = (msg: ChatMessage): string => {
      const visited = new Set<string>([msg.id]);
      let curr = msg;
      while (curr.replyToId && byId.has(curr.replyToId) && !visited.has(curr.replyToId)) {
        visited.add(curr.replyToId);
        curr = byId.get(curr.replyToId)!;
      }
      return curr.id;
    };

    const grouped = new Map<string, { root: ChatMessage; replies: ChatMessage[] }>();

    // Register roots first
    for (const msg of userRelevantMessages) {
      const rootId = resolveRootId(msg);
      if (rootId === msg.id) {
        if (!grouped.has(msg.id)) {
          grouped.set(msg.id, { root: msg, replies: [] });
        }
      }
    }

    // Attach replies to their root thread
    for (const msg of userRelevantMessages) {
      const rootId = resolveRootId(msg);
      if (rootId !== msg.id) {
        const entry = grouped.get(rootId);
        if (entry) {
          entry.replies.push(msg);
        } else {
          grouped.set(msg.id, { root: msg, replies: [] });
        }
      }
    }

    const result: ChatThread[] = [];
    for (const { root, replies } of grouped.values()) {
      const sortedReplies = [...replies].sort(
        (a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()
      );
      const allMsgs = [root, ...sortedReplies];
      const latestTimestampMs = Math.max(
        ...allMsgs.map(m => new Date(m.timestamp || 0).getTime() || 0)
      );
      const isUnread = (m: ChatMessage) =>
        m.senderId !== currentStaff.id && !(m.readByStaffIds || []).includes(currentStaff.id);
      const isRootUnread = isUnread(root);
      const unreadReplies = sortedReplies.filter(isUnread);
      const unreadIds = allMsgs.filter(isUnread).map(m => m.id);

      result.push({
        root,
        replies: sortedReplies,
        allMessages: allMsgs,
        latestTimestampMs,
        unreadIds,
        unreadReplyCount: unreadReplies.length,
        isRootUnread,
        hasUnread: unreadIds.length > 0
      });
    }

    // Order threads by latest activity so threads with fresh replies surface naturally
    result.sort((a, b) => a.latestTimestampMs - b.latestTimestampMs);
    return result;
  }, [userRelevantMessages, currentStaff.id]);

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

    // Detect mentions from text (matches full name OR first name e.g. @Kyle or @Kyle Edmonson)
    const foundMentions: string[] = [];
    effectiveStaffList.forEach(s => {
      const escapedFull = s.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const firstName = s.name.trim().split(/\s+/)[0];
      const escapedFirst = firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const fullRegex = new RegExp(`@${escapedFull}\\b`, 'i');
      const firstRegex = firstName.length >= 3 ? new RegExp(`@${escapedFirst}\\b`, 'i') : null;
      if (fullRegex.test(inputText) || (firstRegex && firstRegex.test(inputText))) {
        if (!foundMentions.includes(s.name)) {
          foundMentions.push(s.name);
        }
      }
    });

    // Detect referenced jobs from text
    const foundJobNumbers: string[] = [];
    jobs.forEach(j => {
      const cleanNum = j.job_number.replace(/^#/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(#?${cleanNum})\\b`, 'i');
      if (regex.test(inputText)) {
        foundJobNumbers.push(j.job_number);
      }
    });

    // If replying to a thread, ensure that thread stays expanded and mark its existing unread messages read for sender
    if (replyingTo) {
      const parentThread = threads.find(t => t.allMessages.some(m => m.id === replyingTo.id));
      if (parentThread) {
        setCollapsedThreadIds(prev => ({ ...prev, [parentThread.root.id]: false }));
        if (parentThread.unreadIds.length > 0) {
          onMarkAsRead(parentThread.unreadIds);
        }
      }
    }

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

  // Count unread and read messages for this user
  const unreadCount = userRelevantMessages.filter(
    m => m.senderId !== currentStaff.id && !(m.readByStaffIds || []).includes(currentStaff.id)
  ).length;
  const readCount = userRelevantMessages.filter(
    m => m.senderId === currentStaff.id || (m.readByStaffIds || []).includes(currentStaff.id)
  ).length;

  const currentFirstName = (currentStaff.name || '').trim().split(/\s+/)[0].toLowerCase();
  const doesMsgMentionCurrentUser = (msg: ChatMessage): boolean => {
    const fullLower = (currentStaff.name || '').toLowerCase();
    const mentionsMe = (msg.mentions || []).some(m => {
      const ml = m.toLowerCase();
      return ml.includes(fullLower) || fullLower.includes(ml) || (currentFirstName.length >= 3 && ml.includes(currentFirstName));
    });
    const textMentionsMe =
      currentFirstName.length >= 3 &&
      new RegExp(`@${currentFirstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(msg.text || '');
    const repliedToMe = Boolean(
      msg.replyToMessage &&
      ((msg.replyToMessage.senderName || '').toLowerCase().includes(fullLower) ||
        (currentFirstName.length >= 3 && (msg.replyToMessage.senderName || '').toLowerCase().includes(currentFirstName)))
    );
    return mentionsMe || textMentionsMe || repliedToMe;
  };

  const doesMsgMatchSearch = (msg: ChatMessage, q: string): boolean => {
    if (!q) return true;
    const textMatch = (msg.text || '').toLowerCase().includes(q);
    const senderMatch = (msg.senderName || '').toLowerCase().includes(q);
    const mentionMatch = (msg.mentions || []).some(m => m.toLowerCase().includes(q));
    const jobMatch = (msg.referencedJobNumbers || []).some(j => j.toLowerCase().includes(q));
    const customerMatch = (msg.referencedJobNumbers || []).some(rjn => {
      const cleanR = rjn.replace(/^#/, '').toLowerCase();
      const job = jobs.find(j => j.job_number.replace(/^#/, '').toLowerCase() === cleanR);
      return Boolean(
        job &&
        ((job.customer_name || '').toLowerCase().includes(q) || (job.project_name || '').toLowerCase().includes(q))
      );
    });
    return textMatch || senderMatch || mentionMatch || jobMatch || customerMatch;
  };

  // Filter nested threads by search query (matches parent OR any nested reply) and active tab
  const filteredThreads = threads.filter(thread => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const anyMatch = thread.allMessages.some(m => doesMsgMatchSearch(m, q));
      if (!anyMatch) return false;
    }

    if (activeTab === 'unread') {
      return thread.hasUnread;
    }

    if (activeTab === 'mentions') {
      return thread.allMessages.some(doesMsgMentionCurrentUser);
    }

    if (activeTab === 'plans') {
      return thread.allMessages.some(m => m.referencedJobNumbers && m.referencedJobNumbers.length > 0);
    }

    return true;
  });

  const filteredMessages = filteredThreads.flatMap(t => t.allMessages);

  // Selection handlers
  const toggleSelectMessage = (id: string) => {
    setSelectedMessageIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllVisible = () => {
    const visibleIds = filteredMessages.map(m => m.id);
    setSelectedMessageIds(new Set(visibleIds));
  };

  const handleSelectAllRead = () => {
    const readIds = userRelevantMessages
      .filter(m => m.senderId === currentStaff.id || (m.readByStaffIds || []).includes(currentStaff.id))
      .map(m => m.id);
    setSelectedMessageIds(new Set(readIds));
  };

  const handleClearSelection = () => {
    setSelectedMessageIds(new Set());
    setConfirmBulkDelete(false);
  };

  const executeBulkDelete = () => {
    const ids = Array.from(selectedMessageIds);
    if (ids.length === 0) return;
    if (onDeleteMultipleMessages) {
      onDeleteMultipleMessages(ids);
    } else if (onDeleteMessage) {
      ids.forEach(id => onDeleteMessage(id));
    }
    setSelectedMessageIds(new Set());
    setConfirmBulkDelete(false);
    setIsMultiSelectMode(false);
  };

  const executeQuickDeleteAllRead = () => {
    const readIds = userRelevantMessages
      .filter(m => m.senderId === currentStaff.id || (m.readByStaffIds || []).includes(currentStaff.id))
      .map(m => m.id);
    if (readIds.length === 0) return;
    if (onDeleteMultipleMessages) {
      onDeleteMultipleMessages(readIds);
    } else if (onDeleteMessage) {
      readIds.forEach(id => onDeleteMessage(id));
    }
    setConfirmDeleteAllRead(false);
  };

  const toggleThreadExpanded = (thread: ChatThread) => {
    const currentlyCollapsed = collapsedThreadIds[thread.root.id] ?? false;
    setCollapsedThreadIds(prev => ({
      ...prev,
      [thread.root.id]: !currentlyCollapsed
    }));
  };

  // Filtered staff for @ autocomplete
  const filteredStaff = effectiveStaffList.filter(s => {
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
        const isMatchedStaff = effectiveStaffList.some(s => s.name.toLowerCase() === staffNameTrimmed.toLowerCase());
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
          {/* Mark All Read Button (clears all green dots) */}
          {unreadCount > 0 && !isMultiSelectMode && (
            <button
              type="button"
              onClick={() => onMarkAsRead()}
              className="px-2 py-1 text-emerald-300 hover:text-white bg-emerald-500/15 hover:bg-emerald-600/40 rounded-lg transition flex items-center gap-1 text-[11px] font-semibold border border-emerald-500/30 cursor-pointer"
              title={`Mark all ${unreadCount} unread messages as read`}
            >
              <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Mark All Read</span>
            </button>
          )}

          {/* Quick Clear All Read Messages Button (inline confirm, no window.confirm) */}
          {readCount > 0 && !isMultiSelectMode && (
            confirmDeleteAllRead ? (
              <div className="flex items-center gap-1 bg-red-950/90 border border-red-500/50 rounded-lg px-2 py-1">
                <span className="text-[10px] font-bold text-red-200">Delete {readCount} read?</span>
                <button
                  type="button"
                  onClick={executeQuickDeleteAllRead}
                  className="text-[10px] font-bold bg-red-600 hover:bg-red-500 text-white px-1.5 py-0.5 rounded cursor-pointer"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteAllRead(false)}
                  className="text-[10px] text-slate-300 hover:text-white px-1 py-0.5 cursor-pointer"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDeleteAllRead(true)}
                className="px-2 py-1 text-slate-400 hover:text-red-300 hover:bg-red-950/40 rounded-lg transition flex items-center gap-1 text-[11px] font-medium border border-transparent hover:border-red-500/30 cursor-pointer"
                title={`Delete all ${readCount} read messages simultaneously`}
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                <span className="hidden sm:inline">Delete Read ({readCount})</span>
              </button>
            )
          )}

          {/* Multi-Select Messages Mode Toggle */}
          <button
            type="button"
            onClick={() => {
              setIsMultiSelectMode(!isMultiSelectMode);
              setConfirmDeleteAllRead(false);
              if (isMultiSelectMode) {
                handleClearSelection();
              }
            }}
            className={`px-2 py-1 rounded-lg transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer ${
              isMultiSelectMode
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700'
            }`}
            title={isMultiSelectMode ? "Exit selection mode" : "Select multiple messages to delete simultaneously"}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>{isMultiSelectMode ? 'Cancel' : 'Select'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
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
            All
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('unread')}
            className={`flex-1 text-xs font-semibold py-1 px-2 rounded-lg transition flex items-center justify-center gap-1 ${
              activeTab === 'unread'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Unread</span>
            {unreadCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === 'unread' ? 'bg-white text-emerald-700' : 'bg-emerald-500/20 text-emerald-400'
              }`}>
                {unreadCount}
              </span>
            )}
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
            <span>Mentions</span>
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
            placeholder="Search chat text, drafter name, or #Job..."
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

        {/* Multi-Select Action Banner */}
        {isMultiSelectMode && (
          <div className="bg-blue-950/90 border border-blue-500/40 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2 shadow-lg animate-fadeIn">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-blue-200 mr-1">
                {selectedMessageIds.size} of {filteredMessages.length} selected
              </span>
              <button
                type="button"
                onClick={handleSelectAllVisible}
                className="text-[11px] font-semibold text-blue-300 hover:text-white bg-blue-900/60 hover:bg-blue-800 px-2 py-0.5 rounded transition cursor-pointer"
              >
                Select All
              </button>
              {readCount > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllRead}
                  className="text-[11px] font-semibold text-emerald-300 hover:text-white bg-emerald-950/60 hover:bg-emerald-800 px-2 py-0.5 rounded transition cursor-pointer"
                >
                  Select Read ({readCount})
                </button>
              )}
              {selectedMessageIds.size > 0 && (
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="text-[11px] text-slate-400 hover:text-white px-1.5 py-0.5 transition cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {selectedMessageIds.size > 0 && (
                confirmBulkDelete ? (
                  <div className="flex items-center gap-1.5 bg-red-950 border border-red-500/60 rounded-lg px-2 py-1">
                    <span className="text-xs font-bold text-red-200">
                      Delete {selectedMessageIds.size} message{selectedMessageIds.size > 1 ? 's' : ''}?
                    </span>
                    <button
                      type="button"
                      onClick={executeBulkDelete}
                      className="text-xs font-bold bg-red-600 hover:bg-red-500 text-white px-2 py-0.5 rounded transition cursor-pointer"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmBulkDelete(false)}
                      className="text-xs text-slate-400 hover:text-white px-1.5 py-0.5 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmBulkDelete(true)}
                    className="text-xs font-bold bg-red-600 hover:bg-red-500 text-white px-2.5 py-1 rounded-lg transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Selected ({selectedMessageIds.size})</span>
                  </button>
                )
              )}
            </div>
          </div>
        )}
      </div>

      {/* Nested Threads Feed */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-slate-900/60">
        {filteredThreads.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 mx-auto flex items-center justify-center text-slate-500 mb-3">
              <MessageSquare className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-300">
              {searchQuery ? `No chats matching "${searchQuery}"` : 'No messages in this view'}
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              {searchQuery
                ? 'Try searching by a different word, drafter name, customer name, or plan number.'
                : activeTab === 'unread'
                ? 'All caught up! New messages and nested thread replies will appear here with a green dot.'
                : activeTab === 'mentions'
                ? "You don't have any @mentions or replies yet."
                : 'Type below to start chatting with drafters and project managers.'}
            </p>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="mt-3 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-blue-300 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          filteredThreads.map((thread) => {
            const { root, replies, unreadIds, unreadReplyCount, isRootUnread, hasUnread } = thread;
            const isSearchActive = searchQuery.trim().length > 0;
            // Threads with unread replies or active search auto-show expanded unless explicitly collapsed by user
            const isThreadExpanded = isSearchActive
              ? true
              : collapsedThreadIds[root.id] !== undefined
              ? !collapsedThreadIds[root.id]
              : true;

            const renderMessageCard = (msg: ChatMessage, isNestedReply: boolean) => {
              const isMe = msg.senderId === currentStaff.id || msg.senderName === currentStaff.name;
              const mentionsMe = doesMsgMentionCurrentUser(msg);
              const isSelected = selectedMessageIds.has(msg.id);
              const isMsgUnread = !isMe && !(msg.readByStaffIds || []).includes(currentStaff.id);
              const showThreadGreenDot = !isNestedReply && hasUnread;

              return (
                <div
                  key={msg.id}
                  onClick={() => {
                    if (isMultiSelectMode) {
                      toggleSelectMessage(msg.id);
                    }
                  }}
                  className={`group relative flex flex-col gap-1 rounded-xl p-2.5 transition ${
                    isMultiSelectMode ? 'cursor-pointer' : ''
                  } ${
                    isSelected
                      ? 'bg-blue-600/20 border-2 border-blue-400 ring-2 ring-blue-500/20 shadow-md'
                      : isMsgUnread || showThreadGreenDot
                      ? 'bg-emerald-950/20 border border-emerald-500/40 border-l-2 border-l-emerald-400 shadow-xs'
                      : mentionsMe
                      ? 'bg-amber-500/10 border border-amber-500/30'
                      : isMe
                      ? 'bg-blue-600/10 border border-blue-500/20'
                      : isNestedReply
                      ? 'bg-slate-950/80 border border-slate-800/70 hover:border-slate-700'
                      : 'bg-slate-950/60 border border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  {/* For nested replies-to-replies, show compact quote only if replying to a non-root reply */}
                  {isNestedReply && msg.replyToId && msg.replyToId !== root.id && msg.replyToMessage && (
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 bg-slate-900/90 border-l-2 border-blue-500/70 px-2 py-0.5 rounded mb-0.5">
                      <Reply className="w-2.5 h-2.5 text-blue-400 shrink-0" />
                      <span className="font-semibold text-slate-300">@{msg.replyToMessage.senderName}:</span>
                      <span className="truncate max-w-[240px]">{msg.replyToMessage.text}</span>
                    </div>
                  )}

                  {/* Message Header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Multi-Select Checkbox */}
                      {isMultiSelectMode && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelectMessage(msg.id);
                          }}
                          className={`p-0.5 rounded transition cursor-pointer shrink-0 ${
                            isSelected ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          {isSelected ? <CheckSquare className="w-4 h-4 fill-blue-500/20" /> : <Square className="w-4 h-4" />}
                        </button>
                      )}

                      {/* Avatar with pulsing green dot when this message or an associated nested reply is new */}
                      <div className="relative shrink-0">
                        <div
                          className={`${isNestedReply ? 'w-5 h-5 text-[9px]' : 'w-6 h-6 text-[10px]'} rounded-lg flex items-center justify-center font-extrabold shadow-xs ${getStaffAvatarColor(
                            msg.senderName
                          )}`}
                        >
                          {getStaffInitials(msg.senderName)}
                        </div>
                        {(isMsgUnread || showThreadGreenDot) && (
                          <span
                            className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-950 shadow-[0_0_8px_rgba(52,211,153,0.95)] animate-pulse"
                            title={
                              showThreadGreenDot && unreadReplyCount > 0
                                ? `${unreadReplyCount} new nested repl${unreadReplyCount === 1 ? 'y' : 'ies'} in this thread`
                                : 'New unread message'
                            }
                          />
                        )}
                      </div>

                      <span className="text-xs font-bold text-slate-200 truncate">{msg.senderName}</span>
                      {msg.senderRole && !isNestedReply && (
                        <span className="text-[10px] text-slate-400 truncate max-w-[120px] font-mono hidden sm:inline">
                          {msg.senderRole.split('&')[0]}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Green Dot / New indicator */}
                      {isMsgUnread ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/40 px-1.5 py-0.2 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          New
                        </span>
                      ) : !isNestedReply && unreadReplyCount > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/40 px-1.5 py-0.2 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          {unreadReplyCount} new {unreadReplyCount === 1 ? 'reply' : 'replies'}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500 flex items-center gap-0.5" title="Read">
                          <CheckCheck className="w-3 h-3 text-blue-400/70" />
                        </span>
                      )}

                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>

                      {/* Quick Action Buttons on Hover (always visible on unread thread mark-read) */}
                      {!isMultiSelectMode && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setReplyingTo(msg);
                              setCollapsedThreadIds(prev => ({ ...prev, [root.id]: false }));
                              inputRef.current?.focus();
                            }}
                            className="text-[11px] text-slate-300 hover:text-blue-300 flex items-center gap-1 bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded transition cursor-pointer"
                            title="Reply in nested thread"
                          >
                            <Reply className="w-3 h-3" />
                            <span>Reply</span>
                          </button>

                          {onDeleteMessage && (
                            deletingMessageId === msg.id ? (
                              <div className="flex items-center gap-1 bg-red-950/90 border border-red-500/40 rounded px-1.5 py-0.5 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
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
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingMessageId(msg.id);
                                }}
                                className="text-[11px] text-slate-400 hover:text-red-400 p-1 hover:bg-red-500/10 rounded transition cursor-pointer"
                                title="Delete message"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Message Body */}
                  <div className={`text-xs text-slate-300 leading-relaxed ${isMultiSelectMode ? 'pl-14' : isNestedReply ? 'pl-7' : 'pl-8'} break-words`}>
                    {renderMessageContent(msg.text)}
                  </div>

                  {/* Root Footer Bar: Nested Replies Toggle + Thread Mark Read */}
                  {!isNestedReply && (replies.length > 0 || hasUnread) && (
                    <div className="flex items-center justify-between gap-2 pt-1.5 mt-1 pl-8 border-t border-slate-800/60">
                      <div className="flex items-center gap-2">
                        {replies.length > 0 ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleThreadExpanded(thread);
                            }}
                            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-lg transition cursor-pointer ${
                              unreadReplyCount > 0
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/25'
                                : 'bg-slate-800/80 text-slate-300 border border-slate-700/70 hover:bg-slate-800 hover:text-white'
                            }`}
                          >
                            {isThreadExpanded ? (
                              <ChevronDown className="w-3 h-3" />
                            ) : (
                              <ChevronRight className="w-3 h-3" />
                            )}
                            <CornerDownRight className="w-3 h-3 opacity-80" />
                            <span>
                              {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                            </span>
                            {unreadReplyCount > 0 && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-200 ml-0.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.95)] animate-pulse" />
                                {unreadReplyCount} new
                              </span>
                            )}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setReplyingTo(root);
                              inputRef.current?.focus();
                            }}
                            className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-blue-300 transition cursor-pointer"
                          >
                            <Reply className="w-3 h-3" />
                            <span>Reply</span>
                          </button>
                        )}
                      </div>

                      {hasUnread && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onMarkAsRead(unreadIds);
                          }}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-300 hover:text-white bg-emerald-500/10 hover:bg-emerald-600/30 border border-emerald-500/30 px-2 py-0.5 rounded-md transition cursor-pointer"
                          title="Mark this conversation and all its nested replies as read"
                        >
                          <CheckCheck className="w-3 h-3" />
                          <span>Mark read</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            };

            return (
              <div key={root.id} className="space-y-1.5">
                {/* Parent / Root Message */}
                {renderMessageCard(root, false)}

                {/* Nested Child Replies Rail */}
                {replies.length > 0 && isThreadExpanded && (
                  <div
                    className={`ml-4 pl-3 space-y-1.5 border-l-2 ${
                      unreadReplyCount > 0 ? 'border-emerald-500/60' : 'border-slate-700/70'
                    }`}
                  >
                    {replies.map((replyMsg) => renderMessageCard(replyMsg, true))}

                    {/* Quick inline reply button at bottom of nested thread */}
                    {!isMultiSelectMode && (
                      <div className="pt-0.5 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => {
                            setReplyingTo(replies[replies.length - 1] || root);
                            inputRef.current?.focus();
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-blue-300 px-2 py-0.5 rounded hover:bg-slate-800/70 transition cursor-pointer"
                        >
                          <CornerDownRight className="w-3 h-3" />
                          <span>Reply to thread...</span>
                        </button>
                        {unreadReplyCount > 0 && (
                          <button
                            type="button"
                            onClick={() => onMarkAsRead(unreadIds)}
                            className="text-[10px] font-semibold text-emerald-400 hover:text-emerald-200 cursor-pointer"
                          >
                            Clear green dot
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
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
                {filteredStaff.length} of {effectiveStaffList.length} staff
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
