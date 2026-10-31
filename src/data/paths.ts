import os from "node:os";
import path from "node:path";

export function dataDir() {
  // Vercel can write only under /tmp, and that disk belongs to one instance.
  if (process.env.VERCEL) return path.join(os.tmpdir(), "grizzly-data");
  return path.join(process.cwd(), "data");
}

export function dbFile() {
  return path.join(dataDir(), "grizzly.db");
}
