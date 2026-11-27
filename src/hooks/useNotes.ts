import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import { Note, SyncStatus, NoteFilter } from "../types/note";
import { useAuth } from "../context/AuthContext";
import { parseSearchQuery } from "../utils/searchUtils";
import { deduplicateNotes, filterNotes, sortNotes } from "../utils/notes";
import {
  DEFAULT_FOLDERS,
  addFolderToList,
  buildFolderList,
  hasFolder,
  isFolderOrDescendant,
  normalizeFolderPath,
  removeFolderFromList,
  selectNotesInFolder,
} from "../utils/folders";
import { migrateLocalNotes } from "../utils/migration";
import {
  createDebouncedSaveQueue,
  DebouncedSaveQueue,
} from "../utils/saveQueue";
import { INITIAL_WELCOME_NOTE } from "../utils/welcomeNote";

const LOCAL_STORAGE_KEY = "memoflow_local_notes_v1";
const FOLDERS_STORAGE_KEY = "memoflow_custom_folders_v1";

function getStoredFolders(): string[] {
  try {
    const raw = localStorage.getItem(FOLDERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Failed to load folders from storage:", e);
  }
  return DEFAULT_FOLDERS;
}

// Helper: load guest notes from localStorage
function getLocalGuestNotes(): Note[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return deduplicateNotes(parsed);
      }
    }
  } catch (err) {
    console.warn("Failed to parse local notes:", err);
  }

  // Seed default guest note
  const now = Date.now();
  const initialNote: Note = {
    ...INITIAL_WELCOME_NOTE,
    id: "local_welcome_" + now.toString(36),
    createdAt: now,
    updatedAt: now,
    userId: "guest",
  };
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([initialNote]));
  } catch (e) {
    // Ignore localStorage quota errors
  }
  return [initialNote];
}

function saveLocalGuestNotes(notesList: Note[]): void {
  try {
    localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify(deduplicateNotes(notesList)),
    );
  } catch (e) {
    console.warn("Failed to save to localStorage:", e);
  }
}

export function useNotes() {
  const { user, loading: authLoading } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isMigrating, setIsMigrating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("saved");
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);

  // Online / Offline tracking
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setSyncStatus("saved");
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus("offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Filter state
  const [filter, setFilter] = useState<NoteFilter>({
    folder: "all",
    tag: null,
    onlyPinned: false,
    searchQuery: "",
  });

  // Track folders list with persistent storage
  const [folderList, setFolderList] = useState<string[]>(getStoredFolders);

  // Per-note debounced save queue & active note tracking
  const executeSaveRef = useRef<
    (noteId: string, updates: Partial<Note>) => Promise<void>
  >(async () => {});
  const saveQueueRef = useRef<DebouncedSaveQueue<Note> | null>(null);
  if (!saveQueueRef.current) {
    saveQueueRef.current = createDebouncedSaveQueue<Note>((id, updates) =>
      executeSaveRef.current(id, updates),
    );
  }
  const activeNoteIdRef = useRef<string | null>(activeNoteId);
  activeNoteIdRef.current = activeNoteId;
  const isMigratingRef = useRef<boolean>(false);

  // Synchronize with Firestore (if user signed in) OR localStorage (if guest)
  useEffect(() => {
    // Wait until Firebase Auth finishes loading to avoid accidental guest seeding
    if (authLoading) {
      return;
    }

    if (!user) {
      // Guest / Local mode
      const localNotes = getLocalGuestNotes();
      setNotes(localNotes);
      setActiveNoteId((prev) => {
        if (prev && localNotes.some((n) => n.id === prev)) {
          return prev;
        }
        return localNotes.length > 0 ? localNotes[0].id : null;
      });
      setLoading(false);
      setSyncStatus("saved");
      return;
    }

    // Authenticated user with Firestore
    setLoading(true);
    setError(null);

    // If there were local guest notes, migrate them to Firestore once.
    // The local copy is cleared only after every write succeeds, so a failed
    // migration keeps the notes in the browser for the next sign-in.
    const migrateGuestNotes = async () => {
      if (isMigratingRef.current) return;

      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) return;

      isMigratingRef.current = true;
      setIsMigrating(true);
      const notesCol = collection(db, "notes");

      try {
        const result = await migrateLocalNotes({
          raw,
          writeNote: (note) => {
            const newRef = doc(notesCol); // unique ID
            return setDoc(newRef, {
              ...note,
              id: newRef.id,
              userId: user.uid,
              updatedAt: Date.now(),
            });
          },
          removeLocalCopy: () => localStorage.removeItem(LOCAL_STORAGE_KEY),
        });

        if (result.keptLocalCopy) {
          setError(
            "Some notes from your local workspace could not be synced yet. They are still stored in this browser and will retry on your next sign-in.",
          );
        }
      } finally {
        isMigratingRef.current = false;
        setIsMigrating(false);
      }
    };

    migrateGuestNotes();

    const notesColRef = collection(db, "notes");
    const q = query(notesColRef, where("userId", "==", user.uid));

    // Real-time onSnapshot listener with automatic deduplication
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedNotes: Note[] = [];
        const seenIds = new Set<string>();

        snapshot.forEach((docSnapshot) => {
          if (seenIds.has(docSnapshot.id)) return;
          seenIds.add(docSnapshot.id);

          const data = docSnapshot.data();
          fetchedNotes.push({
            id: docSnapshot.id,
            title: data.title || "Untitled Note",
            content: data.content ?? "",
            tags: Array.isArray(data.tags) ? data.tags : [],
            folder: data.folder || "General",
            isPinned: Boolean(data.isPinned),
            updatedAt:
              typeof data.updatedAt === "number" ? data.updatedAt : Date.now(),
            createdAt:
              typeof data.createdAt === "number" ? data.createdAt : Date.now(),
            userId: data.userId || user.uid,
          });
        });

        // Pinned first, then most recently updated, then collapse duplicates
        const deduped = deduplicateNotes(sortNotes(fetchedNotes));
        setNotes(deduped);
        setLoading(false);

        // If no active note is selected, or active note was deleted, select first available
        setActiveNoteId((prev) => {
          if (prev && deduped.some((n) => n.id === prev)) {
            return prev;
          }
          return deduped.length > 0 ? deduped[0].id : null;
        });

        if (!navigator.onLine) {
          setSyncStatus("offline");
        } else {
          setSyncStatus("saved");
        }
      },
      (err) => {
        console.error("Firestore onSnapshot error:", err);
        setError(err.message || "Failed to fetch notes in real-time.");
        setSyncStatus("error");
        setLoading(false);
      },
    );

    return () => {
      unsubscribe();
      saveQueueRef.current?.cancelAll();
    };
  }, [user, authLoading]);

  // Execute actual persistence (Firestore or localStorage)
  const executeSave = useCallback(
    async (noteId: string, updates: Partial<Note>) => {
      try {
        if (!navigator.onLine) {
          setSyncStatus("offline");
        } else {
          setSyncStatus("saving");
        }

        const dataToSave = {
          ...updates,
          updatedAt: Date.now(),
        };

        // Always update React state optimistically
        setNotes((prevNotes) =>
          deduplicateNotes(
            prevNotes.map((n) =>
              n.id === noteId ? { ...n, ...dataToSave } : n,
            ),
          ),
        );

        if (user) {
          // Cloud Firestore update using setDoc with merge: true to avoid document missing errors
          const noteDocRef = doc(db, "notes", noteId);
          await setDoc(noteDocRef, dataToSave, { merge: true });
        } else {
          // Local storage update
          setNotes((curr) => {
            const updated = curr.map((n) =>
              n.id === noteId ? { ...n, ...dataToSave } : n,
            );
            saveLocalGuestNotes(updated);
            return updated;
          });
        }

        if (navigator.onLine) {
          setSyncStatus("saved");
        } else {
          setSyncStatus("offline");
        }
      } catch (err: any) {
        console.error("Error saving note:", err);
        setError(err.message || "Error saving note");
        setSyncStatus("error");
      }
    },
    [user],
  );

  // Keep queue flush callback pointed at the latest executeSave
  executeSaveRef.current = executeSave;

  // Flush pending edits when the tab is hidden or the page is unloading
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        void saveQueueRef.current?.flushAll();
      }
    };
    const handleBeforeUnload = () => {
      void saveQueueRef.current?.flushAll();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // Select a note, flushing any unsaved debounced edits for the previous note first
  const selectNote = useCallback((nextNoteId: string | null) => {
    const prevNoteId = activeNoteIdRef.current;
    if (prevNoteId && prevNoteId !== nextNoteId) {
      void saveQueueRef.current?.flush(prevNoteId);
    }
    setActiveNoteId(nextNoteId);
  }, []);

  // Auto-save with per-note 500ms debounce
  const updateNote = useCallback(
    (noteId: string, updates: Partial<Note>, debounceMs: number = 500) => {
      // Immediately reflect changes in local state for instantaneous typing responsiveness
      setNotes((prev) =>
        prev.map((n) =>
          n.id === noteId ? { ...n, ...updates, updatedAt: Date.now() } : n,
        ),
      );

      setSyncStatus(navigator.onLine ? "saving" : "offline");
      saveQueueRef.current?.schedule(noteId, updates, debounceMs);
    },
    [],
  );

  // Immediate save (e.g. on Cmd+S or note switch)
  const saveNoteImmediate = useCallback(
    async (noteId: string, updates?: Partial<Note>) => {
      await saveQueueRef.current?.flush(noteId, updates);
    },
    [],
  );

  // Create a new note
  const createNote = useCallback(
    async (initialData?: Partial<Note>): Promise<string | null> => {
      try {
        setSyncStatus("saving");

        if (user) {
          // Cloud Firestore create
          const notesColRef = collection(db, "notes");
          const newDocRef = doc(notesColRef); // unique ID

          const newNote: Note = {
            id: newDocRef.id,
            title: initialData?.title?.trim() || "Untitled Note",
            content:
              initialData?.content ??
              "# Welcome to MemoFlow\n\nStart typing Markdown here...",
            tags: initialData?.tags || ["general"],
            folder:
              initialData?.folder ||
              (filter.folder !== "all" ? filter.folder : "General"),
            isPinned: initialData?.isPinned ?? false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            userId: user.uid,
          };

          await setDoc(newDocRef, newNote);

          // Optimistically add while guarding against duplicate insertion
          setNotes((prev) => {
            if (prev.some((n) => n.id === newNote.id)) {
              return prev;
            }
            return [newNote, ...prev];
          });
          setActiveNoteId(newNote.id);
          setSyncStatus("saved");
          return newNote.id;
        } else {
          // Guest / Local create
          const localId =
            "note_" +
            Date.now().toString(36) +
            "_" +
            Math.random().toString(36).substring(2, 6);
          const newNote: Note = {
            id: localId,
            title: initialData?.title?.trim() || "Untitled Note",
            content:
              initialData?.content ??
              "# Welcome to MemoFlow\n\nStart typing Markdown here...",
            tags: initialData?.tags || ["general"],
            folder:
              initialData?.folder ||
              (filter.folder !== "all" ? filter.folder : "General"),
            isPinned: initialData?.isPinned ?? false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            userId: "guest",
          };

          setNotes((prev) => {
            const nextList = [
              newNote,
              ...prev.filter((n) => n.id !== newNote.id),
            ];
            saveLocalGuestNotes(nextList);
            return nextList;
          });
          setActiveNoteId(newNote.id);
          setSyncStatus("saved");
          return newNote.id;
        }
      } catch (err: any) {
        console.error("Error creating note:", err);
        setError(err.message || "Failed to create note.");
        setSyncStatus("error");
        return null;
      }
    },
    [user, filter.folder],
  );

  // Delete note
  const deleteNote = useCallback(
    async (noteId: string) => {
      try {
        saveQueueRef.current?.cancel(noteId);
        setSyncStatus("saving");

        if (user) {
          const noteDocRef = doc(db, "notes", noteId);
          await deleteDoc(noteDocRef);
        }

        setNotes((prev) => {
          const remaining = prev.filter((n) => n.id !== noteId);
          if (!user) {
            saveLocalGuestNotes(remaining);
          }
          if (activeNoteId === noteId) {
            setActiveNoteId(remaining.length > 0 ? remaining[0].id : null);
          }
          return remaining;
        });

        setSyncStatus("saved");
      } catch (err: any) {
        console.error("Error deleting note:", err);
        setError(err.message || "Failed to delete note.");
        setSyncStatus("error");
      }
    },
    [user, activeNoteId],
  );

  // Toggle pinned status
  const togglePin = useCallback(
    async (noteId: string) => {
      const targetNote = notes.find((n) => n.id === noteId);
      if (!targetNote) return;

      const newPinned = !targetNote.isPinned;
      await executeSave(noteId, { isPinned: newPinned });
    },
    [notes, executeSave],
  );

  // Aggregate tags from all existing notes (case-normalized, unique)
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    notes.forEach((n) => {
      if (Array.isArray(n.tags)) {
        n.tags.forEach((t) => {
          if (typeof t === "string" && t.trim()) {
            tagSet.add(t.trim().toLowerCase());
          }
        });
      }
    });
    return Array.from(tagSet).sort();
  }, [notes]);

  // Aggregate folders: General first, then stored folders and folders in use
  const allFolders = useMemo(
    () => buildFolderList(folderList, notes),
    [folderList, notes],
  );

  // Add custom folder (supports nested paths like "Study/Math")
  const addFolder = useCallback(
    (folderName: string): boolean => {
      const normalized = normalizeFolderPath(folderName);
      if (!normalized || hasFolder(allFolders, normalized)) {
        return false;
      }

      setFolderList((prev) => {
        const next = addFolderToList(prev, normalized);
        try {
          localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(next));
        } catch (e) {
          console.warn("Failed to save folders list:", e);
        }
        return next;
      });
      return true;
    },
    [allFolders],
  );

  // Delete folder (and any nested subfolders) & safely migrate notes to 'General'
  const deleteFolder = useCallback(
    async (folderToDelete: string): Promise<number> => {
      const normalized = normalizeFolderPath(folderToDelete);
      if (!normalized || normalized.toLowerCase() === "general") {
        // Prevent deleting root fallback folder
        return 0;
      }

      // Find affected notes (including notes in nested subfolders)
      const affected = selectNotesInFolder(notes, normalized);

      // Reassign affected notes to 'General'
      if (affected.length > 0) {
        const previousNotes = notes;
        const now = Date.now();
        const updatedNotes = notes.map((n) =>
          isFolderOrDescendant(n.folder, normalized)
            ? { ...n, folder: "General", updatedAt: now }
            : n,
        );

        setNotes(updatedNotes);

        if (user) {
          try {
            // Firestore writeBatch supports up to 500 writes per batch
            const BATCH_LIMIT = 500;
            for (let i = 0; i < affected.length; i += BATCH_LIMIT) {
              const batch = writeBatch(db);
              const chunk = affected.slice(i, i + BATCH_LIMIT);
              for (const n of chunk) {
                batch.update(doc(db, "notes", n.id), {
                  folder: "General",
                  updatedAt: now,
                });
              }
              await batch.commit();
            }
          } catch (err: unknown) {
            console.error("Failed to move notes to General in Firestore:", err);
            setNotes(previousNotes);
            const message =
              err instanceof Error
                ? err.message
                : "Failed to move notes to General.";
            setError(message);
            setSyncStatus("error");
            return 0;
          }
        } else {
          saveLocalGuestNotes(updatedNotes);
        }
      }

      // Remove from folderList
      setFolderList((prev) => {
        const next = removeFolderFromList(prev, folderToDelete);
        try {
          localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(next));
        } catch (e) {
          console.warn("Failed to save folders after delete:", e);
        }
        return next;
      });

      // If active filter was this folder or a descendant, reset to 'all'
      setFilter((prev) => {
        if (
          prev.folder !== "all" &&
          isFolderOrDescendant(prev.folder, normalized)
        ) {
          return { ...prev, folder: "all" };
        }
        return prev;
      });

      return affected.length;
    },
    [notes, user],
  );

  // Parse search query into structured tags, folders, and keyword terms
  const parsedSearch = useMemo(() => {
    return parseSearchQuery(filter.searchQuery);
  }, [filter.searchQuery]);

  // Filtered notes: folder, tag, pin and search filters applied
  const filteredNotes = useMemo(
    () => filterNotes(notes, filter, parsedSearch),
    [notes, filter, parsedSearch],
  );

  // Active note object
  const activeNote = useMemo(() => {
    return notes.find((n) => n.id === activeNoteId) || null;
  }, [notes, activeNoteId]);

  const clearError = useCallback(() => setError(null), []);

  return {
    notes,
    filteredNotes,
    parsedSearch,
    activeNote,
    activeNoteId,
    setActiveNoteId: selectNote,
    loading,
    isMigrating,
    error,
    syncStatus,
    isOnline,
    filter,
    setFilter,
    allTags,
    allFolders,
    addFolder,
    deleteFolder,
    createNote,
    updateNote,
    saveNoteImmediate,
    deleteNote,
    togglePin,
    clearError,
  };
}
