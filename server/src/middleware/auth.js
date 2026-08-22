import jwt from "jsonwebtoken";
import { config, SESSION_COOKIE } from "../config.js";
import { User } from "../models/User.js";

/** Signs a session token for `user` and sets it as an httpOnly cookie. */
export function issueSession(res, user) {
  const token = jwt.sign({ sub: user._id.toString() }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn
  });

  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    // "lax" in development, where the client reaches the API through Vite's
    // same-origin proxy. In production the client is a static site and the
    // API a separate Render service on a different hostname - genuinely
    // cross-site - so that request only carries the cookie if this is "none",
    // which in turn requires `secure`. See COOKIE_SAMESITE in render.yaml.
    sameSite: config.cookieSameSite,
    secure: config.cookieSecure,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: "/"
  });
}

export function clearSession(res) {
  // Must repeat the exact attributes issueSession set the cookie with -
  // sameSite and secure included. In production the cookie is SameSite=None;
  // Secure (cross-site, the client and API are different Render hosts); a
  // clearing Set-Cookie without those attributes is a different cookie as far
  // as the browser is concerned and can be dropped or ignored outright, which
  // leaves the original session cookie live - signed out in React state, but
  // still authenticated on the next request.
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: config.cookieSameSite,
    secure: config.cookieSecure,
    path: "/"
  });
}

/**
 * Resolves the signed-in user onto `req.user`, or leaves it null.
 *
 * Deliberately never rejects: accounts are optional in this app - the player,
 * the practice log and the settings all work signed out - so an absent or stale
 * cookie is a normal state rather than an error. Routes that genuinely need a
 * user use `requireUser` below.
 */
export async function attachUser(req, _res, next) {
  req.user = null;
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return next();

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = await User.findById(payload.sub);
  } catch {
    // Expired or tampered-with token: treat as signed out.
    req.user = null;
  }
  next();
}

/** Guards routes that cannot run without a user. Nothing uses it yet. */
export function requireUser(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Sign in to continue." });
  }
  next();
}
