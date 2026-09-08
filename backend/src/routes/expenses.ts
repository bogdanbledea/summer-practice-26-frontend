import { Router } from "express";
import { asyncHandler } from "../asyncHandler.js";
import { requireAuth } from "../auth.js";
import { db, orThrow } from "../db.js";
import { badRequest, notFound } from "../errors.js";
import { parseId, parseRange, parseText, requireJsonBody } from "../http.js";

const COLUMNS = "id, title, amount, category, spent_on, created_at";
const MAX_TITLE_LENGTH = 120;
const MAX_AMOUNT = 1_000_000;

/** A fixed list, so the frontend can group by it and always get the same
 *  buckets. Free text here means "Food", "food" and "Foood" as three groups. */
export const CATEGORIES = [
  "food",
  "transport",
  "books",
  "gear",
  "fun",
  "other",
] as const;

type Category = (typeof CATEGORIES)[number];

type ExpenseRow = {
  id: number;
  title: string;
  // numeric comes back over the wire as a string; the precision would not
  // survive JSON any other way.
  amount: string;
  category: string;
  spent_on: string;
  created_at: string;
};

function toExpense(row: ExpenseRow) {
  return {
    id: row.id,
    title: row.title,
    amount: Number(row.amount),
    category: row.category,
    date: row.spent_on,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

const parseTitle = (raw: unknown) => parseText(raw, "title", MAX_TITLE_LENGTH);

function parseAmount(raw: unknown): number {
  const amount = typeof raw === "string" ? Number(raw) : raw;
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    throw badRequest("amount must be a number.");
  }
  if (amount <= 0) {
    throw badRequest("amount must be more than 0.");
  }
  if (amount > MAX_AMOUNT) {
    throw badRequest(`amount cannot be more than ${MAX_AMOUNT}.`);
  }
  return Math.round(amount * 100) / 100;
}

function parseCategory(raw: unknown): Category {
  if (typeof raw !== "string" || !CATEGORIES.includes(raw as Category)) {
    throw badRequest(`category must be one of: ${CATEGORIES.join(", ")}.`);
  }
  return raw as Category;
}

function parseDate(raw: unknown): string {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw badRequest("date must look like 2026-08-13.");
  }
  if (Number.isNaN(Date.parse(raw))) {
    throw badRequest(`${raw} is not a real date.`);
  }
  return raw;
}

export const expensesRouter = Router();

expensesRouter.use(asyncHandler(requireAuth));

expensesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const range = parseRange(req.query);

    let query = db
      .from("expenses")
      .select(COLUMNS, { count: "exact" })
      .eq("user_id", req.user!.id)
      .order("spent_on", { ascending: false })
      .order("id", { ascending: false });

    if (req.query.category !== undefined) {
      query = query.eq("category", parseCategory(req.query.category));
    }

    if (range) {
      query = query.range(range.start, range.start + range.limit - 1);
    }

    const result = await query.returns<ExpenseRow[]>();

    // PostgREST answers 416 when start is past the end; that is an empty page.
    if (result.status === 416) {
      res.json({ items: [], total: 0 });
      return;
    }

    const rows = orThrow(result);
    res.json({
      items: rows.map(toExpense),
      total: result.count ?? rows.length,
    });
  }),
);

expensesRouter.post(
  "/",
  requireJsonBody,
  asyncHandler(async (req, res) => {
    const row = orThrow(
      await db
        .from("expenses")
        .insert({
          user_id: req.user!.id,
          title: parseTitle(req.body?.title),
          amount: parseAmount(req.body?.amount),
          category: parseCategory(req.body?.category),
          spent_on:
            req.body?.date === undefined
              ? new Date().toISOString().slice(0, 10)
              : parseDate(req.body.date),
        })
        .select(COLUMNS)
        .single<ExpenseRow>(),
    );

    res.status(201).json(toExpense(row));
  }),
);

expensesRouter.patch(
  "/:id",
  requireJsonBody,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const body = req.body ?? {};

    const changes: Record<string, unknown> = {};
    if (body.title !== undefined) changes.title = parseTitle(body.title);
    if (body.amount !== undefined) changes.amount = parseAmount(body.amount);
    if (body.category !== undefined) {
      changes.category = parseCategory(body.category);
    }
    if (body.date !== undefined) changes.spent_on = parseDate(body.date);

    if (Object.keys(changes).length === 0) {
      throw badRequest("Send at least one of: title, amount, category, date.");
    }

    // The user_id filter is what stops one account patching another's row.
    const rows = orThrow(
      await db
        .from("expenses")
        .update(changes)
        .eq("id", id)
        .eq("user_id", req.user!.id)
        .select(COLUMNS)
        .returns<ExpenseRow[]>(),
    );

    if (rows.length === 0) {
      throw notFound(`No expense with id ${id}.`);
    }
    res.json(toExpense(rows[0]));
  }),
);

expensesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);

    const rows = orThrow(
      await db
        .from("expenses")
        .delete()
        .eq("id", id)
        .eq("user_id", req.user!.id)
        .select("id")
        .returns<{ id: number }[]>(),
    );

    if (rows.length === 0) {
      throw notFound(`No expense with id ${id}.`);
    }
    res.status(204).end();
  }),
);
