# Adding a module

Written from the experience of building the Phase 4 pilot (`households`). Follow it in order; every step
is mechanical except the third, which is the actual work.

If a step here does not match the code, the code is right and this file is stale — fix it.

---

## 0. Before writing code

1. **Read `docs/audit/<module>.md` end to end.** It is the specification: endpoints, fields, filters,
   sort, export columns, edge cases, and a "Bugs and quirks" section that lists what the legacy screen got
   wrong. Do not re-derive any of that from `old-ecap-pmp` — the audit already cites every claim by line.
2. **Check the module's open questions** at the bottom of its audit file and in `docs/PROGRESS.md`. If one
   blocks you, ask; do not guess a permission rule or a data scope.
3. **Decide the pagination mode.** If the register can exceed a few thousand rows, it needs server
   pagination (see §3). Client mode is fine for small, fully-loaded collections.

---

## 1. Folder

```
src/modules/<name>/
  index.ts        Public surface: types and path builders ONLY
  manifest.ts     Routes, nav, redirects, feature flag, minScope
  routes/         Page components (thin — compose platform pieces)
  api/
    schemas.ts    zod + normalisers into the domain type
    client.ts     Endpoint calls
    queries.ts    Query key factory + queryOptions
  model/          Column and filter declarations, pure helpers
  __tests__/      Unit tests; the page-level behaviour test
```

`index.ts` is the **only** file another module may import. `pnpm lint` enforces it twice
(`boundaries/dependencies` and `no-restricted-imports`).

---

## 2. Manifest first

Write `manifest.ts` and register it in `app/manifests.ts` **before** the page exists. The router, sidebar,
command palette and legacy redirects are all derived from it, so an empty page at the route tells you the
wiring works.

```ts
export const thingsManifest: ModuleManifest = {
  id: "things",
  feature: "module.things",        // no route and no nav entry when this flag is off
  navGroup: "Registers",
  routes: [{ path: "/things", component: ThingsPage, redirects: ["/registers/things"] }],
  nav: [{ label: "Things", to: "/things", icon: Box }],
  minScope: "district",            // omit for modules a district user may see
};
```

- `minScope` raises the bar. `/districts` uses `"province"` (decision 26): a district user sees one row on
  a comparison page, so the module is not registered for them at all.
- List every legacy URL in `redirects`. Old links in emails and notifications must not 404.

---

## 3. Data layer

### `api/schemas.ts`

Declare **one** candidate order per field and normalise in one place:

```ts
householdId: String(pick(raw, ["household_id", "householdId", "hh_id", "id"]) ?? "")
```

The legacy registers tried a different list of raw columns per consumer (table, sort, search, CSV), which
is how a row with only `id` could still navigate to `"N/A"`. `pick` from `@/core/lib/values` takes the
first non-empty candidate; every consumer then reads the normalised field.

### `api/queries.ts`

Always put the **scope and the FY window in the key**. Two users with different scopes must never share a
cache entry — the legacy key was `["households", "All", fy]` and scoped the rows afterwards on the client.

```ts
queryKey: [...keys.list, scopeKey(scope), fyKey(window)]
```

Set `enabled: scope.level !== "none"`. An empty district list is read by several backend handlers as "no
filter", so a request from an unscoped user would return everything.

### `api/client.ts` — pagination

**Server mode is the default (decision 33).** A register must never download 260,000 rows.

- Send `page`, `pageSize`, `sort`, `order` and the filter params from `toQueryParams`. Unknown params are
  ignored by the current backend, so this is safe today and works unchanged when ask #8 lands.
- Until the backend paginates, `client.ts` slices locally behind a documented `MAX_ROWS` cap and returns
  `truncated: true`. **Render that flag.** Silently presenting a partial register as the whole thing is the
  legacy failure mode.
- When the backend gains pagination: delete the cap, set `SERVER_PAGINATION_AVAILABLE = true`, and pass the
  server's `total` through. Nothing in the UI changes.

---

## 4. Declarations in `model/`

One `ColumnDef[]` and one `FilterDef[]`, consumed by the table, the count and the export:

- `meta.exportHeader` / `meta.exportValue` — the export must contain what the screen shows.
- `meta.locked` — identifiers the table cannot function without (not offered in the column picker).
- `meta.hidden` — available but off by default.
- Sub-populations: build the defs from `program.config`, never retype the keys.
- Text filter `fields` are explicit. A search that quietly widens to every column returns rows the user
  cannot see the reason for.

---

## 5. Page

Aim under 250 lines. The page composes:

```tsx
const table = useTableUrlState(filters, { sort: DEFAULT_SORT });
const window = useFyWindow();
```

- **URL state** via `useTableUrlState` — filters, sort and page survive refresh and are shareable.
- **Empty vs error**: use `ErrorState`. The legacy registers rendered a failed query as "No households
  found", which reads as a real empty result.
- **Loading** is a row, not a spinner that replaces the table.
- **Row links** are real `<a>` elements via `rowHref`, so middle-click and new-tab work.

---

## 6. Tests

Unit tests are cheap and catch the legacy bugs; write them for the rules, not the components.

- The normaliser: every candidate key order, blank → null, whitespace collapsing.
- The filters: padding, case, and the value that legacy mishandled (e.g. `"Yes"` vs `"1"`).
- The export: header order, escaping, and that it matches the visible columns.
- One page-level test: rows render, the count is right, an empty result says so, and a **failure renders
  an error state rather than an empty table**.

If a rule matters to a user, it gets a test. `deriveAccess` and the FY precedence both exist because a
test pins behaviour the old app got wrong.

---

## 7. Definition of done

- [ ] Every legacy URL for the module redirects.
- [ ] `docs/audit/<module>.md` items ticked, or explicitly deferred with a reason.
- [ ] Column, filter and export behaviour matches the audit's "Filters / sort / pagination" and "Exports".
- [ ] Scope is enforced by the query key, not by client-side filtering after the fetch.
- [ ] Empty, loading and error states are all reachable and distinct.
- [ ] `pnpm check` green.
- [ ] `docs/PROGRESS.md` updated: what landed, what did not, and any new open question.
