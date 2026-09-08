import { Router } from "express";
import { asyncHandler } from "../asyncHandler.js";
import { requireAuth } from "../auth.js";
import { db, orThrow } from "../db.js";
import { badRequest, notFound } from "../errors.js";
import { parseId, parseRange, parseText, requireJsonBody } from "../http.js";

const COLUMNS = "id, owner_id, title, url, tag, created_at";
const MAX_TITLE_LENGTH = 200;
const MAX_URL_LENGTH = 2000;
const MAX_TAG_LENGTH = 40;

type LinkRow = {
  id: number;
  owner_id: number;
  title: string;
  url: string;
  tag: string | null;
  created_at: string;
};

function toLink(row: LinkRow) {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    tag: row.tag,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

const parseTitle = (raw: unknown) => parseText(raw, "title", MAX_TITLE_LENGTH);

/** Just enough validation to keep junk out; not a full URL parser. */
function parseUrl(raw: unknown): string {
  const value = parseText(raw, "url", MAX_URL_LENGTH);
  if (!/^https?:\/\//i.test(value)) {
    throw badRequest("url must start with http:// or https://.");
  }
  return value;
}

function parseTag(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") {
    return null;
  }
  return parseText(raw, "tag", MAX_TAG_LENGTH);
}

export const linksRouter = Router();

linksRouter.use(asyncHandler(requireAuth));

// No scope filter to choose from, unlike tasks: a reading list only ever
// shows the owner their own rows.
linksRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const range = parseRange(req.query);

    let query = db
      .from("links")
      .select(COLUMNS, { count: "exact" })
      .eq("owner_id", req.user!.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });

    if (range) {
      query = query.range(range.start, range.start + range.limit - 1);
    }

    const result = await query.returns<LinkRow[]>();

    // PostgREST answers 416 when start is past the end; that is an empty page.
    if (result.status === 416) {
      res.json({ items: [], total: 0 });
      return;
    }

    const rows = orThrow(result);
    res.json({ items: rows.map(toLink), total: result.count ?? rows.length });
  }),
);

linksRouter.post(
  "/",
  requireJsonBody,
  asyncHandler(async (req, res) => {
    const row = orThrow(
      await db
        .from("links")
        .insert({
          owner_id: req.user!.id,
          title: parseTitle(req.body?.title),
          url: parseUrl(req.body?.url),
          tag: parseTag(req.body?.tag),
        })
        .select(COLUMNS)
        .single<LinkRow>(),
    );

    res.status(201).json(toLink(row));
  }),
);

linksRouter.patch(
  "/:id",
  requireJsonBody,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const body = req.body ?? {};

    const changes: Record<string, unknown> = {};
    if (body.title !== undefined) changes.title = parseTitle(body.title);
    if (body.url !== undefined) changes.url = parseUrl(body.url);
    if (body.tag !== undefined) changes.tag = parseTag(body.tag);

    if (Object.keys(changes).length === 0) {
      throw badRequest("Send at least one of: title, url, tag.");
    }

    const rows = orThrow(
      await db
        .from("links")
        .update(changes)
        .eq("id", id)
        .eq("owner_id", req.user!.id)
        .select(COLUMNS)
        .returns<LinkRow[]>(),
    );

    if (rows.length === 0) {
      throw notFound(`No link of yours with id ${id}.`);
    }
    res.json(toLink(rows[0]));
  }),
);

linksRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);

    const rows = orThrow(
      await db
        .from("links")
        .delete()
        .eq("id", id)
        .eq("owner_id", req.user!.id)
        .select("id")
        .returns<{ id: number }[]>(),
    );

    if (rows.length === 0) {
      throw notFound(`No link of yours with id ${id}.`);
    }
    res.status(204).end();
  }),
);
