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

None yet. Add one bullet per change: what changed and why.

## House rules

- Change primitives here like any other code, and record each change above.
- Upstream fixes arrive by manual diff-merge: diff upstream between the
  pinned commit and the new one, apply what applies, then update the
  Provenance version and commit.
- Keep the upstream code style. Don't run formatters over this directory.
