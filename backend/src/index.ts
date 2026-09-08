import cors from "cors";
import express from "express";
import type { ErrorRequestHandler } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { asyncHandler } from "./asyncHandler.js";
import { requireAuth } from "./auth.js";
import { config } from "./config.js";
import { db } from "./db.js";
import { HttpError } from "./errors.js";
import { requestLogger } from "./logging.js";
import { authRouter } from "./routes/auth.js";
import { eventsRouter } from "./routes/events.js";
import { expensesRouter } from "./routes/expenses.js";
import { linksRouter } from "./routes/links.js";
import { messagesRouter } from "./routes/messages.js";
import { scoresRouter } from "./routes/scores.js";
import { tasksRouter } from "./routes/tasks.js";
import { usersRouter } from "./routes/users.js";

const app = express();

app.set("trust proxy", 1);
app.use(helmet());
app.use(
  cors({
    origin:
      config.corsOrigin === "*"
        ? true
        : config.corsOrigin.split(",").map((o) => o.trim()),
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    // Without Authorization here the browser blocks every logged-in request
    // at the preflight, before it ever reaches this server.
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86_400,
  }),
);
app.use(express.json({ limit: "16kb" }));
app.use(requestLogger);
// Keyed by credential, not IP — the whole room shares one office IP.
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 600,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.header("authorization") ?? req.ip ?? "unknown",
  }),
);

// Register and login are unauthenticated and touch password hashing, so they
// get a tighter budget of their own, keyed by the account being targeted.
const authLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Wait a minute and try again." },
  keyGenerator: (req) => {
    const username = req.body?.username;
    return typeof username === "string" && username.trim() !== ""
      ? `u:${username.trim().toLowerCase()}`
      : `ip:${req.ip ?? "unknown"}`;
  },
});

app.get("/", (_req, res) => {
  res.json({ name: "summer-practice-api", docs: "/api/health" });
});

app.get(
  "/api/health",
  asyncHandler(async (_req, res) => {
    const { error } = await db
      .from("users")
      .select("id", { head: true, count: "exact" });
    if (error) {
      throw new HttpError(503, "The database is not reachable.");
    }
    res.json({ ok: true });
  }),
);

app.get("/api/me", asyncHandler(requireAuth), (req, res) => {
  res.json(req.user);
});

// Only register and login are throttled this hard. Refresh must stay cheap:
// with a 60-second access token the room generates a lot of them.
app.use(["/api/auth/register", "/api/auth/login"], authLimiter);
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/tasks", tasksRouter); // team 1
app.use("/api/expenses", expensesRouter); // team 2
app.use("/api/messages", messagesRouter); // team 3
app.use("/api/links", linksRouter); // team 4
app.use("/api/scores", scoresRouter); // team 5
app.use("/api/events", eventsRouter); // team 6

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    return res
      .status(err.status)
      .json({ error: err.message, ...(err.code ? { code: err.code } : {}) });
  }
  if (err instanceof SyntaxError && "body" in err) {
    return res
      .status(400)
      .json({ error: "The request body is not valid JSON." });
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
};

app.use(errorHandler);

const server = app.listen(config.port, () => {
  console.log(`api listening on port ${config.port}`);
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
