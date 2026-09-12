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

Percent-strip turned out to be unnecessary: `parseFloat("82%")` is already `82`,
so all three take a plain `parseFloat` like the other six. The strip existed only
because `Number("82%")` is `NaN`. Removing it also removes the `.replace` that
ran *before* any guard and threw outright on a missing cell.

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
to `null`, which is the point. It is one condition in one function, rather than
leaving nine fields half-guarded.

**Eleven fields, not nine — corrected during review.** Four more carry the same
defect and are in scope:

- `goals90` (`Gls/90`) and `TckPer90` (`Tck/90`) already parsed through
  `processHyphen` with no `?? 0`, so they were `number | null` at runtime while
  `types.ts` declared them `number`. The `as Player` cast hid it. Widening their
  type removes a pre-existing lie rather than adding one.
- `OPKPPer90` (`OP-KP/90`) and `xGOP` (`xG-OP`) use a third pattern that neither
  the nine nor the `?? 0` exclusion covers: `Number(record[...] || 0)`. `"-"` is
  truthy, so the `|| 0` never fires and the field stores `NaN`. Both are
  ROLE_CONFIG display stats (`keyPasses`, `xGOverperformance`), so without this a
  statless player's xA reads honestly as absent while his Key Passes still reads
  a confident `0.00` on the same screen.

`UID` and `Age` keep their bare `Number()`. They are identity, not evidence: a
player missing them is a broken row, not an unmeasured one. So this batch does
not close every `NaN`-into-storage path — it closes every one that feeds a
displayed statistic.

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
`=== 0`. A player present in one snapshot gets a one-row History table instead
of nothing.

**Where the value actually lands — corrected during review.** This section first
justified the change as unhiding *Rank this row* for the players who most need
it. That is not what it does, and the distinction matters enough to record.

The button is gated on `roleKey` (`PlayerHistory.tsx:126`). The profile passes a
real `roleKey` only on its normal branch (`PlayerProfileView.tsx:837`), which
renders for a player who *is* in the active snapshot — and there the button
recomputes the same cohort as the percentile bars twenty pixels above it, so it
adds a roster read and returns what is already on screen. The
not-in-this-snapshot branch (`:175`) passes `roleKey={null}`, so it shows no
button at all.

The real gain is that second branch: a player absent from the active snapshot
but present in one other snapshot previously rendered no history whatsoever, and
now renders his last known row. Ranking a single-snapshot player where he
actually played remains unavailable, and belongs on the defects list rather than
here.

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

One new behaviour test. A player present in a single snapshot shows the History
block with a working *Rank this row*. It is the only user-visible behaviour
change in the batch. Mutation check: reverting `=== 0` to `<= 1` must fail it.

*Revised while planning.* This section first said the parser change could not
be tested, on the grounds that it is invisible and Playwright only sees the UI.
That is wrong: `browser-tests/pack.spec.ts` already imports and exercises pure
functions directly — `parseCustomDate`, `findMissingColumns`, `resolveHorizon`,
`pack`/`unpack` — under the same runner. `transformPlayerStats` is exported and
belongs beside them. So the parser change gets cases there: `-` and `""` give
`null` for a rate stat, `-` gives `0` for `Mins` and `Starts`, and a real value
still parses. Without them the whole point of choosing `null` over `?? 0` —
that the distinction reaches storage — is asserted and never checked.

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
