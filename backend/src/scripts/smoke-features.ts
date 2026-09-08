import { randomBytes } from "node:crypto";
import { db } from "../db.js";

// Usage: npm run smoke:features  [--  https://your-app.up.railway.app/api]
// Needs the server running and both sql files applied.
const BASE = (process.argv[2] ?? "http://localhost:3000/api").replace(
  /\/$/,
  "",
);

const password = "practice2026";
const alice = `smoke_${randomBytes(3).toString("hex")}`;
const bob = `smoke_${randomBytes(3).toString("hex")}`;

let failures = 0;

function check(label: string, ok: boolean, detail: unknown = "") {
  console.log(`${ok ? "  ok  " : " FAIL "} ${label}`, ok ? "" : detail);
  if (!ok) failures++;
}

async function call(
  path: string,
  init: RequestInit = {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-type": "application/json", ...(init.headers ?? {}) },
  });
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  return { status: res.status, body };
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

async function register(username: string): Promise<string> {
  const res = await call("/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  if (res.status !== 201) {
    throw new Error(`could not register ${username}: ${JSON.stringify(res)}`);
  }
  return res.body.accessToken;
}

async function main() {
  console.log(`\nfeature smoke test against ${BASE}\n`);

  const a = await register(alice);
  const b = await register(bob);

  // --- user search --------------------------------------------------------
  const found = await call(`/users?q=${bob.slice(0, 9)}`, {
    headers: bearer(a),
  });
  check(
    "GET /users?q= finds the other account",
    found.status === 200 &&
      found.body.items.some((u: { username: string }) => u.username === bob),
    found.body,
  );
  check(
    "GET /users returns no ids",
    (found.body?.items ?? []).every(
      (u: Record<string, unknown>) => u.id === undefined,
    ),
    found.body,
  );

  // --- team 1: tasks ------------------------------------------------------
  const task = await call("/tasks", {
    method: "POST",
    headers: bearer(a),
    body: JSON.stringify({
      title: "write the readme",
      dueDate: "2026-08-20",
      assignee: bob,
    }),
  });
  check("POST /tasks with an assignee -> 201", task.status === 201, task);
  check(
    "the task comes back with both people",
    task.body?.owner?.username === alice &&
      task.body?.assignee?.username === bob,
    task.body,
  );

  const id = task.body?.id;

  const ghost = await call("/tasks", {
    method: "POST",
    headers: bearer(a),
    body: JSON.stringify({ title: "x", assignee: "nobody-by-that-name" }),
  });
  check("assigning to an unknown username -> 404", ghost.status === 404, ghost);

  const bobsList = await call("/tasks?scope=assigned", { headers: bearer(b) });
  check(
    "the assignee sees it in ?scope=assigned",
    bobsList.body?.items?.some(
      (t: { id: number; assignedToMe: boolean }) =>
        t.id === id && t.assignedToMe === true,
    ),
    bobsList.body,
  );

  const ticked = await call(`/tasks/${id}`, {
    method: "PATCH",
    headers: bearer(b),
    body: JSON.stringify({ done: true }),
  });
  check(
    "the assignee may tick it off",
    ticked.status === 200 && ticked.body?.done === true,
    ticked,
  );

  const renamed = await call(`/tasks/${id}`, {
    method: "PATCH",
    headers: bearer(b),
    body: JSON.stringify({ title: "hijacked" }),
  });
  check(
    "the assignee may NOT rename it -> 403 not_owner",
    renamed.status === 403 && renamed.body?.code === "not_owner",
    renamed,
  );

  const stolen = await call(`/tasks/${id}`, {
    method: "DELETE",
    headers: bearer(b),
  });
  check("the assignee may NOT delete it -> 404", stolen.status === 404, stolen);

  const badDate = await call("/tasks", {
    method: "POST",
    headers: bearer(a),
    body: JSON.stringify({ title: "x", dueDate: "20 August" }),
  });
  check("a malformed dueDate -> 400", badDate.status === 400, badDate);

  // --- team 2: expenses ---------------------------------------------------
  const expense = await call("/expenses", {
    method: "POST",
    headers: bearer(a),
    body: JSON.stringify({ title: "coffee", amount: 12.5, category: "food" }),
  });
  check(
    "POST /expenses -> 201 with a numeric amount",
    expense.status === 201 && expense.body?.amount === 12.5,
    expense,
  );
  check(
    "the expense carries a date",
    typeof expense.body?.date === "string",
    expense.body,
  );

  const badCategory = await call("/expenses", {
    method: "POST",
    headers: bearer(a),
    body: JSON.stringify({ title: "x", amount: 1, category: "snacks" }),
  });
  check(
    "a category outside the list -> 400",
    badCategory.status === 400,
    badCategory,
  );

  const negative = await call("/expenses", {
    method: "POST",
    headers: bearer(a),
    body: JSON.stringify({ title: "x", amount: -5, category: "food" }),
  });
  check("a negative amount -> 400", negative.status === 400, negative);

  const bobsExpenses = await call("/expenses", { headers: bearer(b) });
  check(
    "expenses are private: bob sees none of alice's",
    bobsExpenses.body?.total === 0,
    bobsExpenses.body,
  );

  const notBobs = await call(`/expenses/${expense.body?.id}`, {
    method: "DELETE",
    headers: bearer(b),
  });
  check(
    "deleting someone else's expense -> 404",
    notBobs.status === 404,
    notBobs,
  );

  // --- team 3: messages ---------------------------------------------------
  const posted = await call("/messages", {
    method: "POST",
    headers: bearer(a),
    body: JSON.stringify({ text: "morning" }),
  });
  check("POST /messages -> 201", posted.status === 201, posted);
  check(
    "your own message says mine: true",
    posted.body?.mine === true && posted.body?.author?.username === alice,
    posted.body,
  );

  const board = await call("/messages", { headers: bearer(b) });
  const seen = board.body?.items?.find(
    (m: { id: number }) => m.id === posted.body?.id,
  );
  check("everybody reads the whole board", Boolean(seen), board.body);
  check("someone else's message says mine: false", seen?.mine === false, seen);

  const edited = await call(`/messages/${posted.body?.id}`, {
    method: "PATCH",
    headers: bearer(b),
    body: JSON.stringify({ text: "not yours to edit" }),
  });
  check(
    "editing someone else's message -> 404, whatever the UI showed",
    edited.status === 404,
    edited,
  );

  const tooLong = await call("/messages", {
    method: "POST",
    headers: bearer(a),
    body: JSON.stringify({ text: "x".repeat(501) }),
  });
  check("a 501-character message -> 400", tooLong.status === 400, tooLong);
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
