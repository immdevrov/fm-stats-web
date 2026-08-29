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

### Where the truth lives

Read `components/<group>/<Name>/<Name>.d.ts` for the exact props interface and
`<Name>.prompt.md` for usage before composing a component you have not used yet.
