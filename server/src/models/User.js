import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

/**
 * The one collection this app stores server-side.
 *
 * Note what is NOT here: taal, raag, instrument, BPM, session durations,
 * practice history. All of that stays in the browser's localStorage under
 * `lehra_practice_logs` and `lehra_user_settings`, and no route in this server
 * reads or writes it. Keeping the boundary visible in the schema is the point -
 * if a field describing practice ever shows up below, the rule has been broken.
 *
 * `createdAt` and `lastLoginAt` are what answer "who uses the app", which is
 * the reason the server exists at all.
 */
const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    },
    lastLoginAt: {
      type: Date,
      default: null
    },

    /**
     * Signing in requires a verified email - see requireVerified in
     * middleware/auth.js. False from signup until the OTP below is confirmed.
     */
    emailVerified: {
      type: Boolean,
      default: false
    },

    /**
     * The signup OTP, mid-flight. `hash` is bcrypt of the 6-digit code, never
     * the code itself; `attempts` caps guesses per code independently of the
     * per-IP rate limit in routes/auth.js, since a shared IP should not get a
     * shared guess budget. Cleared (all three set to null) once verified.
     */
    otp: {
      hash: { type: String, default: null },
      expiresAt: { type: Date, default: null },
      attempts: { type: Number, default: 0 }
    },

    /**
     * Reserved for the payment gateway, which is not wired up yet. `customerId`
     * is whatever the chosen provider calls its customer handle (Stripe's
     * `cus_...`, Razorpay's `cust_...`); it stays null until then, and `plan`
     * stays "free". Present now so adding billing is a route and a webhook
     * rather than a migration.
     */
    billing: {
      customerId: { type: String, default: null },
      plan: { type: String, default: "free" }
    }
  },
  { timestamps: true }
);

/** Hashes `password` and stores it. Never keeps the plaintext. */
userSchema.methods.setPassword = async function setPassword(password) {
  this.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
};

userSchema.methods.verifyPassword = function verifyPassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

/** Generates a fresh 6-digit code, stores its hash, and returns the plaintext to email. */
userSchema.methods.issueOtp = async function issueOtp() {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  this.otp = {
    hash: await bcrypt.hash(code, BCRYPT_ROUNDS),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
    attempts: 0
  };
  return code;
};

/**
 * Checks `code` against the stored OTP.
 *
 * Returns a reason string on failure ("expired", "wrong", "none") rather than
 * a bare boolean, so the route can give a message that says what to do next -
 * expired means resend, wrong means try again. Attempts increment on every
 * wrong guess, including expired ones, since a caller working through expired
 * codes is still guessing.
 */
userSchema.methods.checkOtp = async function checkOtp(code) {
  if (!this.otp?.hash) return "none";
  if (this.otp.attempts >= OTP_MAX_ATTEMPTS) return "locked";
  if (this.otp.expiresAt < new Date()) return "expired";

  const ok = await bcrypt.compare(String(code), this.otp.hash);
  if (!ok) {
    this.otp.attempts += 1;
    await this.save();
    return "wrong";
  }
  return "ok";
};

/** Marks the account verified and clears the OTP so it cannot be replayed. */
userSchema.methods.clearOtp = function clearOtp() {
  this.emailVerified = true;
  this.otp = { hash: null, expiresAt: null, attempts: 0 };
};

/**
 * What may be sent to the client. Explicit allowlist rather than deleting
 * fields off the document - a field added to the schema later is then absent
 * from responses by default instead of leaking until somebody notices.
 */
userSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: this._id.toString(),
    email: this.email,
    name: this.name,
    plan: this.billing?.plan ?? "free",
    createdAt: this.createdAt
  };
};

export const User = mongoose.model("User", userSchema);
