import {
  fileExists,
  getMimeType,
  log,
  MIME_TYPES,
  normalizeImportPath,
  TEXT_EXTENSIONS,
} from "@vite/shared";
import type { ViteContext } from "./type";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { join, extname, resolve, relative, posix, dirname } from "node:path";

import {
  DEFAULT_PORT,
  PUBLIC_DIR,
  ROOT,
} from "./constant";
import picocolors from "picocolors";
import { loadDepCache } from './cache';
import { hmrClientScript } from './inject';
import { rewriteImports } from './imports';
import { setupHmr } from './hmr';
import serve from "sirv";

/**
 * 启动开发服务器
 */
export async function startDevServer(ctx: ViteContext): Promise<any> {
  log.debug("Starting dev server...");
  await loadDepCache();

  const port = ctx.port || DEFAULT_PORT;
  const staticServer = serve(PUBLIC_DIR, { dev: true, single: true });

  const server = createServer(
    async (req: IncomingMessage, res: ServerResponse) => {
      const url = req.url || "/";
      log.debug(`Request: ${url}`);

      const isModuleRequest = url.includes("?import");

      let filePath: string;
      if (url === "/") {
        filePath = ctx.entry;
      } else {
        const publicPath = resolve(PUBLIC_DIR, url.slice(1).split("?")[0]);
        if (await fileExists(publicPath)) {
          filePath = publicPath;
        } else {
          filePath = resolve(ROOT, url.slice(1));
        }
      }
      filePath = filePath.split("?")[0];
      const ext = extname(filePath).toLowerCase();
      log.debug("Resolved filePath:", filePath, "ext:", ext);

      try {
        if (ext in MIME_TYPES) {
          const isText = TEXT_EXTENSIONS.includes(ext);
          const content = isText
            ? await readFile(filePath, "utf-8")
            : await readFile(filePath);

          let finalContent: string | Buffer = content;
          let mimeType = getMimeType(ext);

          if (ext === ".js" && typeof content === "string") {
            finalContent = await rewriteImports(content, filePath);
            mimeType = "application/javascript";
          } else if (ext === ".css") {
            const cssContent = content as string;
            finalContent = `
              const style = document.createElement('style');
              style.textContent = ${JSON.stringify(cssContent)};
              document.head.appendChild(style);
              export default {};
            `;
            mimeType = "application/javascript";
          } else if (ext === ".svg" && isModuleRequest) {
            const relativePath = filePath.startsWith(PUBLIC_DIR)
              ? normalizeImportPath(relative(PUBLIC_DIR, filePath))
              : normalizeImportPath(relative(ROOT, filePath));
            log.debug("Handling SVG:", { filePath, relativePath });
            const svgContent = await readFile(filePath, "utf-8");
            const encodedSvg = encodeURIComponent(svgContent.trim())
              .replace(/'/g, "\\'")
              .replace(/"/g, '\\"');
            finalContent = `export default "data:image/svg+xml,${encodedSvg}";`;
            mimeType = "application/javascript";
          } else if (ext === ".png" && isModuleRequest) {
            const relativePath = filePath.startsWith(PUBLIC_DIR)
              ? normalizeImportPath(relative(PUBLIC_DIR, filePath))
              : normalizeImportPath(relative(ROOT, filePath));
            log.debug("Handling PNG:", { filePath, relativePath });
            finalContent = `export default "${relativePath}";`;
            mimeType = "application/javascript";
          } else if (ext === ".html") {
            finalContent = `${content}\n${hmrClientScript(port)}`;
            mimeType = "text/html";
          }

          res.writeHead(200, { "Content-Type": mimeType });
          res.end(finalContent);
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

  setupHmr(server);

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
