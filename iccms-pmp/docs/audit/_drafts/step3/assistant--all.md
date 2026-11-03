# assistant — legacy audit
> New module `assistant` · Legacy routes → new routes: floating widget (no route) → overlay · Plan: MIGRATION_PLAN.md §5 row "assistant" · Kept per developer decision ("keep the AI assistant", docs/PROGRESS.md)

## Legacy files
| File | Lines | Role |
| --- | --- | --- |
| `src/components/dashboard/AiAssistant.tsx` | 398 | Floating chat widget ("Bumi AI Agent"): toggle button, chat card, greeting, suggestions, colour-command parsing, localStorage persistence |
| `src/lib/ai-service.ts` | 173 | `getAiResponse` / `getAiGreeting` wrappers around `POST /agent/chat` (raw `fetch`), main system prompt, greeting system prompt |
| `src/components/dashboard/DashboardLayout.tsx` | 110 | Mount point: renders `<AiAssistant />` at `:52` (only importer, `:23`) |
| `src/context/ThemeContext.tsx` | 106 | `updateColor` target of AI colour commands; persists `ecap.ui_theme` and writes CSS variables on `<html>` |
| `src/lib/sounds.ts` | 51 | `playDrop()` Web Audio cue played on each assistant reply (`:47-51`) |
| `src/lib/env.ts` | 17 | `getBackendBaseUrl()` = env `REACT_PUBLIC_API_URL` (`:16-17`) |
| `src/components/auth/ProtectedRoute.tsx` | 23 | Guard wrapping every page that renders DashboardLayout |
| `src/App.tsx` | 602 (relevant parts read: provider tree `:213-236`, route list) | `ThemeProvider` wraps `AuthProvider` and `BrowserRouter` (`:226-232`) |

No sidebar, mobile-nav or global-search entry exists for the assistant (grep for `assistant|bumi|agent|AI` in `AppSidebar.tsx`, `MobileBottomNav.tsx`, `GlobalSearch.tsx`, `useEffectiveDistrict.ts` returns nothing). No other file imports `AiAssistant` or `ai-service`.

## Component `AiAssistant` (unrouted, floating overlay)

### Purpose
A floating bottom-right chat assistant, branded "Bumi AI Agent" with the subtitle "System intelligence" (`legacy:src/components/dashboard/AiAssistant.tsx:222,225`). It answers questions about the platform through a self-hosted LLM proxy (`POST /agent/chat`, AUDIT.md §3.2). It can also change UI colours when the model emits a JSON command. It is not a data assistant: no records or KPIs are sent to the model. The only context sent is the page name, the user's first name and role, and how long the user was away.

### Access
- [ ] Mount: rendered as the first child of `SidebarProvider` in `DashboardLayout` (`legacy:src/components/dashboard/DashboardLayout.tsx:52`), so it appears on **every page that uses DashboardLayout**. Those are Dashboard, Districts, Charts, all registers (household/VCA/active/archived/risk, HTS, HTS risk, PMTCT, mother index, caregiver risk), all profile/detail pages, ServicesPage (`/vca-services`, `/household-services`, `/caregiver-services`), HouseholdServicesPage, VcaServicesDashboard, Flags, FlaggedRecordForm, Referrals, Performance, CaseworkerJourneys, CaseworkerProfile, TrainingLog, Calendar, Users/AddUser/EditUser, Profile, DataPipelinePage, SupportCenter, Documentation, DocumentationArticle (grep `DashboardLayout` in src/pages). It is **not** shown on `/` (Index/login), `/forgot-password`, `/reset-password`, `/accept-invite`, `/change-password` or NotFound, because those pages do not use DashboardLayout.
- [ ] Route guard: none of its own. It inherits `ProtectedRoute` from the hosting page: no user → `<Navigate to="/">`, and a forced password change redirects to `/change-password` (`legacy:src/components/auth/ProtectedRoute.tsx:8-18`). No role check (`legacy:src/App.tsx:252-560`, every route is `<ProtectedRoute>` only).
- [ ] Sidebar / mobile nav / global search: no entry. Visibility is controlled only by the toggle button (`legacy:src/components/dashboard/AiAssistant.tsx:379-395`).
- [ ] In-page role/permission checks: none. Every authenticated user sees it. The role name is read only to tell the model who the user is (`legacy:src/components/dashboard/AiAssistant.tsx:159`: `(user as any)?.role?.name || (typeof (user as any)?.role === "string" ? (user as any).role : "user")`). The new app must not use this as an access check. If the assistant needs gating, use a permission plus the `useFeature()` flag.
- [ ] Data scope: none. No district or FY is sent. `useEffectiveDistrict` is not used. The backend proxy does not read `req.user` (AUDIT.md §3.2 `POST /agent/chat`).

### Endpoints
- [ ] `POST /agent/chat` (AUDIT.md §3.2), **chat turn**. Wrapper `getAiResponse(messages, currentPage)` (`legacy:src/lib/ai-service.ts:84-121`), raw `fetch` at `:97` (not React Query, not `api.ts`).
  - URL: `${getBackendBaseUrl() || <hardcoded production DQA host>}/agent/chat` (`legacy:src/lib/ai-service.ts:10-12,97`). **BUG**: hardcoded fallback host. The rebuild must use the `core/api` DQA client only.
  - Headers: `Content-Type: application/json`, plus `Authorization: Bearer <token>` when `getStoredToken()` returns one (`legacy:src/lib/ai-service.ts:14-20`).
  - Body: `{ messages: [ {role:"system", content: SYSTEM_PROMPT}, {role:"system", content:"[Current User Context: The user is currently viewing the <currentPage> page.]"}, ...history, newUserMessage ], temperature: 0.7, max_tokens: 1024 }` (`legacy:src/lib/ai-service.ts:85-104`). The full conversation history is resent on every turn. It is not truncated, including the AI greeting as the first assistant message.
  - `currentPage` = `document.title.split("-")[0].trim() || "Dashboard"` (`legacy:src/components/dashboard/AiAssistant.tsx:78`). **BUG**: nothing in src sets `document.title` (grep finds only this read), so it is always the static `index.html` title "PMP" and the model never learns the real page. Port the intended behaviour: send the current route's page title or name from the manifest/nav.
  - Fires: on submit or suggestion click, unless the text is empty or a request is already loading (`legacy:src/components/dashboard/AiAssistant.tsx:68-70`).
  - Response: `data.choices?.[0]?.message?.content ?? ""` (`legacy:src/lib/ai-service.ts:115-116`). Non-OK: throws `errorData.error?.message || "Agent request failed: <status> <statusText>"` (`:107-113`). Note the `{error:{message}}` envelope, which differs from the rest of the backend (AUDIT.md §3.2).
  - Server caps `max_tokens` at 600 and forces `stream:false`. No streaming (AUDIT.md §3.2). **QUESTION**: should the rebuild send `max_tokens` ≤ 600 explicitly?
- [ ] `POST /agent/chat` (AUDIT.md §3.2), **greeting**. Wrapper `getAiGreeting({firstName, role, isReturning, awayLabel, liveSummary, diffSummary})` (`legacy:src/lib/ai-service.ts:127-173`), raw `fetch` at `:154`.
  - Body: `{ messages: [ {role:"system", content: greetingSystemPrompt}, {role:"user", content: "<userCtx> <liveSummary> <diffSummary> Please greet me now."} ], max_tokens: 220, temperature: 0.6 }` (`legacy:src/lib/ai-service.ts:157-167`).
  - `userCtx`: returning → `User: <firstName> (<role>). RETURNING user — last visited <awayLabel>.`; first visit → `User: <firstName> (<role>). This is their FIRST recorded visit.` (`legacy:src/lib/ai-service.ts:136-138`).
  - `liveSummary` = `Platform: <app name>. Current page: <location.pathname>.`. The app name is hardcoded (`legacy:src/components/dashboard/AiAssistant.tsx:187`). `diffSummary` = `User last opened the platform <awayLabel> ago.` only when returning (`:188`).
  - Fires: once per component mount, the first time `isOpen` becomes true, and only if `messages` is empty (no stored history). A `greetedRef` guard prevents repeats (`legacy:src/components/dashboard/AiAssistant.tsx:149-199`). Because DashboardLayout is rendered per page, every navigation remounts the widget. If the user cleared the chat and then navigates while the widget is open, a new greeting request fires.
  - Response: trimmed `choices[0].message.content`, falling back to `Hi <firstName> — ask me anything about <app>.` (`legacy:src/lib/ai-service.ts:170-172`). On failure the widget shows `Hi <firstName> — local agent is warming up. Ask me anything about <app>.` (`legacy:src/components/dashboard/AiAssistant.tsx:194-196`).
- [ ] `GET /agent/health` (AUDIT.md §3.2): **not called** by the legacy frontend. **QUESTION**: should the rebuild use it to show an online/offline dot? Legacy shows a permanently pulsing green dot (`legacy:src/components/dashboard/AiAssistant.tsx:224`) whatever the real status.

### System prompts (location and hardcoded program facts; summary, not pasted)
- [ ] Main prompt `SYSTEM_PROMPT`, a module-level constant at `legacy:src/lib/ai-service.ts:27-82`. It hardcodes:
  - Assistant name "Bumi" and app/platform name ("ECAP+ PMP Assistant", "ECAP+ Program Management Platform") (`:28,32`).
  - Program purpose: tracking Vulnerable Children and Adolescents (VCA) and households **in Zambia** (`:33`).
  - Domain entities: VCA, Households, Services grouped as "Schooled, Healthy, Safe, and Stable", Active/Archived registers, Districts with examples "Lusaka, Ndola", Case Plans, Flags (`:34-41`).
  - Sub-population abbreviations with expansions: CALHIV, HEI, AGYW, CALWD, PBFW, CAAHH, and also "CFSW, ABYM, CAICHH, CAICH, CAIFHH, MUC" listed without expansions (`:42-49`).
  - Navigation hints: "Quick Access" floating button at top-right, Sidebar, Charts, admin-only User Management (`:51-55`).
  - Colour-personalisation rules: allowed targets `banner, sidebar, header, background, button, card, text, theme`, and the exact JSON command format `{"action":"change_color","target":...,"value":...}` in a ```json fenced block, with a CSS colour value (`:57-71`).
  - Scope refusal rules, with the canned refusal text naming the app and the "only restricted to color changes" text (`:73-78`). The prompt also cites "Where is Zambia?" as an off-scope example (`:75`).
  - "OVC program" wording (`:74`).
- [ ] Greeting prompt, a local `systemPrompt` in `getAiGreeting` (`legacy:src/lib/ai-service.ts:140-152`). It hardcodes "Bumi", the app name, "Self-hosted on Llama 3.2", the greeting format (line 1 self-introduction plus ONE data point, a blank line, 3 "• " bullets, no headers, max one emoji) and example diffs ("12 new VCAs were registered", "2 new flags appeared"). **BUG/QUESTION**: the prompt asks for "ONE live data point" and a "diff item", but the client sends no data, only the time away (`legacy:src/components/dashboard/AiAssistant.tsx:187-188`). The model is invited to invent statistics.
- [ ] Rebuild: build both prompts at runtime from `@/config` (assistant name, app name, organisation, country, example districts, sub-population list with labels, service domains, model description). Keep them in the assistant module, not in `core`. The backend also has its own default prompt with hardcoded branding, but it is dropped whenever the client sends a system message (AUDIT.md §3.2).

### Fields used
| Field | Raw keys tried | Where shown / how used | Formatting |
| --- | --- | --- | --- |
| user first name | `user.first_name`, fallback `"there"` (`legacy:src/components/dashboard/AiAssistant.tsx:56,158`) | greeting fallback texts and greeting prompt | as-is |
| user id (storage key) | `user.id` → `user.email` → `"guest"` for the snapshot key (`:157`); `user.id` → `"guest"` for the history key (`:118`) | localStorage keys | as-is |
| role | `user.role.name` → `user.role` if string → `"user"` (`:159`) | greeting prompt only | as-is |
| reply text | `choices[0].message.content` (`legacy:src/lib/ai-service.ts:116,172`) | message bubble | plain text, no markdown rendering (`legacy:src/components/dashboard/AiAssistant.tsx:314`) |

### Filters / sort / pagination / search
- [ ] None.

### Exports
- [ ] None.

### Charts
- [ ] None.

### Links in / out
- [ ] In: no navigation targets it. It opens through the floating toggle button (`title="Open AI Assistant"`, `legacy:src/components/dashboard/AiAssistant.tsx:380-382`) or automatically on mount when `localStorage["ai_assistant_open"] === "true"` (`:37`).
- [ ] Out: none. Replies are plain text and links are not rendered.

### Loading / empty / error
- [ ] Loading: an assistant-style bubble with a spinner and the text "Transmitting..." (`legacy:src/components/dashboard/AiAssistant.tsx:318-327`). The input and Send button are disabled while loading (`:354,360`).
- [ ] Empty (no messages and not loading): the "Common queries" label with 4 suggestion buttons (`:265-287`). Each sends its query immediately (`:275`). The suggestions, from `SUGGESTIONS` (`:29-34`), in order (label → query):
  1. "VCA Registration" (User icon) → "Show me the steps to register a new VCA child in the system."
  2. "Data Flag System" (AlertTriangle) → "Explain what flagged records are and why they appear."
  3. "Household Services" (FileText) → "What types of services can I record for a household?"
  4. "ECAP+ Quick Tour" (HelpCircle) → "Give me a quick tour of the system's main features." (the label hardcodes the app name)
- [ ] Chat error: the bubble "I'm having a brief connection issue. Please try again in a moment." is added as an assistant message (and persisted) (`:107-112`). No toast, no retry button.
- [ ] **BUG**: warning styling (amber bubble plus Info icon) is applied when `m.content.includes("trouble")` (`:308,311`), but the error text says "connection issue", so it is never styled as a warning. A genuine reply containing "trouble" is wrongly styled. Port the intent: flag error messages structurally (e.g. `status: "error"`), not by substring.
- [ ] Greeting error: the fallback text above. No error UI.

### Bugs and quirks
- [ ] **BUG** Hardcoded fallback backend URL (`legacy:src/lib/ai-service.ts:10-12`). Raw `fetch` bypasses the API client, so there is no 401 handling or token refresh.
- [ ] **BUG** `currentPage` is always "PMP" (see Endpoints).
- [ ] **BUG** The greeting asks the model for live data points that are never supplied, so statistics are hallucinated (see System prompts).
- [ ] **BUG** The history is unbounded. Every turn resends the full stored conversation (`legacy:src/lib/ai-service.ts:90-94`). The backend body limit is 100 kB (AUDIT.md §3.2), so a long chat eventually fails with HTML 413 and shows only the generic error. Rebuild: cap the turns or characters sent.
- [ ] **BUG** Chat history is in localStorage per user and is **not cleared on logout**. Logout removes only `ecap.access_token` (`legacy:src/lib/auth.ts:40`), so conversations remain readable on shared devices. Also, `user.id` falls back to `"guest"`, so history from before the user loads is shared (`legacy:src/components/dashboard/AiAssistant.tsx:118`).
- [ ] **BUG** The snapshot key uses `user?.id || email || "guest"` while the history key uses `user?.id || "guest"` (`:118,157`). They are inconsistent. The greeting effect can also run before `user` loads (it is keyed on `isOpen` only, `:198-199`), which records the snapshot under `"guest"`.
- [ ] **BUG** `max_tokens: 1024` is silently capped to 600 by the server (AUDIT.md §3.2).
- [ ] **QUESTION** The colour-command feature is security-sensitive. The model's output (driven by user text) writes arbitrary strings into CSS custom properties on `<html>`. Only the `target` is whitelisted (`:51-53,88`), not the `value`. The changes persist to `ecap.ui_theme` (`legacy:src/context/ThemeContext.tsx:39-41`) and survive reloads. `resetTheme` is destructured but never called from the widget (`legacy:src/components/dashboard/AiAssistant.tsx:49`), so the user cannot undo an AI colour change from the assistant. A hex value written into `--primary`/`--background` (which expect HSL triplets for Tailwind) is likely to break styles (`legacy:src/context/ThemeContext.tsx:47-72`). The rebuild's theme tokens come from `theme.css`. Keep, restrict (validated colour plus reset) or drop?
- [ ] **QUESTION** The JSON-command regex requires a fenced block exactly in the form "```json\n…\n```" (`legacy:src/components/dashboard/AiAssistant.tsx:83,92`). Any other spacing leaves the raw JSON visible. Only the first block is handled. If `action` is not `change_color`, the whole reply is replaced with "I am only restricted to color changes." (`:96-98`). A `change_color` with a non-allowed target is left as-is and the JSON stays visible.
- [ ] Quirk: the minimised state is not persisted (`:38`); only open/closed is.
- [ ] Quirk: `isMinimized` hides the body and shrinks the card to `h-14` (`:209,258`).

## Other behaviour
- [ ] **Layout**: fixed `bottom-4 right-4`, `z-[9999]` (`legacy:src/components/dashboard/AiAssistant.tsx:203`). The card sits above the toggle position, `w-[calc(100%-32px)] sm:w-[380px]`, height `480px` (sm `600px`), and the message area is `320px`/`430px` (`:207-211,261`). Hard-coded slate/emerald colours (`:208-388`) must become theme tokens. Decorative ping/pulse animations (`:224,390`) are optional per the UI rules. On mobile the floating button sits at bottom-right while `MobileBottomNav` is also bottom-fixed. **QUESTION**: possible overlap; the new overlay must avoid the mobile bottom nav.
- [ ] **Header buttons**: Trash icon (`title="Start New Chat"`) runs `clearChat`, which empties messages and removes the history key (`:120-123,230-238`). Minimise/maximise toggle (`:239-246`). X closes (`:247-254`). The footer also has a "Close chat" text button (`:339-345`).
- [ ] **Input**: placeholder "Ask anything...". Submits on form submit (Enter). Send is disabled when loading or the input is empty after trim. The input clears after send (only for typed input, not suggestions) (`:74,334-370`). The trimmed text is stored as the user message (`:72`).
- [ ] **Auto-scroll** to the bottom of the Radix ScrollArea viewport whenever messages or loading change (`:59-66`).
- [ ] **Sound**: `playDrop()` (a Web Audio sine sweep from 900 Hz to 220 Hz, 0.28 s) after each successful reply and after a successful greeting (`:106,192`; `legacy:src/lib/sounds.ts:47-51`). Not played on error. **QUESTION**: keep, and behind a user preference?
- [ ] **Message model**: `{ role: "system" | "user" | "assistant"; content: string }` (`legacy:src/lib/ai-service.ts:22-25`). User bubbles are right-aligned, assistant bubbles left-aligned, each with a User/Bot avatar (`:291-317`).
- [ ] **Storage keys** (all localStorage):
  - `ai_assistant_open`: `"true"`/`"false"`, read on init and written on every change (`legacy:src/components/dashboard/AiAssistant.tsx:37,40-42`). Per browser, not per user.
  - `ecap.chat_history.<userId>` (or `ecap.chat_history.guest`): JSON array of `Message`. Loaded whenever the key changes (`:125-136`), written whenever messages are non-empty (`:138-142`), removed by clearChat (`:122`). **Not** cleared on logout. Since a non-empty list is never written back as empty except through `clearChat`, history persists across reloads and pages.
  - `bumi.snapshot.<userId|email|guest>`: `{ ts: <epoch ms> }`. Read and overwritten the first time the widget opens in each mount, which drives the "returning user / away N days|hours|minutes" label (`:160-179`). The away label uses days if ≥ 1 day, else hours if ≥ 1 hour, else minutes, with singular/plural (`:172-177`).
  - `ecap.ui_theme`: JSON `{banner, sidebar, header, background, button, card, text, theme}`, written by ThemeContext after any `updateColor` (`legacy:src/context/ThemeContext.tsx:34-42`). The `theme` value sets `--primary`, `--accent` and `--ring`. `background` → `--background`, `card` → `--card`, `text` → `--foreground`, `sidebar` → `--sidebar-background`, and `banner`/`header`/`button` → `--banner-color`/`--header-color`/`--button-color` (`:56-77`). `JSON.parse` on init is not wrapped in try/catch (`:35-36`). **BUG**: a corrupt value crashes the app at the provider.
  - Rebuild: storage keys must not carry the legacy brand prefix ("ecap."/"bumi."). Take the prefix from config. Conversation data is user-private, so clear it on logout.
- [ ] **Timers/polling**: none (no intervals, no SSE, no streaming). The only time-based logic is the away-label computation.
- [ ] **Browser APIs**: localStorage, Web Audio (`AudioContext`/`webkitAudioContext`), `document.title`, `document.documentElement.style.setProperty`.
- [ ] **Privacy note (from the code comment)**: "PII never leaves the server; no third-party API key" (`legacy:src/lib/ai-service.ts:4-5`). The first name and role are sent to the self-hosted LLM.

## Open questions for the developer
1. Colour personalisation through the AI: keep (with a validated colour plus a reset action, mapped onto the new theme tokens), or drop? It is the only "action" the assistant performs.
2. Should the greeting include real, scope-filtered live data (e.g. counts from the dashboard queries, respecting `platform/scope`)? Or should the prompt stop asking for data points it never receives?
3. Assistant name ("Bumi"), model description ("Llama 3.2") and suggestion list: move to `@/config` (`site.config`/`program.config`)? Confirm the four default suggestions.
4. Should history stay in localStorage (cleared on logout, size-capped), or be session-only? How many turns should be sent per request?
5. Use `GET /agent/health` for an online indicator, or disable the input when the agent is down?
6. Should the assistant be hidden behind a feature flag (`useFeature("assistant")`) and/or a permission? Legacy shows it to every authenticated user.
7. Backend asks (for PROGRESS.md): server-side system prompt/guardrails (the client can replace the prompt), rate limiting, a fixed model (the client can choose `model`), and a consistent error envelope (AUDIT.md §3.2).
