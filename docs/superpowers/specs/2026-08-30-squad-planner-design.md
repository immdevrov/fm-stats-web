# Squad Planner — Design

Date: 2026-08-30
Status: Approved for planning
Sub-project: C of A–E (see Roadmap in the sub-project A spec)

## Problem

FM Jotter can rank a player and record a judgement about him, but it cannot
arrange players. Two questions it has no way to answer:

1. **Where is the squad thin?** The squad table sorts by starts. It cannot show
   that the left-back has no deputy, or that the two centre-backs behind the
   first choice are the same man.
2. **Does the shortlist fix that?** Sub-project A can record that a player is
   worth signing. Nothing connects him to the hole he would fill.

Both are the same board. Sometimes the candidates are next season's targets,
sometimes they are the current squad in a different tactic — the source of the
names varies, the tool does not. Building two modes would be building the same
thing twice.

## Scope

In scope: a Planner tab on `/my-team`, a built-in formation catalogue, one
ranked depth stack per slot, a candidate panel over the squad and A's lists,
the card status system, and plan persistence.

Out of scope, and each deliberate rather than merely unbuilt: computed
statistics of any kind, tactical roles and duties, named plans, placeholder
players, an explicit "outgoing" flag, auto-seeding, drag and drop, the
depth-grid view, the alternative card colouring, and deriving the in-game date
from the import filename.

Mockups: `design/planner/` (working files) and the canvas at
<https://claude.ai/code/artifact/cac881ae-9f6a-4594-acf5-b9f45457e65a>. Its
"Parked" page holds the two deferred views.

## Decisions

Settled during brainstorming; not open for re-litigation during implementation.

| Decision | Choice | Consequence |
|---|---|---|
| Slot identity | Position only | No tactical role or duty is stored; nothing to validate against |
| Depth | Ranked stack, at most 3 | Order is meaningful: index 0 is first choice |
| One player, many slots | Allowed | A capability chart, not an allocation; needs the counted-elsewhere marker |
| Seeding | None | Every card is placed by hand |
| Placeholders | None | An empty position in a stack *is* the recorded need |
| Departures | Derived from contract date and A's `unwanted` | No new stored state |
| Candidates | Own squad plus A's lists | To board an outsider, list him first |
| Formation source | Built-in catalogue | A ninth shape is a data edit, not a feature |
| Formation switch | Clears the board, after a confirm | Cheapest correct thing; named plans supersede it later |
| Position matching | Strict | No D↔WB or M↔DM equivalence — the game treats those as unfamiliar too |
| Card statuses | One channel per question (below) | A tint always means the same thing |
| Statistics | None | The board exposes its first choices; team statistics consumes them |
| Layout | Formation shape | The depth grid is a later view over the same data |
| Storage | One value in the existing `settings` store | No schema change; database stays at version 5 |
| In-game date | Unknown; an explicit planning date instead | Nothing is invented from the machine's clock |

## The board

`/my-team` gains a tab bar with **Squad** and **Planner**, on two routes,
`/my-team` and `/my-team/planner`, so a reload and a bookmark both land where
the user left off. No new navigation entry: the planner is a view of your team,
not a ninth section of the app.

On a first visit there is no plan and no formation. The board is replaced by a
formation picker — "Which shape are you planning?" — over the catalogue. Picking
one creates the plan with every slot empty.

Thereafter the board is the formation's rows, centred, goalkeeper at the bottom.
Each slot carries a label and a vertical stack, first choice on top. To the
right, a panel with two tabs: **Squad** and **Lists** (A's list members).

The Squad tab lists players placed in **no** slot at all — it answers "have I
forgotten anyone", so a player already on the board leaves it. Unwanted players
stay in it, dimmed and marked, rather than being hidden: a player ruled out is
still a player you have.

The candidate popover opened from a slot is a different set, and deliberately so:
it offers every squad and list player, including those already placed elsewhere,
because a defender covering two flanks is the point of the board. It excludes
only the players already in *that* stack, which no slot may hold twice.

## Formations

Static data in `src/formations/`, never persisted:

```ts
interface FormationSlot {
  id: string;                // unique within the formation, e.g. "D-C-1"
  position: PlayerPosition;  // { type: "D", side: ["C"] }
  row: number;               // 0 = goalkeeper, increasing towards the attack
}

interface Formation {
  id: string;                // "4-2-3-1"
  name: string;
  slots: FormationSlot[];
}
```

Rows rather than pitch coordinates. The board is a stack of centred rows, so
`x`/`y` would be forty numbers to keep consistent for no visible gain.

Opening catalogue: 4-4-2, 4-4-1-1, 4-2-3-1, 4-1-4-1, 4-3-3, 3-5-2, 5-3-2,
3-4-3.

Note what strict matching does to 3-5-2 and 5-3-2: their flank slots are `WB`,
so a `D (L)` full-back placed there is out of position and tinted. That is
intended — in the game he is unfamiliar with the wing-back position in the DM
strata, and plays there with restrictions. It is recorded here so it is not
later mistaken for a bug.

## The matching rule

```ts
function matchesSlot(player: Player, slot: FormationSlot): boolean
```

Read through `getEffectivePosition(player)`, so a custom position from A counts.
The player matches when he has a position of the slot's **type** whose **side**
includes the slot's side. There are no equivalences: `WB` never satisfies a `D`
slot, `M` never satisfies an `AM` slot, and a left-back never satisfies a
right-back slot.

One narrow allowance, about data shape rather than football: a missing `side` on
either the slot or the player is a wildcard for that comparison, because the
export writes `DM` with no side at all. Both sides stated and different is a
mismatch.

## Card statuses

Seven things can be true of a card at once. Each visual channel answers exactly
one question, so they never compete:

| Channel | Question | States |
|---|---|---|
| Fill | Does he play here? | White. `spicyPaprika.50` on a `spicyPaprika.200` border when he does not |
| Left edge | Where did he come from? | Nothing for your own players; 3px `glaucous.500` for a list member |
| Glyphs | What is true of the man? | A's star with list count, A's `unwanted` mark, a medical mark for `RcInjury` |
| Rank pip | Where is he in the stack? | 1, 2, 3 |
| Second line | | Positions and contract date — replaced by the mismatch when out of position |
| Counted-elsewhere badge | Is he already spoken for? | Grey outline: cover in another slot. Filled paprika "1st ×2": first choice in more than one |

The organising principle is that these are two families. **Out of position** and
**counted elsewhere** are facts about *this placement*; **unwanted**, **listed**,
**injury-prone** and the **contract** are facts about *the player*, identical in
every slot he occupies. Fill is reserved for the first family and carries
exactly one meaning, so a tinted card never has to be interpreted.

Unwanted rows are dimmed and struck through, and — as in A — the status glyph is
exempt from the dimming.

Nothing here is stored. Every state is derived from the plan, the player record
and A's annotations on each render.

### The planning date

A contract date only means something against a date to compare it to, and the
app has no idea what date the save is on: `filterByContractExpiryDate` takes an
explicit `currentDate`, and Scouting makes the user type one.

So the toolbar carries one field, **Planning for**, empty by default. A contract
expiring on or before it turns paprika; empty means no contract tint at all.
Nothing is derived from the machine's clock.

That field is also what makes one board serve both uses: set it to next June and
every deal ending first lights up; leave it blank and you are simply looking at
the squad in another shape.

### Deciding an out-of-position placement

Clicking a tinted card offers three actions:

1. **Add the slot's position to his positions** — writes through A's
   `updatePlayerPosition`, so the tint clears in every slot he occupies. The
   popover names the consequence: a custom position also moves him between
   Scouting cohorts, because `getEffectivePosition` feeds every `isRole`.
2. **Move him to another slot** — a picker of the slots he does match.
3. **Leave it** — the tint stays. He has been seen and allowed.

## Data model

No schema change. The plan is one value in the `settings` store created by
sub-project B, so it survives a re-import for the same reason the club does:
`clearAllPlayers()` does not touch that store. The database stays at version 5.

```ts
// settings key 'squadPlan'
interface SquadPlan {
  formationId: string;
  horizon: string | null;    // "DD/MM/YYYY"; null = no planning date set
  slots: PlannedSlot[];
}

interface PlannedSlot {
  slotId: string;
  players: PlannedPlayer[];  // ordered, index 0 is first choice, at most 3
}

interface PlannedPlayer {
  uid: number;
  name: string;
  club: string;
}
```

`name` and `club` are a snapshot, refreshed on every write, and exist for one
reason: an orphan must render as a person rather than a number. This is A's
`lastKnownName` policy — A's annotations cannot serve here, because a squad
player may be placed on the board without ever being annotated.

Reached only through a typed pair in `src/services/db/settings.ts`:

```ts
getSquadPlan(): Promise<SquadPlan | null>
setSquadPlan(plan: SquadPlan | null): Promise<void>
```

### The settings module

B's review recorded that `settings.ts` inlines its store access instead of
keeping a private untyped get/set behind the typed pair, and noted that the
second preference would copy two `try`/`catch` blocks rather than compose. The
plan is that second preference, so this sub-project makes the fix as part of
adding it.

### Why not a store keyed by formation

Keying assignments by formation id would preserve every board across a formation
switch, and looks nearly free. It is a trap: two plans for the *same* shape —
the rebuild and the fallback — is exactly what named plans will need, so the key
would already be wrong and the data would have to be migrated out of it. One
board, cleared on a confirmed formation switch, keeps that door open. A
`squadPlans` store arrives with named plans or not at all.

## State layer

`SquadPlanProvider` in `src/contexts/SquadPlanContext.tsx`, modelled on
`MyTeamContext` — load once on mount, persist on change — mounted in `Layout`.

Exposed by `useSquadPlan()`:

- `plan: SquadPlan | null` — `null` until a formation is picked
- `isLoaded: boolean`
- `setFormation(id)` — replaces the formation and clears every assignment.
  It does not ask; the confirm belongs to the view, which knows whether the
  board holds anything worth losing
- `setHorizon(date)`
- `place(slotId, player)`, `remove(slotId, uid)`, `makeFirstChoice(slotId, uid)`
- `placements: Map<number, Array<{ slotId: string; rank: number }>>`

`isLoaded` gates the board for the same reason it gates `/my-team`: without it
an empty board renders for a frame before the saved plan arrives, and a plan
written while the initial read is still in flight would be overwritten by it
landing late.

`placements` is derived from the plan by a pure function in
`src/utils/planner.ts` and memoised in the provider. It is what answers "is he
first choice twice" without any view walking the whole plan.

## Components

| File | Responsibility |
|---|---|
| `src/views/MyTeamView.tsx` | Becomes the shell: the club gate (`isLoaded`, no club, club absent) and the tab bar, rendering one of two children |
| `src/components/planner/SquadPlanner.tsx` | Board plus candidate panel |
| `src/components/planner/PlannerBoard.tsx` | Formation rows and slots |
| `src/components/planner/PlannerSlot.tsx` | Label, stack, and the empty position |
| `src/components/planner/PlannerCard.tsx` | One card and every status channel |
| `src/components/planner/CandidatePanel.tsx` | Squad and Lists tabs |
| `src/formations/index.ts` | The catalogue |
| `src/utils/planner.ts` | `matchesSlot`, `buildPlacementIndex`, status derivation |

The club gate lives in exactly one place. `SquadTable` and `SquadPlanner` are
both handed a club that is known to exist.

The empty position at the bottom of a stack is labelled by what it means:
"Nobody" for an empty slot, "No cover" for a slot with only a first choice,
"Add" for a slot with two. A full stack shows no empty position.

## Interaction

No drag and drop. Clicking an empty position opens a popover over the squad and
the lists, with matching players first and the rest below a divider, so placing
someone out of position takes a deliberate scroll past the players who fit. A
card's menu offers "Make first choice" and "Remove".

## Import behaviour

The plan lives in `settings`, which a re-import does not clear, so it survives
without any change to the import flow.

It does **not** join the "Preserve data" dialog, and the Import view gains no
"Clear Squad Plan" button. The dialog lists categories the import can destroy;
this one it cannot. The planner owns clearing the board.

### Orphans

A re-import may not contain a placed player. Following A and B, the entry is
kept and the absence is reported: the card renders from its `name`/`club`
snapshot, dimmed, marked "not in current data", and keeps its position in the
stack. Nothing is reinterpreted — he is not silently demoted to "no cover".

The toolbar shows "N not in current data" with a "Remove missing" action, the
same manual, visible cleanup A gives each list.

## Boundary with team statistics

The unbuilt half of sub-project B is a team statistics screen, and a planner
that answered "how does this change the side" would grow a rival implementation
of it before it arrived.

So C computes nothing. Every value on a card is already on the player record or
in A's annotations. To judge whether a player is good, the card links through to
his profile.

What C provides instead is the seam: the plan's first choices are a set of uids,
which team statistics can read to describe the projected side. The relationship
is one of consumer to producer, not two features overlapping.

## Testing

Per project policy: behaviour tests only, main behaviours only, Playwright
browser mode only, no unit or jsdom layer. No tests are added by default.
Temporary tests written while debugging are deleted afterwards.

One candidate is pinned for a decision after implementation, not before: **the
board survives a re-import** — place a player, re-import, confirm he is still in
his slot. If it is pinned, it must then be validated by mutation testing.

## Follow-ups

Deliberately deferred, recorded so they are not rediscovered as gaps:

- **The in-game date from the import filename.** The user's import files follow
  a naming convention that encodes the save's date. Reading it would let the app
  fill the planning date — and give contract filters everywhere a real "today"
  instead of a typed one. Nothing in the parser looks at the filename today.
- **Named plans.** Several boards with names, switched between. The reason
  today's plan is not keyed by formation id.
- **The depth grid**, on the canvas's Parked page: the same slots and stacks as
  a grid, rows for slots and columns for first, second and third choice. A tab
  over the same data, better at spotting holes, and able to grow a fourth
  column.
- **The alternative card colouring**, also parked: tint by how much is wrong
  rather than what. The card data is identical; only the rule that colours it
  differs, so it is a styling change rather than a re-model.
- **Drag and drop** between the panel and the board, and within a stack.
