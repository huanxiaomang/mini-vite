import { dirname, extname, relative, resolve } from "node:path";
import {
  CODE_EXTENSIONS,
  log,
  normalize,
  normalizeImportPath,
} from "@lite-vite/shared";
import { init, parse } from "es-module-lexer";
import MagicString from "magic-string";
import { checkSuffix } from "./utils/index";
import { ROOT } from "./constant";
import { preBundleDependency } from "./prebundle";
import { depCache } from "./cache";

export async function rewriteImports(
  code: string,
  filePath: string
): Promise<string> {
  await init;
  const [imports] = parse(code);
  const ms = new MagicString(code);

  async function processImport(imp: { s: number; e: number; n?: string }) {
    const { s: start, e: end, n: importPath } = imp;
    if (!importPath) return;

    const ext = extname(importPath).toLowerCase();
    const isStaticAsset = ext && !CODE_EXTENSIONS.includes(ext);
    const isCssFile = ext === ".css";

    let rewrittenPath: string | undefined;

    if (importPath.startsWith(".") || importPath.startsWith("/")) {
      if (!ext) {
        const resolvedPath = await checkSuffix(
          normalize(resolve(dirname(filePath), importPath))
        );

        rewrittenPath = resolvedPath ?? importPath;
      } else {
        const resolvedPath = resolve(dirname(filePath), importPath);
        rewrittenPath = normalizeImportPath(relative(ROOT, resolvedPath));
      }

      if (isStaticAsset || isCssFile) {
        rewrittenPath += "?import";
      }
    } else {
      const pkgName = importPath.split("/")[0];
      const cachedPath =
        depCache.get(pkgName) || (await preBundleDependency(pkgName));
      rewrittenPath = normalizeImportPath(relative(ROOT, cachedPath));

      if (isStaticAsset || isCssFile) {
        rewrittenPath += "?import";
      }
    }

    if (rewrittenPath) {
      ms.overwrite(start, end, rewrittenPath);
      log.debug(`重写导入: ${importPath} -> ${rewrittenPath}`);
    }
  }

  for (const imp of imports) {
    await processImport(imp);
  }

  return ms.toString();
}
