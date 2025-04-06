import { Server } from "node:http";
import { dirname, extname, join, relative } from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { watch } from "chokidar";
import { WebSocketServer } from "ws";
import picocolors from "picocolors";
import { log } from "@lite-vite/shared";
import { ROOT, ignoredHMRPath } from "./constant";

// 替换原来的内联脚本为引用独立客户端脚本的方式
export const hmrClientScript = (port: number) => `
    <script type="module">
      // 导入 HMR 客户端脚本并初始化
      import hmrClient from "/@vite/client";
      document.addEventListener('DOMContentLoaded', () => {
        hmrClient.init(${port});
      });
    </script>
  `;

// HMR 客户端脚本路径
export const HMR_CLIENT_PATH = "/@vite/client";

/**
 * 获取客户端 HMR 脚本内容
 * 从打包后的文件读取
 */
export function getHmrClientContent(): string {
  try {
    // 计算当前文件的目录
    const currentFileUrl = import.meta.url || __filename;
    const currentDir = dirname(
      currentFileUrl.startsWith("file:")
        ? fileURLToPath(currentFileUrl)
        : currentFileUrl
    );

    const clientPath = join(currentDir, "./client/hmr-client.mjs");

    log.debug(`加载 HMR 客户端脚本: ${clientPath}`);
    return readFileSync(clientPath, "utf-8");
  } catch (error) {
    log.error(picocolors.red("无法加载 HMR 客户端脚本:"), error);
    return `console.error('HMR 客户端脚本加载失败', ${JSON.stringify(
      String(error)
    )});`;
  }
}

/**
 * 初始化 HMR（热模块替换）服务
 * @param server HTTP 服务器实例
 */
export function setupHmr(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    ws.send(JSON.stringify({ type: "connected" }));
    log.debug(picocolors.gray("HMR 客户端已连接"));
  });

  watch(ROOT, { ignored: ignoredHMRPath }).on("change", (filePath) => {
    const modulePath = `/${relative(ROOT, filePath).replace(/\\/g, "/")}`;
    const ext = extname(filePath).toLowerCase();
    log.debug(picocolors.yellow(`文件已更改: ${modulePath}`));

    wss.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        let payload;

        if (ext === ".html") {
          // HTML 文件变更 - 全页面刷新
          payload = { type: "full-reload", path: modulePath };
        } else if (ext === ".css") {
          // CSS 文件变更 - 更新样式
          payload = { type: "update", path: modulePath };
        } else {
          // JS/TS 等文件变更 - 更新模块
          payload = { type: "update", path: modulePath };
        }

        client.send(JSON.stringify(payload));
      }
    });
  });

  // 添加对文件删除事件的监听
  watch(ROOT, { ignored: ignoredHMRPath }).on("unlink", (filePath) => {
    // 统一使用正斜杠
    const modulePath = `/${relative(ROOT, filePath).replace(/\\/g, "/")}`;
    const ext = extname(filePath).toLowerCase();
    log.debug(picocolors.yellow(`文件已删除: ${modulePath}`));

    wss.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        let payload;

        if (ext === ".html") {
          // HTML 文件删除 - 全页面刷新
          payload = { type: "full-reload" };
        } else if (ext === ".css") {
          // CSS 文件删除 - 发送删除信号给模块系统
          // 与 Vite 保持一致，发送 "prune" 类型的消息
          payload = {
            type: "prune",
            path: modulePath,
          };
        } else {
          // JS/TS 等文件删除 - 发送删除信号给模块系统
          payload = { type: "prune", path: modulePath };
        }

        client.send(JSON.stringify(payload));
      }
    });
  });

  return wss;
}
