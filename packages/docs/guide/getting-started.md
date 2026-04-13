# 快速开始

## 环境要求

- **Node.js** 版本 >= 18
- **pnpm**（推荐）、npm 或 yarn

## 使用脚手架创建项目

最快的方式是使用 `create-lite-vite` 脚手架：

```bash
# 使用 pnpm
pnpm create lite-vite@latest

# 使用 npm
npm create lite-vite@latest
```

脚手架会引导你完成以下步骤：

1. **输入项目名称** —— 输入 `.` 可以直接在当前目录创建
2. **选择项目模板** —— 目前提供两个模板：
   - `vanilla-js-template` —— 纯 JavaScript 项目
   - `vue3-ts-template` —— Vue 3 + TypeScript 项目

创建完成后，按提示操作：

```bash
cd your-project
pnpm install
pnpm dev
```

开发服务器将在 `http://localhost:4000` 启动。

## 手动安装到已有项目

你也可以将 Lite Vite 安装到任何已有项目中：

```bash
pnpm add lite-vite -D
```

### 配置入口 HTML

确保项目根目录下有一个 `index.html`，其中包含一个 module 类型的 script 标签：

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My App</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

### 配置 npm scripts

在 `package.json` 中添加以下脚本：

```json
{
  "scripts": {
    "dev": "lite-vite dev",
    "build": "lite-vite build"
  }
}
```

### 启动开发

```bash
pnpm dev
```

开发服务器默认在 `http://localhost:4000` 启动。你可以通过 `-p` 参数指定端口：

```bash
pnpm dev -- -p 3000
```

### 构建生产产物

```bash
pnpm build
```

构建产物默认输出到 `dist/` 目录。

## 配置文件（可选）

Lite Vite 支持通过配置文件进行自定义。在项目根目录创建以下任一文件（按优先级排序）：

- `lite.config.ts`（推荐）
- `lite.config.js`
- `lite.config.mjs`
- `lite.config.cjs`

```ts
// lite.config.ts
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
})
```

::: tip
大部分场景下，你不需要任何配置文件。Lite Vite 的默认行为已经能满足常见需求。
:::

## 项目结构

一个典型的 Lite Vite 项目结构如下：

```
my-project/
├── public/              # 静态资源（原样复制到产物目录）
│   └── favicon.svg
├── src/
│   ├── main.js          # 应用入口
│   ├── style.css         # 样式文件
│   └── ...
├── index.html            # HTML 入口
├── lite.config.ts        # 配置文件（可选）
└── package.json
```

## 下一步

- 了解 [所有功能](/guide/features) —— 详尽的功能清单
- 阅读 [配置参考](/config/dev-server) —— 完整的配置选项
- 学习 [插件开发](/plugins/writing-a-plugin) —— 编写自定义插件扩展能力
