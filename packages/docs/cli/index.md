# CLI 命令参考

Lite Vite 提供 `lite-vite` 命令行工具，支持开发和构建两种模式。

## 安装

```bash
# 项目内安装（推荐）
pnpm add lite-vite -D

# 全局安装
pnpm add lite-vite -g
```

安装后可通过 `npx lite-vite` 或在 `package.json` scripts 中直接使用 `lite-vite`。

## lite-vite dev

启动开发服务器。这是默认命令——直接运行 `lite-vite` 等价于 `lite-vite dev`。

```bash
lite-vite dev [options]
```

### 选项

| 选项 | 说明 | 默认值 |
|---|---|---|
| `-p, --port <number>` | 指定服务器端口号 | `4000` |

### 示例

```bash
# 使用默认端口启动
lite-vite dev

# 指定端口
lite-vite dev -p 3000
lite-vite dev --port 8080

# 省略 dev 命令（默认行为）
lite-vite
lite-vite -p 3000
```

### 行为说明

1. 解析配置文件（如果存在）
2. 清屏（除非配置了 `clearScreen: false`）
3. 加载并初始化插件，触发 `configResolved` 钩子
4. 加载依赖缓存
5. 创建模块依赖图
6. 启动 HTTP 服务器
7. 启动 WebSocket HMR 服务
8. 启动文件监听（chokidar）
9. 输出服务器地址
10. 如果配置了 `server.open`，自动打开浏览器

## lite-vite build

构建生产产物。

```bash
lite-vite build [options]
```

### 选项

| 选项 | 说明 | 默认值 |
|---|---|---|
| `--no-optimize` | 禁用代码压缩优化 | 默认开启优化 |
| `-o, --output <path>` | 指定输出目录 | `dist` |
| `-f, --format <format>` | 指定输出格式 (`esm` 或 `cjs`) | `esm` |
| `-s, --sourcemap` | 启用 Source Map | `false` |

### 示例

```bash
# 默认构建
lite-vite build

# 输出到指定目录
lite-vite build -o build

# CJS 格式输出
lite-vite build -f cjs

# 启用 Source Map
lite-vite build -s

# 禁用压缩
lite-vite build --no-optimize

# 组合选项
lite-vite build -o dist -f esm -s
```

### 构建流程

1. 解析配置文件
2. 清屏
3. 加载并初始化插件，触发 `configResolved` 钩子
4. 触发插件 `buildStart` 钩子
5. 清空输出目录
6. 解析 HTML 入口，提取 JS 入口文件
7. 配置 Rollup 并执行打包
8. 更新 HTML 中的脚本引用
9. 复制 `public/` 目录到输出目录
10. 触发插件 `writeBundle` 和 `buildEnd` 钩子
11. 输出构建结果和产物列表
12. 生成构建分析报告

## 全局选项

| 选项 | 说明 |
|---|---|
| `-v, --version` | 输出版本号 |
| `--help` | 显示帮助信息 |

```bash
lite-vite --version
lite-vite --help
lite-vite help dev
lite-vite help build
```

## 在 package.json 中使用

推荐在 `package.json` 中配置脚本：

```json
{
  "scripts": {
    "dev": "lite-vite dev",
    "build": "lite-vite build",
    "build:prod": "lite-vite build -s"
  }
}
```

然后通过 pnpm 运行：

```bash
pnpm dev
pnpm build
pnpm build:prod
```

如果需要向 CLI 传递额外参数，使用 `--` 分隔：

```bash
pnpm dev -- -p 3000
```

## 信号处理

开发服务器监听 `SIGINT` 信号（Ctrl+C），收到信号后会优雅退出并输出退出提示。
