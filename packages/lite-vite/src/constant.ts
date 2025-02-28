import { join, resolve } from "node:path";
export const DEFAULT_PORT = 4000;
export const ROOT = process.cwd();
export const OUT_DIR = join(ROOT, "dist");
export const CACHE_DIR = join(ROOT, "node_modules", ".lite-vite");
export const PUBLIC_DIR = resolve(ROOT, "public");
export const METADATA_PATH = resolve(CACHE_DIR, "metadata.json");
export const possibleExtensions = [".js", ".ts", ".jsx", ".tsx"];
export const ignoredHMRPath = [/node_modules/, "dist"];
