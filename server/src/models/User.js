import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

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
