# Known Defects Round One Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the app presenting absent data as measured zero, and correct the
three places the documentation and UI state a cohort rule that does not exist.

**Architecture:** Three independent changes, no shared state, no migration and
no database version bump. The parser learns that *absent* means `null` for a
rate stat and `0` for a counting stat; the distinction survives into IndexedDB
because `safeNumber` already flattens `null` to `0` at every read site, so
rendered output is unchanged today. Documentation and one UI string are
corrected to the rule the code actually enforces. `PlayerHistory` stops hiding
itself from single-snapshot players.

**Tech Stack:** TypeScript (strict, `noUnusedLocals`/`noUnusedParameters`),
React 19, Chakra UI 3, `idb`, Vite, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-12-known-defects-design.md`

## Global Constraints

- No schema change, no `DB_VERSION` bump, no migration. If a task appears to
  need one, stop — it is out of scope.
- Rendered output must be identical after Task 1. It is a storage-truth change,
  not a display change.
- Cohort rule is **900+ minutes**. `Starts` is filtered nowhere and must stay
  that way — correct the documentation and the string, never the code.
- No code comments unless the line is genuinely hard to follow (CLAUDE.md).
- Interface prefix `I`; private service methods take an underscore.
- Playwright (`npm run test:browser`) is the only test runner. No Vitest, no
  jsdom, no unit-test layer.
- TDD: every behavior change lands test-first. Run the task's Verify command
  before every commit.
- Commit messages are a single short line, plus the trailer
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

### Task 1: Parser absent-value handling

**Files:**

- Modify: `src/parser/html-parser.ts:5-15` (`createStringProcessor`),
  `:141-181` (field mapping)
- Modify: `src/types/types.ts:20-57` (the nine rate fields)
- Test: `browser-tests/pack.spec.ts` (add cases; the file already holds
  pure-function pins for `parseCustomDate`, `findMissingColumns` and
  `resolveHorizon`, so parser cases belong beside them)

**Interfaces:**

- Consumes: `processHyphen(s: string | null | undefined, processFn) => T | null`,
  defined at `html-parser.ts:17`.
- Produces: `Player.PasPercentage`, `.AssistsPer90`, `.xAPer90`,
  `.PrPassesPer90`, `.ShTPer90`, `.ShotsOutsideBoxPer90`, `.NPxGPer90`,
  `.exsvPercentage`, `.svPercentage` become `number | null`.
  `Player.Starts` and `.Mins` stay `number`.

**Definition of done:**

- `createStringProcessor` treats an empty or whitespace-only string as absent,
  in addition to the trimmed sentinel it already matches. `processHyphen("", f)`
  returns `null`; `processHyphen("   ", f)` returns `null`.
- These nine fields parse through `processHyphen` with **no** `?? 0`:
  `PasPercentage` (`Pas %`), `AssistsPer90` (`Asts/90`), `xAPer90` (`xA/90`),
  `PrPassesPer90` (`Pr passes/90`), `ShTPer90` (`ShT/90`),
  `ShotsOutsideBoxPer90` (`Shots Outside Box/90`), `NPxGPer90` (`NP-xG/90`),
  `exsvPercentage` (`xSv %`), `svPercentage` (`Sv %`).
- `Pas %`, `xSv %` and `Sv %` strip the percent **inside** the guard:
  `processHyphen(record["Pas %"], (s) => parseFloat(s.replace("%", "")))`. The
  current form calls `.replace` on the raw value before any guard and throws on
  a missing cell.
- `Starts` is `processHyphen(record.Starts, (s) => parseInt(s, 10)) ?? 0`.
- `Mins` is
  `processHyphen(record.Mins, (s) => parseInt(s.replace(",", ""), 10)) ?? 0`.
  The existing `typeof record.Mins === "string"` branch is deleted —
  `processHyphen` already accepts `string | null | undefined`.
- The ~30 neighbouring `?? 0` fields are **not** touched.
- Nothing outside `extract*Stats()` reads the nine, so `tsc -b` passing is the
  proof that `number | null` reaches no unguarded consumer.

**Verify:** `npm run build` → exits 0, and
`npx playwright test browser-tests/pack.spec.ts` → all pass

- [ ] **Step 1: Failing tests in `browser-tests/pack.spec.ts`** — import
      `transformPlayerStats` from `../src/parser/html-parser`. Build one record
      from `REQUIRED_COLUMNS` with every cell `"0"`, then override per case.
      Cases and expected values:
      `"xA/90": "-"` → `xAPer90 === null`;
      `"xA/90": ""` → `xAPer90 === null`;
      `"xA/90": "0.31"` → `xAPer90 === 0.31`;
      `"Pas %": "-"` → `PasPercentage === null`;
      `"Pas %": "82%"` → `PasPercentage === 82`;
      `"Sv %": "-"` → `svPercentage === null`;
      `"Mins": "-"` → `Mins === 0`;
      `"Mins": "1,234"` → `Mins === 1234`;
      `"Starts": "-"` → `Starts === 0`.
      Plus the no-visible-change pin: `safeNumber(null) === 0` and
      `safeNumber(NaN) === 0`, imported from `../src/utils/utils`.
- [ ] **Step 2: Widen the guard** — add the empty/whitespace condition to
      `createStringProcessor` (`html-parser.ts:10`).
- [ ] **Step 3: Rewrite the field mapping** — the nine rate fields, then
      `Starts` and `Mins`, exactly as specified above.
- [ ] **Step 4: Widen the types** — the nine fields in `src/types/types.ts`
      become `number | null`. Run `npm run build`; if `tsc` reports a consumer
      outside `stat-categories.ts`, stop and report it — the spec's claim that
      none exists would be wrong and the design needs revisiting.
- [ ] **Step 5: Verify and commit** — run both Verify commands, then
      `git commit -m "parse absent rate stats as null, absent minutes as zero"`

---

### Task 2: Correct the cohort rule and the useTransition claim

**Files:**

- Modify: `CLAUDE.md:31`, `CLAUDE.md:76`, `CLAUDE.md:83`
- Modify: `src/views/PlayerProfileView.tsx:812`

**Interfaces:**

- Consumes: nothing.
- Produces: nothing. Documentation and one string only — no behavior change.

**Definition of done:**

- `CLAUDE.md:31` reads:
  `- **Cohort Filtering**: Players compared must have same role, be in ranked leagues, and have 900+ minutes`
- `CLAUDE.md:76` reads `(role match + ranked league + 900+ minutes)` in place of
  `(role match + ranked league + 5+ starts)`.
- `CLAUDE.md:83` states that `useTransition` defers the resulting *render* only,
  and that the callback body runs synchronously on the main thread, so it is not
  protection against a slow function.
- `PlayerProfileView.tsx:812` ends `with 900+ mins.` instead of
  `with 5+ starts.`, matching the string at `:759` twenty lines above it.
- No `.ts`/`.tsx` file gains or loses a `Starts` filter.

**Verify:** `grep -rn "5+ starts" CLAUDE.md src` → no matches, and
`npm run build` → exits 0

- [ ] **Step 1: Edit the three CLAUDE.md lines** — exact replacements above.
- [ ] **Step 2: Edit the empty-state string** — `PlayerProfileView.tsx:812`.
- [ ] **Step 3: Verify and commit** — run both Verify commands, confirm
      `grep -rn "Starts" src/utils/` still shows no filter, then
      `git commit -m "correct the cohort rule to 900+ minutes in docs and empty state"`

---

### Task 3: Show history for a single-snapshot player

**Files:**

- Modify: `src/components/PlayerHistory.tsx:78`
- Test: Create `browser-tests/player-history.spec.ts`

**Interfaces:**

- Consumes: `seedSnapshots(page, snapshots, activeId?)` from
  `./helpers/seed`, where each snapshot is
  `{ id: string; date: string | null; players: Array<{ uid: number; name: string; club?: string }> }`.
  Its seeded players are strikers with `Mins: 1800`, `Starts: 20`.
- Produces: nothing consumed by other tasks.

**Definition of done:**

- `PlayerHistory` returns `null` only when the player appears in **no**
  snapshot (`entries.length === 0`). A player in exactly one snapshot renders
  the History block.
- That single row carries a working *Rank this row* button when a role is
  selected — this is the whole point of the change, not a side effect.
- The change is one comparison. Nothing else in the component moves.

**Verify:** `npx playwright test browser-tests/player-history.spec.ts` → passes

- [ ] **Step 1: Failing test** — `browser-tests/player-history.spec.ts`. Load
      `/import` once so the stores exist, then `seedSnapshots` with two
      snapshots: `{ id: 'old', date: '2035-01-24', players: [{ uid: 2, name: 'Other Striker' }] }`
      and `{ id: 'new', date: '2036-05-01', players: [{ uid: 1, name: 'Lone Striker' }] }`,
      active `'new'`. Reload, go to `/players/1`. Assert the `History` heading
      is visible, that the row for `01/05/2036` is visible, and that a
      `Rank this row` button is visible. Player 1 must be in the **active**
      snapshot so the profile renders its normal branch at
      `PlayerProfileView.tsx:837` (which passes a real `roleKey`) rather than
      the not-in-this-snapshot branch at `:175` (which passes `roleKey={null}`
      and shows no button).
- [ ] **Step 2: Change the guard** — `entries.length <= 1` becomes
      `entries.length === 0`.
- [ ] **Step 3: Mutation-check the pin** — revert the guard to `<= 1`, confirm
      the test **fails**, restore `=== 0`, confirm it passes. Required by
      project policy for any test kept as a pin.
- [ ] **Step 4: Verify and commit** — run the Verify command, then
      `git commit -m "show history and rank-this-row for a single-snapshot player"`

---

## Final review

- [ ] `npm run build` → exits 0
- [ ] `npm run lint` → exits 0
- [ ] `npm run test:browser` → full suite passes
- [ ] `git log --oneline -3` shows the three commits above

## Already done

Spec section 4 — amending the misdiagnosed parser entry in
`2026-09-12-app-scope-design.md` and deleting its empty
`### One correction to make` heading — landed in commit `66dc7ec` alongside the
spec. No task covers it. Do not redo it.

## Out of scope

Do not attempt these; each is deferred in the spec with its reason.

- The `DOMParser` to streaming rewrite. Measure first.
- The goalkeeper/similarity cohort quadratics. Unverified and gated behind
  ranking more leagues than the game offers.
- Moving `lastKnownName` / `lastKnownClub` off `PlayerAnnotation`. Needs a
  migration.
- Converting the ~30 `?? 0` parser fields to `null`. Its own sweep.
- Splitting the membership and eligibility gates, or putting minutes beside
  every bar. That is step 2.
- Deleting `AssistsPer90` / `ShotsOutsideBoxPer90`, which are read nowhere.
  Noted in the spec, not scheduled — removing a packed field is a storage
  decision.
