# Player Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single annotation `note` and the brief-pick `verdict` with a per-player log of dated, editable notes, optionally tagged with a brief.

**Architecture:** Notes live as `notes[]` on the existing `playerAnnotations` record (DB v7 strips the old `note`). `PlayerNotesContext` gains add/update/delete; a pure `player-notes.ts` names and summarises notes. One `PlayerNotesLog` component renders the log inline on the profile and inside one app-wide drawer (`NotesDrawerProvider`), which `/lists` and the brief page open.

**Tech Stack:** React 19, Chakra UI 3 (`Drawer`, `Textarea`), idb, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-10-player-notes-design.md`

## Global Constraints

- No generic code comments (CLAUDE.md); strict TS (`noUnusedLocals`, `noUnusedParameters`).
- Note date = `newestSnapshot(snapshots)?.date ?? null` at add time; never the machine clock; never changed by edit.
- Copy, verbatim: *Add note*, *Add note…*, *No brief*, *No notes yet.*, *Undated*, *Delete note*, *Notes*, *1 other note*, *N other notes*. Accessible names: `Brief note for <name>`, `Notes for <name>`, textareas *New note* / *Edit note*.
- Tests: Playwright only, behaviour-only, few; any kept test mutation-checked. One-time migration tested temporarily, never committed.
- Before each commit: `npx tsc -b && npm run lint`.
- Commit messages: one short line, no attribution.

**Human verification (at finish):** drawer look and feel on `/lists` and the brief page, light and dark; brief note line clipping and the textarea editor in the brief table; profile Notes box in both the normal and the missing-player branch; nested delete confirm inside the drawer closes with Esc without closing the drawer.

---

### Task 1: Notes storage, helpers, and the readers of the old note

**Files:**

- Modify: `src/types/annotations.ts`, `src/services/db/connection.ts`, `src/services/db/annotations.ts`, `src/contexts/PlayerNotesContext.tsx`, `src/components/PricingFields.tsx`, `src/components/PlayerStatusBadge.tsx`, `src/views/ListsView.tsx`, `browser-tests/helpers/seed.ts`
- Create: `src/utils/player-notes.ts`
- Temporary: `browser-tests/notes-migration.spec.ts` (deleted in this task)

**Interfaces:**

- Produces:
  - `interface PlayerNote { id: string; text: string; date: string | null; briefId?: string; briefName?: string }` in `src/types/annotations.ts`; `PlayerAnnotation.notes?: PlayerNote[]`; `PlayerAnnotation.note` removed.
  - `DB_VERSION = 7`.
  - `db.addNote(uid: number, note: { text: string; date: string | null; briefId?: string; briefName?: string }, player?: PlayerIdentity): Promise<void>`
  - `db.updateNote(uid: number, noteId: string, text: string): Promise<void>`
  - `db.deleteNote(uid: number, noteId: string): Promise<void>`
  - Context: `addNote(uid: number, note: { text: string; briefId?: string; briefName?: string }, player?: PlayerIdentity)` — supplies `date` from `newestSnapshot(useSnapshots().snapshots)?.date ?? null` (`PlayerNotesProvider` sits inside `SnapshotProvider`); `updateNote(uid, noteId, text)`; `deleteNote(uid, noteId)`. All `Promise<void>`, each refreshing annotations.
  - `src/utils/player-notes.ts`: `latestNote(notes: PlayerNote[] | undefined, briefId?: string): PlayerNote | null`; `noteBriefName(note: PlayerNote, briefs: Brief[]): string | null`; `noteSummary(note: PlayerNote, briefs: Brief[]): string`.

**Definition of done:**

- `addNote` trims text; blank text → no write. Generates id with `generateId("note")`, appends to `notes`, refreshes `lastKnownName`/`lastKnownClub` like `setTransfer`, in one `readwrite` transaction.
- `updateNote` trims; blank → no-op; unknown id → no-op; keeps `date`, `briefId`, position. `deleteNote` unknown id → no-op. Both single-transaction.
- `setAnnotation` is a single read-modify-write transaction (same merge semantics as now).
- v7 upgrade: when `oldVersion >= 4 && oldVersion < 7`, cursor over `playerAnnotations`, `delete value.note` + `cursor.update` only for records that have `note`. Only IDB requests awaited. Runs after `migrateToSnapshots` when a `players` store exists, alone otherwise; one `.catch` logging and aborting for the whole chain.
- `setPricing` takes `{ price?, wageDemand? }` only; `PricingFields` has no Note input.
- `noteSummary`: tagged → `"<name>: <text>"` where name is the live brief's name, else `briefName`; untagged or no name → `text`.
- `PlayerStatusBadge` tooltips use `noteSummary(latestNote(notes), briefs)`; `ListsView` Note column shows the same string (cell interactivity comes in Task 2); its rows memo depends on `briefs`.
- `seedAnnotation` drops `note` and accepts `notes?: PlayerNote[]`-shaped objects.

**Verify:** `npx tsc -b && npm run lint` clean; temporary `npx playwright test notes-migration` passes, then the file is deleted.

- [ ] **Step 1: Temporary migration probe** — a spec that opens a raw v6 database (create it with `indexedDB.open(name, 6)` and the six stores, put `{ uid: 1, note: 'old', price: 5 }` and `{ uid: 2, unwanted: true }`), then loads the app and reads back: uid 1 → `{ uid: 1, price: 5 }` without `note`; uid 2 unchanged. Fails before the upgrade exists.
- [ ] **Step 2: Implement** types, upgrade, DB functions, context, helpers, the three readers, seed helper.
- [ ] **Step 3: Verify, delete the probe, commit** — `git commit -m "player notes: storage and helpers"`

### Task 2: Notes log, drawer, profile and /lists

**Files:**

- Create: `src/components/PlayerNotesLog.tsx`, `src/contexts/NotesDrawerContext.tsx`
- Modify: `src/components/Layout.tsx`, `src/views/PlayerProfileView.tsx`, `src/views/ListsView.tsx`

**Interfaces:**

- Consumes: Task 1's context methods and `player-notes.ts`.
- Produces:
  - `PlayerNotesLog({ uid: number; player?: PlayerIdentity; defaultBriefId?: string })`
  - `NotesDrawerProvider`, `useNotesDrawer(): { open(target: { uid: number; name: string; identity?: PlayerIdentity; briefId?: string }): void }`

**Definition of done:**

- Log per spec: add box (textarea *New note*, brief select *No brief* + briefs, *Add note* disabled while blank; adding clears text, keeps brief), entries newest first with date (`isoToDisplay` or *Undated*), tag (link if the brief exists, muted text otherwise; tags only once briefs `isLoaded`), text with line breaks (`whiteSpace="pre-wrap"`), pencil → textarea *Edit note* with *Save* / *Cancel* (blank save = cancel), trash → `ConfirmDialog` with one option *Delete note*. Empty: *No notes yet.*
- Drawer: right side, title = `name`, body = `PlayerNotesLog` keyed per `open` call; closes on route change (`useLocation().key`/pathname effect). Provider mounted inside `BriefProvider` in `Layout`.
- Profile: a *Notes* box under *Pricing* in the normal branch (`player` identity passed); in the missing-player branch a *Notes* box above `PlayerHistory` with no `player`.
- `/lists` Note cell: a button, accessible name `Notes for <name>`, showing the summary clipped to one line with ellipsis or muted *Add note…*; opens the drawer with `{ uid, name: row.name, identity: row.identity }`. Sorting on `note` still sorts by the summary string.

**Verify:** `npx tsc -b && npm run lint`; `verify: human-eyes` items at finish (see header). Behaviour is pinned by Task 3's tests, which go through the profile log.

- [ ] **Step 1: Implement** log, drawer provider, profile boxes, lists cell.
- [ ] **Step 2: Verify and commit** — `git commit -m "player notes: log, drawer, profile and lists"`

### Task 3: Brief page note line; verdict removed; tests and docs

**Files:**

- Modify: `src/types/briefs.ts`, `src/services/db/settings.ts`, `src/utils/brief-picks.ts`, `src/contexts/BriefContext.tsx`, `src/utils/brief-rows.ts`, `src/components/BriefPickControls.tsx`, `src/components/BriefHeatTable.tsx`, `browser-tests/brief-page.spec.ts`, `CLAUDE.md`

**Interfaces:**

- Consumes: Task 1 (`latestNote`, context), Task 2 (`useNotesDrawer`).
- Produces: `BriefRow.note: PlayerNote | null`, `BriefRow.noteCount: number`; `BriefNoteLine({ brief, row })` replacing `VerdictLine`.

**Definition of done:**

- `BriefPick` = `{ uid; grade? }`; `_coercePicks` ignores `verdict`; `setVerdict` removed from `brief-picks.ts` and `BriefContext`; `withField` keyed on `"grade"` only.
- `buildBriefRows` fills `note = latestNote(annotation?.notes, brief.id)` and `noteCount = annotation?.notes?.length ?? 0` for present and absent rows.
- `BriefNoteLine`: clipped one line (`lineClamp={1}`); click → auto-growing textarea, Enter/blur save, Shift+Enter newline, Esc cancel, blank = cancel; existing note → `updateNote`, none → `addNote` tagged `{ briefId: brief.id, briefName: brief.name }` with `row.identity`. Line and editor both named `Brief note for <name>`. *Add note…* placeholder visible on row hover/focus.
- Notes icon button (`Notes for <name>`) in the name row when `noteCount >= 1`; tooltip *Notes* when `noteCount === 1 && row.note`, else *1 other note* / *N other notes* (`noteCount - (row.note ? 1 : 0)`); opens drawer `{ uid, name: row.name, identity: row.identity, briefId: brief.id }`.
- Tests (rewritten in `brief-page.spec.ts`):
  1. *a note written on the brief page shows on the profile under that brief and survives a reload*: grade B + brief note `Quick but raw` on Bea → stored pick `{ grade: 'B' }` and annotation uid 2 has one note with text `Quick but raw`, `briefId: 'b1'`; reload → grade B, line shows the note; `/players/2` shows `Quick but raw` with a `Dribbler` brief tag link (use the seeded brief's actual name).
  2. *a player removed from the shortlist loses his pick but keeps his note*: as the existing test, but after re-adding Dee the grade is `–` and `Plan B` is still on his brief line.
- Both tests mutation-checked: (a) make `buildBriefRows` ignore `briefId` filtering or drop `note` → test 1 or 2 fails; (b) make `addNote` drop `briefId` → test 1 fails; (c) make removal also delete notes → test 2 fails.
- `CLAUDE.md`: *Player notes* section; v6 → v7; Picks line without `verdict`; "the verdict editor" → "the brief note editor".

**Verify:** `npx playwright test brief-page` → all pass; then full `npx playwright test` at final review.

- [ ] **Step 1: Rewrite the two tests** (fail: no `Brief note for` control).
- [ ] **Step 2: Implement** removal of verdict, rows, `BriefNoteLine`, icon.
- [ ] **Step 3: Verify, mutation-check, docs, commit** — `git commit -m "player notes: brief note line replaces verdict"`
