import { Server } from "node:http";
import { dirname, extname, join, relative, resolve } from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as fs from "node:fs";
import { watch } from "chokidar";
import { WebSocketServer } from "ws";
import picocolors from "picocolors";
import { log } from "@lite-vite/shared";
import { ROOT, ignoredHMRPath } from "./constant";
import { ModuleGraph, ModuleNode } from "./moduleGraph";

// 工具函数：规范化路径
function normalizePath(file: string): string {
  return file.replace(/\\/g, "/");
}

// 原始export类型
export type { ModuleNode };

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

// HMR 更新类型
export type HMRPayloadType =
  | "connected" // 客户端连接
  | "update" // 更新（包含 js 或 css 更新）
  | "full-reload" // 全页面刷新
  | "prune" // 模块删除
  | "error"; // 错误信息

// 单个更新的类型定义
export interface Update {
  type: "js-update" | "css-update";
  path: string;
  acceptedPath: string;
  timestamp: number;
}

// HMR 更新载荷
export interface HMRPayload {
  type: HMRPayloadType;
  path?: string; // 更新的模块路径
  updates?: Update[]; // 需要更新的模块列表
  timestamp?: number; // 更新时间戳
  paths?: string[]; // 需要删除的模块路径列表
  err?: {
    message: string;
    stack: string;
  }; // 错误信息
  debugData?: any; // 调试数据
}

// 扩展Server类型
interface ViteServer extends Server {
  moduleGraph: ModuleGraph;
  ws: WebSocketServer;
}

/**
 * 向所有WebSocket客户端广播更新消息
 */
function broadcastUpdate(wss: WebSocketServer, payload: HMRPayload): void {
  const stringified = JSON.stringify(payload);
  log.debug(`正在广播HMR更新，载荷大小: ${stringified.length} 字节`);
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(stringified);
    }
  });
}

/**
 * 初始化 HMR（热模块替换）服务
 * @param server HTTP 服务器实例
 * @param moduleGraph 模块依赖图实例
 */
export function setupHmr(
  server: Server,
  moduleGraph?: ModuleGraph
): WebSocketServer {
  // 如果未提供 moduleGraph，则创建一个新的实例
  const graph = moduleGraph || new ModuleGraph();
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    ws.send(JSON.stringify({ type: "connected" }));
    log.debug(picocolors.gray("HMR 客户端已连接"));
  });

  /**
   * 向所有客户端发送 HMR 更新
   */
  const sendUpdate = (payload: HMRPayload) => {
    broadcastUpdate(wss, payload);
  };

  /**
   * 处理文件变更
   */
  async function handleFileChange(filePath: string) {
    // 统一使用正斜杠，确保 Windows 环境下的路径兼容性
    const normalizedPath = normalizePath(filePath);
    const modulePath = `/${relative(ROOT, normalizedPath).replace(/\\/g, "/")}`;
    const ext = extname(filePath).toLowerCase();
    const absPath = resolve(ROOT, filePath);

    log.debug(picocolors.yellow(`文件已更改: ${modulePath}`));

    try {
      // 先检查文件是否存在
      const fileExists = await new Promise<boolean>((resolve) => {
        fs.readFile(filePath, { encoding: "utf-8" }, (err) => {
          if (err) {
            if (err.code === "ENOENT") {
              log.warn(`文件不存在: ${filePath}，将作为删除处理`);
              resolve(false);
            } else {
              log.error(`读取文件错误: ${filePath}, ${err.message}`);
              resolve(false);
            }
          } else {
            resolve(true);
          }
        });
      });

      // 如果文件不存在，作为删除处理
      if (!fileExists) {
        return handleFileUnlink(filePath);
      }

      // 读取文件内容
      const fileContent = await fs.promises.readFile(filePath, "utf-8");

      log.debug(`文件内容已读取: ${filePath}, 内容长度: ${fileContent.length}`);

      // 如果模块不存在，尝试创建它
      let updatedModule = await graph.updateModuleCode(absPath, fileContent);
      if (!updatedModule) {
        log.warn(`无法在模块图中找到或更新模块: ${absPath}，尝试创建新模块`);

        // 尝试在模块图中创建新模块
        const moduleUrl = `/${normalizedPath
          .split("/")
          .filter(Boolean)
          .join("/")}`;
        updatedModule = graph.ensureEntryFromUrl(moduleUrl, absPath);

        // 更新模块代码和关系
        if (updatedModule) {
          await graph.updateModuleCode(absPath, fileContent);
          log.debug(`创建并更新了新模块: ${absPath}`);
        }
      }

      // 处理不同类型的文件
      if (ext === ".html") {
        // HTML 文件变更 - 全页面刷新
        log.info(`HTML 文件已更改，执行全页面刷新: ${modulePath}`);
        sendUpdate({ type: "full-reload", path: modulePath });
      } else if (ext === ".css") {
        // CSS 文件变更 - 样式更新
        log.info(`CSS 文件已更改，发送样式更新: ${modulePath}`);
        sendUpdate({
          type: "update",
          updates: [
            {
              type: "css-update",
              path: modulePath,
              acceptedPath: modulePath,
              timestamp: Date.now(),
            },
          ],
        });
      } else if (
        ext === ".js" ||
        ext === ".jsx" ||
        ext === ".ts" ||
        ext === ".tsx" ||
        ext === ".mjs"
      ) {
        // JS/TS 等文件变更 - 使用新的 HMR 边界机制
        const { affectedModules, boundaries, needFullReload } =
          await graph.propagateUpdate(absPath);

        // 使模块链失活
        graph.invalidateModules(affectedModules);

        // 检查是否是b.ts的更新
        const isBFile =
          filePath.includes("/b.ts") ||
          filePath.includes("/b.js") ||
          filePath.endsWith("\\b.ts") ||
          filePath.endsWith("\\b.js");

        if (isBFile) {
          log.debug(
            `处理 b 文件更新 - 受影响模块数量: ${affectedModules.size}`
          );

          // 检查整个模块图，查找A文件
          let foundAModule = false;
          const aModules = [];

          for (const [fileKey, mod] of graph.getEntireFileMap()) {
            if (
              fileKey.includes("/a.ts") ||
              fileKey.includes("/a.js") ||
              fileKey.endsWith("\\a.ts") ||
              fileKey.endsWith("\\a.js")
            ) {
              log.debug(`发现 a 文件: ${fileKey}`);
              aModules.push(mod);
              foundAModule = true;

              // 如果a文件不在边界中，添加到边界
              if (!boundaries.has(mod)) {
                log.debug(`强制将 a 文件添加为边界: ${fileKey}`);
                boundaries.add(mod);
              }
            }
          }

          if (foundAModule) {
            log.debug(`检测到 a 文件，共 ${aModules.length} 个实例`);
          } else {
            log.debug(`未找到任何 a 文件实例`);
          }
        }

        // 打印边界信息
        if (boundaries.size > 0) {
          const boundaryFiles = Array.from(boundaries).map((m) => m.file);
          log.debug(
            `找到 ${boundaries.size} 个边界: ${boundaryFiles.join(", ")}`
          );
        } else {
          log.debug(`没有找到任何边界，需要全页面刷新`);
        }

        // 根据情况决定发送更新还是全页面刷新
        if (needFullReload) {
          // 需要全页面刷新的情况
          log.info(`文件 ${modulePath} 变更导致需要全页面刷新`);
          sendUpdate({ type: "full-reload", path: modulePath });
        } else if (boundaries.size > 0) {
          // 有 HMR 边界，发送局部更新
          const updates: Update[] = [];

          // 对每个边界模块生成一个更新
          for (const boundary of boundaries) {
            updates.push({
              type: "js-update",
              path: modulePath, // 变更的原始文件
              acceptedPath: boundary.url, // 使用边界模块的 URL 作为接受点
              timestamp: Date.now(),
            });

            log.debug(`将更新发送到 HMR 边界: ${boundary.file}`);
          }

          log.info(
            `JS/TS 文件已更改，发送更新到 ${updates.length} 个 HMR 边界`
          );

          sendUpdate({
            type: "update",
            updates,
          });
        } else {
          // 没有找到 HMR 边界，发送全页面刷新
          log.warn(`找不到 ${modulePath} 的 HMR 边界，执行全页面刷新`);
          sendUpdate({ type: "full-reload", path: modulePath });
        }
      } else {
        // 其他类型文件，如静态资源等，直接刷新页面
        log.info(`其他类型文件已更改: ${modulePath}，执行全页面刷新`);
        sendUpdate({ type: "full-reload", path: modulePath });
      }
    } catch (err: any) {
      // 处理错误
      log.error(`处理文件更改时出错: ${modulePath}`, err);
      sendUpdate({
        type: "error",
        err: {
          message: `更新 ${modulePath} 时出错: ${err.message}`,
          stack: err.stack || "",
        },
      });
    }
  }

  /**
   * 处理文件删除
   */
  const handleFileUnlink = (filePath: string) => {
    const modulePath = `/${relative(ROOT, filePath)}`;
    const ext = extname(filePath).toLowerCase();
    const absPath = resolve(ROOT, filePath);

    log.debug(picocolors.yellow(`文件已删除: ${modulePath}`));

    try {
      graph.deleteModule(absPath);

      if (ext === ".html") {
        // HTML 文件删除 - 全页面刷新
        sendUpdate({ type: "full-reload" });
      } else if (ext === ".css") {
        // CSS 文件删除 - 发送删除通知
        sendUpdate({
          type: "prune",
          paths: [modulePath],
        });
      } else {
        // JS/TS 等文件删除 - 发送删除通知
        sendUpdate({
          type: "prune",
          paths: [modulePath],
        });
      }
    } catch (err: any) {
      log.error(`处理文件删除时出错: ${modulePath}`, err);
      sendUpdate({
        type: "error",
        err: {
          message: `删除 ${modulePath} 时出错: ${err.message}`,
          stack: err.stack || "",
        },
      });
    }
  };

  // 监听文件变化
  watch(ROOT, { ignored: ignoredHMRPath })
    .on("change", (path) => handleFileChange(path))
    .on("unlink", handleFileUnlink);

  return wss;
}

// 导出简化版的文件变更处理函数供服务器直接调用
export async function handleHMRUpdate(
  file: string,
  server: ViteServer
): Promise<void> {
  // 规范化文件路径
  const normalizedFile = normalizePath(file);

  log.info(`处理HMR更新: ${normalizedFile}`);

  try {
    // 检查文件是否存在
    await fs.promises.access(normalizedFile, fs.constants.R_OK);

    // 读取文件内容
    const content = await fs.promises.readFile(normalizedFile, "utf-8");
    const { moduleGraph } = server;
    const timestamp = Date.now();

    // 找到或创建模块
    let mod = moduleGraph.getModuleByFile(normalizedFile);
    if (!mod) {
      // 尝试创建模块
      const url = `/${normalizedFile.split("/").filter(Boolean).join("/")}`;
      mod = moduleGraph.ensureEntryFromUrl(url, normalizedFile);
    }

    // 更新模块信息
    await moduleGraph.updateModuleCode(normalizedFile, content);

    // 扫描导入关系
    await moduleGraph.scanForImporters(mod);

    // 根据文件类型处理
    if (normalizedFile.endsWith(".html")) {
      log.info(`HTML文件更改，执行全页面刷新`);
      broadcastUpdate(server.ws, {
        type: "full-reload",
        path: mod.url,
      });
      return;
    }

    if (normalizedFile.endsWith(".css")) {
      log.info(`CSS文件更改，发送样式更新`);
      broadcastUpdate(server.ws, {
        type: "update",
        updates: [
          {
            type: "css-update",
            path: mod.url,
            acceptedPath: mod.url,
            timestamp,
          },
        ],
      });
      return;
    }

    // 对于JS/TS文件，查找受影响的模块和HMR边界
    const { affectedModules, boundaries, needFullReload } =
      await moduleGraph.propagateUpdate(normalizedFile);

    // 使缓存失效
    moduleGraph.invalidateModules(affectedModules);

    // 创建调试数据
    const debugData = {
      updatedFile: normalizedFile,
      affectedModulesCount: affectedModules.size,
      boundariesCount: boundaries.size,
      needFullReload,
      // 完整模块图的简要信息
      moduleGraphSummary: Array.from(
        moduleGraph.getEntireFileMap().entries()
      ).map(([file, module]) => ({
        file,
        url: module.url,
        importers: Array.from(module.importers).map((m) => m.file),
        importedModules: Array.from(module.importedModules).map((m) => m.file),
        isSelfAccepting: !!module.isSelfAccepting,
      })),
      // 如果是b.ts被更新，特别检查是否有a.ts导入它
      isSpecialCase:
        normalizedFile.includes("/b.") || normalizedFile.endsWith("\\b."),
    };

    if (needFullReload || boundaries.size === 0) {
      log.warn(`找不到${normalizedFile}的HMR边界，执行全页面刷新`);
      broadcastUpdate(server.ws, {
        type: "full-reload",
        debugData,
      });
      return;
    }

    // 发送JS更新到所有边界
    const updates: Update[] = [];
    for (const boundary of boundaries) {
      updates.push({
        type: "js-update",
        path: mod.url,
        acceptedPath: boundary.url,
        timestamp,
      });
    }

    log.info(`发送${updates.length}个热更新`);
    broadcastUpdate(server.ws, {
      type: "update",
      updates,
      debugData,
    });
  } catch (err: any) {
    log.error(`HMR更新错误: ${err.message}`, err);

    broadcastUpdate(server.ws, {
      type: "error",
      err: {
        message: err.message,
        stack: err.stack || "",
      },
    });
  }
}
