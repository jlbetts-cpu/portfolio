> **SUPERSEDED 2026-08-20 by `docs/workspace-plan.md`.**
> That document was written from the real source at `~/Desktop/Reshore/lifeline`;
> this one was written from the minified bundle. The reasoning here still holds
> and §5 (export twice, dry-run, count, then LOOK) should be kept verbatim, but
> several specifics are wrong — the bucket name, the storage paths, the DDL
> types, the RLS policy count, and the magic-link redirect. See §6 of the new
> plan for the corrections, and do not run this one's DDL against the shipped
> schema.

# Supabase for the workspace app — plan

Written 2026-08-20 from **static analysis only** of the compiled bundle at
`workspace/assets/index-Bjpj2J7U.js` (472 KB, Vite/Rollup, React 19). No account
was created, no credential was requested or handled, nothing in the repo was
modified except this file. The browser was never driven — `hmCompanions` was
never at risk.

---

## 0. Read this first — two things that change the shape of the job

### 0.1 The app already has a Supabase sync path. It was compiled out.

Settings → **Cloud sync** renders exactly this, unconditionally:

> Not set up yet. Create a free project at supabase.com, run `supabase/schema.sql`
> in its SQL editor, copy your project URL + anon key into `.env` (see
> `.env.example`), and restart the app.

The component behind it (minified `eg()`) declares seven pieces of state — an
email field, a busy flag, an error, a status — and then has an **empty**
`useEffect(() => {}, [])`. Meanwhile:

- `@supabase/supabase-js` is **not in the bundle**: zero hits for `supabase-js`,
  `gotrue`, `auth/v1`, `rest/v1`, `realtime/v1`.
- There is **not one** `import.meta.env` reference anywhere in 472 KB.

That combination has one explanation: Vite inlined `import.meta.env.VITE_SUPABASE_*`
as `undefined` at build time, the `createClient` branch became statically
unreachable, and Rollup shook out the client and the whole sync module.

**So the source repo almost certainly already contains `supabase/schema.sql`, a
`.env.example`, and a written sync implementation.** That source is **not in this
tree** — `react/workspace/` is a byte-identical copy of the same `dist/`, not
source.

> **Step 0, before anything below: find the workspace source repo.** If
> `supabase/schema.sql` exists there, run *that*, not the DDL in §2. This
> document then becomes a review checklist — compare its schema against §2, and
> check §4 (local-first) and §3 (auth) against what it actually does, because
> those are the two places a first-pass sync implementation is usually wrong.
>
> The DDL in §2 is the fallback if the source is gone, and the reference if it
> isn't.

### 0.2 There is no "Projects" tab.

The nav is **Timeline · Memory · Habits · Books · Kitchen**. The nearest thing to
"projects" is **goals** — an array stored under the single IndexedDB `kv` key
`goals`, rendered as *"Direction & daily practice"* inside the Habits tab, and
fed into every AI prompt as `Goals: …`.

I've promoted `goals` to a first-class table in §2. It is currently one JSON blob
under one key, which is the worst possible thing to sync: two devices that each
add a goal don't merge, they clobber the whole list.

---

## 1. What it persists today

**Nothing is in `localStorage` or `sessionStorage` — zero occurrences of either
in the bundle.** Everything is IndexedDB.

Database `lifeline`, **version 2**, opened once and memoised. Eight object
stores, created in `onupgradeneeded`:

| store | keyPath | index | notes |
|---|---|---|---|
| `days` | `date` | — | one row per calendar day |
| `photos` | `id` | `byDate` → `date` | holds two `Blob`s each |
| `habits` | `id` | — | |
| `habitLog` | `key` | `byDate` → `date` | composite key |
| `memory` | `id` | — | may hold a `Blob` |
| `settings` | `key` | — | `{key, value}` |
| `books` | `id` | — | sessions nested inside |
| `kv` | `key` | — | `{key, value}` |

Ids are `crypto.randomUUID()`. Dates are `YYYY-MM-DD` local strings. There is a
tiny in-memory pub/sub bus keyed by store name; every mutating helper fires it
and every tab subscribes. **The sync layer should hook that same bus, not replace
it** (see §4).

### 1.1 Exact record shapes

```js
// days  (keyPath: date)
{
  date:       "2026-08-20",   // YYYY-MM-DD
  journal:    "",             // free text, multi-paragraph, "\n\n"-joined on append
  mood:       null,           // 1..5 | null   (Bm() reports "Avg mood x/5")
  proteinHit: null,           // true | false | null
  reminders:  [],             // string[]  — plain strings, not objects
  updatedAt:  1755..._        // Date.now(), written by the put helper
}
```
`days` is the **only** store whose records carry a modification timestamp.
Everything else has `addedAt` (creation) or nothing at all. That matters in §4.

```js
// photos  (keyPath: id, index byDate)
{
  id:             "uuid",
  date:           "2026-08-20",
  blob:           Blob,        // the ORIGINAL uploaded file, full size
  thumb:          Blob,        // image/jpeg, longest edge ≤ 320px, quality 0.82
  name:           "IMG_4021.HEIC",
  caption:        "",          // written by Claude Haiku after upload
  captionPending: true,        // flips false when captioning settles or fails
  addedAt:        1755..._,
  embedding:      [/* 384 floats */]   // OPTIONAL — all-MiniLM-L6-v2, mean-pooled,
                                       // normalised; only if Local AI is on
}

// habits  (keyPath: id)
{ id: "uuid", name: "Lift", emoji: "", order: 0, archived: false }

// habitLog  (keyPath: key)
{ key: "2026-08-20|<habitId>", date: "2026-08-20", habitId: "uuid", done: true }

// memory  (keyPath: id)
{
  id:      "uuid",
  kind:    "note" | "photo" | "pdf" | "file",
  title:   "…",          // for notes: first 48 chars of text + "…"
  text:    "…",          // "" for non-note kinds
  blob:    Blob | null,  // null for notes
  mime:    "text/plain",
  addedAt: 1755..._
}

// books  (keyPath: id)
{
  id: "uuid", title: "…", author: "Unknown",
  status: "reading" | "finished",
  addedAt: 1755..._,
  sessions: [
    { date: "2026-08-20",
      turns: [ { role: "you" | "claude", text: "…" } ] }
  ]
}
```

```js
// settings  (keyPath: key) — {key, value}, all values are STRINGS
anthropic_api_key : "sk-ant-…"        // ← a live bearer credential. See §2.5.
local_ai          : "true" | "false"  // gates the transformers.js embedder
notify_enabled    : "true" | "false"
notify_last       : "2026-08-20"      // dedupes the daily reminder notification
profile_name      : "Jayden"
protein_target    : "160"             // stringified int, default 160
```

```js
// kv  (keyPath: key) — {key, value}, values are objects/arrays
goals   : [ { id:"uuid", title:"…", why:"", archived:false, createdAt:1755..._ } ]

kitchen : {
  pantry:  ["olive oil", …],                         // string[]
  goal:    "Build muscle — lifting 4x/week",         // default
  plan:    null | {                                   // Claude Sonnet JSON
    detected: ["eggs", …],
    days:     [ { day:"Monday",
                  meals:[{ name:"…", protein:45, usesOwned:["…"] }],
                  totalProtein:162 } ],
    grocery:  [ { item:"…", reason:"needed for X + Y" } ],
    coachNote:"…"
  },
  planAt:  null | 1755..._,
  checked: ["chicken thighs", …]   // grocery items ticked off, by item STRING
}

"review:2026-W34" : {              // one per ISO week, key is `review:${YYYY-Www}`
  reflection: "…", win: "…", friction: "…", question: "…",
  answered:   false                // flips true once the answer is journalled
}
```

### 1.2 The existing export/import — and its hole

Settings → **Export all data** produces:

```js
{ version: 2, exportedAt: "<ISO>",
  days, habits, habitLog, books, kv,
  photos,   // each: {...photo, blob: "data:…", thumb: "data:…"}
  memory }  // each: {...item,  blob: "data:…" | null}
```

Blobs are `FileReader.readAsDataURL`'d. The importer rehydrates with
`fetch(dataUrl).blob()`, so any migration artefact that wants to reuse the
built-in importer must produce that exact form.

> **The export omits `settings` entirely, and so does the import.** A round trip
> loses `profile_name`, `protein_target`, `notify_*` and the API key. Losing the
> key is good hygiene; losing your name and protein target silently is not.
> Record those two by hand before migrating (§5).

### 1.3 Volume — this is why photos don't go in Postgres

`photos.blob` is the **original** upload (a modern phone HEIC/JPEG is 2–6 MB) and
it's kept forever alongside a 320px thumb. `memory.blob` can be a whole PDF.
Postgres `bytea` in a row you `select *` on is the wrong home for that; Supabase
Storage is the right one. See §2.4.

---

## 2. Schema

Design rules I applied, in order:

1. **Local IndexedDB stays the source of truth for reads.** Postgres is a
   replica and a transport, never in the render path. So the schema optimises
   for "give me everything changed since cursor X", not for query flexibility.
2. **Typed tables where the app fans out across records** (`zm()` reads seven
   stores to build one AI prompt; `Bm()` reads goals, notes, habits, mood,
   profile, kitchen and books). One `kv` table for the genuine singletons and
   series-of-one-blob things, mirroring what the app already does.
3. **Blobs go to Storage, never to a row.**
4. **Embeddings are not synced at all.** They're 384 floats derivable from a
   caption in ~10 ms on-device, and the receiving device may not even have Local
   AI enabled. Syncing them multiplies row size for zero user-visible value.
   Regenerate locally; the app already does this lazily in `hh()`.
5. **Soft deletes everywhere.** A hard `DELETE` is invisible to a device that was
   offline when it happened, so that device pushes the row straight back and the
   thing you deleted resurrects. This is the single most common local-first sync
   bug and the schema has to prevent it, not the client.

Nine tables.

### 2.1 DDL

```sql
-- ============================================================
--  workspace / "lifeline"  — Supabase schema
--  Single user. RLS is ON everywhere and is the only thing
--  between a stranger and the journal. See §2.5.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- shared plumbing ----------

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- days ----------
create table public.days (
  user_id      uuid        not null default auth.uid()
                           references auth.users(id) on delete cascade,
  date         date        not null,
  journal      text        not null default '',
  mood         smallint         check (mood between 1 and 5),
  protein_hit  boolean,
  reminders    text[]      not null default '{}',
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  primary key (user_id, date)
);

-- ---------- habits ----------
create table public.habits (
  id           uuid        primary key,
  user_id      uuid        not null default auth.uid()
                           references auth.users(id) on delete cascade,
  name         text        not null,
  emoji        text        not null default '',
  sort_order   int         not null default 0,   -- "order" is reserved
  archived     boolean     not null default false,
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

-- ---------- habit_log ----------
-- local key is "<date>|<habitId>"; split it, don't store the string
create table public.habit_log (
  user_id      uuid        not null default auth.uid()
                           references auth.users(id) on delete cascade,
  date         date        not null,
  habit_id     uuid        not null references public.habits(id) on delete cascade,
  done         boolean     not null default false,
  updated_at   timestamptz not null default now(),
  primary key (user_id, date, habit_id)
);

-- ---------- goals  (the "projects" of §0.2) ----------
create table public.goals (
  id           uuid        primary key,
  user_id      uuid        not null default auth.uid()
                           references auth.users(id) on delete cascade,
  title        text        not null,
  why          text        not null default '',
  archived     boolean     not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

-- ---------- books ----------
create table public.books (
  id           uuid        primary key,
  user_id      uuid        not null default auth.uid()
                           references auth.users(id) on delete cascade,
  title        text        not null,
  author       text        not null default 'Unknown',
  status       text        not null default 'reading'
                           check (status in ('reading','finished')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

-- ---------- book_sessions ----------
-- Split out of books.sessions[] on purpose: a book-club session is the one
-- thing in this app you plausibly start on a laptop and continue on a phone,
-- and appending to a nested array from two devices loses one of them.
create table public.book_sessions (
  user_id      uuid        not null default auth.uid()
                           references auth.users(id) on delete cascade,
  book_id      uuid        not null references public.books(id) on delete cascade,
  date         date        not null,
  turns        jsonb       not null default '[]'::jsonb,  -- [{role,text}]
  updated_at   timestamptz not null default now(),
  primary key (user_id, book_id, date)
);

-- ---------- memory_items ----------
create table public.memory_items (
  id           uuid        primary key,
  user_id      uuid        not null default auth.uid()
                           references auth.users(id) on delete cascade,
  kind         text        not null
                           check (kind in ('note','photo','pdf','file')),
  title        text        not null default '',
  body         text        not null default '',     -- local `text`
  mime         text        not null default 'text/plain',
  storage_path text,                                -- null for notes
  byte_size    bigint,
  added_at     timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

-- ---------- photos ----------
-- No embedding column: see design rule 4.
create table public.photos (
  id              uuid        primary key,
  user_id         uuid        not null default auth.uid()
                              references auth.users(id) on delete cascade,
  date            date        not null,
  name            text        not null default '',
  caption         text        not null default '',
  caption_pending boolean     not null default false,
  storage_path    text        not null,   -- <uid>/photos/<id>/original
  thumb_path      text        not null,   -- <uid>/photos/<id>/thumb.jpg
  byte_size       bigint,
  added_at        timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

-- ---------- kv ----------
-- Mirrors the app's own kv store, minus `goals` (promoted above).
-- Keys in use: 'kitchen', 'review:YYYY-Www', 'profile'.
create table public.kv (
  user_id      uuid        not null default auth.uid()
                           references auth.users(id) on delete cascade,
  key          text        not null,
  value        jsonb       not null,
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  primary key (user_id, key)
);

-- ---------- touch triggers ----------
do $$
declare t text;
begin
  foreach t in array array['days','habits','habit_log','goals','books',
                           'book_sessions','memory_items','photos','kv']
  loop
    execute format(
      'create trigger %I_touch before update on public.%I
         for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

-- ---------- pull-cursor indexes ----------
-- Every sync pull is  "where user_id = $me and updated_at > $cursor".
do $$
declare t text;
begin
  foreach t in array array['days','habits','habit_log','goals','books',
                           'book_sessions','memory_items','photos','kv']
  loop
    execute format(
      'create index %I_sync_idx on public.%I (user_id, updated_at)', t, t);
  end loop;
end $$;

create index days_date_idx   on public.days   (user_id, date desc);
create index photos_date_idx on public.photos (user_id, date desc);
create index memory_added_idx on public.memory_items (user_id, added_at desc);
```

### 2.2 Row Level Security

Four policies per table, `TO authenticated`, `auth.uid()` wrapped in a `select`.

Both details matter and both are current best practice as of 2026-08:

- **`TO authenticated`** makes Postgres stop at the role check for anonymous
  callers instead of evaluating the whole predicate. It doesn't speed up your own
  queries; it stops an anon caller from costing you anything.
- **`(select auth.uid())`** turns the call into an `InitPlan` the optimiser
  caches once per statement instead of re-evaluating per row. On a table with a
  few thousand `habit_log` rows this is the difference between a scan and a
  lookup.

```sql
do $$
declare t text;
begin
  foreach t in array array['days','habits','habit_log','goals','books',
                           'book_sessions','memory_items','photos','kv']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force  row level security', t);

    execute format($p$create policy %I_sel on public.%I for select
                     to authenticated using ((select auth.uid()) = user_id)$p$, t, t);
    execute format($p$create policy %I_ins on public.%I for insert
                     to authenticated with check ((select auth.uid()) = user_id)$p$, t, t);
    execute format($p$create policy %I_upd on public.%I for update
                     to authenticated using      ((select auth.uid()) = user_id)
                                     with check  ((select auth.uid()) = user_id)$p$, t, t);
    execute format($p$create policy %I_del on public.%I for delete
                     to authenticated using ((select auth.uid()) = user_id)$p$, t, t);
  end loop;
end $$;

-- Belt and braces: no anon role reaches these tables at all.
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
```

### 2.3 Verification query — run this after the DDL and read the output

```sql
select c.relname                                    as table,
       c.relrowsecurity                             as rls_on,
       c.relforcerowsecurity                        as rls_forced,
       count(p.polname)                             as policies
from   pg_class c
join   pg_namespace n on n.oid = c.relnamespace
left   join pg_policy p on p.polrelid = c.oid
where  n.nspname = 'public' and c.relkind = 'r'
group  by 1,2,3
order  by 1;
```

Every row must read `true, true, 4`. **A `false` here is a public database.**
Counting is not looking — read the nine rows, don't just check that the query
succeeded.

### 2.4 Storage

One **private** bucket, `workspace`. Paths are prefixed with the owner's uid so a
single folder-name predicate covers everything:

```
<auth.uid()>/photos/<photoId>/original
<auth.uid()>/photos/<photoId>/thumb.jpg
<auth.uid()>/memory/<memoryId>/<filename>
```

```sql
insert into storage.buckets (id, name, public)
values ('workspace', 'workspace', false)
on conflict (id) do nothing;

create policy "workspace read"   on storage.objects for select to authenticated
  using (bucket_id = 'workspace'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "workspace insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'workspace'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "workspace update" on storage.objects for update to authenticated
  using (bucket_id = 'workspace'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "workspace delete" on storage.objects for delete to authenticated
  using (bucket_id = 'workspace'
         and (storage.foldername(name))[1] = (select auth.uid())::text);
```

A private bucket means the app fetches via `createSignedUrl` (or `.download()`),
which carries the JWT. Cache the signed URL for the session; don't mint one per
render.

Free-tier storage is 1 GB. Full-size phone photos will hit that. If it becomes a
problem the honest fix is **stop syncing the original and sync only the thumb** —
the Timeline only ever shows the thumb, and the original exists on the device
that took it.

### 2.5 The security call-out, plainly

**The publishable/anon key is public by definition.** It ships inside the
JavaScript on a static site; anyone can view-source it. It is not a secret and
was never meant to be one. **RLS is the entire security model.** With RLS off,
that key is a read-write handle on his journal, his mood history, his photos and
his AI-generated psychological profile, for anyone who opens DevTools. Hence
§2.3: read the nine rows.

Three more, each specific:

1. **Never ship the secret key** (`sb_secret_…`, formerly `service_role`). It
   bypasses RLS. In a static bundle it is game over. If it ever touches the repo,
   rotate it in the dashboard immediately — deleting the commit is not enough.

2. **`anthropic_api_key` must never sync.** It is a live bearer credential the
   app already sends straight from the browser to `api.anthropic.com` with
   `anthropic-dangerous-direct-browser-access: true`. Putting it in a Postgres
   row converts one RLS misconfiguration into an Anthropic bill. Keep it in the
   local `settings` store, per device, forever. `local_ai` and `notify_*` are
   device *capabilities*, not preferences — they don't sync either. The only
   syncable settings are `profile_name` and `protein_target`, and they go in
   `kv` under `profile`.
   Worth a gate: assert no outbox payload ever contains a string matching
   `sk-ant-`.

3. **Turn off new signups once his user exists.** Otherwise anyone with the
   publishable key can `signUp` and get an `authenticated` role. RLS still keeps
   them out of his rows, so it isn't a breach — but it is free storage on his
   project and an abuse surface with no upside. One toggle. §6, step 8.

---

## 3. Auth: email OTP code. Not a magic link, not OAuth.

**Recommendation: passwordless email with a 6-digit code** —
`signInWithOtp({ email, options: { shouldCreateUser: false } })`, then
`verifyOtp({ email, token, type: 'email' })`.

### Why not a magic link

1. **The PWA kills it.** `manifest.webmanifest` declares `display: standalone`
   and `start_url: /workspace/`. When the app is installed, a magic link tapped
   in Mail opens the *system browser*, not the installed PWA. The session lands
   in the browser's storage, the PWA stays signed out, and the failure is
   confusing rather than obvious. This alone decides it.
2. **It signs in the wrong device.** For a tool whose entire purpose is
   cross-device sync, "open mail on phone → laptop is still signed out" is the
   exact wrong ergonomic. A code you *type* signs in whichever device you're
   holding.
3. **Link prefetchers eat it.** Corporate scanners (Microsoft Safe Links and
   friends) fetch URLs in incoming mail, which consumes the single-use token
   before he clicks. The user-visible symptom is `otp_expired` on a link he just
   received. Supabase's own troubleshooting docs name this and recommend a
   code-entry page as the fix.
4. **It needs a redirect allowlist and fragment parsing.** The site is served
   from a subdirectory; the exact `https://<host>/workspace/` has to be added to
   Redirect URLs, `detectSessionInUrl` has to strip the fragment, and any path
   drift breaks sign-in silently. OTP needs none of that: no callback, no
   redirect URL, no fragment. That directly satisfies the "no server callback"
   constraint.

### Why not OAuth (Google / GitHub)

A Google Cloud project, an OAuth consent screen, a verified domain and an exact
redirect URI — more dashboard work than everything else in this plan combined,
and it *still* has problems 1 and 2 above, because it's still a redirect flow.
For one user with one email address it buys nothing.

### Why not a password

It would work. But it's a credential to store and rotate for a benefit of roughly
zero — he signs in about twice per device, ever.

### Session longevity

`@supabase/supabase-js` persists the session in `localStorage` and refreshes the
access token automatically in the background. **Refresh tokens do not expire**
(they're single-use and rotate). Practical effect: sign in once per device and
stay signed in indefinitely, as long as the app is opened often enough that a
rotation isn't missed — which it will be, it's a daily-use app.

Leave JWT expiry at the default 3600s. Raising it buys nothing and widens the
window on a leaked token.

### The one project-specific trap

**`/workspace/` is the same origin as the portfolio.** `index.html` links
`/workspace/assets/…` from the site root, and `start_url` is `/workspace/`. So
supabase-js will write its session (`sb-<projectref>-auth-token`) into the *same
`localStorage` that holds `hmCompanions` — the ~890 KB of irreplaceable baked
heads.**

That is not corruption risk, but it is a real footgun:

- Give the client an explicit `storageKey` (e.g. `'jb-workspace-auth'`) so the
  entry is obviously yours and obviously not a head.
- **Never `localStorage.clear()` to "reset auth".** Use `supabase.auth.signOut()`.
  A wholesale clear destroys `hmCompanions`, unrecoverably.
- Before any sign-in/sign-out testing on his real browser, snapshot
  `hmCompanions` and `hmCompanion` and restore after.

```js
createClient(URL, PUBLISHABLE_KEY, {
  auth: {
    storageKey: 'jb-workspace-auth',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,   // no redirect flow; nothing to detect
    flowType: 'implicit'
  }
})
```

---

## 4. Local-first behaviour

**Non-negotiable, and it's already how the app is built: every read and every
write goes to IndexedDB first, always. Supabase is a background replicator that
is never in the render path.** If the key is absent, the network is down, or he's
signed out, the app is byte-for-byte the app he has today.

The existing architecture makes this easy. All UI reads go through the IDB
helpers and re-render off the `Ep()/Dp()` subscription bus. The sync layer hooks
that bus; it does not replace a single call site.

### 4.1 The outbox

New IndexedDB store (this is the `lifeline` **v3** upgrade — one added store,
nothing migrated):

```js
outbox  keyPath: 'seq', autoIncrement: true
{ seq, table, op: 'put' | 'del', pk, payload, at }
```

Every mutating helper (`jp` days, `Rp` habits, `Vp` habitLog, `Hp`/`Up` memory,
`Kp`/`qp` books, `Mp`/`Np`/`Pp` photos, `Yp` kv) enqueues **after** its local put
succeeds. The local write is never conditional on the enqueue.

Drain on: sign-in, `window.online`, `visibilitychange → visible`, and a 60 s
timer. Every push is an `upsert` on the primary key, so replaying the outbox is
idempotent and a crashed drain is harmless.

Deletes enqueue `op:'del'`, which the pusher turns into an
`update … set deleted_at = now()` — never a real `DELETE`. Locally the record is
removed as it is today.

### 4.2 The cursor and the order

Store `sync_cursor` in the local `settings` store: the max server `updated_at`
seen.

**Push, then pull, in that order.** Push first so your own writes come back
already stamped and the cursor moves past them; pull first and you spend a round
trip re-downloading what you're about to overwrite.

Pull is nine queries, one per table:

```sql
select * from <t> where updated_at > :cursor order by updated_at
```

(`user_id` is implicit — RLS adds it.) Soft-deleted rows come back too; that's
how a delete on device A reaches device B. Apply `deleted_at is not null` as a
local delete.

Advance the cursor only after the whole batch has been applied locally.

### 4.3 Reconciliation: last-write-wins, with one exception

**LWW by `updated_at`, per row.** Not per field. Reasons: one user, effectively
one device at a time; and field-level merge on a free-text journal produces
garbage rather than safety.

Note from §1.1: **only `days` carries a local `updatedAt` today.** Everything
else has `addedAt` or nothing. So the client must stamp a local `updatedAt` on
every record it writes as part of this work — otherwise "last write" is
unknowable and you're guessing.

**The exception — `days.journal`.** It's the only irreplaceable free text in the
app, and losing an evening of journalling to a clock skew is the one outcome
that would make sync a net negative. So:

> If both the local and remote copy of a day changed since the last successful
> sync **and** the `journal` fields differ, do not overwrite. Take the winner by
> `updated_at`, then append the loser's text beneath a rule:
> `\n\n--- also written elsewhere ---\n<loser text>`.
> Every other field is plain LWW.

Ten lines of code. Never loses a sentence, and the outcome is visible in the
journal itself, so it needs no toast, no badge, no conflict UI.

Everything else is genuinely safe under LWW: `memory_items` are append-only,
`habit_log` is a boolean toggle, `photos` are immutable except `caption`,
`book_sessions` are keyed by `(book, date)` so two devices touching the same
session is the only collision and it's rare enough to accept.

### 4.4 What the UI shows — and mostly, what it doesn't

Premium is subtraction. There are three states and they all live in Settings.
**Nothing about sync appears anywhere else in the app, ever.**

| state | Settings → Cloud sync | rest of app |
|---|---|---|
| no URL/key compiled in | today's copy: *"Not set up yet…"* | unchanged |
| configured, signed out | email field + **Send code** → code field + **Sign in** | unchanged |
| signed in, idle | one line: `Synced · 2 min ago` | unchanged |
| signed in, offline / queued | one line: `3 changes waiting` | unchanged |
| push failed | one line, `text-destructive`, with the error | unchanged |

Hard rules:

- **Never block a write.** No spinner on a tab, no disabled control, no "saving…"
  anywhere. If the network is gone the app behaves exactly as it does today.
- **No global banner, no header badge, no coloured dot in the nav.** The status
  line in Settings is the whole surface.
- Hairlines and translucency only. **No shadow on any of it** — site rule: the
  companion heads cast contact shadows, chrome does not.
- Reuse the existing `tech-label` / `pill-btn` / `section` patterns already in
  the Settings modal. Don't invent a control.

### 4.5 What deliberately isn't built

- **No Realtime subscription.** It's a websocket held open for one user who is
  never on two devices at the same second. Pull-on-focus is enough and costs
  nothing when the app is closed.
- **No conflict UI.** §4.3 makes it unnecessary.
- **No "sync now" button** beyond the status line being tappable. Focus, online
  and a 60 s timer already cover it.

---

## 5. Migration

The principle: **migration is a push of the live IndexedDB, not an import of a
JSON file.** Back-filling through the exact same outbox → push code path that
normal operation uses means that if the backfill works, sync works — you've
tested the real thing rather than a parallel importer that will rot.

### Step 1 — Export first. Twice. Before anything else.

1. Open the workspace on the device with the real data.
2. Settings → **Export all data** → save `lifeline-backup-<date>.json`
   somewhere outside the repo.
3. **Write down `profile_name` and `protein_target` by hand** — §1.2, the export
   silently omits the whole `settings` store.
4. Second, independent snapshot in case the export path itself misbehaves on his
   data. In DevTools on `/workspace/`, dump every store to a file. Read-only; it
   touches IndexedDB, not `localStorage`, so `hmCompanions` is not involved.

Do not proceed until both files exist and open.

### Step 2 — Dry run, and then *look*

Run the backfill with `--dry-run`: it walks every store, builds every row and
every storage path it *would* write, and prints a table — rows per table, bytes
per bucket path, and any record it had to skip or coerce.

Compare that table against the array lengths in the export JSON:

```bash
python3 - <<'PY'
import json; d=json.load(open('lifeline-backup-<date>.json'))
for k in ('days','habits','habitLog','books','kv','photos','memory'):
    print(f'{k:10} {len(d.get(k,[]))}')
PY
```

The counts must match. A mismatch is a shape bug, and a shape bug is exactly the
thing that makes a migration lossy.

### Step 3 — Backfill for real, then look again

1. Sign in on the device that holds the real data.
2. Run the backfill. It enqueues one outbox entry per record and lets the normal
   drain do the work.
3. **Blobs before rows.** Upload to Storage first, then insert the row with the
   returned path. If an upload fails, skip the row — a row pointing at nothing is
   worse than a missing row, because the next pull will hand device 2 a broken
   photo it can never resolve.
4. Re-run the `--dry-run` counter against the server. Then **open the Timeline
   and look at it.** Counting is not looking: a green count with a `date`
   off-by-one timezone bug looks identical in a count and obvious on screen.

### Step 4 — Second device is a pull, never an import

Open the app on device 2, sign in, let it pull. **Do not import the JSON there.**
Importing on both sides creates two independent copies of every uuid-keyed
record and you'd never untangle it.

Then compare: same day count, same photo count, same books, same goals. And
look at a week of the Timeline side by side.

### Step 5 — Rollback, which is free

The app never stopped reading from IndexedDB, so there is nothing to roll back
*to* — the local data was never the thing being mutated. If sync goes wrong:
remove the Supabase URL/key, rebuild, and he is exactly where he started.
Keep `lifeline-backup-<date>.json` permanently.

### Ordering constraint

`habit_log` FKs `habits`, `book_sessions` FKs `books`. Push in this order:

`habits → goals → books → days → habit_log → book_sessions → memory_items → photos → kv`

---

## 6. Setup runbook

**🔑 = only Jayden can do this** (it involves an account, a dashboard, or a
credential). An agent must not create the account, must not ask for the keys, and
must not run anything in the dashboard.
**🤖 = an agent can write/script this** — but note steps 9–11 change the *source*
repo, which is not in this tree (§0.1).

---

**0. 🤖 Find the source repo.** If `supabase/schema.sql` and `.env.example`
exist there, use them and treat §2 as a review checklist. If they don't, use §2.
Everything below assumes you know which.

**1. 🔑 Create the Supabase project.** supabase.com → new project. Region **West
US (Oregon or N. California)** — he's in the Bay Area and this is a latency
decision, not a preference. Save the database password in a password manager; it
is not used by this app but it is not recoverable.

**2. 🔑 Get the URL and the publishable key.** Project Settings → **API Keys**.
Copy:
- Project URL — `https://<ref>.supabase.co`
- **Publishable key** — `sb_publishable_…`

> Use the **publishable** key, not the legacy `anon` JWT. As of 2026 Supabase has
> moved to prefixed, non-JWT publishable/secret keys; the legacy `anon` and
> `service_role` keys are slated for deprecation by the end of 2026. They carry
> identical privileges and RLS behaves the same, but publishable keys are
> independently rotatable and instantly revocable. Both work today, so if the
> existing `.env.example` names `VITE_SUPABASE_ANON_KEY`, that's fine — just put
> the publishable key in it.
>
> **Never copy the secret key.** It bypasses RLS.

**3. 🤖 → 🔑 Run the DDL.** An agent writes `supabase/schema.sql` (§2.1 + §2.2).
He pastes it into SQL Editor → Run.

**4. 🔑 Run the verification query (§2.3) and read the nine rows.** All must be
`true, true, 4`. This is the step that decides whether his journal is public.

**5. 🔑 Create the Storage bucket and its policies.** SQL Editor → §2.4. Confirm
in Storage that `workspace` shows as **Private**.

**6. 🔑 Create his one user, with no email flow at all.** Authentication → Users
→ **Add user** → email + password + **Auto Confirm**. This sidesteps the signup
confirmation flow entirely and gives him a confirmed user in one click.

**7. 🔑 Switch the email template to a code.** Authentication → Emails →
Templates → **Magic Link**. Replace the `{{ .ConfirmationURL }}` link with
`{{ .Token }}`.

> **This is the step that gets missed.** Supabase's "OTP" and "magic link" share
> one implementation and one template; without this edit,
> `signInWithOtp` sends a *link*, `verifyOtp` has nothing to verify, and §3's
> whole rationale quietly evaporates. Send yourself one code and confirm the mail
> contains six digits before moving on.

**8. 🔑 Turn off new signups.** Authentication → Sign In / Providers → Email →
disable **Allow new users to sign up**. Do this *after* step 6. See §2.5.3.

**9. 🔑 Put the keys somewhere.** Two options — I recommend B.

- **A. Build-time (what the current bundle expects).** `.env` in the source repo
  with `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (match `.env.example`
  exactly), `npm run build`, copy `dist/` over `workspace/`. Add `.env` to
  `.gitignore`.
- **B. 🤖 Deploy-time, recommended.** Change the source to read
  `window.__SUPABASE__ ?? import.meta.env`, then put a plain non-module script in
  `workspace/index.html`:

  ```html
  <script>window.__SUPABASE__={url:"https://<ref>.supabase.co",key:"sb_publishable_…"};</script>
  ```

  Why B: it makes the key a value in a static HTML file rather than something
  baked into a hashed bundle, which matches how the rest of this site works — no
  build step — and lets him rotate the key by editing one line instead of
  rebuilding. It is exactly as safe: the key is public either way. Note the site
  rule that cache-busting a page URL does not bust its external JS — a rotated
  key in `index.html` takes effect immediately, but a rebuilt bundle needs its
  filename hash to change.

**10. 🤖 Write the sync layer** — `lifeline` v3 outbox store, push/pull with
cursor, LWW + the journal-append exception, the three Settings states. Plus the
backfill script with `--dry-run`.

**11. 🤖 Write the gates.** Following the project's rule that a gate must be able
to fail, each needs a `--self-test` that re-injects the bug:
- every table in `schema.sql` has `enable row level security` **and** four
  policies (inject: delete one `enable` line)
- no `grant` to `anon` anywhere (inject: add one)
- no outbox payload ever contains `sk-ant-` (inject: enqueue the settings store)
- the app renders and writes with the Supabase globals absent (inject: make a
  read `await` the client)

**12. 🔑 Migrate.** §5, in order. Export first.

**13. 🔑 Second device.** Sign in, pull, look.

---

## What an agent must not do

Create the account or project · request, receive, store, echo or commit any key ·
run anything in the dashboard · drive his real browser for any of this
(`hmCompanions` lives in the same origin's `localStorage` — §3) · put the secret
key anywhere · sync `anthropic_api_key`.

---

## Sources (all checked 2026-08-20 — this area moves)

- [Supabase Docs — RLS performance and best practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — `(select auth.uid())` initPlan caching, `TO authenticated`, indexing `user_id`
- [Supabase Docs — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Docs — Migrating to publishable and secret API keys](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys) — **date-sensitive: legacy `anon`/`service_role` deprecation targeted for end of 2026**
- [Supabase Docs — Understanding API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Supabase Docs — Passwordless email logins](https://supabase.com/docs/guides/auth/auth-email-passwordless) — OTP and magic link share a template; `{{ .Token }}` is the switch
- [Supabase Docs — OTP verification failures / `otp_expired`](https://supabase.com/docs/guides/troubleshooting/otp-verification-failures-token-has-expired-or-otp_expired-errors-5ee4d0) — link prefetch scanners
- [Supabase Docs — User sessions](https://supabase.com/docs/guides/auth/sessions) — localStorage persistence, non-expiring rotating refresh tokens, 3600s default JWT expiry
- [Supabase Docs — Storage access control](https://supabase.com/docs/guides/storage/security/access-control) and [Storage helper functions](https://supabase.com/docs/guides/storage/schema/helper-functions) — `storage.foldername(name)[1]`
- [Supabase Docs — Storage buckets fundamentals](https://supabase.com/docs/guides/storage/buckets/fundamentals) — private by default
