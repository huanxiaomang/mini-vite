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
import { setupHmr } from "./hmr";
import { withSourceMap } from "./sourcemap";
import type { ServerInstance, ViteContext } from "./type";

export async function startDevServer(
  ctx: ViteContext
): Promise<ServerInstance> {
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

          const relativePath = filePath.startsWith(PUBLIC_DIR)
            ? normalizeImportPath(relative(PUBLIC_DIR, filePath))
            : normalizeImportPath(relative(ROOT, filePath));

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
