# 项目架构

Lite Vite 采用 **pnpm Monorepo** 架构，由 6 个包协作组成完整的工具链。本页详细讲解每个包的职责以及它们之间的依赖和协作关系。

## 架构全景图

```
@lite-vite/monorepo
│
├── @lite-vite/shared          🧱 基础层：共享工具库
│     ↑ 被所有其他包依赖
│
├── @lite-vite/report          📊 分析层：构建报告生成
│     ↑ 依赖 shared
│     ↑ 被 lite-vite 依赖
│
├── lite-vite                  ⚡ 核心层：构建工具
│     ↑ 依赖 shared + report
│
├── create-lite-vite           🏗️ 脚手架层：项目创建
│     ↑ 依赖 shared
│
├── @lite-vite/eslint-config   📏 规范层：代码规范
│     独立，无内部依赖
│
└── @lite-vite/docs            📖 文档层：VitePress 文档站
      独立，无内部依赖
```

## 依赖关系图

```
┌──────────────────┐     ┌──────────────────┐
│  create-lite-vite │     │ @lite-vite/docs  │
│   (脚手架 CLI)    │     │  (VitePress 文档) │
└────────┬─────────┘     └──────────────────┘
         │
         │ depends on
         ▼
┌──────────────────┐     ┌──────────────────────┐
│ @lite-vite/shared │◄────│  @lite-vite/report   │
│   (共享工具库)    │     │  (构建分析报告 CLI)   │
└────────▲─────────┘     └──────────▲───────────┘
         │                          │
         │ depends on               │ depends on
         │                          │
         └──────────┐  ┌────────────┘
                    │  │
              ┌─────┴──┴─────┐
              │   lite-vite   │
              │  (核心构建工具) │
              └──────────────┘
```

## 各包详解

### @lite-vite/shared — 共享工具库

**角色**：基础层，提供所有包复用的工具函数。

| 模块 | 功能 |
|---|---|
| `logger.ts` | 分级日志系统（debug/info/warn/error），基于 picocolors 着色 |
| `file.ts` | 文件操作（`fileExists`/`copyFiles`/`hasFolder`/`normalize`） |
| `mime.ts` | MIME 类型映射、文件扩展名分类 |
| `index.ts` | 类型守卫（`isObject`/`isFunction`） |

**被谁依赖**：`lite-vite`、`create-lite-vite`、`@lite-vite/report`

**设计原则**：只包含纯工具函数，不依赖任何业务逻辑，不依赖其他内部包。

---

### @lite-vite/report — 构建分析报告

**角色**：分析层，提供构建产物分析和可视化报告生成。

**两种使用方式**：

1. **作为库被 lite-vite 调用**：
   ```ts
   import { generateReport } from '@lite-vite/report'
   // lite-vite build 完成后自动调用
   await generateReport(outputDir, files, buildTimeMs, entry, format)
   ```

2. **作为独立 CLI 工具**：
   ```bash
   # 分析任意构建产物目录
   npx lite-report dist

   # 指定入口和格式
   npx lite-report dist -e index.html -f esm

   # 指定报告输出位置
   npx lite-report dist -o ./reports
   ```

| 模块 | 功能 |
|---|---|
| `cli.ts` | CLI 入口，使用 commander 解析命令参数 |
| `analyze.ts` | 目录扫描，递归收集文件信息，构造 FileInfo 数组 |
| `data.ts` | 数据处理：重复依赖检测、优化建议、构建历史管理、diff 计算 |
| `html.ts` | HTML 报告生成（体积图表、模块分析、网络模拟等可视化） |
| `types.ts` | TypeScript 类型定义 |
| `utils.ts` | 工具函数（体积格式化、gzip/brotli 估算、文件分类） |

**依赖**：`@lite-vite/shared`

---

### lite-vite — 核心构建工具

**角色**：核心层，提供开发服务器和生产构建的完整能力。

这是整个工具链的核心，分为两大模式：

#### 开发模式 (`lite-vite dev`)

```
CLI 入口 (cli.ts)
  ↓
加载配置 (options.ts) → 合并 CLI 参数 + 配置文件
  ↓
创建开发服务器 (server.ts)
  ├─ HTTP 请求拦截与转换
  │   └─ 插件 transform 管道 (plugins/)
  │       ├─ html-loader → 注入 HMR 脚本
  │       ├─ css-loader  → CSS 转 JS 模块
  │       ├─ vue-loader  → SFC 编译
  │       ├─ js-loader   → 导入路径重写
  │       ├─ ts-loader   → esbuild 转译
  │       └─ image-loader → 图片处理
  ├─ 模块依赖图 (moduleGraph.ts)
  ├─ HMR WebSocket 服务 (hmr.ts)
  ├─ 依赖预打包 (prebundle.ts + cache.ts)
  └─ 导入重写 (imports.ts)
```

#### 构建模式 (`lite-vite build`)

```
CLI 入口 (cli.ts)
  ↓
加载配置 (options.ts)
  ↓
Rollup 打包 (build.ts + rollup.ts)
  ├─ @rollup/plugin-node-resolve
  ├─ @rollup/plugin-replace
  ├─ rollup-plugin-vue
  ├─ rollup-plugin-postcss
  ├─ rollup-plugin-typescript2
  ├─ @rollup/plugin-image
  └─ 用户自定义插件（适配层）
  ↓
HTML 入口更新 (utils/scripts.ts)
  ↓
public/ 目录复制
  ↓
生成构建报告 (@lite-vite/report)
```

**依赖**：`@lite-vite/shared`、`@lite-vite/report`

---

### create-lite-vite — 项目脚手架

**角色**：脚手架层，提供交互式项目创建体验。

```
pnpm create lite-vite
  ↓
prompts 交互选择
  ├─ 输入项目名称
  └─ 选择模板 (vanilla-js / vue3-ts)
  ↓
从内置模板目录复制文件到目标路径
  ↓
输出成功提示和后续命令
```

| 模块 | 功能 |
|---|---|
| `index.ts` | CLI 入口，交互式提问 |
| `clone.ts` | 模板文件复制 |
| `constants.ts` | 模板选项和引导命令 |
| `plugins/copyTemplate.ts` | tsup 构建插件，打包时自动复制模板 |
| `template/` | 项目模板文件（vanilla-js + vue3-ts） |

**依赖**：`@lite-vite/shared`

**特殊构建方式**：使用 tsup 的 esbuild 插件在构建时将 `template/` 目录复制到 `dist/`，这样 `create-lite-vite` 发布后模板文件会包含在 npm 包中。

---

### @lite-vite/eslint-config — ESLint 预设

**角色**：规范层，提供统一的代码规范配置。

覆盖 TypeScript、Vue、JSON、Markdown、import 排序、Prettier 集成，以及 unicorn 最佳实践规则。

**无内部依赖**——这是一个完全独立的配置包。

---

### @lite-vite/docs — 文档站点

**角色**：文档层，使用 VitePress 构建的文档站点。

**无内部依赖**——文档内容通过 Markdown 编写，不引用其他内部包的代码。

通过 Netlify 自动部署。

---

## 构建顺序

由于包之间存在依赖关系，构建顺序很重要：

```bash
pnpm run build
```

执行顺序：

```
1. @lite-vite/shared      # 基础层，无依赖，最先构建
      ↓
2. @lite-vite/report      # 分析层，依赖 shared
      ↓
3. lite-vite              # 核心层，依赖 shared + report
      ↓
4. create-lite-vite       # 脚手架层，依赖 shared
```

`@lite-vite/eslint-config` 和 `@lite-vite/docs` 不参与主构建流程。

## 数据流

一次完整的开发 → 构建 → 分析流程：

```
开发者创建项目              分析构建产物
   │                          ▲
   ▼                          │
create-lite-vite          @lite-vite/report
   │                          ▲
   │ 生成项目                  │ 生成报告
   ▼                          │
项目目录                   lite-vite build
   │                          ▲
   │ 开发                     │ 构建
   ▼                          │
lite-vite dev ────────────────┘
   │
   │ 所有包共用
   ▼
@lite-vite/shared (日志、文件操作、MIME)
```

## pnpm Workspace 配置

```yaml
# pnpm-workspace.yaml
packages:
  - packages/*
```

所有包都在 `packages/` 目录下，通过 `workspace:*` 协议引用内部依赖，pnpm 自动建立符号链接。
