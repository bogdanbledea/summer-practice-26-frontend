import { Router } from "express";
import { asyncHandler } from "../asyncHandler.js";
import { requireAuth } from "../auth.js";
import { db, orThrow } from "../db.js";
import { badRequest, forbidden, notFound } from "../errors.js";
import { parseId, parseRange, parseText, requireJsonBody } from "../http.js";
import { findByUsername, loadPeople, type PublicUser } from "../people.js";

const COLUMNS = "id, owner_id, assignee_id, title, done, due_date, created_at";
const MAX_TITLE_LENGTH = 200;

type TaskRow = {
  id: number;
  owner_id: number;
  assignee_id: number | null;
  title: string;
  done: boolean;
  due_date: string | null;
  created_at: string;
};

type Task = {
  id: number;
  title: string;
  done: boolean;
  dueDate: string | null;
  owner: PublicUser | null;
  assignee: PublicUser | null;
  mine: boolean;
  assignedToMe: boolean;
  createdAt: string;
};

function toTask(
  row: TaskRow,
  people: Map<number, PublicUser>,
  viewerId: number,
): Task {
  return {
    id: row.id,
    title: row.title,
    done: row.done,
    dueDate: row.due_date,
    owner: people.get(row.owner_id) ?? null,
    assignee:
      row.assignee_id === null ? null : (people.get(row.assignee_id) ?? null),
    // Who may change what: see PATCH. These two only decide what to render.
    mine: row.owner_id === viewerId,
    assignedToMe: row.assignee_id === viewerId,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

async function decorate(rows: TaskRow[], viewerId: number): Promise<Task[]> {
  const people = await loadPeople(
    rows.flatMap((row) =>
      row.assignee_id === null
        ? [row.owner_id]
        : [row.owner_id, row.assignee_id],
    ),
  );
  return rows.map((row) => toTask(row, people, viewerId));
}

const parseTitle = (raw: unknown) => parseText(raw, "title", MAX_TITLE_LENGTH);

/** Date only, no time: a due date is a day, and a timestamp here would make
 *  the same task due on different days in different time zones. */
function parseDueDate(raw: unknown): string | null {
  if (raw === null || raw === "") {
    return null;
  }
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw badRequest("dueDate must look like 2026-08-20, or be null.");
  }
  if (Number.isNaN(Date.parse(raw))) {
    throw badRequest(`${raw} is not a real date.`);
  }
  return raw;
}

/** A username, or null to hand the task back to nobody. */
async function parseAssignee(raw: unknown): Promise<number | null> {
  if (raw === null || raw === "") {
    return null;
  }
  return findByUsername(raw);
}

function parseDone(raw: unknown): boolean {
  if (typeof raw !== "boolean") {
    throw badRequest("done must be true or false.");
  }
  return raw;
}

export const tasksRouter = Router();

tasksRouter.use(asyncHandler(requireAuth));

/** Everything you own, plus everything handed to you. */
const visibleTo = (userId: number) =>
  `owner_id.eq.${userId},assignee_id.eq.${userId}`;

tasksRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const range = parseRange(req.query);

    let query = db
      .from("tasks")
      .select(COLUMNS, { count: "exact" })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });

    switch (req.query.scope) {
      case undefined:
      case "all":
        query = query.or(visibleTo(userId));
        break;
      case "mine":
        query = query.eq("owner_id", userId);
        break;
      case "assigned":
        query = query.eq("assignee_id", userId);
        break;
      default:
        throw badRequest("scope must be one of: all, mine, assigned.");
    }

    if (req.query.done !== undefined) {
      if (req.query.done !== "true" && req.query.done !== "false") {
        throw badRequest("done must be true or false.");
      }
      query = query.eq("done", req.query.done === "true");
    }

    if (range) {
      query = query.range(range.start, range.start + range.limit - 1);
    }

    const result = await query.returns<TaskRow[]>();

    // PostgREST answers 416 when start is past the end; that is an empty page.
    if (result.status === 416) {
      res.json({ items: [], total: 0 });
      return;
    }

    const rows = orThrow(result);
    res.json({
      items: await decorate(rows, userId),
      total: result.count ?? rows.length,
    });
  }),
);

tasksRouter.post(
  "/",
  requireJsonBody,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const title = parseTitle(req.body?.title);
    const dueDate =
      req.body?.dueDate === undefined ? null : parseDueDate(req.body.dueDate);
    const assigneeId =
      req.body?.assignee === undefined
        ? null
        : await parseAssignee(req.body.assignee);

    const row = orThrow(
      await db
        .from("tasks")
        .insert({
          owner_id: userId,
          assignee_id: assigneeId,
          title,
          due_date: dueDate,
        })
        .select(COLUMNS)
        .single<TaskRow>(),
    );

    res.status(201).json((await decorate([row], userId))[0]);
  }),
);

tasksRouter.patch(
  "/:id",
  requireJsonBody,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const id = parseId(req.params.id);
    const body = req.body ?? {};

    const found = orThrow(
      await db
        .from("tasks")
        .select(COLUMNS)
        .eq("id", id)
        .or(visibleTo(userId))
        .returns<TaskRow[]>(),
    );

    // A task you cannot see is a task that does not exist, as far as you are
    // concerned: a 403 here would confirm that the id is real.
    if (found.length === 0) {
      throw notFound(`No task with id ${id}.`);
    }

    const changes: Record<string, unknown> = {};
    if (body.done !== undefined) changes.done = parseDone(body.done);
    if (body.title !== undefined) changes.title = parseTitle(body.title);
    if (body.dueDate !== undefined)
      changes.due_date = parseDueDate(body.dueDate);
    if (body.assignee !== undefined) {
      changes.assignee_id = await parseAssignee(body.assignee);
    }

    if (Object.keys(changes).length === 0) {
      throw badRequest("Send at least one of: title, done, dueDate, assignee.");
    }

    // The person a task was handed to can finish it. Rewriting it, moving the
    // date or passing it on belongs to whoever created it.
    const ownerOnly = ["title", "due_date", "assignee_id"].filter(
      (key) => key in changes,
    );
    if (ownerOnly.length > 0 && found[0].owner_id !== userId) {
      throw forbidden(
        "This task was assigned to you, so you can only tick it off. Its owner changes the rest.",
        "not_owner",
      );
    }

    const rows = orThrow(
      await db
        .from("tasks")
        .update(changes)
        .eq("id", id)
        .or(visibleTo(userId))
        .select(COLUMNS)
        .returns<TaskRow[]>(),
    );

    res.json((await decorate(rows, userId))[0]);
  }),
);

tasksRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);

    // owner_id, not "visible to me": being assigned a task is not permission
    // to make it disappear.
    const rows = orThrow(
      await db
        .from("tasks")
        .delete()
        .eq("id", id)
        .eq("owner_id", req.user!.id)
        .select("id")
        .returns<{ id: number }[]>(),
    );

    if (rows.length === 0) {
      throw notFound(`No task of yours with id ${id}.`);
    }
    res.status(204).end();
  }),
);
