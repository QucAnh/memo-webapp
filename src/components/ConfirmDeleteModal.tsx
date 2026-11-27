import React, { useEffect, useRef } from "react";
import { Trash2, AlertTriangle, X, FolderX } from "lucide-react";

export type DeleteTarget =
  | {
      type: "note";
      id: string;
      title: string;
    }
  | {
      type: "folder";
      name: string;
      notesCount: number;
    }
  | null;

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  target: DeleteTarget;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
  isDeleting?: boolean;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  target,
  onConfirm,
  onClose,
  isDeleting = false,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && target && !dialog.open) {
      dialog.showModal();
    } else if ((!isOpen || !target) && dialog.open) {
      dialog.close();
    }
  }, [isOpen, target]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (
      !isDeleting &&
      panelRef.current &&
      !panelRef.current.contains(e.target as Node)
    ) {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      id="confirm-delete-dialog"
      aria-labelledby="confirm-delete-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!isDeleting) onClose();
      }}
      onClick={handleBackdropClick}
      className="paper-dialog m-0 p-4 border-0 bg-transparent max-w-none max-h-none w-screen h-[100svh] open:flex items-center justify-center"
    >
      {target && (
        <div
          ref={panelRef}
          className="w-full max-w-md rounded-2xl bg-[#FAF9F6] dark:bg-[#1B1B19] text-[#1C1917] dark:text-[#EDEDEB] border border-[#E7E5E0] dark:border-[#2E2E2A] shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="p-5 flex items-start justify-between gap-3 border-b border-[#E7E5E0] dark:border-[#282825]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                {target.type === "note" ? (
                  <Trash2 className="w-4 h-4" />
                ) : (
                  <FolderX className="w-4 h-4" />
                )}
              </div>
              <div>
                <h1
                  id="confirm-delete-title"
                  className="text-sm font-semibold leading-tight"
                >
                  {target.type === "note" ? "Delete Note" : "Delete Folder"}
                </h1>
                <p className="text-xs text-[#78716C] dark:text-[#8A8985] mt-0.5">
                  {target.type === "note"
                    ? "This action cannot be undone"
                    : "Remove folder categorization"}
                </p>
              </div>
            </div>
            <button
              id="close-delete-modal-btn"
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              aria-label="Cancel"
              className="p-1.5 rounded-lg text-[#78716C] dark:text-[#8A8985] hover:text-[#1C1917] dark:hover:text-[#EDEDEB] hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content Body */}
          <div className="p-5 text-sm text-[#57534E] dark:text-[#B8B6B0] space-y-3">
            {target.type === "note" ? (
              <div>
                <p className="leading-relaxed">
                  Are you sure you want to permanently delete{" "}
                  <span className="font-semibold text-[#1C1917] dark:text-[#EDEDEB] break-all">
                    &ldquo;{target.title || "Untitled Note"}&rdquo;
                  </span>
                  ?
                </p>
                <div className="mt-3 flex items-center gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-300">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>
                    The note will be permanently removed from your workspace.
                  </span>
                </div>
              </div>
            ) : (
              <div>
                <p className="leading-relaxed">
                  Are you sure you want to delete the folder{" "}
                  <span className="font-semibold text-[#1C1917] dark:text-[#EDEDEB]">
                    &ldquo;{target.name}&rdquo;
                  </span>
                  ?
                </p>
                {target.notesCount > 0 ? (
                  <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                    <div className="font-medium">
                      {target.notesCount}{" "}
                      {target.notesCount === 1 ? "note" : "notes"} inside
                    </div>
                    <p className="opacity-90 leading-normal">
                      Your notes will <strong>not be deleted</strong> — they
                      will be moved safely to{" "}
                      <span className="font-semibold">General</span>.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-[#78716C] dark:text-[#8A8985] mt-2">
                    This folder is empty and will be removed from your list.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Actions Footer */}
          <div className="px-5 py-3.5 bg-[#F4F2EC]/70 dark:bg-[#161614] border-t border-[#E7E5E0] dark:border-[#282825] flex items-center justify-end gap-2">
            <button
              id="cancel-delete-btn"
              type="button"
              autoFocus
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 text-xs font-medium text-[#57534E] dark:text-[#B8B6B0] hover:text-[#1C1917] dark:hover:text-[#EDEDEB] hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="confirm-delete-action-btn"
              type="button"
              onClick={onConfirm}
              disabled={isDeleting}
              className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {isDeleting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Deleting…</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>
                    {target.type === "note" ? "Delete Note" : "Delete Folder"}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
};
