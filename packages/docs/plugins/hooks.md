# 插件钩子详解

本页详细说明 Lite Vite 插件系统中每个钩子的签名、调用时机、参数含义和使用场景。

## configResolved

```ts
configResolved?: (config: ViteContext) => void
```

### 调用时机

配置文件加载完成、CLI 参数合并完成、插件列表确定之后调用。此时配置已经是最终状态，不应再修改。

### 参数

| 参数 | 类型 | 说明 |
|---|---|---|
| `config` | `ViteContext` | 完整的最终配置对象 |

`ViteContext` 包含以下关键字段：

```ts
interface ViteContext {
  entry: string              // 入口文件路径
  port?: number              // 端口号
  plugins: PluginOption[]    // 全部插件列表（含内置）
  output?: string            // 输出目录
  sourcemap?: boolean        // 是否开启 Source Map
  format?: 'esm' | 'cjs'    // 输出格式
  logLevel?: LogLevel        // 日志等级
  clearScreen?: boolean      // 是否清屏
  server?: {                 // 服务器选项
    open?: boolean
    host?: string
  }
  build?: {                  // 构建选项
    outdir: string
    minify?: boolean
    sourcemap?: boolean
    format?: 'esm' | 'cjs'
    rollupOptions?: RollupOptions
    lib?: { entry: string; name: string; fileName: string }
  }
  resolve?: {                // 路径解析选项
    alias?: Record<string, string>
    extensions?: string[]
  }
  define?: Record<string, string>  // 全局常量
}
```

### 使用场景

- 根据最终配置初始化插件内部状态
- 读取其他插件的配置信息
- 条件性地启用/禁用功能

### 示例

```ts
const myPlugin = (): PluginOption => {
  let isProduction = false

  return {
    name: 'my-plugin',
    configResolved(config) {
      // 根据配置决定行为
      isProduction = config.build?.minify ?? false
      console.log(`插件运行模式: ${isProduction ? '生产' : '开发'}`)
      console.log(`已加载 ${config.plugins.length} 个插件`)
    },
  }
}
```

---

## buildStart

```ts
buildStart?: () => void | Promise<void>
```

### 调用时机

**仅在构建阶段**调用，在 Rollup 开始打包之前执行。开发服务器模式下不会调用此钩子。

### 使用场景

- 构建前的环境准备（创建目录、初始化状态）
- 前置校验
- 记录构建开始时间

### 示例

```ts
const timingPlugin = (): PluginOption => {
  let startTime: number

  return {
    name: 'timing-plugin',
    buildStart() {
      startTime = Date.now()
      console.log('构建开始...')
    },
    buildEnd() {
      console.log(`构建耗时: ${Date.now() - startTime}ms`)
    },
  }
}
```

---

## transform

```ts
transform?: (
  content: string | Buffer,
  filePath: string,
  options: {
    isModuleRequest: boolean
    port: number
    relativePath: string
  }
) => Promise<TransformResult | null>
```

这是最核心的钩子，用于转换文件内容。

### 调用时机

- **开发阶段：** 每当浏览器请求一个文件时，按插件顺序调用 `transform`。第一个返回非 `null` 结果的插件"赢得"处理权。
- **构建阶段：** 通过 Rollup 适配层调用，参与 Rollup 的 transform 管道。

### 参数

| 参数 | 类型 | 说明 |
|---|---|---|
| `content` | `string \| Buffer` | 文件原始内容。文本文件为 `string`，二进制文件为 `Buffer` |
| `filePath` | `string` | 文件的绝对路径 |
| `options.isModuleRequest` | `boolean` | 是否为模块请求（JS 中 `import` 引入 vs 浏览器直接请求） |
| `options.port` | `number` | 当前开发服务器端口号 |
| `options.relativePath` | `string` | 文件相对于项目根目录的路径（以 `/` 开头） |

### 返回值

返回 `null` 表示此插件不处理该文件，交给下一个插件处理。

返回 `TransformResult` 对象表示此插件已处理该文件：

```ts
interface TransformResult {
  code: string | Buffer  // 转换后的内容
  mimeType: string       // HTTP 响应的 Content-Type
  map: RawSourceMap | null // Source Map（可选）
}
```

### 使用场景

- 自定义文件类型处理（如 Markdown、YAML）
- 代码注入（如全局变量、polyfill）
- 代码转换（如编译、压缩）

### 示例：Markdown 转 HTML 插件

```ts
const markdownPlugin = (): PluginOption => ({
  name: 'markdown-loader',
  async transform(content, filePath, options) {
    // 只处理 .md 文件
    if (!filePath.endsWith('.md')) return null
    if (typeof content !== 'string') return null

    // 简单的 Markdown 转 HTML
    const html = convertMarkdownToHtml(content)

    if (options.isModuleRequest) {
      // 作为 JS 模块导出
      return {
        code: `export default ${JSON.stringify(html)}`,
        mimeType: 'application/javascript',
        map: null,
      }
    }

    // 直接返回 HTML
    return {
      code: html,
      mimeType: 'text/html',
      map: null,
    }
  },
})
```

### 示例：全局注入插件

```ts
const injectPlugin = (banner: string): PluginOption => ({
  name: 'inject-banner',
  async transform(content, filePath) {
    if (!filePath.endsWith('.js') && !filePath.endsWith('.ts')) return null
    if (typeof content !== 'string') return null

    return {
      code: `${banner}\n${content}`,
      mimeType: 'application/javascript',
      map: null,
    }
  },
})
```

---

## writeBundle

```ts
writeBundle?: () => void | Promise<void>
```

### 调用时机

**仅在构建阶段**调用，在 Rollup 将打包结果写入磁盘之后执行。此时所有 chunk 和 asset 文件已存在于输出目录中。

### 使用场景

- 对产物进行后处理
- 复制额外文件到输出目录
- 生成额外产物（如 manifest.json）
- 发送构建通知

### 示例：复制额外文件

```ts
import { copyFile } from 'fs/promises'
import { join } from 'path'

const copyPlugin = (): PluginOption => ({
  name: 'copy-extra-files',
  async writeBundle() {
    await copyFile(
      join(process.cwd(), 'robots.txt'),
      join(process.cwd(), 'dist', 'robots.txt')
    )
    console.log('已复制 robots.txt 到输出目录')
  },
})
```

---

## buildEnd

```ts
buildEnd?: () => void | Promise<void>
```

### 调用时机

**仅在构建阶段**调用，在所有构建工作完成之后（包括 `writeBundle`）执行。这是构建阶段的最后一个钩子。

### 使用场景

- 输出构建摘要
- 清理临时文件
- 记录构建耗时

### 示例

```ts
const summaryPlugin = (): PluginOption => ({
  name: 'build-summary',
  buildEnd() {
    console.log('='.repeat(40))
    console.log('构建完成！')
    console.log(`输出目录: dist/`)
    console.log('='.repeat(40))
  },
})
```

---

## 钩子执行顺序

完整的钩子调用时序：

### 开发阶段

```
启动
  ↓
configResolved (所有插件)
  ↓
服务器开始监听
  ↓
[请求到达]
  ↓
transform (按插件顺序，第一个返回结果的生效)
  ↓
[响应返回]
```

### 构建阶段

```
启动
  ↓
configResolved (所有插件)
  ↓
buildStart (所有插件，按顺序)
  ↓
Rollup 打包 (transform 通过适配层调用)
  ↓
writeBundle (所有插件，按顺序)
  ↓
buildEnd (所有插件，按顺序)
```
