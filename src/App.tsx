import React, { useState, useEffect, useCallback } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { useNotes } from "./hooks/useNotes";
import {
  EditorView,
  EditorViewMode,
  downloadNoteAsMarkdown,
} from "./components/EditorView";
import { NavigationDrawer } from "./components/NavigationDrawer";
import { CommandPalette } from "./components/CommandPalette";
import { AuthModal } from "./components/AuthModal";
import {
  ConfirmDeleteModal,
  DeleteTarget,
} from "./components/ConfirmDeleteModal";
import { WifiOff, AlertCircle } from "lucide-react";
import { INITIAL_WELCOME_NOTE } from "./utils/welcomeNote";

function MemoFlowWorkspace() {
  const { user, loading: authLoading } = useAuth();
  const {
    notes,
    activeNote,
    activeNoteId,
    setActiveNoteId,
    loading: notesLoading,
    isMigrating,
    error: notesError,
    syncStatus,
    isOnline,
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
  } = useNotes();

  const [viewMode, setViewMode] = useState<EditorViewMode>("editor");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const welcomeSeededRef = React.useRef(false);

  // Seed initial welcome note if signed-in user has zero notes after auth, notes, and migration finish
  useEffect(() => {
    if (
      !notesLoading &&
      !authLoading &&
      !isMigrating &&
      user &&
      notes.length === 0 &&
      !welcomeSeededRef.current
    ) {
      welcomeSeededRef.current = true;
      void createNote(INITIAL_WELCOME_NOTE);
    }
  }, [notesLoading, authLoading, isMigrating, user, notes.length, createNote]);

  const handleTogglePreview = useCallback(() => {
    setViewMode((prev) => (prev === "preview" ? "editor" : "preview"));
  }, []);

  const handleCreateNewNote = useCallback(
    async (folder?: string) => {
      await createNote(folder ? { folder } : undefined);
      setViewMode("editor");
    },
    [createNote],
  );

  // Global keyboard shortcuts: Cmd/Ctrl+K (Palette), Cmd/Ctrl+\ (Drawer), Cmd/Ctrl+N (New), Cmd/Ctrl+E (Preview)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (!isCmdOrCtrl) return;

      const key = e.key.toLowerCase();
      if (key === "k") {
        e.preventDefault();
        setIsDrawerOpen(false);
        setIsCommandPaletteOpen((prev) => !prev);
      } else if (e.key === "\\") {
        e.preventDefault();
        setIsCommandPaletteOpen(false);
        setIsDrawerOpen((prev) => !prev);
      } else if (key === "n") {
        e.preventDefault();
        void handleCreateNewNote();
      } else if (key === "e") {
        e.preventDefault();
        handleTogglePreview();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCreateNewNote, handleTogglePreview]);

  const handleRequestDeleteNote = useCallback(
    (noteId: string, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      const target = notes.find((n) => n.id === noteId);
      setDeleteTarget({
        type: "note",
        id: noteId,
        title: target?.title || "Untitled Note",
      });
    },
    [notes],
  );

  const handleRequestDeleteFolder = useCallback(
    (folderName: string, notesCount: number) => {
      setDeleteTarget({
        type: "folder",
        name: folderName,
        notesCount,
      });
    },
    [],
  );

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      if (deleteTarget.type === "note") {
        await deleteNote(deleteTarget.id);
      } else if (deleteTarget.type === "folder") {
        await deleteFolder(deleteTarget.name);
      }
      setDeleteTarget(null);
    } catch (err) {
      console.error("Failed to complete delete:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTogglePinNote = useCallback(
    async (noteId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      await togglePin(noteId);
    },
    [togglePin],
  );

  const handleExportActiveNote = useCallback(() => {
    if (!activeNote) return;
    downloadNoteAsMarkdown(activeNote.title, activeNote.content);
  }, [activeNote]);

  return (
    <div className="flex flex-col h-[100svh] w-screen overflow-hidden bg-[#FAF9F6] dark:bg-[#141413] text-[#1C1917] dark:text-[#EDEDEB]">
      {/* Subtle Offline Strip */}
      {!isOnline && (
        <div
          id="offline-banner"
          className="bg-[#1C1917] dark:bg-[#222220] text-amber-300 text-xs px-4 py-1.5 flex items-center justify-center gap-2 shrink-0"
        >
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          <span>
            Offline — edits are cached locally and will sync when reconnected.
          </span>
        </div>
      )}

      {/* Subtle Error Strip */}
      {notesError && (
        <div
          id="notes-error-banner"
          className="bg-rose-600 text-white text-xs px-4 py-1.5 flex items-center justify-between gap-2 shrink-0"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{notesError}</span>
          </div>
          <button
            type="button"
            onClick={clearError}
            className="text-white/85 hover:text-white underline text-[11px] shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 1-Pane Paper Calm Editor */}
      <EditorView
        note={activeNote}
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
        onUpdateNote={updateNote}
        onSaveImmediate={saveNoteImmediate}
        onTogglePin={togglePin}
        onDeleteNote={(id) => handleRequestDeleteNote(id)}
        onCreateNote={handleCreateNewNote}
        onOpenDrawer={() => setIsDrawerOpen(true)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        syncStatus={syncStatus}
        isCloudSynced={Boolean(user)}
        allFolders={allFolders}
        errorMessage={notesError}
      />

      {/* Slide-out Navigation Drawer (VS Code Explorer Tree) */}
      <NavigationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        notes={notes}
        activeNoteId={activeNoteId}
        allFolders={allFolders}
        allTags={allTags}
        onSelectNote={(id) => setActiveNoteId(id)}
        onCreateNote={handleCreateNewNote}
        onDeleteNote={handleRequestDeleteNote}
        onTogglePin={handleTogglePinNote}
        onAddFolder={addFolder}
        onRequestDeleteFolder={handleRequestDeleteFolder}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenAuth={() => setIsAuthModalOpen(true)}
      />

      {/* Cmd+K Command Palette & Quick Switcher */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        notes={notes}
        activeNote={activeNote}
        onSelectNote={(id) => setActiveNoteId(id)}
        onCreateNote={handleCreateNewNote}
        onTogglePreview={handleTogglePreview}
        onOpenDrawer={() => setIsDrawerOpen(true)}
        onExportActiveNote={handleExportActiveNote}
      />

      {/* Confirmation Modal for Deleting Notes & Folders */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        target={deleteTarget}
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={() => {
          if (!isDeleting) setDeleteTarget(null);
        }}
      />

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}

function AppRoot() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="h-[100svh] w-screen flex flex-col items-center justify-center bg-[#FAF9F6] dark:bg-[#141413] text-[#1C1917] dark:text-[#EDEDEB]">
        <div className="w-7 h-7 border-2 border-[#78716C]/40 border-t-[#1C1917] dark:border-t-[#EDEDEB] rounded-full animate-spin mb-3" />
        <p className="text-xs text-[#78716C] dark:text-[#8A8985]">
          Opening MemoFlow…
        </p>
      </div>
    );
  }

  return <MemoFlowWorkspace />;
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppRoot />
      </ThemeProvider>
    </AuthProvider>
  );
}
