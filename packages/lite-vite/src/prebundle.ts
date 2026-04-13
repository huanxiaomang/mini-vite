import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { log } from "@lite-vite/shared";
import esbuild from "esbuild";
import picocolors from "picocolors";
import { depCache, saveDepCache } from "./cache";
import { CACHE_DIR, ROOT } from "./constant";

const _require = createRequire(join(ROOT, "package.json"));

function resolvePackageDir(pkgName: string): string {
  const pkgJson = _require.resolve(`${pkgName}/package.json`);
  return dirname(pkgJson);
}

export async function preBundleDependency(pkgName: string): Promise<string> {
  const cacheKey = pkgName;
  if (depCache.has(cacheKey)) {
    return depCache.get(cacheKey)!;
  }

  log.debug(`Pre-bundling dependency: ${pkgName}`);
  const pkgDir = resolvePackageDir(pkgName);
  const outFile = join(CACHE_DIR, `${pkgName}.js`);

  try {
    await esbuild.build({
      entryPoints: [pkgName],
      bundle: true,
      outfile: outFile,
      format: "esm",
      platform: "browser",
      logLevel: "silent",
      write: true,
      nodePaths: [dirname(pkgDir)],
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
