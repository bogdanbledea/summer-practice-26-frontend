# Summer practice — backend

Node + Express on top of the Supabase **Data API** (PostgREST over HTTPS).
This copy is yours: your own Supabase project, your own data, running on your
own machine — nobody else's team touches it and it touches nobody else's.

Right now it does two things: **accounts**, and one small API per team — tasks,
expenses, a message board, a reading list, a leaderboard and an event sign-up
sheet. The backend is finished; the practice is building the frontend against
it. You do not write any of the code in this folder — you stand it up, once,
and then leave it alone.

You identify yourself with `Authorization: Bearer <accessToken>`.

Why the Data API and not a Postgres connection: the office network blocks
outbound 5432/6543, so `pg` cannot reach Supabase from here. Everything in this
repo talks to Supabase over port 443 instead, which works from anywhere.

## Endpoints

`/api/health` and `/api/auth/*` are open. Everything else needs the header.

| Method & path             | Body                     | Returns                      |
| ------------------------- | ------------------------ | ---------------------------- |
| `GET /api/health`         | —                        | `200 { ok: true }`           |
| `POST /api/auth/register` | `{ username, password }` | `201` a session              |
| `POST /api/auth/login`    | `{ username, password }` | `200` a session              |
| `POST /api/auth/refresh`  | `{ refreshToken }`       | `200` a new session          |
| `POST /api/auth/logout`   | `{ refreshToken }`       | `204` no body                |
| `GET /api/me`             | —                        | `200 { id, name, username }` |
| `GET /api/users?q=`       | —                        | `200 { items }` — the picker |

Then one resource per team, described in [Team APIs](#team-apis) below:

| Team | Owns          | Route           |
| ---- | ------------- | --------------- |
| 1    | tasks         | `/api/tasks`    |
| 2    | expenses      | `/api/expenses` |
| 3    | message board | `/api/messages` |
| 4    | reading list  | `/api/links`    |
| 5    | leaderboard   | `/api/scores`   |
| 6    | event sign-up | `/api/events`   |

Lists come back wrapped, newest first, with the total ignoring pagination:

```json
{
  "items": [
    /* … */
  ],
  "total": 42
}
```

Optional `?start=0&limit=20` — `start` is 0-based, `limit` is 1–100 and
defaults to 20 when either parameter is present. Omit both to get everything.
A `start` past the end is an empty `items`, not an error.

Errors come back as `{ "error": "…" }` with status `400`, `401`, `403`, `404`,
`409` or `500`. Auth errors carry a `code` as well, so the frontend can branch
on the cause instead of on the wording:

```json
{ "error": "Your access token has expired.", "code": "token_expired" }
```

| `code`                | Meaning                                             |
| --------------------- | --------------------------------------------------- |
| `missing_token`       | No `Authorization` header                           |
| `invalid_token`       | Signature does not check out                        |
| `token_expired`       | **Refresh and retry the request** — this is the one |
| `invalid_credentials` | Wrong username or password                          |
| `username_taken`      | That username is already registered                 |
| `missing_refresh`     | No `refreshToken` in the body                       |
| `invalid_refresh`     | Unknown refresh token                               |
| `refresh_expired`     | Refresh token is past its lifetime — log in again   |
| `refresh_reused`      | Replay detected, the whole login was killed         |

## Auth

### Registering

Registration is open — each team makes its own account, no admin involved.

```bash
curl -X POST "$BASE/auth/register" -H "Content-type: application/json" \
  -d '{"username":"team-alpha","password":"practice2026"}'
```

Usernames are 3–32 characters of `a–z`, `0–9`, `-` and `_`, stored lowercase, so
`TeamAlpha` and `teamalpha` are the same account. Passwords are at least 8
characters, hashed with scrypt. Registering logs you straight in, so the
response is a full session — same shape as login:

```json
{
  "user": { "id": 12, "name": "team-alpha", "username": "team-alpha" },
  "accessToken": "eyJhbGciOiJIUzI1NiJ9…",
  "refreshToken": "rt_9f2c…",
  "expiresIn": 900,
  "tokenType": "Bearer"
}
```

`expiresIn` is seconds until `accessToken` dies.

### The two tokens

The **access token** is a JWT. The server verifies it with a signature and no
database call at all, which is what makes it cheap enough to send on every
request — and also why it cannot be cancelled. Its short lifetime is the only
thing limiting the damage if it leaks.

The **refresh token** is opaque random bytes, stored hashed in
`refresh_tokens`. Every use is a database lookup, so it _can_ be cancelled —
and it is only sent to one endpoint, once in a while.

That is the whole reason there are two: you want no database hit per request
_and_ the ability to log someone out, and no single token gives you both.

### Rotation and replay

Every refresh burns the old token and issues a new one. All the tokens from one
login share a `family_id`. Presenting a token that was already used means a copy
exists, so the entire family is revoked — thief and victim both get logged out,
which is the point.

Two of your own requests refreshing at the same time look exactly like a replay,
and will end the session. That is not a bug to work around; it is why the
frontend must run **one** refresh at a time and make every other request wait on
the same promise.

### Watching it happen

Set `ACCESS_TOKEN_TTL=60` and the whole cycle plays out on screen in the network
tab, roughly once a minute: a `401 token_expired`, one `POST /auth/refresh`, and
the original request replayed with the new token.

## Team APIs

Every write is checked against the account the token belongs to. `GET`s are
scoped to you as well, except the message board, which is the whole point of it.

### The picker · `GET /api/users?q=an`

Shared by anyone who needs to name another account. Matches on username or
display name, case-insensitive, at most 20 results. Omit `q` for the first 20
alphabetically.

```json
{ "items": [{ "username": "team-beta", "name": "Team Beta" }] }
```

No ids and no timestamps: a picker needs a label to show and a username to send
back, and nothing else is anyone's business.

### Team 1 — tasks · `/api/tasks`

A task belongs to whoever created it and can be **assigned to another
account**, which makes it the one resource two people can see.

| Method & path           | Body                                          | Returns                |
| ----------------------- | --------------------------------------------- | ---------------------- |
| `GET /api/tasks`        | —                                             | `200 { items, total }` |
| `POST /api/tasks`       | `{ title, dueDate?, assignee? }`              | `201` the task         |
| `PATCH /api/tasks/:id`  | any of `title`, `done`, `dueDate`, `assignee` | `200` the task         |
| `DELETE /api/tasks/:id` | —                                             | `204` no body          |

```json
{
  "id": 4,
  "title": "write the readme",
  "done": false,
  "dueDate": "2026-08-20",
  "owner": { "username": "team-alpha", "name": "team-alpha" },
  "assignee": { "username": "team-beta", "name": "Team Beta" },
  "mine": true,
  "assignedToMe": false,
  "createdAt": "2026-08-13T07:41:00.000Z"
}
```

`assignee` is a **username**, because an id is not something a person can type —
that is what `GET /api/users?q=` is for. Send `null` to unassign. An unknown
username is a `404`, not a silently dropped field. `dueDate` is `YYYY-MM-DD` or
`null`; a date with a time in it would fall on different days in different time
zones.

`GET` takes `?done=true|false` and `?scope=`:

| `scope`    | You get                                      |
| ---------- | -------------------------------------------- |
| `all`      | yours and the ones handed to you _(default)_ |
| `mine`     | only tasks you created                       |
| `assigned` | only tasks someone gave you                  |

**Who may do what** is the interesting part, and the server decides:

| Action                         | Owner | Assignee        |
| ------------------------------ | ----- | --------------- |
| see it                         | yes   | yes             |
| `done`                         | yes   | yes             |
| `title`, `dueDate`, `assignee` | yes   | `403 not_owner` |
| delete                         | yes   | `404`           |

The person a task was handed to can tick it off; rewriting it or passing it on
belongs to whoever created it. A task you cannot see at all answers `404` rather
than `403` — a `403` would confirm the id exists.

### Team 2 — expenses · `/api/expenses`

Private to you. Deliberately no `/summary` endpoint: the frontend groups.

| Method & path              | Body                                         | Returns                |
| -------------------------- | -------------------------------------------- | ---------------------- |
| `GET /api/expenses`        | —                                            | `200 { items, total }` |
| `POST /api/expenses`       | `{ title, amount, category, date? }`         | `201` the expense      |
| `PATCH /api/expenses/:id`  | any of `title`, `amount`, `category`, `date` | `200` the expense      |
| `DELETE /api/expenses/:id` | —                                            | `204` no body          |

```json
{
  "id": 7,
  "title": "coffee and a sandwich",
  "amount": 32.5,
  "category": "food",
  "date": "2026-08-13",
  "createdAt": "2026-08-13T09:12:00.000Z"
}
```

`category` is one of `food`, `transport`, `books`, `gear`, `fun`, `other` —
anything else is a `400`. That closed list is what makes grouping in the
frontend possible at all: free text gives you `Food`, `food` and `Foood` as
three different groups. `amount` must be above 0, is rounded to two decimals,
and is stored as `numeric` rather than a float, because `0.1 + 0.2` is not `0.3`
in binary floating point and money is where that shows up. `date` defaults to
today. `GET` takes an optional `?category=food`.

Newest first by `date`, so grouping by category keeps a sensible order inside
each group.

### Team 3 — message board · `/api/messages`

One board, everybody's messages. **Everyone reads everything, you write only
your own.**

| Method & path              | Body       | Returns                |
| -------------------------- | ---------- | ---------------------- |
| `GET /api/messages`        | —          | `200 { items, total }` |
| `POST /api/messages`       | `{ text }` | `201` the message      |
| `PATCH /api/messages/:id`  | `{ text }` | `200` the message      |
| `DELETE /api/messages/:id` | —          | `204` no body          |

```json
{
  "id": 8,
  "text": "the timer works",
  "author": { "username": "team-beta", "name": "Team Beta" },
  "mine": false,
  "createdAt": "2026-08-13T09:12:00.000Z"
}
```

`text` is up to 500 characters. `mine` tells the frontend which side to draw the
bubble on and which cards get edit and delete buttons — but the server checks
`author_id` on every write regardless. **Hiding a button is not a permission
check**; editing someone else's message answers `404`, whatever the UI shows.
That is the one idea in this API worth stopping the room for.

### Team 4 — reading list · `/api/links`

Private to you, like expenses — nobody else's reading list is any of your
business.

| Method & path           | Body                       | Returns                |
| ------------------------ | -------------------------- | ---------------------- |
| `GET /api/links`        | —                          | `200 { items, total }` |
| `POST /api/links`       | `{ title, url, tag? }`     | `201` the link         |
| `PATCH /api/links/:id`  | any of `title`, `url`, `tag` | `200` the link        |
| `DELETE /api/links/:id` | —                          | `204` no body          |

```json
{
  "id": 5,
  "title": "the turnip vote incident",
  "url": "https://example.com/turnip",
  "tag": "css",
  "createdAt": "2026-08-13T09:12:00.000Z"
}
```

`url` must start with `http://` or `https://` — that is the only shape check;
this is not a full URL parser. `tag` is free text, optional, `null` to clear
it. There is no search query here on purpose, unlike `/api/users?q=`: the list
is small enough that filtering it is the frontend's job, against data it
already has, not another round trip.

### Team 5 — leaderboard · `/api/scores`

Shared like the message board — everyone reads every score — but there is no
`PATCH`. A wrong score gets deleted and resubmitted; it does not get edited
into a different one.

| Method & path            | Body                | Returns                |
| ------------------------- | ------------------- | ---------------------- |
| `GET /api/scores`        | —                   | `200 { items, total }` |
| `POST /api/scores`       | `{ game, score }`   | `201` the score        |
| `DELETE /api/scores/:id` | —                   | `204` no body          |

```json
{
  "id": 12,
  "game": "typing-race",
  "score": 87,
  "player": { "username": "team-beta", "name": "Team Beta" },
  "mine": false,
  "createdAt": "2026-08-13T09:12:00.000Z"
}
```

`score` is a non-negative whole number. The server always answers newest
first — it never sorts by score. Ranking the board, by score or by anything
else, is the frontend's job over data it already has.

### Team 6 — event sign-up · `/api/events`

Shared like the message board: any account can open a slot, and everyone sees
every slot. Joining and leaving are their own sub-routes, separate from
editing the event itself, because they are a different kind of write — one
any account may make on someone else's row, within a limit the server counts.

| Method & path                   | Body                  | Returns                                     |
| -------------------------------- | --------------------- | -------------------------------------------- |
| `GET /api/events`               | —                     | `200 { items }`                              |
| `POST /api/events`              | `{ title, capacity }` | `201` the event                              |
| `DELETE /api/events/:id`        | —                     | `204` no body — owner only                   |
| `POST /api/events/:id/join`     | —                     | `201` the event, or `409` `full`/`already_joined` |
| `DELETE /api/events/:id/join`   | —                     | `204` no body                                |

```json
{
  "id": 3,
  "title": "friday retro drinks",
  "capacity": 5,
  "taken": 5,
  "full": true,
  "joined": true,
  "owner": { "username": "team-alpha", "name": "team-alpha" },
  "mine": true,
  "createdAt": "2026-08-13T09:12:00.000Z"
}
```

`taken`, `full` and `joined` are all computed on the way out — nothing is
denormalized on the row, so they can never drift out of sync with the actual
seats taken. Deleting the event is the owner's call and takes every signup in
it down too; leaving is anyone's own call about their own seat.

**The interesting part is `POST /:id/join`.** The server counts existing
signups and compares them to `capacity` right before inserting — not a lock,
just a check, so two people hitting join on the last seat at the same instant
can both pass the check and both insert. A `unique (slot_id, user_id)`
constraint stops the same person twice, but two *different* people can, in
principle, both land in an eight-seat room's ninth seat. This backend is fine
with that for a week of practice; a real one would make the check and the
insert one atomic operation. Either way, `409 full` is a real answer you can
get back from a join that looked fine a second ago — which is exactly the
case worth handling: show the seat as taken optimistically, then undo it if
the server disagrees.

## How a router works, if you want to read one

They are all the same four handlers. Open
[src/routes/expenses.ts](src/routes/expenses.ts) — it is the simplest one.

| Import                                          | What it is                                               |
| ----------------------------------------------- | -------------------------------------------------------- |
| `requireAuth` from `./auth.js`                  | Fills `req.user`, or throws `401`. Sits on the router    |
| `asyncHandler` from `./asyncHandler.js`         | Forwards a rejected promise to the error handler         |
| `db`, `orThrow` from `./db.js`                  | Supabase client; `orThrow` turns a failed query into 500 |
| `parseText`, `parseId`, … from `./http.js`      | Validation that throws the right `400`                   |
| `badRequest`, `forbidden`, … from `./errors.js` | Throw one, the error handler answers with it             |

**Every query is scoped to `req.user.id`.** That `where` clause is the only
thing standing between team 1's rows and team 2's. It is not a detail.

## 1. Supabase

Free tier is plenty for this. One project per team — do not share one between
teams, or you will be reading each other's tasks.

1. [supabase.com](https://supabase.com) → **New project**. Pick any region,
   set a database password (you won't need it again — this backend never
   connects to the database directly, see below), and wait for it to finish
   provisioning, about two minutes.
2. **SQL Editor → New query**, paste in [sql/schema.sql](sql/schema.sql) whole,
   and run it. One file, one paste, one click — it creates `users`,
   `refresh_tokens`, `tasks`, `expenses`, `messages`, `links`, `scores`,
   `event_slots` and `signups`, and turns RLS on for all of them. It is safe
   to run twice, so re-running it when you're not sure it went through the
   first time is always the right move, never a risk.
3. **Project Settings → API**: copy the **Project URL** and the **service_role**
   key (under Project API keys, hidden behind "Reveal").

The service_role key bypasses RLS. It lives on your `.env` only — never in the
frontend, never in a commit. `.env` is already in [.gitignore](.gitignore); do
not go looking for a reason to move it out.

## 2. Local run

```bash
cd backend
npm install
cp .env.example .env      # then fill in the three values below
npm run dev
curl localhost:3000/api/health   # -> {"ok":true}
```

Three things go in `.env`, all from the Supabase step above and one you
generate yourself:

| Variable                    | Where it comes from                                             |
| ---------------------------- | ---------------------------------------------------------------- |
| `SUPABASE_URL`               | Project Settings → API → Project URL                             |
| `SUPABASE_SERVICE_ROLE_KEY`  | Project Settings → API → service_role key ("Reveal")             |
| `JWT_SECRET`                 | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

Everything else in `.env.example` already has a sane default for local work —
leave it alone unless you know why you're changing it.

The server refuses to start without `JWT_SECRET`. That is deliberate: a default
baked into a repo everyone can read is not a secret. If `npm run dev` exits
immediately with `Missing environment variable ...`, that is the check firing —
read the message, it names the exact variable.

Once `curl localhost:3000/api/health` answers `{"ok":true}`, the backend is
done. Point the frontend's `.env.local` at `http://localhost:3000/api` (see
the frontend's own README, one folder up) and build against it.

## 3. Railway — optional, only if you want a URL that outlives your laptop

Skip this section entirely for the practice itself: `npm run dev` on
`localhost:3000` is all the frontend needs, and it only needs to run while you
are working. Deploy only if you want to keep working from a second machine, or
show the app to someone without your laptop open.

1. Push the repo this file lives in to GitHub — the whole frontend repo, not
   just this folder — then **New Project → Deploy from GitHub repo**.
2. **Settings → Root Directory** → set it to `backend`. This folder is a
   subdirectory of a bigger repo, not a repo of its own, and Railway needs to
   be told that before it goes looking for a `package.json` in the wrong place.
3. Variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`,
   `ACCESS_TOKEN_TTL`, `CORS_ORIGIN=*`. Do **not** set `PORT` — Railway injects
   it. Changing `JWT_SECRET` logs everybody out at once.
4. **Settings → Networking → Generate Domain**. Your base URL becomes
   `https://<your-app>.up.railway.app/api` — that's what goes in the
   frontend's `VITE_API_URL` instead of `localhost:3000/api`.
5. Build and start commands come from `railway.json`; the health check hits
   `/api/health`.

## 4. Smoke test

```bash
npm run smoke:auth        # register, login, refresh, rotation, replay, logout
npm run smoke:features    # tasks, expenses, messages, and who may touch what
```

Both need the server running and both clean up the accounts they create. Pass a
base URL to point them at Railway instead:

```bash
npm run smoke:features -- https://<your-app>.up.railway.app/api
```
