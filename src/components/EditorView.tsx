import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { Note, SyncStatus } from "../types/note";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { toggleTaskAtIndex } from "../utils/markdown";
import memoLogo from "../assets/MEMO.png";

const EmojiPickerPopover = lazy(() => import("./EmojiPickerPopover"));
import {
  Menu,
  Search,
  Folder,
  ChevronDown,
  MoreHorizontal,
  Star,
  Copy,
  Check,
  Download,
  Trash2,
  Columns,
  Eye,
  Edit3,
  Plus,
  X,
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Code,
  List,
  ListOrdered,
  CheckSquare,
  Link as LinkIcon,
  Table,
  Type,
  Smile,
} from "lucide-react";

export type EditorViewMode = "editor" | "preview" | "split";

interface EditorViewProps {
  note: Note | null;
  viewMode: EditorViewMode;
  onChangeViewMode: (mode: EditorViewMode) => void;
  onUpdateNote: (
    noteId: string,
    updates: Partial<Note>,
    debounceMs?: number,
  ) => void;
  onSaveImmediate: (noteId: string, updates?: Partial<Note>) => void;
  onTogglePin: (noteId: string) => void;
  onDeleteNote: (noteId: string) => void;
  onCreateNote: () => void;
  onOpenDrawer: () => void;
  onOpenCommandPalette: () => void;
  syncStatus: SyncStatus;
  isCloudSynced: boolean;
  allFolders: string[];
  allTags: string[];
  errorMessage?: string | null;
}

export function downloadNoteAsMarkdown(title: string, content: string): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${(title || "note").replace(/[^a-z0-9]/gi, "_").toLowerCase()}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const EditorView: React.FC<EditorViewProps> = ({
  note,
  viewMode,
  onChangeViewMode,
  onUpdateNote,
  onSaveImmediate,
  onTogglePin,
  onDeleteNote,
  onCreateNote,
  onOpenDrawer,
  onOpenCommandPalette,
  syncStatus,
  isCloudSynced,
  allFolders,
  allTags,
  errorMessage,
}) => {
  const [copied, setCopied] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagActiveIndex, setTagActiveIndex] = useState(0);
  const [showFormatting, setShowFormatting] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [folderMenuOpen, setFolderMenuOpen] = useState(false);
  const [isChromeFaded, setIsChromeFaded] = useState(false);

  // Local mirror state for zero-lag typing
  const [localTitle, setLocalTitle] = useState("");
  const [localContent, setLocalContent] = useState("");
  const [localFolder, setLocalFolder] = useState("General");
  const [localTags, setLocalTags] = useState<string[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const scrollSourceRef = useRef<"editor" | "preview" | null>(null);
  const scrollLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const currentNoteIdRef = useRef<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const folderMenuRef = useRef<HTMLDivElement>(null);
  const tagPickerRef = useRef<HTMLDivElement>(null);
  const iconPickerRef = useRef<HTMLDivElement>(null);
  const savedSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local mirror state whenever active note changes
  useEffect(() => {
    if (note) {
      if (currentNoteIdRef.current !== note.id) {
        currentNoteIdRef.current = note.id;
        setLocalTitle(note.title);
        setLocalContent(note.content);
        setLocalFolder(note.folder);
        setLocalTags(note.tags);
        setShowTagInput(false);
        setTagInput("");
        setMenuOpen(false);
        setFolderMenuOpen(false);
      } else {
        if (
          note.title !== localTitle &&
          document.activeElement?.id !== "active-note-title-input"
        ) {
          setLocalTitle(note.title);
        }
        if (
          note.content !== localContent &&
          document.activeElement?.id !== "markdown-textarea-editor"
        ) {
          setLocalContent(note.content);
        }
        setLocalFolder(note.folder);
        setLocalTags(note.tags);
      }
    } else {
      currentNoteIdRef.current = null;
    }
  }, [note, localTitle, localContent]);

  // Collapse split view to editor-only on viewports below 1024px
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024 && viewMode === "split") {
        onChangeViewMode("editor");
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [viewMode, onChangeViewMode]);

  // Close popovers on outside click or Escape
  useEffect(() => {
    if (!menuOpen && !folderMenuOpen && !showTagInput && !iconPickerOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (
        folderMenuRef.current &&
        !folderMenuRef.current.contains(e.target as Node)
      ) {
        setFolderMenuOpen(false);
      }
      if (
        tagPickerRef.current &&
        !tagPickerRef.current.contains(e.target as Node)
      ) {
        setShowTagInput(false);
        setTagInput("");
      }
      if (
        iconPickerRef.current &&
        !iconPickerRef.current.contains(e.target as Node)
      ) {
        setIconPickerOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setFolderMenuOpen(false);
        setShowTagInput(false);
        setTagInput("");
        setIconPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen, folderMenuOpen, showTagInput, iconPickerOpen]);

  // Typing-focus fade: gently dim header/footer after 1.5s of typing, restore on pointer move
  const triggerTypingFocus = useCallback(() => {
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = setTimeout(() => {
      setIsChromeFaded(true);
    }, 1500);
  }, []);

  const restoreChrome = useCallback(() => {
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
    setIsChromeFaded(false);
  }, []);

  useEffect(() => {
    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      if (scrollLockTimerRef.current) clearTimeout(scrollLockTimerRef.current);
    };
  }, []);

  // Bidirectional proportional scroll sync for Split mode
  const syncSplitScroll = useCallback(
    (source: "editor" | "preview") => {
      if (viewMode !== "split") return;
      if (scrollSourceRef.current && scrollSourceRef.current !== source) return;

      const from =
        source === "editor" ? textareaRef.current : previewScrollRef.current;
      const to =
        source === "editor" ? previewScrollRef.current : textareaRef.current;
      if (!from || !to) return;

      const fromMax = from.scrollHeight - from.clientHeight;
      const toMax = to.scrollHeight - to.clientHeight;
      if (fromMax <= 0 || toMax <= 0) return;

      scrollSourceRef.current = source;
      const ratio = from.scrollTop / fromMax;
      to.scrollTop = ratio * toMax;

      if (scrollLockTimerRef.current) clearTimeout(scrollLockTimerRef.current);
      scrollLockTimerRef.current = setTimeout(() => {
        scrollSourceRef.current = null;
      }, 60);
    },
    [viewMode],
  );

  // Keyboard shortcut: Cmd/Ctrl+S to save immediately
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (note) {
          onSaveImmediate(note.id, {
            title: localTitle,
            content: localContent,
            folder: localFolder,
            tags: localTags,
          });
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [note, localTitle, localContent, localFolder, localTags, onSaveImmediate]);

  const handleTitleChange = (val: string) => {
    if (!note) return;
    setLocalTitle(val);
    onUpdateNote(note.id, { title: val }, 500);
    triggerTypingFocus();
  };

  const handleContentChange = (val: string) => {
    if (!note) return;
    setLocalContent(val);
    onUpdateNote(note.id, { content: val }, 500);
    triggerTypingFocus();
  };

  const handleFolderChange = (folder: string) => {
    if (!note) return;
    setLocalFolder(folder);
    onUpdateNote(note.id, { folder }, 200);
  };

  const addTagByName = (rawTag: string) => {
    if (!note) return;
    const cleanTag = rawTag.trim().toLowerCase().replace(/^#/, "");
    if (!cleanTag) return;
    const alreadyPresent = localTags.some(
      (t) => t.toLowerCase() === cleanTag,
    );
    if (!alreadyPresent) {
      const updatedTags = [...localTags, cleanTag];
      setLocalTags(updatedTags);
      onUpdateNote(note.id, { tags: updatedTags }, 200);
    }
    setTagInput("");
    setTagActiveIndex(0);
    setShowTagInput(false);
  };

  const normalizedTagQuery = tagInput.trim().toLowerCase().replace(/^#/, "");

  const tagSuggestions = (() => {
    const localLower = new Set(localTags.map((t) => t.toLowerCase()));
    const available = allTags.filter((t) => !localLower.has(t.toLowerCase()));
    if (!normalizedTagQuery) return available.slice(0, 8);
    return available
      .filter((t) => t.toLowerCase().includes(normalizedTagQuery))
      .slice(0, 8);
  })();

  const canCreateTypedTag =
    Boolean(normalizedTagQuery) &&
    !localTags.some((t) => t.toLowerCase() === normalizedTagQuery) &&
    !allTags.some((t) => t.toLowerCase() === normalizedTagQuery);

  const tagOptions: Array<{ kind: "existing" | "create"; value: string }> = [
    ...tagSuggestions.map((value) => ({ kind: "existing" as const, value })),
    ...(canCreateTypedTag
      ? [{ kind: "create" as const, value: normalizedTagQuery }]
      : []),
  ];

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (tagOptions.length > 0) {
        setTagActiveIndex((prev) => (prev + 1) % tagOptions.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (tagOptions.length > 0) {
        setTagActiveIndex(
          (prev) => (prev - 1 + tagOptions.length) % tagOptions.length,
        );
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = tagOptions[tagActiveIndex];
      if (selected) {
        addTagByName(selected.value);
      } else if (normalizedTagQuery) {
        addTagByName(normalizedTagQuery);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setShowTagInput(false);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (!note) return;
    const updatedTags = localTags.filter((t) => t !== tagToRemove);
    setLocalTags(updatedTags);
    onUpdateNote(note.id, { tags: updatedTags }, 200);
  };

  const insertFormatting = (
    prefix: string,
    suffix: string = "",
    defaultText: string = "",
    selectionOverride?: { start: number; end: number } | null,
  ) => {
    if (!note) return;
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.focus();
    const start = selectionOverride?.start ?? textarea.selectionStart;
    const end = selectionOverride?.end ?? textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end) || defaultText;
    const replacement = `${prefix}${selectedText}${suffix}`;

    // Use execCommand('insertText') so the edit is recorded on the browser's
    // native undo/redo stack (Ctrl+Z / Ctrl+Shift+Z).
    textarea.setSelectionRange(start, end);
    let insertedNatively = false;
    try {
      insertedNatively = document.execCommand("insertText", false, replacement);
    } catch {
      insertedNatively = false;
    }

    if (!insertedNatively) {
      const newContent =
        localContent.substring(0, start) +
        replacement +
        localContent.substring(end);
      setLocalContent(newContent);
      onUpdateNote(note.id, { content: newContent }, 500);
    }

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + selectedText.length,
      );
    });
  };

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(localContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Clipboard error:", err);
    }
  };

  const wordCount = localContent.trim()
    ? localContent.trim().split(/\s+/).length
    : 0;
  const readTimeMin = Math.max(1, Math.ceil(wordCount / 200));

  const syncLabel = (() => {
    const pillBase =
      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors";
    if (syncStatus === "error") {
      return {
        text: "Sync error · Retry",
        title: errorMessage || "Error syncing — click to retry",
        dotClass: "bg-rose-500",
        className: `${pillBase} bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25 hover:bg-rose-500/20 cursor-pointer`,
        clickable: true,
      };
    }
    if (syncStatus === "saving") {
      return {
        text: "Saving…",
        title: isCloudSynced ? "Saving to cloud…" : "Saving locally…",
        dotClass: "bg-amber-500 animate-pulse",
        className: `${pillBase} bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25`,
        clickable: false,
      };
    }
    if (syncStatus === "offline") {
      return {
        text: "Offline",
        title: "Offline — edits cached locally",
        dotClass: "bg-[#78716C] dark:bg-[#8A8985]",
        className: `${pillBase} bg-black/[0.04] dark:bg-white/[0.06] text-[#78716C] dark:text-[#8A8985] border-[#E7E5E0] dark:border-[#2E2E2A]`,
        clickable: false,
      };
    }
    return {
      text: isCloudSynced ? "Synced" : "Saved locally",
      title: isCloudSynced
        ? "All changes synced to cloud"
        : "Saved locally in this browser (sign in from menu to sync)",
      dotClass: "bg-emerald-500",
      className: `${pillBase} bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25`,
      clickable: false,
    };
  })();

  const renderNoteMetaRow = () => (
    <div className="flex items-center gap-2 flex-wrap mt-2.5 mb-6">
      {/* Note's Folder Picker (custom Paper Calm menu — single crisp chevron across all OS) */}
      <div ref={folderMenuRef} className="relative">
        <button
          id="note-folder-select"
          type="button"
          onClick={() => setFolderMenuOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={folderMenuOpen}
          aria-label={`Folder: ${localFolder}`}
          title={`Folder: ${localFolder.replace(/\//g, " / ")}`}
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs leading-5 font-medium text-[#57534E] dark:text-[#B8B6B0] bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.1] transition-colors cursor-pointer max-w-[220px]"
        >
          <Folder className="w-3.5 h-3.5 text-[#78716C] dark:text-[#8A8985] shrink-0" />
          <span className="truncate">{localFolder.replace(/\//g, " / ")}</span>
          <ChevronDown className="w-3 h-3 text-[#78716C] dark:text-[#8A8985] shrink-0" />
        </button>

        {folderMenuOpen && (
          <div
            role="listbox"
            aria-label="Choose folder"
            className="absolute left-0 mt-1.5 w-56 max-h-64 overflow-y-auto custom-scrollbar py-1 rounded-xl bg-[#FAF9F6] dark:bg-[#1F1F1D] border border-[#E7E5E0] dark:border-[#2E2E2A] shadow-xl z-30 text-xs"
          >
            {allFolders.map((f) => {
              const isSelected = f.toLowerCase() === localFolder.toLowerCase();
              const parts = f.split("/");
              const depth = parts.length - 1;
              const segmentName = parts[parts.length - 1];
              return (
                <button
                  key={f}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  title={f.replace(/\//g, " / ")}
                  style={{ paddingLeft: `${12 + depth * 12}px` }}
                  onClick={() => {
                    handleFolderChange(f);
                    setFolderMenuOpen(false);
                  }}
                  className="w-full pr-3 py-1.5 flex items-center justify-between gap-2 hover:bg-black/5 dark:hover:bg-white/5 text-left cursor-pointer"
                >
                  <span className="inline-flex items-center gap-2 min-w-0 flex-1">
                    <Folder className="w-3.5 h-3.5 text-[#78716C] dark:text-[#8A8985] shrink-0" />
                    <span className={`truncate ${isSelected ? "font-medium" : ""}`}>
                      {segmentName}
                    </span>
                  </span>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Note Tags */}
      {localTags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 text-xs leading-5 text-[#78716C] dark:text-[#8A8985] bg-black/[0.04] dark:bg-white/[0.06] px-2 py-0.5 rounded-md"
        >
          #{tag}
          <button
            type="button"
            onClick={() => handleRemoveTag(tag)}
            aria-label={`Remove tag ${tag}`}
            className="opacity-60 hover:opacity-100 hover:text-rose-500 cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      {showTagInput ? (
        <div ref={tagPickerRef} className="relative">
          <input
            id="add-tag-inline-input"
            type="text"
            autoFocus
            role="combobox"
            aria-expanded={tagOptions.length > 0}
            aria-autocomplete="list"
            placeholder="Search or create tag…"
            value={tagInput}
            onChange={(e) => {
              setTagInput(e.target.value);
              setTagActiveIndex(0);
            }}
            onKeyDown={handleTagInputKeyDown}
            className="text-xs leading-5 px-2 py-0.5 rounded-md bg-white dark:bg-[#222220] border border-amber-500/60 text-[#1C1917] dark:text-[#EDEDEB] outline-hidden w-36"
          />

          {tagOptions.length > 0 && (
            <div
              id="tag-suggestions-dropdown"
              role="listbox"
              aria-label="Tag suggestions"
              className="absolute left-0 mt-1.5 w-48 max-h-48 overflow-y-auto custom-scrollbar py-1 rounded-xl bg-[#FAF9F6] dark:bg-[#1F1F1D] border border-[#E7E5E0] dark:border-[#2E2E2A] shadow-xl z-30 text-xs"
            >
              {tagOptions.map((opt, idx) => {
                const isHighlighted = idx === tagActiveIndex;
                return (
                  <button
                    key={`${opt.kind}-${opt.value}`}
                    type="button"
                    role="option"
                    aria-selected={isHighlighted}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setTagActiveIndex(idx)}
                    onClick={() => addTagByName(opt.value)}
                    className={`w-full px-3 py-1.5 flex items-center gap-1.5 text-left transition-colors cursor-pointer ${
                      isHighlighted
                        ? "bg-[#EFECE4] dark:bg-[#2A2A27] text-[#1C1917] dark:text-[#EDEDEB]"
                        : "text-[#57534E] dark:text-[#B8B6B0]"
                    }`}
                  >
                    {opt.kind === "create" ? (
                      <>
                        <Plus className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span className="truncate">
                          Create <span className="font-medium">#{opt.value}</span>
                        </span>
                      </>
                    ) : (
                      <span className="truncate">#{opt.value}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <button
          id="add-tag-chip-btn"
          type="button"
          onClick={() => {
            setTagInput("");
            setTagActiveIndex(0);
            setShowTagInput(true);
          }}
          className="inline-flex items-center gap-0.5 text-xs leading-5 text-[#78716C]/70 dark:text-[#8A8985]/70 hover:text-[#1C1917] dark:hover:text-[#EDEDEB] px-1.5 py-0.5 rounded-md transition-colors cursor-pointer"
        >
          <Plus className="w-3 h-3" />
          <span>tag</span>
        </button>
      )}
    </div>
  );

  const chromeOpacityClass =
    isChromeFaded && !menuOpen
      ? "opacity-20 hover:opacity-100 focus-within:opacity-100"
      : "opacity-100";

  return (
    <div
      id="memoflow-editor-container"
      onPointerMove={isChromeFaded ? restoreChrome : undefined}
      className="flex-1 flex flex-col h-full bg-[#FAF9F6] dark:bg-[#141413] text-[#1C1917] dark:text-[#EDEDEB] overflow-hidden transition-colors"
    >
      {/* Slim 48px Single-Row Header */}
      <header
        className={`h-12 px-3 sm:px-5 flex items-center justify-between gap-2 shrink-0 border-b border-transparent transition-opacity duration-300 ${chromeOpacityClass}`}
      >
        {/* Left: Drawer + Quick Search */}
        <div className="flex items-center gap-1 min-w-0">
          <button
            id="open-drawer-btn"
            type="button"
            onClick={onOpenDrawer}
            aria-label="Open notes and folders"
            title="Notes & Folders (⌘\)"
            className="p-2 rounded-lg text-[#78716C] dark:text-[#8A8985] hover:text-[#1C1917] dark:hover:text-[#EDEDEB] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer shrink-0"
          >
            <Menu className="w-4 h-4" />
          </button>

          <button
            id="header-search-btn"
            type="button"
            onClick={onOpenCommandPalette}
            aria-label="Search notes and commands"
            title="Quick switcher (⌘K)"
            className="p-2 rounded-lg text-[#78716C] dark:text-[#8A8985] hover:text-[#1C1917] dark:hover:text-[#EDEDEB] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer shrink-0"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Mode Toggle + Overflow Menu */}
        {note && (
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Segmented Mode Switch */}
            <div className="inline-flex items-center p-0.5 rounded-lg bg-[#F0EDE5] dark:bg-[#1F1F1D] text-xs">
              <button
                id="view-mode-editor-btn"
                type="button"
                onClick={() => onChangeViewMode("editor")}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  viewMode === "editor"
                    ? "bg-[#FAF9F6] dark:bg-[#2B2B28] text-[#1C1917] dark:text-[#EDEDEB] font-medium shadow-2xs"
                    : "text-[#78716C] dark:text-[#8A8985] hover:text-[#1C1917] dark:hover:text-[#EDEDEB]"
                }`}
                title="Write mode"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Write</span>
              </button>

              <button
                id="view-mode-preview-btn"
                type="button"
                onClick={() => onChangeViewMode("preview")}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  viewMode === "preview"
                    ? "bg-[#FAF9F6] dark:bg-[#2B2B28] text-[#1C1917] dark:text-[#EDEDEB] font-medium shadow-2xs"
                    : "text-[#78716C] dark:text-[#8A8985] hover:text-[#1C1917] dark:hover:text-[#EDEDEB]"
                }`}
                title="Preview mode (⌘E)"
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Preview</span>
              </button>

              <button
                id="view-mode-split-btn"
                type="button"
                onClick={() => onChangeViewMode("split")}
                className={`hidden lg:inline-flex items-center gap-1 px-2 py-1 rounded-md transition-colors cursor-pointer ${
                  viewMode === "split"
                    ? "bg-[#FAF9F6] dark:bg-[#2B2B28] text-[#1C1917] dark:text-[#EDEDEB] font-medium shadow-2xs"
                    : "text-[#78716C] dark:text-[#8A8985] hover:text-[#1C1917] dark:hover:text-[#EDEDEB]"
                }`}
                title="Split side-by-side"
              >
                <Columns className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Overflow Menu (...) */}
            <div ref={menuRef} className="relative">
              <button
                id="note-actions-menu-btn"
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="More note actions"
                aria-expanded={menuOpen}
                title="More actions"
                className="p-2 rounded-lg text-[#78716C] dark:text-[#8A8985] hover:text-[#1C1917] dark:hover:text-[#EDEDEB] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              {menuOpen && (
                <div
                  id="note-actions-dropdown"
                  className="absolute right-0 mt-1.5 w-48 py-1 rounded-xl bg-[#FAF9F6] dark:bg-[#1F1F1D] border border-[#E7E5E0] dark:border-[#2E2E2A] shadow-xl z-30 text-xs"
                >
                  <button
                    type="button"
                    onClick={() => {
                      onTogglePin(note.id);
                      setMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-black/5 dark:hover:bg-white/5 text-left cursor-pointer"
                  >
                    <Star
                      className={`w-3.5 h-3.5 ${note.isPinned ? "fill-amber-400 text-amber-500" : "text-[#78716C] dark:text-[#8A8985]"}`}
                    />
                    <span>{note.isPinned ? "Unpin note" : "Pin note"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      void handleCopyMarkdown();
                      setMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-black/5 dark:hover:bg-white/5 text-left cursor-pointer"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-[#78716C] dark:text-[#8A8985]" />
                    )}
                    <span>{copied ? "Copied!" : "Copy Markdown"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      downloadNoteAsMarkdown(localTitle, localContent);
                      setMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-black/5 dark:hover:bg-white/5 text-left cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-[#78716C] dark:text-[#8A8985]" />
                    <span>Export as .md</span>
                  </button>

                  <div className="my-1 border-t border-[#E7E5E0] dark:border-[#282825]" />

                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onDeleteNote(note.id);
                    }}
                    className="w-full px-3 py-2 flex items-center gap-2.5 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 text-left cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete note</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Centered Paper Canvas */}
      {!note ? (
        <main className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <p className="text-base font-medium text-[#1C1917] dark:text-[#EDEDEB]">
            A quiet place to think and study.
          </p>
          <p className="text-xs text-[#78716C] dark:text-[#8A8985] mt-1.5 max-w-xs">
            Create a note or press <kbd className="font-mono">⌘K</kbd> to jump
            to an existing one.
          </p>
          <button
            type="button"
            onClick={onCreateNote}
            className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium bg-[#1C1917] text-[#FAF9F6] dark:bg-[#EDEDEB] dark:text-[#141413] hover:opacity-90 transition-opacity cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Note</span>
          </button>
        </main>
      ) : (
        <main className="flex-1 flex flex-col overflow-hidden">
          {viewMode === "split" ? (
            /* Wide-screen optional split mode */
            <div className="flex-1 flex overflow-hidden">
              <div className="w-1/2 h-full flex flex-col overflow-hidden border-r border-[#E7E5E0] dark:border-[#282825]">
                <div className="px-8 pt-6 pb-2">
                  <input
                    id="active-note-title-input"
                    type="text"
                    value={localTitle}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="Untitled"
                    className="w-full text-2xl font-semibold tracking-tight bg-transparent border-none outline-hidden placeholder:text-[#78716C]/40 dark:placeholder:text-[#8A8985]/40"
                  />
                  {renderNoteMetaRow()}
                </div>
                <textarea
                  id="markdown-textarea-editor"
                  ref={textareaRef}
                  value={localContent}
                  onChange={(e) => handleContentChange(e.target.value)}
                  onScroll={() => syncSplitScroll("editor")}
                  placeholder="Start writing…"
                  className="flex-1 px-8 py-4 text-[16px] leading-[1.78] resize-none outline-hidden border-none bg-transparent placeholder:text-[#78716C]/40 dark:placeholder:text-[#8A8985]/40 overflow-y-auto custom-scrollbar"
                  spellCheck={false}
                />
              </div>

              <div
                ref={previewScrollRef}
                onScroll={() => syncSplitScroll("preview")}
                className="w-1/2 h-full overflow-y-auto custom-scrollbar px-8 py-8"
              >
                <MarkdownRenderer
                  content={localContent}
                  onToggleTask={(taskIndex, completed) => {
                    const next = toggleTaskAtIndex(
                      localContent,
                      taskIndex,
                      completed,
                    );
                    if (next !== localContent) {
                      setLocalContent(next);
                      onUpdateNote(note.id, { content: next }, 200);
                    }
                  }}
                />
              </div>
            </div>
          ) : (
            /* Default 1-Pane Centered Paper Canvas (Write or Preview) */
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="w-full max-w-3xl mx-auto px-5 sm:px-10 pt-6 sm:pt-10 pb-20 min-h-full flex flex-col">
                <input
                  id="active-note-title-input"
                  type="text"
                  value={localTitle}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Untitled"
                  className="w-full text-2xl sm:text-3xl font-semibold tracking-tight bg-transparent border-none outline-hidden placeholder:text-[#78716C]/40 dark:placeholder:text-[#8A8985]/40"
                />

                {renderNoteMetaRow()}

                {viewMode === "editor" ? (
                  <textarea
                    id="markdown-textarea-editor"
                    ref={textareaRef}
                    value={localContent}
                    onChange={(e) => handleContentChange(e.target.value)}
                    placeholder="Start writing your notes in Markdown…"
                    className="flex-1 w-full min-h-[60vh] text-[16.5px] leading-[1.78] resize-none outline-hidden border-none bg-transparent placeholder:text-[#78716C]/40 dark:placeholder:text-[#8A8985]/40 custom-scrollbar"
                    spellCheck={false}
                  />
                ) : (
                  <MarkdownRenderer
                    content={localContent}
                    onToggleTask={(taskIndex, completed) => {
                      const next = toggleTaskAtIndex(
                        localContent,
                        taskIndex,
                        completed,
                      );
                      if (next !== localContent) {
                        setLocalContent(next);
                        onUpdateNote(note.id, { content: next }, 200);
                      }
                    }}
                  />
                )}
              </div>
            </div>
          )}

          {/* Optional Compact Formatting Bar (toggled via Format pill) */}
          {showFormatting && viewMode !== "preview" && (
            <div ref={iconPickerRef} className="relative shrink-0">
              {iconPickerOpen && (
                <div
                  id="format-icon-picker-popover"
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30"
                >
                  <Suspense
                    fallback={
                      <div className="w-80 h-80 rounded-xl bg-[#FAF9F6] dark:bg-[#1F1F1D] border border-[#E7E5E0] dark:border-[#2E2E2A] shadow-2xl flex items-center justify-center text-xs text-[#78716C] dark:text-[#8A8985]">
                        Loading emojis…
                      </div>
                    }
                  >
                    <EmojiPickerPopover
                      onSelect={(emoji) => {
                        const sel = savedSelectionRef.current;
                        savedSelectionRef.current = null;
                        setIconPickerOpen(false);
                        insertFormatting(`${emoji} `, "", "", sel);
                      }}
                    />
                  </Suspense>
                </div>
              )}

              <div
                id="markdown-formatting-toolbar"
                onMouseDown={(e) => e.preventDefault()}
                className="px-4 py-1.5 border-t border-[#E7E5E0] dark:border-[#282825] bg-[#F4F2EC]/80 dark:bg-[#1B1B19]/90 flex items-center justify-center gap-1 overflow-x-auto no-scrollbar text-[#78716C] dark:text-[#8A8985]"
              >
              <button
                type="button"
                onClick={() => insertFormatting("**", "**", "bold")}
                className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 hover:text-[#1C1917] dark:hover:text-[#EDEDEB] cursor-pointer"
                title="Bold"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting("*", "*", "italic")}
                className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 hover:text-[#1C1917] dark:hover:text-[#EDEDEB] cursor-pointer"
                title="Italic"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting("~~", "~~", "strike")}
                className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 hover:text-[#1C1917] dark:hover:text-[#EDEDEB] cursor-pointer"
                title="Strikethrough"
              >
                <Strikethrough className="w-3.5 h-3.5" />
              </button>

              <div className="h-3.5 w-px bg-[#E7E5E0] dark:bg-[#2E2E2A] mx-1" />

              <button
                type="button"
                onClick={() => insertFormatting("# ", "", "Heading 1")}
                className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 hover:text-[#1C1917] dark:hover:text-[#EDEDEB] cursor-pointer"
                title="Heading 1"
              >
                <Heading1 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting("## ", "", "Heading 2")}
                className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 hover:text-[#1C1917] dark:hover:text-[#EDEDEB] cursor-pointer"
                title="Heading 2"
              >
                <Heading2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting("### ", "", "Heading 3")}
                className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 hover:text-[#1C1917] dark:hover:text-[#EDEDEB] cursor-pointer"
                title="Heading 3"
              >
                <Heading3 className="w-3.5 h-3.5" />
              </button>

              <div className="h-3.5 w-px bg-[#E7E5E0] dark:bg-[#2E2E2A] mx-1" />

              <button
                type="button"
                onClick={() => insertFormatting("> ", "", "Quote")}
                className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 hover:text-[#1C1917] dark:hover:text-[#EDEDEB] cursor-pointer"
                title="Quote"
              >
                <Quote className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting("`", "`", "code")}
                className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 hover:text-[#1C1917] dark:hover:text-[#EDEDEB] cursor-pointer"
                title="Inline code"
              >
                <Code className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting("```\n", "\n```", "code block")}
                className="px-1.5 py-1 rounded text-[11px] font-mono hover:bg-black/5 dark:hover:bg-white/10 hover:text-[#1C1917] dark:hover:text-[#EDEDEB] cursor-pointer"
                title="Code block"
              >
                {"{}"}
              </button>

              <div className="h-3.5 w-px bg-[#E7E5E0] dark:bg-[#2E2E2A] mx-1" />

              <button
                type="button"
                onClick={() => insertFormatting("- ", "", "Item")}
                className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 hover:text-[#1C1917] dark:hover:text-[#EDEDEB] cursor-pointer"
                title="Bullet list"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting("1. ", "", "Item")}
                className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 hover:text-[#1C1917] dark:hover:text-[#EDEDEB] cursor-pointer"
                title="Numbered list"
              >
                <ListOrdered className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting("- [ ] ", "", "Task")}
                className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 hover:text-[#1C1917] dark:hover:text-[#EDEDEB] cursor-pointer"
                title="Task list"
              >
                <CheckSquare className="w-3.5 h-3.5" />
              </button>

              <div className="h-3.5 w-px bg-[#E7E5E0] dark:bg-[#2E2E2A] mx-1" />

              <button
                type="button"
                onClick={() =>
                  insertFormatting("[", "](https://example.com)", "Link")
                }
                className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 hover:text-[#1C1917] dark:hover:text-[#EDEDEB] cursor-pointer"
                title="Insert link"
              >
                <LinkIcon className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() =>
                  insertFormatting(
                    "| Column 1 | Column 2 |\n| -------- | -------- |\n| Item 1   | Item 2   |\n",
                    "",
                    "",
                  )
                }
                className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 hover:text-[#1C1917] dark:hover:text-[#EDEDEB] cursor-pointer"
                title="Insert table"
              >
                <Table className="w-3.5 h-3.5" />
              </button>

              <div className="h-3.5 w-px bg-[#E7E5E0] dark:bg-[#2E2E2A] mx-1" />

              <button
                id="format-icon-picker-btn"
                type="button"
                onClick={() => {
                  if (!iconPickerOpen && textareaRef.current) {
                    savedSelectionRef.current = {
                      start: textareaRef.current.selectionStart,
                      end: textareaRef.current.selectionEnd,
                    };
                  }
                  setIconPickerOpen((v) => !v);
                }}
                aria-expanded={iconPickerOpen}
                aria-label="Insert emoji or symbol"
                className={`p-1.5 rounded transition-colors cursor-pointer ${
                  iconPickerOpen
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                    : "hover:bg-black/5 dark:hover:bg-white/10 hover:text-[#1C1917] dark:hover:text-[#EDEDEB]"
                }`}
                title="Insert icon / emoji"
              >
                <Smile className="w-3.5 h-3.5" />
              </button>
              </div>
            </div>
          )}

          {/* Quiet Single-Line Footer */}
          <footer
            className={`relative h-10 px-4 sm:px-6 flex items-center justify-between text-[11px] text-[#78716C] dark:text-[#8A8985] select-none shrink-0 transition-opacity duration-300 ${chromeOpacityClass}`}
          >
            <div>
              {viewMode !== "preview" && (
                <button
                  id="toggle-formatting-toolbar-btn"
                  type="button"
                  onClick={() => {
                    setShowFormatting((v) => {
                      if (v) setIconPickerOpen(false);
                      return !v;
                    });
                  }}
                  title={
                    showFormatting
                      ? "Hide formatting toolbar"
                      : "Show formatting toolbar"
                  }
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors cursor-pointer ${
                    showFormatting
                      ? "bg-amber-500/15 border-amber-500/35 text-amber-800 dark:text-amber-300"
                      : "bg-black/[0.04] dark:bg-white/[0.06] border-[#E7E5E0] dark:border-[#2E2E2A] text-[#1C1917] dark:text-[#EDEDEB] hover:bg-black/[0.08] dark:hover:bg-white/[0.1]"
                  }`}
                >
                  <Type className="w-3.5 h-3.5" />
                  <span>Format</span>
                </button>
              )}
            </div>

            {/* Subtle Centered Brand Watermark (desktop only) */}
            <div className="hidden md:flex items-center gap-1.5 absolute left-1/2 -translate-x-1/2 opacity-50 hover:opacity-90 transition-opacity pointer-events-auto">
              <img
                src={memoLogo}
                alt=""
                aria-hidden="true"
                className="w-4 h-4 rounded-xs"
              />
              <span className="text-[11px] font-medium tracking-tight">
                MemoFlow
              </span>
            </div>

            <div className="flex items-center gap-2.5 whitespace-nowrap text-[11px]">
              {syncLabel.clickable ? (
                <button
                  id="sync-status-label"
                  type="button"
                  onClick={() => onSaveImmediate(note.id)}
                  title={syncLabel.title}
                  className={syncLabel.className}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${syncLabel.dotClass}`} />
                  <span>{syncLabel.text}</span>
                </button>
              ) : (
                <span
                  id="sync-status-label"
                  title={syncLabel.title}
                  className={syncLabel.className}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${syncLabel.dotClass}`} />
                  <span>{syncLabel.text}</span>
                </span>
              )}
              <span className="font-mono">
                {wordCount} {wordCount === 1 ? "word" : "words"} &middot;{" "}
                {readTimeMin}m read
              </span>
            </div>
          </footer>
        </main>
      )}
    </div>
  );
};
