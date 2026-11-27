import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Star,
  Folder,
  FolderOpen,
  FolderPlus,
  FileText,
  FilePlus,
  Trash2,
  X,
  Sun,
  Moon,
  User as UserIcon,
  ChevronRight,
  ChevronDown,
  ChevronsDownUp,
  Hash,
} from "lucide-react";
import { Note } from "../types/note";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  FolderTreeNode,
  buildFolderTree,
  getAncestorPaths,
  normalizeFolderPath,
} from "../utils/folders";
import { sortNotes } from "../utils/notes";
import memoLogo from "../assets/MEMO.png";

const EXPANDED_FOLDERS_STORAGE_KEY = "memoflow_expanded_folders_v1";

function readExpandedFolders(): Set<string> {
  try {
    const raw = localStorage.getItem(EXPANDED_FOLDERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return new Set(parsed.map((p) => String(p).toLowerCase()));
      }
    }
  } catch {
    // ignore storage errors
  }
  return new Set(["general", "study"]);
}

function saveExpandedFolders(set: Set<string>): void {
  try {
    localStorage.setItem(
      EXPANDED_FOLDERS_STORAGE_KEY,
      JSON.stringify(Array.from(set)),
    );
  } catch {
    // ignore storage errors
  }
}

interface NavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notes: Note[];
  activeNoteId: string | null;
  allFolders: string[];
  allTags: string[];
  onSelectNote: (noteId: string) => void;
  onCreateNote: (folder?: string) => void;
  onDeleteNote: (noteId: string, e: React.MouseEvent) => void;
  onTogglePin: (noteId: string, e: React.MouseEvent) => void;
  onAddFolder: (folderName: string) => boolean;
  onRequestDeleteFolder: (folderName: string, count: number) => void;
  onOpenCommandPalette: () => void;
  onOpenAuth: () => void;
}

type DrawerTab = "explorer" | "pinned";

export const NavigationDrawer: React.FC<NavigationDrawerProps> = ({
  isOpen,
  onClose,
  notes,
  activeNoteId,
  allFolders,
  allTags,
  onSelectNote,
  onCreateNote,
  onDeleteNote,
  onTogglePin,
  onAddFolder,
  onRequestDeleteFolder,
  onOpenCommandPalette,
  onOpenAuth,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<DrawerTab>("explorer");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showTags, setShowTags] = useState(false);
  const [expandedFolders, setExpandedFolders] =
    useState<Set<string>>(readExpandedFolders);

  // Inline folder creation: "" means root folder, "Study/Math" means subfolder inside Study/Math, null means closed
  const [creatingUnderPath, setCreatingUnderPath] = useState<string | null>(
    null,
  );
  const [newFolderSegment, setNewFolderSegment] = useState("");

  // Sync open/closed state with native modal <dialog>
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // Auto-expand ancestors of the active note when opening the drawer
  useEffect(() => {
    if (!isOpen || !activeNoteId) return;
    const active = notes.find((n) => n.id === activeNoteId);
    if (!active) return;

    const folderPath = normalizeFolderPath(active.folder) || "General";
    const toExpand = [folderPath, ...getAncestorPaths(folderPath)].map((p) =>
      p.toLowerCase(),
    );

    setExpandedFolders((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const p of toExpand) {
        if (!next.has(p)) {
          next.add(p);
          changed = true;
        }
      }
      if (changed) saveExpandedFolders(next);
      return changed ? next : prev;
    });
  }, [isOpen, activeNoteId, notes]);

  // Notes filtered by optional tag chip
  const visibleNotes = useMemo(() => {
    if (!selectedTag) return notes;
    const target = selectedTag.toLowerCase();
    return notes.filter((n) =>
      (n.tags || []).some((t) => t.toLowerCase() === target),
    );
  }, [notes, selectedTag]);

  const folderTree = useMemo(
    () => buildFolderTree(allFolders, visibleNotes),
    [allFolders, visibleNotes],
  );

  const pinnedNotes = useMemo(
    () => sortNotes(visibleNotes.filter((n) => n.isPinned)),
    [visibleNotes],
  );

  const toggleFolderExpanded = (path: string) => {
    const key = path.toLowerCase();
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      saveExpandedFolders(next);
      return next;
    });
  };

  const expandFolder = (path: string) => {
    const toExpand = [path, ...getAncestorPaths(path)].map((p) =>
      p.toLowerCase(),
    );
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      for (const p of toExpand) next.add(p);
      saveExpandedFolders(next);
      return next;
    });
  };

  const handleCollapseAll = () => {
    const empty = new Set<string>();
    setExpandedFolders(empty);
    saveExpandedFolders(empty);
  };

  const startCreatingFolder = (parentPath: string) => {
    setActiveTab("explorer");
    if (parentPath) {
      expandFolder(parentPath);
    }
    setCreatingUnderPath(parentPath);
    setNewFolderSegment("");
  };

  const handleCreateFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const segment = newFolderSegment.trim();
    if (!segment || creatingUnderPath === null) return;

    const fullPath = creatingUnderPath
      ? `${creatingUnderPath}/${segment}`
      : segment;
    const normalized = normalizeFolderPath(fullPath);
    if (normalized) {
      onAddFolder(normalized);
      expandFolder(normalized);
    }
    setCreatingUnderPath(null);
    setNewFolderSegment("");
  };

  const handleSelectNoteAndClose = (id: string) => {
    onSelectNote(id);
    onClose();
  };

  const handleCreateNoteInFolder = (folder?: string) => {
    onCreateNote(folder);
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  const renderInlineFolderInput = (depth: number) => (
    <form
      onSubmit={handleCreateFolderSubmit}
      style={{ paddingLeft: `${12 + depth * 14}px` }}
      className="pr-3 py-1 flex items-center gap-1.5"
    >
      <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
      <input
        id="explorer-new-folder-input"
        type="text"
        autoFocus
        placeholder={creatingUnderPath ? "Subfolder name…" : "Folder name…"}
        value={newFolderSegment}
        onChange={(e) => setNewFolderSegment(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            setCreatingUnderPath(null);
          }
        }}
        onBlur={() => {
          if (!newFolderSegment.trim()) setCreatingUnderPath(null);
        }}
        className="flex-1 min-w-0 text-xs px-2 py-1 rounded bg-white dark:bg-[#222220] border border-amber-500/70 text-[#1C1917] dark:text-[#EDEDEB] outline-hidden"
      />
    </form>
  );

  const renderTreeNode = (node: FolderTreeNode) => {
    const isExpanded = expandedFolders.has(node.path.toLowerCase());
    const isGeneral = node.path.toLowerCase() === "general";
    const isAddingChildHere = creatingUnderPath === node.path;

    return (
      <div key={node.path}>
        {/* Folder Row */}
        <div
          style={{ paddingLeft: `${8 + node.depth * 14}px` }}
          className="group pr-2 py-1 flex items-center gap-1 rounded-md mx-1.5 hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors select-none"
        >
          <button
            type="button"
            onClick={() => toggleFolderExpanded(node.path)}
            aria-expanded={isExpanded}
            className="flex items-center gap-1.5 flex-1 min-w-0 py-0.5 text-left cursor-pointer"
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-[#78716C] dark:text-[#8A8985] shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-[#78716C] dark:text-[#8A8985] shrink-0" />
            )}
            {isExpanded ? (
              <FolderOpen className="w-3.5 h-3.5 text-[#78716C] dark:text-[#8A8985] shrink-0" />
            ) : (
              <Folder className="w-3.5 h-3.5 text-[#78716C] dark:text-[#8A8985] shrink-0" />
            )}
            <span className="text-[13px] font-medium truncate">
              {node.name}
            </span>
            <span className="text-[10px] font-mono text-[#78716C]/70 dark:text-[#8A8985]/70 ml-0.5 shrink-0">
              {node.totalNoteCount}
            </span>
          </button>

          {/* VS Code-style hover actions: New Note, New Subfolder, Delete */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCreateNoteInFolder(node.path);
              }}
              title={`New note in ${node.name}`}
              aria-label={`New note in ${node.name}`}
              className="p-1 rounded text-[#78716C] hover:text-[#1C1917] dark:hover:text-[#EDEDEB] hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
            >
              <FilePlus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                startCreatingFolder(node.path);
              }}
              title={`New subfolder in ${node.name}`}
              aria-label={`New subfolder in ${node.name}`}
              className="p-1 rounded text-[#78716C] hover:text-[#1C1917] dark:hover:text-[#EDEDEB] hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
            {!isGeneral && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                  onRequestDeleteFolder(node.path, node.totalNoteCount);
                }}
                title={`Delete folder "${node.path}"`}
                aria-label={`Delete folder ${node.path}`}
                className="p-1 rounded text-[#78716C] hover:text-rose-500 hover:bg-rose-500/10 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Expanded Children & Notes */}
        {isExpanded && (
          <div className="relative">
            {/* Subtle vertical indent guide */}
            <div
              style={{ left: `${20 + node.depth * 14}px` }}
              className="pointer-events-none absolute top-0 bottom-1 w-px bg-[#E7E5E0]/80 dark:bg-[#282825]"
            />

            {isAddingChildHere && renderInlineFolderInput(node.depth + 1)}

            {node.children.map((child) => renderTreeNode(child))}

            {node.notes.map((note) => {
              const isActive = note.id === activeNoteId;
              return (
                <div
                  key={note.id}
                  style={{ paddingLeft: `${24 + node.depth * 14}px` }}
                  onClick={() => handleSelectNoteAndClose(note.id)}
                  className={`group pr-2 py-1.5 mx-1.5 rounded-md flex items-center justify-between gap-1.5 cursor-pointer transition-colors ${
                    isActive
                      ? "bg-[#ECE8DE] dark:bg-[#262622] text-[#1C1917] dark:text-[#EDEDEB] font-medium"
                      : "text-[#57534E] dark:text-[#B8B6B0] hover:bg-black/[0.035] dark:hover:bg-white/[0.04] hover:text-[#1C1917] dark:hover:text-[#EDEDEB]"
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <FileText className="w-3.5 h-3.5 opacity-60 shrink-0" />
                    <span className="text-[13px] truncate">
                      {note.title || "Untitled Note"}
                    </span>
                  </div>

                  <div className="flex items-center gap-0.5 shrink-0">
                    {note.isPinned && (
                      <Star className="w-3 h-3 fill-amber-400 text-amber-500 group-hover:hidden" />
                    )}
                    <button
                      type="button"
                      onClick={(e) => onTogglePin(note.id, e)}
                      title={note.isPinned ? "Unpin" : "Pin"}
                      className="hidden group-hover:inline-flex p-1 rounded text-[#78716C] hover:text-amber-500 cursor-pointer"
                    >
                      <Star
                        className={`w-3 h-3 ${note.isPinned ? "fill-amber-400 text-amber-500" : ""}`}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                        onDeleteNote(note.id, e);
                      }}
                      title="Delete note"
                      className="hidden group-hover:inline-flex p-1 rounded text-[#78716C] hover:text-rose-500 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}

            {node.children.length === 0 &&
              node.notes.length === 0 &&
              !isAddingChildHere && (
                <div
                  style={{ paddingLeft: `${26 + node.depth * 14}px` }}
                  className="py-1 text-[11px] italic text-[#78716C]/60 dark:text-[#8A8985]/60 select-none"
                >
                  Empty
                </div>
              )}
          </div>
        )}
      </div>
    );
  };

  return (
    <dialog
      ref={dialogRef}
      id="memoflow-navigation-drawer"
      aria-label="Notes and folders explorer"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={handleBackdropClick}
      className="paper-dialog m-0 p-0 border-0 bg-transparent max-w-none max-h-none w-screen h-[100svh] overflow-hidden"
    >
      <div
        ref={sheetRef}
        className="w-[min(21rem,86dvw)] h-full flex flex-col bg-[#FAF9F6] dark:bg-[#181816] text-[#1C1917] dark:text-[#EDEDEB] border-r border-[#E7E5E0] dark:border-[#282825] shadow-2xl"
      >
        {/* Drawer Header */}
        <div className="h-12 px-4 flex items-center justify-between border-b border-[#E7E5E0] dark:border-[#282825] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <img src={memoLogo} alt="MemoFlow" className="w-6 h-6 rounded" />
            <span className="font-semibold text-sm tracking-tight truncate">
              MemoFlow
            </span>
          </div>

          <button
            id="drawer-close-btn"
            type="button"
            onClick={onClose}
            aria-label="Close navigation drawer"
            className="p-1.5 rounded-lg text-[#78716C] dark:text-[#8A8985] hover:text-[#1C1917] dark:hover:text-[#EDEDEB] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Search Trigger (Opens Cmd+K Palette) */}
        <div className="px-3 pt-3 pb-2 shrink-0">
          <button
            id="drawer-open-search-btn"
            type="button"
            onClick={() => {
              onClose();
              onOpenCommandPalette();
            }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-[#78716C] dark:text-[#8A8985] bg-[#F4F2EC] dark:bg-[#222220] hover:bg-[#ECE9E0] dark:hover:bg-[#2A2A27] transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5" />
              <span>Search notes &amp; actions…</span>
            </span>
            <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Explorer Toolbar (Tabs + VS Code Action Icons) */}
        <div className="px-3 pb-2 border-b border-[#E7E5E0] dark:border-[#282825] space-y-2 shrink-0">
          <div className="flex items-center justify-between gap-1">
            <div className="inline-flex items-center gap-1">
              <button
                id="drawer-tab-explorer"
                type="button"
                onClick={() => setActiveTab("explorer")}
                className={`px-2 py-1 rounded-md text-[11px] font-medium uppercase tracking-wider transition-colors cursor-pointer ${
                  activeTab === "explorer"
                    ? "bg-[#ECE8DE] dark:bg-[#262622] text-[#1C1917] dark:text-[#EDEDEB]"
                    : "text-[#78716C] dark:text-[#8A8985] hover:text-[#1C1917] dark:hover:text-[#EDEDEB]"
                }`}
              >
                Explorer
              </button>
              <button
                id="drawer-tab-pinned"
                type="button"
                onClick={() => setActiveTab("pinned")}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium uppercase tracking-wider transition-colors cursor-pointer ${
                  activeTab === "pinned"
                    ? "bg-[#ECE8DE] dark:bg-[#262622] text-[#1C1917] dark:text-[#EDEDEB]"
                    : "text-[#78716C] dark:text-[#8A8985] hover:text-[#1C1917] dark:hover:text-[#EDEDEB]"
                }`}
              >
                <Star className="w-3 h-3" />
                <span>Pinned</span>
              </button>
            </div>

            <div className="flex items-center gap-0.5">
              <button
                id="drawer-create-note-btn"
                type="button"
                onClick={() => handleCreateNoteInFolder()}
                title="New note (⌘N)"
                aria-label="New note"
                className="p-1.5 rounded-md text-[#78716C] dark:text-[#8A8985] hover:text-[#1C1917] dark:hover:text-[#EDEDEB] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              >
                <FilePlus className="w-3.5 h-3.5" />
              </button>
              <button
                id="drawer-add-folder-btn"
                type="button"
                onClick={() => startCreatingFolder("")}
                title="New folder"
                aria-label="New folder"
                className="p-1.5 rounded-md text-[#78716C] dark:text-[#8A8985] hover:text-[#1C1917] dark:hover:text-[#EDEDEB] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
              {activeTab === "explorer" && (
                <button
                  id="drawer-collapse-all-btn"
                  type="button"
                  onClick={handleCollapseAll}
                  title="Collapse all folders"
                  aria-label="Collapse all folders"
                  className="p-1.5 rounded-md text-[#78716C] dark:text-[#8A8985] hover:text-[#1C1917] dark:hover:text-[#EDEDEB] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                >
                  <ChevronsDownUp className="w-3.5 h-3.5" />
                </button>
              )}
              {allTags.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowTags((v) => !v)}
                  title="Filter by tag"
                  aria-label="Filter by tag"
                  className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                    selectedTag || showTags
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                      : "text-[#78716C] dark:text-[#8A8985] hover:text-[#1C1917] dark:hover:text-[#EDEDEB] hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                >
                  <Hash className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Optional Tag Filter Bar */}
          {(showTags || selectedTag) && allTags.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap pt-0.5">
              {allTags.map((tag) => {
                const isSelected =
                  selectedTag?.toLowerCase() === tag.toLowerCase();
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedTag(isSelected ? null : tag)}
                    className={`px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-amber-500/20 text-amber-800 dark:text-amber-300 font-medium"
                        : "bg-black/5 dark:bg-white/5 text-[#78716C] dark:text-[#8A8985] hover:text-[#1C1917] dark:hover:text-[#EDEDEB]"
                    }`}
                  >
                    #{tag}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Main Scrollable Explorer Tree or Pinned List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar py-2">
          {activeTab === "explorer" ? (
            <div className="space-y-0.5">
              {creatingUnderPath === "" && renderInlineFolderInput(0)}
              {folderTree.map((rootNode) => renderTreeNode(rootNode))}
            </div>
          ) : pinnedNotes.length === 0 ? (
            <div className="px-6 py-12 text-center text-xs text-[#78716C] dark:text-[#8A8985]">
              No pinned notes yet.
            </div>
          ) : (
            <div className="space-y-0.5">
              {pinnedNotes.map((note) => {
                const isActive = note.id === activeNoteId;
                return (
                  <div
                    key={note.id}
                    onClick={() => handleSelectNoteAndClose(note.id)}
                    className={`group mx-1.5 px-3 py-2 rounded-md flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                      isActive
                        ? "bg-[#ECE8DE] dark:bg-[#262622] text-[#1C1917] dark:text-[#EDEDEB]"
                        : "hover:bg-black/[0.035] dark:hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-500 shrink-0" />
                        <span className="text-[13px] font-medium truncate">
                          {note.title || "Untitled Note"}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#78716C] dark:text-[#8A8985] truncate pl-4.5 mt-0.5">
                        {note.folder.replace(/\//g, " / ")}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quiet Footer: Account + Theme Toggle */}
        <div className="p-3 border-t border-[#E7E5E0] dark:border-[#282825] flex items-center gap-2 shrink-0">
          <button
            id="drawer-account-btn"
            type="button"
            onClick={() => {
              onClose();
              onOpenAuth();
            }}
            className="flex-1 min-w-0 flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-full bg-[#ECE9E0] dark:bg-[#2A2A27] flex items-center justify-center text-[11px] font-semibold shrink-0">
                {user?.email ? (
                  user.email[0].toUpperCase()
                ) : (
                  <UserIcon className="w-3.5 h-3.5 text-[#78716C] dark:text-[#8A8985]" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium truncate">
                  {user?.email || "Local Workspace"}
                </div>
                <div className="text-[10px] text-[#78716C] dark:text-[#8A8985] truncate">
                  {user ? "Cloud synced" : "Sign in to sync"}
                </div>
              </div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-[#78716C] shrink-0" />
          </button>

          <button
            id="drawer-theme-toggle-btn"
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className="p-2 rounded-lg text-[#78716C] dark:text-[#8A8985] hover:text-[#1C1917] dark:hover:text-[#EDEDEB] hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0 cursor-pointer"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </dialog>
  );
};
