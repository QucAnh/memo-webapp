import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  FileText,
  Plus,
  Eye,
  Sun,
  Moon,
  Download,
  PanelLeft,
  Star,
  Folder,
} from "lucide-react";
import { Note } from "../types/note";
import { useTheme } from "../context/ThemeContext";
import {
  parseSearchQuery,
  matchesSearchQuery,
  HighlightText,
  getSmartExcerpt,
} from "../utils/searchUtils";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  notes: Note[];
  activeNote: Note | null;
  onSelectNote: (noteId: string) => void;
  onCreateNote: () => void;
  onTogglePreview: () => void;
  onOpenDrawer: () => void;
  onExportActiveNote: () => void;
}

type PaletteItem =
  | { kind: "note"; note: Note }
  | {
      kind: "action";
      id: string;
      label: string;
      shortcut?: string;
      icon: React.ReactNode;
      run: () => void;
    };

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  notes,
  activeNote,
  onSelectNote,
  onCreateNote,
  onTogglePreview,
  onOpenDrawer,
  onExportActiveNote,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { isDark, toggleTheme } = useTheme();

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      setQuery("");
      setSelectedIndex(0);
      dialog.showModal();
      requestAnimationFrame(() => inputRef.current?.focus());
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const parsedSearch = useMemo(() => parseSearchQuery(query), [query]);

  const matchingNotes = useMemo(() => {
    const list = parsedSearch.raw
      ? notes.filter((n) => matchesSearchQuery(n, parsedSearch))
      : notes;
    return list.slice(0, 8);
  }, [notes, parsedSearch]);

  const actions = useMemo<Extract<PaletteItem, { kind: "action" }>[]>(() => {
    const all: Extract<PaletteItem, { kind: "action" }>[] = [
      {
        kind: "action",
        id: "new-note",
        label: "Create new note",
        shortcut: "⌘N",
        icon: <Plus className="w-4 h-4" />,
        run: onCreateNote,
      },
      {
        kind: "action",
        id: "toggle-preview",
        label: "Toggle Write / Preview",
        shortcut: "⌘E",
        icon: <Eye className="w-4 h-4" />,
        run: onTogglePreview,
      },
      {
        kind: "action",
        id: "open-drawer",
        label: "Open Notes & Folders drawer",
        shortcut: "⌘\\",
        icon: <PanelLeft className="w-4 h-4" />,
        run: onOpenDrawer,
      },
      {
        kind: "action",
        id: "toggle-theme",
        label: isDark ? "Switch to Light Mode" : "Switch to Dark Mode",
        icon: isDark ? (
          <Sun className="w-4 h-4" />
        ) : (
          <Moon className="w-4 h-4" />
        ),
        run: toggleTheme,
      },
    ];

    if (activeNote) {
      all.push({
        kind: "action",
        id: "export-md",
        label: "Export current note as Markdown (.md)",
        icon: <Download className="w-4 h-4" />,
        run: onExportActiveNote,
      });
    }

    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((a) => a.label.toLowerCase().includes(q));
  }, [
    activeNote,
    isDark,
    onCreateNote,
    onExportActiveNote,
    onOpenDrawer,
    onTogglePreview,
    query,
    toggleTheme,
  ]);

  const items = useMemo<PaletteItem[]>(() => {
    return [
      ...matchingNotes.map((note) => ({ kind: "note" as const, note })),
      ...actions,
    ];
  }, [matchingNotes, actions]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const executeItem = (item: PaletteItem) => {
    onClose();
    if (item.kind === "note") {
      onSelectNote(item.note.id);
    } else {
      item.run();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (items.length ? (prev + 1) % items.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        items.length ? (prev - 1 + items.length) % items.length : 0,
      );
    } else if (e.key === "Enter" && items[selectedIndex]) {
      e.preventDefault();
      executeItem(items[selectedIndex]);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  const searchTerms = parsedSearch.allTerms;

  return (
    <dialog
      ref={dialogRef}
      id="memoflow-command-palette"
      aria-label="Command palette and note search"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={handleBackdropClick}
      className="paper-dialog m-0 p-4 pt-[12vh] border-0 bg-transparent max-w-none max-h-none w-screen h-[100svh] overflow-hidden"
    >
      <div
        ref={panelRef}
        className="w-full max-w-xl mx-auto rounded-2xl bg-[#FAF9F6] dark:bg-[#1B1B19] text-[#1C1917] dark:text-[#EDEDEB] border border-[#E7E5E0] dark:border-[#2E2E2A] shadow-2xl overflow-hidden flex flex-col max-h-[70svh]"
      >
        {/* Search Input */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#E7E5E0] dark:border-[#282825]">
          <Search className="w-4 h-4 text-[#78716C] dark:text-[#8A8985] shrink-0" />
          <input
            ref={inputRef}
            id="command-palette-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search notes, #tags, folder:study, or type a command…"
            className="flex-1 bg-transparent text-sm outline-hidden placeholder:text-[#78716C]/70 dark:placeholder:text-[#8A8985]/70"
          />
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-[#78716C] dark:text-[#8A8985]">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="overflow-y-auto custom-scrollbar py-2">
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-[#78716C] dark:text-[#8A8985]">
              No matching notes or commands.
            </div>
          ) : (
            <>
              {matchingNotes.length > 0 && (
                <div className="px-3 pt-1 pb-1.5 text-[10px] font-medium uppercase tracking-wider text-[#78716C] dark:text-[#8A8985]">
                  Notes
                </div>
              )}
              {matchingNotes.map((note, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={note.id}
                    type="button"
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={() => executeItem({ kind: "note", note })}
                    className={`w-full px-4 py-2.5 flex items-start gap-3 text-left transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-[#EFECE4] dark:bg-[#262622]"
                        : "hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
                    }`}
                  >
                    <FileText className="w-4 h-4 mt-0.5 text-[#78716C] dark:text-[#8A8985] shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium truncate">
                          <HighlightText
                            text={note.title || "Untitled Note"}
                            terms={searchTerms}
                          />
                        </span>
                        {note.isPinned && (
                          <Star className="w-3 h-3 fill-amber-400 text-amber-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-[#78716C] dark:text-[#8A8985] truncate mt-0.5">
                        <HighlightText
                          text={getSmartExcerpt(note.content, searchTerms, 90)}
                          terms={searchTerms}
                        />
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#78716C] dark:text-[#8A8985] shrink-0">
                      <Folder className="w-3 h-3 opacity-60" />
                      {note.folder}
                    </span>
                  </button>
                );
              })}

              {actions.length > 0 && (
                <div className="px-3 pt-2.5 pb-1.5 text-[10px] font-medium uppercase tracking-wider text-[#78716C] dark:text-[#8A8985]">
                  Actions
                </div>
              )}
              {actions.map((action, actionIdx) => {
                const flatIdx = matchingNotes.length + actionIdx;
                const isSelected = flatIdx === selectedIndex;
                return (
                  <button
                    key={action.id}
                    type="button"
                    onMouseEnter={() => setSelectedIndex(flatIdx)}
                    onClick={() => executeItem(action)}
                    className={`w-full px-4 py-2 flex items-center justify-between gap-3 text-left text-sm transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-[#EFECE4] dark:bg-[#262622]"
                        : "hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
                    }`}
                  >
                    <span className="flex items-center gap-2.5 text-[#1C1917] dark:text-[#EDEDEB]">
                      <span className="text-[#78716C] dark:text-[#8A8985]">
                        {action.icon}
                      </span>
                      <span>{action.label}</span>
                    </span>
                    {action.shortcut && (
                      <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-[#78716C] dark:text-[#8A8985]">
                        {action.shortcut}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>
    </dialog>
  );
};
