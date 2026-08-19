import mongoose from "mongoose";
import { config } from "./config.js";

/**
 * Connects to MongoDB.
 *
 * The only thing this database holds is the `users` collection - credentials
 * and, later, billing state. Practice logs and player settings deliberately
 * never leave the browser's localStorage, so there is nothing else here to
 * model. See server/src/models/User.js.
 */
export async function connectDb() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(config.mongoUri, {
    serverSelectionTimeoutMS: 8000
  });
  console.log("[lehra] MongoDB connected");
}
