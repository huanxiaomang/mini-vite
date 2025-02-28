import { Server } from "node:http";
import { extname, relative } from "node:path";
import { watch } from "chokidar";
import { WebSocketServer } from "ws";
import picocolors from "picocolors";
import { log } from "@lite-vite/shared";
import { ROOT, ignoredHMRPath } from "./constant";

export const hmrClientScript = (port: number) => `
    <script type="module">
      const ws = new WebSocket('ws://localhost:${port}');
      ws.onmessage = ({ data }) => {
        const payload = JSON.parse(data);
        if (payload.type === 'update') {
          import(\`\${payload.path}?t=\${Date.now()}\`).then(() => {
            console.log('HMR: Updated ' + payload.path);
          });
        } else if (payload.type === 'full-reload') {
          window.location.reload();
        }
      };
    </script>
  `;

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
        const payload =
          ext === ".html"
            ? { type: "full-reload", path: modulePath }
            : { type: "update", path: modulePath };
        client.send(JSON.stringify(payload));
      }
    });
  });

  return wss;
}
