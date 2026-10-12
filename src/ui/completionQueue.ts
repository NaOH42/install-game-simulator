export interface CompletionItem {
  gameId: string;
  firstInstall: boolean;
  reward: number;
}

export interface CompletionFeedback {
  id: number;
  items: CompletionItem[];
  totalReward: number;
}

/** Transient presentation state only: a completed install is never an economic transaction here. */
export interface CompletionQueue {
  active: CompletionFeedback | null;
  waiting: CompletionFeedback[];
  nextId: number;
  announcedId: number | null;
}

export function createCompletionQueue(): CompletionQueue {
  return { active: null, waiting: [], nextId: 1, announcedId: null };
}

export function advanceCompletionQueue(queue: CompletionQueue, visible: boolean): CompletionQueue {
  if (!visible || queue.active || !queue.waiting.length) return queue;
  return { ...queue, active: queue.waiting[0], waiting: queue.waiting.slice(1), announcedId: null };
}

export function enqueueCompletions(queue: CompletionQueue, items: CompletionItem[], visible: boolean): CompletionQueue {
  if (!items.length) return advanceCompletionQueue(queue, visible);
  const waiting = items.map((item, index): CompletionFeedback => ({
    id: queue.nextId + index,
    items: [{ ...item }],
    totalReward: item.firstInstall ? item.reward : 0,
  }));
  return advanceCompletionQueue({ ...queue, waiting: [...queue.waiting, ...waiting], nextId: queue.nextId + items.length }, visible);
}

/** Ignore stale or duplicate animation callbacks instead of skipping the following game. */
export function finishCompletion(queue: CompletionQueue, id: number, visible: boolean): CompletionQueue {
  if (!visible || queue.active?.id !== id) return queue;
  return advanceCompletionQueue({ ...queue, active: null, announcedId: null }, visible);
}

/** Claim once when a mounted scene is actually visible, including across StrictMode effect replays. */
export function claimCompletionStart(queue: CompletionQueue, id: number, visible: boolean): { queue: CompletionQueue; item: CompletionItem | null } {
  if (!visible || queue.active?.id !== id || queue.announcedId === id) return { queue, item: null };
  return { queue: { ...queue, announcedId: id }, item: queue.active.items[0] };
}

export function resetCompletionQueue(queue: CompletionQueue): CompletionQueue {
  // Never reuse IDs: a pending callback from the old session must not dismiss a new celebration.
  return { ...queue, active: null, waiting: [], announcedId: null };
}
