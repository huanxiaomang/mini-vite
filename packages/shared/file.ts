import { stat } from "node:fs/promises";
import { posix } from "node:path/posix";

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

export const normalize = posix.normalize;
export const normalizeImportPath = (path: string) =>
  posix.join("/", path.replace(/\\/g, "/"));
