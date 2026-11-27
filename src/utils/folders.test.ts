import { describe, expect, it } from "vitest";
import {
  addFolderToList,
  buildFolderList,
  buildFolderTree,
  getAncestorPaths,
  hasFolder,
  isFolderOrDescendant,
  normalizeFolderPath,
  removeFolderFromList,
  selectNotesInFolder,
} from "./folders";
import { makeNote } from "../test/factories";

describe("normalizeFolderPath", () => {
  it("trims segments and collapses extra slashes", () => {
    expect(normalizeFolderPath("  Study /  Math // Calculus / ")).toBe(
      "Study/Math/Calculus",
    );
  });

  it("canonicalizes root general to General", () => {
    expect(normalizeFolderPath("  general ")).toBe("General");
  });

  it("returns empty string for blank or slash-only paths", () => {
    expect(normalizeFolderPath("   ")).toBe("");
    expect(normalizeFolderPath("///")).toBe("");
  });
});

describe("getAncestorPaths & isFolderOrDescendant", () => {
  it("extracts ancestor paths in order", () => {
    expect(getAncestorPaths("Study/Math/Calculus")).toEqual([
      "Study",
      "Study/Math",
    ]);
    expect(getAncestorPaths("General")).toEqual([]);
  });

  it("matches exact folders and nested descendants without partial-prefix collisions", () => {
    expect(isFolderOrDescendant("Study/Math/Calc", "study")).toBe(true);
    expect(isFolderOrDescendant("Study/Math/Calc", "study/math")).toBe(true);
    expect(isFolderOrDescendant("StudyGuide", "Study")).toBe(false);
  });
});

describe("buildFolderList", () => {
  it("starts with General when nothing is stored", () => {
    expect(buildFolderList([], [])).toEqual(["General"]);
  });

  it("keeps General first, synthesizes ancestor folders, and sorts the rest", () => {
    const notes = [makeNote({ folder: "Study/Math/Calculus" })];

    expect(buildFolderList(["Reading"], notes)).toEqual([
      "General",
      "Reading",
      "Study",
      "Study/Math",
      "Study/Math/Calculus",
    ]);
  });

  it("treats a stored folder and a note folder as the same folder", () => {
    const notes = [makeNote({ folder: "ideas" })];

    expect(buildFolderList(["Ideas"], notes)).toEqual(["General", "Ideas"]);
  });

  it("normalises a stored general entry", () => {
    expect(buildFolderList(["general"], [])).toEqual(["General"]);
  });

  it("keeps the first spelling when stored names differ only by case", () => {
    expect(buildFolderList(["Study", "study"], [])).toEqual([
      "General",
      "Study",
    ]);
  });
});

describe("hasFolder", () => {
  it("ignores case and surrounding whitespace", () => {
    expect(hasFolder(["Study/Math"], "  study / math ")).toBe(true);
  });

  it("rejects blank names", () => {
    expect(hasFolder(["Study"], "   ")).toBe(false);
  });

  it("rejects unknown names", () => {
    expect(hasFolder(["Study"], "Math")).toBe(false);
  });
});

describe("addFolderToList", () => {
  it("appends a normalized path", () => {
    expect(addFolderToList(["Study"], "  Study / Math  ")).toEqual([
      "Study",
      "Study/Math",
    ]);
  });

  it("returns the list unchanged when the name already exists", () => {
    const folders = ["Study/Math"];

    expect(addFolderToList(folders, "study/math")).toBe(folders);
  });

  it("returns the list unchanged when the name is blank", () => {
    const folders = ["Study"];

    expect(addFolderToList(folders, "  ")).toBe(folders);
  });
});

describe("removeFolderFromList", () => {
  it("removes the folder and all nested descendants case-insensitively", () => {
    expect(
      removeFolderFromList(
        ["General", "Study", "Study/Math", "Study/Math/Calc", "Work"],
        " study/math ",
      ),
    ).toEqual(["General", "Study", "Work"]);
  });
});

describe("selectNotesInFolder", () => {
  it("matches the folder and its nested subfolders case-insensitively", () => {
    const notes = [
      makeNote({ id: "a", folder: "Study" }),
      makeNote({ id: "b", folder: "study/math" }),
      makeNote({ id: "c", folder: "StudyGuide" }),
      makeNote({ id: "d", folder: "Work" }),
    ];

    expect(selectNotesInFolder(notes, "STUDY").map((n) => n.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("ignores notes without a folder", () => {
    expect(selectNotesInFolder([makeNote({ folder: "" })], "Study")).toEqual([]);
  });
});

describe("buildFolderTree", () => {
  it("nests child folders and rolls up note counts bottom-up", () => {
    const notes = [
      makeNote({ id: "g1", folder: "General", updatedAt: 10 }),
      makeNote({ id: "s1", folder: "Study", updatedAt: 20 }),
      makeNote({ id: "m1", folder: "Study/Math", updatedAt: 30, isPinned: true }),
      makeNote({ id: "c1", folder: "Study/Math/Calculus", updatedAt: 40 }),
    ];

    const tree = buildFolderTree(["General", "Study"], notes);

    expect(tree.map((n) => n.name)).toEqual(["General", "Study"]);
    expect(tree[0].totalNoteCount).toBe(1);
    expect(tree[1].totalNoteCount).toBe(3);
    expect(tree[1].notes.map((n) => n.id)).toEqual(["s1"]);
    expect(tree[1].children).toHaveLength(1);
    expect(tree[1].children[0].path).toBe("Study/Math");
    expect(tree[1].children[0].totalNoteCount).toBe(2);
    expect(tree[1].children[0].children[0].path).toBe("Study/Math/Calculus");
    expect(tree[1].children[0].children[0].notes.map((n) => n.id)).toEqual(["c1"]);
  });
});
