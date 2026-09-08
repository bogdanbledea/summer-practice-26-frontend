import { Router } from "express";
import { asyncHandler } from "../asyncHandler.js";
import { requireAuth } from "../auth.js";
import { searchPeople } from "../people.js";

export const usersRouter = Router();

usersRouter.use(asyncHandler(requireAuth));

/** `GET /api/users?q=an` — the picker behind "assign this task to…".
 *  Returns at most 20 matches, username and display name only. */
usersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({ items: await searchPeople(req.query.q) });
  }),
);
