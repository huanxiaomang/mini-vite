# 开发服务器配置

## 配置文件

Lite Vite 支持以下配置文件（按加载优先级排序）：

| 文件名 | 格式 | 说明 |
|---|---|---|
| `lite.config.ts` | TypeScript | **推荐**，通过 esbuild 动态编译后加载 |
| `lite.config.js` | ESM JavaScript | 使用 `import/export` 语法 |
| `lite.config.mjs` | ESM JavaScript | 显式 ESM 标记 |
| `lite.config.cjs` | CommonJS | 使用 `require/module.exports` 语法 |

Lite Vite 会在项目根目录按上述顺序查找配置文件，找到第一个即停止。

## 配置辅助函数

使用 `defineLiteConfig` 获得完整的 TypeScript 类型提示：

```ts
// lite.config.ts
import { defineLiteConfig } from 'lite-vite'

export default defineLiteConfig({
  // 所有选项都有类型提示
})
```

`defineConfig` 是 `defineLiteConfig` 的别名，两者完全等价。

## 通用选项

### entry

- **类型：** `string`
- **默认值：** `'index.html'`

应用入口文件路径。通常不需要手动配置，Lite Vite 会自动使用项目根目录下的 `index.html`。

```ts
export default defineLiteConfig({
  entry: 'src/index.html'
})
```

### port

- **类型：** `number`
- **默认值：** `4000`

开发服务器监听端口。也可以通过 CLI 的 `-p` 参数指定（CLI 参数优先级更高）。

```ts
export default defineLiteConfig({
  port: 3000
})
```

### plugins

- **类型：** `PluginOption[]`
- **默认值：** `[]`

自定义插件数组。用户插件会追加在内置插件之后执行。

```ts
export default defineLiteConfig({
  plugins: [
    myPlugin(),
    anotherPlugin(),
  ]
})
```

详见 [插件开发](/plugins/writing-a-plugin)。

### logLevel

- **类型：** `'debug' | 'info' | 'warn' | 'error' | 'silent'`
- **默认值：** 开发环境 `'debug'`，生产环境 `'warn'`

控制日志输出的最低等级。设为 `'silent'` 可完全静默。

```ts
export default defineLiteConfig({
  logLevel: 'info'
})
```

### clearScreen

- **类型：** `boolean`
- **默认值：** `true`

启动开发服务器或构建时是否清除终端屏幕。

```ts
export default defineLiteConfig({
  clearScreen: false
})
```

### define

- **类型：** `Record<string, string>`
- **默认值：** `undefined`

定义全局常量替换。在构建时会对代码中的标识符进行静态替换。

```ts
export default defineLiteConfig({
  define: {
    __APP_VERSION__: JSON.stringify('1.0.0'),
    'process.env.NODE_ENV': JSON.stringify('production'),
  }
})
```

### resolve.alias

- **类型：** `Record<string, string>`
- **默认值：** `undefined`

路径别名映射。

```ts
import { resolve } from 'path'

export default defineLiteConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    }
  }
})
```

### resolve.extensions

- **类型：** `string[]`
- **默认值：** `undefined`

自定义扩展名解析顺序。

```ts
export default defineLiteConfig({
  resolve: {
    extensions: ['.ts', '.js', '.vue', '.json']
  }
})
```

## 服务器选项 (server)

### server.port

- **类型：** `number`
- **默认值：** `4000`

与顶层 `port` 等价，优先级相同。如果同时配置，`server.port` 会被 `port` 覆盖（当 CLI 未指定端口时）。

### server.open

- **类型：** `boolean`
- **默认值：** `false`

开发服务器启动后是否自动打开浏览器。

```ts
export default defineLiteConfig({
  server: {
    open: true
  }
})
```

### server.host

- **类型：** `string`
- **默认值：** `'localhost'`

开发服务器监听地址。设为 `'0.0.0.0'` 可让局域网内其他设备访问。

```ts
export default defineLiteConfig({
  server: {
    host: '0.0.0.0'
  }
})
```

## 完整配置示例

```ts
// lite.config.ts
import { resolve } from 'path'
import { defineLiteConfig } from 'lite-vite'

export default defineLiteConfig({
  // 通用
  entry: 'index.html',
  logLevel: 'info',
  clearScreen: true,

  // 开发服务器
  server: {
    port: 3000,
    open: true,
    host: 'localhost',
  },

  // 路径解析
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },

  // 全局常量
  define: {
    __APP_VERSION__: JSON.stringify('1.0.0'),
  },

  // 自定义插件
  plugins: [],
})
```

## 配置合并规则

当同时存在配置文件和 CLI 参数时，**CLI 参数优先级更高**。合并规则如下：

| 选项 | CLI 参数 | 配置文件 | 最终值 |
|---|---|---|---|
| port | `-p 3000` | `port: 8080` | `3000`（CLI 优先） |
| port | 未指定 | `port: 8080` | `8080`（取配置文件） |
| output | `-o build` | `build.outdir: 'dist'` | `build`（CLI 优先） |
