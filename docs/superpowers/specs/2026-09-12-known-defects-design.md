# Known defects, round one

Scope: four of the seven defects recorded in
`2026-09-12-app-scope-design.md`. The three left out are left out on that
document's own reasoning — the DOM-parser rewrite waits behind a measurement
spike, the cohort-size quadratics are unverified and reachable only by ranking
more leagues than the game offers, and the `lastKnownName` / `lastKnownClub`
move is held back so this batch needs no migration and no version bump.

This is the *stop lying* step. Every item is an instance of the app being more
confident than its evidence supports, and none of them depends on import scope.

## What the source document got wrong

Verified against source before designing. Two of its claims about the parser
defect do not hold, and the correction changes what the fix has to be.

**The `NaN` never reaches the screen, and never reaches a percentile.**
`safeNumber` (`src/utils/utils.ts:9-15`) returns `0` for `NaN`, `null` and
`undefined`. Every consumer of the nine fields goes through it — they are read
only via `extract*Stats()` in `src/types/stat-categories.ts` (`:190`, `:211`,
`:219`, `:221`, `:245`, `:246`), never directly. All three cohort builders
(`role-percentiles.ts:30`, `comparison-utils.ts:28`, `scouting-engine.ts:35`)
construct role instances, so every column is built from `safeNumber`-ed
getters. There is no red bar at zero and no literal `NaN` string.

**The second-order comparator hazard is unreachable, for a stronger reason than
the one given.** It is not the import filter that hides it. `safeNumber` sits
between the parser and every column, so removing the filter will not expose it.

**The visible-`NaN` risk is real but sits on different fields.** `Starts` and
`Mins` also use a bare `Number()` (`html-parser.ts:141-144`), and unlike the
nine they are read directly and rendered raw — `PlayerHistory.tsx:116-117`,
`PlayerProfileView.tsx:492`, `SquadTable.tsx:30`, `PlayersView.tsx:80`. No
`safeNumber` on that path.

**What survives is the defect worth fixing.** A statless player's `xA/90`
becomes a confident `0.00`, indistinguishable from a player measured at zero.
Same lie, told without the `NaN` tell. Also noted: `AssistsPer90` and
`ShotsOutsideBoxPer90` are parsed, typed and packed but read nowhere.

## Absent means two different things

The rule this batch establishes, and the reason the parser fix is not uniform:

- **Rate stats** — `xA/90`, `Pas %`, and their kind. Absent means *unmeasured*:
  there were no minutes to form a denominator. Zero is a lie. These become
  `null`.
- **Counting stats** — `Starts`, `Mins`. Absent means *zero*: he did not play.
  Zero is the fact. These stay `number`.

## 1. Parser

`src/parser/html-parser.ts`, `src/types/types.ts`.

Nine rate fields move from bare `Number()` to `processHyphen` with no `?? 0`,
and become `number | null`:

| Field | Column | Parse |
|---|---|---|
| `PasPercentage` | `Pas %` | percent-strip |
| `AssistsPer90` | `Asts/90` | `parseFloat` |
| `xAPer90` | `xA/90` | `parseFloat` |
| `PrPassesPer90` | `Pr passes/90` | `parseFloat` |
| `ShTPer90` | `ShT/90` | `parseFloat` |
| `ShotsOutsideBoxPer90` | `Shots Outside Box/90` | `parseFloat` |
| `NPxGPer90` | `NP-xG/90` | `parseFloat` |
| `exsvPercentage` | `xSv %` | percent-strip |
| `svPercentage` | `Sv %` | percent-strip |

Percent-strip means `(s) => parseFloat(s.replace("%", ""))` passed *into*
`processHyphen`, moving the strip inside the hyphen guard rather than in front
of it.

`Starts` and `Mins` become `processHyphen(..., parseInt) ?? 0` and stay
`number`. `Mins` keeps its comma strip, inside the guard:
`processHyphen(record.Mins, (s) => parseInt(s.replace(",", ""), 10)) ?? 0`. The
existing `typeof record.Mins === "string"` branch goes away — `processHyphen`
already accepts `string | null | undefined`, which is also what removes the
throw risk on `Pas %`, `xSv %` and `Sv %`, whose current `.replace("%", "")`
runs before any guard and would fail on a missing cell.

**One addition, found during self-review.** `createStringProcessor`
(`html-parser.ts:5-15`) nulls only a trimmed `"-"`. An empty cell is still
`parseFloat("") === NaN`. An empty cell is absent by any reading, so the guard
should treat `""` as absent too. This is behaviour-preserving downstream in both
groups — a `?? 0` field goes `NaN → 0` today and `null → 0` after; the nine go
to `null`, which is the point. It is one condition in one function and it closes
the last `NaN`-into-storage path, rather than leaving nine fields half-guarded.

**Nothing downstream changes.** `safeNumber` accepts `unknown` and already maps
`null → 0`, and nothing reads the nine outside `extract*Stats()`. Rendered
output is identical today. What changes is that the distinction between
*unmeasured* and *zero* survives into IndexedDB, which is what the source
document's step 2 — minutes beside every bar — requires and which `?? 0` would
destroy at parse time, permanently.

The `?? 0` convention on the ~30 neighbouring fields is left alone. Converting
them is the same mechanical change and belongs in its own sweep; doing it here
would bury four small fixes in a forty-field diff.

## 2. Documentation

Three corrections, no code change. 900 minutes is the intended rule; five
starts is a superseded concept that `Starts` was never filtered on.

- `CLAUDE.md:31` — 5+ starts becomes 900+ minutes.
- `CLAUDE.md:76` — same.
- `PlayerProfileView.tsx:812` — the empty-state string becomes 900+ minutes,
  matching `:759` twenty lines above it.

And the `useTransition` claim in CLAUDE.md is corrected: it defers the
resulting *render*, not the callback body, which runs synchronously on the main
thread (`ScoutingView.tsx:345-353`, `SimilarPlayers.tsx:51-64`). It is not
protection against a slow function.

## 3. PlayerHistory

`src/components/PlayerHistory.tsx:78`. `entries.length <= 1` becomes
`=== 0`. A player present in one snapshot gets a one-row History table with a
working *Rank this row* — the mechanism for ranking a player in the snapshot
where he actually played, currently hidden from exactly the players who most
need it.

The per-invocation roster load at `:54` is left as is. It is on demand, the
button unmounts once its row is ranked so the same snapshot cannot be
re-fetched, and caching a second roster would cut against the one-roster-in-
memory rule.

## 4. The source document

`2026-09-12-app-scope-design.md` is informational, but its job is to stop
future sessions re-arguing settled questions, and its first defect entry is
wrong. That entry is amended to the findings above. The empty
`### One correction to make` heading is deleted — its content became the
`lastKnownName` / `lastKnownClub` entry in Known Defects.

## Testing

Per project policy: few, behaviour-only, Playwright, and anything kept as a pin
is mutation-checked.

One new test. A player present in a single snapshot shows the History block
with a working *Rank this row*. It is the only user-visible behaviour change in
the batch. Mutation check: reverting `=== 0` to `<= 1` must fail it.

No test for the parser change — it is deliberately invisible, so no browser
test can observe it. `pack.spec.ts` already guards the pack/unpack round trip
that `null` now travels; confirm it covers a `null` field rather than adding a
second test beside it.

Verification: `npm run build` (the `number | null` change is a type change and
`tsc -b` is what proves nothing reads those fields unguarded) and the existing
Playwright suite.

## Out of scope

- The DOM-parser rewrite. Measure first.
- The cohort-size quadratics. Unverified, and gated behind ranking more leagues
  than the game allows.
- `lastKnownName` / `lastKnownClub`. Needs a migration; keeps this batch clean.
- Converting the ~30 `?? 0` fields to `null`. Own sweep.
- Splitting the membership and eligibility gates. Step 2, not step 1.
