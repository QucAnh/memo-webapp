import { Note } from "../types/note";
import { sortNotes } from "./notes";

export const DEFAULT_FOLDERS = ["General", "Study"];

export interface FolderTreeNode {
  /** Full normalized path, e.g. "Study/Math/Calculus" */
  path: string;
  /** Display segment name, e.g. "Calculus" */
  name: string;
  /** Nesting depth (0 = root) */
  depth: number;
  /** Child folders, sorted alphabetically */
  children: FolderTreeNode[];
  /** Notes directly inside this folder (sorted pinned-first, then recent) */
  notes: Note[];
  /** Rolled-up count of notes in this folder and all descendant folders */
  totalNoteCount: number;
}

/**
 * Normalize a folder path: trim each segment, collapse empty segments and
 * repeated slashes, and canonicalize root "general" to "General".
 */
export function normalizeFolderPath(raw: string): string {
  if (!raw || typeof raw !== "string") return "";
  const segments = raw
    .split("/")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (segments.length === 0) return "";
  if (segments.length === 1 && segments[0].toLowerCase() === "general") {
    return "General";
  }
  return segments.join("/");
}

/** Return all ancestor paths of a folder path, e.g. "Study/Math/Calc" -> ["Study", "Study/Math"]. */
export function getAncestorPaths(folderPath: string): string[] {
  const normalized = normalizeFolderPath(folderPath);
  if (!normalized) return [];
  const parts = normalized.split("/");
  const ancestors: string[] = [];
  for (let i = 1; i < parts.length; i++) {
    ancestors.push(parts.slice(0, i).join("/"));
  }
  return ancestors;
}

/**
 * Returns true if `folder` equals `target` or is nested inside `target`
 * (case-insensitive, segment-boundary safe).
 */
export function isFolderOrDescendant(folder: string, target: string): boolean {
  const normFolder = normalizeFolderPath(folder).toLowerCase();
  const normTarget = normalizeFolderPath(target).toLowerCase();
  if (!normFolder || !normTarget) return false;
  return normFolder === normTarget || normFolder.startsWith(`${normTarget}/`);
}

/**
 * Folder list for selectors and tree roots: General first, then all stored
 * folders, note folders, and synthesized ancestor folders, de-duplicated
 * case-insensitively and sorted.
 */
export function buildFolderList(storedFolders: string[], notes: Note[]): string[] {
  const folderMap = new Map<string, string>();
  folderMap.set("general", "General");

  const registerPath = (raw: string) => {
    const normalized = normalizeFolderPath(raw);
    if (!normalized) return;

    // Register every ancestor segment so nested paths always have parent nodes
    const parts = normalized.split("/");
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      const lower = current.toLowerCase();
      if (!folderMap.has(lower)) {
        folderMap.set(lower, current);
      }
    }
  };

  storedFolders.forEach(registerPath);
  notes.forEach((n) => registerPath(n.folder));

  const general = folderMap.get("general") || "General";
  const rest = Array.from(folderMap.values())
    .filter((f) => f.toLowerCase() !== "general")
    .sort((a, b) => a.localeCompare(b));

  return [general, ...rest];
}

export function hasFolder(folders: string[], name: string): boolean {
  const normalized = normalizeFolderPath(name).toLowerCase();
  if (!normalized) return false;
  return folders.some((f) => normalizeFolderPath(f).toLowerCase() === normalized);
}

/** Returns the list unchanged when the path is blank or already present. */
export function addFolderToList(folders: string[], name: string): string[] {
  const normalized = normalizeFolderPath(name);
  if (!normalized || hasFolder(folders, normalized)) {
    return folders;
  }
  return [...folders, normalized];
}

/** Removes a folder and any nested descendant folders (case-insensitive). */
export function removeFolderFromList(folders: string[], name: string): string[] {
  const normalized = normalizeFolderPath(name);
  if (!normalized) return folders;
  return folders.filter((f) => !isFolderOrDescendant(f, normalized));
}

/** Selects all notes in `name` or any nested subfolder under `name`. */
export function selectNotesInFolder(notes: Note[], name: string): Note[] {
  const normalized = normalizeFolderPath(name);
  if (!normalized) return [];
  return notes.filter((n) => isFolderOrDescendant(n.folder, normalized));
}

/**
 * Build a VS Code-style nested folder tree with direct notes attached to each
 * folder and rolled-up `totalNoteCount` computed bottom-up.
 */
export function buildFolderTree(
  allFolders: string[],
  notes: Note[],
): FolderTreeNode[] {
  const normalizedFolders = buildFolderList(allFolders, notes);
  const nodeMap = new Map<string, FolderTreeNode>();
  const roots: FolderTreeNode[] = [];

  for (const path of normalizedFolders) {
    const parts = path.split("/");
    const name = parts[parts.length - 1];
    const depth = parts.length - 1;
    const node: FolderTreeNode = {
      path,
      name,
      depth,
      children: [],
      notes: [],
      totalNoteCount: 0,
    };
    nodeMap.set(path.toLowerCase(), node);
  }

  // Link children to parents
  for (const node of nodeMap.values()) {
    const lastSlash = node.path.lastIndexOf("/");
    if (lastSlash === -1) {
      roots.push(node);
    } else {
      const parentPath = node.path.slice(0, lastSlash).toLowerCase();
      const parent = nodeMap.get(parentPath);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }
  }

  // Attach notes to their exact folder node (defaulting to General)
  for (const note of notes) {
    const folderKey = (normalizeFolderPath(note.folder) || "General").toLowerCase();
    const target = nodeMap.get(folderKey) || nodeMap.get("general");
    if (target) {
      target.notes.push(note);
    }
  }

  // Recursively sort children (General first at root, then alphabetical) & notes, and compute counts
  const finalize = (nodes: FolderTreeNode[], isRoot: boolean): number => {
    nodes.sort((a, b) => {
      if (isRoot) {
        if (a.path.toLowerCase() === "general") return -1;
        if (b.path.toLowerCase() === "general") return 1;
      }
      return a.name.localeCompare(b.name);
    });

    let sum = 0;
    for (const node of nodes) {
      node.notes = sortNotes(node.notes);
      const childTotal = finalize(node.children, false);
      node.totalNoteCount = node.notes.length + childTotal;
      sum += node.totalNoteCount;
    }
    return sum;
  };

  finalize(roots, true);
  return roots;
}
