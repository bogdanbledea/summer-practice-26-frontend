import { Router } from "express";
import { asyncHandler } from "../asyncHandler.js";
import { requireAuth } from "../auth.js";
import { db, orThrow } from "../db.js";
import { badRequest, notFound } from "../errors.js";
import { parseId, parseRange, parseText, requireJsonBody } from "../http.js";
import { loadPeople, type PublicUser } from "../people.js";

const COLUMNS = "id, player_id, game, score, created_at";
const MAX_GAME_LENGTH = 60;
const MAX_SCORE = 1_000_000;

type ScoreRow = {
  id: number;
  player_id: number;
  game: string;
  score: number;
  created_at: string;
};

/** mine only ever gates the delete button. Sorting the board, and figuring
 *  out where you land in it, is left entirely to the frontend — the server
 *  hands back one order (newest first) and nothing else. */
function toScore(
  row: ScoreRow,
  people: Map<number, PublicUser>,
  viewerId: number,
) {
  return {
    id: row.id,
    game: row.game,
    score: row.score,
    player: people.get(row.player_id) ?? null,
    mine: row.player_id === viewerId,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

async function decorate(rows: ScoreRow[], viewerId: number) {
  const people = await loadPeople(rows.map((row) => row.player_id));
  return rows.map((row) => toScore(row, people, viewerId));
}

const parseGame = (raw: unknown) => parseText(raw, "game", MAX_GAME_LENGTH);

function parseScore(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isInteger(raw)) {
    throw badRequest("score must be a whole number.");
  }
  if (raw < 0 || raw > MAX_SCORE) {
    throw badRequest(`score must be between 0 and ${MAX_SCORE}.`);
  }
  return raw;
}

export const scoresRouter = Router();

scoresRouter.use(asyncHandler(requireAuth));

scoresRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const range = parseRange(req.query);

    let query = db
      .from("scores")
      .select(COLUMNS, { count: "exact" })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });

    if (range) {
      query = query.range(range.start, range.start + range.limit - 1);
    }

    const result = await query.returns<ScoreRow[]>();

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

scoresRouter.post(
  "/",
  requireJsonBody,
  asyncHandler(async (req, res) => {
    const row = orThrow(
      await db
        .from("scores")
        .insert({
          player_id: req.user!.id,
          game: parseGame(req.body?.game),
          score: parseScore(req.body?.score),
        })
        .select(COLUMNS)
        .single<ScoreRow>(),
    );

    res.status(201).json((await decorate([row], req.user!.id))[0]);
  }),
);

scoresRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);

    // player_id, not "visible to me": everyone can see every score, but only
    // the person who set it can take it down.
    const rows = orThrow(
      await db
        .from("scores")
        .delete()
        .eq("id", id)
        .eq("player_id", req.user!.id)
        .select("id")
        .returns<{ id: number }[]>(),
    );

    if (rows.length === 0) {
      throw notFound(`No score of yours with id ${id}.`);
    }
    res.status(204).end();
  }),
);
