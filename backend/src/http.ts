import type { NextFunction, Request, Response } from "express";
import { badRequest } from "./errors.js";

/** Without this header Express leaves req.body empty, which otherwise surfaces
 *  as a confusing "title must be a string". */
export function requireJsonBody(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (!req.is("application/json")) {
    return next(
      badRequest(
        'Set the header "Content-type: application/json" and send a JSON body.',
      ),
    );
  }
  next();
}

export function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) {
    throw badRequest("The id must be a whole number.");
  }
  return id;
}

export function parseText(
  raw: unknown,
  field: string,
  maxLength: number,
): string {
  if (typeof raw !== "string") {
    throw badRequest(`${field} must be a string.`);
  }
  const value = raw.trim();
  if (value === "") {
    throw badRequest(`${field} cannot be empty.`);
  }
  if (value.length > maxLength) {
    throw badRequest(`${field} cannot be longer than ${maxLength} characters.`);
  }
  return value;
}

const MAX_LIMIT = 100;

/** Returns null when neither parameter was sent, meaning "give me everything". */
export function parseRange(query: Record<string, unknown>) {
  if (query.start === undefined && query.limit === undefined) {
    return null;
  }

  const start = query.start === undefined ? 0 : Number(query.start);
  const limit = query.limit === undefined ? 20 : Number(query.limit);

  if (!Number.isInteger(start) || start < 0) {
    throw badRequest("start must be a whole number, 0 or more.");
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw badRequest(`limit must be a whole number between 1 and ${MAX_LIMIT}.`);
  }
  return { start, limit };
}
