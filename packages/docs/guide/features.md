# 功能总览

本页详细列出 Lite Vite 的全部功能。每个功能点都包含简要说明，部分功能提供更详细的专题页面链接。

## 开发服务器

Lite Vite 的开发服务器基于 Node.js 原生 HTTP 模块构建，结合浏览器原生 ESM 支持，实现了极速的开发体验。

### 即时启动

服务器启动时不做任何预编译或打包工作，直接开始监听请求。所有源文件的编译转换都在浏览器实际请求时才按需进行。

相比 webpack 需要在启动前构建完整的依赖图并打包所有模块，Lite Vite 的启动速度与项目大小完全无关。

### HTML 入口自动识别

Lite Vite 自动识别 `index.html` 作为应用入口，解析其中的 `<script type="module">` 标签定位 JavaScript 入口文件。无需手动配置入口，也不需要额外的 HTML 插件。

### 静态资源服务

`public/` 目录下的文件将被作为静态资源直接服务，路径映射到根路径 `/`。例如 `public/favicon.svg` 可通过 `http://localhost:4000/favicon.svg` 访问。

### 端口配置

默认端口为 `4000`，支持以下方式自定义：

```bash
# CLI 参数
lite-vite dev -p 3000

# 配置文件
export default defineLiteConfig({
  server: { port: 3000 }
})
```

### 自动打开浏览器

通过配置 `server.open: true`，开发服务器启动后会自动打开默认浏览器：

```ts
export default defineLiteConfig({
  server: { open: true }
})
```

### 清屏控制

默认情况下，开发服务器启动时会清除终端屏幕。可以通过 `clearScreen: false` 关闭：

```ts
export default defineLiteConfig({
  clearScreen: false
})
```

---

## 热模块替换 (HMR) {#hmr}

Lite Vite 内置了完整的 HMR 功能，支持多种文件类型的热更新，无需刷新页面即可看到代码变更。

[详细文档 →](/features/hmr)

### 工作机制

1. 服务端通过 [chokidar](https://github.com/paulmillr/chokidar) 监听文件系统变更
2. 通过 WebSocket 与浏览器客户端建立实时通信
3. 文件变更时，分析模块依赖图，确定最小更新范围
4. 向客户端发送精准的更新指令

### 支持的热更新类型

| 文件类型 | 更新策略 |
|---|---|
| **CSS** | 无刷新样式替换——只替换变更的样式表，页面状态完整保留 |
| **JavaScript / TypeScript** | 基于 HMR 边界的模块级更新——沿依赖图传播，找到最近的 HMR 边界进行局部更新 |
| **Vue 单文件组件** | 组件级热更新——重新编译并替换变更的组件，保留应用状态 |
| **HTML** | 全页面刷新——HTML 结构变更后自动刷新页面 |

### HMR API

Lite Vite 通过 `import.meta.hot` 提供 HMR API，允许模块自主控制热更新行为：

```js
if (import.meta.hot) {
  // 声明当前模块接受自身更新
  import.meta.hot.accept()

  // 接受指定依赖的更新
  import.meta.hot.accept('./module.js', (newModule) => {
    // 使用新模块
  })

  // 清理副作用
  import.meta.hot.dispose((data) => {
    // 清理定时器、事件监听等
  })

  // 模块不再被引用时的回调
  import.meta.hot.prune(() => {
    // 清理工作
  })
}
```

### 自动重连

当 WebSocket 连接断开时（如服务器重启），HMR 客户端会自动尝试重新连接，无需手动刷新。

### 错误处理

编译错误会通过 WebSocket 发送到客户端，并在控制台显示详细的错误信息和堆栈。

---

## 依赖预打包 {#pre-bundling}

Lite Vite 使用 esbuild 对第三方依赖进行自动预打包。

[详细文档 →](/features/pre-bundling)

### 为什么需要预打包

第三方 npm 包通常以 CommonJS 格式发布，而浏览器只能理解 ESM。同时，像 `lodash-es` 这样的包有数百个子模块，如果逐一请求会造成严重的 HTTP 瀑布流问题。

预打包解决了这两个问题：
1. **格式转换** —— 将 CJS 依赖转为 ESM 格式
2. **模块合并** —— 将零散子模块合并为单个文件

### 自动检测

当代码中 `import` 一个裸模块（非相对路径，如 `import vue from 'vue'`）时，Lite Vite 自动识别为第三方依赖并触发预打包。

### 缓存机制

预打包结果缓存在 `node_modules/.lite-vite/` 目录下，附带 `metadata.json` 记录依赖映射。下次启动时直接读取缓存，避免重复预打包。

清除缓存只需删除该目录：

```bash
rm -rf node_modules/.lite-vite
```

---

## TypeScript 支持 {#typescript}

Lite Vite 内置 TypeScript 支持，无需安装任何额外的 loader 或插件。

[详细文档 →](/features/typescript)

### 开发阶段

使用 **esbuild** 进行即时转译，仅做语法转换（TS → JS），**不进行类型检查**。这使得 TS 文件的转换速度极快，不会拖慢开发体验。

::: tip
类型检查建议交给 IDE（如 VS Code 的 TypeScript 语言服务）或单独运行 `tsc --noEmit`。
:::

### 生产构建

使用 `rollup-plugin-typescript2` 进行完整编译。如果项目根目录存在 `tsconfig.json`，构建时会自动启用 TypeScript 支持。

### 支持的文件类型

- `.ts` —— TypeScript 源文件
- `.tsx` —— TypeScript + JSX

---

## Vue 单文件组件 {#vue}

Lite Vite 内置 Vue 3 单文件组件（SFC）的编译支持。

[详细文档 →](/features/vue)

### 编译流程

使用 `@vue/compiler-sfc` 官方编译器处理 `.vue` 文件：

1. **解析 SFC** —— 将 `.vue` 文件拆分为 script、template、style 三个块
2. **编译 script** —— 支持 `<script setup>` 和普通 `<script>` 语法
3. **编译 template** —— 将模板转为渲染函数
4. **编译 style** —— 支持 scoped CSS，自动添加作用域标识

### Scoped CSS

`<style scoped>` 中的样式会被自动添加唯一的 `data-v-xxx` 属性选择器，确保样式隔离：

```vue
<style scoped>
.title {
  color: red;
}
</style>
```

编译后，`.title` 选择器会被转为 `.title[data-v-xxxxxx]`，只作用于当前组件。

---

## CSS 处理 {#css}

Lite Vite 内置 CSS 处理支持，覆盖开发和生产两个阶段。

[详细文档 →](/features/css)

### 在 JS 中引入 CSS

```js
import './style.css'
```

CSS 文件在开发阶段会被转换为 JavaScript 模块，通过 `<style>` 标签动态注入到页面：

- 每个 CSS 文件对应一个 `<style>` 元素
- 通过 `data-module-path` 属性标识来源模块
- 支持热更新，修改 CSS 后无需刷新页面

### 直接请求 CSS

当浏览器直接请求 CSS 文件（如通过 `<link>` 标签），Lite Vite 会原样返回 CSS 内容。

### 生产构建

在生产构建时，CSS 文件通过 PostCSS 处理，支持自动前缀等功能。

---

## 静态资源处理 {#static-assets}

Lite Vite 内置多种静态资源的处理支持。

[详细文档 →](/features/static-assets)

### 图片引用

在 JavaScript 中引入图片资源：

```js
import logo from './logo.png'
// logo 是图片的 URL 路径
```

### SVG 内联

SVG 文件会被编码为 data URI 并内联到代码中，避免额外的网络请求：

```js
import icon from './icon.svg'
// icon 是 "data:image/svg+xml,..." 格式
```

### public 目录

`public/` 目录下的文件在开发和生产环境中都会被原样提供：

- 开发时直接通过开发服务器访问
- 构建时自动复制到输出目录

### 支持的图片格式

| 格式 | 开发阶段 | 生产构建 |
|---|---|---|
| `.svg` | 内联为 data URI | Rollup image 插件处理 |
| `.png` | 返回文件路径 | Rollup image 插件处理 |
| `.jpg` / `.jpeg` | 返回文件路径 | Rollup image 插件处理 |

---

## 生产构建 {#build}

Lite Vite 使用 Rollup 进行生产环境构建。

### 构建流程

1. **解析入口** —— 从 `index.html` 中解析 `<script type="module">` 的入口文件
2. **Rollup 打包** —— 使用 Rollup 及其插件链进行打包
3. **HTML 处理** —— 更新 HTML 中的脚本引用为构建后的文件名
4. **资源复制** —— 将 `public/` 目录内容复制到输出目录
5. **生成报告** —— 自动生成构建分析报告

### 输出格式

支持两种输出模块格式：

- **ESM**（默认）—— 现代浏览器原生支持
- **CJS** —— 适合 Node.js 环境

```bash
lite-vite build -f esm   # 输出 ESM 格式
lite-vite build -f cjs   # 输出 CJS 格式
```

### 代码压缩

通过 esbuild 进行代码压缩，速度远快于 terser：

```ts
export default defineLiteConfig({
  build: { minify: true }
})
```

或在 CLI 中（默认开启，使用 `--no-optimize` 禁用）：

```bash
lite-vite build              # 默认开启压缩
lite-vite build --no-optimize # 禁用压缩
```

### 自定义 Rollup 配置

可以通过 `build.rollupOptions` 传入自定义 Rollup 配置：

```ts
export default defineLiteConfig({
  build: {
    rollupOptions: {
      external: ['vue'],
      output: {
        globals: { vue: 'Vue' }
      }
    }
  }
})
```

### 库模式

支持以库模式构建，适合发布到 npm 的场景：

```ts
export default defineLiteConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'MyLib',
      fileName: 'my-lib',
    }
  }
})
```

---

## 构建分析报告 {#build-report}

每次构建后，Lite Vite 会自动在输出目录生成 `build-report.html` 可视化分析报告。

[详细文档 →](/features/build-report)

### 报告内容

- **总览面板** —— 构建时间、总体积、文件数量、模块数量
- **体积分类** —— JavaScript / CSS / 图片 / 字体等分类统计及占比
- **文件清单** —— 每个产物文件的原始体积、gzip 估算、brotli 估算
- **模块分析** —— 每个 chunk 包含的源模块及其体积
- **重复依赖检测** —— 自动检测被多个 chunk 重复打包的第三方库，计算浪费体积
- **网络模拟** —— 不同网络环境（5G/4G/3G/2G）下的预估加载时间
- **构建历史** —— 对比历史构建记录，追踪体积变化趋势
- **优化建议** —— 基于分析结果给出针对性优化建议

---

## Source Map {#source-map}

Lite Vite 在开发和生产阶段都支持 Source Map 生成。

[详细文档 →](/features/source-map)

### 开发阶段

TypeScript 文件在开发转译时自动生成 inline source map，方便在浏览器 DevTools 中直接调试源码。

### 生产构建

通过配置或 CLI 参数开启：

```ts
export default defineLiteConfig({
  build: { sourcemap: true }
})
```

```bash
lite-vite build -s
```

---

## 导入路径智能解析 {#import-resolution}

Lite Vite 对模块导入路径进行智能处理，让你无需关心路径转换细节。

### 裸模块重写

裸模块导入（如 `import { ref } from 'vue'`）会被自动重写为预打包后的路径：

```js
// 源代码
import { ref } from 'vue'

// 重写后（开发阶段）
import { ref } from '/node_modules/.lite-vite/vue.js'
```

### 扩展名补全

省略扩展名的导入会按以下顺序尝试补全：`.js` → `.ts` → `.jsx` → `.tsx`

```js
// 源代码
import { hello } from './utils'

// 自动解析为 ./utils.ts（如果存在）
```

### 静态资源标记

CSS 和图片等非代码资源的导入会自动添加 `?import` 查询参数，告知服务器以模块形式返回：

```js
import './style.css'     // → /src/style.css?import
import logo from './logo.png' // → /src/logo.png?import
```

---

## 插件系统 {#plugins}

Lite Vite 提供简洁而强大的插件机制，支持在开发和构建的各个阶段扩展功能。

[详细文档 →](/plugins/)

### 内置插件

Lite Vite 默认加载以下内置插件：

| 插件 | 功能 |
|---|---|
| `html-loader` | 处理 HTML 文件，注入 HMR 客户端脚本 |
| `css-loader` | 处理 CSS 文件，支持模块化注入和热更新 |
| `vue-loader` | 编译 Vue 单文件组件 |
| `js-loader` | 处理 JavaScript 文件，重写导入路径 |
| `ts-loader` | 处理 TypeScript 文件，esbuild 转译 + 导入重写 |
| `image-loader` | 处理图片资源，SVG 内联 / 路径引用 |

### 自定义插件

通过配置文件的 `plugins` 数组添加自定义插件：

```ts
export default defineLiteConfig({
  plugins: [myPlugin()]
})
```

插件提供以下生命周期钩子：

- `configResolved` —— 配置解析完成
- `buildStart` —— 构建开始
- `transform` —— 文件内容转换
- `writeBundle` —— 产物写入磁盘
- `buildEnd` —— 构建结束

---

## 项目脚手架 {#scaffolding}

`create-lite-vite` 提供交互式的项目创建体验。

### 使用方式

```bash
pnpm create lite-vite@latest
```

### 可用模板

| 模板 | 描述 | 包含技术 |
|---|---|---|
| `vanilla-js-template` | 纯 JavaScript 模板 | JS、CSS、HTML |
| `vue3-ts-template` | Vue 3 + TypeScript 模板 | Vue 3、TypeScript、CSS |

---

## ESLint 预设配置 {#eslint}

`@lite-vite/eslint-config` 提供统一的代码规范配置。

### 覆盖范围

- TypeScript（`@typescript-eslint`）
- Vue 3（`eslint-plugin-vue`）
- Import 排序（`eslint-plugin-import`）
- JSON / JSONC（`eslint-plugin-jsonc`）
- Markdown（`eslint-plugin-markdown`）
- 现代 JS 最佳实践（`eslint-plugin-unicorn`）
- Prettier 集成

---

## 共享工具库 {#shared}

`@lite-vite/shared` 提供可复用的工具函数。

### 日志系统

分级日志系统，支持 `debug` / `info` / `warn` / `error` 四个等级，带颜色输出：

```ts
import { log } from '@lite-vite/shared'

log.debug('调试信息')
log.info('提示信息')
log.warn('警告信息')
log.error('错误信息')
```

### 文件工具

```ts
import { fileExists, copyFiles, hasFolder, normalize, normalizeImportPath } from '@lite-vite/shared'

await fileExists('/path/to/file')  // 检查文件是否存在
await copyFiles(src, dest)          // 递归复制文件
await hasFolder('/path/to/dir')     // 检查目录是否存在
```

### MIME 类型

```ts
import { getMimeType, MIME_TYPES } from '@lite-vite/shared'

getMimeType('.js')  // 'application/javascript'
getMimeType('.css') // 'text/css'
```
