import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

/** First bytes of the token's hash: enough to correlate one student's
 *  requests, useless to anyone reading the logs. */
function fingerprint(req: Request): string {
  const authorization = req.header("authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return "jwt=none";
  }
  const hash = createHash("sha256")
    .update(authorization.slice(7).trim())
    .digest("hex");
  return `jwt=${hash.slice(0, 8)}`;
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startedAt = Date.now();

  res.on("finish", () => {
    // req.user is only set once the auth middleware has run, so read it at the end.
    const who = req.user ? `${req.user.name}#${req.user.id}` : "anon";
    const parts = [
      req.method,
      req.originalUrl,
      String(res.statusCode),
      `${Date.now() - startedAt}ms`,
      `user=${who}`,
      fingerprint(req),
    ];
    console.log(parts.join(" "));
  });

  next();
}
