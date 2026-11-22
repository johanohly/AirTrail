# Vendored bits-ui

This directory is the source of [bits-ui](https://github.com/huntabyte/bits-ui),
copied into AirTrail so changes to the primitives are ordinary commits here
instead of releases of a fork. App code imports it as `$lib/primitives`.

## Provenance

- Upstream: `huntabyte/bits-ui`, forked at `263d0989` (after bits-ui 2.18.1).
- Fork: [`johanohly/bits-ui`](https://github.com/johanohly/bits-ui), published
  as `@johly/bits-ui`. The fork adds the `Filter` and `menu-data` bits and
  menu, popper-layer and floating-layer changes they need.
- Version: `@johly/bits-ui@2.18.12`, branch `release/2.18.12`, commit
  `c97b39259c1512627a3944a56081759c9ae2028f`.
- Source path: `packages/bits-ui/src/lib`.

Building that commit with `svelte-package` reproduces the published
`dist` exactly for every `.js` and `.svelte` file. Only generated `.d.ts`
files differ, from TypeScript and `csstype` version noise.

## Local changes at vendor time

- `$lib/` imports were rewritten to `$lib/primitives/`. Nothing else in the
  vendored files was edited, so `git diff` against upstream stays readable.
- Bits AirTrail doesn't use, and that nothing vendored imports, were left
  out: `accordion`, `aspect-ratio`, `button`, `combobox`, `context-menu`,
  `link-preview`, `menubar`, `meter`, `navigation-menu`, `pagination`,
  `progress`, `rating-group`, `slider`, `toggle`, `toggle-group`, `toolbar`.
  Their lines were removed from `index.ts`, `bits/index.ts` and `types.ts`.
  `internal/`, `shared/` and `bits/utilities/` are kept whole.
- Tests (`*.test.ts`) were not vendored.
- Runtime dependencies stay npm dependencies of AirTrail: `@floating-ui/dom`,
  `@internationalized/date`, `esm-env`, `runed`, `svelte-toolbelt`,
  `tabbable`, plus `csstype` for types.
- The directory is excluded from Prettier (`.prettierignore`) and ESLint
  (`eslint.config.js`), and its Svelte compiler warnings are filtered in
  `svelte.config.js`, so the code keeps upstream's formatting.

## Changes since vendoring

One bullet per change: what changed and why.

- Filter: columns take a `group`, and `Filter.Menu` takes `groups` (order,
  label, and nodes to lead the group with). Group nodes render a visible
  heading (`data-filter-menu-group-heading`) instead of only an
  `aria-label`. AirTrail's filter menu has over 20 entries.
- Filter: custom submenu nodes (`meta.kind: "custom"`) can carry an icon and
  hide their search input, for AirTrail's "Quick date" entry.
- Filter: options take an optional `description`, shown between the label
  and the count, for the route next to a flight number.
- Filter: deep-search option rows get ids prefixed with their column id. Two
  columns offering the same value (departure and arrival country "ES") gave
  duplicate element ids and a shared highlight. The option editor's
  selected-first split now reads the option value instead of the id.
- Filter: columns take an optional `pluralName` for the "2 departure
  countries" chip. The default adds an "s", which gave "countrys".
- Menu data: a `match: "word-prefix"` search mode (case- and
  accent-insensitive, a word must start with the query), and deep-search hits
  keep their parent's group. The filter menu and its option lists use it
  with groups in menu order; filter names rank above options. The default
  fuzzy match found "Newark Liberty" for "iber" and put option hits under the
  wrong heading. Option rows no longer search their raw value (airport ids).
  `matchesWordPrefix` is exported from the package root for the mobile list.
- Filter: a menu row mounts its submenu portal when the submenu opens and
  drops it after the close animation. Every closed row mounted its own portal
  root, which made opening the 24-row filter menu about 25% slower.
- `createColumns` is exported from the package root. AirTrail builds the
  filter columns from its own option counts so they follow the flights.

## House rules

- Change primitives here like any other code, and record each change above.
- Upstream fixes arrive by manual diff-merge: diff upstream between the
  pinned commit and the new one, apply what applies, then update the
  Provenance version and commit.
- Keep the upstream code style. Don't run formatters over this directory.
