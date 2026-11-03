# support — legacy audit

> Legacy routes → new routes: `/support` → `/support` · Plan: MIGRATION_PLAN.md §5 row "support" ("Support centre; chat and calls are sub-features with their own flags"). Developer decisions: **chat is used, calls and voice notes are not** (docs/PROGRESS.md decision #4). The stack keeps `support.chat` on and `support.calls` off until confirmed otherwise.

## Legacy files

| File | Lines | Role |
| --- | --- | --- |
| `src/pages/SupportCenter.tsx` | 884 | The whole page (read in full): conversation list, chat pane, message composer, calls, file/voice/emoji attachments. |
| `src/App.tsx` | 602 | Route at `:533-541` (lazy import `:102`), QueryClient defaults `:112-133`, persister `:140-161` (relevant parts read). |
| `src/components/auth/ProtectedRoute.tsx` | 23 | Route guard (read in full). |
| `src/components/dashboard/AppSidebar.tsx` | 346 | Nav entry `:108-111` in the "Help & support" section; visibility filter `:147-181` (relevant parts read). |
| `src/components/dashboard/MobileBottomNav.tsx` | 52 | No support entry (`:6-10`). |
| `src/components/dashboard/GlobalSearch.tsx` | 212 | No support nav entry (`:34-45`), but imports `quickHelpLinks` and `faqs` from `@/data/supportData` for the "Help" and "FAQs" groups (`:31,177,192`). |
| `src/components/dashboard/DashboardHeader.tsx` | 539 | Help button → `/support` (`:258-266`); support notifications deep-link to `/support?userId=<sender>` (`:129-130`); `/support` is in `HIDDEN_ROUTES` (`:41`, so the header search and FY filter are hidden there). |
| `src/lib/directus.ts` | 869 | `listUsers` `:79-98`, `getChatMessages` `:116-130`, `sendChatMessage` `:133-174`, `deleteChatMessage` `:182-187`, `uploadFile` `:190-204`, `getFileUrl` `:215-221`, `createNotification` (`:514-527`, used by `sendChatMessage`). |
| `src/hooks/useWebRTC.ts` | 224 | PeerJS Cloud signalling + WebRTC media, with screen sharing. **Not ported** (decision #4). |
| `src/hooks/useEffectiveDistrict.ts` | 18 | Not used by this page. Scope comes from the user list instead. |
| `src/components/chat/CallOverlay.tsx` | 188 | Incoming/outgoing call UI. **Not ported.** |
| `src/components/chat/VoiceRecorder.tsx` | 119 | `MediaRecorder` → `audio/webm` blob upload. **Not ported** (voice notes declined), unless the developer keeps them inside chat. |
| `src/components/chat/FileAttachment.tsx` | 93 | File picker + upload. Port. |
| `src/components/chat/EmojiPicker.tsx` | 94 | Emoji grid; appends to the message draft. Port. |
| `src/components/chat/ProfilePictureModal.tsx` | 194 | View/replace an avatar. Port (read path at least). |
| `src/data/supportData.tsx` | 110 | `faqs`, `quickHelpLinks`, `fullManual`. Only `faqs` and `quickHelpLinks` are consumed, by `GlobalSearch`. Brand-bearing hardcoded content. |
| `src/lib/sounds.ts` | 51 | `playDrop` (AI assistant) and `playBell` (unused). Not used by this page — it uses two inline base64 `<audio>` elements. |
| `src/components/dashboard/DashboardLayout.tsx` | 110 | Page chrome (`title="Support Center"`). |
| `src/components/EmptyState.tsx` | 51 | Not used on this page (it has ad-hoc empty states). |
| `src/components/ui/avatar.tsx`, `badge.tsx`, `scroll-area.tsx`, `select.tsx`, `dropdown-menu.tsx`, `input.tsx`, `button.tsx` | — | shadcn primitives used by the page. |
| `src/context/AuthContext.tsx` | 150 | `useAuth().user.id` is the sender id for every message (`:47`, `:150`). |

## Route `/support` → `/support`

### Purpose

"Support center" (`legacy:src/pages/SupportCenter.tsx:458-471`), subtitle "Talk to teammates, share files, and resolve issues without leaving the platform." It is a two-pane messaging client: a searchable conversation list on the left and a chat pane on the right, plus priority tagging, attachments, message deletion and (declined) audio/video calls. Messages are **Directus notifications**, not a chat API: one row per message, in two collections that the frontend defines (`support_chat` inbox, `support_chat_outbox` outbox).

### Access

- [ ] Route guard: `<ProtectedRoute>` only, no role check (`legacy:src/App.tsx:533-541`). `ProtectedRoute` redirects to `/` with no user and to `/change-password` when `user.password_change_required` (`legacy:src/components/auth/ProtectedRoute.tsx:8-19`).
- [ ] Sidebar: `{ title: "Support Center", url: "/support", icon: CircleHelp }` in the "Help & support" section (`legacy:src/components/dashboard/AppSidebar.tsx:108-111`). No filter rule matches it — the rules only cover `/districts` (district users), the "Admin" section and the "Data Pipeline" section (`:164-175`) — so **every logged-in user sees it**.
- [ ] Header: a help icon navigates to `/support` on every page except the `HIDDEN_ROUTES` set (`legacy:src/components/dashboard/DashboardHeader.tsx:41,258-266`).
- [ ] Mobile bottom nav: no entry (`legacy:src/components/dashboard/MobileBottomNav.tsx:6-10`); reachable from the header icon only.
- [ ] Global search nav: no "Support" entry; its help/FAQ groups come from `src/data/supportData` (`legacy:src/components/dashboard/GlobalSearch.tsx:31,177,192`). **QUESTION:** in the rebuild, should the help/FAQ groups move to the `docs` module and out of search?
- [ ] **In-page visibility rule (the only real access logic).** The conversation list is filtered by Directus **role name** (`legacy:src/pages/SupportCenter.tsx:76-106`):
  - Resolve the current role: `user.role` string, else `user.role.name`, else `"User"` (`:87-92`).
  - `isMyRoleSupport = roleName.toLowerCase().includes("support")`; `isMyRoleAdmin = roleName === "Administrator"` (exact, case-sensitive) (`:94-95`).
  - Support or Administrator → **every** user is listed (`:98`).
  - Anyone else → users are hidden when the target role is exactly `"Administrator"` or contains `"ecap ii"`/`"ecapii"` (case-insensitive) (`:101-116`).
  - Consequence: a standard user can message any other standard user, including users in other provinces/districts. **This is a directory exposure, not a chat permission.** Record as a backend ask.
  - In the rebuild this must be `useAccess()` + a permission (e.g. `support.viewAllUsers`), not role-name string matching (`CLAUDE.md` "Access control"). The legacy rule also disagrees with `useEffectiveDistrict.isAdmin` and with the sidebar's `isSupport` (`description === "Support User" || roleName.includes("support")`, `legacy:src/components/dashboard/AppSidebar.tsx:157-158`) — three different admin/support definitions. See `docs/AUDIT.md` §4.4.
- [ ] Conversation visibility is enforced **only by the Directus permissions** on the `directus_notifications` collection: the query filters `recipient` to the current user (`legacy:src/lib/directus.ts:126`). A user who can read the collection without that filter can read every message. Backend ask.
- [ ] Online presence is inferred from `user.last_access` (online when < 5 min, `legacy:src/pages/SupportCenter.tsx:109-113`). No permission involved. The users list is refetched every 30 s purely to refresh it (`:68-72`).

### Endpoints

All Directus; there is no DQA backend call on this page. Every call goes through `directusRequest`, which attaches the stored Directus token (`legacy:src/lib/directus.ts`). Query keys and polling are listed because they drive the whole page.

- [ ] **Conversation source — all messages for the current user.** `useQuery({ queryKey: ["chat-messages", user.id], queryFn: () => getChatMessages(user.id), enabled: !!user.id, refetchInterval: 3000 })` (`legacy:src/pages/SupportCenter.tsx:58-63`).
  - `getChatMessages` (`legacy:src/lib/directus.ts:116-130`): `GET /notifications` with `sort=timestamp`, `limit=500`, `fields=id,status,timestamp,sender,recipient,subject,message,collection,item`, `filter[recipient][_eq]=<userId>`, `filter[sender][_nnull]=true`, `filter[collection][_in]=support_chat,support_chat_outbox`. Returns `data?.data ?? []`.
  - **The same list feeds both the inbox and the outbox.** The code distinguishes them by `collection` (`legacy:src/pages/SupportCenter.tsx:157-159,230-234`). It works only because the outbox copy is addressed to the sender (`recipient: currentSenderId`, `legacy:src/lib/directus.ts:158-166`).
  - **Hard cap: 500 rows per user, no pagination** (`limit: "500"`, `legacy:src/lib/directus.ts:121`). Beyond that the oldest conversations silently disappear from the list. Backend ask.
- [ ] **User directory.** `useQuery({ queryKey: ["users-list-chat"], queryFn: () => listUsers("active"), refetchInterval: 30000 })` (`legacy:src/pages/SupportCenter.tsx:68-72`).
  - `listUsers` (`legacy:src/lib/directus.ts:79-98`): `GET /users?fields=id,email,first_name,last_name,role.id,role.name,status,description,title,location,facility,avatar,last_access,password_change_required&limit=-1&filter[status][_eq]=active`. `limit=-1` fetches **every** active user. The role filter is commented out (`:88-94`).
  - The `["users-list-chat"]` key is not scoped to the current user, and the query is persisted to IndexedDB like every other query (see Storage). Combined with the 24 h persister, the previous user's directory can be read from disk by the next user on the same browser (finding **S5**). New: scope the key by user and set `meta: { persist: false }`.
- [ ] **Send a message** (`sendMutation`, `legacy:src/pages/SupportCenter.tsx:123-142` → `legacy:src/lib/directus.ts:133-174`):
  1. Resolve the sender (`/users/me?fields=id` when the caller did not pass `senderId`) (`:140-146`).
  2. `createNotification({ recipient, sender, subject: priority, message, collection: "support_chat", item: fileId ?? null })` (`:149-156`) → `POST /notifications`.
  3. Best-effort outbox copy: `createNotification({ recipient: senderId, sender: senderId, subject: priority, message: fileId ? "<message>|||FILE:<fileId>" : message, collection: "support_chat_outbox", item: recipientId })` (`:158-167`). Failure is swallowed with `console.warn` (`:168`).
  - `onSuccess` clears the input and the priority, invalidates every `["chat-messages"]` query, plays the send sound and toasts "Message sent!" (`legacy:src/pages/SupportCenter.tsx:127-135`). `onError` toasts "Failed to send message" (`:148-150`).
  - **Two writes, no transaction** (`:149-167`): if the outbox copy fails the message is delivered but never appears in the sender's thread.
  - `message` is HTML-unsafe by content but rendered as text (`:449-451`), so no XSS. The `|||FILE:` suffix written into the outbox message is **not parsed anywhere** — attachments are found through `item` on the inbox row only.
- [ ] **Delete a message.** `deleteMessageMutation` (`legacy:src/pages/SupportCenter.tsx:350-367`) → `DELETE /notifications/:id` (`legacy:src/lib/directus.ts:182-187`), after `window.confirm("Delete this message just for you? This cannot be undone.")` (`:341-345`). It deletes **only the current user's copy** (inbox or outbox), so the partner keeps theirs. Toasts "Message deleted" / "Failed to delete message".
- [ ] **Upload an attachment.** `uploadFile` (`legacy:src/lib/directus.ts:190-204`): `POST /files` with `FormData("file")` → `{ data: { id } }`. Used for images, documents and (declined) voice notes. The returned id becomes the notification's `item` (`legacy:src/pages/SupportCenter.tsx:310-332`).
- [ ] **Read an attachment.** `getFileUrl(fileId)` (`legacy:src/lib/directus.ts:215-221`) builds `<DIRECTUS>/assets/<id>?access_token=<token>`. The Directus access token is appended to the URL for every `<img>`, `<audio>` and `<a download>` (`legacy:src/pages/SupportCenter.tsx:370-419,539,597`). The token therefore appears in image requests, browser history and any proxy logs. In the rebuild this must be a short-lived signed URL (Backend ask), never the session token.
- [ ] **Avatar.** Read through `getFileUrl(user.avatar)` (`:539,597`). Replaced through `updateUserAvatar` → `PATCH /users/:id { avatar }` inside `ProfilePictureModal` (see `docs/audit/account.md`).
- [ ] Not called: `listRoles`, `getUser` (`legacy:src/lib/directus.ts:100-113,224-228`), `playBell`, and every voice/call code path (declined).

### Fields used

Directus notification rows (`legacy:src/lib/directus.ts:116-130`). The page treats them as `any` (`legacy:src/pages/SupportCenter.tsx:157`).

| Field | Used as | Notes |
| --- | --- | --- |
| `id` | React key, delete target | string (uuid) |
| `collection` | `support_chat` = received, `support_chat_outbox` = sent; anything else ignored | exact string match (`:161-163`) |
| `sender` | the conversation partner (inbox) / the current user (outbox); drives inbox grouping and the partner of an outbox row | filter requires `sender` non-null |
| `recipient` | query filter only | always the current user |
| `item` | inbox: the uploaded file id; outbox: the **partner's user id** | overloaded, see Bugs |
| `message` | body text; emoji/attachment markers are detected by substring (`🎤`, `📷`, `📎`) | string |
| `subject` | priority chip: `Normal` (hidden), `Urgent`, `Critical` | free text stored by the sender (`:433-443`) |
| `timestamp` | ordering, thread sort, relative time | ISO string |
| `status` | `"inbox"` marks unread | `unread = !isOutbox && status === "inbox"` (`:169`) |

Directus user rows (`legacy:src/lib/directus.ts:81-83`): `id`, `first_name`, `last_name`, `avatar`, `last_access`, `role.id`/`role.name`, `status`, plus `description`, `title`, `location`, `facility`, `email`, `password_change_required` which this page does not render.

### Filters / sort / pagination / search

- [ ] Conversation grouping (`legacy:src/pages/SupportCenter.tsx:151-198`): a `Map` keyed by partner id. Inbox rows key on `sender`, outbox rows on `item`; rows with no partner or with the partner equal to the current user are skipped (`:167`). The map keeps the **latest** message per partner by `timestamp` (`:172-180`). Users with no messages are then added with `lastMessage: null` (`:183-193`). Sort: partners **with** messages first, newest first; then partners without messages, alphabetically by `first_name last_name` (`:196-205`).
- [ ] Search (`:208-217`): placeholder "Search conversations...", client-side, case-insensitive substring on the partner's full name only. Not debounced, not in the URL. It does not search message text.
- [ ] Selection: local state only (`selectedUserId`, `:49`). **Deep link**: `/support?userId=<id>` preselects the partner (`:154-160`); this is what the header notification link uses (`legacy:src/components/dashboard/DashboardHeader.tsx:129-130`). No other URL state. **QUESTION:** make the selected conversation a route param (`/support/:userId`) so it is shareable and refreshable.
- [ ] Thread (`:219-243`): inbox rows whose `sender` is the partner, plus outbox rows whose `item` is the partner, sorted ascending by `timestamp`. No grouping by day and no pagination.
- [ ] No sort controls, no page size, no server pagination anywhere on the page.
- [ ] Presence: `isOnline` = `last_access` within 5 minutes (`:119-124`); the hero badge counts online users (`:456`) and each row shows a dot (`:538-542`).

### Exports

- [ ] None. There is no CSV, PDF or "download conversation" control. Attachments are downloaded individually through the anchor (`:400-417`). New module: nothing to port; flag if a transcript export is wanted.

### Charts

- [ ] None. The page has no charts, no KPI cards and no sparklines; only badges (`{onlineCount} online`, `Live chat & tickets`) and the hero gradient (`legacy:src/pages/SupportCenter.tsx:458-471`).

### Links in / out

- [ ] In: sidebar (`legacy:src/components/dashboard/AppSidebar.tsx:110`), header help icon (`legacy:src/components/dashboard/DashboardHeader.tsx:258-266`), support notification deep link `/support?userId=<sender>` (`:129-130`, matched on `collection.startsWith("support")`), and directly by URL.
- [ ] Out: `Account settings` in the chat overflow menu navigates with a **full page load** to `/profile` when the selected conversation is yourself (`legacy:src/pages/SupportCenter.tsx:658-667`), and `ProfilePictureModal` edits the avatar (`:829-849`). No links to households, VCAs or other records.
- [ ] Consequence for the rebuild: the notification type for `support_chat` must be declared in the `support` module manifest (`notificationTypes`) so `platform/notifications` can link it to `/support/:userId`.

### Loading / empty / error

- [ ] Loading: **no loader at all**. `allMessages` and `rawUsers` default to `[]`, so first paint shows an empty conversation list and "Select a conversation to start messaging"; data pops in when it arrives (`legacy:src/pages/SupportCenter.tsx:56-72,823-831`). The send button shows `LoadingDots` while the mutation is pending (`:787-793`).
- [ ] Empty: conversation list renders nothing at all when the filtered list is empty (`:492-559`, no fallback branch). Empty thread shows only the "Select a conversation to start messaging" pane (`:823-831`). An empty message body renders `Empty message` in italics (`:451`). New: `<EmptyState>` for "no conversations" and "no messages yet".
- [ ] Error: **nothing is handled.** Neither query reads `isError`; a failed messages call looks identical to "no messages", and a failed users call leaves the list blank. Only mutations toast. New: `<ErrorState>` with retry per pane.
- [ ] Not found: `selectedUser` falls back to a synthetic `Remote User (<first 5 chars>)` entry when the partner is missing from the user list (`legacy:src/pages/SupportCenter.tsx:241-257`), so cross-app conversations still render.

### Bugs and quirks

- [ ] **BUG — polling every 3 s.** `refetchInterval: 3000` on the message query (`legacy:src/pages/SupportCenter.tsx:62`) plus `30000` on the users query (`:71`) is a constant request loop per open tab, and neither pauses when the tab is hidden. The plan's rule is one poller, paused when hidden (`MIGRATION_PLAN.md` §4.9). New: one `platform/notifications` poller with `refetchIntervalInBackground: false`.
- [ ] **BUG — attachments are rendered by emoji sniffing.** `renderMessageContent` decides image / file / voice by testing the message text for `📷`, `📎`, `🎤` (`legacy:src/pages/SupportCenter.tsx:370-419`). Any message starting with those characters is treated as an attachment, and a file whose name starts with `📎` is unavoidable. The outbox copy appends `|||FILE:<id>` (`legacy:src/lib/directus.ts:170`) which nothing parses, and the outbox row's `item` is the **partner id**, not the file id, so the sender cannot open their own attachment from the thread. New: model a message as `{ kind: "text" | "file", fileId?, text? }` in the normaliser and store the real file id on both copies.
- [ ] **BUG — `subject` is overloaded as priority.** Any notification in `support_chat`/`support_chat_outbox` whose subject is not `Normal` is rendered as an Urgent/Critical chip (`:433-443`), but Directus `subject` is also where other notification producers put a title. New: a dedicated priority field or a `meta` payload.
- [ ] **BUG — one mutation per keystroke risk.** `handleSendMessage` guards on `message.trim()` and `isPending` (`:290-293`) but the input's Enter handler calls it directly (`:773`), so Enter-to-send has no debounce; a double Enter within the same render sends two messages.
- [ ] **BUG — the conversation list can show the same person twice.** Grouping prefers `msg.item` for outbox rows and `msg.sender` for inbox rows (`:167`). If the outbox copy failed (`:168-170`) the thread still lists the partner from the inbox side, but ordering falls back to alphabetical — tolerable. If a partner id is also a user id in the fallback list, the `Map` dedupes it, so this is only cosmetic.
- [ ] **BUG — `getFileUrl` leaks the access token** into every asset URL (`legacy:src/lib/directus.ts:215-221`). Same class as finding S1/S6; fix with signed URLs.
- [ ] **BUG — unread state never clears.** `status` is read (`:169`) but nothing calls a mutation to mark messages read, so a thread stays bold forever. New: mark read on open, or drop the unread dot.
- [ ] **BUG — no scope awareness at all.** The directory is nationwide and the chat is unrestricted between any two users who can see each other. For a program with district-level confidentiality this is a data-protection issue, not just UX. Backend ask (see `docs/AUDIT.md` §3.2 scope summary).
- [ ] **BUG — brand strings in code.** The chat background renders `ECAP +` 80 times as a watermark (`legacy:src/pages/SupportCenter.tsx:686-689`), the support email `info@bluecodeltd.com` and "ECAP+ PMP" appear in `src/data/supportData.tsx:20,86-88`, and the FAQ tells users to click "Add Household", which does not exist. All must come from `@/config` (`CLAUDE.md` rule 4).
- [ ] **BUG — `window.confirm`** for deletion (`:343`) blocks the main thread and cannot be styled. Use the shared confirm dialog (`ConfirmDialog`, `legacy:src/components/dashboard/ConfirmDialog.tsx`).
- [ ] **Quirk — `limit=-1` and `filter[status][_eq]=active`** mean a suspended or archived user is invisible in chat even if they are in a conversation; their messages then render under the "Remote User" fallback (`:245-262`).
- [ ] **Quirk — two `<audio>` elements carrying the same base64 WAV** inline in the JSX (`:850-856`), ~1 KB each, played imperatively. Rebuild: one shared `platform/notifications` sound, respecting the user's sound toggle.
- [ ] **Quirk — `EMOJI_REGEX`** (`:42`) treats any string of emoji and whitespace as "jumboji" and renders it at `text-5xl` (`:421-428`). Keep as a small presentational helper if wanted.
- [ ] **Quirk — role comparison by name** in three places with three different rules (`:94-95`, `legacy:src/components/dashboard/AppSidebar.tsx:157-158`, `legacy:src/hooks/useEffectiveDistrict.ts:6-7`). See §4.4 of the index.
- [ ] **Quirk — hardcoded locale** `toLocaleDateString("en-GB", …)` in the hero (`:455`) and `date-fns` formats `HH:mm` / `MMM d` (`:322-332`). Route through `core/lib/format.ts`.

## Other behaviour

- [ ] **Modals and overlays:** `ProfilePictureModal` (view/replace avatar, `legacy:src/pages/SupportCenter.tsx:829-849`), `CallOverlay` (declined), `VoiceRecorder` inline (declined), `FileAttachment` inline (`:753-790`), `EmojiPicker` popover (`:769`).
- [ ] **Keyboard:** Enter sends, Shift+Enter inserts a newline (`legacy:src/pages/SupportCenter.tsx:781`). No other shortcuts. Compose has no Ctrl/Cmd+Enter handler.
- [ ] **Timers / polling:** messages every 3 s (`:61`), users every 30 s (`:71`). Two new-message side-effects run in effects: a receive sound when the inbox count grows (`:264-276`) and a smooth auto-scroll to the bottom on thread or selection change (`:278-289`).
- [ ] **Storage:** nothing written by the page itself. Indirectly: the React Query persister writes `["chat-messages", …]` and `["users-list-chat"]` (message bodies and the full user directory) to IndexedDB key `ecap-plus-pmp-react-query` for 24 h (`legacy:src/App.tsx:140-161,214-224`). New module: `meta: { persist: false }` on both queries (`CLAUDE.md` "Data rules").
- [ ] **Browser APIs:** `MediaRecorder` + `getUserMedia` (voice notes, declined), `RTCPeerConnection` via PeerJS (calls, declined), `window.confirm` (delete), `<audio>.play()` (sounds), `window.location.href` (account settings), `URL` for asset links.
- [ ] **PeerJS:** connects to the public PeerJS Cloud with the Directus user id as the peer id and no authentication (`legacy:src/hooks/useWebRTC.ts:37-39`). Anyone who knows a user id could call them. Another reason calls stay off.
- [ ] **Brand / program strings to move to config:** "Support center", "Help & support", "Live chat & tickets", "Talk to teammates…" (`legacy:src/pages/SupportCenter.tsx:458-471`), the `ECAP +` watermark (`:690`), the whole of `src/data/supportData.tsx` (FAQ text, `info@bluecodeltd.com`, "ECAP+ PMP", "Full System Manual (v2.4)").
- [ ] **Decisions already made:** calls, voice notes and screen sharing are **not** ported (`docs/PROGRESS.md` decision #4). Chat is. The rebuild should keep `support.chat` as a feature flag (`MIGRATION_PLAN.md` §4.2) so the module can be switched off without touching other modules, and simply omit `support.calls`.

## Open questions for the developer

1. **Backend ask:** chat has no backend of its own — it is Directus notifications with two ad-hoc collection names and an `item` field doubling as a file id *and* a partner id. Should the backend refactor add a real `support_messages` table (sender, recipient, body, file, priority, read_at) plus `GET /support/messages?with=&before=`? That would remove the 500-row cap, the polling and the overloaded fields in one change.
2. **Privacy:** should a standard user be able to message and see any active user nationwide, or only their own district/province plus support staff? Legacy shows everyone except admins and "ECAP II" users. This is a policy decision that also drives the `deriveAccess` permissions.
3. **Is `/support` the right home for the FAQ and quick-help content?** Today `GlobalSearch` renders `faqs` and `quickHelpLinks` from `src/data/supportData`, while the `docs` module owns `/documentation`. Proposal: move the help content into `docs` as Markdown and let `support` be chat only.
4. **Unread state:** keep the dot (needs a "mark read" write), or drop it until the backend has a read receipt?
5. **Transcript export:** does support need a CSV export of a conversation for auditing? Legacy has none.
6. **Voice notes:** you said voice notes are not used; the same `VoiceRecorder` component is only reachable from this page, so it can be deleted outright. Confirm.
