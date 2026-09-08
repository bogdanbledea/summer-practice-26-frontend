import { Router } from "express";
import { asyncHandler } from "../asyncHandler.js";
import { requireAuth } from "../auth.js";
import { db, orThrow } from "../db.js";
import { badRequest, notFound } from "../errors.js";
import { parseId, parseRange, parseText, requireJsonBody } from "../http.js";
import { loadPeople, type PublicUser } from "../people.js";

const COLUMNS = "id, author_id, text, created_at";
const MAX_TEXT_LENGTH = 500;

type MessageRow = {
  id: number;
  author_id: number;
  text: string;
  created_at: string;
};

/** Everyone reads the whole board, so `mine` tells the frontend which cards
 *  get edit and delete buttons — and which side to draw them on. The server
 *  checks author_id on every write regardless; see PATCH and DELETE. */
function toMessage(
  row: MessageRow,
  people: Map<number, PublicUser>,
  viewerId: number,
) {
  return {
    id: row.id,
    text: row.text,
    author: people.get(row.author_id) ?? null,
    mine: row.author_id === viewerId,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

async function decorate(rows: MessageRow[], viewerId: number) {
  const people = await loadPeople(rows.map((row) => row.author_id));
  return rows.map((row) => toMessage(row, people, viewerId));
}

const parseMessageText = (raw: unknown) =>
  parseText(raw, "text", MAX_TEXT_LENGTH);

export const messagesRouter = Router();

messagesRouter.use(asyncHandler(requireAuth));

messagesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const range = parseRange(req.query);

    let query = db
      .from("messages")
      .select(COLUMNS, { count: "exact" })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });

    if (range) {
      query = query.range(range.start, range.start + range.limit - 1);
    }

    const result = await query.returns<MessageRow[]>();

    // PostgREST answers 416 when start is past the end; that is an empty page.
    if (result.status === 416) {
      res.json({ items: [], total: 0 });
      return;
    }

    const rows = orThrow(result);
    res.json({
      items: await decorate(rows, req.user!.id),
      total: result.count ?? rows.length,
    });
  }),
);

messagesRouter.post(
  "/",
  requireJsonBody,
  asyncHandler(async (req, res) => {
    const row = orThrow(
      await db
        .from("messages")
        .insert({
          author_id: req.user!.id,
          text: parseMessageText(req.body?.text),
        })
        .select(COLUMNS)
        .single<MessageRow>(),
    );

    res.status(201).json((await decorate([row], req.user!.id))[0]);
  }),
);

messagesRouter.patch(
  "/:id",
  requireJsonBody,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (req.body?.text === undefined) {
      throw badRequest("Send a text to change.");
    }

    // Everyone can read every message, but author_id here means you can only
    // change your own. Never trust the frontend to have hidden the button.
    const rows = orThrow(
      await db
        .from("messages")
        .update({ text: parseMessageText(req.body.text) })
        .eq("id", id)
        .eq("author_id", req.user!.id)
        .select(COLUMNS)
        .returns<MessageRow[]>(),
    );

    if (rows.length === 0) {
      throw notFound(`No message of yours with id ${id}.`);
    }
    res.json((await decorate(rows, req.user!.id))[0]);
  }),
);

messagesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);

    const rows = orThrow(
      await db
        .from("messages")
        .delete()
        .eq("id", id)
        .eq("author_id", req.user!.id)
        .select("id")
        .returns<{ id: number }[]>(),
    );

    if (rows.length === 0) {
      throw notFound(`No message of yours with id ${id}.`);
    }
    res.status(204).end();
  }),
);
