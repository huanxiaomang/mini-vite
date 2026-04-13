---
layout: home

hero:
  name: Lite Vite
  text: 下一代轻量级前端构建工具
  tagline: 基于原生 ESM 的极速开发体验，告别 webpack 时代的漫长等待
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: 为什么选择 Lite Vite?
      link: /guide/why
    - theme: alt
      text: GitHub
      link: https://github.com/huanxiaomang/mini-vite

features:
  - icon: ⚡
    title: 秒级冷启动
    details: 无需打包整个项目，开发服务器即启即用。不像 webpack 需要遍历所有模块才能启动，Lite Vite 按需编译，项目再大也能秒开。
  - icon: 🔥
    title: 即时热更新
    details: 基于模块依赖图的精准 HMR，只更新真正变化的模块。相比 webpack 的 HMR 随项目膨胀越来越慢，Lite Vite 始终保持毫秒级响应。
  - icon: 📦
    title: 极速依赖预打包
    details: 使用 esbuild 对第三方依赖进行预打包，速度比 webpack 的 DLL Plugin 方案快 10-100 倍，且完全自动化，无需手动配置。
  - icon: 🛠️
    title: 开箱即用
    details: 内置 TypeScript、Vue SFC、CSS、图片处理，无需像 webpack 那样逐个安装配置 ts-loader、vue-loader、css-loader、file-loader。
  - icon: 🎯
    title: 轻量级生产构建
    details: 基于 Rollup 的生产构建，天然支持 tree-shaking，产物更小更干净。告别 webpack 产物中臃肿的模块运行时代码。
  - icon: 📊
    title: 内置构建分析
    details: 自动生成可视化构建报告，包含体积分析、重复依赖检测、历史对比和优化建议，帮你持续把控产物质量。
---
