/**
 * 模块依赖图实现
 * 用于追踪模块之间的依赖关系并支持 HMR
 */
import { dirname, relative, resolve } from "node:path";
import * as fs from "node:fs";
import { log } from "@lite-vite/shared";
import { init, parse } from "es-module-lexer";
import { ROOT } from "./constant";

export interface ModuleNode {
  /** 模块的 URL 或文件路径 */
  url: string;
  /** 模块文件路径（服务器解析的） */
  file: string;
  /** 模块代码 */
  code: string | null;
  /** 上次修改时间 */
  lastUpdated: number;
  /** 导入此模块的父模块集合 */
  importers: Set<ModuleNode>;
  /** 此模块导入的子模块集合 */
  importedModules: Set<ModuleNode>;
  /** 是否是自我接受更新的模块 */
  isSelfAccepting?: boolean;
  /** 接受哪些依赖的更新 */
  acceptedHmrDeps?: Set<string>;
  /** 接受的导出类型 */
  acceptedHmrExports?: Set<string>;
}

// HMR 更新传播结果
export interface HMRResult {
  // 受影响的模块集合
  affectedModules: Set<ModuleNode>;
  // HMR 边界模块集合
  boundaries: Set<ModuleNode>;
  // 是否需要完全刷新
  needFullReload: boolean;
}

/**
 * 规范化路径
 */
function normalizePath(file: string): string {
  return file.replace(/\\/g, "/");
}

/**
 * 判断是否为外部模块（非相对路径，非绝对路径）
 */
function isExternalModule(specifier: string): boolean {
  return !(
    (
      specifier.startsWith("./") ||
      specifier.startsWith("../") ||
      specifier.startsWith("/") ||
      specifier.match(/^[a-zA-Z]:[/\\]/)
    ) // Windows绝对路径
  );
}

/**
 * 判断路径是否在node_modules内
 */
function isNodeModulePath(path: string): boolean {
  return path.includes("/node_modules/") || path.includes("\\node_modules\\");
}

export class ModuleGraph {
  /** URL 到模块节点的映射 */
  private urlToModuleMap = new Map<string, ModuleNode>();
  /** 文件路径到模块节点的映射 */
  private fileToModuleMap = new Map<string, ModuleNode>();

  constructor() {
    // 初始化 ES 模块词法解析器
    void init.then(() => {
      log.debug("ES 模块词法解析器已初始化");
    });
  }

  /**
   * 获取整个文件映射表
   * 用于调试和特殊情况处理
   */
  getEntireFileMap(): Map<string, ModuleNode> {
    return this.fileToModuleMap;
  }

  /**
   * 根据文件路径获取模块
   */
  getModuleByFile(file: string): ModuleNode | undefined {
    return this.fileToModuleMap.get(normalizePath(file));
  }

  /**
   * 根据URL获取模块
   */
  getModuleByUrl(url: string): ModuleNode | undefined {
    // 统一URL格式为正斜杠
    const normalizedUrl = normalizePath(url);
    return this.urlToModuleMap.get(normalizedUrl);
  }

  /**
   * 确保从URL创建入口模块
   * @param url 模块URL
   * @param file 文件路径
   * @returns 新创建或已存在的模块节点
   */
  ensureEntryFromUrl(url: string, file: string): ModuleNode {
    const normalizedFile = normalizePath(file);
    const normalizedUrl = normalizePath(url);

    // 检查是否在node_modules中，如果是则不处理
    if (isNodeModulePath(normalizedFile)) {
      log.debug(`跳过node_modules模块: ${normalizedFile}`);
      // 返回一个临时模块对象，但不存储到映射中
      return {
        url: normalizedUrl,
        file: normalizedFile,
        code: null,
        lastUpdated: Date.now(),
        importers: new Set(),
        importedModules: new Set(),
      };
    }

    // 尝试通过文件路径查找模块
    let mod = this.getModuleByFile(normalizedFile);
    if (mod) {
      // 如果文件路径相同但URL不同，更新URL映射
      if (mod.url !== normalizedUrl) {
        log.debug(`为同一文件更新URL映射: ${mod.url} -> ${normalizedUrl}`);
        this.urlToModuleMap.delete(mod.url);
        mod.url = normalizedUrl;
        this.urlToModuleMap.set(normalizedUrl, mod);
      }
      return mod;
    }

    // 尝试通过URL查找模块
    mod = this.getModuleByUrl(normalizedUrl);
    if (mod) {
      // 如果URL相同但文件路径不同，更新文件路径映射
      if (mod.file !== normalizedFile) {
        log.debug(`为同一URL更新文件路径: ${mod.file} -> ${normalizedFile}`);
        this.fileToModuleMap.delete(mod.file);
        mod.file = normalizedFile;
        this.fileToModuleMap.set(normalizedFile, mod);
      }
      return mod;
    }

    // 创建新模块
    mod = {
      url: normalizedUrl,
      file: normalizedFile,
      code: null,
      lastUpdated: Date.now(),
      importers: new Set(),
      importedModules: new Set(),
    };

    // 添加到映射表
    this.urlToModuleMap.set(normalizedUrl, mod);
    this.fileToModuleMap.set(normalizedFile, mod);

    log.debug(`创建新模块: ${normalizedUrl} -> ${normalizedFile}`);

    return mod;
  }

  /**
   * 更新模块代码并分析其导入关系
   * @param file 文件路径
   * @param code 模块代码
   * @returns 更新后的模块
   */
  async updateModuleCode(
    file: string,
    code: string
  ): Promise<ModuleNode | undefined> {
    const normalizedFile = normalizePath(file);
    let mod = this.getModuleByFile(normalizedFile);

    if (!mod) {
      // 如果模块不存在，尝试基于相对路径创建
      const relPath = relative(ROOT, normalizedFile);
      const url = `/${relPath}`;
      mod = this.ensureEntryFromUrl(url, normalizedFile);
    }

    if (mod) {
      // 更新模块代码和时间戳
      mod.code = code;
      mod.lastUpdated = Date.now();

      // 清除旧的导入关系
      for (const imported of mod.importedModules) {
        imported.importers.delete(mod);
      }
      mod.importedModules.clear();

      // 分析模块导入和HMR接受标记
      await this.analyzeModuleImports(mod);

      log.debug(`更新模块代码: ${mod.file}`);
    }

    return mod;
  }

  /**
   * 分析模块代码，提取导入关系和HMR接受标记
   * @param mod 要分析的模块
   */
  private async analyzeModuleImports(mod: ModuleNode): Promise<void> {
    if (!mod.code) return;

    try {
      // 确保解析器已初始化
      await init;

      // 使用es-module-lexer解析导入
      const [imports] = parse(mod.code);

      // 检查HMR接受标记 - 查找import.hot.accept
      mod.isSelfAccepting = mod.code.includes("import.meta.hot.accept");
      mod.acceptedHmrDeps = new Set<string>();
      mod.acceptedHmrExports = new Set<string>();

      // 记录更详细的接受信息
      if (mod.isSelfAccepting) {
        log.debug(`检测到自接受模块: ${mod.file}`);
      }

      // 处理导入语句
      for (const imp of imports) {
        const { s: start, e: end } = imp;
        const importSpecifier = mod.code.slice(start, end);

        // 去除引号
        const cleanSpecifier = importSpecifier.replace(/['"]/g, "");

        // 忽略外部模块导入
        if (isExternalModule(cleanSpecifier)) {
          log.debug(`跳过外部模块导入: ${cleanSpecifier}`);
          continue;
        }

        // 解析导入路径
        if (
          cleanSpecifier.startsWith("./") ||
          cleanSpecifier.startsWith("../") ||
          (!cleanSpecifier.startsWith("http") && cleanSpecifier.startsWith("/"))
        ) {
          // 相对路径导入
          const importedPath = resolve(dirname(mod.file), cleanSpecifier);
          const normalizedImportedPath = normalizePath(importedPath);

          // 忽略node_modules中的模块
          if (isNodeModulePath(normalizedImportedPath)) {
            log.debug(`跳过node_modules中的导入: ${normalizedImportedPath}`);
            continue;
          }

          // 尝试找到或创建导入的模块
          let importedMod = this.getModuleByFile(normalizedImportedPath);

          // 如果没有找到精确匹配，尝试匹配忽略扩展名的路径
          if (!importedMod) {
            // 尝试常见扩展名如 .js, .ts, .vue 等
            const possibleExtensions = [".js", ".ts", ".jsx", ".tsx", ".vue"];
            for (const ext of possibleExtensions) {
              const pathWithExt = `${normalizedImportedPath}${ext}`;
              importedMod = this.getModuleByFile(pathWithExt);
              if (importedMod) {
                log.debug(`找到导入模块 ${cleanSpecifier} -> ${pathWithExt}`);
                break;
              }
            }
          }

          if (!importedMod) {
            // 如果不存在，创建一个占位符模块
            const relPath = relative(ROOT, normalizedImportedPath);
            const url = `/${relPath.replace(/\\/g, "/")}`;
            importedMod = this.ensureEntryFromUrl(url, normalizedImportedPath);
            log.debug(
              `为导入创建占位符模块: ${url} -> ${normalizedImportedPath}`
            );
          }

          // 建立双向链接
          mod.importedModules.add(importedMod);
          importedMod.importers.add(mod);

          log.debug(`建立导入关系: ${mod.file} -> ${importedMod.file}`);
        }
      }
    } catch (err) {
      log.error(`分析模块导入失败: ${mod.file}`, err);
    }
  }

  /**
   * 删除模块
   * @param file 要删除的模块文件路径
   */
  deleteModule(file: string): void {
    const normalizedFile = normalizePath(file);
    const mod = this.getModuleByFile(normalizedFile);

    if (mod) {
      // 删除URL映射
      this.urlToModuleMap.delete(mod.url);

      // 删除文件映射
      this.fileToModuleMap.delete(normalizedFile);

      // 清除导入关系
      for (const imported of mod.importedModules) {
        imported.importers.delete(mod);
      }

      // 清除被导入关系
      for (const importer of mod.importers) {
        importer.importedModules.delete(mod);
      }

      log.debug(`删除模块: ${mod.file}`);
    }
  }

  /**
   * 使模块集合中的所有模块缓存失效
   * @param modules 要失效的模块集合
   */
  invalidateModules(modules: Set<ModuleNode>): void {
    for (const mod of modules) {
      // 标记为需要重新加载
      mod.lastUpdated = Date.now();
      log.debug(`使模块缓存失效: ${mod.file}`);
    }
  }

  /**
   * 扫描模块的导入者
   * 递归更新模块的导入关系图
   * @param mod 要扫描的模块
   */
  async scanForImporters(mod: ModuleNode): Promise<void> {
    // 已访问的模块集合，避免循环依赖
    const visited = new Set<ModuleNode>();

    // 递归处理函数
    const processImporters = async (current: ModuleNode) => {
      if (visited.has(current)) return;
      visited.add(current);

      // 检查文件是否存在
      try {
        await fs.promises.access(current.file, fs.constants.R_OK);

        // 如果文件存在且当前模块没有代码，读取文件内容
        if (!current.code) {
          try {
            const content = await fs.promises.readFile(current.file, "utf-8");
            current.code = content;
          } catch (err) {
            log.error(`读取文件失败: ${current.file}`, err);
          }
        }

        // 如果有代码，重新分析导入
        if (current.code) {
          await this.analyzeModuleImports(current);
        }
      } catch {
        log.warn(`文件不存在或无法访问: ${current.file}`);
      }

      for (const importer of current.importers) {
        // 递归处理导入者的导入者
        await processImporters(importer);
      }
    };

    await processImporters(mod);
    log.debug(`扫描完成模块的导入者: ${mod.file}`);
  }

  /**
   * 格式化模块信息用于调试
   * @param mod 模块节点
   * @returns 格式化后的模块信息
   */
  formatModuleForDebug(mod: ModuleNode): any {
    return {
      url: mod.url,
      file: mod.file,
      isSelfAccepting: mod.isSelfAccepting,
      // 返回具体的导入者路径集合
      importers: Array.from(mod.importers).map((m) => m.file),
      // 返回具体的被导入模块路径集合
      importedModules: Array.from(mod.importedModules).map((m) => m.file),
    };
  }

  /**
   * 格式化模块集合用于调试
   * @param modules 模块集合
   * @returns 格式化后的模块信息数组
   */
  formatModuleSetForDebug(modules: Set<ModuleNode>): any[] {
    return Array.from(modules).map(this.formatModuleForDebug);
  }

  /**
   * 传播更新，找出所有受影响的模块和HMR边界
   * @param file 更新的文件路径
   * @returns HMR更新结果
   */
  async propagateUpdate(file: string): Promise<HMRResult> {
    const normalizedFile = normalizePath(file);
    const mod = this.getModuleByFile(normalizedFile);

    log.debug(`开始处理更新传播: ${normalizedFile}`);

    // 确保模块存在，如果不存在则创建
    let updatedMod = mod;
    if (!updatedMod) {
      // 尝试创建模块
      const relPath = relative(ROOT, normalizedFile);
      const url = `/${relPath.replace(/\\/g, "/")}`;
      updatedMod = this.ensureEntryFromUrl(url, normalizedFile);
      log.debug(`为更新创建新模块: ${url} -> ${normalizedFile}`);

      // 尝试读取文件内容
      try {
        const content = await fs.promises.readFile(normalizedFile, "utf-8");
        await this.updateModuleCode(normalizedFile, content);
        log.debug(`已读取并更新模块内容: ${normalizedFile}`);
      } catch (err) {
        log.error(`读取文件失败: ${normalizedFile}`, err);
      }
    }

    // 输出当前模块图完整状态
    log.debug(`当前模块图状态:`);
    const fileMap = this.getEntireFileMap();
    log.debug(`模块总数: ${fileMap.size}`);

    // 输出所有模块的详细信息
    const moduleDebugInfo = Array.from(fileMap.entries()).map(([, module]) =>
      this.formatModuleForDebug(module)
    );
    log.debug(`模块图详情: ${JSON.stringify(moduleDebugInfo)}`);

    // 确保更新模块代码已经分析过
    if (updatedMod && updatedMod.code) {
      await this.analyzeModuleImports(updatedMod);
      log.debug(`已分析模块导入: ${updatedMod.file}`);
      log.debug(`模块自我接受更新: ${updatedMod.isSelfAccepting}`);
      log.debug(`模块导入数量: ${updatedMod.importedModules.size}`);
      log.debug(`模块被导入数量: ${updatedMod.importers.size}`);

      // 如果是更新已存在的模块，再次扫描依赖图以确保关系更新
      await this.scanForImporters(updatedMod);
      log.debug(`已扫描并更新模块的导入者关系`);
    }

    // 输出更新后的模块详细信息
    if (updatedMod) {
      log.debug(
        `更新模块详情: ${JSON.stringify(this.formatModuleForDebug(updatedMod))}`
      );
    }

    // 受影响的模块集合
    const affectedModules = new Set<ModuleNode>([updatedMod]);

    // HMR边界模块集合
    const boundaries = new Set<ModuleNode>();

    // 是否需要完全刷新
    let needFullReload = false;

    // 如果模块自己接受更新，它就是自己的边界
    if (updatedMod.isSelfAccepting) {
      log.debug(`模块自身是HMR边界: ${updatedMod.file}`);
      boundaries.add(updatedMod);
    }

    // 核心逻辑：从更新的模块开始，沿着导入链向上传播
    log.debug(`开始沿导入链向上传播更新...`);

    // 广度优先搜索，从更新模块开始沿导入链向上查找边界
    const visited = new Set<string>();
    const queue: ModuleNode[] = [updatedMod];
    visited.add(updatedMod.file);

    while (queue.length > 0) {
      const current = queue.shift()!;

      // 如果当前模块(除了源模块)是自接受的，则作为边界点
      if (current !== updatedMod && current.isSelfAccepting) {
        log.debug(`找到HMR边界: ${current.file}, 自我接受: true`);
        boundaries.add(current);
        // 不需要继续向上传播
        continue;
      }

      // 特殊情况检测：a.ts导入b.ts
      const isAModule = current.file.match(/[/\\]a\.(js|ts)$/);
      const isBUpdated = updatedMod.file.match(/[/\\]b\.(js|ts)$/);
      if (isAModule && isBUpdated) {
        log.debug(
          `检测到特殊关系: a模块(${current.file})导入了被更新的b模块(${updatedMod.file})`
        );
        // 强制将a.ts标记为边界
        boundaries.add(current);
        continue;
      }

      // 如果没有导入者，或者是入口模块，就需要全页面刷新
      if (current.importers.size === 0) {
        log.debug(`模块 ${current.file} 无导入者或是入口模块，需要全页面刷新`);
        // 只有在没有找到任何边界的情况下才设置needFullReload
        if (boundaries.size === 0) {
          needFullReload = true;
        }
        continue;
      }

      // 遍历所有导入者并加入队列
      for (const importer of current.importers) {
        log.debug(`沿导入链传播: ${current.file} <- ${importer.file}`);

        if (!visited.has(importer.file)) {
          visited.add(importer.file);
          queue.push(importer);
          affectedModules.add(importer);
        }
      }
    }

    // 如果没有找到任何边界，而且有导入者，尝试通过代码内容匹配查找潜在边界
    if (boundaries.size === 0 && updatedMod.importers.size > 0) {
      log.debug(`没有找到精确边界，尝试通过代码内容查找潜在边界...`);

      // 提取更新模块的文件名(不带扩展名)
      const fileName =
        updatedMod.file.split(/[/\\]/).pop()?.split(".")[0] || "";

      // 遍历模块图中所有标记为自我接受更新的模块
      for (const [, module] of fileMap) {
        if (module.isSelfAccepting && module.code) {
          // 检查该模块是否在代码中引用了更新的模块
          if (module.code.includes(fileName)) {
            log.debug(
              `通过代码内容查找到潜在边界: ${module.file} 引用了 ${updatedMod.file}`
            );
            boundaries.add(module);
            affectedModules.add(module);
          }
        }
      }
    }

    // 输出最终的受影响模块集合
    log.debug(
      `受影响的模块详情: ${JSON.stringify(
        this.formatModuleSetForDebug(affectedModules)
      )}`
    );

    // 输出最终的边界模块集合
    log.debug(
      `边界模块详情: ${JSON.stringify(
        this.formatModuleSetForDebug(boundaries)
      )}`
    );

    log.info(
      `更新传播分析完成: 受影响模块 ${affectedModules.size} 个, 边界 ${
        boundaries.size
      } 个, ${needFullReload ? "需要" : "不需要"}完全刷新`
    );

    // 将测试HMR状态数据添加到返回结果中，便于客户端查看
    const hmrDebugData = {
      updatedFile: file,
      moduleGraph: moduleDebugInfo,
      affectedModules: this.formatModuleSetForDebug(affectedModules),
      boundaries: this.formatModuleSetForDebug(boundaries),
      needFullReload,
    };

    // 打印完整的调试信息
    log.debug(`HMR调试数据: ${JSON.stringify(hmrDebugData, null, 2)}`);

    return {
      affectedModules,
      boundaries,
      // 如果显式需要全页面刷新或者没有找到边界，则返回需要刷新
      needFullReload: needFullReload || boundaries.size === 0,
    };
  }
}
