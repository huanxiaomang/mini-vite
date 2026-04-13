# 插件机制与 API

Lite Vite 提供了简洁而强大的插件系统，让你可以在开发和构建的各个阶段扩展工具的能力。

## 插件基本结构

一个 Lite Vite 插件是一个实现了 `PluginOption` 接口的对象：

```ts
interface PluginOption {
  /** 插件名称（用于日志和调试） */
  name: string

  /** 配置解析完成后调用 */
  configResolved?: (config: ViteContext) => void

  /** 构建开始前调用 */
  buildStart?: () => void | Promise<void>

  /** 文件内容转换 */
  transform?: (
    content: string | Buffer,
    filePath: string,
    options: {
      isModuleRequest: boolean
      port: number
      relativePath: string
    }
  ) => Promise<TransformResult | null>

  /** 构建产物写入磁盘后调用 */
  writeBundle?: () => void | Promise<void>

  /** 构建结束后调用 */
  buildEnd?: () => void | Promise<void>
}
```

### TransformResult

`transform` 钩子的返回值类型：

```ts
interface TransformResult {
  /** 转换后的代码内容 */
  code: string | Buffer

  /** 响应的 MIME 类型 */
  mimeType: string

  /** Source Map（可选） */
  map: RawSourceMap | null
}
```

## 使用插件

在配置文件中通过 `plugins` 数组使用插件：

```ts
// lite.config.ts
import { defineLiteConfig } from 'lite-vite'
import myPlugin from './my-plugin'

export default defineLiteConfig({
  plugins: [
    myPlugin({ /* 插件选项 */ }),
  ]
})
```

## 插件加载顺序

Lite Vite 的插件按以下顺序执行：

1. **内置插件**（按固定顺序）
   1. `html-loader` —— HTML 处理
   2. `css-loader` —— CSS 处理
   3. `vue-loader` —— Vue SFC 编译
   4. `js-loader` —— JavaScript 处理
   5. `image-loader` —— 图片处理
   6. `ts-loader` —— TypeScript 处理
2. **用户插件**（按配置数组顺序）

对于 `transform` 钩子，内置插件先处理。如果某个内置插件已经返回了结果（非 `null`），后续插件的 `transform` 不会被调用。用户插件也遵循同样的规则——第一个返回非 `null` 的 `transform` 结果将被采用。

## 内置插件详情

### html-loader

处理 `.html` 文件。在开发阶段，自动向 HTML 中注入 HMR 客户端脚本，建立浏览器与开发服务器之间的 WebSocket 连接。

### css-loader

处理 `.css` 文件，支持两种模式：

- **模块请求**（JS 中 `import './style.css'`）—— 将 CSS 转为 JavaScript 模块，通过 `<style>` 标签动态注入，支持 HMR
- **直接请求**（`<link>` 标签引用）—— 原样返回 CSS 内容

### vue-loader

处理 `.vue` 单文件组件：

- 使用 `@vue/compiler-sfc` 解析和编译
- 支持 `<script setup>` 语法
- 支持 `<style scoped>` 样式隔离
- 编译模板为渲染函数
- 自动重写导入路径

### js-loader

处理 `.js` / `.mjs` / `.jsx` 文件：

- 使用 `es-module-lexer` 分析导入语句
- 使用 `magic-string` 重写导入路径

### ts-loader

处理 `.ts` / `.tsx` 文件：

- 使用 esbuild 进行快速 TS → JS 转译
- 生成 inline source map
- 重写导入路径

### image-loader

处理图片文件（`.png` / `.jpg` / `.jpeg` / `.svg`）：

- SVG 文件编码为 data URI
- 其他图片返回文件路径
- 区分模块请求和直接请求

## 开发 vs 构建

插件在开发和构建阶段有不同的行为：

| 钩子 | 开发阶段 | 构建阶段 |
|---|---|---|
| `configResolved` | ✅ 调用 | ✅ 调用 |
| `buildStart` | ❌ 不调用 | ✅ 调用 |
| `transform` | ✅ 每次请求时调用 | ✅ 通过 Rollup 适配层调用 |
| `writeBundle` | ❌ 不调用 | ✅ 调用 |
| `buildEnd` | ❌ 不调用 | ✅ 调用 |

::: tip
在构建阶段，用户插件的 `transform` 钩子会被自动适配为 Rollup 插件，参与 Rollup 的构建管道。
:::
