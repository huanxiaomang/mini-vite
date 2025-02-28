import { readFile, writeFile } from "node:fs/promises";
import { fileExists, log } from "@lite-vite/shared";
import { METADATA_PATH } from "./constant";

export const depCache: Map<string, string> = new Map();

/**
 * 从文件加载缓存
 */
export async function loadDepCache() {
  try {
    if (await fileExists(METADATA_PATH)) {
      const metadata = JSON.parse(await readFile(METADATA_PATH, "utf-8"));
      const deps = metadata.dependencies || {};
      for (const [pkgName, outFile] of Object.entries(deps)) {
        depCache.set(pkgName, outFile as string);
      }
      log.debug("Loaded dep cache from metadata.json:", deps);
    }
  } catch (err) {
    log.warn("Failed to load dep cache:", err);
  }
}

/**
 * 保存缓存到文件
 */
export async function saveDepCache() {
  try {
    const metadata = {
      dependencies: Object.fromEntries(depCache),
    };
    await writeFile(METADATA_PATH, JSON.stringify(metadata, null, 2), "utf-8");
    log.debug("Saved dep cache to metadata.json");
  } catch (err) {
    log.error("Failed to save dep cache:", err);
  }
}
