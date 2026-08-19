import express from "express";
import rateLimit from "express-rate-limit";
import { User } from "../models/User.js";
import { issueSession, clearSession } from "../middleware/auth.js";

export const authRouter = express.Router();

/**
 * These four routes are the only ones reachable without a session, so they are
 * the only ones an unauthenticated caller can hammer. Signup and login get the
 * tighter limit; /me is read-only and cheap.
 */
const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many attempts. Try again in a few minutes." }
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

/**
 * Validates a signup body.
 *
 * Returns a message rather than throwing, so the caller decides the status
 * code. Messages say what is wrong and how to fix it - "Password must be at
 * least 8 characters", not "Invalid input".
 */
function validateCredentials({ email, password, name }, { needName }) {
  if (!email || !EMAIL_RE.test(String(email))) {
    return "Enter a valid email address.";
  }
  if (!password || String(password).length < MIN_PASSWORD) {
    return `Password must be at least ${MIN_PASSWORD} characters.`;
  }
  if (needName && (!name || !String(name).trim())) {
    return "Enter your name.";
  }
  return null;
}

authRouter.post("/signup", credentialLimiter, async (req, res, next) => {
  try {
    const { email, password, name } = req.body ?? {};
    const problem = validateCredentials(req.body ?? {}, { needName: true });
    if (problem) return res.status(400).json({ error: problem });

    const normalised = String(email).toLowerCase().trim();
    if (await User.exists({ email: normalised })) {
      return res
        .status(409)
        .json({ error: "That email is already registered. Sign in instead." });
    }

    const user = new User({ email: normalised, name: String(name).trim() });
    await user.setPassword(String(password));
    user.lastLoginAt = new Date();
    await user.save();

    issueSession(res, user);
    res.status(201).json({ user: user.toPublicJSON() });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/login", credentialLimiter, async (req, res, next) => {
  try {
    const problem = validateCredentials(req.body ?? {}, { needName: false });
    if (problem) return res.status(400).json({ error: problem });

    const { email, password } = req.body;
    const user = await User.findOne({
      email: String(email).toLowerCase().trim()
    });

    // One message for "no such user" and "wrong password" alike, so the
    // response cannot be used to work out which emails are registered.
    const ok = user && (await user.verifyPassword(String(password)));
    if (!ok) {
      return res.status(401).json({ error: "Email or password is incorrect." });
    }

    user.lastLoginAt = new Date();
    await user.save();

    issueSession(res, user);
    res.json({ user: user.toPublicJSON() });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

/**
 * Who is signed in, if anyone.
 *
 * 200 with `user: null` rather than a 401 when signed out: accounts are
 * optional here, so "nobody is signed in" is a normal answer and not a failure
 * the client should have to catch.
 */
authRouter.get("/me", (req, res) => {
  res.json({ user: req.user ? req.user.toPublicJSON() : null });
});
