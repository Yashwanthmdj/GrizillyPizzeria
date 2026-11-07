import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

let loaded = false;

/** Load project `.env` into process.env for server code (Vite only auto-exposes VITE_*). */
export function loadLocalEnv() {
  if (loaded) return;
  loaded = true;
  try {
    const file = path.join(process.cwd(), ".env");
    if (!existsSync(file)) return;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const i = trimmed.indexOf("=");
      if (i < 0) continue;
      const key = trimmed.slice(0, i).trim();
      if (!key) continue;
      let val = trimmed.slice(i + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      // Prefer .env file so Vite's dotenv `#` truncation cannot keep a bad value.
      process.env[key] = val;
    }
  } catch {
    /* ignore missing/unreadable env */
  }
}

loadLocalEnv();
