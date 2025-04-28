import { IncomingMessage, ServerResponse, createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import {
  MIME_TYPES,
  TEXT_EXTENSIONS,
  fileExists,
  getMimeType,
  log,
  normalizeImportPath,
} from "@lite-vite/shared";
import picocolors from "picocolors";
import serve from "sirv";
import { loadDepCache } from "./cache";
import { DEFAULT_PORT, PUBLIC_DIR, ROOT } from "./constant";
import { HMR_CLIENT_PATH, getHmrClientContent, setupHmr } from "./hmr";
import { withSourceMap } from "./sourcemap";
import { ModuleGraph } from "./moduleGraph";
import type { ServerInstance, ViteContext } from "./type";

export async function startDevServer(
  ctx: ViteContext
): Promise<ServerInstance> {
  log.debug("Starting dev server...");
  await loadDepCache();

  // 创建模块依赖图
  const moduleGraph = new ModuleGraph();

  const port = ctx.port || DEFAULT_PORT;
  const staticServer = serve(PUBLIC_DIR, { dev: true, single: true });

  const server = createServer(
    async (req: IncomingMessage, res: ServerResponse) => {
      const url = req.url || "/";
      log.debug(`Request: ${url}`);

      if (url === HMR_CLIENT_PATH) {
        res.writeHead(200, { "Content-Type": "application/javascript" });
        res.end(getHmrClientContent());
        return;
      }

      // 判断是否为模块请求
      const isModuleRequest =
        url.includes("?import") ||
        url.includes("?t=") ||
        !!req.headers.accept?.includes("module") ||
        !!req.headers.referer?.includes("import");

      let filePath: string;

      if (url === "/") {
        filePath = ctx.entry;
      } else {
        // 保留原始 URL 用于模块请求判断
        const cleanUrl = url.split("?")[0]; // 移除查询参数
        const publicPath = resolve(PUBLIC_DIR, cleanUrl.slice(1));
        if (await fileExists(publicPath)) {
          filePath = publicPath;
        } else {
          filePath = resolve(ROOT, cleanUrl.slice(1));
        }
      }

      // 记录文件路径和模块请求状态
      log.debug(`处理文件: ${filePath}, 模块请求: ${isModuleRequest}`);

      // 文件路径不应包含查询参数
      // filePath = filePath.split("?")[0];
      const ext = extname(filePath).toLowerCase();
      log.debug("Resolved filePath:", filePath, "ext:", ext);

      try {
        if (ext in MIME_TYPES) {
          const isText = TEXT_EXTENSIONS.includes(ext);
          const content = isText
            ? await readFile(filePath, "utf-8")
            : await readFile(filePath);

          const relativePath = filePath.startsWith(PUBLIC_DIR)
            ? normalizeImportPath(relative(PUBLIC_DIR, filePath))
            : normalizeImportPath(relative(ROOT, filePath));

          // 如果是 JS/TS/vue 文件，则记录到模块依赖图中
          if (
            (ext === ".js" ||
              ext === ".ts" ||
              ext === ".jsx" ||
              ext === ".tsx" ||
              ext === ".vue") &&
            typeof content === "string"
          ) {
            log.debug(`注册模块到依赖图: ${filePath}, url: ${url}`);

            // 将文件路径统一为正斜杠格式
            const normalizedPath = filePath.replace(/\\/g, "/");

            // 创建模块URL
            const moduleUrl = url.split("?")[0]; // 移除查询参数

            // 创建或更新模块在依赖图中
            moduleGraph.ensureEntryFromUrl(moduleUrl, normalizedPath);

            // 更新模块代码并分析导入关系
            await moduleGraph.updateModuleCode(normalizedPath, content);

            log.debug(`模块注册完成: ${moduleUrl} -> ${normalizedPath}`);

            // 输出当前模块图状态
            const modCount = moduleGraph.getEntireFileMap().size;
            log.debug(`当前模块图中共有 ${modCount} 个模块`);
          }

          for (const plugin of ctx.plugins) {
            if (plugin.transform) {
              const result = await plugin.transform(content, filePath, {
                isModuleRequest,
                port,
                relativePath,
              });

              if (result) {
                if (result.map) {
                  const codeWithMap = await withSourceMap(
                    content as string,
                    result.code as string,
                    relativePath,
                    result.map
                  );
                  res.writeHead(200, { "Content-Type": result.mimeType });
                  res.end(codeWithMap);
                  return;
                } else {
                  res.writeHead(200, { "Content-Type": result.mimeType });
                  res.end(result.code);
                  return;
                }
              }
            }
          }

          res.writeHead(200, { "Content-Type": getMimeType(ext) });
          res.end(content);
          return;
        }

        staticServer(req, res, () => {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end(`404 Not Found: ${url}`);
        });
      } catch (err) {
        log.error(picocolors.red(`Server error for ${url}:`), err);
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal Server Error");
      }
    }
  );

  // 设置 HMR 并共享模块依赖图
  setupHmr(server, moduleGraph);

  return new Promise((resolvePromise) => {
    server.listen(port, () => {
      log.info(
        `Server running at ${picocolors.cyan(`http://localhost:${port}`)}`
      );
      resolvePromise({
        server,
        close: () => new Promise<void>((r) => server.close(() => r())),
      });
    });
  });
}
