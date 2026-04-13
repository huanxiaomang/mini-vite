# 构建配置

生产构建相关的配置选项。

## 构建选项 (build)

### build.outdir

- **类型：** `string`
- **默认值：** `'dist'`

构建产物输出目录。相对于项目根目录解析。

```ts
export default defineLiteConfig({
  build: {
    outdir: 'build'
  }
})
```

也可以通过 CLI 的 `-o` 参数指定：

```bash
lite-vite build -o build
```

::: warning
构建开始前，输出目录会被**完全清空**。请确保不要将重要文件放在输出目录中。
:::

### build.minify

- **类型：** `boolean`
- **默认值：** `false`

是否启用代码压缩。使用 esbuild 作为压缩引擎，速度远快于传统的 terser。

```ts
export default defineLiteConfig({
  build: {
    minify: true
  }
})
```

CLI 中通过 `--no-optimize` 显式禁用：

```bash
lite-vite build --no-optimize
```

### build.sourcemap

- **类型：** `boolean`
- **默认值：** `false`

是否生成 Source Map 文件。

```ts
export default defineLiteConfig({
  build: {
    sourcemap: true
  }
})
```

CLI 中通过 `-s` 开启：

```bash
lite-vite build -s
```

::: tip
Source Map 包含源代码映射信息。生产部署时请确保 `.map` 文件不会被公开访问，或使用 CDN 规则限制访问。
:::

### build.format

- **类型：** `'esm' | 'cjs'`
- **默认值：** `'esm'`

输出模块格式：

- `esm` —— ES Module，适合现代浏览器和支持 ESM 的 Node.js 环境
- `cjs` —— CommonJS，适合传统 Node.js 环境

```ts
export default defineLiteConfig({
  build: {
    format: 'esm'
  }
})
```

CLI 中通过 `-f` 指定：

```bash
lite-vite build -f cjs
```

### build.rollupOptions

- **类型：** `RollupOptions`
- **默认值：** `undefined`

直接传递给 Rollup 的自定义配置。这些选项会与 Lite Vite 的默认 Rollup 配置合并。

```ts
export default defineLiteConfig({
  build: {
    rollupOptions: {
      external: ['vue'],
      output: {
        globals: {
          vue: 'Vue'
        },
        // 自定义 chunk 文件名
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name].js',
      }
    }
  }
})
```

### build.lib

- **类型：** `{ entry: string; name: string; fileName: string }`
- **默认值：** `undefined`

库模式配置。启用后，Lite Vite 将以库模式构建，适合发布 npm 包。

```ts
export default defineLiteConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'MyLib',        // UMD 全局变量名
      fileName: 'my-lib',   // 输出文件名（不含扩展名）
    }
  }
})
```

## 顶层构建快捷选项

以下选项可以直接写在配置顶层，效果等同于对应的 `build.*` 选项：

### output

- **类型：** `string`
- **默认值：** `undefined`

等同于 `build.outdir`。

```ts
export default defineLiteConfig({
  output: 'build'
})
```

### sourcemap

- **类型：** `boolean`
- **默认值：** `undefined`

等同于 `build.sourcemap`。

```ts
export default defineLiteConfig({
  sourcemap: true
})
```

### format

- **类型：** `'esm' | 'cjs'`
- **默认值：** `undefined`

等同于 `build.format`。

```ts
export default defineLiteConfig({
  format: 'cjs'
})
```

## 内置 Rollup 插件

生产构建时，Lite Vite 自动配置以下 Rollup 插件：

| 插件 | 功能 |
|---|---|
| `@rollup/plugin-node-resolve` | 解析 node_modules 依赖 |
| `@rollup/plugin-replace` | 替换 `process.env.NODE_ENV` 为 `'production'` |
| `rollup-plugin-vue` | 编译 Vue 单文件组件 |
| `rollup-plugin-postcss` | 处理 CSS 文件 |
| `rollup-plugin-typescript2` | 编译 TypeScript（当 `tsconfig.json` 存在时） |
| `@rollup/plugin-image` | 处理图片资源 |
| esbuild minify（自定义） | 代码压缩（当 `minify: true` 时） |

用户插件中包含 `transform` 钩子的插件也会被适配为 Rollup 插件参与构建。

## 构建产物结构

```
dist/
├── index.html          # 入口 HTML（script src 已更新）
├── main.js             # 入口 chunk
├── [name]-[hash].js    # 代码分割 chunk
├── style.css           # 提取的 CSS（如有）
├── build-report.html   # 构建分析报告
└── (public/ 中的文件)   # 从 public/ 复制过来的静态资源
```

## 完整构建配置示例

```ts
// lite.config.ts
import { defineLiteConfig } from 'lite-vite'

export default defineLiteConfig({
  build: {
    outdir: 'dist',
    minify: true,
    sourcemap: false,
    format: 'esm',
    rollupOptions: {
      external: [],
    },
  },
})
```
