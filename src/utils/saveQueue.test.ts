import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Note } from "../types/note";
import { createDebouncedSaveQueue } from "./saveQueue";

describe("createDebouncedSaveQueue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("merges rapid edits to the same note into a single flush", () => {
    const onFlush = vi.fn();
    const queue = createDebouncedSaveQueue<Note>(onFlush);

    queue.schedule("note-a", { title: "First" }, 500);
    vi.advanceTimersByTime(200);
    queue.schedule("note-a", { content: "Body" }, 500);
    vi.advanceTimersByTime(499);
    expect(onFlush).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush).toHaveBeenCalledWith("note-a", {
      title: "First",
      content: "Body",
    });
  });

  it("keeps timers and updates isolated across different notes", () => {
    const onFlush = vi.fn();
    const queue = createDebouncedSaveQueue<Note>(onFlush);

    queue.schedule("note-a", { content: "Edit A" }, 500);
    vi.advanceTimersByTime(200);
    queue.schedule("note-b", { content: "Edit B" }, 500);

    // At 500ms total, Note A flushes while Note B is still pending
    vi.advanceTimersByTime(300);
    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush).toHaveBeenCalledWith("note-a", { content: "Edit A" });
    expect(queue.hasPending("note-a")).toBe(false);
    expect(queue.hasPending("note-b")).toBe(true);

    // 200ms later, Note B flushes cleanly
    vi.advanceTimersByTime(200);
    expect(onFlush).toHaveBeenCalledTimes(2);
    expect(onFlush).toHaveBeenLastCalledWith("note-b", { content: "Edit B" });
  });

  it("flushes a single note immediately without canceling another note's timer", async () => {
    const onFlush = vi.fn();
    const queue = createDebouncedSaveQueue<Note>(onFlush);

    queue.schedule("note-a", { title: "Draft A" }, 500);
    queue.schedule("note-b", { title: "Draft B" }, 500);

    await queue.flush("note-a", { content: "Final A" });

    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush).toHaveBeenCalledWith("note-a", {
      title: "Draft A",
      content: "Final A",
    });
    expect(queue.hasPending("note-a")).toBe(false);
    expect(queue.hasPending("note-b")).toBe(true);
  });

  it("flushes all pending notes on flushAll", async () => {
    const onFlush = vi.fn();
    const queue = createDebouncedSaveQueue<Note>(onFlush);

    queue.schedule("note-a", { title: "A" }, 500);
    queue.schedule("note-b", { title: "B" }, 500);

    await queue.flushAll();

    expect(onFlush).toHaveBeenCalledTimes(2);
    expect(queue.hasPending()).toBe(false);
  });

  it("cancels a deleted note's pending timer so it is never re-saved", () => {
    const onFlush = vi.fn();
    const queue = createDebouncedSaveQueue<Note>(onFlush);

    queue.schedule("note-a", { content: "Soon deleted" }, 500);
    queue.cancel("note-a");
    vi.advanceTimersByTime(1000);

    expect(onFlush).not.toHaveBeenCalled();
  });
});
