# Archetypes (step 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. After each task an independent reviewer subagent checks the diff against this plan and the spec before the next task starts.

**Goal:** An archetype links to one ordinary `/lists` list; `/scouting` gets a one-click pin and a *Shortlist only* view for it.

**Architecture:** `listId?: string` on `Archetype` (the "many" side holds the reference). Three new `ArchetypeProvider` mutators keep the link in step with list deletion and *New save*; changes made before the first read are queued and replayed onto it. A link whose list is missing renders as no link, and nothing link-related renders until notes have loaded. The picker gains link controls; `ScoutingView` gains a pin and a view-only toggle.

**Tech Stack:** React 19, Chakra UI 3, IndexedDB via `idb`, Playwright, `react-icons/lu`.

**Spec:** `docs/superpowers/specs/2026-11-08-archetype-shortlists-design.md`

## Global Constraints

- Strict TypeScript; `npx tsc -b` and `npx eslint .` clean before every commit.
- No code comments unless the code cannot say it.
- Commit messages: one short lowercase line, no attribution of any kind.
- Tests: Playwright only, behaviour only. One durable test (Task 4), mutation-checked. Temporary tests are deleted before commit.
- Never start the dev server yourself; Playwright's `webServer` may.
- No schema change: `DB_VERSION` stays as is. `PlayerList` is unchanged.
- The link is not a filter: `sameFilters` and *modified* never see it.
- "Linked list" everywhere means: notes `isLoaded && !loadError`, the active archetype has a `listId`, and `lists` contains it. One helper computes it.

---

### Task 1: The link — storage, provider, lifecycle

No visible change on `/scouting` yet.

**Files:**

- Modify: `src/types/archetypes.ts` — `Archetype` gets `listId?: string`.
- Modify: `src/services/db/settings.ts` — `getArchetypes()` keeps `listId` only when a non-empty string (key omitted otherwise).
- Modify: `src/contexts/ArchetypeContext.tsx`
- Modify: `src/views/ImportView.tsx` — New-save branch.
- Modify: `src/views/ListsView.tsx` — `handleDelete` and the *Delete* button.
- Create: `src/utils/archetype-link.ts` — `linkedListOf(archetype, lists, notesReady): PlayerList | null`.

**Provider interface:**

```ts
create: (name: string, filters: ScoutingFilters, listId?: string) => Archetype;
setList: (archetypeId: string, listId: string | null) => void;
unlinkList: (listId: string) => void;
unlinkAll: () => void;
```

- `setList(id, null)` removes the key rather than storing `undefined`.
- All go through `change(...)`.
- **Queue before load:** a `loaded` ref and a `pending` ref. `change(fn)` pushes `fn` to `pending` in its own body (never inside an updater — StrictMode runs updaters twice) while `!loaded.current`. The load handler: `if (loaded.current) return;` (StrictMode runs the load effect twice; a second read must not undo the queue), then `loaded.current = true`, compute `next = pending.reduce((acc, fn) => fn(acc), stored)` outside any updater, clear `pending`, `setArchetypes(next)`, `setIsLoaded(true)`. This replaces today's `changes.current > 0 ? current : stored`. The save effect then writes once `isLoaded` flips, as it already does.

**Steps:**

- [ ] Types, read guard, `linkedListOf`.
- [ ] Provider: queue, mutators, `create`'s optional `listId`.
- [ ] `ImportView`: `const { unlinkAll } = useArchetypes();`, called beside `clearMyClub(); clearPlan(); clearCompareList();`.
- [ ] `ListsView`: `const { archetypes, isLoaded: archetypesLoaded, unlinkList } = useArchetypes();`. *Delete* disabled until `archetypesLoaded`. `handleDelete`: `linkedFrom = archetypes.filter(a => a.listId === activeList.id)`. None → today's message. Some → `"${list}" is the shortlist of ${names.join(", ")}. Delete it and unlink?`. Confirm → `await deleteList(id)`, `unlinkList(id)`, `setActiveTab(null)`.
- [ ] `tsc`, `eslint`, commit: `archetype list link and lifecycle`.

### Task 2: Picker — link controls

**Files:**

- Create: `src/components/LinkListDialog.tsx`
- Modify: `src/components/ArchetypePicker.tsx`

**LinkListDialog** — same shape as `NameDialog`: an outer component takes `isOpen` and returns `null` when closed, so the inner one's state starts fresh on every open. It submits `newName` already trimmed.

```ts
interface LinkListDialogProps {
  title: string;                 // "Link list" | "Change list"
  lists: PlayerList[];
  initialListId: string | null;
  defaultNewName: string;
  onSubmit: (choice: { listId: string } | { newName: string }) => void;
  onClose: () => void;
}
```

- `NativeSelect` with `aria-label="List"`: first option *New list* (value `""`), then every list by name. Initial value `initialListId` if present in `lists`, else `""`.
- With *New list* selected, an `Input` `aria-label="Name"` prefilled with `defaultNewName`. Validation on submit: trimmed empty → *Name is required.*; equal case-insensitively to an existing list name → *A list with that name exists — pick it above.*
- Buttons *Cancel* / *Link*; Enter in the input submits.

**Picker:**

- `const { lists, createList, isLoaded: notesLoaded, loadError } = usePlayerNotes();` `notesReady = notesLoaded && !loadError`; `linked = linkedListOf(active, lists, notesReady)`.
- `…` menu whenever `active`. Items: if `notesReady` → (`linked` ? *Change list…*, *Unlink* : *Link list…*); then *Rename*, *Delete*. The modified block (*modified*, *Save*, *Save as new*, *Revert*) follows the menu.
- When `linked`: `<Text fontSize="sm" color="fg.muted">→ {linked.name}</Text>` straight after the picker button.
- New dialog kind `{ kind: "link"; archetype: Archetype }`. Submit: `{ listId }` → `setList`; `{ newName }` → `try { const list = await createList(newName); setList(id, list.id) } catch { toaster.create({ title: "List Not Created", description: "The list could not be created.", type: "error", duration: 3000 }) }`.
- `saveAsNew`: `create(name, filters, linked?.id)`.

**Steps:**

- [ ] `LinkListDialog`.
- [ ] Picker wiring.
- [ ] `tsc`, `eslint`, commit: `link a list from the archetype menu`.

### Task 3: `/scouting` — pin and Shortlist only

**Files:**

- Create: `src/components/ShortlistPin.tsx`
- Modify: `src/views/ScoutingView.tsx`

**ShortlistPin** `({ listId, uid, player }: { listId: string; uid: number; player: PlayerIdentity })` reads `usePlayerNotes()`: `pinned = lists.find(l => l.id === listId)?.uids.includes(uid) === true`. `IconButton size="2xs"`, `aria-label={`Pin ${player.Name}`}`, `aria-pressed={pinned}`, `variant={pinned ? "solid" : "ghost"}`, `colorPalette={pinned ? "glaucous" : undefined}`, icon `LuPin`, `disabled={isUnwanted(uid)}`; click stops propagation, then `addToList(listId, uid, player)` or `removeFromList(listId, uid)`.

**ScoutingView steps:**

- [ ] From `usePlayerNotes()` take `lists`, `isLoaded`, `loadError` too; `activeArchetype`, `linkedList = linkedListOf(activeArchetype, lists, isLoaded && !loadError)`; `linkedListId = linkedList?.id ?? null`.
- [ ] Status column: when `linkedListId`, render `HStack` of the status control and `<ShortlistPin listId={linkedListId} … />`, width `84px`; otherwise as today. Add `linkedListId` to the columns memo deps (the pin's own state comes from context).
- [ ] No effect: `const [shortlistFor, setShortlistFor] = useState<string | null>(null)`; `shortlistOnly = shortlistFor !== null && shortlistFor === activeArchetypeId`. The checkbox sets `shortlistFor` to `activeArchetypeId` or `null`. In `filteredAndSorted`, after the unwanted filter: `if (shortlistOnly && linkedList) { const pinned = new Set(linkedList.uids); result = result.filter(r => pinned.has(r.uid)); }` with deps; `shortlistOnly` added to the page-reset deps.
- [ ] *Shortlist only* `Checkbox.Root` beside *Hide unwanted*, rendered only when `linkedList`.
- [ ] `tsc`, `eslint`, commit: `pin players to an archetype's shortlist`.

### Task 4: Test, mutation check, docs

**Files:**

- Create: `browser-tests/archetype-shortlist.spec.ts`
- Modify: `CLAUDE.md` (Archetypes section)

**Test** (seed like `archetypes.spec.ts`: three strikers in a ranked league):

> Save archetype *Poacher* → `…` → *Link list…* → *New list* named *Poacher targets* → *Link* → the picker shows *→ Poacher targets* → pin Alice and Bob, unpin Bob → all three strikers visible → tick *Shortlist only* → Alice visible, Bob and Carol not → `/lists`, tab *Poacher targets* holds Alice only → *Delete list*; the confirm text (captured with `page.once('dialog', …)`) contains *Poacher*; accept → `/scouting`: *Poacher* still active; open `…` and expect *Link list…* (proves notes have loaded before the negatives); close it; no `Pin …` buttons, no *Shortlist only*; the stored `archetypes` setting (read with `page.evaluate`) has no `listId` on *Poacher*.

**Mutation check** — each must make the test fail, then be reverted:

1. `ListsView`: drop the `unlinkList` call (caught by the stored-value assertion only — the UI already treats the dangling id as no link).
2. `ScoutingView`: drop the *Shortlist only* filter.
3. `ShortlistPin`: always `addToList`.
4. `ArchetypePicker`: the `{ newName }` branch creates the list but does not `setList`.

**Hand checks** with temporary tests, deleted afterwards: New-save unlink (archetypes survive), shared list, disabled pin on unwanted, Save as new copies the link, unlink before load does not wipe archetypes.

**Docs:** Archetypes section of `CLAUDE.md` — *Shortlist link*: `listId` on the archetype, not a filter, Save as new copies it, missing list = no link, nothing link-related until notes load, list delete confirms and unlinks, New save unlinks all, pre-load changes queued, pin + *Shortlist only* only with an active linked archetype.

**Steps:**

- [ ] Write the test, run it green.
- [ ] Mutation check 1–4.
- [ ] Hand checks.
- [ ] `CLAUDE.md`; commit: `archetype shortlist test and docs`.
