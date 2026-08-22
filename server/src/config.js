import dotenv from "dotenv";

dotenv.config();

/**
 * Everything the server reads from the environment, in one place, so a missing
 * value fails loudly at boot rather than as an undefined halfway through a
 * request.
 */
function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === "") {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        `Copy server/.env.example to server/.env and fill it in.`
    );
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT || 4000),
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  mongoUri: required("MONGODB_URI", "mongodb://127.0.0.1:27017/lehra"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "30d",
  cookieSecure: process.env.COOKIE_SECURE === "true",
  isProduction: process.env.NODE_ENV === "production",

  // SMTP for the signup OTP email. Unset in development is fine - the mailer
  // logs the code to the console instead of sending, so the flow is testable
  // without real credentials.
  smtp: {
    host: process.env.SMTP_HOST || null,
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || null,
    pass: process.env.SMTP_PASS || null,
    from: process.env.SMTP_FROM || "Lehra <no-reply@lehra.app>"
  }
};

/** Name of the httpOnly cookie the session token rides in. */
export const SESSION_COOKIE = "lehra_session";
