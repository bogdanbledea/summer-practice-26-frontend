# Summer Practice — frontend

React + TypeScript + Vite, with [Radix Themes](https://www.radix-ui.com/themes)
for components and Tailwind for spacing and layout.

One app, three tabs. Each tab belongs to one team and is built independently.

## Run it

```bash
npm install
cp .env.example .env.local
npm run dev
```

Then open http://localhost:5173. You should see three tabs, each holding a
placeholder line. That is the starting point — everything else is ours to build.

`.env.local` is git-ignored, so your settings never end up in a commit.
`.env.example` is the template, and it *is* committed: if you add a new variable,
add it there too with a fake value, or the next person to clone gets a broken app.

Vite only exposes variables that start with `VITE_`, and it does it by pasting
the value into the built JavaScript. Anything in there is public the moment the
app is deployed. Fine for this week's practice data; never for a real secret.

## Layout

```
src/
  App.tsx                  the page and the three tabs
  main.tsx                 where React starts
  features/
    team1/Team1Tab.tsx     team 1 works only in here
    team2/Team2Tab.tsx     team 2 works only in here
    team3/Team3Tab.tsx     team 3 works only in here
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
git checkout -b feat/team-1-add-todo
# ...work...
git add -A
git commit -m "team 1: add a todo from the input"
git push -u origin feat/team-1-add-todo
```

## The API

Base URL is in `.env.local` as `VITE_API_URL`. Every request needs a header
identifying you — that is what we build together tomorrow morning.

| Method & path             | Body                           | Returns                      |
| ------------------------- | ------------------------------ | ---------------------------- |
| `POST /auth/register`     | `{ username, password }`       | `201` a session              |
| `POST /auth/login`        | `{ username, password }`       | `200` a session              |
| `POST /auth/refresh`      | `{ refreshToken }`             | `200` a new session          |
| `POST /auth/logout`       | `{ refreshToken }`             | `204` no body                |
| `GET /me`                 | —                              | `200 { id, name, username }` |
| `GET /todos`              | —                              | `200 { items, total }`       |
| `POST /todos`             | `{ title }`                    | `201` the created todo       |
| `PATCH /todos/:id`        | `{ completed }` or `{ title }` | `200` the updated todo       |
| `DELETE /todos/:id`       | —                              | `204` no body                |

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

A todo:

```json
{
  "id": 4,
  "title": "Read the handbook",
  "completed": false,
  "createdAt": "2026-08-12T07:41:00.000Z"
}
```

`GET /todos` returns them newest first, wrapped, with `total` ignoring
pagination. It takes optional `?start=0&limit=20`; `start` is 0-based, `limit`
is 1–100, and a `start` past the end gives an empty list rather than an error.

Errors are `{ "error": "…" }`, and auth errors carry a `code` you can branch on
instead of reading the message:

| `code`                | Meaning                                             |
| --------------------- | --------------------------------------------------- |
| `missing_token`       | You sent no credentials at all                      |
| `invalid_token`       | The token is not genuine                            |
| `token_expired`       | **Refresh, then retry the request**                 |
| `invalid_credentials` | Wrong username or password                          |
| `username_taken`      | Pick a different username                           |
| `refresh_expired`     | Log in again                                        |
| `refresh_reused`      | The refresh token was used twice — session revoked  |

## Commands

| Command           | What it does                            |
| ----------------- | --------------------------------------- |
| `npm run dev`     | Dev server with hot reload              |
| `npm run build`   | Typecheck, then build into `dist/`      |
| `npm run lint`    | ESLint over the whole project           |
| `npm run preview` | Serve the built `dist/` locally         |

Run `npm run build` before opening a pull request. It typechecks, and the dev
server does not.
