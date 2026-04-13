# 编写自定义插件

本指南将带你从零开始编写一个 Lite Vite 插件。

## 最小插件

一个插件只需要一个 `name` 属性：

```ts
import type { PluginOption } from 'lite-vite'

const myPlugin: PluginOption = {
  name: 'my-plugin',
}
```

当然，这个插件什么也不做。让我们添加实际功能。

## 插件工厂函数

推荐使用工厂函数模式，支持传入配置选项：

```ts
import type { PluginOption } from 'lite-vite'

interface MyPluginOptions {
  debug?: boolean
}

export function myPlugin(options: MyPluginOptions = {}): PluginOption {
  const { debug = false } = options

  return {
    name: 'my-plugin',
    configResolved(config) {
      if (debug) {
        console.log('插件已加载，当前配置:', config)
      }
    },
  }
}
```

使用时：

```ts
// lite.config.ts
import { defineLiteConfig } from 'lite-vite'
import { myPlugin } from './plugins/my-plugin'

export default defineLiteConfig({
  plugins: [
    myPlugin({ debug: true }),
  ]
})
```

## 实战：JSON5 加载器插件

让我们编写一个完整的插件，支持在 JavaScript 中导入 `.json5` 文件。

### 第 1 步：基本结构

```ts
// plugins/json5-plugin.ts
import type { PluginOption } from 'lite-vite'

export function json5Plugin(): PluginOption {
  return {
    name: 'json5-loader',
    async transform(content, filePath, options) {
      // 只处理 .json5 文件
      if (!filePath.endsWith('.json5')) return null
      if (typeof content !== 'string') return null

      // TODO: 转换逻辑
      return null
    },
  }
}
```

### 第 2 步：实现转换逻辑

```ts
// plugins/json5-plugin.ts
import type { PluginOption } from 'lite-vite'

// 简化的 JSON5 解析（实际项目中使用 json5 库）
function parseJSON5(text: string): any {
  // 移除单行注释
  const cleaned = text.replace(/\/\/.*$/gm, '')
  // 移除尾部逗号
  const noTrailing = cleaned.replace(/,\s*([\]}])/g, '$1')
  return JSON.parse(noTrailing)
}

export function json5Plugin(): PluginOption {
  return {
    name: 'json5-loader',
    async transform(content, filePath, options) {
      if (!filePath.endsWith('.json5')) return null
      if (typeof content !== 'string') return null

      try {
        const data = parseJSON5(content)

        if (options.isModuleRequest) {
          // 作为 ES 模块导出
          return {
            code: `export default ${JSON.stringify(data, null, 2)}`,
            mimeType: 'application/javascript',
            map: null,
          }
        }

        // 直接返回 JSON
        return {
          code: JSON.stringify(data),
          mimeType: 'application/json',
          map: null,
        }
      } catch (err) {
        console.error(`JSON5 解析错误: ${filePath}`, err)
        return null
      }
    },
  }
}
```

### 第 3 步：使用插件

```ts
// lite.config.ts
import { defineLiteConfig } from 'lite-vite'
import { json5Plugin } from './plugins/json5-plugin'

export default defineLiteConfig({
  plugins: [json5Plugin()]
})
```

现在你可以在项目中这样使用：

```json5
// config.json5
{
  // 这是注释
  name: "my-app",
  version: "1.0.0",
  features: [
    "hmr",
    "typescript",  // 尾部逗号也可以
  ],
}
```

```ts
// main.ts
import config from './config.json5'
console.log(config.name) // "my-app"
```

## 实战：构建通知插件

一个在构建完成后发送通知的插件，展示构建阶段钩子的使用：

```ts
import type { PluginOption } from 'lite-vite'

interface NotifyOptions {
  title?: string
  onBuildStart?: () => void
  onBuildEnd?: (duration: number) => void
}

export function notifyPlugin(options: NotifyOptions = {}): PluginOption {
  const { title = '构建通知' } = options
  let startTime = 0

  return {
    name: 'build-notify',

    configResolved(config) {
      console.log(`[${title}] 插件已就绪`)
      console.log(`[${title}] 输出目录: ${config.output ?? 'dist'}`)
    },

    buildStart() {
      startTime = Date.now()
      console.log(`[${title}] 构建开始...`)
      options.onBuildStart?.()
    },

    writeBundle() {
      console.log(`[${title}] 产物已写入磁盘`)
    },

    buildEnd() {
      const duration = Date.now() - startTime
      console.log(`[${title}] 构建完成！耗时 ${duration}ms`)
      options.onBuildEnd?.(duration)
    },
  }
}
```

## 实战：环境变量注入插件

在所有 JS/TS 文件顶部注入环境变量：

```ts
import type { PluginOption } from 'lite-vite'

export function envPlugin(env: Record<string, string>): PluginOption {
  // 生成注入代码
  const envCode = Object.entries(env)
    .map(([key, value]) => `globalThis.${key} = ${JSON.stringify(value)};`)
    .join('\n')

  return {
    name: 'env-injector',

    async transform(content, filePath) {
      // 只处理 JS 入口文件
      if (!filePath.endsWith('.js') && !filePath.endsWith('.ts')) return null
      if (typeof content !== 'string') return null

      // 只在入口文件中注入（避免重复）
      if (!filePath.includes('main.') && !filePath.includes('index.')) return null

      return {
        code: `${envCode}\n${content}`,
        mimeType: 'application/javascript',
        map: null,
      }
    },
  }
}
```

使用：

```ts
export default defineLiteConfig({
  plugins: [
    envPlugin({
      APP_NAME: 'My App',
      API_URL: 'https://api.example.com',
    })
  ]
})
```

## 最佳实践

### 1. 命名规范

插件名称应使用 kebab-case，并具有描述性：

```ts
// ✅ 好的命名
name: 'markdown-loader'
name: 'env-injector'
name: 'build-notify'

// ❌ 不好的命名
name: 'plugin1'
name: 'myPlugin'
```

### 2. 尽早返回 null

在 `transform` 钩子中，对不关心的文件类型尽早返回 `null`，避免不必要的处理：

```ts
async transform(content, filePath) {
  // ✅ 第一行就判断文件类型
  if (!filePath.endsWith('.md')) return null
  if (typeof content !== 'string') return null

  // 实际处理逻辑
}
```

### 3. 区分模块请求和直接请求

`options.isModuleRequest` 决定了返回内容的形式：

```ts
async transform(content, filePath, options) {
  if (options.isModuleRequest) {
    // JS 中 import 引入——返回 JS 模块
    return {
      code: `export default ${JSON.stringify(data)}`,
      mimeType: 'application/javascript',
      map: null,
    }
  }

  // 浏览器直接请求——返回原始内容
  return {
    code: data,
    mimeType: 'text/plain',
    map: null,
  }
}
```

### 4. 错误处理

在 `transform` 中妥善处理错误，避免影响整个开发服务器：

```ts
async transform(content, filePath) {
  try {
    // 转换逻辑
  } catch (err) {
    console.error(`[my-plugin] 处理 ${filePath} 时出错:`, err)
    return null  // 返回 null 让其他插件尝试处理
  }
}
```

### 5. 支持 Source Map

如果插件修改了代码，尽量生成 Source Map 以保持调试体验：

```ts
return {
  code: transformedCode,
  mimeType: 'application/javascript',
  map: generatedSourceMap, // 而不是 null
}
```
