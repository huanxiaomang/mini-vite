# Lite Vite

**下一代轻量级前端构建工具** —— 基于原生 ESM 的极速开发体验，告别 webpack 时代的漫长等待。

## 特性

- **⚡ 秒级冷启动** —— 无需打包整个项目，开发服务器即启即用，与项目大小无关
- **🔥 即时热更新** —— 基于模块依赖图的精准 HMR，CSS/JS/Vue 组件修改毫秒级生效
- **📦 自动依赖预打包** —— esbuild 极速预编译第三方依赖，全自动零配置
- **🛠️ 开箱即用** —— 内置 TypeScript、Vue SFC、CSS、图片处理，无需繁琐 loader 配置
- **🎯 轻量生产构建** —— 基于 Rollup 打包，天然 tree-shaking，产物更精简
- **📊 构建分析报告** —— 可视化体积分析、重复依赖检测、历史对比与优化建议

## 快速开始

### 使用脚手架创建项目

```bash
pnpm create lite-vite@latest
```

提供两种项目模板：

- **vanilla-js-template** —— 纯 JavaScript 项目
- **vue3-ts-template** —— Vue 3 + TypeScript 项目

### 启动开发

```bash
cd your-project
pnpm install
pnpm dev
```

### 构建生产产物

```bash
pnpm build
```

### 在已有项目中使用

```bash
pnpm add lite-vite -D
```

配置 npm scripts：

```json
{
  "scripts": {
    "dev": "lite-vite dev",
    "build": "lite-vite build"
  }
}
```

## CLI 命令

```bash
# 启动开发服务器
lite-vite dev              # 默认端口 4000
lite-vite dev -p 3000      # 指定端口

# 生产构建
lite-vite build            # 默认构建
lite-vite build -o dist    # 指定输出目录
lite-vite build -f cjs     # CJS 格式输出
lite-vite build -s         # 启用 Source Map
lite-vite build --no-optimize  # 禁用压缩

# 帮助
lite-vite --version
lite-vite --help
```

## 配置文件

在项目根目录创建 `lite.config.ts`（可选）：

```ts
import { defineLiteConfig } from 'lite-vite'

export default defineLiteConfig({
  server: {
    port: 3000,
    open: true,
  },
  build: {
    minify: true,
    sourcemap: true,
  },
  plugins: [],
})
```

支持的配置文件格式：`lite.config.ts` / `lite.config.js` / `lite.config.mjs` / `lite.config.cjs`

## 包列表

本项目采用 pnpm monorepo 架构：

| 包 | 描述 | 版本 |
|---|---|---|
| [`lite-vite`](./packages/lite-vite) | 核心构建工具（开发服务器 + 生产构建） | 2.0.1 |
| [`create-lite-vite`](./packages/create-vite) | 项目脚手架 CLI | 2.0.5 |
| [`@lite-vite/shared`](./packages/shared) | 共享工具库（日志、文件操作、MIME） | 1.0.0 |
| [`@lite-vite/eslint-config`](./packages/eslint-config) | ESLint 预设配置 | 0.0.1 |

## 已实现功能

- ✅ CLI 命令行工具（dev / build）
- ✅ HTML 入口自动识别与处理
- ✅ JavaScript / TypeScript 支持（esbuild 即时转译）
- ✅ Vue 3 单文件组件支持（script setup / scoped CSS）
- ✅ CSS 处理与热更新
- ✅ 静态资源处理（PNG / JPG / SVG）
- ✅ 依赖预打包（esbuild）与缓存机制
- ✅ 扩展名自动补全
- ✅ Source Map 支持
- ✅ 基于 WebSocket 的 HMR（CSS / JS / Vue / HTML）
- ✅ 模块依赖图与 BFS 更新传播
- ✅ Rollup 生产构建
- ✅ 代码压缩（esbuild minify）
- ✅ public 目录静态资源复制
- ✅ 可视化构建分析报告
- ✅ 构建历史对比
- ✅ 插件系统（transform / buildStart / writeBundle / buildEnd / configResolved）
- ✅ 脚手架工具（create-lite-vite）
- ✅ ESLint 预设配置

## 文档

完整文档请查看 [`packages/docs`](./packages/docs)。

```bash
cd packages/docs
pnpm install
pnpm dev
```

## 技术栈

| 用途 | 技术 |
|---|---|
| 包管理 | pnpm workspace |
| 源码构建 | tsup |
| 依赖预打包 | esbuild |
| 生产打包 | Rollup |
| Vue SFC 编译 | @vue/compiler-sfc |
| 文件监听 | chokidar |
| HMR 通信 | WebSocket (ws) |
| 模块分析 | es-module-lexer |
| 代码重写 | magic-string |
| 文档 | VitePress |

## 开发

```bash
# 克隆项目
git clone https://github.com/huanxiaomang/mini-vite.git
cd mini-vite

# 安装依赖
pnpm install

# 构建所有包
pnpm build

# 在测试项目中使用（通过 npm link）
cd packages/lite-vite && pnpm dev
```

### 项目结构

```
mini-vite/
├── packages/
│   ├── lite-vite/         # 核心构建工具
│   ├── create-vite/       # 脚手架工具
│   ├── shared/            # 共享工具库
│   ├── eslint-config/     # ESLint 配置
│   └── docs/              # 文档站点（VitePress）
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.json
```

## 系统要求

- Node.js >= 18
- pnpm（推荐）

## License

[ISC](./LICENSE)
