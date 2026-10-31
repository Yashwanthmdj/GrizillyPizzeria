import path from "node:path";

export function dataDir() {
  return path.join(process.cwd(), "data");
}

export function dbFile() {
  return path.join(dataDir(), "grizzly.db");
}
