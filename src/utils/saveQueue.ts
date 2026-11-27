export interface DebouncedSaveQueue<T extends object> {
  /** Merge updates into `id`'s pending patch and reset only `id`'s timer. */
  schedule: (id: string, updates: Partial<T>, debounceMs: number) => void;
  /** Cancel `id`'s timer and immediately flush pending + optional extra updates. */
  flush: (id: string, extraUpdates?: Partial<T>) => Promise<void>;
  /** Immediately flush every note that currently has pending updates. */
  flushAll: () => Promise<void>;
  /** Discard any pending timer/updates for `id` (e.g. when deleting a note). */
  cancel: (id: string) => void;
  /** Discard all pending timers/updates. */
  cancelAll: () => void;
  /** Returns true if `id` (or any note when omitted) has pending updates. */
  hasPending: (id?: string) => boolean;
}

interface PendingEntry<T extends object> {
  timer: ReturnType<typeof setTimeout>;
  updates: Partial<T>;
}

/**
 * Per-note debounced save queue. Keeps each note's timer and patch isolated so
 * editing or switching between notes never drops another note's unsaved edits.
 */
export function createDebouncedSaveQueue<T extends object>(
  onFlush: (id: string, updates: Partial<T>) => Promise<void> | void,
): DebouncedSaveQueue<T> {
  const pending = new Map<string, PendingEntry<T>>();

  const schedule = (id: string, updates: Partial<T>, debounceMs: number) => {
    const existing = pending.get(id);
    if (existing) {
      clearTimeout(existing.timer);
    }

    const mergedUpdates: Partial<T> = {
      ...(existing?.updates ?? {}),
      ...updates,
    };

    const timer = setTimeout(() => {
      const entry = pending.get(id);
      if (!entry) return;
      pending.delete(id);
      void onFlush(id, entry.updates);
    }, debounceMs);

    pending.set(id, { timer, updates: mergedUpdates });
  };

  const flush = async (id: string, extraUpdates?: Partial<T>) => {
    const existing = pending.get(id);
    if (existing) {
      clearTimeout(existing.timer);
      pending.delete(id);
    }

    const mergedUpdates: Partial<T> = {
      ...(existing?.updates ?? {}),
      ...(extraUpdates ?? {}),
    };

    if (Object.keys(mergedUpdates).length === 0) {
      return;
    }

    await onFlush(id, mergedUpdates);
  };

  const flushAll = async () => {
    const ids = Array.from(pending.keys());
    await Promise.all(ids.map((id) => flush(id)));
  };

  const cancel = (id: string) => {
    const existing = pending.get(id);
    if (existing) {
      clearTimeout(existing.timer);
      pending.delete(id);
    }
  };

  const cancelAll = () => {
    for (const entry of pending.values()) {
      clearTimeout(entry.timer);
    }
    pending.clear();
  };

  const hasPending = (id?: string) => {
    if (id !== undefined) {
      return pending.has(id);
    }
    return pending.size > 0;
  };

  return {
    schedule,
    flush,
    flushAll,
    cancel,
    cancelAll,
    hasPending,
  };
}
