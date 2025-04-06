# lite-vite

主要包含 `create-vite` 和 `lite-vite` 模块，使用 `esbuild` 预构建依赖，`rollup` 打包项目，实现了一些简单的 loader 去转换 `vue3`、`png`、`ts` 等资源。

## 最快速度体验 lite-vite

只需要一条命令创建项目模板，包含原生 JS 和 Vue3+TS 两个版本：

```bash
pnpm create lite-vite@latest
```

然后可以像 Vite 一样开启 dev 模式或打包：

```json
{
  "scripts": {
    "dev": "lite-vite dev -p 3456", // 启动开发服务器
    "build": "lite-vite build" // 为生产环境构建产物
  }
}
```

或者直接执行：

```bash
npx lite-vite dev -p 3456
npx lite-vite build
```

尝试修改 js 或 html 文件，开发服务器会自动进行热更新。

查看 [create-vite](https://github.com/huanxiaomang/mini-vite/tree/main/packages/create-vite/template) 以获取每个模板的更多细节。

## 在现有项目中引入

也可以单独在你的项目中引入 `lite-vite`：

> **注意！！毕竟是手写的 Vite，目前只适配了 `create-lite-vite` 中的两个模板，其他项目可能有未知错误**

```bash
pnpm i lite-vite -D
```

也可以分别查看命令支持的选项：

```bash
npx lite-vite help dev
npx lite-vite help build
```

## 已实现功能

- [x] 命令行调用
- [x] 支持加载 HTML
- [x] 加载 JS 源码与依赖预构建
- [x] 加载静态文件
- [x] 加载 TS、Vue 文件
- [x] 自动猜测后缀加载
- [x] 自动添加 `?import`
- [x] 为 TS、Vue 添加 sourcemap
- [x] 基于 WebSocket 实现 HMR（支持 `index.html`、JS 等）
- [x] Rollup 实现 build 打包模式
- [x] 实现 plugin 处理 `public/` 目录
- [x] 实现 `create-lite-vite` 脚手架
- [x] 实现 CSS HMR策略
- [x] 实现JS传播更新

## 未实现功能

或许以后有时间会做：

- [ ] 分析文件副作用来决定 HMR 更新策略
- [ ] 实现 Vue 文件的 HMR
- [ ] 支持加载 `vite.config.ts`
- [ ] 支持传入 Rollup 插件

我会加油哒 (●• ̀ω•́ )✧
