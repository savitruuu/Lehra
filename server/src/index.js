import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

import { config } from "./config.js";
import { connectDb } from "./db.js";
import { attachUser } from "./middleware/auth.js";
import { authRouter } from "./routes/auth.js";

/**
 * The Lehra API.
 *
 * Scope, deliberately small: accounts. Signup, login, logout, and "who am I".
 * Practice logs and player settings stay in the browser's localStorage and
 * never reach this process - there is no route here that accepts them, which is
 * how that boundary is enforced rather than merely intended.
 */
const app = express();

app.set("trust proxy", 1);
app.use(express.json({ limit: "16kb" }));
app.use(cookieParser());
app.use(
  cors({
    origin: config.clientOrigin,
    // The session rides in an httpOnly cookie, so the browser has to be allowed
    // to send it on cross-origin XHR.
    credentials: true
  })
);

app.get("/healthz", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", attachUser, authRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found." });
});

// eslint-disable-next-line no-unused-vars -- Express identifies the error
// handler by its four-argument shape, so `next` has to stay.
app.use((err, _req, res, _next) => {
  console.error("[lehra] unhandled error", err);
  res.status(500).json({ error: "Something went wrong. Try again." });
});

connectDb()
  .then(() => {
    app.listen(config.port, () => {
      console.log(`[lehra] API listening on http://localhost:${config.port}`);
    });
  })
  .catch((err) => {
    console.error("[lehra] failed to start:", err.message);
    process.exit(1);
  });
