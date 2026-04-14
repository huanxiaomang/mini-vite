import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Lite Vite',
  description: '下一代轻量级前端构建工具',
  lang: 'zh-CN',

  themeConfig: {
    logo: '/logo.svg',

    sidebar: [
      {
        text: '指南',
        items: [
          { text: '项目介绍', link: '/guide/introduction' },
          { text: '为什么选择 Lite Vite', link: '/guide/why' },
          { text: '快速开始', link: '/guide/getting-started' },
          { text: '功能总览', link: '/guide/features' },
          { text: '项目架构', link: '/guide/architecture' },
        ],
      },
      {
        text: '功能介绍',
        items: [
          { text: '热模块替换 (HMR)', link: '/features/hmr' },
          { text: '依赖预打包', link: '/features/pre-bundling' },
          { text: 'CSS 处理', link: '/features/css' },
          { text: '静态资源处理', link: '/features/static-assets' },
          { text: 'TypeScript 支持', link: '/features/typescript' },
          { text: 'Vue 单文件组件', link: '/features/vue' },
          { text: '构建分析报告', link: '/features/build-report' },
          { text: 'Source Map', link: '/features/source-map' },
        ],
      },
      {
        text: '配置参考',
        items: [
          { text: '开发服务器配置', link: '/config/dev-server' },
          { text: '构建配置', link: '/config/build' },
        ],
      },
      {
        text: 'CLI 命令',
        items: [
          { text: '命令参考', link: '/cli/' },
        ],
      },
      {
        text: '插件',
        items: [
          { text: '插件机制与 API', link: '/plugins/' },
          { text: '插件钩子详解', link: '/plugins/hooks' },
          { text: '编写自定义插件', link: '/plugins/writing-a-plugin' },
        ],
      },
      {
        text: '项目模板',
        items: [
          { text: '纯 JS 模板', link: '/templates/vanilla-js' },
          { text: 'Vue + TypeScript 模板', link: '/templates/vue-ts' },
        ],
      },
      {
        text: '原理',
        items: [
          { text: 'HMR 完整原理', link: '/advanced/module-graph' },
          { text: 'vite-plugin-vue 原理', link: '/advanced/vite-plugin-vue' },
          { text: '导入路径重写机制', link: '/advanced/import-rewriting' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/huanxiaomang/mini-vite' },
    ],

    footer: {
      message: '基于 MIT 许可发布',
      copyright: 'Copyright © 2025-present huanxiaomang',
    },

    search: {
      provider: 'local',
    },

    outline: {
      label: '页面导航',
    },

    docFooter: {
      prev: '上一页',
      next: '下一页',
    },
  },
})
