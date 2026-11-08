# Stat groups cleanup

Fixes the stat categories and group ratings flagged in `src/types/stat-categories.ts`, and explains each group in its header tooltip.

## Why

A group rating sums the percentiles of its stats and ranks that sum (`groupSumOf` in `src/utils/scouting-engine.ts`). Percentiles are unitless, so mixing ratios and per-90s is fine — but every stat weighs the same, so stats measuring one thing several times weigh that thing several times. That, plus a few plain bugs, is what this fixes:

- **Possession** sums won + (100 − lost) + retention, where retention = won − lost: both counted twice. Retention itself nets two unrelated skills (12 won / 12 lost scores the same as 2 / 2).
- **Attacking (ST)** is three finishing outcomes (`goals`, `xGOverperformance`, `conversionRatio`) out of five.
- **Movement** holds crossing, a separate skill.
- **Physical** rates `age` uninverted, so older players rate higher; `height` adds nothing beside the aerial stats.
- **`pressuresSuccessful`** is documented as a count but holds completed ÷ attempted.

Kept as it is: the user's `chancesCreated` doc comment.

## Stat interfaces (`src/types/stat-categories.ts`)

- Remove `IPhysicalStats`, `extractPhysicalStats`, and the ERRORS block.
- `IPossessionStats` loses `ballRetention` and keeps `possessionWon`, `possessionLost` where they are. Neither is in any group rating.
- `IDefensiveStats`: add `pressuresAttempted` (`PresAPer90`); rename `pressuresSuccessful` → `pressureRatio`, documented as completed ÷ attempted.
- New `ICrossingStats` (`crossRatio`, `crossesSuccessful`) with `extractCrossingStats`; both leave `IMovementStats`, which keeps `dribbles`, `sprints`.
- `STAT_MAPPING` follows.

Role classes (`src/roles/*.ts`) follow the interfaces: `ballRetention` and `height` go. `pressureRatio` and `pressuresAttempted` are instance fields on every role whose Defensive group or columns use them — CD, FB, DM, CM, W, ST — because the engine reads stats by string key (`scouting-engine.ts`), so a missing field silently scores 0 rather than failing `tsc`. Every outfield class exposes `possessionWon`; classes that expose `possessionLost` today keep it (only DM shows it). Crossing fields stay on FB and W.

`src/processors/*.ts` is imported nowhere but compiled (`include: ["src"]`). It is updated, not deleted: `pressuresSuccessful` → `pressureRatio`, `ballRetention` dropped from its archetype key lists. Deleting it is a separate cleanup.

## Group ratings (`src/utils/stat-group-mapping.ts`)

`StatGroup` gains `description: string`.

| Group | Roles | Stats |
|---|---|---|
| Defensive | CD, FB, DM, CM | tackleRatio, pressureRatio, pressuresAttempted, defensiveContributions |
| Defensive | W | pressureRatio, pressuresAttempted |
| Defensive | ST | tackleRatio, pressureRatio, pressuresAttempted |
| Attacking | ST | npxG, shots, conversionRatio |
| Attacking | AM, W | npxG, conversionRatio |
| Attacking | CM | npxG |
| Crossing | FB, W | crossRatio, crossesSuccessful |
| Movement | FB, CM, W | dribbles, sprints |
| Movement | AM, ST | dribbles |

Possession and Physical groups are removed from every role. All other groups are unchanged.

Group order within a role: Crossing goes right after Movement for FB and W; everything else keeps its place.

Descriptions, one per group key. Each states the concept only; the tooltip's stat list carries the role's specifics, since the same group holds different stats per role:

- **Goalkeeper** — Stopping shots and keeping goals out.
- **Defensive** — Winning the ball back and stopping attacks.
- **Aerial** — Competing for the ball in the air.
- **Passing** — Moving the ball on with passes.
- **Creative** — Setting up chances for others.
- **Attacking** — Getting into scoring positions and finishing.
- **Crossing** — Delivering the ball from wide areas.
- **Movement** — Moving with the ball and without it.
- **Error** — Mistakes that lead to goals; lower is better.

## Display columns (`src/roles/index.ts`)

- `possessionWon` as a column on every outfield role (today it is only rated, inside Possession), placed after the role's defensive columns, or last if it has none.
- `possessionLost` on DM only, right after `possessionWon`. The `ballRetention` columns on DM and AM go.
- `tackles` stays where it is shown today.
- `pressuresSuccessful` → `pressureRatio` in `statKeys` (CD, FB, DM, CM), with `pressuresAttempted` right after it on those four roles.
- ST keeps `goals` and `xGOverperformance` as unrated columns.
- `STAT_LABELS` (`src/roles/index.ts`) and `STAT_ABBREVIATIONS` (`src/utils/scouting-columns.ts`): `pressureRatio` "Press Ratio" / "Pr%", `pressuresAttempted` "Pressures" / "PrA", `possessionWon` "Poss Won" / "PW", `possessionLost` "Poss Lost" / "PL"; `pressuresSuccessful`, `ballRetention` removed. `GROUP_ABBREVIATIONS` gains `crossing: "Cro"` (not "Crs", which is already the Crosses column), loses `possession`, `physical`.
- Intended knock-on: `statKeys` also drives the profile and compare percentile bars, Similar Players distances and Player History's *Rank this row*, so those pick up the same columns.
- `possessionLost` stays in `INVERTED_STATS`, so its percentile reads lower-is-better.

## Group tooltips

The group header tooltip, today just the label, shows the label, the description and the role's stat list by label, e.g.:

> **Defensive** — Winning the ball back and stopping attacks.
> Tackle Ratio · Press Ratio · Pressures · Def. Contributions

One helper builds it from a `StatGroup`; `ScoutingView` and `BriefHeatTable` both use it. `headerTooltip` in `src/components/ui/table.tsx` widens from `string` to `ReactNode`. On the brief page, `heatKeys()` (`src/utils/brief-rows.ts`) flattens groups to `HeatKey { key, abbr, label }`; it gains an optional `group: StatGroup` for group entries, and `BriefHeatTable` renders the tooltip from it (JSX stays out of the plain `.ts` util); `label` stays a string because it also feeds the cell `aria-label`.

## Profile and compare views

`PlayerProfileView` and `CompareView`: the Possession section keeps Poss Won and Poss Lost and drops Retention; Defensive reads Press Ratio from `pressureRatio` and adds Pressures after it; Cross % and Crosses leave Movement for a new Crossing section, read through `extractCrossingStats`. (There are no Physical rows; the header's height reads `player.Height` and is unaffected.)

## Saved briefs and working state

**A brief broken by this change is deleted, not migrated.** Its linked list is untouched, so its players survive; its picks (grades, verdicts, rank) go with it. The user recreates the brief.

A brief is broken if its `columnFilters` or `sortKey` names a key that existed **for the brief's role** before this change and was removed or changed meaning. Keys from another role are ignored by scouting anyway (switching role tab keeps filters), so a stale one never breaks a brief. Keys as stored, with the `stat_` / `group_` prefixes `ScoutingView` writes:

| Role | Broken keys |
|---|---|
| CD | `stat_pressuresSuccessful`, `group_possession`, `group_physical`, `group_defensive` |
| FB | `stat_pressuresSuccessful`, `group_possession`, `group_physical`, `group_defensive`, `group_movement` |
| DM | `stat_pressuresSuccessful`, `stat_ballRetention`, `group_possession`, `group_defensive` |
| CM | `stat_pressuresSuccessful`, `group_possession`, `group_defensive` |
| AM | `stat_ballRetention`, `group_possession` |
| W | `group_possession`, `group_defensive`, `group_movement` |
| ST | `group_possession`, `group_defensive`, `group_attacking` |
| GK | none |

No newly added key (`stat_possessionWon`, `stat_possessionLost`, `stat_pressureRatio`, `stat_pressuresAttempted`, `group_crossing`) was ever a column, so no stale key turns live. `derived_` keys are unchanged.

**One-time, versioned.** Stored briefs carry `statsVersion`; the in-memory `Brief` type does not.

- `db.getBriefs()` returns `{ briefs, removed }`: an entry without `statsVersion >= 2` whose filters are broken is left out and its name added to `removed`. It does not write.
- `db.setBriefs()` stamps every entry `statsVersion: 2`. Everything in memory has passed the check or was made after the change, so stamping on write covers create, save and edit alike.
- `BriefProvider` raises the toast on the initial load only, after its `loaded.current` guard, so StrictMode's double effect cannot show it twice. Its existing save effect, which runs when `isLoaded` flips, writes the cleaned, stamped set — the toast does not come back after a reload. The tab-return re-read applies the same cleanup silently.
- Residual risk, accepted: a tab still running the old code strips the stamps on its next write, and the new code then re-checks those briefs.

Toast: title "Briefs removed", description naming them and saying "Linked lists are kept."

**Working state** (`scouting-filters` in `localStorage`): `saveWorkingState` itself writes `statsVersion: 2`, so both of its callers (`ScoutingView`, and *Open in scouting* on `BriefView`) are covered. On load, an unversioned value broken by the table keeps its `roleKey` and `side`, resets everything else to the defaults and clears the active brief id. An active id pointing at a deleted brief already falls back to *No brief* (`ScoutingView`).

The rule is one function next to `coerceFilters` (`src/utils/scouting-filters.ts`), shared by both reads.

## Testing

No new committed test: the brief cleanup is a one-time migration, not a behaviour to pin.

A temporary Playwright test checks the cleanup while it is built, then is deleted: seed two unversioned briefs, one with a `ballRetention` threshold and one with only a `tackleRatio` threshold, both linked to a list. Both are DM briefs. Load `/briefs`: the first is gone and the toast names it, the second remains, the list still holds its players. Reload: no toast.

`tsc`, lint and the existing suite must pass.

## Later

- Penalty goals and goals from outside the box, to correct conversion for penalty takers and long-range shooters.
