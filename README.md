# MemoFlow

**A calm, distraction-free Markdown study notebook with instant local-first entry, a VS Code-style nested folder explorer, `⌘K` quick switcher, and real-time Firestore sync.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![React 19](https://img.shields.io/badge/React-19-087EA4?logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/built%20with-Vite-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Firebase](https://img.shields.io/badge/backend-Firebase-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com)

Live app: **https://app.qanhdomain.id.vn** (and **https://meno-webapp.vercel.app**)

---

## Features

Everything below is implemented in this repository.

| Area | What you get |
| --- | --- |
| Distraction-free 1-pane editor | Centered Paper Calm canvas (`max-w-3xl`) where header & footer chrome gently fade while typing |
| View modes | Write, Preview (sanitized GitHub-Flavored Markdown via `marked` + `DOMPurify` with interactive task checkboxes), or Split side-by-side (`≥1024px`) with bidirectional scroll sync |
| Formatting toolbar | Toggleable `Format` pill with Bold, Italic, Strikethrough, H1–H3, Quote, Inline/Block Code, Bullet/Numbered/Task lists, Link, Table, and a lazy-loaded searchable **`frimousse`** emoji picker — all preserving native `Ctrl/⌘+Z` undo/redo |
| VS Code-style Folder Explorer | Slide-out modal drawer (`⌘\`) with unlimited nested folders (`Study/Math/Calculus`), vertical indent guides, rolled-up note counts, inline subfolder creation, per-folder new-note actions, `Explorer` / `Pinned` tabs, and Collapse All |
| `⌘K` Command Palette | Instant note search (`#tag`, `tag:`, `folder:`, `@folder`, `keyword:#tag`, quoted phrases) with match highlighting, centered excerpts, keyboard navigation, and quick actions |
| Tag autocomplete | Inline `+ tag` combobox searches existing workspace tags before offering to create a new tag |
| Zero-loss auto-save | Isolated per-note debounced save queue (500 ms title/content, 200 ms folder/tags) that flushes automatically on note switches, tab hide, and page unload; `⌘/Ctrl+S` saves immediately |
| Offline-ready sync | Multi-tab Firestore IndexedDB persistence (`persistentLocalCache`) for signed-in users, `localStorage` for instant account-less workspaces, and a color-coded status pill (`Saved locally` / `Synced` / `Saving…` / `Offline` / `Sync error · Retry`) |
| Output | Copy raw Markdown to clipboard or download the active note as `.md` from the `•••` menu |
| Theme | Warm Paper Calm light & dark themes, persisted, following OS `prefers-color-scheme` changes automatically until overridden |
| Accounts | Instant local-first entry with no login wall; sign in anytime via Google or Email/Password in `AuthModal` to migrate local notes to Firestore |

### Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `⌘/Ctrl+K` | Open Command Palette & quick switcher |
| `⌘/Ctrl+\` | Toggle Notes & Folders Explorer drawer |
| `⌘/Ctrl+N` | Create a new note |
| `⌘/Ctrl+E` | Toggle Write / Preview mode |
| `⌘/Ctrl+S` | Save the active note immediately |
| `⌘/Ctrl+Z` / `Shift+Z` | Undo / Redo (including format toolbar & emoji insertions) |

---

## How it works

**Instant local-first, optional cloud sync.** `src/hooks/useNotes.ts` owns every read and write. New visitors start directly in a browser-local workspace backed by `localStorage` with zero login friction. Signing in activates a real-time Firestore `onSnapshot` listener backed by multi-tab IndexedDB `persistentLocalCache`. Components never talk to Firebase directly.

**Per-note save queue.** Typing updates React state optimistically, then `src/utils/saveQueue.ts` schedules an isolated debounced write per note ID. Switching notes, hiding the tab, or unloading the page flushes pending edits immediately so fast note switches never drop changes.

**Safe guest-to-account migration.** On sign-in, `src/utils/migration.ts` copies browser-local notes to Firestore and deletes the local copy only after every write commits. If a write fails, the local notes stay in the browser and retry on the next sign-in.

**Nested folders with zero schema migration.** Folders are stored as normalized slash-delimited paths (e.g. `Study/Math/Calculus`) in `note.folder`. `src/utils/folders.ts` synthesizes missing parent nodes, builds the nested explorer tree with rolled-up counts, and handles descendant-aware filtering and atomic `writeBatch` folder deletion (safely moving notes to `General`).

**Sanitized Markdown & interactive tasks.** `src/utils/markdown.ts` parses GFM with `marked` and sanitizes all HTML output with `DOMPurify` before rendering. Clicking rendered task-list checkboxes toggles the corresponding `- [ ]` / `- [x]` line in raw Markdown (skipping fenced code blocks).

**Hardened Firestore rules.** `firestore.rules` enforces owner-only `read`/`delete`, immutable `id`/`userId`/`createdAt` on `update`, strict 9-field schema/type/size validation on both `create` and `update`, and default-deny on all other paths.

---

## Tech stack

- **React 19** + **TypeScript (`strict: true`)**, bundled by **Vite 6**
- **Tailwind CSS 4** (`@tailwindcss/vite`), **lucide-react** icons, and lazy-loaded **frimousse** emoji picker
- **marked** + **DOMPurify** for safe GitHub-Flavored Markdown rendering
- **Firebase 12** modular SDK — Authentication and Cloud Firestore with persistent multi-tab local cache
- **Vitest** (+ `jsdom`) for unit tests; **no external state library**

---

## Project structure

```text
meno-webapp/
├── src/
│   ├── components/
│   │   ├── AuthModal.tsx                 # native <dialog> sign-in / account management
│   │   ├── CommandPalette.tsx            # ⌘K search & quick actions
│   │   ├── ConfirmDeleteModal.tsx        # native <dialog> note/folder delete confirmation
│   │   ├── EditorView.tsx                # 1-pane Paper Calm editor, toolbar, scroll sync, footer
│   │   ├── EmojiPickerPopover.tsx        # lazy-loaded frimousse searchable emoji picker
│   │   ├── MarkdownRenderer.tsx          # sanitized GFM preview + interactive task checkboxes
│   │   ├── NavigationDrawer.tsx          # VS Code-style nested folder & notes explorer
│   │   ├── OperationNotAllowedAlert.tsx
│   │   └── UnauthorizedDomainAlert.tsx
│   ├── context/
│   │   ├── AuthContext.tsx
│   │   └── ThemeContext.tsx
│   ├── hooks/useNotes.ts                 # central data layer, save queue, sync, folders
│   ├── test/factories.ts                 # shared test fixtures
│   ├── types/note.ts
│   ├── assets/MEMO.png
│   ├── utils/
│   │   ├── folders.ts (+ .test.ts)       # nested paths, tree builder, descendant deletion
│   │   ├── markdown.ts (+ .test.ts)      # DOMPurify GFM renderer & task checkbox toggling
│   │   ├── migration.ts (+ .test.ts)     # safe local → Firestore migration
│   │   ├── notes.ts (+ .test.ts)         # dedupe, sort, filter
│   │   ├── saveQueue.ts (+ .test.ts)     # per-note debounced save queue
│   │   ├── searchUtils.tsx (+ .test.ts)  # query parser, excerpts, highlighting
│   │   └── welcomeNote.ts
│   ├── App.tsx
│   ├── firebaseConfig.ts
│   ├── index.css
│   └── main.tsx
├── .github/workflows/check.yml           # install, strict typecheck, tests, and build
├── firebase.json / .firebaserc
├── firebase-applet-config.json           # Firebase client config (public by design)
├── firestore.rules                       # owner-only, schema-validated Firestore rules
└── index.html
```

---

## Getting started

Requires Node.js 18+ (or Bun).

```bash
bun install
bun run dev      # http://localhost:3000
```

`npm install && npm run dev` works too.

### Firebase setup

1. Enable **Google** and **Email/Password** providers in Firebase Console → Authentication → Sign-in method.
2. Add your deployment hostnames under Authentication → Settings → Authorized domains.
3. Deploy the Firestore security rules:
   ```bash
   npx -y firebase-tools@latest deploy --only firestore:rules
   ```
4. Point the app at your project via `firebase-applet-config.json` or `VITE_FIREBASE_*` environment variables.

### Commands

| Command | Purpose |
| --- | --- |
| `bun run dev` | Dev server on port 3000 |
| `bun run build` | Production build into `dist/` |
| `bun run preview` | Serve the production build |
| `bun run lint` | Strict `tsc --noEmit` type check |
| `bun run test` | Vitest unit tests (6 suites, 74 tests) |

---

## Known limitations

- **Test coverage focuses on core logic.** Vitest covers Markdown sanitization & task toggling, the per-note save queue, nested folder trees, note dedupe/sort/filter, search parsing, and local-to-cloud migration (74 tests). React component integration tests are not yet added.
- **Empty custom folders are browser-local.** Folders containing notes sync across devices via `note.folder`, while empty custom folders are persisted in `localStorage`.
- **Search is client-side** over notes loaded in the browser, not a server-side search index.
- **Main bundle size.** `EmojiPickerPopover` is lazy-loaded (`~10 kB` gzipped), while the core React + Firebase bundle is currently a single chunk.

---

## Possible future work

Planned for a future Study Pro phase (not committed yet): Markdown-to-flashcard spaced repetition, clean PDF / Cornell Notes print export, Pomodoro focus timer + Sepia paper theme, and optional BYO-key Gemini study helper.

---

## License

MIT — see [`LICENSE`](./LICENSE).
