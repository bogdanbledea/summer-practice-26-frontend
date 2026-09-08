import { db, orThrow } from "./db.js";
import { badRequest, notFound } from "./errors.js";

/** What another account is allowed to see about you: no id, no timestamps,
 *  no email. A picker needs a name to show and a username to send back. */
export type PublicUser = { username: string; name: string };

type UserRow = { id: number; username: string | null; name: string };

const COLUMNS = "id, username, name";

function toPublic(row: UserRow): PublicUser {
  return { username: row.username ?? row.name, name: row.name };
}

/** One lookup for a whole page of rows, so rendering 40 tasks is two queries
 *  rather than forty-one. */
export async function loadPeople(
  ids: number[],
): Promise<Map<number, PublicUser>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) {
    return new Map();
  }
  const rows = orThrow(
    await db
      .from("users")
      .select(COLUMNS)
      .in("id", unique)
      .returns<UserRow[]>(),
  );
  return new Map(rows.map((row) => [row.id, toPublic(row)]));
}

/** People are addressed by username: an id is not something anyone can type. */
export async function findByUsername(raw: unknown): Promise<number> {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw badRequest("Send a username.");
  }
  const username = raw.trim().toLowerCase();

  const rows = orThrow(
    await db
      .from("users")
      .select("id")
      .eq("username", username)
      .returns<{ id: number }[]>(),
  );

  if (rows.length === 0) {
    throw notFound(`No account called ${raw.trim()}.`);
  }
  return rows[0].id;
}

const SEARCH_LIMIT = 20;

export async function searchPeople(rawQuery: unknown): Promise<PublicUser[]> {
  // The search term goes into a PostgREST filter string, where a comma or a
  // bracket would end one condition and start another. Only letters, digits,
  // spaces and - _ . survive, so there is nothing left to inject with.
  const term =
    typeof rawQuery === "string"
      ? rawQuery.trim().replace(/[^a-z0-9 ._-]/gi, "")
      : "";

  let query = db
    .from("users")
    .select(COLUMNS)
    .order("username", { ascending: true })
    .limit(SEARCH_LIMIT);

  if (term !== "") {
    query = query.or(`username.ilike.%${term}%,name.ilike.%${term}%`);
  }

  const rows = orThrow(await query.returns<UserRow[]>());
  return rows.map(toPublic);
}
