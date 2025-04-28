/**
 * HMR 客户端脚本 - 热模块替换功能
 * 基于 Vite 的 HMR 客户端实现
 */

// 定义 HMR 载荷类型
interface HMRPayload {
  type: "connected" | "update" | "full-reload" | "prune" | "error";
  path?: string;
  updates?: Update[];
  timestamp?: number;
  paths?: string[];
  err?: {
    message: string;
    stack: string;
  };
}

// 更新类型
interface Update {
  type: "js-update" | "css-update";
  path: string;
  acceptedPath: string;
  timestamp: number;
}

// HMR 上下文接口
interface HotContext {
  // 模块数据
  data: any;
  // 接受模块自身或依赖的更新
  accept(
    deps?: string | string[] | ((data?: any) => void),
    callback?: (data?: any) => void
  ): void;
  // 销毁回调
  dispose(cb: (data: any) => void): void;
  // 剪枝回调 - 模块不再被引用时调用
  prune(cb: (data: any) => void): void;
  // 主动使当前模块失效，通常会触发页面刷新
  invalidate(message?: string): void;
  // 自定义事件监听
  on(event: string, cb: (payload: any) => void): void;
  // 移除自定义事件监听
  off(event: string, cb: (payload: any) => void): void;
  // 发送自定义事件
  send(event: string, data?: any): void;
}

// 热模块类型 - 更新为使用Set和Map
interface HotModule {
  id: string;
  callbacks: Set<(data?: any) => void>;
  deps: Map<string, Set<(data?: any) => void>>;
  selfAccepted: boolean;
}

// 日志级别类型
type LogLevel = "info" | "warn" | "error";

/**
 * 输出日志
 * @param msg 日志消息
 * @param level 日志级别
 */
function log(msg: string, level: LogLevel = "info"): void {
  const prefix = "[vite-hmr]";
  const style =
    level === "info"
      ? "color:green;font-weight:bold"
      : level === "warn"
      ? "color:orange;font-weight:bold"
      : "color:red;font-weight:bold";
  // eslint-disable-next-line no-console
  console.log(`%c${prefix}%c ${msg}`, style, "color:inherit");
}

// 添加日志级别方法
const logger = {
  info: (msg: string) => log(msg, "info"),
  warn: (msg: string) => log(msg, "warn"),
  error: (msg: string) => log(msg, "error"),
};

/**
 * HMR 上下文实现类
 * 为每个模块提供 hot API
 */
class HMRContext implements HotContext {
  private newListeners: Map<string, ((data: any) => void)[]>;
  selfAccepted: boolean = false;

  constructor(private hmrClient: HMRClient, public ownerPath: string) {
    if (!hmrClient.dataMap.has(ownerPath)) {
      hmrClient.dataMap.set(ownerPath, {});
    }

    const mod = hmrClient.hotModulesMap.get(ownerPath);
    if (mod) {
      mod.callbacks = new Set<(data?: any) => void>();
      mod.deps = new Map<string, Set<(data?: any) => void>>();
      mod.selfAccepted = false;
    } else {
      hmrClient.hotModulesMap.set(ownerPath, {
        id: ownerPath,
        callbacks: new Set<(data?: any) => void>(),
        deps: new Map<string, Set<(data?: any) => void>>(),
        selfAccepted: false,
      });
    }

    this.newListeners = new Map();
    hmrClient.ctxToListenersMap.set(ownerPath, this.newListeners);
  }

  get data(): any {
    return this.hmrClient.dataMap.get(this.ownerPath);
  }

  accept(
    dep?: string | string[] | ((data?: any) => void),
    callback?: (data?: any) => void
  ): void {
    if (typeof dep === "function" || !dep) {
      logger.info(`Module ${this.ownerPath} registered for hot update`);
      this.selfAccepted = true;
      const mod = this.hmrClient.hotModulesMap.get(this.ownerPath);
      if (mod) {
        mod.selfAccepted = true;
        if (typeof dep === "function") {
          mod.callbacks.add(dep);
        } else {
          mod.callbacks.add(() => {});
        }
      }
    } else if (typeof dep === "string") {
      logger.info(
        `Module ${this.ownerPath} accepted hot update for dependency ${dep}`
      );
      const mod = this.hmrClient.hotModulesMap.get(this.ownerPath);
      if (mod) {
        if (!mod.deps.has(dep)) {
          mod.deps.set(dep, new Set());
        }
        if (callback) {
          mod.deps.get(dep)!.add(callback);
        }
      }
    } else if (Array.isArray(dep)) {
      logger.info(
        `Module ${this.ownerPath} accepted multiple hot updates: ${dep.join(
          ", "
        )}`
      );
      const mod = this.hmrClient.hotModulesMap.get(this.ownerPath);
      if (mod && callback) {
        dep.forEach((d) => {
          if (!mod.deps.has(d)) {
            mod.deps.set(d, new Set());
          }
          mod.deps.get(d)!.add(callback);
        });
      }
    } else {
      throw new TypeError(
        `'hot.accept()' expects a string, array, or function parameter, but received ${typeof dep}`
      );
    }
  }

  dispose(cb: (data: any) => void): void {
    this.hmrClient.disposeMap.set(this.ownerPath, cb);
  }

  prune(cb: (data: any) => void): void {
    this.hmrClient.pruneMap.set(this.ownerPath, cb);
  }

  decline(): void {}

  invalidate(message?: string): void {
    logger.info(
      `Module invalidated: ${this.ownerPath}${message ? `: ${message}` : ""}`
    );
    location.reload();
  }

  on(event: string, cb: (payload: any) => void): void {
    const addToMap = (map: Map<string, any[]>) => {
      const existing = map.get(event) || [];
      existing.push(cb);
      map.set(event, existing);
    };
    addToMap(this.hmrClient.customListenersMap);
    addToMap(this.newListeners);
  }

  off(event: string, cb: (payload: any) => void): void {
    const removeFromMap = (map: Map<string, any[]>) => {
      const existing = map.get(event);
      if (existing === undefined) return;
      const pruned = existing.filter((l) => l !== cb);
      if (pruned.length === 0) {
        map.delete(event);
      } else {
        map.set(event, pruned);
      }
    };
    removeFromMap(this.hmrClient.customListenersMap);
    removeFromMap(this.newListeners);
  }

  send(event: string, data?: any): void {
    this.hmrClient.sendCustomEvent(event, data);
  }
}

/**
 * HMR客户端
 * 负责处理热更新消息
 */
class HMRClient {
  private socket: WebSocket | null = null;
  private isConnected = false;

  public hotModulesMap = new Map<string, HotModule>();
  public dataMap = new Map<string, any>();
  public disposeMap = new Map<string, (data: any) => void>();
  public pruneMap = new Map<string, (data: any) => void>();
  public customListenersMap = new Map<string, ((payload: any) => void)[]>();
  public ctxToListenersMap = new Map<
    string,
    Map<string, ((data: any) => void)[]>
  >();

  constructor() {}

  connect(): void {
    if (this.socket) {
      this.socket.close();
    }

    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const host = location.host;
    const socketUrl = `${protocol}://${host}/__hmr`;

    this.socket = new WebSocket(socketUrl);

    this.socket.addEventListener("open", () => {
      this.isConnected = true;
      logger.info("Connected to HMR server");
    });

    this.socket.addEventListener("message", ({ data }) => {
      try {
        const payload: HMRPayload = JSON.parse(data);
        this.handleMessage(payload);
      } catch (error) {
        logger.error(`Failed to parse HMR message: ${error}`);
      }
    });

    this.socket.addEventListener("close", () => {
      this.isConnected = false;
      logger.warn("HMR connection closed, attempting to reconnect...");
      setTimeout(() => this.connect(), 1000);
    });

    this.socket.addEventListener("error", (err) => {
      logger.error("HMR connection error");
      console.error(err);
    });
  }

  handleMessage(payload: HMRPayload): void {
    logger.info(`Received HMR message: ${payload.type}`);

    switch (payload.type) {
      case "connected":
        logger.info("HMR connection established");
        break;

      case "update":
        if (payload.updates && payload.updates.length > 0) {
          this.fetchUpdate(payload.updates)
            .then((callback) => {
              if (callback) {
                callback();
              }
            })
            .catch((err) => {
              logger.error(`Error processing update: ${err}`);
            });
        }
        break;

      case "full-reload":
        logger.info("Executing full reload");
        location.reload();

        break;

      case "prune": {
        if (payload.paths) {
          this.prunePaths(payload.paths);
        }
        break;
      }

      case "error": {
        if (payload.err) {
          logger.error(`HMR error: ${payload.err.message}`);
        }
        break;
      }
    }
  }

  async fetchUpdate(updates: Update[]): Promise<(() => void) | null> {
    const qualifiedCallbacks: ((data?: any) => void)[] = [];
    logger.info(`Processing ${updates.length} updates`);

    return () => {
      logger.info(`Executing ${qualifiedCallbacks.length} update callbacks`);
      for (const cb of qualifiedCallbacks) {
        try {
          cb();
        } catch (e) {
          logger.error(`${e}`);
          return;
        }
      }
    };
  }

  prunePaths(paths: string[]): void {
    logger.info(`Pruning paths: ${paths.join(", ")}`);
    paths.forEach((path) => {
      const fn = this.pruneMap.get(path);
      if (fn) {
        fn(this.dataMap.get(path));
      }
      this.hotModulesMap.delete(path);
      this.pruneMap.delete(path);
      this.disposeMap.delete(path);
      this.dataMap.delete(path);
    });
  }

  sendCustomEvent(event: string, data: any = null): void {
    if (this.socket && this.socket.readyState === 1) {
      this.socket.send(
        JSON.stringify({
          type: "custom",
          event,
          data,
        })
      );
    }
  }
}

// 单例HMR客户端
export const hmrClient = new HMRClient();

export function createHotContext(ownerPath: string): HotContext {
  return new HMRContext(hmrClient, ownerPath);
}

// 自动连接到HMR服务器
hmrClient.connect();

export function updateStyle(id: string, css: string, modulePath: string): void {
  logger.info(`Updating style: ${modulePath}`);
  let el = document.querySelector(`style[data-module-path="${modulePath}"]`);
  if (!el) {
    el = document.createElement("style");
    el.id = `vite-css-${id}`;
    el.setAttribute("type", "text/css");
    (el as HTMLElement).dataset.modulePath = modulePath;
    document.head.appendChild(el);
  }
  el.textContent = css;
}

export function removeStyle(id: string): void {
  logger.info(`Removing style: ${id}`);
  const el = document.querySelector(`style#vite-css-${id}`);
  if (el) {
    document.head.removeChild(el);
  }
}

export default {
  init: (port: number) => {
    logger.info(`HMR client initialized, port: ${port}`);
  },
  createHotContext,
  updateStyle,
  removeStyle,
};
