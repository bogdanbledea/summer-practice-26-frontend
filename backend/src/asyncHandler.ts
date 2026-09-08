import type { NextFunction, Request, RequestHandler, Response } from "express";

/** Express 4 does not forward rejected promises to the error handler. */
export function asyncHandler(handler: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
