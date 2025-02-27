import { dirname, extname, relative, resolve } from "node:path";
import { log, normalize, normalizeImportPath } from "@vite/shared";
import { init, parse } from "es-module-lexer";
import MagicString from "magic-string";
import { checkSuffix } from "./utils";
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

  // 将导入处理逻辑提取为异步函数
  async function processImport(imp: { s: number; e: number; n?: string }) {
    const { s: start, e: end, n: importPath } = imp;
    if (!importPath) return;

    const ext = extname(importPath).toLowerCase();
    const isStaticAsset =
      ext && ext !== ".js" && ext !== ".css" && ext !== ".ts" && ext !== ".vue";
    let rewrittenPath: string | undefined;

    if (importPath.startsWith(".") || importPath.startsWith("/")) {
      // 处理相对路径或绝对路径
      if (!ext) {
        // 无后缀，猜测后缀
        const resolvedPath = await checkSuffix(
          normalize(resolve(dirname(filePath), importPath))
        );

        // 如果没有找到合适的后缀，使用原始路径
        rewrittenPath = resolvedPath ?? importPath;
      } else {
        // 有后缀，直接解析
        const resolvedPath = resolve(dirname(filePath), importPath);
        rewrittenPath = normalizeImportPath(relative(ROOT, resolvedPath));
      }

      if (isStaticAsset) {
        rewrittenPath += "?import";
      }
    } else {
      // 处理裸导入（第三方依赖）
      const pkgName = importPath.split("/")[0];
      const cachedPath =
        depCache.get(pkgName) || (await preBundleDependency(pkgName));
      rewrittenPath = normalizeImportPath(relative(ROOT, cachedPath));
      if (isStaticAsset) {
        rewrittenPath += "?import";
      }
    }

    if (rewrittenPath) {
      ms.overwrite(start, end, rewrittenPath);
      log.debug(`Rewrote import: ${importPath} -> ${rewrittenPath}`);
    }
  }

  // 依次处理每个导入
  for (const imp of imports) {
    await processImport(imp);
  }

  return ms.toString();
}
