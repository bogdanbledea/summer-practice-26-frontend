import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { asyncHandler } from "../asyncHandler.js";
import { db } from "../db.js";
import { badRequest, conflict, HttpError, unauthorized } from "../errors.js";
import { hashPassword, verifyPassword } from "../password.js";
import {
  endSession,
  rotateRefreshToken,
  startSession,
  type SessionUser,
} from "../tokens.js";

export const authRouter = Router();

const USERNAME_PATTERN = /^[a-z0-9_-]{3,32}$/;
const MIN_PASSWORD_LENGTH = 8;
// scrypt runs over whatever arrives, so cap it rather than let a 10 MB body
// occupy a worker.
const MAX_PASSWORD_LENGTH = 200;

function requireJsonBody(req: Request, _res: Response, next: NextFunction) {
  if (!req.is("application/json")) {
    return next(
      badRequest(
        'Set the header "Content-type: application/json" and send a JSON body.',
      ),
    );
  }
  next();
}

authRouter.use(requireJsonBody);

/** Stored lowercase so "TeamAlpha" and "teamalpha" cannot both be registered.
 *  The original spelling is kept in users.name for display. */
function parseUsername(raw: unknown): { username: string; display: string } {
  if (typeof raw !== "string") {
    throw badRequest("username must be a string.");
  }
  const display = raw.trim();
  const username = display.toLowerCase();
  if (!USERNAME_PATTERN.test(username)) {
    throw badRequest(
      "username must be 3–32 characters, letters, digits, - or _ only.",
    );
  }
  return { username, display };
}

function parsePassword(raw: unknown): string {
  if (typeof raw !== "string") {
    throw badRequest("password must be a string.");
  }
  if (raw.length < MIN_PASSWORD_LENGTH) {
    throw badRequest(
      `password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
  }
  if (raw.length > MAX_PASSWORD_LENGTH) {
    throw badRequest(
      `password cannot be longer than ${MAX_PASSWORD_LENGTH} characters.`,
    );
  }
  return raw;
}

function publicUser(user: SessionUser) {
  return { id: user.id, name: user.name, username: user.username };
}

// ---------------------------------------------------------------------------

/** Open on purpose: each team registers its own account, no admin in the loop. */
authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { username, display } = parseUsername(req.body?.username);
    const password = parsePassword(req.body?.password);

    const { data: existing, error: lookupError } = await db
      .from("users")
      .select("id")
      .eq("username", username)
      .maybeSingle<{ id: number }>();

    if (lookupError) {
      console.error(lookupError);
      throw new HttpError(500, "Could not check that username.");
    }
    if (existing) {
      throw conflict("That username is taken.", "username_taken");
    }

    const { data: created, error } = await db
      .from("users")
      .insert({
        name: display,
        username,
        password_hash: await hashPassword(password),
      })
      .select("id, name, username")
      .single<SessionUser>();

    // Two registrations racing on the same username: the unique index decides.
    if (error?.code === "23505") {
      throw conflict("That username is taken.", "username_taken");
    }
    if (error || !created) {
      console.error(error);
      throw new HttpError(500, "Could not create that account.");
    }

    // Registering logs you straight in — one less step before the app works.
    const session = await startSession(created);
    res.status(201).json({ user: publicUser(created), ...session });
  }),
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const raw = req.body?.username;
    const password = req.body?.password;

    if (typeof raw !== "string" || typeof password !== "string") {
      throw badRequest("username and password are required.");
    }

    const { data: user, error } = await db
      .from("users")
      .select("id, name, username, password_hash")
      .eq("username", raw.trim().toLowerCase())
      .maybeSingle<SessionUser & { password_hash: string | null }>();

    if (error) {
      console.error(error);
      throw new HttpError(500, "Could not check those credentials.");
    }

    // One message for both "no such user" and "wrong password": telling them
    // apart hands an attacker a list of accounts that exist.
    const ok = await verifyPassword(password, user?.password_hash ?? null);
    if (!user || !ok) {
      throw unauthorized(
        "That username and password do not match.",
        "invalid_credentials",
      );
    }

    const session = await startSession(user);
    res.json({ user: publicUser(user), ...session });
  }),
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const token = req.body?.refreshToken;
    if (typeof token !== "string" || token.trim() === "") {
      throw badRequest("refreshToken is required.", "missing_refresh");
    }

    const { user, ...session } = await rotateRefreshToken(token.trim());
    res.json({ user: publicUser(user), ...session });
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const token = req.body?.refreshToken;
    if (typeof token === "string" && token.trim() !== "") {
      await endSession(token.trim());
    }
    res.status(204).end();
  }),
);
