# Summer Practice — frontend

React + TypeScript + Vite, with [Radix Themes](https://www.radix-ui.com/themes)
for components and Tailwind for spacing and layout.

One app, three tabs. Each tab belongs to one team and is built independently.
The backend is already written and deployed — nobody has to touch it. The whole
practice is on this side: fetch, render, handle the states in between.

| Tab           | Team | Builds against  |
| ------------- | ---- | --------------- |
| Tasks         | 1    | `/api/tasks`    |
| Expenses      | 2    | `/api/expenses` |
| Message board | 3    | `/api/messages` |

## Run it

```bash
npm install
echo "VITE_API_URL=http://localhost:3000/api" > .env.local
npm run dev
```

Then open http://localhost:5173. You should see three tabs, each holding a
placeholder line. That is the starting point — everything else is ours to build.

`.env.local` is git-ignored, so your settings never end up in a commit. That
also means nobody else gets your copy: if you add a variable, say so, or the
next person to clone has a broken app and no way to know why.

Vite only exposes variables that start with `VITE_`, and it does it by pasting
the value into the built JavaScript. Anything in there is public the moment the
app is deployed. Fine for this week's practice data; never for a real secret.

## Layout

```
src/
  App.tsx                  the page and the three tabs
  main.tsx                 where React starts
  features/
    team1/Team1Tab.tsx     team 1 — tasks
    team2/Team2Tab.tsx     team 2 — expenses
    team3/Team3Tab.tsx     team 3 — message board
```

**Your folder is yours.** Put every component, hook and context your tab needs
inside it. Two teams editing the same file is the one thing that turns a merge
into an afternoon, and the folders exist so that it cannot happen.

Shared files — `App.tsx`, `main.tsx`, and anything we build together tomorrow
morning — belong to everyone. If your tab needs a change in one of them, ask
first rather than editing it.

Each tab gets its own context. That means each tab loads its own data, and a
change made in one tab is not visible in another until you switch to it and it
loads again. That is the trade we are making on purpose: complete independence
between teams, at the cost of some duplicated fetching.

Radix only renders the tab you are looking at. The other two are unmounted, so
their state is gone and their effects run again the next time you open them.
Expect that, and do not fight it.

## Working together

- One branch per piece of work: `feat/team-2-search`, `fix/team-1-empty-state`.
- Small commits with a message that says what changed and why.
- Open a pull request and have someone from **another team** read it before it
  is merged. Reading code you did not write is most of the job.
- Never commit `.env.local`, `node_modules`, or `dist`.

```bash
git checkout -b feat/team-1-empty-state
# ...work...
git add -A
git commit -m "team 1: show a message when the list is empty"
git push -u origin feat/team-1-empty-state
```

## The API

Base URL is in `.env.local` as `VITE_API_URL`. Every request outside `/auth/*`
needs an `Authorization: Bearer <accessToken>` header.

| Method & path         | Body                     | Returns                      |
| --------------------- | ------------------------ | ---------------------------- |
| `POST /auth/register` | `{ username, password }` | `201` a session              |
| `POST /auth/login`    | `{ username, password }` | `200` a session              |
| `POST /auth/refresh`  | `{ refreshToken }`       | `200` a new session          |
| `POST /auth/logout`   | `{ refreshToken }`       | `204` no body                |
| `GET /me`             | —                        | `200 { id, name, username }` |
| `GET /users?q=an`     | —                        | `200 { items }` — the picker |

A session:

```json
{
  "user": { "id": 12, "name": "team-alpha", "username": "team-alpha" },
  "accessToken": "eyJhbGciOiJIUzI1NiJ9…",
  "refreshToken": "rt_9f2c…",
  "expiresIn": 900,
  "tokenType": "Bearer"
}
```

`expiresIn` is seconds until the access token dies. When it does, the next
request answers `401 token_expired`: refresh **once**, make every other request
wait on that same promise, then retry. Two refreshes at the same time look like
a stolen token to the server and end the session.

Errors are `{ "error": "…" }`, and auth errors carry a `code` you can branch on
instead of reading the message:

| `code`                | Meaning                                            |
| --------------------- | -------------------------------------------------- |
| `missing_token`       | You sent no credentials at all                     |
| `invalid_token`       | The token is not genuine                           |
| `token_expired`       | **Refresh, then retry the request**                |
| `invalid_credentials` | Wrong username or password                         |
| `username_taken`      | Pick a different username                          |
| `refresh_expired`     | Log in again                                       |
| `refresh_reused`      | The refresh token was used twice — session revoked |

Lists come back wrapped, newest first: `{ "items": […], "total": 42 }`. `total`
ignores pagination. Optional `?start=0&limit=20`.

## What each team builds

Same skeleton for all three: a list, a form, a delete. Then one extra
requirement each, which is where the afternoon actually goes.

Every tab, no exceptions:

- **Loading, empty and error states.** Three of them, not one. "It works when
  there is data" is not finished.
- **Buttons disable while a request is in flight.** Double-clicking Add must not
  create two rows.
- **Confirm before deleting.**
- **Clean up your effects.** Radix throws away the tab you are not looking at,
  so every interval and every fetch must stop in the effect's `return`.
- `npm run build` passes before the pull request.

### Team 1 — Tasks · `/api/tasks`

| Method & path       | Body                                              |
| ------------------- | ------------------------------------------------- |
| `GET /tasks`        | `?scope=all\|mine\|assigned`, `?done=true\|false` |
| `POST /tasks`       | `{ title, dueDate?, assignee? }`                  |
| `PATCH /tasks/:id`  | any of `title`, `done`, `dueDate`, `assignee`     |
| `DELETE /tasks/:id` | —                                                 |

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

**Core:** the list, an add form, a checkbox to complete, delete. Show who a task
is assigned to, and use the `scope` filter for three buttons: All / Mine /
Assigned to me.

**Extra — assign a task to a real person.** `assignee` is a **username**, not an
id, so the form needs a search box: type two letters, call `GET /users?q=`, show
the matches, pick one. Debounce it — one request per keystroke is how you get
rate-limited in front of the room — and throw away a response that arrives after
a newer one. Send `null` to unassign.

The part worth understanding: a task assigned to you shows up in your tab, and
you can tick it off, but renaming it answers **`403 not_owner`** and deleting it
answers **`404`**. Render that difference — no edit button on a task you do not
own — and then show the error properly when someone tries anyway.

### Team 2 — Expenses · `/api/expenses`

| Method & path          | Body                                         |
| ---------------------- | -------------------------------------------- |
| `GET /expenses`        | optional `?category=food`                    |
| `POST /expenses`       | `{ title, amount, category, date? }`         |
| `PATCH /expenses/:id`  | any of `title`, `amount`, `category`, `date` |
| `DELETE /expenses/:id` | —                                            |

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

`category` is one of `food`, `transport`, `books`, `gear`, `fun`, `other`.
Anything else is a `400`, so the form uses a dropdown built from that list.

**Core:** the list, an add form, delete.

**Extra — group them.** The API returns one flat array; the screen shows one
section per category, each with its own subtotal and a count, plus a grand total
at the top. The grouping happens **in the frontend** — there is no `/summary`
endpoint on purpose. Empty categories do not get an empty section.

Do the grouping in a `useMemo` over the fetched array, not inside the render
body, and not by keeping a second piece of state in sync with the first. One
source of truth, derived on the way to the screen.

### Team 3 — Message board · `/api/messages`

| Method & path          | Body       |
| ---------------------- | ---------- |
| `GET /messages`        | —          |
| `POST /messages`       | `{ text }` |
| `PATCH /messages/:id`  | `{ text }` |
| `DELETE /messages/:id` | —          |

```json
{
  "id": 8,
  "text": "the timer works",
  "author": { "username": "team-beta", "name": "Team Beta" },
  "mine": false,
  "createdAt": "2026-08-13T09:12:00.000Z"
}
```

This is the one board everybody shares: `GET /messages` returns **everyone's**
messages, and each one carries `mine`.

**Core:** the feed with author and time, a compose box, delete.

**Extra — make yours look like yours.** Your messages and other people's are the
same data with one boolean between them: align yours right and theirs left,
colour them differently, hide your own username on your own bubbles, and put
edit and delete buttons only where `mine` is true.

Then, in devtools, `fetch` a `PATCH` at somebody else's message id. It answers
`404`. Hiding the button was a **rendering** decision; the server is what
refused. If you only take one thing from this week, take that one.

## Commands

| Command           | What it does                       |
| ----------------- | ---------------------------------- |
| `npm run dev`     | Dev server with hot reload         |
| `npm run build`   | Typecheck, then build into `dist/` |
| `npm run lint`    | ESLint over the whole project      |
| `npm run preview` | Serve the built `dist/` locally    |

Run `npm run build` before opening a pull request. It typechecks, and the dev
server does not.
