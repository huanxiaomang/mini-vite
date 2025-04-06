/**
 * HMR 客户端脚本 - 热模块替换功能
 */

// 定义消息类型
interface HMRPayload {
  type: "connected" | "update" | "full-reload" | "remove-style" | "prune";
  path?: string;
  id?: string;
}

// 定义热更新上下文接口
interface HotContext {
  accept(callback?: (mod: any) => void): void;
  dispose(callback: () => void): void;
  prune(callback: () => void): void;
  // 内部属性，不应该被直接访问
  readonly _acceptCallbacks: Array<(mod: any) => void>;
  readonly _disposeCallbacks: Array<() => void>;
  readonly _pruneCallbacks: Array<() => void>;
  readonly _ownerPath: string;
}

// 存储所有管理的样式标签
const styles = new Map<string, HTMLStyleElement>();

// 更新队列，确保按顺序处理更新
const updateQueue: Array<() => Promise<void>> = [];
let queued = false;

// WebSocket 连接
let socket: WebSocket | null = null;
let isConnected = false;

// 日志级别类型
type LogLevel = "info" | "warn" | "error";

/**
 * 记录日志
 * @param msg 日志消息
 * @param level 日志级别
 */
function log(msg: string, level: LogLevel = "info"): void {
  const prefix = "[vite]";
  const method =
    level === "error"
      ? console.error
      : level === "warn"
      ? console.warn
      : console.log;

  method(`${prefix} ${msg}`);
}

/**
 * 初始化 WebSocket 连接
 * @param port WebSocket 服务器端口号
 */
function setupWebSocket(port: number): void {
  if (socket) return;

  const url = `ws://localhost:${port}`;
  socket = new WebSocket(url);

  socket.addEventListener("open", () => {
    isConnected = true;
    log(
      `WebSocket 连接已建立 (状态: ${isConnected ? "已连接" : "未连接"})`,
      "info"
    );
  });

  socket.addEventListener("message", async (event: MessageEvent<string>) => {
    try {
      const payload = JSON.parse(event.data) as HMRPayload;

      if (payload.type === "connected") {
        log("HMR 客户端已连接", "info");
      } else if (payload.type === "update") {
        if (payload.path && payload.path.endsWith(".css")) {
          // 处理 CSS 文件更新 - 这里不再需要执行特殊逻辑
          // CSS 模块会通过 import.meta.hot.accept 自行处理
          log(`检测到 CSS 更新: ${payload.path}`, "info");
          queueUpdate(() => updateModule(payload.path!));
        } else if (payload.path) {
          queueUpdate(() => updateModule(payload.path!));
        }
      } else if (payload.type === "full-reload") {
        window.location.reload();
      } else if (payload.type === "prune") {
        // 处理文件删除事件 - 触发对应模块的 prune 回调
        if (payload.path) {
          log(`检测到文件删除: ${payload.path}`, "info");
          pruneModule(payload.path);
        }
      } else if (payload.type === "remove-style") {
        log(`检测到样式移除: ${payload.id || payload.path}`, "info");
        // 尝试通过 id 移除，如果没有 id 则尝试通过 path 移除
        if (payload.id) {
          queueUpdate(() => removeStyle(payload.id!));
        } else if (payload.path) {
          // 找到匹配路径的样式并移除
          for (const [id] of styles.entries()) {
            if (id.includes(payload.path!)) {
              queueUpdate(() => removeStyle(id));
            }
          }
        }
      }
    } catch (e) {
      log(`处理 HMR 消息错误: ${e}`, "error");
    }
  });

  socket.addEventListener("close", (event: CloseEvent) => {
    isConnected = false;
    log(`WebSocket 连接已关闭 (代码: ${event.code})，尝试重新连接...`, "warn");
    setTimeout(() => setupWebSocket(port), 1000);
  });

  socket.addEventListener("error", (event: Event) => {
    log(`WebSocket 错误: ${event}`, "error");
  });
}

/**
 * 添加更新到队列
 */
function queueUpdate(fn: () => Promise<void> | void): void {
  updateQueue.push(fn as () => Promise<void>);
  if (!queued) {
    queued = true;
    Promise.resolve().then(async () => {
      queued = false;
      try {
        for (const fn of updateQueue) {
          await fn();
        }
      } catch (e) {
        log(`HMR 更新失败: ${e}`, "error");
      }

      updateQueue.length = 0;
    });
  }
}

/**
 * 更新样式 - Vite 风格的样式更新
 * 通过创建/更新 style 标签而不是 link 标签
 */
export function updateStyle(
  id: string,
  css: string,
  modulePath?: string
): void {
  let style = styles.get(id);

  // 如果提供了模块路径，可用于后续查找热更新上下文
  const path = modulePath || id;

  if (!style) {
    // 创建新样式
    style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.dataset.viteCssId = id;
    // 存储样式对应的模块路径，用于后续查找热更新上下文
    style.dataset.viteModulePath = path;
    style.textContent = css;
    document.head.appendChild(style);
    styles.set(id, style);
    log(`CSS 已添加: ${id}`, "info");
  } else {
    // 更新已有样式
    style.textContent = css;
    // 确保模块路径始终是最新的
    style.dataset.viteModulePath = path;
    log(`CSS 已更新: ${id}`, "info");
  }
}

/**
 * 移除样式 - Vite 风格
 */
export function removeStyle(id: string): void {
  const style = styles.get(id);
  if (style) {
    document.head.removeChild(style);
    styles.delete(id);
    log(`CSS 已移除: ${id}`, "info");
  }
}

// 定义模块更新事件的详情类型
interface ModuleUpdateEventDetail {
  path: string;
}

// 声明自定义事件类型
declare global {
  interface WindowEventMap {
    "vite:moduleUpdated": CustomEvent<ModuleUpdateEventDetail>;
  }

  // 声明 import.meta 类型
  interface ImportMeta {
    hot?: HotContext;
  }

  interface Window {
    __LITE_VITE_HMR__: {
      updateStyle: (id: string, css: string, modulePath?: string) => void;
      removeStyle: (id: string) => void;
      createHotContext: (ownerPath: string) => HotContext;
    };
  }
}

/**
 * 更新模块
 */
async function updateModule(path: string): Promise<void> {
  // 添加适当的查询参数，保留模块请求标识，同时添加时间戳
  const moduleQuery = path.includes("?") ? "&" : "?";
  const url = `${path}${moduleQuery}import&t=${Date.now()}`;
  try {
    await import(url);
    log(`模块已更新: ${path}`, "info");

    // 触发自定义事件
    window.dispatchEvent(
      new CustomEvent<ModuleUpdateEventDetail>("vite:moduleUpdated", {
        detail: { path },
      })
    );
  } catch (e) {
    log(`模块更新失败: ${path}, ${e}`, "error");
  }
}

/**
 * 处理模块被删除的情况
 * 查找并触发模块注册的 prune 回调
 */
function pruneModule(path: string): void {
  // 查找所有注册的热模块上下文
  const contexts = findHotModuleContexts(path);

  if (contexts.length === 0) {
    log(`未找到与 ${path} 关联的热模块上下文`, "warn");
    return;
  }

  // 触发所有匹配模块的 prune 回调
  for (const ctx of contexts) {
    log(`执行模块 ${ctx._ownerPath} 的 prune 回调`, "info");
    for (const cb of ctx._pruneCallbacks) {
      try {
        cb();
      } catch (e) {
        log(`执行 prune 回调时出错: ${e}`, "error");
      }
    }
  }
}

/**
 * 查找与指定路径匹配的所有热模块上下文
 */
function findHotModuleContexts(path: string): HotContext[] {
  const contexts: HotContext[] = [];

  // 首先尝试直接从热模块映射表中获取
  const ctx = hotModulesMap.get(path);
  if (ctx) {
    contexts.push(ctx);
    return contexts;
  }

  // 如果直接查找失败，尝试通过样式元素关联查找
  for (const style of styles.values()) {
    const moduleId = style.dataset.viteModulePath;
    if (
      moduleId &&
      (moduleId === path || path.includes(moduleId) || moduleId.includes(path))
    ) {
      const ctx = hotModulesMap.get(moduleId);
      if (ctx) {
        contexts.push(ctx);
      }
    }
  }

  return contexts;
}

// 存储已创建的热模块上下文
const hotModulesMap = new Map<string, HotContext>();

/**
 * 创建热更新上下文
 */
export function createHotContext(ownerPath: string): HotContext {
  // 已接受的回调函数
  const acceptCallbacks: Array<(mod: any) => void> = [];
  // 模块销毁时的回调函数
  const disposeCallbacks: Array<() => void> = [];
  // 模块被移除时的回调函数
  const pruneCallbacks: Array<() => void> = [];

  const hot: HotContext = {
    accept(callback?: (mod: any) => void) {
      if (callback) {
        acceptCallbacks.push(callback);
      }
    },

    dispose(callback: () => void) {
      disposeCallbacks.push(callback);
    },

    prune(callback: () => void) {
      pruneCallbacks.push(callback);
    },

    // 内部方法，执行接受的回调
    _acceptCallbacks: acceptCallbacks,
    _disposeCallbacks: disposeCallbacks,
    _pruneCallbacks: pruneCallbacks,
    _ownerPath: ownerPath,
  };

  // 将创建的上下文存储到全局映射中
  hotModulesMap.set(ownerPath, hot);

  return hot;
}

/**
 * 初始化 HMR
 * @param port WebSocket 服务器端口号
 */
export function init(port: number): void {
  setupWebSocket(port);

  log(
    `HMR 客户端已初始化 (连接状态: ${isConnected ? "已连接" : "正在连接"})`,
    "info"
  );
}

/**
 * HMR 客户端默认导出
 */
export default {
  init,
  updateStyle,
  removeStyle,
  createHotContext,
};

window.__LITE_VITE_HMR__ = {
  updateStyle,
  removeStyle,
  createHotContext,
};
