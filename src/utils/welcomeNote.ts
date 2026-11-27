import { Note } from "../types/note";

export type WelcomeNoteTemplate = Pick<
  Note,
  "title" | "content" | "tags" | "folder" | "isPinned"
>;

export const INITIAL_WELCOME_NOTE: WelcomeNoteTemplate = {
  title: "🚀 Welcome to MemoFlow",
  content: `# Welcome to MemoFlow!

MemoFlow is your fast, minimal Markdown note-taking workspace with **instant real-time syncing** powered by Firebase Firestore.

---

### ✨ Key Features:
- **Auto-Save with 500ms Debounce**: Never lose a thought. Keystrokes sync automatically in the background.
- **Real-Time onSnapshot**: Live synchronization across desktop and mobile tabs.
- **Split Markdown Layout**: Live preview rendered in real-time as you write.
- **Organization**: Categorize notes into notebook folders and filter by #tags.
- **Pinning**: Star important notes to keep them pinned at the top.

---

### 📝 Markdown Cheat Sheet:
- **Bold text**: \`**bold**\`
- *Italic text*: \`*italic*\`
- > Blockquote: Start line with \`> \`
- \`inline code\`: Wrap in single backticks
- Code blocks:
\`\`\`typescript
const sync = async (note: Note) => {
  await updateDoc(doc(db, 'notes', note.id), note);
};
\`\`\`

- [x] Create first note
- [ ] Try keyboard shortcut **⌘ + N** for a new note
- [ ] Try **⌘ + S** to force immediate save

Happy writing!`,
  tags: ["getting-started", "guide"],
  folder: "General",
  isPinned: true,
};
