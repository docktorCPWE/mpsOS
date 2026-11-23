import { GregDevProjectCard, GregDevTimeEntry, StaffUser, StandardGregDevProjectType } from '../types';
import { getLocalDateString } from './timeCardExport';

export const GREG_DEV_STORAGE_CARDS_KEY = 'myplanstore_greg_dev_cards_v1';
export const GREG_DEV_STORAGE_ENTRIES_KEY = 'myplanstore_greg_dev_entries_v1';
export const GREG_DEV_TIMER_INTENTS_KEY = 'myplanstore_greg_dev_timer_intents_v1';

export type DevCardTimerIntent =
  | {
      state: 'running';
      activeTimerStart: string;
      updatedAtMs: number;
      projectType?: string;
      currentNotes?: string;
    }
  | {
      state: 'stopped';
      stoppedAt: string;
      updatedAtMs: number;
      reason: 'user_stop' | 'break' | 'clock_out';
    };

export function getStoredDevCardTimerIntents(): Record<string, DevCardTimerIntent> {
  try {
    const raw = localStorage.getItem(GREG_DEV_TIMER_INTENTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveStoredDevCardTimerIntents(intents: Record<string, DevCardTimerIntent>): void {
  try {
    localStorage.setItem(GREG_DEV_TIMER_INTENTS_KEY, JSON.stringify(intents));
  } catch {
    // ignore storage errors
  }
}

export function recordDevCardTimerIntent(cardId: string, intent: DevCardTimerIntent): void {
  if (!cardId) return;
  const intents = getStoredDevCardTimerIntents();
  intents[cardId] = intent;
  saveStoredDevCardTimerIntents(intents);
}

export function clearDevCardTimerIntent(cardId: string): void {
  if (!cardId) return;
  const intents = getStoredDevCardTimerIntents();
  if (cardId in intents) {
    delete intents[cardId];
    saveStoredDevCardTimerIntents(intents);
  }
}

export interface ProjectTypeMeta {
  type: StandardGregDevProjectType;
  colorTheme: 'indigo' | 'cyan' | 'purple' | 'blue' | 'amber' | 'emerald' | 'rose';
  shortDesc: string;
  badgeBg: string;
  badgeText: string;
  borderClass: string;
  accentClass: string;
}

export const PRESET_DEV_PROJECT_TYPES: ProjectTypeMeta[] = [
  {
    type: 'MPS OS Dev',
    colorTheme: 'indigo',
    shortDesc: 'Plan Store OS core engine, automated drafting tools & app ecosystem',
    badgeBg: 'bg-indigo-900/60',
    badgeText: 'text-indigo-300',
    borderClass: 'border-indigo-500/40',
    accentClass: 'text-indigo-400'
  },
  {
    type: 'BigX Media Dev',
    colorTheme: 'cyan',
    shortDesc: 'Media rendering, high-res video assets, branding & dynamic content',
    badgeBg: 'bg-cyan-900/60',
    badgeText: 'text-cyan-300',
    borderClass: 'border-cyan-500/40',
    accentClass: 'text-cyan-400'
  },
  {
    type: 'Sound Extraction Dev',
    colorTheme: 'purple',
    shortDesc: 'Audio extraction algorithms, frequency isolating & stem processing',
    badgeBg: 'bg-purple-900/60',
    badgeText: 'text-purple-300',
    borderClass: 'border-purple-500/40',
    accentClass: 'text-purple-400'
  },
  {
    type: 'FB Media Dev',
    colorTheme: 'blue',
    shortDesc: 'Facebook/Meta media integrations, automated advertising & social pipelines',
    badgeBg: 'bg-blue-900/60',
    badgeText: 'text-blue-300',
    borderClass: 'border-blue-500/40',
    accentClass: 'text-blue-400'
  },
  {
    type: 'Other Dev',
    colorTheme: 'amber',
    shortDesc: 'Experimental modules, R&D scripts, sound & system utility integrations',
    badgeBg: 'bg-amber-900/60',
    badgeText: 'text-amber-300',
    borderClass: 'border-amber-500/40',
    accentClass: 'text-amber-400'
  }
];

export function isUserGregHyatt(user?: StaffUser | null): boolean {
  if (!user) return false;
  if (user.email && user.email.toLowerCase() === 'arkcwd@gmail.com') return true;
  if (user.name && user.name.toLowerCase().includes('greg hyatt')) return true;
  if (user.id === 'staff-greg') return true;
  return false;
}

// Initial starter cards for Greg so when he clocks in, he has instant access to his preferred project types
export const INITIAL_GREG_DEV_CARDS: GregDevProjectCard[] = [
  {
    id: 'dev-card-mps-os',
    projectType: 'MPS OS Dev',
    colorTheme: 'indigo',
    isActive: false,
    isPausedByBreak: false,
    todaySeconds: 0,
    totalSeconds: 54000,
    currentNotes: 'Time card sync & drafter workload optimization'
  },
  {
    id: 'dev-card-bigx-media',
    projectType: 'BigX Media Dev',
    colorTheme: 'cyan',
    isActive: false,
    isPausedByBreak: false,
    todaySeconds: 0,
    totalSeconds: 28800,
    currentNotes: 'Video clip render pipeline & compression'
  },
  {
    id: 'dev-card-sound-extraction',
    projectType: 'Sound Extraction Dev',
    colorTheme: 'purple',
    isActive: false,
    isPausedByBreak: false,
    todaySeconds: 0,
    totalSeconds: 32400,
    currentNotes: 'Stem separation & frequency DSP processing'
  }
];

// Seed realistic initial entries for Greg for past days so Weekly and Monthly reports are full, while today starts clean
export const INITIAL_GREG_DEV_ENTRIES: GregDevTimeEntry[] = [
  {
    id: 'dev-log-prev-1',
    staffId: 'staff-greg',
    staffName: 'Greg Hyatt',
    projectType: 'MPS OS Dev',
    date: '2026-09-08',
    startTime: '2026-09-08T13:30:00.000Z',
    endTime: '2026-09-08T15:00:00.000Z',
    durationSeconds: 5400, // 1.5 hrs
    notes: 'MPS OS Dev: Multi-card time clock architecture & Firestore synchronization',
    hourlyRate: 150,
    billableAmount: 225,
    createdAt: '2026-09-08T15:00:00.000Z'
  },
  {
    id: 'dev-log-prev-2',
    staffId: 'staff-greg',
    staffName: 'Greg Hyatt',
    projectType: 'BigX Media Dev',
    date: '2026-09-08',
    startTime: '2026-09-08T10:00:00.000Z',
    endTime: '2026-09-08T11:00:00.000Z',
    durationSeconds: 3600, // 1.0 hr
    notes: 'BigX Media Dev: Video encoding queue & thumbnail extraction automation',
    hourlyRate: 150,
    billableAmount: 150,
    createdAt: '2026-09-08T11:00:00.000Z'
  },
  {
    id: 'dev-log-prev-3',
    staffId: 'staff-greg',
    staffName: 'Greg Hyatt',
    projectType: 'Sound Extraction Dev',
    date: '2026-09-07',
    startTime: '2026-09-07T14:00:00.000Z',
    endTime: '2026-09-07T14:45:00.000Z',
    durationSeconds: 2700, // 0.75 hr
    notes: 'Sound Extraction Dev: WAV stem splitting and frequency curve isolation',
    hourlyRate: 150,
    billableAmount: 112.5,
    createdAt: '2026-09-07T14:45:00.000Z'
  },
  // Yesterday entry
  {
    id: 'dev-log-yesterday-1',
    staffId: 'staff-greg',
    staffName: 'Greg Hyatt',
    projectType: 'FB Media Dev',
    date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    startTime: new Date(Date.now() - 93600000).toISOString(),
    endTime: new Date(Date.now() - 86400000).toISOString(),
    durationSeconds: 7200, // 2.0 hrs
    notes: 'FB Media Dev: Ad creative asset synchronization and campaign tracking API',
    hourlyRate: 150,
    billableAmount: 300,
    createdAt: new Date(Date.now() - 86400000).toISOString()
  },
  // Earlier this week
  {
    id: 'dev-log-earlier-week-1',
    staffId: 'staff-greg',
    staffName: 'Greg Hyatt',
    projectType: 'MPS OS Dev',
    date: new Date(Date.now() - 172800000).toISOString().split('T')[0],
    startTime: new Date(Date.now() - 183600000).toISOString(),
    endTime: new Date(Date.now() - 172800000).toISOString(),
    durationSeconds: 10800, // 3.0 hrs
    notes: 'MPS OS Dev: Plan package viewer rendering speeds and CAD scale overlays',
    hourlyRate: 150,
    billableAmount: 450,
    createdAt: new Date(Date.now() - 172800000).toISOString()
  },
  {
    id: 'dev-log-earlier-week-2',
    staffId: 'staff-greg',
    staffName: 'Greg Hyatt',
    projectType: 'Other Dev',
    date: new Date(Date.now() - 259200000).toISOString().split('T')[0],
    startTime: new Date(Date.now() - 266400000).toISOString(),
    endTime: new Date(Date.now() - 259200000).toISOString(),
    durationSeconds: 7200, // 2.0 hrs
    notes: 'Other Dev: Cloud backup integration and database indexing benchmarks',
    hourlyRate: 150,
    billableAmount: 300,
    createdAt: new Date(Date.now() - 259200000).toISOString()
  },
  // Earlier this month
  {
    id: 'dev-log-earlier-month-1',
    staffId: 'staff-greg',
    staffName: 'Greg Hyatt',
    projectType: 'Sound Extraction Dev',
    date: new Date(Date.now() - 604800000).toISOString().split('T')[0],
    startTime: new Date(Date.now() - 619200000).toISOString(),
    endTime: new Date(Date.now() - 604800000).toISOString(),
    durationSeconds: 14400, // 4.0 hrs
    notes: 'Sound Extraction Dev: Noise cancellation algorithms & spectral gating filter',
    hourlyRate: 150,
    billableAmount: 600,
    createdAt: new Date(Date.now() - 604800000).toISOString()
  },
  {
    id: 'dev-log-earlier-month-2',
    staffId: 'staff-greg',
    staffName: 'Greg Hyatt',
    projectType: 'BigX Media Dev',
    date: new Date(Date.now() - 777600000).toISOString().split('T')[0],
    startTime: new Date(Date.now() - 792000000).toISOString(),
    endTime: new Date(Date.now() - 777600000).toISOString(),
    durationSeconds: 12600, // 3.5 hrs
    notes: 'BigX Media Dev: Audio-reactive video generator and resolution scaling',
    hourlyRate: 150,
    billableAmount: 525,
    createdAt: new Date(Date.now() - 777600000).toISOString()
  }
];

export interface ReconciledDevCardsResult {
  cards: GregDevProjectCard[];
  duplicateIdsToDelete: string[];
}

const CANONICAL_DEV_CARD_IDS = new Set([
  'dev-card-mps-os',
  'dev-card-bigx-media',
  'dev-card-sound-extraction',
  'dev-card-other-dev',
  'dev-card-fb-media'
]);

function normalizeDevProjectType(projectType?: string): string {
  return (projectType || 'Other Dev').trim().toLowerCase();
}

function parseTimestampMs(iso?: string): number {
  if (!iso) return NaN;
  const ms = new Date(iso).getTime();
  return isNaN(ms) ? NaN : ms;
}

/**
 * Safely normalizes and deduplicates Greg Dev Project Cards in memory:
 * 1. NEVER auto-stops a running timer that has a valid activeTimerStart timestamp
 *    (timers are ONLY ever stopped by an explicit user action: Stop, Break, Clock Out, or Dismiss).
 * 2. Only clears structurally corrupt state (isActive: true with missing/NaN activeTimerStart,
 *    or leftover activeTimerStart on an explicitly inactive card).
 * 3. Deduplicates duplicate Firestore docs for the same projectType, always keeping the running
 *    or canonical card.
 * 4. Recalculates todaySeconds & totalSeconds cleanly from completed entries.
 */
export function sanitizeAndDedupeDevProjectCards(
  cards: GregDevProjectCard[],
  entries: GregDevTimeEntry[],
  _localCardsSnapshot?: GregDevProjectCard[],
  todayStr: string = getLocalDateString(new Date())
): ReconciledDevCardsResult {
  const duplicateIdsToDelete: string[] = [];

  const sanitized: GregDevProjectCard[] = cards.map(card => {
    const startMs = parseTimestampMs(card.activeTimerStart);

    if (card.isActive) {
      if (!card.activeTimerStart || isNaN(startMs)) {
        // Structurally corrupt active card without a valid start timestamp
        return {
          ...card,
          isActive: false,
          isPausedByBreak: false,
          activeTimerStart: undefined
        };
      }
      // Valid running timer — preserve untouched!
      return { ...card };
    }

    if (card.activeTimerStart) {
      // Explicitly inactive card with leftover timestamp field
      return {
        ...card,
        activeTimerStart: undefined
      };
    }

    return { ...card };
  });

  // Deduplicate cards that share the exact same normalized projectType
  const byType = new Map<string, GregDevProjectCard[]>();
  const typeOrder: string[] = [];
  for (const card of sanitized) {
    const key = normalizeDevProjectType(card.projectType);
    if (!byType.has(key)) {
      byType.set(key, []);
      typeOrder.push(key);
    }
    byType.get(key)!.push(card);
  }

  const deduped: GregDevProjectCard[] = [];
  for (const key of typeOrder) {
    const group = byType.get(key)!;
    if (group.length === 1) {
      deduped.push(group[0]);
      continue;
    }

    // Pick single authoritative card for this projectType (always prefer actively running card first)
    const sorted = [...group].sort((a, b) => {
      const aRunning = a.isActive && Boolean(a.activeTimerStart) ? 1 : 0;
      const bRunning = b.isActive && Boolean(b.activeTimerStart) ? 1 : 0;
      if (aRunning !== bRunning) return bRunning - aRunning;

      if (aRunning && bRunning) {
        const aStart = parseTimestampMs(a.activeTimerStart) || 0;
        const bStart = parseTimestampMs(b.activeTimerStart) || 0;
        if (aStart !== bStart) return bStart - aStart;
      }

      const aCanonical = CANONICAL_DEV_CARD_IDS.has(a.id) ? 1 : 0;
      const bCanonical = CANONICAL_DEV_CARD_IDS.has(b.id) ? 1 : 0;
      if (aCanonical !== bCanonical) return bCanonical - aCanonical;

      const aLast = Math.max(parseTimestampMs(a.lastStoppedAt) || 0, parseTimestampMs(a.lastStartedAt) || 0);
      const bLast = Math.max(parseTimestampMs(b.lastStoppedAt) || 0, parseTimestampMs(b.lastStartedAt) || 0);
      if (aLast !== bLast) return bLast - aLast;

      return (b.totalSeconds || 0) - (a.totalSeconds || 0);
    });

    const winner = { ...sorted[0] };
    for (let i = 1; i < sorted.length; i++) {
      const loser = sorted[i];
      duplicateIdsToDelete.push(loser.id);
      winner.todaySeconds = Math.max(winner.todaySeconds || 0, loser.todaySeconds || 0);
      winner.totalSeconds = Math.max(winner.totalSeconds || 0, loser.totalSeconds || 0);
      if (!winner.currentNotes && loser.currentNotes) {
        winner.currentNotes = loser.currentNotes;
      }
    }
    deduped.push(winner);
  }

  // Reconcile todaySeconds & totalSeconds against entries
  const finalCards = reconcileGregDevCardsWithEntries(deduped, entries, todayStr);

  return {
    cards: finalCards,
    duplicateIdsToDelete
  };
}

export interface DevCardIntentReconciliationResult {
  cards: GregDevProjectCard[];
  cardsToHealToCloud: GregDevProjectCard[];
  updatedIntents: Record<string, DevCardTimerIntent>;
  intentsChanged: boolean;
}

/**
 * Authoritatively reconciles incoming cloud Dev Project Cards against the persisted local
 * Timer Intent Ledger so that a running timer started by the user can NEVER be shut off
 * by a stale snapshot, failed write, account switch, or rogue client overwrite.
 *
 * A locally started running timer ONLY transitions to stopped if:
 *   1. The user explicitly clicked Stop / Break / Clock Out locally (recorded in intents), OR
 *   2. The cloud card carries an explicitStopAt >= activeTimerStart (genuine explicit stop from another device), OR
 *   3. The cloud card is explicitly paused by break with lastStoppedAt >= activeTimerStart, OR
 *   4. A finalized GregDevTimeEntry already exists for this exact session startTime.
 */
export function reconcileDevCardsWithTimerIntents(
  cloudCards: GregDevProjectCard[],
  intents: Record<string, DevCardTimerIntent>,
  localCards: GregDevProjectCard[] = [],
  entries: GregDevTimeEntry[] = []
): DevCardIntentReconciliationResult {
  const updatedIntents: Record<string, DevCardTimerIntent> = { ...intents };
  let intentsChanged = false;
  const cardsToHealToCloud: GregDevProjectCard[] = [];
  const seenIds = new Set<string>();

  const hasFinalizedEntryForSession = (projectType: string, startIso: string): boolean => {
    const targetStartMs = parseTimestampMs(startIso);
    if (isNaN(targetStartMs)) return false;
    const normType = normalizeDevProjectType(projectType);
    return entries.some(e => {
      if (normalizeDevProjectType(e.projectType) !== normType) return false;
      const eStartMs = parseTimestampMs(e.startTime);
      return !isNaN(eStartMs) && Math.abs(eStartMs - targetStartMs) <= 2000;
    });
  };

  const reconciled: GregDevProjectCard[] = cloudCards.map(cloudCard => {
    seenIds.add(cloudCard.id);
    const intent = updatedIntents[cloudCard.id];
    const cloudIsRunning = Boolean(cloudCard.isActive && cloudCard.activeTimerStart && !isNaN(parseTimestampMs(cloudCard.activeTimerStart)));
    const cloudStartMs = parseTimestampMs(cloudCard.activeTimerStart);

    if (intent?.state === 'running') {
      const intentStartMs = parseTimestampMs(intent.activeTimerStart);

      if (cloudIsRunning) {
        // Cloud confirms timer is running. If another device started an even newer session, adopt it.
        if (!isNaN(cloudStartMs) && !isNaN(intentStartMs) && cloudStartMs > intentStartMs + 1500) {
          updatedIntents[cloudCard.id] = {
            state: 'running',
            activeTimerStart: cloudCard.activeTimerStart!,
            updatedAtMs: Date.now(),
            projectType: cloudCard.projectType,
            currentNotes: cloudCard.currentNotes
          };
          intentsChanged = true;
        }
        return cloudCard;
      }

      // Cloud says inactive while our persisted intent says running!
      // Accept the cloud stop ONLY if there is proof of a genuine newer explicit stop (e.g. from another device).
      const cloudExplicitStopMs = parseTimestampMs(cloudCard.explicitStopAt);
      const cloudLastStopMs = parseTimestampMs(cloudCard.lastStoppedAt);
      const hasNewerExplicitStop =
        !isNaN(intentStartMs) && !isNaN(cloudExplicitStopMs) && cloudExplicitStopMs >= intentStartMs - 1500;
      const hasNewerBreakPause =
        Boolean(cloudCard.isPausedByBreak) &&
        !isNaN(intentStartMs) &&
        !isNaN(cloudLastStopMs) &&
        cloudLastStopMs >= intentStartMs - 1500;
      const hasLoggedSessionEntry = hasFinalizedEntryForSession(
        cloudCard.projectType || intent.projectType || '',
        intent.activeTimerStart
      );

      if (hasNewerExplicitStop || hasNewerBreakPause || hasLoggedSessionEntry) {
        const stopIso =
          cloudCard.explicitStopAt ||
          cloudCard.lastStoppedAt ||
          new Date().toISOString();
        updatedIntents[cloudCard.id] = {
          state: 'stopped',
          stoppedAt: stopIso,
          updatedAtMs: Date.now(),
          reason: cloudCard.stoppedReason || (cloudCard.isPausedByBreak ? 'break' : 'user_stop')
        };
        intentsChanged = true;
        return cloudCard;
      }

      // Otherwise: stale snapshot, failed write, or rogue non-explicit overwrite!
      // Preserve the running timer and queue a cloud heal write back to Firestore.
      const healedCard: GregDevProjectCard = {
        ...cloudCard,
        isActive: true,
        isPausedByBreak: false,
        activeTimerStart: intent.activeTimerStart,
        lastStartedAt: intent.activeTimerStart,
        lastStoppedAt: undefined,
        explicitStopAt: undefined,
        stoppedReason: undefined
      };
      cardsToHealToCloud.push(healedCard);
      return healedCard;
    }

    if (intent?.state === 'stopped') {
      const intentStopMs = parseTimestampMs(intent.stoppedAt);
      if (cloudIsRunning) {
        // Only accept a cloud running timer if it started strictly AFTER our explicit stop
        if (!isNaN(cloudStartMs) && !isNaN(intentStopMs) && cloudStartMs > intentStopMs + 1500) {
          updatedIntents[cloudCard.id] = {
            state: 'running',
            activeTimerStart: cloudCard.activeTimerStart!,
            updatedAtMs: Date.now(),
            projectType: cloudCard.projectType,
            currentNotes: cloudCard.currentNotes
          };
          intentsChanged = true;
          return cloudCard;
        }
        // Stale pre-stop cloud echo: keep stopped and heal cloud
        const healedStopped: GregDevProjectCard = {
          ...cloudCard,
          isActive: false,
          isPausedByBreak: intent.reason === 'break',
          activeTimerStart: undefined,
          lastStoppedAt: intent.stoppedAt,
          explicitStopAt: intent.stoppedAt,
          stoppedReason: intent.reason
        };
        cardsToHealToCloud.push(healedStopped);
        return healedStopped;
      }
      return cloudCard;
    }

    // No prior local intent for this card: if cloud shows a valid running timer, protect it going forward
    if (cloudIsRunning && cloudCard.activeTimerStart) {
      updatedIntents[cloudCard.id] = {
        state: 'running',
        activeTimerStart: cloudCard.activeTimerStart,
        updatedAtMs: Date.now(),
        projectType: cloudCard.projectType,
        currentNotes: cloudCard.currentNotes
      };
      intentsChanged = true;
    }

    return cloudCard;
  });

  // Preserve any locally started card that hasn't echoed back from Firestore yet
  Object.entries(updatedIntents).forEach(([cardId, intent]) => {
    if (seenIds.has(cardId) || intent.state !== 'running') return;
    const localCard = localCards.find(c => c.id === cardId);
    if (localCard) {
      const restored: GregDevProjectCard = {
        ...localCard,
        isActive: true,
        isPausedByBreak: false,
        activeTimerStart: intent.activeTimerStart,
        lastStartedAt: intent.activeTimerStart,
        lastStoppedAt: undefined,
        explicitStopAt: undefined,
        stoppedReason: undefined
      };
      reconciled.push(restored);
      cardsToHealToCloud.push(restored);
    }
  });

  return {
    cards: reconciled,
    cardsToHealToCloud,
    updatedIntents,
    intentsChanged
  };
}

/**
 * Reconciles project cards so their todaySeconds accurately reflects ONLY entries
 * completed today, preventing multi-day inflation or runaway numbers.
 */
export function reconcileGregDevCardsWithEntries(
  cards: GregDevProjectCard[],
  entries: GregDevTimeEntry[],
  todayStr: string = getLocalDateString(new Date())
): GregDevProjectCard[] {
  return cards.map(card => {
    const normType = normalizeDevProjectType(card.projectType);
    const todaySec = entries
      .filter(e => {
        if (normalizeDevProjectType(e.projectType) !== normType) return false;
        const entryDate = e.date || (e.startTime ? getLocalDateString(new Date(e.startTime)) : '');
        return entryDate === todayStr;
      })
      .reduce((sum, e) => sum + (e.durationSeconds || 0), 0);

    const allTimeSec = entries
      .filter(e => normalizeDevProjectType(e.projectType) === normType)
      .reduce((sum, e) => sum + (e.durationSeconds || 0), 0);

    return {
      ...card,
      todaySeconds: todaySec,
      totalSeconds: Math.max(card.totalSeconds || 0, allTimeSec)
    };
  });
}

export function getStoredGregDevCards(): GregDevProjectCard[] {
  try {
    const raw = localStorage.getItem(GREG_DEV_STORAGE_CARDS_KEY);
    let cards = INITIAL_GREG_DEV_CARDS;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          cards = parsed;
        }
      } catch {
        cards = INITIAL_GREG_DEV_CARDS;
      }
    }

    // Auto-reconcile & sanitize with stored entries so zombies/duplicates never persist locally
    const entries = getStoredGregDevEntries();
    const { cards: reconciled } = sanitizeAndDedupeDevProjectCards(cards, entries);
    localStorage.setItem(GREG_DEV_STORAGE_CARDS_KEY, JSON.stringify(reconciled));
    return reconciled;
  } catch (err) {
    console.warn('Error reading stored Greg dev cards:', err);
    return INITIAL_GREG_DEV_CARDS;
  }
}

export function saveStoredGregDevCards(cards: GregDevProjectCard[]) {
  try {
    localStorage.setItem(GREG_DEV_STORAGE_CARDS_KEY, JSON.stringify(cards));
  } catch (err) {
    console.warn('Error saving Greg dev cards:', err);
  }
}

export function getStoredGregDevEntries(): GregDevTimeEntry[] {
  try {
    const raw = localStorage.getItem(GREG_DEV_STORAGE_ENTRIES_KEY);
    if (!raw) {
      localStorage.setItem(GREG_DEV_STORAGE_ENTRIES_KEY, JSON.stringify(INITIAL_GREG_DEV_ENTRIES));
      return INITIAL_GREG_DEV_ENTRIES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const isTestEntry = (e: GregDevTimeEntry) => {
        const text = (e.notes || '').toLowerCase();
        return text.includes('dsp testing') || text.includes('test card') || text.includes('dummy') || text.includes('m26-1000') || text.includes('m26-300');
      };
      const cleaned = parsed.filter(e => !isTestEntry(e));
      localStorage.setItem(GREG_DEV_STORAGE_ENTRIES_KEY, JSON.stringify(cleaned));
      return cleaned;
    }
    return INITIAL_GREG_DEV_ENTRIES;
  } catch (err) {
    console.warn('Error reading stored Greg dev entries:', err);
    return INITIAL_GREG_DEV_ENTRIES;
  }
}

export function saveStoredGregDevEntries(entries: GregDevTimeEntry[]) {
  try {
    localStorage.setItem(GREG_DEV_STORAGE_ENTRIES_KEY, JSON.stringify(entries));
  } catch (err) {
    console.warn('Error saving Greg dev entries:', err);
  }
}

// Date and Time range calculation helpers for Daily, Weekly, and Monthly filtering
export function getPeriodDateRange(period: 'daily' | 'weekly' | 'monthly', anchorDate: Date): { start: Date; end: Date; label: string } {
  const target = new Date(anchorDate);

  if (period === 'daily') {
    const start = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 0, 0, 0, 0);
    const end = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 23, 59, 59, 999);
    const label = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    return { start, end, label };
  }

  if (period === 'weekly') {
    // Week starting Monday
    const day = target.getDay();
    const diff = target.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(target.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const label = `Week of ${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    return { start: monday, end: sunday, label };
  }

  // Monthly
  const start = new Date(target.getFullYear(), target.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(target.getFullYear(), target.getMonth() + 1, 0, 23, 59, 59, 999);
  const label = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  return { start, end, label };
}

export function filterGregDevEntries(
  entries: GregDevTimeEntry[],
  period: 'daily' | 'weekly' | 'monthly',
  anchorDate: Date,
  selectedProjectType?: string
): { filtered: GregDevTimeEntry[]; range: { start: Date; end: Date; label: string } } {
  const range = getPeriodDateRange(period, anchorDate);

  const filtered = entries.filter(entry => {
    const entryDate = new Date(entry.startTime || entry.date);
    if (entryDate < range.start || entryDate > range.end) return false;
    if (selectedProjectType && selectedProjectType !== 'all') {
      if (entry.projectType.toLowerCase() !== selectedProjectType.toLowerCase()) return false;
    }
    return true;
  }).sort((a, b) => new Date(b.startTime || b.date).getTime() - new Date(a.startTime || a.date).getTime());

  return { filtered, range };
}

// CSV Export Generator
export function exportGregDevTimeEntriesCSV(
  entries: GregDevTimeEntry[],
  period: 'daily' | 'weekly' | 'monthly',
  rangeLabel: string,
  projectTypeFilter?: string
) {
  if (!entries || entries.length === 0) {
    alert(`No dev time entries found for ${rangeLabel} to export.`);
    return;
  }

  const safe = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;

  const headers = [
    'Date',
    'Staff Name',
    'Project Type',
    'Start Time',
    'End Time',
    'Duration (HH:MM:SS)',
    'Duration Hours (Dec)',
    'Hourly Rate ($)',
    'Gross Incurred ($)',
    'Session Description / Notes',
    'Created At'
  ];

  const rows = entries.map(e => {
    const startObj = e.startTime ? new Date(e.startTime) : null;
    const endObj = e.endTime ? new Date(e.endTime) : null;

    const startFormatted = startObj ? startObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--';
    const endFormatted = endObj ? endObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--';
    
    const totalHours = (e.durationSeconds / 3600).toFixed(2);
    const hrs = Math.floor(e.durationSeconds / 3600);
    const mins = Math.floor((e.durationSeconds % 3600) / 60);
    const secs = e.durationSeconds % 60;
    const hhmmss = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    return [
      safe(e.date),
      safe(e.staffName || 'Greg Hyatt'),
      safe(e.projectType),
      safe(startFormatted),
      safe(endFormatted),
      safe(hhmmss),
      safe(totalHours),
      safe(`$${e.hourlyRate || 150}.00`),
      safe(`$${e.billableAmount.toFixed(2)}`),
      safe(e.notes || ''),
      safe(e.createdAt || '')
    ].join(',');
  });

  // Calculate totals row
  const totalSec = entries.reduce((sum, e) => sum + (e.durationSeconds || 0), 0);
  const totalGross = entries.reduce((sum, e) => sum + (e.billableAmount || 0), 0);
  const totalHrsDec = (totalSec / 3600).toFixed(2);
  const tHrs = Math.floor(totalSec / 3600);
  const tMins = Math.floor((totalSec % 3600) / 60);
  const tSecs = totalSec % 60;
  const totalHhmmss = `${String(tHrs).padStart(2, '0')}:${String(tMins).padStart(2, '0')}:${String(tSecs).padStart(2, '0')}`;

  const summaryRow = [
    safe('TOTALS'),
    safe(''),
    safe(`${entries.length} Sessions`),
    safe(''),
    safe(''),
    safe(totalHhmmss),
    safe(totalHrsDec),
    safe(''),
    safe(`$${totalGross.toFixed(2)}`),
    safe(`Filter: ${period.toUpperCase()} (${rangeLabel})`),
    safe('')
  ].join(',');

  const csvContent = [
    `# MY PLAN STORE OS - GREG HYATT DEV PROJECT TIME CARDS`,
    `# Report Period: ${rangeLabel} (${period.toUpperCase()})`,
    `# Filtered Project Type: ${projectTypeFilter || 'All Projects'}`,
    `# Generated: ${new Date().toLocaleString()}`,
    headers.join(','),
    ...rows,
    summaryRow
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  const cleanLabel = rangeLabel.replace(/[^a-zA-Z0-9]/g, '_');
  link.setAttribute('href', url);
  link.setAttribute('download', `Greg_Hyatt_Dev_Hours_${period}_${cleanLabel}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export type GregDevLayoutMode = 'grid' | 'kanban' | 'list';
export const GREG_DEV_LAYOUT_STORAGE_KEY = 'mps_greg_dev_layout_preference';

export function getStoredGregDevLayout(): GregDevLayoutMode {
  try {
    const saved = localStorage.getItem(GREG_DEV_LAYOUT_STORAGE_KEY);
    if (saved === 'grid' || saved === 'kanban' || saved === 'list') {
      return saved;
    }
  } catch {
    // ignore
  }
  return 'grid';
}

export function saveStoredGregDevLayout(layout: GregDevLayoutMode): void {
  try {
    localStorage.setItem(GREG_DEV_LAYOUT_STORAGE_KEY, layout);
  } catch {
    // ignore
  }
}
