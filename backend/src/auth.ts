import type { NextFunction, Request, Response } from "express";
import { unauthorized } from "./errors.js";
import { verifyAccessToken } from "./tokens.js";

export type ApiUser = { id: number; name: string; username?: string | null };

declare global {
  namespace Express {
    interface Request {
      user?: ApiUser;
    }
  }
}

/** Put this in front of anything that belongs to one account: it fills in
 *  req.user, or throws a 401 that asyncHandler forwards to the error handler. */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const header = req.header("authorization") ?? "";

  if (!header.toLowerCase().startsWith("bearer ")) {
    return next(
      unauthorized(
        "Send an Authorization: Bearer <accessToken> header.",
        "missing_token",
      ),
    );
  }

  const token = header.slice(7).trim();
  if (token === "") {
    return next(
      unauthorized(
        "The Authorization header has no token in it.",
        "missing_token",
      ),
    );
  }

  // Throws 401 token_expired / invalid_token.
  req.user = await verifyAccessToken(token);
  next();
}
