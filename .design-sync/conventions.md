## Building with FM Jotter

FM Jotter is the design system of a Football Manager scouting app. It is **Chakra UI 3 (Emotion,
CSS-in-JS) plus a custom theme**. There is no stylesheet to read: `styles.css` is a deliberate
runtime stub and `tokens/` is empty, because `<Provider>` injects every style at runtime. Do not
look for CSS custom properties — there are none.

### Required wrapper

Every tree must be wrapped in `<Provider>`. It supplies the Chakra system (`customSystem`) and the
next-themes colour-mode context. **Without it components throw or render completely unstyled** —
this is the single most common failure.

```jsx
const { Provider, PercentileBar } = window.FMJotter;
<Provider>
  <PercentileBar label="Goals per 90" value={0.61} percentile={91} />
</Provider>
```

`Navigation` and `Layout` additionally need a router. `MemoryRouter`, `Routes`, `Route`, `Link`,
`NavLink` and `Outlet` are re-exported for this. Never nest one router inside another — React Router 7
throws `You cannot render a <Router> inside another <Router>`.

```jsx
const { Provider, Layout, MemoryRouter, Routes, Route } = window.FMJotter;
<Provider>
  <MemoryRouter initialEntries={["/scouting"]}>
    <Routes>
      <Route element={<Layout />}>
        <Route path="/scouting" element={<YourPane />} />
      </Route>
    </Routes>
  </MemoryRouter>
</Provider>
```

### Styling idiom

Chakra UI 3 has **no CSS classes**. Styling happens through props, and the design language lives in
colour tokens. Components that forward Chakra props (e.g. `ColorModeButton`) accept `variant`,
`size`, `colorPalette` and style props directly.

This DS exports **components, not layout primitives** — there is no `Box`, `HStack` or `Text`. Build
your own layout with plain HTML plus inline styles, and use FM Jotter components for the controls.

**Custom palettes** (each a full 50–950 scale): `glaucous` (brand accent, 500 `#6a7fdb`, 600 `#5566b0`),
`carbonBlack` (neutrals, 50 `#f5f5f5`, 900 `#0f0f0f`), `softBlush` (warm off-white, 50 `#fefbfb`),
`spicyPaprika` (warn/accent, 500 `#dc602e`), `thistle` (500 `#cf80a3`). Use as `colorPalette="glaucous"`
or in colour props like `bg="glaucous.500"`.

**Semantic tokens**, light / dark: `bg.canvas` (page ground), `fg.default`, `fg.emphasized`, `fg.muted`.
Chakra's own `bg.subtle`, `bg.muted`, `bg.panel` and `border.emphasized` are used throughout the
components and are safe to use. For hand-written layout glue, match `bg.canvas` with `#f5f5f5` light /
`#0f0f0f` dark.

**Percentile colour convention** — the app's core visual language, applied by `PercentileBar` and
worth repeating in any stat UI you build: red below 30, yellow 30–60, green above 60. Stats where
lower is better pass `inverted`.

### Component notes

- `Table` is generic over its row type and takes `columns: Column<T>[]`; each column may set `render`,
  `sortable`, `highlighted`, `width` and `headerTooltip`. It works controlled (`sortKey` +
  `onSortChange`) or uncontrolled (`defaultSortKey`).
- `Toaster` is mounted once near the root; fire toasts imperatively with
  `toaster.create({ title, description, type })` where `type` is `success` | `error` | `info` | `loading`.
- `SearchableSelect` and `PlayerAutocomplete` are virtualised dropdowns, closed until clicked.
- `LightMode` / `DarkMode` are `display: contents` wrappers that force a colour mode on a subtree —
  give the child an explicit background or nothing will look different.

### Layout primitives

Chakra's primitives are re-exported, so build layout with them rather than raw HTML — that is what
keeps a design consistent with the app: `Box`, `Flex`, `Stack`, `HStack`, `VStack`, `Grid`,
`GridItem`, `SimpleGrid`, `Container`, `Center`, `Spacer`, `Separator`, `Heading`, `Text`, `Badge`,
`Button`, `IconButton`, `Input`, `Textarea`, `Checkbox`, `Spinner`, `Card`, `Tabs`, `Progress`,
`Alert`, `Portal`.

They take Chakra style props, so the colour vocabulary above applies directly:

```jsx
const { VStack, HStack, Heading, Text, Box } = window.FMJotter;
<VStack align="stretch" gap={4} p={6} bg="bg.canvas">
  <Heading size="lg" color="fg.emphasized">Scouting</Heading>
  <HStack gap={2}>
    <Text fontSize="sm" color="fg.muted">Compared to players in the same role</Text>
  </HStack>
  <Box borderWidth="1px" borderColor="border.emphasized" borderRadius="md" p={4}>...</Box>
</VStack>
```

### Whole screens

The app's eight real screens are exported too: `ImportView`, `LeaguesView`, `TeamsView`,
`TeamProfileView`, `PlayersView`, `PlayerProfileView`, `ScoutingView`, `CompareView`. Start from one
of these when the task is to **change an existing panel** rather than build a new one — open its card
to see how it looks today, then restyle or restructure from there.

**They take no props.** Each loads its own data from IndexedDB through the exported `db` singleton,
and must sit inside `Layout` (which supplies `CompareProvider`) and a router. Against an empty
database they render their empty states — correct, but usually not what you want to look at. To
populate one first:

```jsx
const { db } = window.FMJotter;
await db.savePlayers(players);          // the app's Player type: ~50 fields, mostly per-90 stats
await db.saveLeagueRankings(rankings);  // [{ rank: 1, league: "Premier Division" }, ...]
```

Percentiles only appear for players with 5+ starts in a ranked league, so a realistic squad needs a
few dozen players spread across roles and divisions.

### Where the truth lives

Read `components/<group>/<Name>/<Name>.d.ts` for the exact props interface and
`<Name>.prompt.md` for usage before composing a component you have not used yet.
