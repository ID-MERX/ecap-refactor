# docs — legacy audit

> Legacy routes → new routes: `/documentation` → `/docs`; `/documentation/:slug` → `/docs/:slug` · Plan: MIGRATION_PLAN.md §5 row "docs"

## Legacy files

| File | Lines | Role |
| --- | --- | --- |
| `src/pages/Documentation.tsx` | 445 | Index page `/documentation`: hero, client-side search over 6 hardcoded sections, section cards linking to articles, "Need more help?" CTA to `/support`. Fires 3 count queries whose results are never rendered (see Bugs). |
| `src/pages/DocumentationArticle.tsx` | 104 | Article page `/documentation/:slug`: looks up the article by slug and renders its content with a tiny hand-rolled markdown parser (paragraphs, `- ` lists, `|` tables, `**bold**`). |
| `src/data/documentationArticles.ts` | 165 | `toSlug()` helper, `Article` interface and the static array of 24 articles (all content hardcoded). |
| `src/App.tsx` (lines 104-106, 112-148, 549-564) | 602 | Lazy imports, QueryClient defaults, IndexedDB persister, route definitions. |
| `src/components/dashboard/AppSidebar.tsx` (lines 107-113, 147-181, 186, 237) | 346 | "Help & support" nav section with the Documentation entry; visibility filter. |
| `src/components/dashboard/MobileBottomNav.tsx` (lines 5-11) | 52 | No docs entry. |
| `src/components/dashboard/GlobalSearch.tsx` (lines 31, 176-200) | 212 | "Help & Documentation" group — navigates to `/support`, not to docs. |
| `src/components/dashboard/DashboardHeader.tsx` (lines 35-43, 85) | 539 | `HIDDEN_ROUTES` includes `/documentation` (hides header search/filter). |
| `src/hooks/useEffectiveDistrict.ts` | 18 | Read for scope rules; **not used** by either docs page. |
| `src/lib/api.ts` (lines 26-60, 241-278) | 1486 | `getCountValue`, `fyQs`, `getTotalVcasCount`, `getTotalHouseholdsCount`, `getTotalMothersCount`. |
| `src/data/supportData.tsx` (line 86) | — | Mentions "documentation" in the support page's "Full System Manual" text; does not link to `/documentation`. Belongs to `support`. |

## Article model and slugs

- [ ] `Article` = `{ title: string; slug: string; category: string; content: string }` (`legacy:src/data/documentationArticles.ts:7-12`). Content is a markdown-ish string: paragraphs separated by `\n\n`, list lines start with `- `, tables use `|` rows with a `|--` separator row, bold with `**…**`, numbered steps written as `1. …` (no special rendering).
- [ ] `toSlug(text)` = `text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")` (`legacy:src/data/documentationArticles.ts:1-5`). Every article's slug is `toSlug(title)`, and the index page links via `toSlug(linkLabel)` (`legacy:src/pages/Documentation.tsx:365`), so link labels must equal article titles exactly.
- [ ] Six categories, in order, with 4 articles each (24 total). Category name = index section title. Slug list (file `legacy:src/data/documentationArticles.ts`, line of `content`):

| # | Category | Title | Slug | Line |
| --- | --- | --- | --- | --- |
| 1 | Getting Started | Platform overview | `platform-overview` | 20 |
| 2 | Getting Started | Logging in and navigation | `logging-in-and-navigation` | 26 |
| 3 | Getting Started | Understanding your dashboard | `understanding-your-dashboard` | 32 |
| 4 | Getting Started | Role-based access levels | `role-based-access-levels` | 38 |
| 5 | User Management | Adding new users | `adding-new-users` | 45 |
| 6 | User Management | Assigning districts and provinces | `assigning-districts-and-provinces` | 51 |
| 7 | User Management | Editing user profiles | `editing-user-profiles` | 57 |
| 8 | User Management | Understanding role permissions | `understanding-role-permissions` | 63 |
| 9 | Registers | Household register | `household-register` | 70 |
| 10 | Registers | VCA register | `vca-register` | 76 |
| 11 | Registers | Mother index register | `mother-index-register` | 82 |
| 12 | Registers | HTS and PMTCT registers | `hts-and-pmtct-registers` | 88 |
| 13 | Services | Household services | `household-services` | 95 |
| 14 | Services | VCA services | `vca-services` | 101 |
| 15 | Services | Caregiver services | `caregiver-services` | 107 |
| 16 | Services | Data quality insights | `data-quality-insights` | 113 |
| 17 | Data Quality | Flagged records review | `flagged-records-review` | 120 |
| 18 | Data Quality | Data quality insight cards | `data-quality-insight-cards` | 126 |
| 19 | Data Quality | Exporting service data | `exporting-service-data` | 132 |
| 20 | Data Quality | District-level reporting | `district-level-reporting` | 138 |
| 21 | Troubleshooting | Login and access issues | `login-and-access-issues` | 145 |
| 22 | Troubleshooting | Data not loading | `data-not-loading` | 151 |
| 23 | Troubleshooting | Export problems | `export-problems` | 157 |
| 24 | Troubleshooting | Contacting support | `contacting-support` | 163 |

- [ ] Keep these 24 slugs stable in `/docs/:slug` (they are the only deep links). Legacy redirect `/documentation/:slug` → `/docs/:slug` with the same slug.

### Brand / program strings inside docs content (must move to `@/config` or be templated)
Count: at least 11 distinct hardcoded brand/program/contact items across 3 files (article content and index page).
- [ ] App/program name "ECAP+" — `legacy:src/data/documentationArticles.ts:20` ("The ECAP+ Program Management Platform (PMP)…"), `legacy:src/pages/Documentation.tsx:104` ("Learn the basics of the ECAP+ platform."), `legacy:src/pages/Documentation.tsx:285-286` ("Browse comprehensive help docs for the ECAP+ Program Management Platform.").
- [ ] Funder "PEPFAR-funded", program type "OVC programs", country "Zambia" — `legacy:src/data/documentationArticles.ts:20`.
- [ ] Backend product name "Directus" — `legacy:src/data/documentationArticles.ts:20`, `legacy:src/pages/Documentation.tsx:117` ("Create Directus accounts…").
- [ ] Domain terms: "VCA (Vulnerable Children and Adolescents)" (`:76`), "HTS (HIV Testing Services)" (`:82`), "Prevention of Mother-to-Child Transmission" (`:88`), service domains "health, schooled, safe, and stable" (`:20`, `:95`, `:107`).
- [ ] Fiscal-year rule "Services are filtered by June reporting year (June–May cycle)." — `legacy:src/data/documentationArticles.ts:95`. Must come from program config FY rules.
- [ ] Role names "Administrator, Provincial User, District User, Support User" (`:38`, `:45`, `:51`, `:63`) and on the index card "Administrator, Provincial, District, Facility, Support" (`legacy:src/pages/Documentation.tsx:117`) — note the inconsistent "Facility" role.
- [ ] Hardcoded support email address (vendor domain) and two hardcoded support phone numbers — `legacy:src/data/documentationArticles.ts:163`. Must come from `site.config` contact details.
- [ ] Sidebar section/page names quoted in article text (`:26`) — will drift; generate from nav manifest or rewrite.
- [ ] Recommendation: store article bodies as markdown (per-locale/program content) with `{{appName}}`, `{{orgName}}`, `{{supportEmail}}`, `{{fiscalYearRule}}` placeholders resolved from `@/config`, so `pnpm check:brand` passes.

## Route `/documentation` → `/docs`
### Purpose
Help-centre landing page: hero with today's date, section count, search box; 6 category cards each listing 4 article links; "Need more help?" CTA linking to the Support Center (`legacy:src/pages/Documentation.tsx:228-442`).

### Access
- [ ] Route guard: `ProtectedRoute` only, no role check (`legacy:src/App.tsx:549-556`). Lazy-loaded with `lazyWithRetry` (`legacy:src/App.tsx:104`).
- [ ] Sidebar: item `{ title: "Documentation", url: "/documentation", icon: BookOpen }` in section `label: "Help & support"` (`legacy:src/components/dashboard/AppSidebar.tsx:107-113`). Filter only removes `/districts` for district users, the `Admin` section for non-admins and `Data Pipeline` for non-admin/non-support (`legacy:src/components/dashboard/AppSidebar.tsx:164-177`); none of these match, so Documentation is visible to **every** signed-in user. Active state is exact-path `currentPath === path` (`legacy:src/components/dashboard/AppSidebar.tsx:186,237`).
- [ ] Mobile bottom nav: no docs entry (`legacy:src/components/dashboard/MobileBottomNav.tsx:5-11`); reachable only via the sidebar sheet (`onOpenMenu`).
- [ ] Global search: group heading "Help & Documentation" lists `quickHelpLinks` and `faqs` from `supportData`, but every item does `navigate("/support")` (`legacy:src/components/dashboard/GlobalSearch.tsx:176-200`). No search entry for docs articles. **QUESTION**: new search provider should index the 24 articles and link to `/docs/:slug`?
- [ ] In-page role usage (display only, no gating): `userRole = (typeof user?.role === "object" ? user?.role?.name : user?.role) || user?.description || "User"` (`legacy:src/pages/Documentation.tsx:63-66`); `userScope = user?.location && user.location !== "All" ? user.location : user?.title && user.title !== "All" ? user.title : "all districts"` (`legacy:src/pages/Documentation.tsx:67-72`). Shown in Getting Started description: `` `You're signed in as ${userRole} for ${userScope}. Learn the basics of the ECAP+ platform.` `` (`:104`). New build: take role label and scope label from `useAccess()`/scope hooks, not raw `location`/`title`.
- [ ] `userName` computed (`first_name last_name` || email || "you") but never rendered (`legacy:src/pages/Documentation.tsx:59-62`).
- [ ] Data scope: `useEffectiveDistrict` not used; the count queries pass **no** district and no FY window (`legacy:src/pages/Documentation.tsx:77,82,87`).
- [ ] Header: `/documentation` is in `HIDDEN_ROUTES`, so the header's search/filter controls are hidden (`legacy:src/components/dashboard/DashboardHeader.tsx:35-43,85`). Subtitle "System Documentation" (`legacy:src/pages/Documentation.tsx:229`).

### Endpoints
All three are fired on mount and their result is only used in `liveStat` values that are **never rendered** (see Bugs). Global defaults: `staleTime` 60s overridden, `gcTime` 24h, `retry: 1`, refetch on mount/focus/reconnect (`legacy:src/App.tsx:112-133`); cache persisted to IndexedDB under key `ecap-plus-pmp-react-query` (`legacy:src/App.tsx:140-148`).
- [ ] `GET /household/households-count/:district(*)` (AUDIT.md §3.2) — wrapper `getTotalHouseholdsCount()` (`legacy:src/lib/api.ts:261-270`) called with no args from `legacy:src/pages/Documentation.tsx:77`, so the URL built is `/household/households-count` (no segment, no `?from/to`), which 404s on the backend (AUDIT.md §3.2, `legacy:src/lib/api.ts:265-267`). Key `["docs","total-households"]`, `staleTime: 5 * 60 * 1000` (`:75-79`). Response through `getCountValue` (`legacy:src/lib/api.ts:26-60`).
- [ ] `GET /child/vcas-count/:district(*)` (AUDIT.md §3.2) — `getTotalVcasCount()` (`legacy:src/lib/api.ts:253-259`) with no args → `/child/vcas-count` → 404. Key `["docs","total-vcas"]`, staleTime 5 min (`legacy:src/pages/Documentation.tsx:80-84`).
- [ ] `GET /mother/total/count` (AUDIT.md §3.2) — `getTotalMothersCount()` (`legacy:src/lib/api.ts:272-278`) with no district → national count (counts distinct `household_id`, per AUDIT.md §3.2). Key `["docs","total-mothers"]`, staleTime 5 min (`legacy:src/pages/Documentation.tsx:85-89`).
- [ ] Post-processing: `totalRecords = (households ?? 0) + (vcas ?? 0) + (mothers ?? 0)` (`:94-97`), formatted with `Intl.NumberFormat("en-GB")`, `"—"` for null/NaN (`:50-53`).
- [ ] **QUESTION**: drop these queries entirely in the new build (nothing displays them), or render the intended live stats ("Your role", "Total records") scoped via `platform/scope`? If kept they must use scope + FY in the key and `meta: { etl: true }`.

### Fields used
| Field | Raw keys tried | Where shown / how used | Formatting |
| --- | --- | --- | --- |
| count (households/vcas/mothers) | `getCountValue`: number; numeric string; `record.count` (number/string/`{count}`)… (`legacy:src/lib/api.ts:26-60`) | Summed into `totalRecords` → `liveStat` (not rendered) | `en-GB` number, `—` |
| user role | `user.role.name` / `user.role` / `user.description` / `"User"` | Getting Started card description | text |
| user scope | `user.location` (≠"All") / `user.title` (≠"All") / `"all districts"` | Getting Started card description | text |

### Filters / sort / pagination / search
- [ ] Search box: placeholder "Search for articles, guides, and more…"; static "Search" pill at right; clear (XCircle) button shown when non-empty (`legacy:src/pages/Documentation.tsx:289-308`). State is local `useState("")` (`:57`) — not in URL, not persisted, no debounce.
- [ ] Matching (`:183-204`): case-insensitive `includes` on section `title`, section `description`, and each link label. Article **content is not searched**. If title or description matches, the whole section is shown with all links; otherwise only matching links are shown and the card gets a "Matching articles" badge (`isPartialMatch`, `:332-341`). Empty/whitespace query shows all sections.
- [ ] Highlight: matches in title, description and link labels wrapped in a highlighted span (`:206-226`).
- [ ] Results line when query non-empty: `Showing results for "<query>"` plus badge `"<n> categories found"` (`:312-324`).
- [ ] No results: Search icon, "No matching documentation found", "Try a different keyword or browse the categories above.", button "Clear search" (`:381-399`).
- [ ] No sort or pagination; sections render in fixed order in a 1/2/3-column grid (`:326`).
- [ ] Section cards (title, icon, description, links) quoted exactly (`:101-171`):
  - "Getting Started" (Book) — dynamic description above — links "Platform overview", "Logging in and navigation", "Understanding your dashboard", "Role-based access levels".
  - "User Management" (User) — "Create Directus accounts, assign roles (Administrator, Provincial, District, Facility, Support), and scope users by location." — "Adding new users", "Assigning districts and provinces", "Editing user profiles", "Understanding role permissions".
  - "Registers" (FileText) — "Working data in the system." — "Household register", "VCA register", "Mother index register", "HTS and PMTCT registers".
  - "Services" (Shield) — "Track service delivery across household, VCA, and caregiver levels — filter by sub-population, drill into records, and export CSVs." — "Household services", "VCA services", "Caregiver services", "Data quality insights".
  - "Data Quality" (Settings) — "Review flagged forms, monitor district performance, and use the DQA tools to improve data integrity." — "Flagged records review", "Data quality insight cards", "Exporting service data", "District-level reporting".
  - "Troubleshooting" (HelpCircle) — "Common issues, fixes, and how to reach the support team." — "Login and access issues", "Data not loading", "Export problems", "Contacting support".
- [ ] Hero: eyebrow "Knowledge base" · today's date via `toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })` (`:254-265`, use `core/lib/format.ts`) · badge "`<n>` sections" (`:270`) · heading "How can we help you today?" with badge "Guides · FAQs · How-tos" (`:273-283`).

### Exports
- [ ] None.

### Charts
- [ ] None (the intended `liveStat` tiles are never rendered).

### Links in / out
- [ ] In: sidebar (`legacy:src/components/dashboard/AppSidebar.tsx:111`); article page "Back to documentation" buttons (`legacy:src/pages/DocumentationArticle.tsx:23,36`). No other inbound link in `src` (grep for `documentation`). No query params / state / storage payload.
- [ ] Out: each article link → `navigate(`/documentation/${toSlug(link)}`)` (`legacy:src/pages/Documentation.tsx:365`); "Back" → `navigate(-1)` (`:232-241`); "Contact support" → `navigate("/support")` (`:430-436`, CTA text "Live support" / "Need more help?" / "Can't find what you're looking for? Our support team is ready to help.").

### Loading / empty / error
- [ ] No loading UI (`isLoadingStats` computed but unused, `:91-92`). No error handling for the count queries. Empty = search no-results block above.

### Bugs and quirks
- [ ] **BUG** `liveStat` is set on two sections (`:111`, `:135`) but the card JSX never renders it (`:327-378`); the three count queries are pure wasted traffic.
- [ ] **BUG** Two of the three counts call paths without a district segment, which 404 (AUDIT.md §3.2); with the errors swallowed, "Total records" would equal only the mothers count (distinct households) (`:94-97`).
- [ ] **BUG** `highlightMatch` builds `new RegExp(`(${query})`, "gi")` from raw user input (`:209`). A query containing regex metacharacters that also appears in the text (e.g. `(`, which is in the User Management description) throws a SyntaxError during render and crashes the page. Escape the query (or use index-based splitting).
- [ ] **BUG** Count query keys have no scope/FY segment and the queries are persisted to IndexedDB with no `persist` control (`legacy:src/App.tsx:140-148`).
- [ ] Quirk: `navigate(-1)` "Back" leaves the app or does nothing when the page was opened directly (`:234`). New build: link to the dashboard / previous in-app route.
- [ ] Quirk: hardcoded `en-GB` locale for date and numbers (`:52`, `:259`).
- [ ] Quirk: Sidebar uses exact-path active matching, so the Documentation item is not highlighted on article pages (`legacy:src/components/dashboard/AppSidebar.tsx:186`).

## Route `/documentation/:slug` → `/docs/:slug`
### Purpose
Render one article by slug (`legacy:src/pages/DocumentationArticle.tsx:8-102`).

### Access
- [ ] Route guard: `ProtectedRoute` only (`legacy:src/App.tsx:557-564`); lazy `lazyWithRetry` (`legacy:src/App.tsx:105-107`).
- [ ] No nav entry of its own; no in-page role checks; no data scope.
- [ ] Header: not in `HIDDEN_ROUTES` (exact match on `/documentation`), so header search/filter **are** shown on article pages (`legacy:src/components/dashboard/DashboardHeader.tsx:35-43,85`). **QUESTION**: hide them on `/docs/:slug` too (likely intended)?
- [ ] DashboardLayout subtitle = `article.title`, or "Article not found" (`:16`, `:32`).

### Endpoints
- [ ] None. Article lookup: `articles.find(a => a.slug === slug)` — exact, case-sensitive (`:12`).

### Fields used
| Field | Raw keys tried | Where shown | Formatting |
| --- | --- | --- | --- |
| `category` | `Article.category` | Outline badge above title (`:46-48`) | text |
| `title` | `Article.title` | `h1` (`:49`) and header subtitle | text |
| `content` | `Article.content` | Body (`:52-98`) | mini-markdown (below) |

### Content rendering rules (`legacy:src/pages/DocumentationArticle.tsx:53-97`)
- [ ] Split on `\n\n` into blocks. Block starting with `- ` → bullet list of lines starting with `- `, with `**x**` → `<strong>` (`:54-66`). Block containing `|` → table: drop blank rows and rows starting `|--`, first row = headers, `split("|").filter(Boolean)` cells (`:67-93`). Otherwise `<p>` with `**x**` → `<strong>` (`:94-96`). Uses `dangerouslySetInnerHTML` for bold.
- [ ] New build: use a real (safe) markdown renderer so lists, numbered steps and tables render properly; no `dangerouslySetInnerHTML`. (Ask before adding a markdown dependency — CLAUDE.md rule 8.)
- [ ] Only table in content: "Understanding role permissions" with headers `Role | Data Access | Admin Page | Districts Page` and rows Administrator/All/Yes/Yes; Provincial User/Province only/No/Yes; District User/District only/No/No; Support User/All users/No/Yes (`legacy:src/data/documentationArticles.ts:63`).

### Filters / sort / pagination / search / Exports / Charts
- [ ] None.

### Links in / out
- [ ] In: index page article links (`legacy:src/pages/Documentation.tsx:365`). No other inbound links.
- [ ] Out: "Back to documentation" (ghost button with ArrowLeft) → `navigate("/documentation")` (`:34-43`). Article text tells users to click "Support Center" / "Start Chat", "Forgot your password?", the "Sync" button, "Admin > Users", "Add user" (`legacy:src/data/documentationArticles.ts:45,57,145,151,163`) — plain text, not links.

### Loading / empty / error
- [ ] Unknown slug: Book icon, "Article not found", "The documentation article you're looking for doesn't exist.", outline button "Back to documentation" → `/documentation` (`:14-29`). No loading state (static data).

### Bugs and quirks
- [ ] **BUG** No content block starts with `- ` (every list follows an intro line in the same block, e.g. "Key capabilities:\n- …", `legacy:src/data/documentationArticles.ts:20`), so the list branch never fires and every bullet list renders as one run-on paragraph with literal "- " (newlines collapse in `<p>`). Numbered steps (`:45,57,126,151`) likewise run together.
- [ ] **BUG** Any paragraph containing a `|` character is treated as a table (`:67`); harmless today but fragile.
- [ ] **BUG (content)** "Mother index register" article actually describes the HTS register ("The HTS (HIV Testing Services) Register tracks mother index testing data… Click a row to view the full HTS profile") (`legacy:src/data/documentationArticles.ts:82`).
- [ ] **QUESTION (content accuracy)** Several claims don't match the app: "four access levels" vs index card's five incl. "Facility" (`:38` vs `legacy:src/pages/Documentation.tsx:117`); District users "Cannot access Districts or Caseworkers pages" while the sidebar only hides `/districts` (`:38`, `:145` vs `legacy:src/components/dashboard/AppSidebar.tsx:166`); "All filtering is enforced in the UI" (`:63`, a security admission); "All users are notified when a flag is resolved" (`:120`); "Live Chat … Start Chat" refers to support chat, dropped per decision 4 (`:163`); "Charts" page now `/analytics`; "Admin > Users". Content needs a rewrite pass against the new app.
- [ ] Quirk: `toSlug` exported from the data file; `DocumentationArticle.tsx` does not lowercase the param, so `/documentation/Platform-Overview` → not found.

## Other behaviour

- [ ] No storage keys read/written by the docs pages themselves (global: IndexedDB persister key `ecap-plus-pmp-react-query`, `legacy:src/App.tsx:146`; sidebar `sessionStorage` `ecap_sidebar_scroll`, `legacy:src/components/dashboard/AppSidebar.tsx:126`).
- [ ] No timers/polling beyond React Query defaults (refetch on focus/reconnect) for the 3 count queries.
- [ ] Decorative `animate-pulse` blobs and `animate-in fade-in` on both pages (`legacy:src/pages/Documentation.tsx:230,248-249,408-409`; `legacy:src/pages/DocumentationArticle.tsx:33`) — CLAUDE.md: decorative animation only where it aids understanding; drop.
- [ ] Hardcoded emerald/teal/sky Tailwind colours and an rgba shadow (`legacy:src/pages/Documentation.tsx:245-249,406`) — use theme tokens.
- [ ] No modals, forms, mutations, toasts or keyboard shortcuts.

## Open questions for the developer

1. Drop the three unused count queries, or render the intended live stats (scoped)? (Recommend drop.)
2. Where does article content live: static markdown in the `docs` module with config placeholders, or a Directus collection (`/items/<collection>`) so content can be edited without a deploy? Legacy has no API for it.
3. Should docs search cover article bodies and be exposed through the global search provider (`/docs/:slug` results)? Legacy global search sends all help items to `/support`.
4. Content rewrite: the article text is outdated/inaccurate (role list, sidebar layout, support chat, mother-index article). Who owns the rewrite, and should nav-related articles be generated from manifests?
5. Hide header search/filter on article pages as well as the index?
6. Add a markdown renderer dependency (needs approval per rule 8) or keep a minimal in-house renderer with fixed list handling?
