# 项目介绍

## Lite Vite 是什么

Lite Vite 是一个**下一代轻量级前端构建工具**，利用浏览器原生 ES Module 支持，为开发者提供极速的开发体验和高效的生产构建能力。

与 webpack 等传统打包工具不同，Lite Vite 在开发阶段**完全不打包**——它直接启动一个开发服务器，按需编译浏览器请求的每一个模块。这意味着无论项目有多大，启动速度始终保持在秒级。

## 核心理念

### 开发阶段：不打包，按需编译

传统构建工具（如 webpack）在开发时必须先构建完整的依赖图、打包所有模块，然后才能启动开发服务器。项目越大，冷启动越慢。

Lite Vite 的策略截然不同：

1. **即时启动** —— 直接启动 HTTP 服务器，不做任何预处理
2. **按需转换** —— 浏览器请求某个模块时，才对它进行编译（如 TS → JS、Vue SFC → JS）
3. **原生 ESM** —— 利用浏览器的 `<script type="module">` 原生支持，由浏览器自行加载模块依赖

### 生产阶段：Rollup 打包

虽然原生 ESM 在开发阶段体验极佳，但在生产环境中，大量细粒度的模块请求会影响加载性能。因此 Lite Vite 在生产构建时使用 Rollup 进行打包，天然支持 tree-shaking，生成更小更优的产物。

## 项目架构

Lite Vite 采用 **pnpm Monorepo** 架构，由以下四个包协作组成：

```
@lite-vite/monorepo
├── lite-vite              # 核心构建工具（开发服务器 + 生产构建）
├── create-lite-vite       # 项目脚手架（交互式创建项目）
├── @lite-vite/shared      # 共享工具库（日志、文件操作、MIME 类型）
└── @lite-vite/eslint-config # ESLint 预设配置
```

### 各包职责

| 包 | 描述 | npm 包名 |
|---|---|---|
| **lite-vite** | 核心构建工具，提供 `dev` 开发服务器和 `build` 生产构建 | `lite-vite` |
| **create-lite-vite** | 脚手架 CLI，通过 `pnpm create lite-vite` 交互式创建项目 | `create-lite-vite` |
| **@lite-vite/shared** | 共享工具函数，包含日志系统、文件操作、MIME 类型映射等 | `@lite-vite/shared` |
| **@lite-vite/eslint-config** | 统一的 ESLint 配置预设，覆盖 TS/Vue/JSON/Markdown | `@lite-vite/eslint-config` |

## 技术栈

| 用途 | 技术 |
|---|---|
| 包管理 | pnpm workspace |
| 源码构建 | tsup |
| 依赖预打包 | esbuild |
| 生产打包 | Rollup |
| TS 开发转译 | esbuild |
| Vue SFC 编译 | @vue/compiler-sfc |
| 文件监听 | chokidar |
| HMR 通信 | WebSocket (ws) |
| 模块分析 | es-module-lexer |
| 代码重写 | magic-string |

## 适用场景

Lite Vite 适合用于：

- **前端应用开发** —— 支持 HTML 入口、JS/TS、Vue SFC、CSS、图片等资源
- **Vue 3 项目** —— 内置 Vue 单文件组件支持，开箱即用
- **快速原型开发** —— 秒级启动，即时反馈
- **学习前端工程化** —— 代码精简，适合阅读学习现代构建工具原理

## 系统要求

- **Node.js** >= 18
- **pnpm**（推荐）/ npm / yarn
