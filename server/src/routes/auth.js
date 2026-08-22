import express from "express";
import rateLimit from "express-rate-limit";
import { User } from "../models/User.js";
import { issueSession, clearSession } from "../middleware/auth.js";
import { sendOtpEmail } from "../lib/mailer.js";

export const authRouter = express.Router();

/**
 * These six routes are the only ones reachable without a session, so they are
 * the only ones an unauthenticated caller can hammer. Signup and login get the
 * tighter limit; OTP verification and resend get their own so that guessing a
 * code isn't bounded by the same budget as password attempts; /me is
 * read-only and cheap.
 */
const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many attempts. Try again in a few minutes." }
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
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

/**
 * Signup creates the account and signs in immediately.
 *
 * Email verification (OTP) is wired up below but disabled for now - Render's
 * free plan blocks outbound SMTP, so a verification step nobody can complete
 * would leave every signup stuck. `emailVerified` is set true directly
 * instead of waiting on /verify-otp.
 */
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

    const user = new User({ email: normalised, name: String(name).trim(), emailVerified: true });
    await user.setPassword(String(password));
    user.lastLoginAt = new Date();
    await user.save();

    issueSession(res, user);
    res.status(201).json({ user: user.toPublicJSON() });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/verify-otp", otpLimiter, async (req, res, next) => {
  try {
    const { email, code } = req.body ?? {};
    if (!email || !code) {
      return res.status(400).json({ error: "Enter the code from your email." });
    }

    const normalised = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: normalised });
    if (!user || user.emailVerified) {
      return res.status(400).json({ error: "No verification pending for that email." });
    }

    const result = await user.checkOtp(code);
    if (result === "wrong") {
      return res.status(400).json({ error: "That code is incorrect." });
    }
    if (result === "expired" || result === "none") {
      return res.status(400).json({ error: "That code expired. Request a new one." });
    }
    if (result === "locked") {
      return res.status(429).json({ error: "Too many attempts. Request a new code." });
    }

    user.clearOtp();
    user.lastLoginAt = new Date();
    await user.save();

    issueSession(res, user);
    res.json({ user: user.toPublicJSON() });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/resend-otp", otpLimiter, async (req, res, next) => {
  try {
    const { email } = req.body ?? {};
    if (!email) return res.status(400).json({ error: "Enter your email address." });

    const normalised = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: normalised });
    if (!user || user.emailVerified) {
      return res.status(400).json({ error: "No verification pending for that email." });
    }

    const code = await user.issueOtp();
    await user.save();
    await sendOtpEmail(normalised, code);

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/login", credentialLimiter, async (req, res, next) => {
  try {
    const problem = validateCredentials(req.body ?? {}, { needName: false });
    if (problem) return res.status(400).json({ error: problem });

    const { email, password } = req.body;
    const normalised = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: normalised });

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
 * 200 with `user: null` rather than a 401 when signed out: the client checks
 * this on every load to decide whether to show the app or the sign-in gate,
 * and that is a normal answer, not a failure to catch.
 */
authRouter.get("/me", (req, res) => {
  res.json({ user: req.user ? req.user.toPublicJSON() : null });
});
