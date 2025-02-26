import { WebSocketServer } from "ws";
import { Server } from "node:http";
import { watch } from "chokidar";
import { extname, relative } from "node:path";
import { ignoredHMRPath, ROOT } from "./constant";
import picocolors from "picocolors";
import { log } from "@vite/shared";

/**
 * 初始化 HMR（热模块替换）服务
 * @param server HTTP 服务器实例
 */
export function setupHmr(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    ws.send(JSON.stringify({ type: "connected" }));
    log.debug(picocolors.gray("HMR client connected"));
  });

  watch(ROOT, { ignored: ignoredHMRPath }).on("change", (filePath) => {
    const modulePath = `/${relative(ROOT, filePath)}`;
    const ext = extname(filePath).toLowerCase();
    log.debug(picocolors.yellow(`File changed: ${modulePath}`));

    wss.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        const payload = ext === ".html"
          ? { type: "full-reload", path: modulePath }
          : { type: "update", path: modulePath };
        client.send(JSON.stringify(payload));
      }
    });
  });

  return wss;
}