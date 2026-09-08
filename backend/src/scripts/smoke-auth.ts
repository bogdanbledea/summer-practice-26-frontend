import { randomBytes } from "node:crypto";
import { db } from "../db.js";

// Usage: npm run smoke:auth  [--  https://your-app.up.railway.app/api]
// Needs the server running and sql/schema.sql applied.
const BASE = (process.argv[2] ?? "http://localhost:3000/api").replace(
  /\/$/,
  "",
);

const username = `smoke_${randomBytes(4).toString("hex")}`;
const password = "practice2026";

let failures = 0;

function check(label: string, ok: boolean, detail: unknown = "") {
  console.log(`${ok ? "  ok  " : " FAIL "} ${label}`, ok ? "" : detail);
  if (!ok) failures++;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function call(
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-type": "application/json", ...(init.headers ?? {}) },
  });
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  return { status: res.status, body };
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

async function main() {
  console.log(`\nsmoke test against ${BASE} as ${username}\n`);

  const health = await call("/health");
  check("GET /health", health.status === 200, health);
  if (health.status !== 200) {
    console.log("\nServer is not answering. Start it with: npm run dev\n");
    process.exit(1);
  }

  // --- register -----------------------------------------------------------
  const reg = await call("/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  check("POST /auth/register -> 201", reg.status === 201, reg);
  check(
    "register returns both tokens",
    Boolean(reg.body?.accessToken && reg.body?.refreshToken),
    reg.body,
  );
  check(
    "register returns expiresIn",
    typeof reg.body?.expiresIn === "number",
    reg.body,
  );

  const dupe = await call("/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  check(
    "duplicate username -> 409 username_taken",
    dupe.status === 409 && dupe.body?.code === "username_taken",
    dupe,
  );

  const weak = await call("/auth/register", {
    method: "POST",
    body: JSON.stringify({ username: `${username}x`, password: "short" }),
  });
  check("short password -> 400", weak.status === 400, weak);

  // --- login --------------------------------------------------------------
  const badLogin = await call("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password: "wrong-password" }),
  });
  check(
    "wrong password -> 401 invalid_credentials",
    badLogin.status === 401 && badLogin.body?.code === "invalid_credentials",
    badLogin,
  );

  const login = await call("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: username.toUpperCase(), password }),
  });
  check("login is case-insensitive on username", login.status === 200, login);

  const { accessToken, refreshToken } = login.body ?? {};

  // --- using the access token --------------------------------------------
  const me = await call("/me", { headers: bearer(accessToken) });
  check(
    "GET /me with Bearer",
    me.status === 200 && me.body?.username === username,
    me,
  );

  const noAuth = await call("/me");
  check(
    "GET /me with no credentials -> 401 missing_token",
    noAuth.status === 401 && noAuth.body?.code === "missing_token",
    noAuth,
  );

  const garbage = await call("/me", { headers: bearer("not.a.token") });
  check(
    "GET /me with a junk token -> 401 invalid_token",
    garbage.status === 401 && garbage.body?.code === "invalid_token",
    garbage,
  );

  // --- refresh ------------------------------------------------------------
  const refreshed = await call("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
  check("POST /auth/refresh -> 200", refreshed.status === 200, refreshed);
  check(
    "refresh returns a NEW refresh token (rotation)",
    Boolean(refreshed.body?.refreshToken) &&
      refreshed.body.refreshToken !== refreshToken,
    "same token came back",
  );

  const rotated = refreshed.body?.refreshToken;
  const afterRefresh = await call("/me", {
    headers: bearer(refreshed.body?.accessToken),
  });
  check(
    "the refreshed access token works",
    afterRefresh.status === 200,
    afterRefresh,
  );

  // --- replay detection ---------------------------------------------------
  const replay = await call("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
  check(
    "replaying the old refresh token -> 401 refresh_reused",
    replay.status === 401 && replay.body?.code === "refresh_reused",
    replay,
  );

  const familyDead = await call("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken: rotated }),
  });
  check(
    "replay killed the whole family, so the current token is dead too",
    familyDead.status === 401,
    familyDead,
  );

  // --- logout -------------------------------------------------------------
  const fresh = await call("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  const logout = await call("/auth/logout", {
    method: "POST",
    body: JSON.stringify({ refreshToken: fresh.body?.refreshToken }),
  });
  check("POST /auth/logout -> 204", logout.status === 204, logout);

  const afterLogout = await call("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken: fresh.body?.refreshToken }),
  });
  check(
    "refreshing after logout -> 401",
    afterLogout.status === 401,
    afterLogout,
  );
}

async function cleanup() {
  const { data } = await db
    .from("users")
    .select("id")
    .like("username", "smoke_%")
    .returns<{ id: number }[]>();
  if (data?.length) {
    await db
      .from("users")
      .delete()
      .in(
        "id",
        data.map((u) => u.id),
      );
    console.log(`\ncleaned up ${data.length} smoke account(s)`);
  }
}

main()
  .catch((err) => {
    console.error("\nsmoke test crashed:", err);
    failures++;
  })
  .then(cleanup)
  .then(() => {
    console.log(
      failures === 0 ? "\nall checks passed\n" : `\n${failures} FAILED\n`,
    );
    process.exit(failures === 0 ? 0 : 1);
  });
