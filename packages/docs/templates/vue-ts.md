# Vue + TypeScript 模板

`vue3-ts-template` 是一个 Vue 3 + TypeScript 项目模板，提供完整的前端应用开发基础。

## 创建项目

```bash
pnpm create lite-vite@latest
# 选择 vue3-ts-template
```

## 目录结构

```
ts-vue-template/
├── public/
│   └── vite.svg              # 公共静态资源
├── src/
│   ├── assets/
│   │   └── vue.svg           # Vue logo
│   ├── App.vue               # 根组件
│   ├── main.ts               # 应用入口
│   ├── style.css             # 全局样式
│   ├── vite-env.d.ts         # 类型声明
│   └── vite.svg              # logo
├── index.html                # HTML 入口
├── package.json              # 项目配置
├── tsconfig.json             # TypeScript 根配置
├── tsconfig.app.json         # 应用代码 TS 配置
├── tsconfig.node.json        # Node 脚本 TS 配置
└── .gitignore
```

## package.json

```json
{
  "name": "ts-vue-template",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "lite-vite dev -p 3001",
    "build": "lite-vite build"
  },
  "dependencies": {
    "vue": "^3.5.13"
  },
  "devDependencies": {
    "@vue/tsconfig": "^0.7.0",
    "lite-vite": "^2.0.0",
    "typescript": "~5.7.2",
    "vue-tsc": "^2.2.4"
  }
}
```

## 关键文件

### index.html

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="./vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Lite Vite + Vue + TS</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

### src/main.ts

```ts
import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')
```

### src/App.vue

根组件示例，展示了 Vue 3 + `<script setup>` + TypeScript 的用法。

### src/vite-env.d.ts

TypeScript 类型声明文件，为 `.vue` 等非 TS 文件提供类型支持。

## TypeScript 配置

### tsconfig.json

```json
{
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

使用 [project references](https://www.typescriptlang.org/docs/handbook/project-references.html) 分离应用代码和 Node 脚本的编译配置。

### tsconfig.app.json

```json
{
  "extends": "@vue/tsconfig/tsconfig.dom.json",
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.cache/tsconfig.app.tsbuildinfo",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"]
}
```

## 命令

```bash
# 启动开发服务器（端口 3001）
pnpm dev

# 构建生产产物
pnpm build

# 类型检查（推荐在 CI 中运行）
npx vue-tsc --noEmit
```

## 特点

- **Vue 3 + Composition API** —— 使用 `<script setup>` 语法糖
- **TypeScript** —— 完整的类型安全支持
- **Scoped CSS** —— 组件级样式隔离
- **HMR** —— Vue 组件和 CSS 热更新
- **类型声明** —— 预配置的类型声明文件

## 适用场景

- Vue 3 前端应用开发
- 需要 TypeScript 类型安全的项目
- 中大型前端项目的起点
- 学习 Vue 3 + TypeScript 开发
