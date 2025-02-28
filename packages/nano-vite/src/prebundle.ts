import { join, resolve } from "node:path";
import { log } from "@nano-vite/shared";
import esbuild from "esbuild";
import picocolors from "picocolors";
import { depCache, saveDepCache } from "./cache";
import { CACHE_DIR, ROOT } from "./constant";

export async function preBundleDependency(pkgName: string): Promise<string> {
  const cacheKey = pkgName;
  if (depCache.has(cacheKey)) {
    return depCache.get(cacheKey)!;
  }

  log.debug(`Pre-bundling dependency: ${pkgName}`);
  const entryPoint = resolve(ROOT, "node_modules", pkgName);
  const outFile = join(CACHE_DIR, `${pkgName}.js`);

  try {
    await esbuild.build({
      entryPoints: [entryPoint],
      bundle: true,
      outfile: outFile,
      format: "esm",
      platform: "browser",
      logLevel: "silent",
      write: true,
    });
    depCache.set(cacheKey, outFile);
    await saveDepCache();
    log.debug(
      picocolors.green(`Dependency ${pkgName} pre-bundled to ${outFile}`)
    );
    return outFile;
  } catch (err) {
    log.error(picocolors.red(`Failed to pre-bundle ${pkgName}:`), err);
    throw err;
  }
}
